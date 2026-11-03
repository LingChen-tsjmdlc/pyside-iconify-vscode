import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PreviewStore, previewDataUri, previewImages, type PreviewFiles } from '../../iconify/previews';
import { recorder } from '../recorder';

const SVG = '<svg viewBox="0 0 1 1"><path fill="currentColor"/></svg>';

type Handler = (prefix: string, names: readonly string[]) => Promise<Record<string, string>>;

/** 默认处理：请求的每个图标都返回同一个 SVG。 */
const everything: Handler = async (_prefix, names) => Object.fromEntries(names.map((name) => [name, SVG]));

suite('iconify/previews', () => {
	let directory: string;

	setup(async () => {
		directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-previews-'));
	});

	teardown(async () => {
		await fs.promises.rm(directory, { recursive: true, force: true });
	});

	/** 造一个带假接口的缓存，并记录每次请求。 */
	function store(handler: Handler = everything) {
		const requests: Array<{ prefix: string; names: readonly string[] }> = [];
		const api = {
			fetchIcons: async (prefix: string, names: readonly string[]) => {
				requests.push({ prefix, names });
				return handler(prefix, names);
			},
		};
		return { store: new PreviewStore(path.join(directory, 'cache'), api), requests };
	}

	async function run(target: PreviewStore, names: string[], signal = new AbortController().signal) {
		const ready = new Map<string, PreviewFiles>();
		await target.load(names, signal, (name, files) => ready.set(name, files));
		return ready;
	}

	test('writes a light and a dark file with the right colors', async () => {
		const { store: target } = store();
		const files = (await run(target, ['mdi:home'])).get('mdi:home');
		assert.ok(files);
		assert.strictEqual(path.basename(files.light), 'mdi_home.light.svg');
		assert.ok((await fs.promises.readFile(files.light, 'utf8')).startsWith('<svg color="#424242"'));
		assert.ok((await fs.promises.readFile(files.dark, 'utf8')).startsWith('<svg color="#c5c5c5"'));
	});

	test('icons of one set go in one request, other sets in their own', async () => {
		const { store: target, requests } = store();
		assert.strictEqual((await run(target, ['mdi:a', 'lucide:b', 'mdi:c'])).size, 3);
		assert.deepStrictEqual(
			requests.map((request) => [request.prefix, [...request.names]]).sort(),
			[['lucide', ['b']], ['mdi', ['a', 'c']]]
		);
	});

	test('a large set is split into several requests', async () => {
		const names = Array.from({ length: 120 }, (_, index) => `mdi:i-${index}`);
		const { store: target, requests } = store();
		assert.strictEqual((await run(target, names)).size, 120);
		assert.deepStrictEqual(requests.map((request) => request.names.length).sort((a, b) => a - b), [20, 50, 50]);
	});

	test('cached icons are reported without any request, the rest are fetched', async () => {
		const { store: target, requests } = store();
		await run(target, ['mdi:home']);
		assert.strictEqual((await run(target, ['mdi:home', 'mdi:star'])).size, 2);
		assert.deepStrictEqual(requests.map((request) => [...request.names]), [['home'], ['star']]);
	});

	test('all cached means no request at all', async () => {
		const { store: target, requests } = store();
		await run(target, ['mdi:home']);
		requests.length = 0;
		await run(target, ['mdi:home']);
		assert.deepStrictEqual(requests, []);
	});

	test('icons the server does not return are simply missing', async () => {
		const { store: target } = store(async () => ({ a: SVG }));
		assert.deepStrictEqual([...(await run(target, ['mdi:a', 'mdi:b'])).keys()], ['mdi:a']);
	});

	test('one failing icon set does not stop the others', async () => {
		const { store: target } = store(async (prefix, names) => {
			if (prefix === 'bad') {
				throw new Error('429');
			}
			return everything(prefix, names);
		});
		const ready = await run(target, ['mdi:a', 'bad:x', 'lucide:b']);
		assert.deepStrictEqual([...ready.keys()].sort(), ['lucide:b', 'mdi:a']);
	});

	test('invalid names are skipped and never touch the disk or the network', async () => {
		const { store: target, requests } = store();
		assert.strictEqual((await run(target, ['../evil', 'a:b:c'])).size, 0);
		assert.deepStrictEqual(requests, []);
	});

	test('an aborted signal stops the work', async () => {
		const controller = new AbortController();
		controller.abort();
		const { store: target, requests } = store();
		assert.strictEqual((await run(target, ['mdi:home'], controller.signal)).size, 0);
		assert.deepStrictEqual(requests, []);
	});

	test('aborting midway reports nothing further', async () => {
		const controller = new AbortController();
		const { store: target } = store(async (prefix, names) => {
			controller.abort();
			return everything(prefix, names);
		});
		assert.strictEqual((await run(target, ['mdi:a', 'mdi:b'], controller.signal)).size, 0);
	});

	test('nothing to load is a no-op', async () => {
		const { store: target } = store();
		assert.strictEqual((await run(target, [])).size, 0);
		assert.strictEqual(fs.existsSync(path.join(directory, 'cache')), false);
	});

	test('icons that failed or are missing on the server are not asked again for a while', async () => {
		const { store: target, requests } = store(async (prefix, names) => {
			if (prefix === 'bad') {
				throw new Error('429');
			}
			return everything(prefix, names.filter((name) => name !== 'gone'));
		});
		await run(target, ['bad:x', 'mdi:gone', 'mdi:ok']);
		assert.strictEqual(requests.length, 2);
		await run(target, ['bad:x', 'mdi:gone', 'mdi:ok']);
		assert.strictEqual(requests.length, 2);
		await run(target, ['bad:y']);
		assert.strictEqual(requests.length, 3);
	});

	test('a cancelled request is not remembered as a failure', async () => {
		const controller = new AbortController();
		const { store: target, requests } = store(async () => {
			controller.abort();
			throw new Error('aborted');
		});
		await run(target, ['mdi:a'], controller.signal);
		await run(target, ['mdi:a']);
		assert.strictEqual(requests.length, 2);
	});
});

suite('iconify/previews logging', () => {
	test('a load logs its plan at debug and its outcome at info', async () => {
		const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-previews-log-'));
		try {
			const { lines, logger } = recorder();
			const store = new PreviewStore(directory, { fetchIcons: everything }, logger);
			await store.load(['mdi:a', 'mdi:b'], new AbortController().signal, () => undefined);
			await store.load(['mdi:a'], new AbortController().signal, () => undefined);
			assert.ok(lines.includes('DEBUG previews.load-plan requested=2 cached=0 coolingDown=0 toFetch=2 batches=1'), lines.join('\n'));
			assert.ok(lines.some((line) => line.startsWith('INFO previews.load-done requested=2 cached=0 fetched=2 absent=0 failedBatches=0')), lines.join('\n'));
			assert.ok(lines.some((line) => line.startsWith('INFO previews.load-done requested=1 cached=1 fetched=0')), lines.join('\n'));
		} finally {
			await fs.promises.rm(directory, { recursive: true, force: true });
		}
	});

	test('a failing batch is a warning with the error; an icon the server lacks is debug', async () => {
		const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-previews-log-'));
		try {
			const { lines, logger } = recorder();
			const handler: Handler = async (prefix, names) => {
				if (prefix === 'bad') {
					throw new Error('boom');
				}
				return Object.fromEntries(names.filter((name) => name !== 'gone').map((name) => [name, SVG]));
			};
			const store = new PreviewStore(directory, { fetchIcons: handler }, logger);
			await store.load(['bad:x', 'mdi:gone', 'mdi:here'], new AbortController().signal, () => undefined);
			assert.ok(lines.includes('WARN previews.batch-failed prefix=bad icons=1 error=boom'), lines.join('\n'));
			assert.ok(lines.includes('DEBUG previews.icon-absent icon=mdi:gone'), lines.join('\n'));
			assert.ok(lines.some((line) => line.startsWith('INFO previews.load-done') && line.includes('fetched=1 absent=1 failedBatches=1')), lines.join('\n'));
		} finally {
			await fs.promises.rm(directory, { recursive: true, force: true });
		}
	});

	test('invalid names and an aborted signal are logged with the reason', async () => {
		const { lines, logger } = recorder();
		const store = new PreviewStore(os.tmpdir(), { fetchIcons: everything }, logger);
		await store.load(['NOT VALID'], new AbortController().signal, () => undefined);
		const controller = new AbortController();
		controller.abort();
		await store.load(['mdi:a'], controller.signal, () => undefined);
		assert.deepStrictEqual(lines, [
			'WARN previews.load-invalid-names requested=1 dropped=1',
			'DEBUG previews.load-skipped requested=1 reason=nothing-valid',
			'DEBUG previews.load-skipped requested=1 reason=aborted',
		]);
	});
});

suite('iconify/previews previewDataUri', () => {
	test('picks the file for the theme and resizes it', async () => {
		const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-uri-'));
		try {
			const light = path.join(dir, 'l.svg');
			const dark = path.join(dir, 'd.svg');
			await fs.promises.writeFile(light, '<svg width="24" height="24">L</svg>');
			await fs.promises.writeFile(dark, '<svg width="24" height="24">D</svg>');
			const decode = (uri: string) => Buffer.from(uri.split('base64,')[1], 'base64').toString();
			assert.strictEqual(decode(await previewDataUri({ light, dark }, true, 48)), '<svg width="48" height="48">L</svg>');
			assert.strictEqual(decode(await previewDataUri({ light, dark }, false, 48)), '<svg width="48" height="48">D</svg>');
			await assert.rejects(previewDataUri({ light: path.join(dir, 'none'), dark }, true, 48));
		} finally {
			await fs.promises.rm(dir, { recursive: true, force: true });
		}
	});
});

suite('iconify/previews previewImages', () => {
	async function files(svg: string): Promise<{ dir: string; files: PreviewFiles }> {
		const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-images-'));
		const light = path.join(dir, 'l.svg');
		const dark = path.join(dir, 'd.svg');
		await fs.promises.writeFile(light, svg.replace('X', 'L'));
		await fs.promises.writeFile(dark, svg.replace('X', 'D'));
		return { dir, files: { light, dark } };
	}
	const decode = (uri: string) => Buffer.from(uri.split('base64,')[1], 'base64').toString();

	test('gives both themes and the width that keeps the aspect ratio', async () => {
		const { dir, files: target } = await files('<svg width="48" height="32">X</svg>');
		try {
			const images = await previewImages(target, 16);
			assert.strictEqual(images.width, 24);
			assert.strictEqual(decode(images.light), '<svg width="24" height="16">L</svg>');
			assert.strictEqual(decode(images.dark), '<svg width="24" height="16">D</svg>');
		} finally {
			await fs.promises.rm(dir, { recursive: true, force: true });
		}
	});

	test('falls back to a square when the size cannot be read', async () => {
		const { dir, files: target } = await files('<svg viewBox="0 0 1 1">X</svg>');
		try {
			assert.strictEqual((await previewImages(target, 16)).width, 16);
		} finally {
			await fs.promises.rm(dir, { recursive: true, force: true });
		}
	});
});
