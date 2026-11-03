import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DiskCache } from '../../iconify/disk-cache';
import { recorder } from '../recorder';

suite('iconify/disk-cache', () => {
	let directory: string;

	setup(async () => {
		directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pyside-iconify-disk-'));
	});

	teardown(async () => {
		await fs.promises.rm(directory, { recursive: true, force: true });
	});

	test('what was written can be read back, also by a new instance', async () => {
		const dir = path.join(directory, 'sub');
		await new DiskCache(dir).set('a-1', '{"x":1}');
		assert.strictEqual(await new DiskCache(dir).get('a-1', 60_000), '{"x":1}');
	});

	test('a missing key gives undefined', async () => {
		assert.strictEqual(await new DiskCache(directory).get('nope', 60_000), undefined);
	});

	test('an entry older than the limit is ignored', async () => {
		const cache = new DiskCache(directory);
		await cache.set('old', 'x');
		const past = new Date(Date.now() - 10_000);
		await fs.promises.utimes(path.join(directory, 'old.json'), past, past);
		assert.strictEqual(await cache.get('old', 5_000), undefined);
		assert.strictEqual(await cache.get('old', 60_000), 'x');
	});

	test('keys that could leave the directory are refused', async () => {
		const cache = new DiskCache(path.join(directory, 'inner'));
		await cache.set('../escape', 'x');
		assert.strictEqual(await cache.get('../escape', 60_000), undefined);
		assert.strictEqual(fs.existsSync(path.join(directory, 'escape.json')), false);
	});

	test('writing to an impossible place does not throw', async () => {
		const blocker = path.join(directory, 'file');
		await fs.promises.writeFile(blocker, '');
		await new DiskCache(path.join(blocker, 'dir')).set('a', 'x');
	});

	test('prune removes only old files and tolerates a missing directory', async () => {
		const cache = new DiskCache(directory);
		await cache.set('keep', 'x');
		await cache.set('drop', 'x');
		const past = new Date(Date.now() - 100_000);
		await fs.promises.utimes(path.join(directory, 'drop.json'), past, past);
		await cache.prune(50_000);
		assert.deepStrictEqual(await fs.promises.readdir(directory), ['keep.json']);
		await new DiskCache(path.join(directory, 'none')).prune(1);
	});

	suite('logging', () => {
		test('hit, miss with a reason, and store are logged at debug', async () => {
			const { lines, logger } = recorder();
			const cache = new DiskCache(directory, logger);
			await cache.get('k', 60_000);
			await cache.set('k', 'abc');
			await cache.get('k', 60_000);
			const past = new Date(Date.now() - 10_000);
			await fs.promises.utimes(path.join(directory, 'k.json'), past, past);
			await cache.get('k', 5_000);
			assert.deepStrictEqual(lines, [
				'DEBUG cache.miss key=k reason=absent',
				'DEBUG cache.stored key=k bytes=3',
				'DEBUG cache.hit key=k bytes=3',
				'DEBUG cache.miss key=k reason=expired ageDays=0',
			]);
		});

		test('an unsafe key is a warning, a write that cannot happen is a warning', async () => {
			const { lines, logger } = recorder();
			await new DiskCache(directory, logger).get('../x', 1);
			await new DiskCache(directory, logger).set('../x', 'x');
			const blocker = path.join(directory, 'file');
			await fs.promises.writeFile(blocker, '');
			await new DiskCache(path.join(blocker, 'dir'), logger).set('a', 'x');
			assert.deepStrictEqual(lines.slice(0, 2), ['WARN cache.get-rejected key=../x reason=unsafe-key', 'WARN cache.set-rejected key=../x reason=unsafe-key']);
			assert.ok(lines[2].startsWith('WARN cache.write-failed key=a error='), lines[2]);
		});

		test('prune reports what it kept and removed, and a missing directory is only debug', async () => {
			const { lines, logger } = recorder();
			const cache = new DiskCache(directory, logger);
			await cache.set('keep', 'x');
			await cache.set('drop', 'x');
			const past = new Date(Date.now() - 100_000);
			await fs.promises.utimes(path.join(directory, 'drop.json'), past, past);
			lines.length = 0;
			await cache.prune(50_000);
			await new DiskCache(path.join(directory, 'none'), logger).prune(1);
			assert.deepStrictEqual(lines, ['INFO cache.pruned kept=1 removed=1', 'DEBUG cache.prune-skipped reason=no-directory kept=0 removed=0']);
		});
	});
});
