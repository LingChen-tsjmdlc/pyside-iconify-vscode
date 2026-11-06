import * as assert from 'assert';
import { EventEmitter } from 'events';
import type * as https from 'https';
import { createRequire } from 'module';
import * as path from 'path';
import { Readable } from 'stream';
import * as vscode from 'vscode';

const HEADER = 'from pyside_iconify import IconWidget, get_icon\n';

/** 验证安装包里的激活、WASM、编辑器功能和搜索命令；网络响应使用本地数据。 */
export async function run(): Promise<void> {
	const extension = vscode.extensions.getExtension('lingchen.pyside-iconify');
	assert.ok(extension, 'Packaged extension is present');
	const requests: string[] = [];
	const get = (url: string, _options: unknown, callback: (response: Readable) => void) => {
		const address = new URL(url);
		assert.strictEqual(address.hostname, 'api.iconify.design', 'Smoke checks must not use the network');
		requests.push(address.pathname);
		const body = address.pathname === '/collections'
			? { mdi: { name: 'Material Design Icons' } }
			: address.pathname === '/search'
				? { icons: ['mdi:home'], total: 1, limit: 50, start: 0, collections: { mdi: { name: 'Material Design Icons' } } }
				: { prefix: 'mdi', width: 24, height: 24, icons: { home: { body: '<path d="M0 0h24v24H0z"/>' } } };
		const request = new EventEmitter() as EventEmitter & { setTimeout: () => void; destroy: () => void };
		request.setTimeout = () => {};
		request.destroy = () => {};
		setImmediate(() => callback(Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { statusCode: 200 })));
		return request;
	};
	const httpModule = createRequire(path.join(extension.extensionPath, 'package.json'))('https') as typeof https;
	const actualDescriptor = Object.getOwnPropertyDescriptor(httpModule, 'get');
	assert.ok(actualDescriptor);
	Object.defineProperty(httpModule, 'get', { configurable: true, writable: true, value: get });
	try {
		await extension.activate();
		assert.ok(extension.isActive, 'Packaged extension activates');
		assert.ok((await vscode.commands.getCommands()).includes('pyside-iconify.searchIcons'), 'Search command is registered');

		async function open(marked: string): Promise<{ document: vscode.TextDocument; position: vscode.Position }> {
			const text = HEADER + marked;
			const offset = text.indexOf('|');
			const document = await vscode.workspace.openTextDocument({ language: 'python', content: text.replace('|', '') });
			await vscode.window.showTextDocument(document);
			return { document, position: document.positionAt(offset) };
		}
		async function labels(marked: string): Promise<string[]> {
			const { document, position } = await open(marked);
			const list = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', document.uri, position);
			return list.items.map((item) => typeof item.label === 'string' ? item.label : item.label.label);
		}

		assert.ok((await labels('IconWidget("mdi:home", |)')).includes('opacity'), 'Parameter names are completed');
		assert.ok((await labels('IconWidget("mdi:home", animation=|)')).includes('"pulse"'), 'Parameter values are completed');
		const hover = await open('IconWidget("mdi:home", op|acity=0.5)');
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', hover.document.uri, hover.position);
		const text = hovers.flatMap((item) => item.contents).map((item) => typeof item === 'string' ? item : item.value).join('\n');
		assert.ok(text.includes('(parameter) opacity: float = 1.0'), 'Hover shows the extension documentation');
		const callable = await open('IconWi|dget("mdi:home")');
		const callableHovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', callable.document.uri, callable.position);
		assert.ok(callableHovers.some((item) => item.contents.some((content) => typeof content !== 'string' && content.value.includes('(class) IconWidget'))), 'Class hover shows the extension documentation');
		const icon = await open('IconWidget("mdi:ho|me")');
		const iconHovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', icon.document.uri, icon.position);
		assert.ok(iconHovers.some((item) => item.contents.some((content) => typeof content !== 'string' && content.value.includes('data:image/svg+xml;base64,'))), 'Icon hover shows a preview');
		const invalid = await open('IconWidget("mdi:home", opacity=|5)');
		const deadline = Date.now() + 10000;
		while (!vscode.languages.getDiagnostics(invalid.document.uri).some((item) => item.source === 'PySide Iconify')) {
			assert.ok(Date.now() < deadline, 'Extension diagnostics appear');
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		const icons = await labels('IconWidget(icon="ho|me")');
		assert.ok(icons.includes('mdi:home'), `Icon search completion is available: ${JSON.stringify({ icons, requests })}`);
		assert.ok(requests.includes('/search'), 'Icon completion uses the search service');
		await vscode.commands.executeCommand('pyside-iconify.searchIcons');
		await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
		console.log('Packaged extension: activation, parser, parameters, values, documentation, icon hover, diagnostics, icon completion and search command passed.');
	} finally {
		Object.defineProperty(httpModule, 'get', actualDescriptor);
	}
}
