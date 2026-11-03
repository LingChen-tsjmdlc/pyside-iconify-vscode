import * as assert from 'assert';
import { planInsertion } from '../../core/insert';
import { resizeSvg, tintSvg } from '../../core/preview';
import { isAtLeast } from '../../core/version';

suite('core/insert', () => {
	const inIcon = { contentRange: { start: 12, end: 18 }, isIconArgument: true };
	const inOther = { contentRange: { start: 12, end: 18 }, isIconArgument: false };

	test('outside a string the name is quoted', () => {
		assert.deepStrictEqual(planInsertion('mdi:home', { start: 5, end: 5 }, undefined), {
			range: { start: 5, end: 5 },
			text: '"mdi:home"',
		});
	});

	test('a selection outside a string is replaced by the quoted name', () => {
		assert.deepStrictEqual(planInsertion('mdi:home', { start: 5, end: 9 }, undefined), {
			range: { start: 5, end: 9 },
			text: '"mdi:home"',
		});
	});

	test('a cursor in the icon argument replaces the whole content', () => {
		assert.deepStrictEqual(planInsertion('mdi:home', { start: 14, end: 14 }, inIcon), {
			range: { start: 12, end: 18 },
			text: 'mdi:home',
		});
	});

	test('a selection in the icon argument replaces only the selection', () => {
		assert.deepStrictEqual(planInsertion('mdi:home', { start: 13, end: 15 }, inIcon), {
			range: { start: 13, end: 15 },
			text: 'mdi:home',
		});
	});

	test('a cursor in another string inserts the bare name at the cursor', () => {
		assert.deepStrictEqual(planInsertion('mdi:home', { start: 14, end: 14 }, inOther), {
			range: { start: 14, end: 14 },
			text: 'mdi:home',
		});
	});
});

suite('core/preview', () => {
	test('adds a color to the root element', () => {
		assert.strictEqual(tintSvg('<svg viewBox="0 0 1 1"><path/></svg>', '#fff'), '<svg color="#fff" viewBox="0 0 1 1"><path/></svg>');
	});

	test('keeps an existing color', () => {
		const svg = '<svg color="red"><path/></svg>';
		assert.strictEqual(tintSvg(svg, '#fff'), svg);
	});

	test('leaves text that is not an svg alone', () => {
		assert.strictEqual(tintSvg('nope', '#fff'), 'nope');
	});

	test('does not mistake a color on a child element for the root', () => {
		assert.strictEqual(tintSvg('<svg><g color="red"/></svg>', '#fff'), '<svg color="#fff"><g color="red"/></svg>');
	});
});

suite('core/version', () => {
	test('compares major and minor', () => {
		assert.strictEqual(isAtLeast('1.81.0', 1, 81), true);
		assert.strictEqual(isAtLeast('1.80.2', 1, 81), false);
		assert.strictEqual(isAtLeast('1.144.1', 1, 81), true);
		assert.strictEqual(isAtLeast('2.0.0', 1, 81), true);
		assert.strictEqual(isAtLeast('1.73.0', 1, 81), false);
	});

	test('accepts suffixes and rejects garbage', () => {
		assert.strictEqual(isAtLeast('1.90.0-insider', 1, 81), true);
		assert.strictEqual(isAtLeast('unknown', 1, 81), false);
	});
});

suite('core/preview resizeSvg', () => {
	test('scales width with the ratio and keeps the viewBox', () => {
		assert.strictEqual(
			resizeSvg('<svg xmlns="x" width="48" height="24" viewBox="0 0 2 1"><path/></svg>', 96),
			'<svg xmlns="x" width="192" height="96" viewBox="0 0 2 1"><path/></svg>'
		);
	});

	test('does not touch widths on child elements or stroke-width', () => {
		const out = resizeSvg('<svg width="32" height="32" stroke-width="2"><g width="5" height="5"/></svg>', 64);
		assert.strictEqual(out, '<svg width="64" height="64" stroke-width="2"><g width="5" height="5"/></svg>');
	});

	test('leaves svgs without numeric sizes alone', () => {
		for (const svg of ['<svg viewBox="0 0 1 1"/>', '<svg width="1em" height="1em"/>', 'nope', '<svg width="0" height="0"/>']) {
			assert.strictEqual(resizeSvg(svg, 64), svg);
		}
	});
});
