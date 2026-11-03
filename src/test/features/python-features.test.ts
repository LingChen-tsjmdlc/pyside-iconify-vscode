import * as assert from 'assert';
import * as vscode from 'vscode';

const HEADER = 'from pyside_iconify import IconWidget, get_icon\n';

/** 确保本扩展已激活，并打开一个 Python 文档。 */
async function open(content: string): Promise<vscode.TextDocument> {
	const extension = vscode.extensions.all.find((item) => item.packageJSON.name === 'pyside-iconify');
	await extension?.activate();
	const document = await vscode.workspace.openTextDocument({ language: 'python', content });
	await vscode.window.showTextDocument(document);
	return document;
}

function labelOf(item: vscode.CompletionItem): string {
	return typeof item.label === 'string' ? item.label : item.label.label;
}

async function completionsAt(document: vscode.TextDocument, marker: string): Promise<vscode.CompletionItem[]> {
	const offset = document.getText().indexOf(marker) + marker.length;
	const list = await vscode.commands.executeCommand<vscode.CompletionList>(
		'vscode.executeCompletionItemProvider',
		document.uri,
		document.positionAt(offset)
	);
	return list.items;
}

async function waitFor<T>(read: () => T | undefined, timeoutMs = 10000): Promise<T | undefined> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const value = read();
		if (value !== undefined || Date.now() > deadline) {
			return value;
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

suite('python features', function () {
	this.timeout(30000);

	test('completion offers parameter names with documentation', async () => {
		const document = await open(`${HEADER}w = IconWidget("mdi:home", )\n`);
		const items = await completionsAt(document, 'IconWidget("mdi:home", ');
		const opacity = items.find((item) => labelOf(item) === 'opacity');
		assert.ok(opacity, 'opacity is offered');
		assert.strictEqual(opacity.insertText, 'opacity=');
		assert.ok(items.some((item) => labelOf(item) === 'animation'));
		assert.ok(!items.some((item) => labelOf(item) === 'icon'), 'icon is already given by position');
	});

	test('completion offers values of a parameter', async () => {
		const document = await open(`${HEADER}w = IconWidget("mdi:home", animation=)\n`);
		const labels = (await completionsAt(document, 'animation=')).map(labelOf);
		for (const expected of ['"spin"', '"pulse"', '"breathe"', '"ping"', '"bounce"', 'None']) {
			assert.ok(labels.includes(expected), expected);
		}
	});

	test('hover on a parameter name shows type and description', async () => {
		const document = await open(`${HEADER}w = IconWidget("mdi:home", opacity=0.5)\n`);
		const offset = document.getText().indexOf('opacity') + 2;
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', document.uri, document.positionAt(offset));
		const text = hovers
			.flatMap((hover) => hover.contents)
			.map((content) => (typeof content === 'string' ? content : content.value))
			.join('\n');
		assert.ok(text.includes('(parameter) opacity: float = 1.0'), text);
		assert.ok(text.includes('Overall opacity'), text);
	});

	test('diagnostics mark invalid values and unknown parameters', async () => {
		const document = await open(`${HEADER}w = IconWidget("bad", opacity=5, colour="red")\n`);
		const found = await waitFor(() => {
			const diagnostics = vscode.languages.getDiagnostics(document.uri).filter((item) => item.source === 'PySide Iconify');
			return diagnostics.length >= 3 ? diagnostics : undefined;
		});
		assert.ok(found, 'diagnostics appear');
		const slices = found.map((item) => document.getText(item.range)).sort();
		assert.deepStrictEqual(slices, ['"bad"', '5', 'colour']);
	});

	test('diagnostics are removed after the code is fixed', async () => {
		const document = await open(`${HEADER}w = IconWidget("mdi:home", opacity=5)\n`);
		await waitFor(() => (vscode.languages.getDiagnostics(document.uri).length > 0 ? true : undefined));
		const edit = new vscode.WorkspaceEdit();
		edit.replace(document.uri, new vscode.Range(1, 0, 1, 100), 'w = IconWidget("mdi:home", opacity=0.5)');
		await vscode.workspace.applyEdit(edit);
		const cleared = await waitFor(() => (vscode.languages.getDiagnostics(document.uri).length === 0 ? true : undefined));
		assert.ok(cleared);
	});

	test('quick fix renames a misspelled parameter', async () => {
		const document = await open(`${HEADER}w = get_icon(name="mdi:home")\n`);
		const diagnostics = await waitFor(() => {
			const found = vscode.languages.getDiagnostics(document.uri).filter((item) => item.source === 'PySide Iconify');
			return found.length > 0 ? found : undefined;
		});
		assert.ok(diagnostics);
		const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
			'vscode.executeCodeActionProvider',
			document.uri,
			diagnostics[0].range,
			vscode.CodeActionKind.QuickFix.value
		);
		const fix = actions.find((action) => action.edit);
		assert.ok(fix, 'a quick fix is offered');
		assert.ok(await vscode.workspace.applyEdit(fix.edit!));
		assert.ok(document.getText().includes('get_icon(icon="mdi:home")'), document.getText());
	});
});
