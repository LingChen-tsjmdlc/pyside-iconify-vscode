import * as path from 'path';
import * as vscode from 'vscode';
import { PythonAnalyzer } from './core/analyzer';
import { errorText, scoped, stopwatch } from './core/log';
import { registerCompletion } from './features/completion';
import { registerDiagnostics } from './features/diagnostics';
import { registerHover } from './features/hover';
import { registerIconCompletion } from './features/icon-completion';
import { registerIconHover } from './features/icon-hover';
import { registerInlineIcons } from './features/inline-icons';
import { registerQuickFix } from './features/quick-fix';
import { registerSearchIcons } from './features/search-icons';
import { IconifyApi } from './iconify/api';
import { DiskCache } from './iconify/disk-cache';
import { createGetText } from './iconify/http';
import { PreviewStore } from './iconify/previews';
import { createOutputLogger } from './output-log';

/** 磁盘缓存文件超过这个年龄就在启动时清掉，略长于各类缓存的有效期。 */
const PRUNE_AFTER_MS = 45 * 86_400_000;

/** 扩展激活入口：只负责创建共享对象并注册各项功能，不含功能逻辑。 */
export function activate(context: vscode.ExtensionContext): void {
	const elapsed = stopwatch();
	const logger = createOutputLogger(context);
	const log = scoped(logger, 'extension');
	log.info('activating', {
		extension: (context.extension.packageJSON as { version?: string }).version,
		vscode: vscode.version,
		node: process.version,
		platform: process.platform,
		language: vscode.env.language,
		theme: vscode.ColorThemeKind[vscode.window.activeColorTheme.kind],
		remote: vscode.env.remoteName,
		storage: path.basename(context.globalStorageUri.fsPath),
	});

	const parsing = stopwatch();
	const analyzer = PythonAnalyzer.create();
	analyzer.then(
		() => log.info('parser-ready', { ms: parsing() }),
		(error: unknown) => {
			log.error('parser-failed', { error: errorText(error), ms: parsing() });
			void vscode.window.showErrorMessage(vscode.l10n.t('Failed to load the Python parser: {0}', String(error)));
		}
	);
	const cache = new DiskCache(path.join(context.globalStorageUri.fsPath, 'api'), logger);
	void cache.prune(PRUNE_AFTER_MS);
	const api = new IconifyApi(createGetText(logger), undefined, cache, logger);
	const store = new PreviewStore(path.join(context.globalStorageUri.fsPath, 'previews'), api, logger);
	registerSearchIcons(context, analyzer, api, store, logger);
	registerIconCompletion(context, analyzer, api, store, logger);
	registerCompletion(context, analyzer, logger);
	registerHover(context, analyzer, logger);
	registerIconHover(context, analyzer, store, logger);
	registerInlineIcons(context, analyzer, store, logger);
	registerDiagnostics(context, analyzer, logger);
	registerQuickFix(context, analyzer, logger);
	log.info('activated', { ms: elapsed() });
}

/** 扩展停用入口，释放句柄由 context.subscriptions 负责。 */
export function deactivate(): void {}
