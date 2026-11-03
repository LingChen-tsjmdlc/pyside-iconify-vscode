import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { PythonAnalyzer } from '../../core/analyzer';
import { InlineIcons } from '../../features/inline-icons';
import type { PreviewFiles } from '../../iconify/previews';

const HEADER = 'from pyside_iconify import IconWidget, get_icon\n';

suite('inline-icons', () => {
	let analyzer: Promise<PythonAnalyzer>;
	let directory: string;
	let created: InlineIcons[];

	suiteSetup(function () {
		this.timeout(30000);
		analyzer = PythonAnalyzer.create();
		return analyzer;
	});

	setup(async () => {
		directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-inline-'));
		created = [];
	});

	teardown(async () => {
		created.forEach((icons) => icons.dispose());
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
		await fs.promises.rm(directory, { recursive: true, force: true });
	});

	/** 假的预览：记录被请求的图标名和取消信号，可选地给每个图标一个文件。 */
	function inline(withFiles = true) {
		const requests: Array<{ names: readonly string[]; signal: AbortSignal }> = [];
		const file = path.join(directory, 'icon.svg');
		fs.writeFileSync(file, '<svg width="24" height="24"/>');
		const files: PreviewFiles = { light: file, dark: file };
		const icons = new InlineIcons(analyzer, {
			load: async (names, signal, onReady) => {
				requests.push({ names, signal });
				for (const name of withFiles ? names : []) {
					onReady(name, files);
				}
			},
		});
		created.push(icons);
		return { icons, requests };
	}

	async function show(body: string, language = 'python'): Promise<vscode.TextEditor> {
		const document = await vscode.workspace.openTextDocument({ language, content: HEADER + body });
		return vscode.window.showTextDocument(document);
	}

	test('the default display mode is icon only', () => {
		assert.strictEqual(inline().icons.currentMode, 'iconOnly');
	});

	test('asks for each distinct icon name in icon arguments once, and nothing else', async () => {
		const editor = await show('IconWidget("mdi:home")\nget_icon(icon="lucide:house")\nIconWidget("mdi:home")\nx = "mdi:cog"\n');
		const { icons, requests } = inline();
		await icons.refresh(editor);
		assert.strictEqual(requests.length, 1);
		assert.deepStrictEqual([...requests[0].names].sort(), ['lucide:house', 'mdi:home']);
	});

	test('does nothing for files that are not Python', async () => {
		const editor = await show('IconWidget("mdi:home")\n', 'plaintext');
		const { icons, requests } = inline();
		await icons.refresh(editor);
		assert.strictEqual(requests.length, 0);
	});

	test('a newer refresh cancels the older one', async () => {
		const editor = await show('IconWidget("mdi:home")\n');
		const { icons, requests } = inline();
		await icons.refresh(editor);
		await icons.refresh(editor);
		assert.strictEqual(requests.length, 2);
		assert.strictEqual(requests[0].signal.aborted, true);
		assert.strictEqual(requests[1].signal.aborted, false);
	});

	test('a preview that fails to load does not break anything', async () => {
		const editor = await show('IconWidget("mdi:home")\n');
		const icons = new InlineIcons(analyzer, {
			load: async () => {
				throw new Error('offline');
			},
		});
		created.push(icons);
		await icons.refresh(editor);
		icons.paintHidden(editor);
	});

	test('a preview file that is gone does not break anything', async () => {
		const editor = await show('IconWidget("mdi:home")\n');
		const gone = path.join(directory, 'missing.svg');
		const icons = new InlineIcons(analyzer, {
			load: async (names, _signal, onReady) => names.forEach((name) => onReady(name, { light: gone, dark: gone })),
		});
		created.push(icons);
		await icons.refresh(editor);
	});

	test('refreshing with nothing to load, and disposing, are harmless', async () => {
		const editor = await show('x = 1\n');
		const { icons, requests } = inline(false);
		await icons.refresh(editor);
		assert.strictEqual(requests[0]?.names.length ?? 0, 0);
		icons.dispose();
	});
});
