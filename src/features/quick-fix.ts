import * as vscode from 'vscode';
import type { PythonAnalyzer } from '../core/analyzer';
import { checkCall } from '../core/check';
import { errorText, NULL_LOGGER, scoped, stopwatch, type Logger } from '../core/log';

/** 与诊断功能一致的来源标签，只处理它产生的诊断。 */
const SOURCE = 'PySide Iconify';

/**
 * 注册快速修复：把写错的参数名一键改成建议的名字（灯泡菜单或 Ctrl+.）。
 * 修法由 core 在当前文本上重新算出，再按范围和诊断对上，不依赖诊断对象里存的数据。
 *
 * @param context 扩展上下文，释放句柄会登记到它上面。
 * @param analyzer 共享的 Python 解析器。
 * @param logger 日志。
 */
export function registerQuickFix(context: vscode.ExtensionContext, analyzer: Promise<PythonAnalyzer>, logger: Logger = NULL_LOGGER): void {
	const log = scoped(logger, 'quick-fix');
	const provider: vscode.CodeActionProvider = {
		async provideCodeActions(document, _range, actionContext) {
			const wanted = actionContext.diagnostics.filter((item) => item.source === SOURCE);
			if (wanted.length === 0) {
				log.debug('skipped', { reason: 'no-diagnostics-from-us', others: actionContext.diagnostics.length });
				return undefined;
			}
			const elapsed = stopwatch();
			try {
				const text = document.getText();
				const engine = await analyzer;
				const problems = engine.findCalls(text).flatMap(checkCall);
				const actions: vscode.CodeAction[] = [];
				for (const diagnostic of wanted) {
					const problem = problems.find(
						(item) =>
							item.fix &&
							item.range.start === document.offsetAt(diagnostic.range.start) &&
							item.range.end === document.offsetAt(diagnostic.range.end)
					);
					if (!problem?.fix) {
						log.debug('no-fix', { line: diagnostic.range.start.line, col: diagnostic.range.start.character });
						continue;
					}
					const action = new vscode.CodeAction(
						vscode.l10n.t("Change to '{0}'", problem.fix.newText),
						vscode.CodeActionKind.QuickFix
					);
					action.diagnostics = [diagnostic];
					action.isPreferred = true;
					action.edit = new vscode.WorkspaceEdit();
					action.edit.replace(
						document.uri,
						new vscode.Range(document.positionAt(problem.fix.range.start), document.positionAt(problem.fix.range.end)),
						problem.fix.newText
					);
					actions.push(action);
				}
				log.info('offered', { diagnostics: wanted.length, actions: actions.length, ms: elapsed() });
				return actions;
			} catch (error) {
				log.error('failed', { error: errorText(error), ms: elapsed() });
				return undefined;
			}
		},
	};
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ language: 'python' }, provider, {
			providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
		})
	);
	log.info('registered');
}
