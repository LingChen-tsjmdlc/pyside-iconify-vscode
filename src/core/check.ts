import { ANIMATIONS, CALLABLES, DEPTH_ANIMATIONS, isValidIconName, type CallableRule, type ParamRule } from './rules';
import type { CallArg, IconCall, Literal, Range } from './types';

/**
 * 一个确定的问题。message 是带 {0}、{1} 占位的英文模板，界面上由 vscode.l10n.t(message, ...args) 翻译并代入。
 * fix 存在时表示有唯一明确的修法：把 range 处的文字换成 newText。
 */
export interface Problem {
	range: Range;
	message: string;
	args: string[];
	fix?: { range: Range; newText: string };
}

/** 常见的写错名字，直接给出正确参数。 */
const RENAMED: Record<string, string> = { name: 'icon' };

const SIZE_TEXT = /^[+-]?(\d+(\.\d*)?|\.\d+)(px|em)$/i;

function levenshtein(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) {
			row.push(Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
		}
		previous = row;
	}
	return previous[b.length];
}

/** 给写错的参数名找一个最接近的正确名字，没有足够接近的返回 undefined。 */
function suggest(rule: CallableRule, wrong: string): string | undefined {
	const renamed = RENAMED[wrong];
	if (renamed && rule.params.some((item) => item.name === renamed)) {
		return renamed;
	}
	let best: { name: string; distance: number } | undefined;
	for (const item of rule.params) {
		const distance = levenshtein(wrong, item.name);
		if (distance <= 2 && (!best || distance < best.distance)) {
			best = { name: item.name, distance };
		}
	}
	return best?.name;
}

function isPositiveNumber(literal: Literal | undefined): boolean {
	return literal?.kind === 'num' && Number.isFinite(literal.value) && literal.value > 0;
}

/** 判断一个值是否是合法的尺寸写法；无法确定时按合法处理。 */
function isSizeOk(literal: Literal): boolean {
	switch (literal.kind) {
		case 'none':
			return true;
		case 'num':
			return isPositiveNumber(literal);
		case 'str':
			return SIZE_TEXT.test(literal.value.trim()) && parseFloat(literal.value) > 0;
		case 'seq':
			if (!literal.items) {
				return true;
			}
			return literal.items.length === 2 && literal.items.every((item) => item === undefined || isPositiveNumber(item));
		default:
			return false;
	}
}

/** 检查一个已知字面量作为某个形参的值是否合法，不合法时返回错误模板与代入参数。 */
function checkValue(rule: ParamRule, arg: CallArg, literal: Literal): Pick<Problem, 'message' | 'args'> | undefined {
	if (literal.kind === 'none' && rule.nullable) {
		return undefined;
	}
	switch (rule.kind) {
		case 'icon':
			if (literal.kind !== 'str') {
				return { message: 'The icon must be a "prefix:name" string, for example "mdi:home".', args: [] };
			}
			return isValidIconName(literal.value)
				? undefined
				: { message: 'Invalid icon name {0}. Use "prefix:name" with lowercase letters, digits and hyphens, for example "mdi:home".', args: [arg.text] };
		case 'size':
			return isSizeOk(literal)
				? undefined
				: { message: 'Cannot parse size {0}. Use a number, "16px", "1.5em" or a (width, height) pair of positive numbers.', args: [arg.text] };
		case 'unit':
			return literal.kind === 'num' && literal.value >= 0 && literal.value <= 1
				? undefined
				: { message: '{0} must be a number between 0 and 1.', args: [rule.name] };
		case 'positive':
			return isPositiveNumber(literal) ? undefined : { message: '{0} must be a number greater than 0.', args: [rule.name] };
		case 'number':
			return literal.kind === 'num' && Number.isFinite(literal.value) ? undefined : { message: '{0} must be a number.', args: [rule.name] };
		case 'animation':
			return literal.kind === 'str' && (ANIMATIONS as readonly string[]).includes(literal.value)
				? undefined
				: { message: 'animation must be one of "spin", "pulse", "breathe", "ping", "bounce", or None.', args: [] };
		default:
			return undefined;
	}
}

/** 参数之间互相矛盾的情形，只在两边都是确定字面量时才报。 */
function checkCombinations(call: IconCall, find: (name: string) => CallArg | undefined): Problem[] {
	const problems: Problem[] = [];
	const rule = CALLABLES[call.callable];
	const spin = find('spin');
	const animation = find('animation');
	const depth = find('animation_depth');
	const animationName = animation?.value?.kind === 'str' ? animation.value.value : undefined;

	if (
		animation && spin?.value?.kind === 'bool' && spin.value.value &&
		animationName !== undefined && animationName !== 'spin' && (ANIMATIONS as readonly string[]).includes(animationName)
	) {
		problems.push({ range: animation.valueRange, message: 'spin=True conflicts with animation={0}; use only one of them.', args: [animation.text] });
	}

	const hasDepth = rule.params.some((item) => item.name === 'animation_depth');
	const depthKnown = depth?.value !== undefined && depth.value.kind !== 'none';
	// 没给 animation，或给的是 None、"spin"，都不能设置 animation_depth；*args 展开里可能带 animation，保守起见不报
	const noDepthAnimation =
		!call.hasSplat && (!animation || animation.value?.kind === 'none' || animationName === 'spin');
	if (hasDepth && depth && depthKnown && noDepthAnimation) {
		problems.push({
			range: depth.nameRange ?? depth.valueRange,
			message: `animation_depth only applies to ${DEPTH_ANIMATIONS.map((name) => `"${name}"`).join(', ')}.`,
			args: [],
		});
	}
	return problems;
}

/**
 * 检查一次调用里确定有问题的地方：不存在的参数名、取值不合法、参数互相矛盾。
 * 取值来自变量或函数调用时无法确定，一律跳过，不猜。
 *
 * @param call 一次对 pyside-iconify 目标的调用。
 */
export function checkCall(call: IconCall): Problem[] {
	const rule = CALLABLES[call.callable];
	const problems: Problem[] = [];
	for (const arg of call.args) {
		if (arg.form === 'splat') {
			continue;
		}
		const paramRule = arg.param ? rule.params.find((item) => item.name === arg.param) : undefined;
		if (arg.form === 'keyword' && arg.name && !paramRule) {
			const hint = suggest(rule, arg.name);
			problems.push({
				range: arg.nameRange ?? arg.range,
				message: hint ? "{0}() has no parameter named '{1}'. Did you mean '{2}'?" : "{0}() has no parameter named '{1}'.",
				args: hint ? [call.callable, arg.name, hint] : [call.callable, arg.name],
				fix: hint && arg.nameRange ? { range: arg.nameRange, newText: hint } : undefined,
			});
		} else if (paramRule && arg.value) {
			const found = checkValue(paramRule, arg, arg.value);
			if (found) {
				problems.push({ range: arg.valueRange, ...found });
			}
		}
	}
	const find = (name: string): CallArg | undefined => call.args.find((arg) => arg.param === name);
	return problems.concat(checkCombinations(call, find));
}
