import * as assert from 'assert';
import { PythonAnalyzer } from '../../core/analyzer';
import { DEFAULT_INLINE_MODE, findInlineIcons, INLINE_MODES, parseInlineMode } from '../../core/inline';

const HEADER = 'from pyside_iconify import IconWidget, get_icon, set_icon\n';

suite('core/inline', () => {
	let analyzer: PythonAnalyzer;

	suiteSetup(async function () {
		this.timeout(30000);
		analyzer = await PythonAnalyzer.create();
	});

	/** 找出所有可画图标的字符串，返回图标名和它在源码里对应的文字。 */
	function found(body: string): Array<[string, string]> {
		const source = HEADER + body;
		return findInlineIcons(source, analyzer.findCalls(source)).map((icon) => [
			icon.name,
			source.slice(icon.range.start, icon.range.end),
		]);
	}

	suite('findInlineIcons', () => {
		test('finds positional and keyword icon arguments, and the range is exactly the name', () => {
			assert.deepStrictEqual(found('IconWidget("mdi:home")\nget_icon(size=16, icon=\'lucide:house\')\n'), [
				['mdi:home', 'mdi:home'],
				['lucide:house', 'lucide:house'],
			]);
		});

		test('handles several calls and nested calls', () => {
			assert.deepStrictEqual(found('x = [IconWidget("a:b"), IconWidget("c:d", parent=IconWidget("e:f"))]\n').map(([name]) => name).sort(), [
				'a:b',
				'c:d',
				'e:f',
			]);
		});

		test('accepts r and u prefixes and puts the range after the quote', () => {
			assert.deepStrictEqual(found('IconWidget(r"mdi:home")\nIconWidget(u\'mdi:cog\')\n'), [
				['mdi:home', 'mdi:home'],
				['mdi:cog', 'mdi:cog'],
			]);
		});

		test('skips strings that are not plain single-line text', () => {
			for (const body of [
				'IconWidget("""mdi:home""")\n',
				'IconWidget(b"mdi:home")\n',
				'IconWidget(f"mdi:{name}")\n',
				'IconWidget("mdi:" "home")\n',
				'IconWidget("mdi:ho\\x6de")\n',
				'IconWidget(" mdi:home")\n',
				'IconWidget("mdi:home ")\n',
				'IconWidget("MDI:Home")\n',
				'IconWidget("home")\n',
				'IconWidget("")\n',
				'IconWidget(name)\n',
			]) {
				assert.deepStrictEqual(found(body), [], body);
			}
		});

		test('ignores other strings and other calls', () => {
			assert.deepStrictEqual(found('x = "mdi:home"\nprint("mdi:home")\nIconWidget("mdi:home", color="red:blue")\n'), [
				['mdi:home', 'mdi:home'],
			]);
		});

		test('ignores the target of set_icon and only takes its icon', () => {
			assert.deepStrictEqual(found('set_icon(button, "mdi:home")\n').map(([name]) => name), ['mdi:home']);
		});

		test('still works while another argument is half written', () => {
			assert.deepStrictEqual(found('IconWidget("mdi:home", size=)\n').map(([name]) => name), ['mdi:home']);
		});

		test('returns nothing when *args makes the position unknown', () => {
			assert.deepStrictEqual(found('IconWidget(*args, "mdi:home")\n'), []);
		});
	});

	suite('parseInlineMode', () => {
		test('accepts every known mode', () => {
			for (const mode of INLINE_MODES) {
				assert.strictEqual(parseInlineMode(mode), mode);
			}
		});

		test('falls back to icon only for anything else', () => {
			assert.strictEqual(DEFAULT_INLINE_MODE, 'iconOnly');
			for (const value of [undefined, null, '', 'ICONONLY', 'icon-only', 1, true, {}]) {
				assert.strictEqual(parseInlineMode(value), 'iconOnly');
			}
		});
	});
});
