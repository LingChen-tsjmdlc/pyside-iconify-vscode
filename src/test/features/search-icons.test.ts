import * as assert from 'assert';
import * as vscode from 'vscode';
import { PythonAnalyzer } from '../../core/analyzer';
import { SEARCH_ICONS_COMMAND, insertIcon } from '../../features/search-icons';

suite('search-icons', () => {
	let analyzer: Promise<PythonAnalyzer>;

	suiteSetup(function () {
		this.timeout(30000);
		analyzer = PythonAnalyzer.create();
		return analyzer;
	});

	/** 分析器只认从 pyside-iconify 导入的名字，所以每个文档都带上这行导入。 */
	const HEADER = 'from pyside_iconify import IconWidget, get_icon\n';

	/** 打开一个 Python 文档，源码里用 `|` 标出光标（或用 `[` `]` 标选区）。文档不关闭：脏的无标题文档关闭时会弹保存提示。 */
	async function open(body: string): Promise<vscode.TextEditor> {
		const marked = HEADER + body;
		const text = marked.replace(/[|[\]]/g, '');
		const document = await vscode.workspace.openTextDocument({ language: 'python', content: text });
		const editor = await vscode.window.showTextDocument(document);
		const cursor = marked.indexOf('|');
		const from = cursor >= 0 ? cursor : marked.indexOf('[');
		const to = cursor >= 0 ? cursor : marked.indexOf(']') - 1;
		editor.selection = new vscode.Selection(document.positionAt(from), document.positionAt(to));
		return editor;
	}

	/** 去掉导入行后的文档正文。 */
	function bodyOf(editor: vscode.TextEditor): string {
		return editor.document.getText().slice(HEADER.length);
	}

	/** 光标相对正文开头的偏移。 */
	function caretOf(editor: vscode.TextEditor): number {
		return editor.document.offsetAt(editor.selection.active) - HEADER.length;
	}

	suite('insertIcon', () => {
		test('replaces the text of the icon argument', async () => {
			const editor = await open('IconWidget("mdi:ho|")\n');
			assert.ok(await insertIcon(editor, analyzer, 'mdi:home'));
			assert.strictEqual(bodyOf(editor), 'IconWidget("mdi:home")\n');
			assert.strictEqual(caretOf(editor), 'IconWidget("mdi:home'.length);
		});

		test('replaces only the selection in the icon argument', async () => {
			const editor = await open('IconWidget("mdi:[ho]")\n');
			assert.ok(await insertIcon(editor, analyzer, 'home'));
			assert.strictEqual(bodyOf(editor), 'IconWidget("mdi:home")\n');
		});

		test('inserts the bare name in another string', async () => {
			const editor = await open('x = "icon: |"\n');
			assert.ok(await insertIcon(editor, analyzer, 'mdi:home'));
			assert.strictEqual(bodyOf(editor), 'x = "icon: mdi:home"\n');
		});

		test('inserts a quoted name outside a string and puts the cursor after it', async () => {
			const editor = await open('IconWidget(|)\n');
			assert.ok(await insertIcon(editor, analyzer, 'mdi:home'));
			assert.strictEqual(bodyOf(editor), 'IconWidget("mdi:home")\n');
			assert.strictEqual(caretOf(editor), 'IconWidget("mdi:home"'.length);
		});

		test('replaces a selection outside a string with the quoted name', async () => {
			const editor = await open('icon = [old]\n');
			assert.ok(await insertIcon(editor, analyzer, 'mdi:home'));
			assert.strictEqual(bodyOf(editor), 'icon = "mdi:home"\n');
		});

		test('a file that is not Python always gets the quoted name', async () => {
			const document = await vscode.workspace.openTextDocument({ language: 'plaintext', content: '"abc"' });
			const editor = await vscode.window.showTextDocument(document);
			editor.selection = new vscode.Selection(0, 2, 0, 2);
			assert.ok(await insertIcon(editor, analyzer, 'mdi:home'));
			assert.strictEqual(document.getText(), '"a"mdi:home"bc"');
		});

		test('still works when the parser failed to load', async () => {
			const editor = await open('IconWidget(|)\n');
			assert.ok(await insertIcon(editor, Promise.reject(new Error('no parser')), 'mdi:home'));
			assert.strictEqual(bodyOf(editor), 'IconWidget("mdi:home")\n');
		});

		test('a call that is not imported from pyside_iconify is just a string', async () => {
			const document = await vscode.workspace.openTextDocument({ language: 'python', content: 'IconWidget("mdi:ho")\n' });
			const editor = await vscode.window.showTextDocument(document);
			editor.selection = new vscode.Selection(0, 18, 0, 18);
			assert.ok(await insertIcon(editor, analyzer, 'mdi:home'));
			assert.strictEqual(document.getText(), 'IconWidget("mdi:homdi:home")\n');
		});
	});

	suite('command', () => {
		test('is registered after it is executed', async () => {
			await open('x = 1\n');
			await vscode.commands.executeCommand(SEARCH_ICONS_COMMAND);
			const commands = await vscode.commands.getCommands(true);
			assert.ok(commands.includes(SEARCH_ICONS_COMMAND));
			await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
		});

		test('can be run twice in a row', async () => {
			await open('x = 1\n');
			await vscode.commands.executeCommand(SEARCH_ICONS_COMMAND);
			await vscode.commands.executeCommand(SEARCH_ICONS_COMMAND);
			await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
		});
	});
});
