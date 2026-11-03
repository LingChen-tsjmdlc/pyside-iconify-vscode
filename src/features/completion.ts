import * as vscode from 'vscode';
import type { PythonAnalyzer } from '../core/analyzer';
import { errorText, NULL_LOGGER, scoped, stopwatch, type Logger } from '../core/log';
import { escapeMarkdown } from '../core/markdown';
import { CALLABLES, findParam, valueChoices } from '../core/rules';

/** 补全项中参数的类型与默认值，如 `opacity: float = 1.0`。 */
function describe(name: string, type: string, defaultValue?: string): string {
	return defaultValue ? `${name}: ${type} = ${defaultValue}` : `${name}: ${type}`;
}

/**
 * 注册 Python 文件里的参数补全：在 pyside-iconify 调用的括号里补全参数名，
 * 以及 `animation=`、`spin=` 这类参数的候选值。
 *
 * @param context 扩展上下文，释放句柄会登记到它上面。
 * @param analyzer 共享的 Python 解析器。
 * @param logger 日志。
 */
export function registerCompletion(context: vscode.ExtensionContext, analyzer: Promise<PythonAnalyzer>, logger: Logger = NULL_LOGGER): void {
	const log = scoped(logger, 'params');
	const provider: vscode.CompletionItemProvider = {
		async provideCompletionItems(document, position) {
			const elapsed = stopwatch();
			try {
				const engine = await analyzer;
				const target = engine.completionAt(document.getText(), document.offsetAt(position));
				if (!target) {
					log.debug('skipped', { reason: 'not-in-iconify-call', line: position.line, col: position.character });
					return undefined;
				}
				const range = new vscode.Range(document.positionAt(target.range.start), document.positionAt(target.range.end));
				// 补全项的替换区间必须在一行内
				if (!range.isSingleLine) {
					log.warn('skipped', { reason: 'multi-line-range', callable: target.callable });
					return undefined;
				}

				if (target.kind === 'name') {
					const items = CALLABLES[target.callable].params
						.filter((rule) => !target.used.includes(rule.name))
						.map((rule, index) => {
							const item = new vscode.CompletionItem(rule.name, vscode.CompletionItemKind.Property);
							item.insertText = target.hasEquals ? rule.name : `${rule.name}=`;
							item.detail = describe(rule.name, rule.type, rule.default);
							item.documentation = new vscode.MarkdownString(escapeMarkdown(vscode.l10n.t(rule.doc)));
							item.sortText = String(index).padStart(3, '0');
							item.range = range;
							if (!target.hasEquals && valueChoices(rule).length > 0) {
								// 插入 `name=` 之后立刻弹出候选值
								item.command = { command: 'editor.action.triggerSuggest', title: '' };
							}
							return item;
						});
					log.info('names', { callable: target.callable, items: items.length, alreadyUsed: target.used.length, ms: elapsed() });
					return items;
				}

				const rule = findParam(target.callable, target.param);
				if (!rule) {
					log.warn('skipped', { reason: 'unknown-parameter', callable: target.callable, param: target.param });
					return undefined;
				}
				const items = valueChoices(rule).map((choice, index) => {
					const item = new vscode.CompletionItem(choice, vscode.CompletionItemKind.EnumMember);
					item.detail = describe(rule.name, rule.type, rule.default);
					item.documentation = new vscode.MarkdownString(escapeMarkdown(vscode.l10n.t(rule.doc)));
					item.sortText = String(index).padStart(3, '0');
					item.range = range;
					return item;
				});
				log.info('values', { callable: target.callable, param: target.param, items: items.length, ms: elapsed() });
				return items;
			} catch (error) {
				log.error('failed', { error: errorText(error), ms: elapsed() });
				return undefined;
			}
		},
	};
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider({ language: 'python' }, provider, '(', ',', '=', '"')
	);
	log.info('registered');
}
