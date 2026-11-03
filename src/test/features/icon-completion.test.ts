import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonAnalyzer } from '../../core/analyzer';
import { IconCompletionProvider } from '../../features/icon-completion';
import type { SearchResult } from '../../iconify/api';
import type { PreviewFiles } from '../../iconify/previews';
import { recorder } from '../recorder';

const HEADER = 'from pyside_iconify import IconWidget, get_icon\n';
const RESULT: SearchResult = {
	icons: ['mdi:home', 'mdi:home-outline', 'lucide:house'],
	next: 3,
	hasMore: false,
	collections: { mdi: 'Material Design Icons', lucide: 'Lucide' },
};

suite('icon-completion', () => {
	let analyzer: Promise<PythonAnalyzer>;
	let directory: string;

	suiteSetup(function () {
		this.timeout(30000);
		analyzer = PythonAnalyzer.create();
		return analyzer;
	});

	setup(async () => {
		directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-completion-'));
	});

	teardown(async () => {
		await fs.promises.rm(directory, { recursive: true, force: true });
	});

	/** 假的搜索，记录收到的搜索词。 */
	function provider(search: (query: string) => Promise<SearchResult> = async () => RESULT, preview?: PreviewFiles) {
		const queries: string[] = [];
		const target = new IconCompletionProvider(
			analyzer,
			{
				search: (query) => {
					queries.push(query);
					return search(query);
				},
			},
			{
				get: async () => preview,
				load: async (names, _signal, onReady) => {
					for (const name of preview ? names : []) {
						onReady(name, preview!);
					}
				},
			}
		);
		return { target, queries };
	}

	/** 源码里用 `|` 标出光标，开头自动加导入行。 */
	async function at(body: string): Promise<{ document: vscode.TextDocument; position: vscode.Position }> {
		const marked = HEADER + body;
		const offset = marked.indexOf('|');
		const document = await vscode.workspace.openTextDocument({ language: 'python', content: marked.replace('|', '') });
		return { document, position: document.positionAt(offset) };
	}

	const live = () => new vscode.CancellationTokenSource().token;

	test('offers icons for what has been typed and replaces the whole string content', async () => {
		const { document, position } = await at('IconWidget("mdi:ho|me")\n');
		const { target, queries } = provider();
		const list = await target.provideCompletionItems(document, position, live());
		assert.ok(list);
		assert.strictEqual(list.isIncomplete, true);
		assert.deepStrictEqual(queries, ['mdi:ho']);
		assert.deepStrictEqual(
			list.items.map((item) => item.label),
			['mdi:home', 'mdi:home-outline', 'lucide:house']
		);
		const first = list.items[0];
		assert.strictEqual(first.insertText, 'mdi:home');
		assert.strictEqual(first.detail, 'Material Design Icons');
		assert.strictEqual(first.filterText, 'mdi:ho');
		assert.strictEqual(document.getText(first.range as vscode.Range), 'mdi:home');
		assert.deepStrictEqual(
			list.items.map((item) => item.sortText),
			['0000', '0001', '0002']
		);
	});

	test('works with the icon keyword argument too', async () => {
		const { document, position } = await at('get_icon(size=16, icon="ho|")\n');
		const list = await provider().target.provideCompletionItems(document, position, live());
		assert.strictEqual(list?.items.length, 3);
	});

	test('too little typed gives one incomplete placeholder that changes nothing, so typing on asks again', async () => {
		for (const body of ['IconWidget("|")\n', 'IconWidget("h|")\n', 'IconWidget("h|ello")\n']) {
			const { document, position } = await at(body);
			const { target, queries } = provider();
			const list = await target.provideCompletionItems(document, position, live());
			assert.strictEqual(list?.items.length, 1, body);
			assert.strictEqual(list.isIncomplete, true, body);
			assert.deepStrictEqual(queries, [], body);
			const [item] = list.items;
			assert.strictEqual(document.getText(item.range as vscode.Range), item.insertText, body);
		}
	});

	test('no results also gives a placeholder instead of an empty list', async () => {
		const { document, position } = await at('IconWidget("zzz|")\n');
		const list = await provider(async () => ({ icons: [], next: 0, hasMore: false, collections: {} })).target.provideCompletionItems(
			document,
			position,
			live()
		);
		assert.strictEqual(list?.items.length, 1);
		assert.strictEqual(list.isIncomplete, true);
	});

	test('offers nothing in other strings or outside strings', async () => {
		const { target, queries } = provider();
		for (const body of ['x = "mdi:ho|"\n', 'IconWidget("mdi:home", color="re|d")\n', 'IconWidget(|)\n', 'print("mdi:ho|")\n']) {
			const { document, position } = await at(body);
			assert.strictEqual(await target.provideCompletionItems(document, position, live()), undefined, body);
		}
		assert.deepStrictEqual(queries, []);
	});

	test('a failed search gives an incomplete placeholder instead of an error', async () => {
		const { document, position } = await at('IconWidget("ho|")\n');
		const { target } = provider(async () => {
			throw new Error('offline');
		});
		const list = await target.provideCompletionItems(document, position, live());
		assert.strictEqual(list?.items.length, 1);
		assert.strictEqual(list.isIncomplete, true);
	});

	test('the same query is searched once; a failed one is searched again', async () => {
		const { document, position } = await at('IconWidget("ho|")\n');
		let fail = true;
		const { target, queries } = provider(async () => {
			if (fail) {
				throw new Error('offline');
			}
			return RESULT;
		});
		await target.provideCompletionItems(document, position, live());
		fail = false;
		await target.provideCompletionItems(document, position, live());
		await target.provideCompletionItems(document, position, live());
		assert.deepStrictEqual(queries, ['ho', 'ho']);
	});

	test('a cancelled request gives nothing', async () => {
		const { document, position } = await at('IconWidget("ho|")\n');
		const source = new vscode.CancellationTokenSource();
		const { target } = provider();
		const pending = target.provideCompletionItems(document, position, source.token);
		source.cancel();
		assert.strictEqual(await pending, undefined);
	});

	test('items already carry the preview picture when the list appears', async () => {
		const file = path.join(directory, 'home.svg');
		await fs.promises.writeFile(file, '<svg width="24" height="24"/>');
		const { document, position } = await at('IconWidget("ho|")\n');
		const list = await provider(undefined, { light: file, dark: file }).target.provideCompletionItems(document, position, live());
		for (const item of list!.items) {
			assert.ok((item.documentation as vscode.MarkdownString).value.includes('data:image/svg+xml;base64,'));
		}
	});

	test('a slow preview download does not hold the list back for long', async function () {
		this.timeout(5000);
		const { document, position } = await at('IconWidget("ho|")\n');
		const target = new IconCompletionProvider(
			analyzer,
			{ search: async () => RESULT },
			{ get: async () => undefined, load: () => new Promise(() => undefined) }
		);
		const started = Date.now();
		const list = await target.provideCompletionItems(document, position, live());
		assert.strictEqual(list?.items.length, 3);
		assert.strictEqual(list.items[0].documentation, undefined);
		assert.ok(Date.now() - started < 2000);
	});

	suite('logging', () => {
		function logged(search: (query: string) => Promise<SearchResult> = async () => RESULT) {
			const { lines, logger } = recorder();
			const target = new IconCompletionProvider(
				analyzer,
				{ search },
				{ get: async () => undefined, load: async () => undefined },
				logger
			);
			return { target, lines };
		}

		test('every request is numbered and ends with a finish line', async () => {
			const { document, position } = await at('IconWidget("ho|")\n');
			const { target, lines } = logged();
			await target.provideCompletionItems(document, position, live());
			assert.ok(lines.some((line) => /^DEBUG completion\.start id=1 /.test(line)), lines.join('\n'));
			assert.ok(lines.some((line) => /^INFO completion\.list id=1 query=ho icons=3 /.test(line)), lines.join('\n'));
			assert.ok(lines.some((line) => /^DEBUG completion\.finish id=1 items=3 incomplete=true /.test(line)), lines.join('\n'));
		});

		test('every early return says why', async () => {
			const cases: Array<[string, string]> = [
				['print("mdi:ho|")\n', 'reason=string-not-icon-argument'],
				['IconWidget(|)\n', 'reason=not-inside-complete-string'],
				['IconWidget("h|")\n', 'reason=too-short'],
			];
			for (const [body, expected] of cases) {
				const { document, position } = await at(body);
				const { target, lines } = logged();
				await target.provideCompletionItems(document, position, live());
				assert.ok(
					lines.some((line) => line.includes(expected)),
					`${body}\n${lines.join('\n')}`
				);
			}
		});

		test('a failed search is a warning with the reason and the error', async () => {
			const { document, position } = await at('IconWidget("ho|")\n');
			const { target, lines } = logged(async () => {
				throw new Error('offline');
			});
			await target.provideCompletionItems(document, position, live());
			assert.ok(
				lines.some((line) => line.startsWith('WARN completion.placeholder') && line.includes('reason=search-failed') && line.includes('offline')),
				lines.join('\n')
			);
		});
	});

	suite('resolve', () => {
		test('puts the preview picture into the documentation', async () => {
			const file = path.join(directory, 'home.svg');
			await fs.promises.writeFile(file, '<svg xmlns="http://www.w3.org/2000/svg"/>');
			const { document, position } = await at('IconWidget("ho|")\n');
			const { target } = provider(undefined, { light: file, dark: file });
			const list = await target.provideCompletionItems(document, position, live());
			const item = await target.resolveCompletionItem(list!.items[0], live());
			const markdown = item.documentation as vscode.MarkdownString;
			assert.ok(markdown.value.startsWith('| |\n|:---:|\n| ![](data:image/svg+xml;base64,'));
			assert.ok(markdown.value.includes('| `mdi:home` |'));
			const encoded = /base64,([^)]+)\)/.exec(markdown.value)![1];
			assert.strictEqual(Buffer.from(encoded, 'base64').toString(), '<svg xmlns="http://www.w3.org/2000/svg"/>');
		});

		test('works on a plain item that only has its label, as after a round trip through the extension host', async () => {
			const file = path.join(directory, 'home.svg');
			await fs.promises.writeFile(file, '<svg xmlns="http://www.w3.org/2000/svg"/>');
			const { target } = provider(undefined, { light: file, dark: file });
			const item = await target.resolveCompletionItem(new vscode.CompletionItem('mdi:home'), live());
			assert.ok((item.documentation as vscode.MarkdownString).value.includes('| `mdi:home` |'));
		});

		test('leaves the item alone when there is no preview or the file is gone', async () => {
			const { document, position } = await at('IconWidget("ho|")\n');
			const none = provider();
			const list = await none.target.provideCompletionItems(document, position, live());
			assert.strictEqual((await none.target.resolveCompletionItem(list!.items[0], live())).documentation, undefined);

			const gone = path.join(directory, 'missing.svg');
			const broken = provider(undefined, { light: gone, dark: gone });
			const second = await broken.target.provideCompletionItems(document, position, live());
			assert.strictEqual((await broken.target.resolveCompletionItem(second!.items[0], live())).documentation, undefined);
		});

		test('items that are not icons come back unchanged', async () => {
			const other = new vscode.CompletionItem('x');
			assert.strictEqual(await provider().target.resolveCompletionItem(other, live()), other);
		});
	});
});
