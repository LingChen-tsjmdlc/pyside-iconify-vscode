import * as assert from 'assert';
import { buildSvgs } from '../../core/iconset';

suite('core/iconset', () => {
	test('builds a standalone svg scaled to height 32', () => {
		const svgs = buildSvgs({ width: 24, height: 24, icons: { home: { body: '<path d="M0 0"/>' } } }, ['home']);
		assert.strictEqual(
			svgs.home,
			'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M0 0"/></svg>'
		);
	});

	test('keeps the aspect ratio of a non-square icon', () => {
		const svgs = buildSvgs({ icons: { wide: { body: '<g/>', width: 48, height: 24 } } }, ['wide']);
		assert.ok(svgs.wide.includes('width="64" height="32" viewBox="0 0 48 24"'));
	});

	test('uses left and top from the icon, then the set, then 0', () => {
		const svgs = buildSvgs(
			{ left: 1, top: 2, width: 10, height: 10, icons: { a: { body: '', left: 5 }, b: { body: '' } } },
			['a', 'b']
		);
		assert.ok(svgs.a.includes('viewBox="5 2 10 10"'));
		assert.ok(svgs.b.includes('viewBox="1 2 10 10"'));
	});

	test('falls back to 24 when the set gives no size', () => {
		assert.ok(buildSvgs({ icons: { a: { body: '' } } }, ['a']).a.includes('viewBox="0 0 24 24"'));
	});

	test('resolves an alias, and the alias can override the size', () => {
		const data = {
			width: 24,
			height: 24,
			icons: { house: { body: '<g/>' } },
			aliases: { home: { parent: 'house' }, big: { parent: 'house', width: 48 }, chain: { parent: 'home' } },
		};
		const svgs = buildSvgs(data, ['home', 'big', 'chain']);
		assert.ok(svgs.home.includes('viewBox="0 0 24 24"'));
		assert.ok(svgs.big.includes('viewBox="0 0 48 24"'));
		assert.ok(svgs.chain);
	});

	test('skips aliases with rotation or flip, which are not applied here', () => {
		const data = {
			icons: { arrow: { body: '<g/>' } },
			aliases: { back: { parent: 'arrow', hFlip: true }, up: { parent: 'arrow', rotate: 1 }, same: { parent: 'arrow', rotate: 4 } },
		};
		assert.deepStrictEqual(Object.keys(buildSvgs(data, ['back', 'up', 'same'])), ['same']);
	});

	test('skips icons that are missing, broken or in an alias loop', () => {
		const data = {
			icons: { bad: { body: 5 }, ok: { body: '<g/>' } },
			aliases: { a: { parent: 'b' }, b: { parent: 'a' }, orphan: { parent: 'nowhere' } },
		};
		assert.deepStrictEqual(Object.keys(buildSvgs(data, ['missing', 'bad', 'a', 'orphan', 'ok'])), ['ok']);
	});

	test('ignores nonsense sizes', () => {
		const svgs = buildSvgs({ width: -1, height: 'x', icons: { a: { body: '', width: 0 } } }, ['a']);
		assert.ok(svgs.a.includes('viewBox="0 0 24 24"'));
	});

	test('input that is not an object gives nothing', () => {
		assert.deepStrictEqual(buildSvgs(null, ['a']), {});
		assert.deepStrictEqual(buildSvgs('x', ['a']), {});
		assert.deepStrictEqual(buildSvgs({}, ['a']), {});
	});

	test('drops an icon whose svg would be too large', () => {
		const svgs = buildSvgs({ icons: { big: { body: 'x'.repeat(200_000) }, small: { body: '' } } }, ['big', 'small']);
		assert.deepStrictEqual(Object.keys(svgs), ['small']);
	});
});
