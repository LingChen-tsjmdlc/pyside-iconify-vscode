import type { TargetName } from './types';

/**
 * 参数值的检查类别：
 * icon = "prefix:name"；size = 尺寸写法；unit = 0 到 1 的数；positive = 大于 0 的数；
 * number = 任意有限数；animation = 内置动画名；bool、any = 不检查。
 */
export type ParamKind = 'icon' | 'size' | 'unit' | 'positive' | 'number' | 'animation' | 'bool' | 'any';

/** 一个形参。doc 是英文原文，界面上由 vscode.l10n 翻译。 */
export interface ParamRule {
	name: string;
	/** 展示用的类型。 */
	type: string;
	kind: ParamKind;
	/** 传 None 是否合法。 */
	nullable: boolean;
	/** 展示用的默认值，没有默认值时为空。 */
	default?: string;
	doc: string;
}

/** 一个调用目标。 */
export interface CallableRule {
	name: TargetName;
	/** 展示用的种类。 */
	label: string;
	summary: string;
	/** 按位置依次对应的形参名，超出的位置不对应任何形参。 */
	positional: string[];
	/** 全部可用的形参，顺序即补全列表的顺序。 */
	params: ParamRule[];
}

/** 内置动画名，与主库 rendering/motion.py 的 ANIMATIONS 一致。 */
export const ANIMATIONS = ['spin', 'pulse', 'breathe', 'ping', 'bounce'] as const;

/** 允许设置 animation_depth 的动画。 */
export const DEPTH_ANIMATIONS = ['pulse', 'breathe', 'ping', 'bounce'] as const;

const ICON_NAME = /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/;

/** 判断字符串是不是合法的 "prefix:name" 图标名；规则同主库 core/names.py，首尾空白会被忽略。 */
export function isValidIconName(text: string): boolean {
	return ICON_NAME.test(text.trim());
}

function param(
	name: string,
	type: string,
	kind: ParamKind,
	doc: string,
	extra: { nullable?: boolean; default?: string } = {}
): ParamRule {
	return { name, type, kind, doc, nullable: extra.nullable ?? false, default: extra.default };
}

const SIZE_DOC = 'a number (square, in px), "16px" or "1.5em", or a (width, height) pair';

const ALL_PARAMS: ParamRule[] = [
	param('target', 'object', 'any', 'The object that receives the icon: a button, QAction, tab widget, list or tree item, or a window.'),
	param('icon', 'str | IconData', 'icon', 'Icon name as "prefix:name", for example "mdi:home". An inline IconData is also accepted.'),
	param('size', 'int | float | str | tuple', 'size', `Icon size: ${SIZE_DOC}.`, { nullable: true, default: '24' }),
	param('color', 'ColorValue', 'any', 'Color: a single color (CSS string, tuple, QColor, Qt.GlobalColor) or a {old: new} map. None uses the default config, then the foreground color.', { nullable: true }),
	param('color_light_theme', 'ColorValue', 'any', 'Color used on a light theme. Falls back to color.', { nullable: true }),
	param('color_dark_theme', 'ColorValue', 'any', 'Color used on a dark theme. Falls back to color.', { nullable: true }),
	param('hover_color', 'ColorValue', 'any', 'Color while the mouse is over the icon. None keeps the normal color.', { nullable: true }),
	param('hover_color_light_theme', 'ColorValue', 'any', 'Hover color on a light theme. Falls back to hover_color.', { nullable: true }),
	param('hover_color_dark_theme', 'ColorValue', 'any', 'Hover color on a dark theme. Falls back to hover_color.', { nullable: true }),
	param('selected_color', 'ColorValue', 'any', 'Color in the selected state. None means not set.', { nullable: true }),
	param('selected_color_light_theme', 'ColorValue', 'any', 'Selected color on a light theme.', { nullable: true }),
	param('selected_color_dark_theme', 'ColorValue', 'any', 'Selected color on a dark theme.', { nullable: true }),
	param('opacity', 'float', 'unit', 'Overall opacity, from 0 to 1. None uses the default config.', { nullable: true, default: '1.0' }),
	param('disabled_opacity', 'float', 'unit', 'Opacity when the target is disabled, from 0 to 1.', { nullable: true, default: '0.4' }),
	param('width', 'int | float | str | tuple', 'size', `Overrides the width only. Same forms as size: ${SIZE_DOC}.`, { nullable: true }),
	param('height', 'int | float | str | tuple', 'size', `Overrides the height only. Same forms as size: ${SIZE_DOC}.`, { nullable: true }),
	param('rotate', 'float', 'number', 'Static rotation in degrees, taken modulo 360.', { default: '0' }),
	param('rotate_overflow', 'bool', 'bool', 'When rotating, keep the original size (corners may be cropped) instead of shrinking to fit.', { default: 'False' }),
	param('spin', 'bool', 'bool', 'Rotate continuously. Same as animation="spin"; cannot be combined with another animation.', { default: 'False' }),
	param('spin_period', 'float', 'positive', 'Seconds per full turn of spin. A number greater than 0.', { nullable: true, default: '1.0' }),
	param('animation', 'str', 'animation', 'Built-in animation: "spin", "pulse", "breathe", "ping" or "bounce". None means no animation.', { nullable: true }),
	param('animation_period', 'float', 'positive', 'Seconds per cycle of the animation. A number greater than 0.', { nullable: true }),
	param('animation_depth', 'float', 'unit', 'How strong the animation is, from 0 to 1. Only for "pulse", "breathe", "ping" and "bounce".', { nullable: true }),
	param('autoplay', 'bool', 'bool', 'Play the icon\'s own SMIL animation automatically. If False it stays on the finished frame until play() is called.', { default: 'True' }),
	param('speed', 'float', 'positive', 'Playback speed of the icon\'s own animation, as a multiplier greater than 0.', { default: '1.0' }),
	param('h_flip', 'bool', 'bool', 'Flip horizontally.', { default: 'False' }),
	param('v_flip', 'bool', 'bool', 'Flip vertically.', { default: 'False' }),
	param('qss', 'str', 'any', 'Style sheet text, stored in the widget\'s "qss" property.', { nullable: true }),
	param('fallback', 'str', 'any', 'Icon name shown when loading fails. None shows nothing; leaving it out uses the default config.', { nullable: true }),
	param('parent', 'QWidget', 'any', 'Parent widget.', { nullable: true }),
];

const BY_NAME = new Map(ALL_PARAMS.map((rule) => [rule.name, rule]));

function pick(names: string[]): ParamRule[] {
	return names.map((name) => {
		const rule = BY_NAME.get(name);
		if (!rule) {
			throw new Error(`unknown rule: ${name}`);
		}
		return rule;
	});
}

const COLORS = ['color', 'color_light_theme', 'color_dark_theme'];
const HOVER = ['hover_color', 'hover_color_light_theme', 'hover_color_dark_theme'];
const SELECTED = ['selected_color', 'selected_color_light_theme', 'selected_color_dark_theme'];
const LAYOUT = ['opacity', 'width', 'height', 'rotate', 'rotate_overflow'];

/** 全部调用目标；参数名、顺序与取值依据主库源码（widgets/icon_widget.py、_api.py、integrations/set_icon.py）。 */
export const CALLABLES: Record<TargetName, CallableRule> = {
	IconWidget: {
		name: 'IconWidget',
		label: 'class',
		summary: 'A widget that shows an icon and can be placed in any Qt layout. Create it on the main thread.',
		positional: ['icon'],
		params: pick([
			'icon', 'size', ...COLORS, ...HOVER, ...LAYOUT,
			'spin', 'spin_period', 'animation', 'animation_period', 'animation_depth',
			'autoplay', 'speed', 'h_flip', 'v_flip', 'qss', 'fallback', 'parent',
		]),
	},
	get_icon: {
		name: 'get_icon',
		label: 'function',
		summary: 'Returns a standard QIcon that works with any Qt widget.',
		positional: ['icon'],
		params: pick(['icon', 'size', ...COLORS, ...SELECTED, ...LAYOUT, 'spin', 'h_flip', 'v_flip']),
	},
	get_pixmap: {
		name: 'get_pixmap',
		label: 'function',
		summary: 'Returns a static QPixmap. The options are the same as get_icon, plus the hover, animation and disabled options.',
		positional: ['icon'],
		params: pick([
			'icon', 'size', ...COLORS, ...HOVER, ...SELECTED, ...LAYOUT, 'disabled_opacity',
			'spin', 'spin_period', 'animation', 'animation_period', 'animation_depth', 'h_flip', 'v_flip',
		]),
	},
	set_icon: {
		name: 'set_icon',
		label: 'function',
		summary: 'Sets an icon on any supported Qt target. Hover colors apply to buttons only.',
		positional: ['target', 'icon'],
		params: pick(['target', 'icon', 'size', ...COLORS, ...HOVER, ...SELECTED, ...LAYOUT, 'spin', 'h_flip', 'v_flip']),
	},
};

/** 判断名字是否是本扩展认识的调用目标。 */
export function isTargetName(name: string): name is TargetName {
	return Object.prototype.hasOwnProperty.call(CALLABLES, name);
}

/** 在某个调用目标里按名字找形参，找不到返回 undefined。 */
export function findParam(callable: TargetName, name: string): ParamRule | undefined {
	return CALLABLES[callable].params.find((rule) => rule.name === name);
}

/** 某个形参适合补全的值，写法就是 Python 源码；没有固定候选时返回空数组。 */
export function valueChoices(rule: ParamRule): string[] {
	const choices: string[] =
		rule.kind === 'animation' ? ANIMATIONS.map((name) => `"${name}"`) : rule.kind === 'bool' ? ['True', 'False'] : [];
	if (rule.nullable && choices.length > 0) {
		choices.push('None');
	}
	return choices;
}
