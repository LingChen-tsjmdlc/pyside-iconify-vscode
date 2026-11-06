import { Language, Parser, type Node, type Tree } from 'web-tree-sitter';
import * as path from 'path';
import { extractCalls } from './calls';
import { findParam } from './rules';
import type { IconCall, Range, StringTarget, TargetName } from './types';

/** 光标落在哪个可悬停的东西上。 */
export type HoverTarget =
	| { kind: 'callable'; callable: TargetName; range: Range }
	| { kind: 'param'; callable: TargetName; param: string; range: Range };

/** 光标处能补全什么。range 是接受补全后要被替换的区间；hasEquals 表示这个名字后面已经有等号。 */
export type CompletionTarget =
	| { kind: 'name'; callable: TargetName; range: Range; used: string[]; hasEquals: boolean }
	| { kind: 'value'; callable: TargetName; param: string; range: Range };

/** 占位用的标识符：把 `size=|` 这类写到一半的代码补成能解析的样子。 */
const PLACEHOLDER = '_';
const IDENTIFIER_CHAR = /[\p{L}\p{N}_]/u;

function contains(range: Range, offset: number): boolean {
	return range.start <= offset && offset <= range.end;
}

/** 在光标所在位置求最里层的调用（嵌套时取括号起点最靠后的）。 */
function innermost(calls: IconCall[], offset: number): IconCall | undefined {
	return calls
		.filter((call) => contains(call.argsRange, offset))
		.sort((a, b) => b.argsRange.start - a.argsRange.start)[0];
}

/** 把 Python 源码解析为语法树，并回答"有哪些调用、光标处能补全或悬停什么"。 */
export class PythonAnalyzer {
	private constructor(private readonly parser: Parser) {}

	/** 加载 WASM 版的 tree-sitter 与 Python 语法；整个扩展只需要创建一次。 */
	static async create(wasmDirectory?: string): Promise<PythonAnalyzer> {
		const runtime = wasmDirectory
			? path.join(wasmDirectory, 'web-tree-sitter.wasm')
			: require.resolve('web-tree-sitter/web-tree-sitter.wasm');
		const grammar = wasmDirectory
			? path.join(wasmDirectory, 'tree-sitter-python.wasm')
			: require.resolve('tree-sitter-python/tree-sitter-python.wasm');
		await Parser.init({ locateFile: () => runtime });
		const language = await Language.load(grammar);
		const parser = new Parser();
		parser.setLanguage(language);
		return new PythonAnalyzer(parser);
	}

	private withTree<T>(source: string, use: (tree: Tree) => T): T | undefined {
		const tree = this.parser.parse(source);
		if (!tree) {
			return undefined;
		}
		try {
			return use(tree);
		} finally {
			tree.delete();
		}
	}

	/**
	 * 找出源码里所有对 pyside-iconify 目标的调用。
	 *
	 * @param source Python 源码。
	 */
	findCalls(source: string): IconCall[] {
		return this.withTree(source, (tree) => extractCalls(tree.rootNode)) ?? [];
	}

	/**
	 * 判断选区是否完整落在某个字符串字面量的内容里（嵌套时取最里层）。
	 * 没写完的字符串（缺结尾引号）解析不出来，视为不在字符串里。
	 *
	 * @param source Python 源码。
	 * @param start 选区起点，UTF-16 下标。
	 * @param end 选区终点，默认等于起点。
	 */
	stringAt(source: string, start: number, end: number = start): StringTarget | undefined {
		return this.withTree(source, (tree) => {
			let best: { node: Node; content: Range } | undefined;
			for (const node of tree.rootNode.descendantsOfType('string')) {
				const open = node.children.find((child) => child.type === 'string_start');
				const close = node.children.find((child) => child.type === 'string_end');
				if (!open || !close) {
					continue;
				}
				const content = { start: open.endIndex, end: close.startIndex };
				if (start >= content.start && end <= content.end && (!best || content.start > best.content.start)) {
					best = { node, content };
				}
			}
			if (!best) {
				return undefined;
			}
			const { node, content } = best;
			const isIconArgument = extractCalls(tree.rootNode).some((call) =>
				call.args.some(
					(arg) =>
						arg.param === 'icon' &&
						arg.value?.kind === 'str' &&
						arg.valueRange.start === node.startIndex &&
						arg.valueRange.end === node.endIndex
				)
			);
			return { contentRange: content, isIconArgument };
		});
	}

	/**
	 * 判断光标是否停在调用名或关键字参数名上，用于悬停提示。
	 *
	 * @param source Python 源码。
	 * @param offset 光标位置，UTF-16 下标。
	 */
	hoverAt(source: string, offset: number): HoverTarget | undefined {
		for (const call of this.findCalls(source)) {
			if (contains(call.calleeRange, offset)) {
				return { kind: 'callable', callable: call.callable, range: call.calleeRange };
			}
			for (const arg of call.args) {
				if (arg.form === 'keyword' && arg.name && arg.nameRange && contains(arg.nameRange, offset) && findParam(call.callable, arg.name)) {
					return { kind: 'param', callable: call.callable, param: arg.name, range: arg.nameRange };
				}
			}
		}
		return undefined;
	}

	/**
	 * 判断光标处该补全参数名还是参数的值。
	 * 先按原文解析；写到一半解析不出来时，在光标处补一个占位标识符再解析一次。
	 *
	 * @param source Python 源码。
	 * @param offset 光标位置，UTF-16 下标。
	 */
	completionAt(source: string, offset: number): CompletionTarget | undefined {
		const direct = this.completionIn(source, offset, false);
		if (direct) {
			return direct;
		}
		// 光标紧挨着标识符时补占位符会改变原有的词，此时放弃
		const before = source.charAt(offset - 1);
		const after = source.charAt(offset);
		if ((before && IDENTIFIER_CHAR.test(before)) || (after && IDENTIFIER_CHAR.test(after))) {
			return undefined;
		}
		return this.completionIn(source.slice(0, offset) + PLACEHOLDER + source.slice(offset), offset, true);
	}

	private completionIn(text: string, offset: number, patched: boolean): CompletionTarget | undefined {
		return this.withTree(text, (tree) => {
			const call = innermost(extractCalls(tree.rootNode), offset);
			// 原文里带语法错误的调用，参数划分不可信，留给补占位符的那一遍
			if (!call || (!patched && call.hasError)) {
				return undefined;
			}
			const index = call.args.findIndex((arg) => contains(arg.range, offset));
			const arg = call.args[index];
			const used = call.args
				.filter((_, position) => position !== index)
				.map((other) => other.param)
				.filter((name): name is string => name !== undefined);
			const callable = call.callable;
			// 占位符不属于原文，替换区间要缩成光标处的空区间
			const collapse = (range: Range): Range => (patched && range.start === offset ? { start: offset, end: offset } : range);

			if (!arg) {
				return { kind: 'name', callable, range: { start: offset, end: offset }, used, hasEquals: false };
			}
			if (arg.form === 'name') {
				return { kind: 'name', callable, range: collapse(arg.range), used, hasEquals: false };
			}
			if (arg.form !== 'keyword' || !arg.name || !arg.nameRange) {
				return undefined;
			}
			if (contains(arg.nameRange, offset)) {
				return { kind: 'name', callable, range: arg.nameRange, used, hasEquals: true };
			}
			// 值是元组、列表等容器时，光标多半在容器内部，不补全
			const simpleValue = arg.valueIsName || (arg.value !== undefined && arg.value.kind !== 'seq');
			if (offset >= arg.valueRange.start && simpleValue && findParam(callable, arg.name)) {
				return { kind: 'value', callable, param: arg.name, range: collapse(arg.valueRange) };
			}
			return undefined;
		});
	}
}
