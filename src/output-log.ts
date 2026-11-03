import * as vscode from 'vscode';
import { createLogger, type Logger } from './core/log';

/** 输出面板里日志通道的名字。 */
export const LOG_CHANNEL_NAME = 'PySide Iconify';

/**
 * 创建写进输出面板的日志。
 * 没有用 VS Code 自带的带级别日志通道，因为它从 1.74 才有，而扩展要支持 1.73。
 *
 * @param context 扩展上下文，通道的释放句柄会登记到它上面。
 */
export function createOutputLogger(context: vscode.ExtensionContext): Logger {
	const channel = vscode.window.createOutputChannel(LOG_CHANNEL_NAME);
	context.subscriptions.push(channel);
	return createLogger((line) => channel.appendLine(line));
}
