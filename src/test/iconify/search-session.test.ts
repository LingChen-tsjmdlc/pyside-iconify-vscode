import * as assert from 'assert';
import type { SearchResult } from '../../iconify/api';
import { SearchSession, type SearchSource } from '../../iconify/search-session';

function page(icons: string[], next: number, hasMore: boolean, collections: Record<string, string> = {}): SearchResult {
	return { icons, next, hasMore, collections };
}

/** 每次调用 search 都由测试手动放行，用来制造"请求还在路上"的状态。 */
function manual(): { source: SearchSource; calls: Array<{ query: string; start: number; reply: (r: SearchResult) => void; fail: (e: Error) => void }> } {
	const calls: Array<{ query: string; start: number; reply: (r: SearchResult) => void; fail: (e: Error) => void }> = [];
	const source: SearchSource = {
		search: (query, start) =>
			new Promise<SearchResult>((resolve, reject) => {
				calls.push({ query, start, reply: resolve, fail: reject });
			}),
	};
	return { source, calls };
}

suite('iconify/search-session', () => {
	test('start loads the first page', async () => {
		const session = new SearchSession({ search: async () => page(['a:1', 'a:2'], 2, false, { a: 'Set A' }) });
		assert.strictEqual(await session.start('x'), true);
		assert.deepStrictEqual([...session.icons], ['a:1', 'a:2']);
		assert.deepStrictEqual(session.collections, { a: 'Set A' });
		assert.strictEqual(session.hasMore, false);
		assert.strictEqual(session.query, 'x');
	});

	test('loadMore appends the next page from the stored offset and skips duplicates', async () => {
		const starts: number[] = [];
		const pages = [page(['a:1', 'a:2'], 2, true, { a: 'A' }), page(['a:2', 'b:3'], 4, false, { b: 'B' })];
		const session = new SearchSession({
			search: async (_query, start) => {
				starts.push(start);
				return pages[starts.length - 1];
			},
		});
		await session.start('x');
		assert.strictEqual(session.hasMore, true);
		assert.deepStrictEqual(await session.loadMore(), ['b:3']);
		assert.deepStrictEqual(starts, [0, 2]);
		assert.deepStrictEqual([...session.icons], ['a:1', 'a:2', 'b:3']);
		assert.deepStrictEqual(session.collections, { a: 'A', b: 'B' });
		assert.strictEqual(session.hasMore, false);
	});

	test('loadMore without a next page does nothing', async () => {
		let calls = 0;
		const session = new SearchSession({
			search: async () => {
				calls += 1;
				return page(['a:1'], 1, false);
			},
		});
		await session.start('x');
		assert.deepStrictEqual(await session.loadMore(), []);
		assert.strictEqual(calls, 1);
	});

	test('starting a new query clears old results at once', async () => {
		const { source, calls } = manual();
		const session = new SearchSession(source);
		const first = session.start('one');
		calls[0].reply(page(['a:1'], 1, true));
		await first;
		const second = session.start('two');
		assert.deepStrictEqual([...session.icons], []);
		assert.strictEqual(session.hasMore, false);
		assert.strictEqual(session.query, 'two');
		calls[1].reply(page(['b:1'], 1, false));
		await second;
		assert.deepStrictEqual([...session.icons], ['b:1']);
	});

	test('a slow answer to an old query is dropped', async () => {
		const { source, calls } = manual();
		const session = new SearchSession(source);
		const old = session.start('one');
		const current = session.start('two');
		calls[1].reply(page(['b:1'], 1, false));
		assert.strictEqual(await current, true);
		calls[0].reply(page(['a:1'], 1, false));
		assert.strictEqual(await old, false);
		assert.deepStrictEqual([...session.icons], ['b:1']);
		assert.strictEqual(session.query, 'two');
	});

	test('a page that arrives after the query changed is dropped', async () => {
		const { source, calls } = manual();
		const session = new SearchSession(source);
		const first = session.start('one');
		calls[0].reply(page(['a:1'], 1, true));
		await first;
		const more = session.loadMore();
		const second = session.start('two');
		assert.strictEqual(calls.length, 3);
		calls[2].reply(page(['b:1'], 1, false));
		await second;
		calls[1].reply(page(['a:2'], 2, false));
		assert.deepStrictEqual(await more, []);
		assert.deepStrictEqual([...session.icons], ['b:1']);
	});

	test('a failed page keeps what was already loaded and can be retried', async () => {
		let fail = true;
		const session = new SearchSession({
			search: async (_query, start) => {
				if (start === 0) {
					return page(['a:1'], 1, true);
				}
				if (fail) {
					throw new Error('offline');
				}
				return page(['a:2'], 2, false);
			},
		});
		await session.start('x');
		await assert.rejects(session.loadMore(), /offline/);
		assert.deepStrictEqual([...session.icons], ['a:1']);
		assert.strictEqual(session.hasMore, true);
		fail = false;
		assert.deepStrictEqual(await session.loadMore(), ['a:2']);
	});
});
