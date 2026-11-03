/**
 * 转义 Markdown 特殊字符，让一段普通文字按原样显示。
 * 不用 MarkdownString.appendText：VS Code 1.73 里它会把空格换成 &nbsp;，导致文字不自动换行。
 *
 * @param text 普通文字。
 */
export function escapeMarkdown(text: string): string {
	return text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, '\\$&');
}
