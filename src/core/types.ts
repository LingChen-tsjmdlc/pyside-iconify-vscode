/** 源码里的半开区间 [start, end)，单位是 UTF-16 下标，与 VS Code 的 offsetAt 一致。 */
export interface Range {
	start: number;
	end: number;
}

/** 能被静态确定的字面量；来自变量、函数调用、f-string 的值没有对应的 Literal。 */
export type Literal =
	| { kind: 'str'; value: string }
	| { kind: 'num'; value: number }
	| { kind: 'bool'; value: boolean }
	| { kind: 'none' }
	/** 元组或列表；含 *展开 时 items 为 undefined。 */
	| { kind: 'seq'; items: (Literal | undefined)[] | undefined };

/** 光标所在的字符串字面量。 */
export interface StringTarget {
	/** 引号之间的范围，不含前缀和引号。 */
	contentRange: Range;
	/** 是否正是 pyside-iconify 调用的 icon 参数（且是纯文本字面量）。 */
	isIconArgument: boolean;
}

/** 本扩展认识的 pyside-iconify 调用目标。 */
export type TargetName = 'IconWidget' | 'get_icon' | 'get_pixmap' | 'set_icon';

/**
 * 参数的写法：
 * name = 位置参数且是裸标识符（可能是正在输入的参数名）；
 * keyword = name=value；splat = *args / **kwargs；other = 其他位置参数。
 */
export type ArgForm = 'name' | 'keyword' | 'splat' | 'other';

/** 一个实参。 */
export interface CallArg {
	form: ArgForm;
	/** 关键字参数的名字。 */
	name?: string;
	nameRange?: Range;
	/** 对应的形参名：关键字参数取 name，位置参数按位置推出，推不出时为空。 */
	param?: string;
	range: Range;
	/** 值的范围；位置参数就是整个参数。 */
	valueRange: Range;
	/** 值的源码文本，用于错误信息。 */
	text: string;
	value?: Literal;
	/** 关键字参数的值是不是裸标识符。 */
	valueIsName?: boolean;
}

/** 一次对 pyside-iconify 目标的调用。 */
export interface IconCall {
	callable: TargetName;
	/** 函数名的范围；`pi.get_icon` 只取 `get_icon` 这一段。 */
	calleeRange: Range;
	range: Range;
	/** 括号之间的范围，不含括号。 */
	argsRange: Range;
	args: CallArg[];
	/** 是否含 *args 或 **kwargs；含有时按位置推形参和"缺少参数"类判断都不再可靠。 */
	hasSplat: boolean;
	/** 参数列表里是否有语法错误（如 `size=` 后面没写值）；有错误时参数的划分不可信。 */
	hasError: boolean;
}
