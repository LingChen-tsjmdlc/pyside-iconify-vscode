import type { Node } from 'web-tree-sitter';
import { CALLABLES, isTargetName } from './rules';
import type { CallArg, IconCall, Literal, Range, TargetName } from './types';

const LIBRARY = 'pyside_iconify';

/** 文件里从 pyside_iconify 导入的名字。 */
interface Imports {
	/** 本地名 -> 目标名，如 IW -> IconWidget。 */
	names: Map<string, TargetName>;
	/** 指向库或其子模块的本地名，如 pi、widgets。 */
	modules: Set<string>;
	/** 是否有 from pyside_iconify import *。 */
	star: boolean;
}

function isLibraryModule(text: string): boolean {
	return text === LIBRARY || text.startsWith(`${LIBRARY}.`);
}

function rangeOf(node: Node): Range {
	return { start: node.startIndex, end: node.endIndex };
}

function withoutBlank(text: string): string {
	return text.replace(/\s+/g, '');
}

/** 收集文件里所有 import 语句（含函数内部的），只记录来自 pyside_iconify 的部分。 */
function collectImports(root: Node): Imports {
	const imports: Imports = { names: new Map(), modules: new Set(), star: false };
	for (const node of root.descendantsOfType(['import_statement', 'import_from_statement'])) {
		if (node.type === 'import_statement') {
			for (const item of node.childrenForFieldName('name')) {
				const aliased = item.type === 'aliased_import';
				const module = aliased ? item.childForFieldName('name') : item;
				if (module && isLibraryModule(withoutBlank(module.text))) {
					imports.modules.add(aliased ? (item.childForFieldName('alias')?.text ?? LIBRARY) : LIBRARY);
				}
			}
			continue;
		}
		const moduleNode = node.childForFieldName('module_name');
		if (moduleNode?.type !== 'dotted_name' || !isLibraryModule(withoutBlank(moduleNode.text))) {
			continue;
		}
		imports.star ||= node.children.some((child) => child.type === 'wildcard_import');
		for (const item of node.childrenForFieldName('name')) {
			const aliased = item.type === 'aliased_import';
			const original = withoutBlank((aliased ? item.childForFieldName('name') : item)?.text ?? '');
			const local = aliased ? item.childForFieldName('alias')?.text : original;
			if (!original || !local) {
				continue;
			}
			if (isTargetName(original)) {
				imports.names.set(local, original);
			} else {
				imports.modules.add(local);
			}
		}
	}
	return imports;
}

/** 把 `a.b.c` 形式的表达式拆成 ['a','b','c']；含其他写法（如调用结果的属性）返回 undefined。 */
function attributePath(node: Node): string[] | undefined {
	if (node.type === 'identifier') {
		return [node.text];
	}
	if (node.type !== 'attribute') {
		return undefined;
	}
	const base = node.childForFieldName('object');
	const attribute = node.childForFieldName('attribute');
	const head = base && attributePath(base);
	return head && attribute ? [...head, attribute.text] : undefined;
}

/** 判断一个函数表达式指向哪个调用目标，不是目标时返回 undefined。 */
function resolveCallee(path: string[], imports: Imports): TargetName | undefined {
	const last = path[path.length - 1];
	if (path.length === 1) {
		return imports.names.get(last) ?? (imports.star && isTargetName(last) ? last : undefined);
	}
	return imports.modules.has(path[0]) && isTargetName(last) ? last : undefined;
}

function evaluateString(node: Node): Literal | undefined {
	const start = node.children.find((child) => child.type === 'string_start');
	const prefix = (start?.text ?? '').replace(/["']/g, '').toLowerCase();
	// b 是 bytes，f、t 是插值字符串，值都不是纯文本
	if (/[bft]/.test(prefix)) {
		return undefined;
	}
	let value = '';
	for (const part of node.children) {
		if (part.type === 'string_start' || part.type === 'string_end') {
			continue;
		}
		// 带转义序列或插值的部分不当作字面量
		if (part.type !== 'string_content' || part.childCount > 0) {
			return undefined;
		}
		value += part.text;
	}
	return { kind: 'str', value };
}

/** 求一个表达式的字面量值；不是能静态确定的字面量时返回 undefined。 */
export function evaluate(node: Node): Literal | undefined {
	switch (node.type) {
		case 'none':
			return { kind: 'none' };
		case 'true':
		case 'false':
			return { kind: 'bool', value: node.type === 'true' };
		case 'integer':
		case 'float': {
			const value = Number(node.text.replace(/_/g, ''));
			return Number.isNaN(value) ? undefined : { kind: 'num', value };
		}
		case 'unary_operator': {
			const sign = node.firstChild?.text;
			const argument = node.childForFieldName('argument');
			const inner = argument && evaluate(argument);
			if (inner?.kind === 'num' && (sign === '-' || sign === '+')) {
				return { kind: 'num', value: sign === '-' ? -inner.value : inner.value };
			}
			return undefined;
		}
		case 'parenthesized_expression': {
			const inner = node.namedChildren.find((child) => child.type !== 'comment');
			return inner && evaluate(inner);
		}
		case 'tuple':
		case 'list': {
			const children = node.namedChildren.filter((child) => child.type !== 'comment');
			const hasSplat = children.some((child) => child.type === 'list_splat');
			return { kind: 'seq', items: hasSplat ? undefined : children.map(evaluate) };
		}
		case 'string':
			return evaluateString(node);
		case 'concatenated_string': {
			let value = '';
			for (const part of node.namedChildren) {
				const literal = part.type === 'string' ? evaluateString(part) : undefined;
				if (part.type === 'comment') {
					continue;
				}
				if (literal?.kind !== 'str') {
					return undefined;
				}
				value += literal.value;
			}
			return { kind: 'str', value };
		}
		default:
			return undefined;
	}
}

function toCallArg(node: Node): CallArg {
	if (node.type === 'keyword_argument') {
		const name = node.childForFieldName('name');
		const value = node.childForFieldName('value');
		const valueNode = value ?? node;
		return {
			form: 'keyword',
			name: name?.text,
			nameRange: name ? rangeOf(name) : undefined,
			range: rangeOf(node),
			valueRange: rangeOf(valueNode),
			text: valueNode.text,
			value: value ? evaluate(value) : undefined,
			valueIsName: value?.type === 'identifier',
		};
	}
	const form = node.type === 'list_splat' || node.type === 'dictionary_splat' ? 'splat' : node.type === 'identifier' ? 'name' : 'other';
	return {
		form,
		range: rangeOf(node),
		valueRange: rangeOf(node),
		text: node.text,
		value: form === 'other' ? evaluate(node) : undefined,
	};
}

function toIconCall(node: Node, imports: Imports): IconCall | undefined {
	const callee = node.childForFieldName('function');
	const list = node.childForFieldName('arguments');
	const path = callee && attributePath(callee);
	const callable = path && resolveCallee(path, imports);
	if (!callee || !list || list.type !== 'argument_list' || !callable) {
		return undefined;
	}
	const positional = CALLABLES[callable].positional;
	const args = list.namedChildren.filter((child) => child.type !== 'comment').map(toCallArg);
	let hasSplat = false;
	let index = 0;
	for (const arg of args) {
		if (arg.form === 'splat') {
			hasSplat = true;
		} else if (arg.form === 'keyword') {
			arg.param = arg.name;
		} else if (!hasSplat) {
			// *args 之后的位置不再可靠，不推形参
			arg.param = positional[index];
			index += 1;
		}
	}
	const closed = list.lastChild?.type === ')';
	return {
		callable,
		calleeRange: rangeOf(callee.type === 'attribute' ? (callee.childForFieldName('attribute') ?? callee) : callee),
		range: rangeOf(node),
		argsRange: { start: list.startIndex + 1, end: closed ? list.endIndex - 1 : list.endIndex },
		args,
		hasSplat,
		hasError: list.hasError,
	};
}

/**
 * 找出语法树里所有对 pyside-iconify 目标的调用。
 * 文件里没有从 pyside_iconify 导入任何东西时直接返回空数组，避免把同名的别家函数当成目标。
 *
 * @param root 语法树的根节点。
 */
export function extractCalls(root: Node): IconCall[] {
	const imports = collectImports(root);
	if (imports.names.size === 0 && imports.modules.size === 0 && !imports.star) {
		return [];
	}
	const calls: IconCall[] = [];
	for (const node of root.descendantsOfType('call')) {
		const call = toIconCall(node, imports);
		if (call) {
			calls.push(call);
		}
	}
	return calls;
}
