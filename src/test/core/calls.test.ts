import * as assert from 'assert';
import { PythonAnalyzer } from '../../core/analyzer';
import type { IconCall } from '../../core/types';

const HEADER = 'from pyside_iconify import IconWidget, get_icon, get_pixmap, set_icon\n';

suite('core/calls', () => {
	let analyzer: PythonAnalyzer;

	suiteSetup(async function () {
		this.timeout(30000);
		analyzer = await PythonAnalyzer.create();
	});

	function only(source: string): IconCall {
		const calls = analyzer.findCalls(source);
		assert.strictEqual(calls.length, 1, `expected one call, got ${calls.length}`);
		return calls[0];
	}

	test('single line with positional and keyword arguments', () => {
		const call = only(`${HEADER}w = IconWidget("mdi:home", size=24, spin=True)`);
		assert.strictEqual(call.callable, 'IconWidget');
		assert.deepStrictEqual(call.args.map((arg) => arg.param), ['icon', 'size', 'spin']);
		assert.deepStrictEqual(call.args[0].value, { kind: 'str', value: 'mdi:home' });
		assert.deepStrictEqual(call.args[1].value, { kind: 'num', value: 24 });
		assert.deepStrictEqual(call.args[2].value, { kind: 'bool', value: true });
	});

	test('multi-line call with trailing comma and comments', () => {
		const call = only(`${HEADER}w = IconWidget(\n    # which icon\n    "mdi:home",\n    size=24,  # px\n)`);
		assert.deepStrictEqual(call.args.map((arg) => arg.param), ['icon', 'size']);
	});

	test('nested parentheses and brackets inside strings', () => {
		const source = `${HEADER}w = IconWidget("mdi:home", size=(16, 16), fallback=make(")", "("))`;
		const call = only(source);
		assert.deepStrictEqual(call.args.map((arg) => arg.param), ['icon', 'size', 'fallback']);
		assert.deepStrictEqual(call.args[1].value, {
			kind: 'seq',
			items: [{ kind: 'num', value: 16 }, { kind: 'num', value: 16 }],
		});
		assert.strictEqual(call.args[2].value, undefined);
	});

	test('f-strings, bytes and escapes are not literals; plain concatenation is', () => {
		const call = only(`${HEADER}w = IconWidget(f"mdi:{x}", size="1" "6px", fallback=b"x", color="a\\nb")`);
		assert.strictEqual(call.args[0].value, undefined);
		assert.deepStrictEqual(call.args[1].value, { kind: 'str', value: '16px' });
		assert.strictEqual(call.args[2].value, undefined);
		assert.strictEqual(call.args[3].value, undefined);
	});

	test('raw strings and triple quotes are literals', () => {
		const call = only(`${HEADER}w = IconWidget(r"mdi:home", qss="""a\nb""")`);
		assert.deepStrictEqual(call.args[0].value, { kind: 'str', value: 'mdi:home' });
	});

	test('negative numbers and parenthesised values', () => {
		const call = only(`${HEADER}w = IconWidget("a:b", rotate=-90, opacity=(0.5))`);
		assert.deepStrictEqual(call.args[1].value, { kind: 'num', value: -90 });
		assert.deepStrictEqual(call.args[2].value, { kind: 'num', value: 0.5 });
	});

	test('*args and **kwargs stop positional mapping', () => {
		const call = only(`${HEADER}w = IconWidget(*parts, "mdi:home", **opts, size=1)`);
		assert.strictEqual(call.hasSplat, true);
		assert.deepStrictEqual(call.args.map((arg) => arg.param), [undefined, undefined, undefined, 'size']);
	});

	test('positional parameters of set_icon', () => {
		const call = only(`${HEADER}set_icon(button, "mdi:home", 1)`);
		assert.deepStrictEqual(call.args.map((arg) => arg.param), ['target', 'icon', undefined]);
	});

	test('module alias, dotted module and submodule imports', () => {
		assert.strictEqual(only('import pyside_iconify as pi\npi.get_icon("a:b")').callable, 'get_icon');
		assert.strictEqual(only('import pyside_iconify\npyside_iconify.get_pixmap("a:b")').callable, 'get_pixmap');
		assert.strictEqual(only('import pyside_iconify.widgets\npyside_iconify.widgets.IconWidget("a:b")').callable, 'IconWidget');
		assert.strictEqual(only('from pyside_iconify import widgets\nwidgets.IconWidget("a:b")').callable, 'IconWidget');
		assert.strictEqual(only('import pyside_iconify.widgets as w\nw.IconWidget("a:b")').callable, 'IconWidget');
	});

	test('name alias and submodule import', () => {
		assert.strictEqual(only('from pyside_iconify import IconWidget as IW\nIW("a:b")').callable, 'IconWidget');
		assert.strictEqual(only('from pyside_iconify.widgets import IconWidget\nIconWidget("a:b")').callable, 'IconWidget');
		assert.strictEqual(only('from pyside_iconify import (\n    get_icon,\n    set_icon as si,\n)\nsi(b, "a:b")').callable, 'set_icon');
	});

	test('star import and imports inside functions', () => {
		assert.strictEqual(only('from pyside_iconify import *\nget_icon("a:b")').callable, 'get_icon');
		assert.strictEqual(only('def f():\n    from pyside_iconify import get_icon\n    return get_icon("a:b")').callable, 'get_icon');
	});

	test('same names from other libraries are ignored', () => {
		assert.strictEqual(analyzer.findCalls('from other import IconWidget\nIconWidget("a:b")').length, 0);
		assert.strictEqual(analyzer.findCalls('IconWidget("a:b")').length, 0);
		assert.strictEqual(analyzer.findCalls('from . import get_icon\nget_icon("a:b")').length, 0);
		assert.strictEqual(analyzer.findCalls(`${HEADER}other.get_icon("a:b")`).length, 0);
	});

	test('names inside comments and strings are not calls', () => {
		assert.strictEqual(analyzer.findCalls(`${HEADER}# get_icon("a:b")\ntext = "IconWidget('a:b')"`).length, 0);
	});

	test('several calls keep source order, nested calls are both found', () => {
		const calls = analyzer.findCalls(`${HEADER}a = get_icon("a:b")\nb = IconWidget("c:d", fallback=get_icon("e:f"))\n`);
		assert.deepStrictEqual(calls.map((call) => call.callable).sort(), ['IconWidget', 'get_icon', 'get_icon']);
	});

	test('incomplete code does not throw', () => {
		for (const tail of ['IconWidget(', 'IconWidget("mdi:ho', 'IconWidget("mdi:home", size=', 'get_icon("a:b", ,)']) {
			assert.doesNotThrow(() => analyzer.findCalls(HEADER + tail));
		}
	});

	test('a call with a missing value is flagged', () => {
		assert.strictEqual(only(`${HEADER}IconWidget("a:b", size=)`).hasError, true);
		assert.strictEqual(only(`${HEADER}IconWidget("a:b", size=1)`).hasError, false);
	});

	test('offsets are UTF-16 indices after Chinese text and emoji', () => {
		const source = `${HEADER}s = "中😀文"; get_icon("mdi:home")\n`;
		const call = only(source);
		assert.strictEqual(call.calleeRange.start, source.indexOf('get_icon('));
		assert.strictEqual(source.slice(call.args[0].valueRange.start, call.args[0].valueRange.end), '"mdi:home"');
	});

	test('attribute callee only covers the last name', () => {
		const source = 'import pyside_iconify as pi\npi.get_icon("a:b")';
		const call = only(source);
		assert.strictEqual(source.slice(call.calleeRange.start, call.calleeRange.end), 'get_icon');
	});
});
