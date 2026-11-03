import { isValidIconName } from './rules';
import type { IconCall, Range } from './types';

/**
 * 行内图标的显示方式：
 * off = 只显示文字；iconBefore = 图标加文字；iconAfter = 文字加图标；
 * iconOnly = 只显示图标（文字隐藏）；gutter = 图标画在行号前面。
 */
export const INLINE_MODES = ['off', 'iconBefore', 'iconAfter', 'iconOnly', 'gutter'] as const;

export type InlineMode = (typeof INLINE_MODES)[number];

export const DEFAULT_INLINE_MODE: InlineMode = 'iconOnly';

/** 把设置里读到的值转成模式；不认识的值（拼错、被改成别的类型）回到默认。 */
export function parseInlineMode(value: unknown): InlineMode {
	return INLINE_MODES.find((mode) => mode === value) ?? DEFAULT_INLINE_MODE;
}

/** 一个要画图标的字符串：图标名和引号之间的范围。 */
export interface InlineIcon {
	name: string;
	/** 引号之间的范围，不含前缀和引号。 */
	range: Range;
}

/** 单行字符串字面量：可选的 r/u 前缀，一对相同的引号，中间不含引号、反斜杠和换行。 */
const SIMPLE_STRING = /^([rRuU]?)(["'])([^"'\\\r\n]*)\2$/;

/**
 * 找出调用里所有可以画图标的 icon 参数：必须是单行、没有转义和插值的普通字符串，
 * 内容恰好是一个合法的图标名（首尾带空格的不算，因为画出来会和文字对不上）。
 * 三引号、bytes、f-string 插值、相邻字符串拼接都会被略过。
 *
 * @param source 调用所在的完整源码，范围都以它为准。
 * @param calls 源码里的调用，来自 PythonAnalyzer.findCalls。
 */
export function findInlineIcons(source: string, calls: readonly IconCall[]): InlineIcon[] {
	const found: InlineIcon[] = [];
	for (const call of calls) {
		for (const arg of call.args) {
			if (arg.param !== 'icon' || arg.value?.kind !== 'str') {
				continue;
			}
			const match = SIMPLE_STRING.exec(source.slice(arg.valueRange.start, arg.valueRange.end));
			if (!match) {
				continue;
			}
			const [, prefix, , content] = match;
			if (content !== arg.value.value || content !== content.trim() || !isValidIconName(content)) {
				continue;
			}
			const start = arg.valueRange.start + prefix.length + 1;
			found.push({ name: content, range: { start, end: start + content.length } });
		}
	}
	return found;
}
