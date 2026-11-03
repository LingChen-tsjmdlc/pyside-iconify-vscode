import * as vscode from 'vscode';
import type { PythonAnalyzer } from '../core/analyzer';
import { errorText, NULL_LOGGER, scoped, stopwatch, type Logger, type ScopedLog } from '../core/log';
import { isValidIconName } from '../core/rules';
import { previewDataUri, type PreviewFiles } from '../iconify/previews';

/** 悬停卡片里大图的高度，单位像素。 */
const HOVER_IMAGE_HEIGHT = 96;

/** 悬停需要的预览能力，测试里换成假的。 */
export interface HoverPreviews {
	get(name: string, signal: AbortSignal): Promise<PreviewFiles | undefined>;
}

function isLight(): boolean {
	const kind = vscode.window.activeColorTheme.kind;
	return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight;
}

/** 鼠标停在 icon 参数的图标名字符串上时，显示该图标的大图和名字。 */
export class IconHoverProvider implements vscode.HoverProvider {
	private readonly log: ScopedLog;

	/**
	 * @param analyzer 共享的 Python 解析器，用来判断鼠标是否在 icon 参数的字符串里。
	 * @param previews 图标预览；取不到时不显示悬停卡片。
	 * @param logger 日志。
	 */
	constructor(
		private readonly analyzer: Promise<PythonAnalyzer>,
		private readonly previews: HoverPreviews,
		logger: Logger = NULL_LOGGER
	) {
		this.log = scoped(logger, 'icon-hover');
	}

	async provideHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): Promise<vscode.Hover | undefined> {
		const elapsed = stopwatch();
		const text = document.getText();
		const target = (await this.analyzer).stringAt(text, document.offsetAt(position));
		if (!target?.isIconArgument) {
			this.log.debug('skipped', { reason: target ? 'string-not-icon-argument' : 'not-inside-complete-string', line: position.line, col: position.character });
			return undefined;
		}
		const name = text.slice(target.contentRange.start, target.contentRange.end).trim();
		if (!isValidIconName(name)) {
			this.log.debug('skipped', { reason: 'invalid-icon-name', name });
			return undefined;
		}
		const controller = new AbortController();
		token.onCancellationRequested(() => controller.abort());
		try {
			const files = await this.previews.get(name, controller.signal);
			if (!files || token.isCancellationRequested) {
				this.log.warn('skipped', { reason: files ? 'cancelled' : 'preview-not-available', icon: name, ms: elapsed() });
				return undefined;
			}
			const uri = await previewDataUri(files, isLight(), HOVER_IMAGE_HEIGHT);
			const range = new vscode.Range(
				document.positionAt(target.contentRange.start),
				document.positionAt(target.contentRange.end)
			);
			this.log.info('shown', { icon: name, ms: elapsed() });
			return new vscode.Hover(new vscode.MarkdownString(`**${name}**\n\n![${name}](${uri})`), range);
		} catch (error) {
			this.log.error('failed', { icon: name, error: errorText(error), ms: elapsed() });
			return undefined;
		}
	}
}

/**
 * 注册图标预览悬停：鼠标停在 icon 参数的图标名上，悬停卡片里显示放大的图标。
 *
 * @param context 扩展上下文，释放句柄会登记到它上面。
 * @param analyzer 共享的 Python 解析器。
 * @param previews 图标预览缓存。
 * @param logger 日志。
 */
export function registerIconHover(
	context: vscode.ExtensionContext,
	analyzer: Promise<PythonAnalyzer>,
	previews: HoverPreviews,
	logger: Logger = NULL_LOGGER
): void {
	context.subscriptions.push(
		vscode.languages.registerHoverProvider({ language: 'python' }, new IconHoverProvider(analyzer, previews, logger))
	);
	scoped(logger, 'icon-hover').info('registered');
}
