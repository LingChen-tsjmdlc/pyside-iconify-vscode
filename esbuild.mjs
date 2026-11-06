import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const runtimeEntry = require.resolve('web-tree-sitter');
const runtimeWasm = require.resolve('web-tree-sitter/web-tree-sitter.wasm');
const grammarWasm = require.resolve('tree-sitter-python/tree-sitter-python.wasm');

await mkdir('out', { recursive: true });
await build({
	entryPoints: ['src/extension.ts'],
	outfile: 'out/extension.js',
	bundle: true,
	platform: 'node',
	format: 'cjs',
	target: 'node16',
	sourcemap: true,
	sourcesContent: false,
	external: ['vscode', 'web-tree-sitter/*.wasm', 'tree-sitter-python/*.wasm'],
	plugins: [{
		name: 'parser-commonjs',
		setup(build) {
			build.onResolve({ filter: /^web-tree-sitter$/ }, () => ({ path: runtimeEntry }));
		},
	}],
	logLevel: 'info',
});

await Promise.all([
	copyFile(runtimeWasm, 'out/web-tree-sitter.wasm'),
	copyFile(grammarWasm, 'out/tree-sitter-python.wasm'),
]);
const licenses = await Promise.all([
	readFile(path.join(path.dirname(runtimeWasm), 'LICENSE'), 'utf8'),
	readFile(path.join(path.dirname(grammarWasm), 'LICENSE'), 'utf8'),
]);
await writeFile('out/THIRD_PARTY_NOTICES.txt',
	`web-tree-sitter\n\n${licenses[0]}\n\ntree-sitter-python\n\n${licenses[1]}`);
