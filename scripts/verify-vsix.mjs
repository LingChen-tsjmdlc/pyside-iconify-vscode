import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { runTests } from '@vscode/test-electron';

const vsix = process.argv[2];
assert.ok(vsix, 'Usage: pnpm run verify:vsix <extension.vsix>');
const archive = await JSZip.loadAsync(await readFile(vsix));
const manifest = JSON.parse(await archive.file('extension/package.json').async('string'));
for (const name of [manifest.main, 'out/web-tree-sitter.wasm', 'out/tree-sitter-python.wasm', 'out/THIRD_PARTY_NOTICES.txt']) {
	assert.ok(archive.file(`extension/${name.replace(/^\.\//, '')}`), `VSIX is missing ${name}`);
}

const tempRoot = path.resolve(os.tmpdir());
const temporary = await mkdtemp(path.join(tempRoot, 'pyside-iconify-vsix-'));
let passed = false;
try {
	const extension = path.join(temporary, 'extension');
	for (const entry of Object.values(archive.files)) {
		if (entry.dir || !entry.name.startsWith('extension/')) {
			continue;
		}
		const destination = path.resolve(temporary, entry.name);
		assert.ok(destination.startsWith(extension + path.sep), `Unsafe archive path: ${entry.name}`);
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, await entry.async('nodebuffer'));
	}
	assert.ok(!Object.keys(archive.files).some((name) => name.includes('/node_modules/')), 'The bundle must work without node_modules');
	const runner = fileURLToPath(new URL('../out/test/packaged/smoke.js', import.meta.url));
	const executable = process.env.VSCODE_EXECUTABLE_PATH;
	const versions = executable ? [undefined] : (process.env.VSCODE_TEST_VERSION ? [process.env.VSCODE_TEST_VERSION] : ['1.73.0', 'stable']);
	for (const [index, version] of versions.entries()) {
		console.log(`Verifying ${path.basename(vsix)} in VS Code ${version ?? executable}`);
		await runTests({
			version,
			vscodeExecutablePath: executable,
			extensionDevelopmentPath: extension,
			extensionTestsPath: runner,
			launchArgs: [
				`--user-data-dir=${path.join(temporary, `user-data-${index}`)}`,
				`--extensions-dir=${path.join(temporary, `extensions-${index}`)}`,
				'--disable-extensions', '--skip-welcome', '--skip-release-notes', '--locale=en',
			],
		});
	}
	passed = true;
} finally {
	assert.strictEqual(path.dirname(path.resolve(temporary)), tempRoot);
	assert.ok(path.basename(temporary).startsWith('pyside-iconify-vsix-'));
	if (passed) {
		await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
	} else {
		console.error(`Packaged verification logs are preserved in ${temporary}`);
	}
}
