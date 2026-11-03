/** 预览图标的颜色：浅色主题用深灰，深色主题用浅灰，与 VS Code 自带图标的灰度接近。 */
export const PREVIEW_COLORS = { light: '#424242', dark: '#c5c5c5' } as const;

/**
 * 给 SVG 根元素加上 color 属性，让 fill="currentColor" 的单色图标显示成指定颜色。
 * SVG 作为图片加载时没有网页的前景色可继承，不加的话会是黑色，深色主题下看不见。
 *
 * @param svg 完整的 SVG 文本。
 * @param color CSS 颜色。
 */
export function tintSvg(svg: string, color: string): string {
	const root = /<svg\b[^>]*>/.exec(svg)?.[0];
	if (!root || /\scolor\s*=/.test(root)) {
		return svg;
	}
	return svg.replace('<svg', `<svg color="${color}"`);
}

/**
 * 按固定高度缩放 SVG 的显示尺寸，宽度按原比例算；viewBox 不变，所以放大后仍然清晰。
 * 根元素没有数字形式的 width 和 height 时原样返回。
 *
 * @param svg 完整的 SVG 文本。
 * @param height 目标高度，单位像素。
 */
export function resizeSvg(svg: string, height: number): string {
	const root = /<svg\b[^>]*>/.exec(svg)?.[0];
	const width = root && /\swidth="([\d.]+)"/.exec(root)?.[1];
	const current = root && /\sheight="([\d.]+)"/.exec(root)?.[1];
	if (!root || !width || !current) {
		return svg;
	}
	const ratio = Number(width) / Number(current);
	if (!Number.isFinite(ratio) || ratio <= 0) {
		return svg;
	}
	const scaled = Math.round(height * ratio * 100) / 100;
	const next = root
		.replace(/(\swidth=")[\d.]+(")/, (_all, open: string, close: string) => `${open}${scaled}${close}`)
		.replace(/(\sheight=")[\d.]+(")/, (_all, open: string, close: string) => `${open}${height}${close}`);
	return svg.replace(root, () => next);
}
