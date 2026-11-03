/** 预览图标的像素高度，Quick Pick 里只显示 16，留给高分屏。 */
const PREVIEW_HEIGHT = 32;
/** 别名链的最大深度，防止数据里出现循环。 */
const MAX_ALIAS_DEPTH = 5;
/** 单个 SVG 的长度上限。 */
const MAX_SVG_LENGTH = 200_000;
const DEFAULT_SIZE = 24;

interface Entry {
	body: string;
	width?: number;
	height?: number;
	left?: number;
	top?: number;
}

type Loose = Record<string, unknown>;

function isObject(value: unknown): value is Loose {
	return typeof value === 'object' && value !== null;
}

function positive(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finite(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** 带旋转或翻转的别名这里不处理，直接当作没有预览。 */
function hasTransform(entry: Loose): boolean {
	const rotate = finite(entry.rotate) ?? 0;
	return rotate % 4 !== 0 || entry.hFlip === true || entry.vFlip === true;
}

function pickBox(source: Loose): Partial<Entry> {
	const box: Partial<Entry> = {};
	for (const key of ['width', 'height'] as const) {
		const value = positive(source[key]);
		if (value !== undefined) {
			box[key] = value;
		}
	}
	for (const key of ['left', 'top'] as const) {
		const value = finite(source[key]);
		if (value !== undefined) {
			box[key] = value;
		}
	}
	return box;
}

function resolve(set: Loose, name: string, depth = 0): Entry | undefined {
	const icons = isObject(set.icons) ? set.icons : {};
	const aliases = isObject(set.aliases) ? set.aliases : {};
	const icon = icons[name];
	if (isObject(icon) && typeof icon.body === 'string') {
		return hasTransform(icon) ? undefined : { body: icon.body, ...pickBox(icon) };
	}
	const alias = aliases[name];
	if (isObject(alias) && typeof alias.parent === 'string' && depth < MAX_ALIAS_DEPTH && !hasTransform(alias)) {
		const parent = resolve(set, alias.parent, depth + 1);
		return parent && { ...parent, ...pickBox(alias) };
	}
	return undefined;
}

/**
 * 把 Iconify 的图标集数据（`/{prefix}.json?icons=...` 的响应）拼成一个个独立的 SVG 文本。
 * 能解析别名；带旋转或翻转的别名、数据不完整的图标会被略过。
 *
 * @param data 响应解析出的 JSON。
 * @param names 需要的图标名，不含前缀。
 * @returns 图标名到 SVG 文本的映射，只含成功拼出的。
 */
export function buildSvgs(data: unknown, names: readonly string[]): Record<string, string> {
	const result: Record<string, string> = {};
	if (!isObject(data)) {
		return result;
	}
	const defaults = pickBox(data);
	for (const name of names) {
		const entry = resolve(data, name);
		if (!entry) {
			continue;
		}
		const width = entry.width ?? defaults.width ?? DEFAULT_SIZE;
		const height = entry.height ?? defaults.height ?? DEFAULT_SIZE;
		const left = entry.left ?? defaults.left ?? 0;
		const top = entry.top ?? defaults.top ?? 0;
		const shownWidth = Math.round((PREVIEW_HEIGHT * width * 100) / height) / 100;
		const svg =
			`<svg xmlns="http://www.w3.org/2000/svg" width="${shownWidth}" height="${PREVIEW_HEIGHT}" ` +
			`viewBox="${left} ${top} ${width} ${height}">${entry.body}</svg>`;
		if (svg.length <= MAX_SVG_LENGTH) {
			result[name] = svg;
		}
	}
	return result;
}
