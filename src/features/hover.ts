import * as vscode from 'vscode';
import type { PythonAnalyzer } from '../core/analyzer';
import { errorText, NULL_LOGGER, scoped, stopwatch, type Logger } from '../core/log';
import { escapeMarkdown } from '../core/markdown';
import { CALLABLES, findParam } from '../core/rules';

/**
 * 注册悬停提示：鼠标停在 pyside-iconify 的调用名或关键字参数名上时，显示类型、默认值与说明。
 *
 * @param context 扩展上下文，释放句柄会登记到它上面。
 * @param analyzer 共享的 Python 解析器。
 * @param logger 日志。
 */
export function registerHover(context: vscode.ExtensionContext, analyzer: Promise<PythonAnalyzer>, logger: Logger = NULL_LOGGER): void {
	const log = scoped(logger, 'docs-hover');
	const provider: vscode.HoverProvider = {
		async provideHover(document, position) {
			const elapsed = stopwatch();
			try {
				const engine = await analyzer;
				const target = engine.hoverAt(document.getText(), document.offsetAt(position));
				if (!target) {
					log.debug('skipped', { reason: 'nothing-to-explain', line: position.line, col: position.character });
					return undefined;
				}
				const content = new vscode.MarkdownString();
				if (target.kind === 'callable') {
					const rule = CALLABLES[target.callable];
					content.appendCodeblock(`(${rule.label}) ${rule.name}`, 'python');
					content.appendMarkdown(escapeMarkdown(vscode.l10n.t(rule.summary)));
					log.info('shown', { kind: 'callable', name: target.callable, ms: elapsed() });
				} else {
					const rule = findParam(target.callable, target.param);
					if (!rule) {
						log.warn('skipped', { reason: 'unknown-parameter', callable: target.callable, param: target.param });
						return undefined;
					}
					const defaultValue = rule.default ? ` = ${rule.default}` : '';
					content.appendCodeblock(`(parameter) ${rule.name}: ${rule.type}${defaultValue}`, 'python');
					content.appendMarkdown(escapeMarkdown(vscode.l10n.t(rule.doc)));
					log.info('shown', { kind: 'param', callable: target.callable, param: target.param, ms: elapsed() });
				}
				const range = new vscode.Range(document.positionAt(target.range.start), document.positionAt(target.range.end));
				return new vscode.Hover(content, range);
			} catch (error) {
				log.error('failed', { error: errorText(error), ms: elapsed() });
				return undefined;
			}
		},
	};
	context.subscriptions.push(vscode.languages.registerHoverProvider({ language: 'python' }, provider));
	log.info('registered');
}
