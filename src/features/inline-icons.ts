import * as vscode from 'vscode';
import type { PythonAnalyzer } from '../core/analyzer';
import { findInlineIcons, parseInlineMode, type InlineMode } from '../core/inline';
import { baseName, errorText, NULL_LOGGER, scoped, stopwatch, type Logger, type ScopedLog } from '../core/log';
import { previewImages, type PreviewFiles, type PreviewImages } from '../iconify/previews';

/** 编辑停顿多久后才重新找图标，单位毫秒。 */
const REFRESH_DELAY_MS = 300;
/** 图标陆续下载好时，合并多久内的更新再重画一次，单位毫秒。 */
const PAINT_DELAY_MS = 80;
/** 图标高度相对编辑器字号的倍数。 */
const ICON_SCALE = 1.2;
const DEFAULT_FONT_SIZE = 14;
/** 行号前模式下最多同时保留多少种图标的装饰样式，超过就全部重建。 */
const MAX_GUTTER_TYPES = 150;

/** 行内图标需要的预览能力，测试里换成假的。 */
export interface InlinePreviews {
	load(names: readonly string[], signal: AbortSignal, onReady: (name: string, files: PreviewFiles) => void): Promise<void>;
}

/** 一处要画图标的位置。 */
interface Placed {
	name: string;
	range: vscode.Range;
}

/** 每个编辑器各自的状态。 */
interface EditorState {
	placed: Placed[];
	/** 已经备好的图标图片；图标内容不会变，编辑文件时可以一直沿用。 */
	ready: Map<string, PreviewImages>;
	/** 当前画在行号前的图标名，下次重画时用来清掉不再需要的。 */
	gutter: Set<string>;
	controller?: AbortController;
	refreshTimer?: NodeJS.Timeout;
	paintTimer?: NodeJS.Timeout;
}

/** 图片放在图标前或后，写法随位置不同。 */
function attach(position: 'before' | 'after', options: vscode.ThemableDecorationAttachmentRenderOptions): vscode.ThemableDecorationInstanceRenderOptions {
	return position === 'before' ? { before: options } : { after: options };
}

/**
 * 在 pyside-iconify 调用的 icon 参数旁边画出真实图标，显示方式由设置 pyside-iconify.inlineIcons 决定。
 * 只画能确定的普通字符串；图标名不合法、服务器没有这个图标、断网时只是不画，文字照常显示。
 */
export class InlineIcons implements vscode.Disposable {
	private readonly states = new Map<vscode.TextEditor, EditorState>();
	private readonly iconType = vscode.window.createTextEditorDecorationType({
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
	});
	/**
	 * VS Code 没有正式的"隐藏一段文字"接口，这里借 CSS 注入的写法（Iconify IntelliSense 也是这样做的）。
	 * 将来某个版本若不再认，表现为文字不再隐藏、图标和文字同时显示，不会报错。
	 */
	private readonly hideType = vscode.window.createTextEditorDecorationType({ textDecoration: 'none; display: none;' });
	private readonly gutterTypes = new Map<string, vscode.TextEditorDecorationType>();
	private mode: InlineMode = 'iconOnly';
	private readonly log: ScopedLog;

	/**
	 * @param analyzer 共享的 Python 解析器。
	 * @param previews 图标预览缓存。
	 * @param logger 日志。
	 */
	constructor(
		private readonly analyzer: Promise<PythonAnalyzer>,
		private readonly previews: InlinePreviews,
		logger: Logger = NULL_LOGGER
	) {
		this.log = scoped(logger, 'inline');
		this.reloadMode();
	}

	/** 重新读取设置里的显示方式。 */
	reloadMode(): void {
		const raw: unknown = vscode.workspace.getConfiguration('pyside-iconify').get('inlineIcons');
		const previous = this.mode;
		this.mode = parseInlineMode(raw);
		if (raw !== this.mode) {
			this.log.warn('mode-invalid', { value: typeof raw === 'string' ? raw : typeof raw, fallback: this.mode });
		}
		this.log.info('mode', { mode: this.mode, previous });
	}

	/** 当前使用的显示方式。 */
	get currentMode(): InlineMode {
		return this.mode;
	}

	/** 丢掉已备好的图片，字号变了需要按新大小重做。 */
	forgetImages(): void {
		let dropped = 0;
		for (const state of this.states.values()) {
			dropped += state.ready.size;
			state.ready.clear();
		}
		this.log.debug('images-forgotten', { dropped, editors: this.states.size });
	}

	/** 对所有可见的 Python 编辑器重新找图标并重画。 */
	refreshAll(): Promise<void[]> {
		return Promise.all(vscode.window.visibleTextEditors.map((editor) => this.refresh(editor)));
	}

	/** 清理已经不可见的编辑器。 */
	prune(): void {
		const visible = new Set(vscode.window.visibleTextEditors);
		for (const [editor, state] of this.states) {
			if (!visible.has(editor)) {
				this.release(state);
				this.states.delete(editor);
				this.log.debug('editor-released', { file: baseName(editor.document.fileName), remaining: this.states.size });
			}
		}
	}

	/**
	 * 编辑停顿后再刷新，避免每敲一个字符都重新解析。
	 *
	 * @param document 被编辑的文档；它在哪些可见编辑器里，就刷新哪些。
	 */
	scheduleRefresh(document: vscode.TextDocument): void {
		for (const editor of vscode.window.visibleTextEditors) {
			if (editor.document !== document) {
				continue;
			}
			const state = this.stateOf(editor);
			clearTimeout(state.refreshTimer);
			state.refreshTimer = setTimeout(() => void this.refresh(editor), REFRESH_DELAY_MS);
		}
	}

	/**
	 * 重新找出编辑器里的图标、准备图片并重画。
	 *
	 * @param editor 要刷新的编辑器；不是 Python 文件或显示方式为 off 时只清空已画的内容。
	 */
	async refresh(editor: vscode.TextEditor): Promise<void> {
		const state = this.stateOf(editor);
		state.controller?.abort();
		const { document } = editor;
		const file = baseName(document.fileName);
		if (document.languageId !== 'python' || this.mode === 'off') {
			state.placed = [];
			this.paintAll(editor, state);
			this.log.debug('cleared', { file, reason: document.languageId !== 'python' ? 'not-python' : 'mode-off', language: document.languageId });
			return;
		}
		const elapsed = stopwatch();
		const controller = new AbortController();
		state.controller = controller;
		const version = document.version;

		let engine: PythonAnalyzer;
		try {
			engine = await this.analyzer;
		} catch (error) {
			this.log.error('refresh-skipped', { file, reason: 'parser-unavailable', error: errorText(error) });
			return;
		}
		if (controller.signal.aborted || document.isClosed) {
			this.log.debug('refresh-skipped', { file, reason: document.isClosed ? 'document-closed' : 'superseded' });
			return;
		}
		const text = document.getText();
		state.placed = findInlineIcons(text, engine.findCalls(text)).map((icon) => ({
			name: icon.name,
			range: new vscode.Range(document.positionAt(icon.range.start), document.positionAt(icon.range.end)),
		}));
		const names = [...new Set(state.placed.map((place) => place.name))];
		const alreadyReady = names.filter((name) => state.ready.has(name)).length;
		this.log.debug('found', { file, version, places: state.placed.length, distinct: names.length, alreadyReady, mode: this.mode });
		// 先把已经备好的画出来，新的随下载陆续补上
		this.paintAll(editor, state);

		const height = this.iconHeight(editor);
		const converting: Array<Promise<void>> = [];
		let unreadable = 0;
		try {
			await this.previews.load(names, controller.signal, (name, files) => {
				converting.push(
					previewImages(files, height).then(
						(images) => {
							state.ready.set(name, images);
							this.schedulePaint(editor, state, controller.signal);
						},
						(error: unknown) => {
							unreadable++;
							this.log.warn('image-unreadable', { file, icon: name, error: errorText(error) });
						}
					)
				);
			});
			await Promise.all(converting);
		} catch (error) {
			// 取不到图标时文字照常显示
			this.log.warn('previews-failed', { file, error: errorText(error) });
		}
		if (controller.signal.aborted || document.version !== version) {
			this.log.debug('refresh-stale', { file, reason: controller.signal.aborted ? 'superseded' : 'edited-meanwhile', ms: elapsed() });
			return;
		}
		this.paintAll(editor, state);
		const drawn = this.drawable(state).length;
		this.log.info('refreshed', { file, mode: this.mode, places: state.placed.length, drawn, missing: state.placed.length - drawn, unreadable, ms: elapsed() });
	}

	/** 光标移动后重画隐藏的文字：光标所在的行要显示文字，否则没法编辑。 */
	paintHidden(editor: vscode.TextEditor): void {
		const state = this.states.get(editor);
		if (state) {
			this.applyHidden(editor, state);
		}
	}

	dispose(): void {
		for (const state of this.states.values()) {
			this.release(state);
		}
		this.states.clear();
		this.iconType.dispose();
		this.hideType.dispose();
		this.disposeGutterTypes();
	}

	private stateOf(editor: vscode.TextEditor): EditorState {
		let state = this.states.get(editor);
		if (!state) {
			state = { placed: [], ready: new Map(), gutter: new Set() };
			this.states.set(editor, state);
		}
		return state;
	}

	private release(state: EditorState): void {
		state.controller?.abort();
		clearTimeout(state.refreshTimer);
		clearTimeout(state.paintTimer);
	}

	private iconHeight(editor: vscode.TextEditor): number {
		const size = vscode.workspace.getConfiguration('editor', editor.document).get<number>('fontSize');
		return Math.round((size && size > 0 ? size : DEFAULT_FONT_SIZE) * ICON_SCALE);
	}

	private schedulePaint(editor: vscode.TextEditor, state: EditorState, signal: AbortSignal): void {
		if (state.paintTimer) {
			return;
		}
		state.paintTimer = setTimeout(() => {
			state.paintTimer = undefined;
			if (!signal.aborted) {
				this.paintAll(editor, state);
			}
		}, PAINT_DELAY_MS);
	}

	private paintAll(editor: vscode.TextEditor, state: EditorState): void {
		this.applyIcons(editor, state);
		this.applyHidden(editor, state);
		this.applyGutter(editor, state);
	}

	/** 只有已经备好图片的位置才画；没备好的保持原样，文字也不隐藏。 */
	private drawable(state: EditorState): Array<Placed & { images: PreviewImages }> {
		const result: Array<Placed & { images: PreviewImages }> = [];
		for (const place of state.placed) {
			const images = state.ready.get(place.name);
			if (images) {
				result.push({ ...place, images });
			}
		}
		return result;
	}

	private applyIcons(editor: vscode.TextEditor, state: EditorState): void {
		if (this.mode !== 'iconBefore' && this.mode !== 'iconAfter' && this.mode !== 'iconOnly') {
			editor.setDecorations(this.iconType, []);
			return;
		}
		this.log.debug('paint-icons', { file: baseName(editor.document.fileName), mode: this.mode, count: this.drawable(state).length });
		const position = this.mode === 'iconAfter' ? 'after' : 'before';
		const height = this.iconHeight(editor);
		const decorations: vscode.DecorationOptions[] = this.drawable(state).map(({ range, images }) => ({
			range,
			renderOptions: {
				// vertical-align 借 margin 的值一起写进样式，与 Iconify IntelliSense 的做法相同
				...attach(position, { width: `${images.width}px`, height: `${height}px`, margin: '0 2px; vertical-align: middle' }),
				light: attach(position, { contentIconPath: vscode.Uri.parse(images.light) }),
				dark: attach(position, { contentIconPath: vscode.Uri.parse(images.dark) }),
			},
		}));
		editor.setDecorations(this.iconType, decorations);
	}

	private applyHidden(editor: vscode.TextEditor, state: EditorState): void {
		if (this.mode !== 'iconOnly') {
			editor.setDecorations(this.hideType, []);
			return;
		}
		const all = this.drawable(state).map(({ range }) => range);
		const hidden = all.filter((range) => !editor.selections.some((selection) => selection.start.line <= range.start.line && range.start.line <= selection.end.line));
		editor.setDecorations(this.hideType, hidden);
		if (all.length > 0) {
			this.log.debug('paint-hidden', { hidden: hidden.length, shownForEditing: all.length - hidden.length });
		}
	}

	private applyGutter(editor: vscode.TextEditor, state: EditorState): void {
		const byName = new Map<string, { images: PreviewImages; ranges: vscode.Range[] }>();
		if (this.mode === 'gutter') {
			for (const { name, range, images } of this.drawable(state)) {
				const entry = byName.get(name) ?? { images, ranges: [] };
				entry.ranges.push(range);
				byName.set(name, entry);
			}
		}
		for (const name of state.gutter) {
			const type = this.gutterTypes.get(name);
			if (type && !byName.has(name)) {
				editor.setDecorations(type, []);
			}
		}
		if (this.gutterTypes.size + byName.size > MAX_GUTTER_TYPES) {
			this.log.warn('gutter-types-reset', { had: this.gutterTypes.size, needed: byName.size, limit: MAX_GUTTER_TYPES });
			this.disposeGutterTypes();
		}
		for (const [name, { images, ranges }] of byName) {
			let type = this.gutterTypes.get(name);
			if (!type) {
				type = vscode.window.createTextEditorDecorationType({
					gutterIconSize: 'contain',
					light: { gutterIconPath: vscode.Uri.parse(images.light) },
					dark: { gutterIconPath: vscode.Uri.parse(images.dark) },
				});
				this.gutterTypes.set(name, type);
			}
			editor.setDecorations(type, ranges);
		}
		state.gutter = new Set(byName.keys());
		if (this.mode === 'gutter') {
			this.log.debug('paint-gutter', { kinds: byName.size, types: this.gutterTypes.size });
		}
	}

	/** 释放所有行号前图标的样式；别的编辑器里的会随之消失，等下次重画再补上。 */
	private disposeGutterTypes(): void {
		for (const type of this.gutterTypes.values()) {
			type.dispose();
		}
		this.gutterTypes.clear();
		for (const state of this.states.values()) {
			state.gutter.clear();
		}
	}
}

/**
 * 注册行内图标：打开文件、编辑停顿、切换编辑器、改设置时刷新，光标移动时更新被隐藏的文字。
 *
 * @param context 扩展上下文，释放句柄会登记到它上面。
 * @param analyzer 共享的 Python 解析器。
 * @param previews 图标预览缓存。
 * @param logger 日志。
 */
export function registerInlineIcons(
	context: vscode.ExtensionContext,
	analyzer: Promise<PythonAnalyzer>,
	previews: InlinePreviews,
	logger: Logger = NULL_LOGGER
): void {
	const icons = new InlineIcons(analyzer, previews, logger);
	scoped(logger, 'inline').info('registered', { mode: icons.currentMode });
	context.subscriptions.push(
		icons,
		vscode.window.onDidChangeVisibleTextEditors(() => {
			icons.prune();
			void icons.refreshAll();
		}),
		vscode.window.onDidChangeTextEditorSelection((event) => icons.paintHidden(event.textEditor)),
		vscode.workspace.onDidChangeTextDocument((event) => icons.scheduleRefresh(event.document)),
		vscode.workspace.onDidChangeConfiguration((event) => {
			const modeChanged = event.affectsConfiguration('pyside-iconify.inlineIcons');
			const sizeChanged = event.affectsConfiguration('editor.fontSize');
			if (!modeChanged && !sizeChanged) {
				return;
			}
			scoped(logger, 'inline').debug('config-changed', { mode: modeChanged, fontSize: sizeChanged });
			if (modeChanged) {
				icons.reloadMode();
			}
			if (sizeChanged) {
				icons.forgetImages();
			}
			void icons.refreshAll();
		})
	);
	void icons.refreshAll();
}
