import * as assert from 'assert';
import { PythonAnalyzer } from '../../core/analyzer';

const HEADER = 'from pyside_iconify import IconWidget, get_icon, set_icon\n';

/** 源码里用 `|` 标出光标，返回去掉标记的源码和光标位置。 */
function withCursor(marked: string): [string, number] {
	const offset = marked.indexOf('|');
	return [marked.replace('|', ''), offset];
}

suite('core/analyzer', () => {
	let analyzer: PythonAnalyzer;

	suiteSetup(async function () {
		this.timeout(30000);
		analyzer = await PythonAnalyzer.create();
	});

	function complete(marked: string) {
		const [source, offset] = withCursor(HEADER + marked);
		const target = analyzer.completionAt(source, offset);
		return target && { ...target, text: source.slice(target.range.start, target.range.end), offset };
	}

	function hover(marked: string) {
		const [source, offset] = withCursor(HEADER + marked);
		const target = analyzer.hoverAt(source, offset);
		return target && { ...target, text: source.slice(target.range.start, target.range.end) };
	}

	suite('completion', () => {
		test('parameter names after the opening parenthesis', () => {
			const target = complete('IconWidget(|)');
			assert.strictEqual(target?.kind, 'name');
			assert.strictEqual(target?.text, '');
		});

		test('parameter names after a comma, skipping the ones already used', () => {
			const target = complete('IconWidget("mdi:home", size=1, |)');
			assert.strictEqual(target?.kind, 'name');
			assert.deepStrictEqual(target?.kind === 'name' && target.used.sort(), ['icon', 'size']);
		});

		test('a half-typed parameter name is replaced as a whole', () => {
			const target = complete('IconWidget("mdi:home", si|)');
			assert.strictEqual(target?.kind, 'name');
			assert.strictEqual(target?.text, 'si');
		});

		test('the name of an existing keyword argument keeps its equals sign', () => {
			const target = complete('IconWidget("mdi:home", si|=24)');
			assert.strictEqual(target?.kind === 'name' && target.hasEquals, true);
			assert.strictEqual(target?.text, 'si');
		});

		test('values after an equals sign with nothing typed', () => {
			for (const marked of ['IconWidget("a:b", animation=|)', 'IconWidget("a:b", animation= |)', 'IconWidget("a:b", animation=|, size=1)']) {
				const target = complete(marked);
				assert.strictEqual(target?.kind, 'value', marked);
				assert.strictEqual(target?.kind === 'value' && target.param, 'animation', marked);
				assert.strictEqual(target?.text, '', marked);
			}
		});

		test('values inside a half-typed string replace the whole string', () => {
			const target = complete('IconWidget("a:b", animation="sp|")');
			assert.strictEqual(target?.kind, 'value');
			assert.strictEqual(target?.text, '"sp"');
		});

		test('values with a half-typed name', () => {
			const target = complete('IconWidget("a:b", spin=Tr|)');
			assert.strictEqual(target?.kind === 'value' && target.param, 'spin');
			assert.strictEqual(target?.text, 'Tr');
		});

		test('nothing inside the icon name string or other expressions', () => {
			assert.strictEqual(complete('IconWidget("mdi:ho|")'), undefined);
			assert.strictEqual(complete('IconWidget(make(|))'), undefined);
			assert.strictEqual(complete('IconWidget("a:b", size=(1, |))')?.kind, undefined);
		});

		test('nothing outside pyside-iconify calls', () => {
			assert.strictEqual(complete('print(|)'), undefined);
			assert.strictEqual(complete('x = |'), undefined);
			assert.strictEqual(complete('other.get_icon(|)'), undefined);
			assert.strictEqual(analyzer.completionAt('IconWidget(|)'.replace('|', ''), 11), undefined);
		});

		test('nested calls pick the innermost one', () => {
			const target = complete('IconWidget("a:b", fallback=get_icon(|))');
			assert.strictEqual(target?.callable, 'get_icon');
		});

		test('the cursor right after a multi-byte character gives correct ranges', () => {
			const target = complete('x = "中😀"; IconWidget("a:b", animation="pu|")');
			assert.strictEqual(target?.text, '"pu"');
		});
	});

	suite('hover', () => {
		test('the call name', () => {
			const target = hover('IconWidget|("a:b")');
			assert.deepStrictEqual([target?.kind, target?.callable, target?.text], ['callable', 'IconWidget', 'IconWidget']);
		});

		test('the last name of a dotted call', () => {
			const [source, offset] = withCursor('import pyside_iconify as pi\npi.get_ic|on("a:b")');
			const target = analyzer.hoverAt(source, offset);
			assert.ok(target);
			assert.strictEqual(target.kind, 'callable');
			assert.strictEqual(source.slice(target.range.start, target.range.end), 'get_icon');
		});

		test('a keyword argument name', () => {
			const target = hover('IconWidget("a:b", op|acity=0.5)');
			assert.deepStrictEqual([target?.kind, target?.kind === 'param' && target.param, target?.text], ['param', 'opacity', 'opacity']);
		});

		test('nothing on values, unknown names or other calls', () => {
			assert.strictEqual(hover('IconWidget("a:b", opacity=0|.5)'), undefined);
			assert.strictEqual(hover('IconWidget("a:b", zz|zz=1)'), undefined);
			assert.strictEqual(hover('pri|nt("a:b")'), undefined);
		});

		test('a parameter that only exists on another callable gives nothing', () => {
			assert.strictEqual(hover('get_icon("a:b", anim|ation="spin")'), undefined);
		});
	});

	suite('stringAt', () => {
		function at(marked: string) {
			const [source, offset] = withCursor(HEADER + marked);
			const target = analyzer.stringAt(source, offset);
			return target && { ...target, text: source.slice(target.contentRange.start, target.contentRange.end) };
		}

		test('the icon argument of a call', () => {
			const target = at('IconWidget("mdi:ho|me")');
			assert.deepStrictEqual([target?.text, target?.isIconArgument], ['mdi:home', true]);
		});

		test('the icon keyword argument', () => {
			assert.strictEqual(at('get_icon(icon="mdi:ho|me")')?.isIconArgument, true);
		});

		test('an empty string counts as inside', () => {
			assert.deepStrictEqual([at('IconWidget("|")')?.text, at('IconWidget("|")')?.isIconArgument], ['', true]);
		});

		test('a string that is not the icon argument', () => {
			assert.strictEqual(at('IconWidget("mdi:home", color="re|d")')?.isIconArgument, false);
			assert.strictEqual(at('x = "ab|c"')?.isIconArgument, false);
			assert.strictEqual(at('print("mdi:ho|me")')?.isIconArgument, false);
		});

		test('not inside a string', () => {
			assert.strictEqual(at('x = 1|'), undefined);
			assert.strictEqual(at('IconWidget(|)'), undefined);
		});

		test('the cursor on a quote is outside the content', () => {
			assert.strictEqual(at('x = |"abc"'), undefined);
			assert.strictEqual(at('x = "abc"|'), undefined);
		});

		test('an unterminated string is not a target', () => {
			assert.strictEqual(at('x = "ab|c'), undefined);
		});

		test('a selection must stay inside one string', () => {
			const source = HEADER + 'x = "abc" + "def"';
			const from = source.indexOf('abc');
			assert.ok(analyzer.stringAt(source, from + 1, from + 3));
			assert.strictEqual(analyzer.stringAt(source, from + 1, source.indexOf('def') + 1), undefined);
		});
	});
});
