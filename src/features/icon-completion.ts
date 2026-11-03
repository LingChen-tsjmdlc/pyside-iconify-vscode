import * as vscode from 'vscode';
import type { PythonAnalyzer } from '../core/analyzer';
import { errorText, NULL_LOGGER, scoped, stopwatch, type Logger, type ScopedLog } from '../core/log';
import { isValidIconName } from '../core/rules';
import { isSingleKeystroke } from '../core/typing';
import type { SearchResult } from '../iconify/api';
import { previewDataUri, type PreviewFiles } from '../iconify/previews';

/** 输入停顿多久后才发搜索请求，单位毫秒。 */
const SEARCH_DELAY_MS = 150;
/** 手敲一个字符后，隔多久主动弹出补全，单位毫秒。 */
const TRIGGER_DELAY_MS = 80;
/** 详情面板里大图的高度，单位像素。 */
const DETAIL_IMAGE_HEIGHT = 150;
/** 列表弹出前最多等多久，等预览备好后直接带上详情，单位毫秒。 */
const PREVIEW_WAIT_MS = 500;
/** 内存里缓存最近几个搜索词的结果。 */
const CACHE_SIZE = 20;
/** 至少输入几个字符才搜索；一个字符的结果基本是噪音。 */
const MIN_QUERY_LENGTH = 2;

/** 补全需要的搜索能力，测试里换成假的。 */
export interface IconSource {
	search(query: string, start: number): Promise<SearchResult>;
}

/** 补全需要的预览能力，测试里换成假的。 */
export interface PreviewSource {
	get(name: string, signal: AbortSignal): Promise<PreviewFiles | undefined>;
	load(names: readonly string[], signal: AbortSignal, onReady: (name: string, files: PreviewFiles) => void): Promise<void>;
}

/** 详情面板里的内容：居中的大图，下面是图标名。写法与 Iconify IntelliSense 一致。 */
async function detailOf(name: string, files: PreviewFiles): Promise<vscode.MarkdownString> {
	const uri = await previewDataUri(files, isLight(), DETAIL_IMAGE_HEIGHT);
	return new vscode.MarkdownString(`| |\n|:---:|\n| ![](${uri}) |\n| \`${name}\` |\n`);
}

/**
 * 暂时没有真正的候选时返回的占位列表：只含一条提示，确认后字符串内容不变。
 * 列表必须非空且标记为不完整，VS Code 才会在继续输入时重新请求；空列表或 undefined 都会让它认为补全已结束。
 *
 * @param message 提示文字，作为条目的标签。
 * @param typed 光标前已输入的内容，用作过滤文本，保证提示不会被过滤掉。
 * @param current 字符串当前的全部内容，确认提示时原样写回。
 * @param range 字符串内容的范围。
 */
function placeholder(message: string, typed: string, current: string, range: vscode.Range): vscode.CompletionList {
	const item = new vscode.CompletionItem(message, vscode.CompletionItemKind.Text);
	item.range = range;
	item.insertText = current;
	item.filterText = typed;
	item.sortText = '0000';
	return new vscode.CompletionList([item], true);
}

/** 补全项的标签文字；标签可能是纯字符串，也可能是带描述的对象。 */
function labelOf(item: vscode.CompletionItem): string {
	return typeof item.label === 'string' ? item.label : item.label.label;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLight(): boolean {
	const kind = vscode.window.activeColorTheme.kind;
	return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight;
}

/**
 * 在 pyside-iconify 调用的 icon 参数字符串里，按已输入的内容搜索图标并给出补全。
 * 确认后整段字符串内容被替换为所选图标名。
 */
export class IconCompletionProvider implements vscode.CompletionItemProvider {
	private readonly cache = new Map<string, Promise<SearchResult>>();
	private readonly log: ScopedLog;
	private requests = 0;

	/**
	 * @param analyzer 共享的 Python 解析器，用来判断光标是否在 icon 参数的字符串里。
	 * @param source 图标搜索，联网失败时给出一条提示，不打扰用户。
	 * @param previews 图标预览，选中某项时才加载。
	 * @param logger 日志；每个请求有编号，每个提前返回都写明原因。
	 */
	constructor(
		private readonly analyzer: Promise<PythonAnalyzer>,
		private readonly source: IconSource,
		private readonly previews: PreviewSource,
		logger: Logger = NULL_LOGGER
	) {
		this.log = scoped(logger, 'completion');
	}

	async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.CompletionList | undefined> {
		const id = ++this.requests;
		const elapsed = stopwatch();
		this.log.debug('start', { id, line: position.line, col: position.character, version: document.version });
		try {
			const list = await this.provide(id, document, position, token);
			this.log.debug('finish', { id, items: list?.items.length, incomplete: list?.isIncomplete, cancelled: token.isCancellationRequested, ms: elapsed() });
			return list;
		} catch (error) {
			this.log.error('failed', { id, error: errorText(error), ms: elapsed() });
			return undefined;
		}
	}

	private async provide(
		id: number,
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.CompletionList | undefined> {
		const engine = await this.analyzer;
		const text = document.getText();
		const offset = document.offsetAt(position);
		const target = engine.stringAt(text, offset);
		if (!target?.isIconArgument) {
			this.log.debug('skipped', { id, reason: target ? 'string-not-icon-argument' : 'not-inside-complete-string' });
			return undefined;
		}
		const range = new vscode.Range(
			document.positionAt(target.contentRange.start),
			document.positionAt(target.contentRange.end)
		);
		if (!range.isSingleLine) {
			this.log.warn('skipped', { id, reason: 'multi-line-string' });
			return undefined;
		}
		const typed = text.slice(target.contentRange.start, offset);
		const query = typed.trim();
		const hint = (message: string) => placeholder(message, typed, text.slice(target.contentRange.start, target.contentRange.end), range);
		if (query.length < MIN_QUERY_LENGTH) {
			this.log.info('placeholder', { id, reason: 'too-short', query });
			return hint(vscode.l10n.t('Keep typing to search icons'));
		}

		const cachedQuery = this.cache.has(query);
		if (!cachedQuery) {
			await delay(SEARCH_DELAY_MS);
			if (token.isCancellationRequested) {
				this.log.warn('cancelled', { id, query, stage: 'typing-pause' });
				return undefined;
			}
		}
		const searching = stopwatch();
		let result: SearchResult;
		try {
			result = await this.search(query);
		} catch (error) {
			this.log.warn('placeholder', { id, reason: 'search-failed', query, error: errorText(error), ms: searching() });
			return hint(vscode.l10n.t('Could not reach Iconify, keep typing to retry'));
		}
		this.log.debug('searched', { id, query, icons: result.icons.length, fromMemory: cachedQuery, ms: searching() });
		if (token.isCancellationRequested) {
			this.log.warn('cancelled', { id, query, stage: 'after-search' });
			return undefined;
		}

		if (result.icons.length === 0) {
			this.log.info('placeholder', { id, reason: 'no-results', query });
			return hint(vscode.l10n.t('No icons found, keep typing'));
		}
		const previewing = stopwatch();
		const docs = await this.previewDetails(id, result.icons, token);
		this.log.info('list', { id, query, icons: result.icons.length, withPreview: docs.size, previewMs: previewing() });
		const items = result.icons.map((icon, index) => {
			const item = new vscode.CompletionItem(icon, vscode.CompletionItemKind.Value);
			item.detail = result.collections[icon.slice(0, icon.indexOf(':'))];
			item.range = range;
			item.insertText = icon;
			item.documentation = docs.get(icon);
			// 服务器已按相关度排好，过滤文本固定为已输入内容，避免被二次模糊匹配筛掉
			item.filterText = typed;
			item.sortText = String(index).padStart(4, '0');
			return item;
		});
		// 每多输入一个字符都要重新搜索，所以列表标记为不完整
		return new vscode.CompletionList(items, true);
	}

	/**
	 * 在限定时间内备好这一批图标的预览，返回已备好的详情；没赶上的稍后继续下载，选中时由 resolve 补上。
	 *
	 * @param id 请求编号，写日志用。
	 * @param icons 候选图标名。
	 * @param token 取消令牌，取消后停止下载。
	 */
	private async previewDetails(id: number, icons: readonly string[], token: vscode.CancellationToken): Promise<Map<string, vscode.MarkdownString>> {
		const controller = new AbortController();
		token.onCancellationRequested(() => controller.abort());
		const ready = new Map<string, PreviewFiles>();
		const loading = this.previews
			.load(icons, controller.signal, (name, files) => ready.set(name, files))
			.catch((error: unknown) => this.log.warn('preview-load-failed', { id, error: errorText(error) }));
		const timedOut = await Promise.race([loading.then(() => false), delay(PREVIEW_WAIT_MS).then(() => true)]);
		if (timedOut) {
			this.log.warn('preview-wait-timeout', { id, waitedMs: PREVIEW_WAIT_MS, ready: ready.size, total: icons.length });
		}
		const details = new Map<string, vscode.MarkdownString>();
		await Promise.all(
			[...ready].map(async ([name, files]) => {
				try {
					details.set(name, await detailOf(name, files));
				} catch (error) {
					// 预览文件读不出来，只显示名字
					this.log.warn('preview-unreadable', { id, icon: name, error: errorText(error) });
				}
			})
		);
		return details;
	}

	/** 选中某一项时补上预览：用于列表弹出时还没来得及备好的图标。 */
	async resolveCompletionItem(
		item: vscode.CompletionItem,
		token: vscode.CancellationToken
	): Promise<vscode.CompletionItem> {
		// 图标名取自标签而不是自定义子类的属性：补全项经过扩展宿主往返后，不能指望子类还在
		const name = labelOf(item);
		if (!isValidIconName(name)) {
			this.log.debug('resolve-skipped', { label: name, reason: 'not-an-icon-name' });
			return item;
		}
		if (item.documentation) {
			this.log.debug('resolve-skipped', { icon: name, reason: 'already-has-preview' });
			return item;
		}
		const elapsed = stopwatch();
		const controller = new AbortController();
		token.onCancellationRequested(() => controller.abort());
		try {
			const files = await this.previews.get(name, controller.signal);
			if (files && !token.isCancellationRequested) {
				item.documentation = await detailOf(name, files);
				this.log.info('resolved', { icon: name, ms: elapsed() });
			} else {
				this.log.warn('resolve-empty', { icon: name, reason: files ? 'cancelled' : 'preview-not-available', ms: elapsed() });
			}
		} catch (error) {
			this.log.error('resolve-failed', { icon: name, error: errorText(error), ms: elapsed() });
		}
		return item;
	}

	/** 同一个搜索词只搜一次；失败不缓存。 */
	private search(query: string): Promise<SearchResult> {
		const cached = this.cache.get(query);
		if (cached) {
			return cached;
		}
		const pending = this.source.search(query, 0);
		this.cache.set(query, pending);
		if (this.cache.size > CACHE_SIZE) {
			this.cache.delete(this.cache.keys().next().value as string);
		}
		pending.catch(() => this.cache.delete(query));
		return pending;
	}
}

/**
 * 注册 icon 参数里的图标补全，并在手敲字符时主动弹出补全列表：
 * Python 字符串里 VS Code 默认不会自动弹补全，所以这里监听输入，
 * 只在光标位于 icon 参数的字符串里时才触发，不影响其他字符串，也不改用户设置。
 *
 * @param context 扩展上下文，释放句柄会登记到它上面。
 * @param analyzer 共享的 Python 解析器。
 * @param source 图标搜索。
 * @param previews 图标预览。
 * @param logger 日志。
 */
export function registerIconCompletion(
	context: vscode.ExtensionContext,
	analyzer: Promise<PythonAnalyzer>,
	source: IconSource,
	previews: PreviewSource,
	logger: Logger = NULL_LOGGER
): void {
	const log = scoped(logger, 'trigger');
	const provider = new IconCompletionProvider(analyzer, source, previews, logger);
	let timer: NodeJS.Timeout | undefined;

	const trigger = async (editor: vscode.TextEditor): Promise<void> => {
		const document = editor.document;
		if (document.isClosed || vscode.window.activeTextEditor !== editor || !editor.selection.isEmpty) {
			log.debug('skipped', { reason: document.isClosed ? 'document-closed' : vscode.window.activeTextEditor !== editor ? 'editor-not-active' : 'has-selection' });
			return;
		}
		let engine: PythonAnalyzer;
		try {
			engine = await analyzer;
		} catch (error) {
			log.error('skipped', { reason: 'parser-unavailable', error: errorText(error) });
			return;
		}
		const offset = document.offsetAt(editor.selection.active);
		const target = engine.stringAt(document.getText(), offset);
		if (target?.isIconArgument && offset > target.contentRange.start) {
			log.debug('fire', { line: editor.selection.active.line, col: editor.selection.active.character });
			await vscode.commands.executeCommand('editor.action.triggerSuggest');
		} else {
			log.debug('skipped', { reason: !target?.isIconArgument ? 'not-icon-argument' : 'at-string-start' });
		}
	};

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider({ language: 'python' }, provider),
		vscode.workspace.onDidChangeTextDocument((event) => {
			const [change] = event.contentChanges;
			const editor = vscode.window.activeTextEditor;
			if (
				event.document.languageId !== 'python' ||
				event.contentChanges.length !== 1 ||
				!isSingleKeystroke(change.text, change.rangeLength) ||
				editor?.document !== event.document
			) {
				return;
			}
			clearTimeout(timer);
			timer = setTimeout(() => void trigger(editor), TRIGGER_DELAY_MS);
		}),
		{ dispose: () => clearTimeout(timer) }
	);
	log.info('registered');
}
