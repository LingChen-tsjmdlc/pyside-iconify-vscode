import * as assert from 'assert';
import { IconifyApi, PAGE_SIZE, type GetText } from '../../iconify/api';
import type { TextCache } from '../../iconify/disk-cache';
import { HttpError } from '../../iconify/http';
import { recorder } from '../recorder';

/** 内存版的磁盘缓存，记录写入。过期时间不模拟，ttl 由 expired 控制。 */
function memoryCache(expired = false): TextCache & { data: Map<string, string>; searchKeys(): string[] } {
	const data = new Map<string, string>();
	return {
		data,
		searchKeys: () => [...data.keys()].filter((key) => key.startsWith('search-')),
		get: async (key) => (expired ? undefined : data.get(key)),
		set: async (key, text) => void data.set(key, text),
	};
}

/**
 * 造一个假的取文本函数，记录收到的地址。
 * 图标集前缀清单的请求单独处理，不进 urls，清单内容由 known 给出。
 */
function fake(
	responses: Record<string, string> | ((url: string) => string),
	known: string[] = []
): { fetch: GetText; urls: string[]; prefixRequests: string[] } {
	const urls: string[] = [];
	const prefixRequests: string[] = [];
	const fetch: GetText = async (url) => {
		if (url.includes('/collections?')) {
			prefixRequests.push(url);
			return JSON.stringify(Object.fromEntries(known.map((prefix) => [prefix, { name: prefix }])));
		}
		urls.push(url);
		const body = typeof responses === 'function' ? responses(url) : responses[url];
		if (body === undefined) {
			throw new Error(`unexpected url ${url}`);
		}
		return body;
	};
	return { fetch, urls, prefixRequests };
}

function icons(count: number, prefix = 'mdi'): string[] {
	return Array.from({ length: count }, (_, index) => `${prefix}:icon-${index}`);
}

suite('iconify/api', () => {
	test('first page asks for limit 50 from 0 and returns names with collections', async () => {
		const { fetch, urls } = fake(() =>
			JSON.stringify({ icons: icons(3), total: 3, collections: { mdi: { name: 'Material Design Icons' } } })
		);
		const result = await new IconifyApi(fetch, 'https://x.test').search('home', 0);
		assert.deepStrictEqual(urls, ['https://x.test/search?query=home&start=0&limit=50']);
		assert.deepStrictEqual(result.icons, icons(3));
		assert.deepStrictEqual(result.collections, { mdi: 'Material Design Icons' });
		assert.strictEqual(result.hasMore, false);
		assert.strictEqual(result.next, 3);
	});

	test('a full page means there may be more, and the next page keeps start below limit', async () => {
		const { fetch, urls } = fake(() => JSON.stringify({ icons: icons(PAGE_SIZE) }));
		const api = new IconifyApi(fetch, 'https://x.test');
		const first = await api.search('home', 0);
		assert.strictEqual(first.hasMore, true);
		await api.search('home', first.next);
		assert.strictEqual(urls[1], 'https://x.test/search?query=home&start=50&limit=100');
	});

	test('encodes the query', async () => {
		const { fetch, urls } = fake(() => JSON.stringify({ icons: [] }));
		await new IconifyApi(fetch, 'https://x.test').search('mdi:home & more', 0);
		assert.ok(urls[0].includes('query=mdi%3Ahome%20%26%20more'));
	});

	test('empty and whitespace queries do not touch the network', async () => {
		const { fetch, urls } = fake(() => {
			throw new Error('should not be called');
		});
		const api = new IconifyApi(fetch);
		for (const query of ['', '   ']) {
			const result = await api.search(query, 0);
			assert.deepStrictEqual(result.icons, []);
			assert.strictEqual(result.hasMore, false);
		}
		assert.deepStrictEqual(urls, []);
	});

	suite('prefix only, such as "mdi:"', () => {
		const names = Array.from({ length: 120 }, (_, index) => `icon-${String(index).padStart(3, '0')}`);
		const collection = JSON.stringify({
			prefix: 'mdi',
			title: 'Material Design Icons',
			uncategorized: names.slice(60).reverse(),
			categories: { Things: names.slice(0, 60), Again: ['icon-000', 'Bad Name'] },
		});

		test('lists the icon set sorted, 50 at a time, with the full name of the set', async () => {
			const { fetch, urls } = fake(() => collection);
			const api = new IconifyApi(fetch, 'https://x.test');
			const first = await api.search('mdi:', 0);
			assert.deepStrictEqual(urls, ['https://x.test/collection?prefix=mdi']);
			assert.strictEqual(first.icons.length, 50);
			assert.deepStrictEqual(first.icons.slice(0, 2), ['mdi:icon-000', 'mdi:icon-001']);
			assert.deepStrictEqual(first.collections, { mdi: 'Material Design Icons' });
			assert.deepStrictEqual([first.hasMore, first.next], [true, 50]);
			const last = await api.search('mdi:', 100);
			assert.deepStrictEqual([last.icons.length, last.hasMore, last.icons[19]], [20, false, 'mdi:icon-119']);
		});

		test('the list is downloaded once for all pages and later searches', async () => {
			const { fetch, urls } = fake(() => collection);
			const api = new IconifyApi(fetch);
			await api.search('mdi:', 0);
			await api.search('MDI:', 50);
			await api.search(' mdi: ', 100);
			assert.strictEqual(urls.length, 1);
		});

		test('an unknown icon set gives an empty result instead of an error', async () => {
			const api = new IconifyApi(async () => {
				throw new HttpError(404);
			});
			const result = await api.search('nope:', 0);
			assert.deepStrictEqual([result.icons, result.hasMore], [[], false]);
		});

		test('a failed download is not cached, so the next try asks again', async () => {
			let fail = true;
			const { fetch, urls } = fake(() => {
				if (fail) {
					throw new Error('offline');
				}
				return collection;
			});
			const api = new IconifyApi(fetch);
			await assert.rejects(api.search('mdi:', 0), /offline/);
			fail = false;
			assert.strictEqual((await api.search('mdi:', 0)).icons.length, 50);
			assert.strictEqual(urls.length, 2);
		});

		test('data of the wrong shape is an error', async () => {
			await assert.rejects(new IconifyApi(fake(() => 'null').fetch).search('mdi:', 0));
		});
	});

	suite('a word that is exactly an icon set prefix, such as "mdi"', () => {
		const collection = JSON.stringify({ title: 'Material Design Icons', uncategorized: ['b', 'a'] });
		const route = (url: string): string => {
			if (url.includes('/collection?')) {
				return collection;
			}
			return JSON.stringify({ icons: ['x:y'] });
		};

		test('lists the icon set, case does not matter, the prefix list is fetched once', async () => {
			const { fetch, urls, prefixRequests } = fake(route, ['mdi', 'ri']);
			const api = new IconifyApi(fetch, 'https://x.test');
			assert.deepStrictEqual((await api.search('mdi', 0)).icons, ['mdi:a', 'mdi:b']);
			assert.deepStrictEqual((await api.search('MDI', 0)).icons, ['mdi:a', 'mdi:b']);
			assert.strictEqual(prefixRequests.length, 1);
			assert.ok(urls.every((url) => url.includes('/collection?prefix=mdi')));
		});

		test('other words are still searched', async () => {
			const { fetch, urls } = fake(route, ['mdi']);
			assert.deepStrictEqual((await new IconifyApi(fetch, 'https://x.test').search('home', 0)).icons, ['x:y']);
			assert.deepStrictEqual(urls, ['https://x.test/search?query=home&start=0&limit=50']);
		});

		test('text that cannot be a prefix does not fetch the prefix list', async () => {
			const { fetch, prefixRequests } = fake(route, ['mdi']);
			await new IconifyApi(fetch).search('mdi:home', 0);
			await new IconifyApi(fetch).search('a b', 0);
			assert.strictEqual(prefixRequests.length, 0);
		});

		test('when the prefix list cannot be fetched it falls back to a normal search, and asks again later', async () => {
			let broken = true;
			const urls: string[] = [];
			const api = new IconifyApi(async (url) => {
				if (url.includes('/collections?')) {
					if (broken) {
						throw new Error('offline');
					}
					return JSON.stringify({ mdi: {} });
				}
				urls.push(url);
				return url.includes('/collection?') ? collection : JSON.stringify({ icons: ['x:y'] });
			});
			assert.deepStrictEqual((await api.search('mdi', 0)).icons, ['x:y']);
			broken = false;
			assert.deepStrictEqual((await api.search('mdi', 0)).icons, ['mdi:a', 'mdi:b']);
		});
	});

	test('a very long query is truncated', async () => {
		const { fetch, urls } = fake(() => JSON.stringify({ icons: [] }));
		await new IconifyApi(fetch, 'https://x.test').search('a'.repeat(500), 0);
		assert.strictEqual(urls[0].split('query=')[1].split('&')[0].length, 100);
	});

	test('stops offering pages at the server limit of 999', async () => {
		const { fetch } = fake(() => JSON.stringify({ icons: icons(PAGE_SIZE) }));
		const api = new IconifyApi(fetch);
		assert.strictEqual((await api.search('a', 940)).hasMore, true);
		assert.strictEqual((await api.search('a', 949)).hasMore, false);
		assert.deepStrictEqual((await api.search('a', 999)).icons, []);
	});

	test('drops names that are not prefix:name, but still counts them for the offset', async () => {
		const raw = ['mdi:home', '../evil', 'MDI:Home', 5, 'a:b:c', 'ok:fine'];
		const { fetch } = fake(() => JSON.stringify({ icons: raw }));
		const result = await new IconifyApi(fetch).search('x', 0);
		assert.deepStrictEqual(result.icons, ['mdi:home', 'ok:fine']);
		assert.strictEqual(result.next, 6);
	});

	test('a response of the wrong shape is an error', async () => {
		const api = new IconifyApi(fake(() => '{"nope":1}').fetch);
		await assert.rejects(api.search('x', 0), /Unexpected response/);
		await assert.rejects(new IconifyApi(fake(() => 'not json').fetch).search('x', 0));
	});

	test('network errors are passed on', async () => {
		const api = new IconifyApi(async () => {
			throw new Error('offline');
		});
		await assert.rejects(api.search('x', 0), /offline/);
	});

	suite('fetchIcons', () => {
		const SET = JSON.stringify({
			prefix: 'mdi',
			width: 24,
			height: 24,
			icons: { home: { body: '<path d="M0 0"/>' }, 'home-outline': { body: '<path d="M1 1"/>' } },
			not_found: ['nope'],
		});

		test('one request per icon set, and returns a standalone svg for each icon', async () => {
			const { fetch, urls } = fake(() => SET);
			const svgs = await new IconifyApi(fetch, 'https://x.test').fetchIcons('mdi', ['home', 'home-outline', 'nope']);
			assert.deepStrictEqual(urls, ['https://x.test/mdi.json?icons=home,home-outline,nope']);
			assert.deepStrictEqual(Object.keys(svgs), ['home', 'home-outline']);
			assert.ok(svgs.home.startsWith('<svg '));
			assert.ok(svgs.home.includes('height="32"'));
		});

		test('drops invalid names and makes no request when none are left', async () => {
			const { fetch, urls } = fake(() => SET);
			const api = new IconifyApi(fetch, 'https://x.test');
			assert.deepStrictEqual(await api.fetchIcons('mdi', ['../x', 'A b']), {});
			assert.deepStrictEqual(await api.fetchIcons('../bad', ['home']), {});
			assert.deepStrictEqual(urls, []);
		});

		test('rejects data that is not an object', async () => {
			await assert.rejects(new IconifyApi(fake(() => 'null').fetch).fetchIcons('mdi', ['home']));
			await assert.rejects(new IconifyApi(fake(() => 'oops').fetch).fetchIcons('mdi', ['home']));
		});
	});

	suite('caching', () => {
		const page = JSON.stringify({ icons: ['mdi:home'], collections: { mdi: { name: 'Material Design Icons' } } });

		test('the same search is asked once, even for a different instance sharing the disk cache', async () => {
			const cache = memoryCache();
			const first = fake(() => page);
			await new IconifyApi(first.fetch, 'https://x.test', cache).search('home', 0);
			await new IconifyApi(first.fetch, 'https://x.test', cache).search('home', 0);
			const again = new IconifyApi(first.fetch, 'https://x.test', cache);
			assert.deepStrictEqual((await again.search('home', 0)).icons, ['mdi:home']);
			assert.strictEqual(first.urls.length, 1);
			assert.strictEqual(cache.searchKeys().length, 1);
		});

		test('the memory cache serves repeats without touching disk or network', async () => {
			const { fetch, urls } = fake(() => page);
			const api = new IconifyApi(fetch);
			await api.search('home', 0);
			await api.search('home', 0);
			assert.strictEqual(urls.length, 1);
		});

		test('different pages and different words are different entries', async () => {
			const { fetch, urls } = fake(() => page);
			const api = new IconifyApi(fetch);
			await api.search('home', 0);
			await api.search('home', 50);
			await api.search('house', 0);
			assert.strictEqual(urls.length, 3);
		});

		test('an expired disk entry is fetched again and replaced', async () => {
			const cache = memoryCache(true);
			const { fetch, urls } = fake(() => page);
			await new IconifyApi(fetch, 'https://x.test', cache).search('home', 0);
			assert.strictEqual(urls.length, 1);
			assert.strictEqual(cache.searchKeys().length, 1);
		});

		test('a damaged disk entry is ignored, and a bad server answer is never stored', async () => {
			const cache = memoryCache();
			const { fetch, urls } = fake(() => page);
			await new IconifyApi(fetch, 'https://x.test', cache).search('home', 0);
			const [key] = cache.searchKeys();
			cache.data.set(key, '{"nope":true}');
			assert.deepStrictEqual((await new IconifyApi(fetch, 'https://x.test', cache).search('home', 0)).icons, ['mdi:home']);
			assert.strictEqual(urls.length, 2);

			const bad = memoryCache();
			await assert.rejects(new IconifyApi(fake(() => '{"nope":1}').fetch, 'https://x.test', bad).search('home', 0));
			assert.strictEqual(bad.searchKeys().length, 0);
		});

		test('failures are not cached', async () => {
			const cache = memoryCache();
			let fail = true;
			const { fetch } = fake(() => {
				if (fail) {
					throw new Error('offline');
				}
				return page;
			});
			const api = new IconifyApi(fetch, 'https://x.test', cache);
			await assert.rejects(api.search('home', 0));
			fail = false;
			assert.deepStrictEqual((await api.search('home', 0)).icons, ['mdi:home']);
		});

		test('the prefix list and an icon set list are kept on disk too', async () => {
			const cache = memoryCache();
			const collection = JSON.stringify({ title: 'T', uncategorized: ['a'] });
			const route = (url: string): string => (url.includes('/collection?') ? collection : '{}');
			const first = fake(route, ['mdi']);
			await new IconifyApi(first.fetch, 'https://x.test', cache).search('mdi', 0);
			assert.deepStrictEqual([...cache.data.keys()].sort(), ['collection-mdi', 'collections']);
			const second = fake(route, ['mdi']);
			assert.deepStrictEqual((await new IconifyApi(second.fetch, 'https://x.test', cache).search('mdi:', 0)).icons, ['mdi:a']);
			assert.deepStrictEqual([second.urls, second.prefixRequests], [[], []]);
		});
	});

	suite('logging', () => {
		const page = JSON.stringify({ icons: ['mdi:home'], collections: { mdi: { name: 'Material Design Icons' } } });

		test('a search logs its route at debug and its result at info', async () => {
			const { lines, logger } = recorder();
			await new IconifyApi(fake(() => page).fetch, 'https://x.test', undefined, logger).search('home', 0);
			assert.ok(lines.some((line) => line.startsWith('DEBUG api.search-route') && line.includes('route=search')), lines.join('\n'));
			assert.ok(lines.some((line) => line.startsWith('INFO api.search-done') && line.includes('icons=1')), lines.join('\n'));
		});

		test('a repeat is logged as a memory hit', async () => {
			const { lines, logger } = recorder();
			const api = new IconifyApi(fake(() => page).fetch, 'https://x.test', undefined, logger);
			await api.search('home', 0);
			await api.search('home', 0);
			assert.ok(lines.some((line) => line.startsWith('DEBUG api.search-memory-hit')));
		});

		test('a failed search is logged as a warning with the error, then rethrown', async () => {
			const { lines, logger } = recorder();
			const api = new IconifyApi(
				fake(() => {
					throw new Error('offline');
				}).fetch,
				'https://x.test',
				undefined,
				logger
			);
			await assert.rejects(api.search('home', 0));
			assert.ok(lines.some((line) => line.startsWith('WARN api.search-failed') && line.includes('error=offline')), lines.join('\n'));
		});

		test('a damaged disk entry is logged as a warning, an invalid answer as an error', async () => {
			const cache = memoryCache();
			const { lines, logger } = recorder();
			await new IconifyApi(fake(() => page).fetch, 'https://x.test', cache, logger).search('home', 0);
			cache.data.set(cache.searchKeys()[0], '{"nope":true}');
			await new IconifyApi(fake(() => page).fetch, 'https://x.test', cache, logger).search('home', 0);
			assert.ok(lines.some((line) => line.startsWith('WARN api.disk-cache-corrupt')), lines.join('\n'));

			const bad = recorder();
			await assert.rejects(new IconifyApi(fake(() => '{"nope":1}').fetch, 'https://x.test', undefined, bad.logger).search('home', 0));
			assert.ok(bad.lines.some((line) => line.startsWith('ERROR api.response-invalid')), bad.lines.join('\n'));
		});

		test('listing an icon set logs the load once and later pages hit memory', async () => {
			const { lines, logger } = recorder();
			const collection = JSON.stringify({ title: 'T', uncategorized: ['a', 'b'] });
			const api = new IconifyApi(fake((url) => (url.includes('/collection?') ? collection : '{}'), ['mdi']).fetch, 'https://x.test', undefined, logger);
			await api.search('mdi:', 0);
			await api.search('mdi:', 1);
			assert.strictEqual(lines.filter((line) => line.startsWith('INFO api.collection-loaded')).length, 1);
			assert.ok(lines.some((line) => line.startsWith('DEBUG api.collection-memory-hit')));
		});
	});
});
