import * as vscode from 'vscode';
import type { PythonAnalyzer } from '../core/analyzer';
import { checkCall } from '../core/check';
import { baseName, errorText, NULL_LOGGER, scoped, stopwatch, type Logger } from '../core/log';

/** 诊断信息的来源标签，显示在问题面板里。 */
const SOURCE = 'PySide Iconify';
/** 编辑停顿多久之后重新检查，单位毫秒。 */
const DEBOUNCE_MS = 300;
/** 超过这个长度的文件不检查，避免拖慢编辑器。 */
const MAX_LENGTH = 1_000_000;

/**
 * 注册问题检查：在 Python 文件里标出 pyside-iconify 调用中确定有错的地方。
 *
 * @param context 扩展上下文，释放句柄会登记到它上面。
 * @param analyzer 共享的 Python 解析器。
 * @param logger 日志。
 */
export function registerDiagnostics(context: vscode.ExtensionContext, analyzer: Promise<PythonAnalyzer>, logger: Logger = NULL_LOGGER): void {
	const log = scoped(logger, 'diagnostics');
	const collection = vscode.languages.createDiagnosticCollection('pyside-iconify');
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	const refresh = async (document: vscode.TextDocument): Promise<void> => {
		const file = baseName(document.fileName);
		if (document.languageId !== 'python') {
			return;
		}
		const text = document.getText();
		if (text.length > MAX_LENGTH) {
			collection.delete(document.uri);
			log.warn('skipped', { file, reason: 'file-too-large', chars: text.length, limit: MAX_LENGTH });
			return;
		}
		const elapsed = stopwatch();
		try {
			const engine = await analyzer;
			const calls = engine.findCalls(text);
			const diagnostics = calls.flatMap(checkCall).map((problem) => {
				const range = new vscode.Range(document.positionAt(problem.range.start), document.positionAt(problem.range.end));
				const diagnostic = new vscode.Diagnostic(range, vscode.l10n.t(problem.message, ...problem.args), vscode.DiagnosticSeverity.Error);
				diagnostic.source = SOURCE;
				return diagnostic;
			});
			if (document.isClosed) {
				log.debug('dropped', { file, reason: 'document-closed-meanwhile' });
				return;
			}
			collection.set(document.uri, diagnostics);
			log.info('checked', { file, version: document.version, calls: calls.length, problems: diagnostics.length, ms: elapsed() });
		} catch (error) {
			log.error('failed', { file, error: errorText(error), ms: elapsed() });
		}
	};

	const schedule = (document: vscode.TextDocument): void => {
		const key = document.uri.toString();
		clearTimeout(timers.get(key));
		timers.set(key, setTimeout(() => void refresh(document), DEBOUNCE_MS));
	};

	context.subscriptions.push(
		collection,
		vscode.workspace.onDidOpenTextDocument((document) => {
			if (document.languageId === 'python') {
				log.debug('opened', { file: baseName(document.fileName) });
			}
			void refresh(document);
		}),
		vscode.workspace.onDidChangeTextDocument((event) => schedule(event.document)),
		vscode.workspace.onDidCloseTextDocument((document) => {
			clearTimeout(timers.get(document.uri.toString()));
			timers.delete(document.uri.toString());
			collection.delete(document.uri);
			if (document.languageId === 'python') {
				log.debug('closed', { file: baseName(document.fileName) });
			}
		}),
		{ dispose: () => timers.forEach((timer) => clearTimeout(timer)) }
	);
	const open = vscode.workspace.textDocuments.filter((document) => document.languageId === 'python');
	open.forEach((document) => void refresh(document));
	log.info('registered', { openPythonFiles: open.length });
}
