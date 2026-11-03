import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonAnalyzer } from '../../core/analyzer';
import { IconHoverProvider } from '../../features/icon-hover';
import type { PreviewFiles } from '../../iconify/previews';

const HEADER = 'from pyside_iconify import IconWidget, get_icon\n';

suite('icon-hover', () => {
	let analyzer: Promise<PythonAnalyzer>;
	let directory: string;
	let file: string;

	suiteSetup(function () {
		this.timeout(30000);
		analyzer = PythonAnalyzer.create();
		return analyzer;
	});

	setup(async () => {
		directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-hover-'));
		file = path.join(directory, 'home.svg');
		await fs.promises.writeFile(file, '<svg width="48" height="24" viewBox="0 0 2 1"/>');
	});

	teardown(async () => {
		await fs.promises.rm(directory, { recursive: true, force: true });
	});

	function provider(files: PreviewFiles | undefined = { light: file, dark: file }) {
		const asked: string[] = [];
		const target = new IconHoverProvider(analyzer, {
			get: async (name) => {
				asked.push(name);
				return files;
			},
		});
		return { target, asked };
	}

	async function at(body: string) {
		const marked = HEADER + body;
		const document = await vscode.workspace.openTextDocument({ language: 'python', content: marked.replace('|', '') });
		return { document, position: document.positionAt(marked.indexOf('|')) };
	}

	const live = () => new vscode.CancellationTokenSource().token;

	test('shows the name and a large picture over the icon argument', async () => {
		const { document, position } = await at('IconWidget("mdi:ho|me")\n');
		const { target, asked } = provider();
		const hover = await target.provideHover(document, position, live());
		assert.ok(hover);
		assert.deepStrictEqual(asked, ['mdi:home']);
		const markdown = hover.contents[0] as vscode.MarkdownString;
		assert.ok(markdown.value.startsWith('**mdi:home**\n\n![mdi:home](data:image/svg+xml;base64,'));
		const svg = Buffer.from(markdown.value.split('base64,')[1].slice(0, -1), 'base64').toString();
		assert.ok(svg.includes('width="192" height="96"'));
		assert.strictEqual(document.getText(hover.range), 'mdi:home');
	});

	test('nothing over other strings, invalid names or outside strings', async () => {
		const { target, asked } = provider();
		for (const body of ['x = "mdi:ho|me"\n', 'IconWidget("ho|me")\n', 'IconWidget("mdi:home", color="re|d")\n', 'IconWidget(|)\n']) {
			const { document, position } = await at(body);
			assert.strictEqual(await target.provideHover(document, position, live()), undefined, body);
		}
		assert.deepStrictEqual(asked, []);
	});

	test('nothing when there is no preview or the file is gone', async () => {
		const { document, position } = await at('IconWidget("mdi:ho|me")\n');
		assert.strictEqual(await provider(undefined).target.provideHover(document, position, live()), undefined);
		const gone = path.join(directory, 'missing.svg');
		assert.strictEqual(await provider({ light: gone, dark: gone }).target.provideHover(document, position, live()), undefined);
	});
});
