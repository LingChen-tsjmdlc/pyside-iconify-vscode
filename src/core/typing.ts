/**
 * 判断一次文本变更是不是手敲的单个字符（输入或退格删除）。
 * 接受补全、粘贴、自动补全引号等变更一次改动多个字符，不算，避免补全完成后又弹出新的补全。
 *
 * @param text 变更后写入的文本。
 * @param rangeLength 被替换掉的原文长度。
 */
export function isSingleKeystroke(text: string, rangeLength: number): boolean {
	const typed = text.length === 1 && rangeLength === 0 && text !== '\n' && text !== '\r';
	const deleted = text === '' && rangeLength === 1;
	return typed || deleted;
}
