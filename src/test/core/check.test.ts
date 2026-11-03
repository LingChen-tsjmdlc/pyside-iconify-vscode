import * as assert from 'assert';
import { PythonAnalyzer } from '../../core/analyzer';
import { checkCall } from '../../core/check';

const HEADER = 'from pyside_iconify import IconWidget, get_icon, get_pixmap, set_icon\n';

suite('core/check', () => {
	let analyzer: PythonAnalyzer;

	suiteSetup(async function () {
		this.timeout(30000);
		analyzer = await PythonAnalyzer.create();
	});

	/** 检查一段代码，返回所有问题的消息模板与代入参数。 */
	function problems(code: string): string[] {
		return analyzer
			.findCalls(HEADER + code)
			.flatMap(checkCall)
			.map((problem) => problem.message.replace(/\{(\d)\}/g, (_, index: string) => problem.args[Number(index)]));
	}

	test('valid calls report nothing', () => {
		assert.deepStrictEqual(problems('IconWidget("mdi:home", size="1.5em", opacity=0.5, animation="pulse", animation_depth=0.3)'), []);
		assert.deepStrictEqual(problems('get_icon(" mdi:home ", size=(16, 24), rotate=-90, opacity=None)'), []);
		assert.deepStrictEqual(problems('set_icon(btn, "mdi:home", hover_color="red", selected_color=None)'), []);
		assert.deepStrictEqual(problems('get_pixmap("mdi:home", animation="spin", disabled_opacity=0)'), []);
	});

	test('values from variables are skipped', () => {
		assert.deepStrictEqual(problems('IconWidget(name, size=s, opacity=o, animation=a, animation_depth=d, spin=x)'), []);
		assert.deepStrictEqual(problems('IconWidget(f"mdi:{x}", size=f"{n}px")'), []);
	});

	test('unknown parameter with suggestions', () => {
		assert.deepStrictEqual(problems('get_icon(name="mdi:home")'), ["get_icon() has no parameter named 'name'. Did you mean 'icon'?"]);
		assert.deepStrictEqual(problems('IconWidget("a:b", colour="red")'), ["IconWidget() has no parameter named 'colour'. Did you mean 'color'?"]);
		assert.deepStrictEqual(problems('IconWidget("a:b", zzzzzz=1)'), ["IconWidget() has no parameter named 'zzzzzz'."]);
	});

	test('parameters differ between callables', () => {
		assert.strictEqual(problems('get_icon("a:b", animation="spin")').length, 1);
		assert.strictEqual(problems('get_icon("a:b", hover_color="red")').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", selected_color="red")').length, 1);
		assert.strictEqual(problems('set_icon(b, "a:b", animation="spin")').length, 1);
		assert.strictEqual(problems('get_pixmap("a:b", qss="x")').length, 1);
	});

	test('icon name', () => {
		for (const bad of ['"mdi"', '"MDI:home"', '"mdi:"', '":home"', '"mdi:home:x"', '"mdi home"', '""', '5', 'None', 'True']) {
			assert.strictEqual(problems(`IconWidget(${bad})`).length, 1, bad);
			assert.strictEqual(problems(`get_icon(icon=${bad})`).length, 1, bad);
		}
		assert.strictEqual(problems('set_icon(btn, "bad")').length, 1);
		assert.strictEqual(problems('IconWidget(" mdi:home-2 ")').length, 0);
	});

	test('opacity and animation_depth range', () => {
		for (const bad of ['1.5', '-0.1', 'True', '"1"', '[0.5]']) {
			assert.strictEqual(problems(`IconWidget("a:b", opacity=${bad})`).length, 1, bad);
		}
		for (const good of ['0', '1', '0.5', 'None']) {
			assert.strictEqual(problems(`IconWidget("a:b", opacity=${good})`).length, 0, good);
		}
		assert.strictEqual(problems('IconWidget("a:b", animation="pulse", animation_depth=2)').length, 1);
	});

	test('animation names', () => {
		for (const bad of ['"jump"', '1', 'True', '""']) {
			assert.strictEqual(problems(`IconWidget("a:b", animation=${bad})`).length, 1, bad);
		}
		for (const good of ['"spin"', '"pulse"', '"breathe"', '"ping"', '"bounce"', 'None']) {
			assert.strictEqual(problems(`IconWidget("a:b", animation=${good})`).length, 0, good);
		}
	});

	test('spin conflicts with another animation', () => {
		assert.strictEqual(problems('IconWidget("a:b", spin=True, animation="pulse")').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", spin=True, animation="spin")').length, 0);
		assert.strictEqual(problems('IconWidget("a:b", spin=False, animation="pulse")').length, 0);
		assert.strictEqual(problems('IconWidget("a:b", spin=flag, animation="pulse")').length, 0);
		assert.strictEqual(problems('IconWidget("a:b", spin=True, animation=name)').length, 0);
	});

	test('animation_depth needs an animation that has depth', () => {
		assert.strictEqual(problems('IconWidget("a:b", animation_depth=0.5)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", spin=True, animation_depth=0.5)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", animation="spin", animation_depth=0.5)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", animation=None, animation_depth=0.5)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", animation_depth=None)').length, 0);
		assert.strictEqual(problems('IconWidget("a:b", animation="bounce", animation_depth=0.5)').length, 0);
		assert.strictEqual(problems('IconWidget("a:b", animation=kind, animation_depth=0.5)').length, 0);
		assert.strictEqual(problems('IconWidget("a:b", **opts, animation_depth=0.5)').length, 0);
		assert.strictEqual(problems('get_pixmap("a:b", animation_depth=0.5)').length, 1);
	});

	test('size forms', () => {
		for (const good of ['24', '1.5', '"24px"', '"1.5em"', '".5em"', '" 16PX "', '(16, 24)', '[16, 24]', 'None', '(w, 24)', '(*a,)']) {
			assert.strictEqual(problems(`IconWidget("a:b", size=${good})`).length, 0, good);
		}
		for (const bad of ['0', '-4', 'True', '"abc"', '"16"', '"0px"', '"-1em"', '(16,)', '(16, 24, 32)', '(0, 16)', '(True, 16)']) {
			assert.strictEqual(problems(`IconWidget("a:b", size=${bad})`).length, 1, bad);
		}
		assert.strictEqual(problems('IconWidget("a:b", width="x")').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", height=-1)').length, 1);
	});

	test('positive numbers and rotate', () => {
		assert.strictEqual(problems('IconWidget("a:b", speed=0)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", speed=None)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", spin_period=-1)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", animation_period=0)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", spin_period=None, speed=2)').length, 0);
		assert.strictEqual(problems('IconWidget("a:b", rotate="x")').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", rotate=None)').length, 1);
		assert.strictEqual(problems('IconWidget("a:b", rotate=-90)').length, 0);
	});

	test('the error range points at the offending part', () => {
		const code = 'IconWidget("a:b", opacity=5, colour="red")';
		const source = HEADER + code;
		const found = analyzer.findCalls(source).flatMap(checkCall);
		const slices = found.map((problem) => source.slice(problem.range.start, problem.range.end));
		assert.deepStrictEqual(slices, ['5', 'colour']);
	});

	test('a close misspelling carries a fix, other problems do not', () => {
		const source = HEADER + 'get_icon(name="a:b", opacity=5, zzzzzz=1)';
		const found = analyzer.findCalls(source).flatMap(checkCall);
		const withFix = found.filter((problem) => problem.fix);
		assert.strictEqual(withFix.length, 1);
		const fix = withFix[0].fix!;
		assert.strictEqual(source.slice(fix.range.start, fix.range.end), 'name');
		assert.strictEqual(fix.newText, 'icon');
	});
});
