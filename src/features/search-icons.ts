import * as vscode from 'vscode';
import type { PythonAnalyzer } from '../core/analyzer';
import { planInsertion } from '../core/insert';
import { baseName, errorText, NULL_LOGGER, scoped, stopwatch, type Logger, type ScopedLog } from '../core/log';
import { isAtLeast } from '../core/version';
import { IconifyApi } from '../iconify/api';
import { AbortedError } from '../iconify/http';
import { PreviewStore, type PreviewFiles } from '../iconify/previews';
import { SearchSession } from '../iconify/search-session';

/** 图标搜索命令的 ID，必须与 package.json 中的声明一致。 */
export const SEARCH_ICONS_COMMAND = 'pyside-iconify.searchIcons';

/** 输入停顿多久后才发请求，单位毫秒。 */
const DEBOUNCE_MS = 250;
/** 预览陆续到达时，隔多久刷新一次列表，单位毫秒。 */
const REFRESH_MS = 150;
/** 活动项离列表末尾不足这么多条时，自动加载下一页。 */
const LOAD_AHEAD = 8;
/** 预加载延后多久执行，单位毫秒。 */
const LOAD_AHEAD_DELAY_MS = 200;
/** QuickPickItem.iconPath 从这个版本开始可用（@types/vscode 1.81）。 */
const ICON_PATH_VERSION = { major: 1, minor: 81 };

/** 列表里每一项代表什么。 */
type Entry =
	| { kind: 'icon'; name: string }
	| { kind: 'more' }
	| { kind: 'retry' }
	| { kind: 'none' };

/** 1.73 的类型里还没有 iconPath，这里自己补上。 */
type PickItem = vscode.QuickPickItem & {
	entry: Entry;
	iconPath?: { light: vscode.Uri; dark: vscode.Uri };
};

/**
 * 把图标名写进编辑器：光标在字符串里只插名字，否则连引号一起插。
 *
 * @param editor 要写入的编辑器。
 * @param analyzer 共享的 Python 解析器；解析器没加载成功时按"不在字符串里"处理。
 * @param name "prefix:name" 格式的图标名。
 * @returns 是否写入成功。
 */
export async function insertIcon(
	editor: vscode.TextEditor,
	analyzer: Promise<PythonAnalyzer>,
	name: string,
	logger: Logger = NULL_LOGGER
): Promise<boolean> {
	const log = scoped(logger, 'search');
	const document = editor.document;
	const selection = editor.selection;
	const range = { start: document.offsetAt(selection.start), end: document.offsetAt(selection.end) };
	let target;
	if (document.languageId === 'python') {
		try {
			target = (await analyzer).stringAt(document.getText(), range.start, range.end);
		} catch (error) {
			log.warn('insert-parser-unavailable', { icon: name, error: errorText(error) });
			target = undefined;
		}
	}
	const plan = planInsertion(name, range, target);
	log.debug('insert-plan', {
		icon: name,
		file: baseName(document.fileName),
		language: document.languageId,
		inString: target !== undefined,
		insertedText: plan.text,
		replaceChars: plan.range.end - plan.range.start,
	});
	const replaced = new vscode.Range(document.positionAt(plan.range.start), document.positionAt(plan.range.end));
	if (!(await editor.edit((builder) => builder.replace(replaced, plan.text)))) {
		log.error('insert-rejected', { icon: name, reason: 'editor.edit returned false' });
		return false;
	}
	const caret = editor.document.positionAt(plan.range.start + plan.text.length);
	editor.selection = new vscode.Selection(caret, caret);
	log.info('inserted', { icon: name, inString: target !== undefined });
	return true;
}

/** 一次打开到关闭期间的搜索框。 */
class IconSearchBox {
	private readonly pick = vscode.window.createQuickPick<PickItem>();
	private readonly session: SearchSession;
	private readonly previews = new Map<string, PreviewFiles>();
	private readonly requested = new Set<string>();
	private readonly showPreviews = isAtLeast(vscode.version, ICON_PATH_VERSION.major, ICON_PATH_VERSION.minor);
	private request: AbortController | undefined;
	private previewRequest: AbortController | undefined;
	private debounce: NodeJS.Timeout | undefined;
	private refresh: NodeJS.Timeout | undefined;
	private ahead: NodeJS.Timeout | undefined;
	private loading = false;
	private error: string | undefined;
	private disposed = false;
	private readonly log: ScopedLog;
	private readonly opened = stopwatch();
	private searches = 0;

	constructor(
		api: IconifyApi,
		private readonly store: PreviewStore,
		private readonly editor: vscode.TextEditor,
		private readonly analyzer: Promise<PythonAnalyzer>,
		private readonly onClosed: () => void,
		private readonly logger: Logger = NULL_LOGGER
	) {
		this.log = scoped(logger, 'search');
		this.log.info('opened', { file: baseName(editor.document.fileName), language: editor.document.languageId, previews: this.showPreviews, vscode: vscode.version });
		this.session = new SearchSession(api);
		this.pick.placeholder = vscode.l10n.t('Search icons, for example: home, mdi:home');
		this.pick.matchOnDescription = false;
		this.pick.matchOnDetail = false;
		this.pick.onDidChangeValue((value) => this.onValue(value));
		this.pick.onDidAccept(() => this.onAccept());
		this.pick.onDidChangeActive((items) => this.onActive(items));
		this.pick.onDidHide(() => this.dispose());
	}

	show(): void {
		this.pick.show();
	}

	/** 关闭搜索框。 */
	close(): void {
		this.pick.hide();
	}

	private onValue(value: string): void {
		clearTimeout(this.debounce);
		clearTimeout(this.ahead);
		this.request?.abort();
		this.previewRequest?.abort();
		if (value.trim() === '') {
			this.log.debug('input-cleared');
			this.loading = false;
			this.error = undefined;
			this.pick.busy = false;
			this.requested.clear();
			void this.session.start('');
			this.render({ top: true });
			return;
		}
		this.log.debug('input', { value, debounceMs: DEBOUNCE_MS });
		this.pick.busy = true;
		this.debounce = setTimeout(() => void this.search(value), DEBOUNCE_MS);
	}

	private async search(value: string): Promise<void> {
		const id = ++this.searches;
		const elapsed = stopwatch();
		const request = this.begin();
		this.previewRequest = new AbortController();
		this.requested.clear();
		this.log.debug('search-start', { id, query: value });
		try {
			await this.session.start(value, request.signal);
		} catch (error) {
			this.log.warn('search-failed', { id, query: value, error: errorText(error), aborted: error instanceof AbortedError, ms: elapsed() });
			this.fail(request, error);
			return;
		}
		if (this.finish(request)) {
			this.log.info('search-done', { id, query: value, icons: this.session.icons.length, hasMore: this.session.hasMore, ms: elapsed() });
			this.render({ top: true });
			this.loadPreviews();
		} else {
			this.log.debug('search-stale', { id, query: value, ms: elapsed() });
		}
	}

	private async loadMore(): Promise<void> {
		if (this.loading || !this.session.hasMore) {
			this.log.debug('more-skipped', { reason: this.loading ? 'already-loading' : 'no-more-pages' });
			return;
		}
		const elapsed = stopwatch();
		const request = this.begin();
		let added: string[];
		try {
			added = await this.session.loadMore(request.signal);
		} catch (error) {
			this.log.warn('more-failed', { query: this.session.query, error: errorText(error), aborted: error instanceof AbortedError, ms: elapsed() });
			this.fail(request, error);
			return;
		}
		if (this.finish(request)) {
			this.log.info('more-done', { query: this.session.query, added: added.length, total: this.session.icons.length, hasMore: this.session.hasMore, ms: elapsed() });
			this.render({ activate: added[0] });
			this.loadPreviews();
		} else {
			this.log.debug('more-stale', { query: this.session.query, ms: elapsed() });
		}
	}

	/** 开始一次网络请求：取消上一次，进入加载状态。 */
	private begin(): AbortController {
		this.request?.abort();
		const request = new AbortController();
		this.request = request;
		this.loading = true;
		this.error = undefined;
		this.pick.busy = true;
		return request;
	}

	/** 请求结束；若它已被新请求取代则返回 false，调用方不应再动界面。 */
	private finish(request: AbortController): boolean {
		if (this.disposed || this.request !== request) {
			return false;
		}
		this.loading = false;
		this.pick.busy = false;
		return true;
	}

	private fail(request: AbortController, error: unknown): void {
		if (error instanceof AbortedError || !this.finish(request)) {
			return;
		}
		this.error = error instanceof Error ? error.message : String(error);
		this.log.error('error-shown', { error: this.error, kept: this.session.icons.length });
		this.render({ top: this.session.icons.length === 0 });
	}

	/**
	 * 活动项靠近列表末尾时预先加载下一页。只对图标条目生效，"加载更多"条目只响应确认；
	 * 且延后执行，否则鼠标点击时列表会在确认事件到达前被替换，确认落到别的条目上。
	 */
	private onActive(items: readonly PickItem[]): void {
		clearTimeout(this.ahead);
		const active = items[0];
		if (!active || active.entry.kind !== 'icon' || this.loading || !this.session.hasMore) {
			return;
		}
		if (this.pick.items.indexOf(active) >= this.pick.items.length - LOAD_AHEAD) {
			this.log.debug('load-ahead', { active: active.label, delayMs: LOAD_AHEAD_DELAY_MS });
			this.ahead = setTimeout(() => void this.loadMore(), LOAD_AHEAD_DELAY_MS);
		}
	}

	private onAccept(): void {
		const chosen = this.pick.selectedItems[0];
		if (!chosen) {
			this.log.warn('accept-ignored', { reason: 'nothing-selected' });
			return;
		}
		this.log.debug('accept', { kind: chosen.entry.kind, icon: chosen.entry.kind === 'icon' ? chosen.entry.name : undefined });
		switch (chosen.entry.kind) {
			case 'icon':
				void this.insert(chosen.entry.name);
				break;
			case 'more':
				void this.loadMore();
				break;
			case 'retry':
				if (this.session.icons.length > 0) {
					void this.loadMore();
				} else {
					void this.search(this.pick.value);
				}
				break;
			case 'none':
				break;
		}
	}

	private async insert(name: string): Promise<void> {
		this.close();
		if (this.editor.document.isClosed) {
			this.log.warn('insert-skipped', { icon: name, reason: 'document-closed' });
			return;
		}
		try {
			if (!(await insertIcon(this.editor, this.analyzer, name, this.logger))) {
				void vscode.window.showErrorMessage(vscode.l10n.t('Could not insert the icon into the editor.'));
			}
		} catch (error) {
			this.log.error('insert-failed', { icon: name, error: errorText(error) });
			void vscode.window.showErrorMessage(vscode.l10n.t('Could not insert the icon into the editor.'));
		}
	}

	/** 为还没有预览的图标下载预览，到一个刷一次。 */
	private loadPreviews(): void {
		if (!this.showPreviews || this.disposed) {
			this.log.debug('previews-skipped', { reason: this.disposed ? 'closed' : 'vscode-too-old', vscode: vscode.version });
			return;
		}
		const names = this.session.icons.filter((name) => !this.requested.has(name));
		for (const name of names) {
			this.requested.add(name);
		}
		this.log.debug('previews-requested', { new: names.length, total: this.session.icons.length });
		const signal = (this.previewRequest ??= new AbortController()).signal;
		void this.store.load(names, signal, (name, files) => {
			this.previews.set(name, files);
			this.scheduleRefresh();
		});
	}

	private scheduleRefresh(): void {
		if (this.refresh || this.disposed) {
			return;
		}
		this.refresh = setTimeout(() => {
			this.refresh = undefined;
			this.render({});
		}, REFRESH_MS);
	}

	/**
	 * 按当前状态重建列表。
	 *
	 * @param options top 为 true 时回到列表顶部；activate 指定要选中的图标；都没有时保持当前选中项。
	 */
	private render(options: { top?: boolean; activate?: string }): void {
		if (this.disposed) {
			return;
		}
		const previousName = this.activeName();
		const items = this.buildItems();
		this.pick.keepScrollPosition = !options.top;
		this.pick.items = items;
		const wanted = options.top ? undefined : (options.activate ?? previousName);
		const match = wanted === undefined ? undefined : items.find((item) => item.entry.kind === 'icon' && item.entry.name === wanted);
		if (match) {
			this.pick.activeItems = [match];
		}
	}

	private activeName(): string | undefined {
		const entry = this.pick.activeItems[0]?.entry;
		return entry?.kind === 'icon' ? entry.name : undefined;
	}

	private buildItems(): PickItem[] {
		const items: PickItem[] = this.session.icons.map((name) => {
			const prefix = name.slice(0, name.indexOf(':'));
			const item: PickItem = {
				label: name,
				description: this.session.collections[prefix],
				alwaysShow: true,
				entry: { kind: 'icon', name },
			};
			const files = this.previews.get(name);
			if (files && this.showPreviews) {
				item.iconPath = { light: vscode.Uri.file(files.light), dark: vscode.Uri.file(files.dark) };
			}
			return item;
		});
		if (this.error !== undefined) {
			items.push({
				label: vscode.l10n.t('$(warning) Could not reach Iconify: {0}. Press Enter to retry.', this.error),
				alwaysShow: true,
				entry: { kind: 'retry' },
			});
		} else if (this.session.hasMore) {
			items.push({ label: vscode.l10n.t('$(chevron-down) Load more'), alwaysShow: true, entry: { kind: 'more' } });
		} else if (items.length === 0 && this.session.query.trim() !== '') {
			items.push({
				label: vscode.l10n.t('$(info) No icons found for "{0}".', this.session.query.trim()),
				alwaysShow: true,
				entry: { kind: 'none' },
			});
		}
		return items;
	}

	private dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.log.info('closed', { searches: this.searches, openedForMs: this.opened(), shown: this.session.icons.length });
		clearTimeout(this.debounce);
		clearTimeout(this.refresh);
		clearTimeout(this.ahead);
		this.request?.abort();
		this.previewRequest?.abort();
		this.pick.dispose();
		this.onClosed();
	}
}

/**
 * 注册图标搜索命令：打开搜索框，输入后实时搜索 Iconify，选中的图标写进当前编辑器。
 *
 * @param context 扩展上下文，释放句柄会登记到它上面。
 * @param analyzer 共享的 Python 解析器，用来判断光标是否在字符串里。
 * @param api 共享的 Iconify 接口。
 * @param store 共享的预览缓存。
 * @param logger 日志。
 */
export function registerSearchIcons(
	context: vscode.ExtensionContext,
	analyzer: Promise<PythonAnalyzer>,
	api: IconifyApi,
	store: PreviewStore,
	logger: Logger = NULL_LOGGER
): void {
	const log = scoped(logger, 'search');
	let open: IconSearchBox | undefined;

	const command = vscode.commands.registerCommand(SEARCH_ICONS_COMMAND, () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			log.warn('command-ignored', { reason: 'no-active-editor' });
			void vscode.window.showInformationMessage(vscode.l10n.t('Open a file first, then search for an icon.'));
			return;
		}
		if (open) {
			log.debug('replacing-open-box');
		}
		open?.close();
		const box = new IconSearchBox(
			api,
			store,
			editor,
			analyzer,
			() => {
				if (open === box) {
					open = undefined;
				}
			},
			logger
		);
		open = box;
		box.show();
	});
	context.subscriptions.push(command, { dispose: () => open?.close() });
	log.info('registered', { command: SEARCH_ICONS_COMMAND });
}
