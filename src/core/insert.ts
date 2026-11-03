import type { Range, StringTarget } from './types';

/** 一次替换：把 range 处换成 text。 */
export interface Insertion {
	range: Range;
	text: string;
}

/**
 * 决定图标名该怎么写进代码：
 * 光标不在字符串里，连引号一起插；在字符串里，只插名字；
 * 光标在 pyside-iconify 调用的 icon 参数字符串里（且没有选区），替换整段字符串内容。
 *
 * @param name 选中的图标名。
 * @param selection 当前选区；光标时 start 等于 end。
 * @param target 选区所在的字符串，不在字符串里为 undefined。
 */
export function planInsertion(name: string, selection: Range, target: StringTarget | undefined): Insertion {
	if (!target) {
		return { range: selection, text: `"${name}"` };
	}
	if (selection.start === selection.end && target.isIconArgument) {
		return { range: target.contentRange, text: name };
	}
	return { range: selection, text: name };
}
