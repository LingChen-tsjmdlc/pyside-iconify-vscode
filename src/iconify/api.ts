import { buildSvgs } from '../core/iconset';
import { errorText, NULL_LOGGER, scoped, stopwatch, type Logger, type ScopedLog } from '../core/log';
import { isValidIconName } from '../core/rules';
import { createHash } from 'crypto';
import type { TextCache } from './disk-cache';
import { getText, HttpError, type RequestOptions } from './http';

/** 一页的条数。 */
export const PAGE_SIZE = 50;
/** Iconify 搜索接口 limit 的下限与上限。 */
const MIN_LIMIT = 32;
const MAX_LIMIT = 999;
/** 搜索词过长没有意义，截断后再发。 */
const MAX_QUERY_LENGTH = 100;

/** 取文本的函数，测试里换成假的。 */
export type GetText = (url: string, options?: RequestOptions) => Promise<string>;

/** 一页搜索结果。 */
export interface SearchResult {
	/** 本页的图标名，都已通过 "prefix:name" 格式校验。 */
	icons: string[];
	/** 下一页的起始偏移。 */
	next: number;
	/** 后面是否可能还有结果。 */
	hasMore: boolean;
	/** 图标集前缀到其全名的映射，如 mdi -> Material Design Icons。 */
	collections: Record<string, string>;
}

const EMPTY: SearchResult = { icons: [], next: 0, hasMore: false, collections: {} };

/** 整个图标集的名字列表（可能上万条，体积较大）的响应上限。 */
const COLLECTION_MAX_BYTES = 20_000_000;
/** 内存里最多缓存几个图标集的名字列表。 */
const COLLECTION_CACHE_SIZE = 12;
/** 内存里最多缓存多少个搜索结果页。 */
const SEARCH_CACHE_SIZE = 300;
const DAY_MS = 86_400_000;
/** 磁盘缓存的有效期：图标集清单和名字列表变化很慢，搜索结果稍短。 */
const LIST_TTL_MS = 30 * DAY_MS;
const SEARCH_TTL_MS = 14 * DAY_MS;

/** 只写了图标集前缀、还没写关键字，如 "mdi:"；返回小写前缀，不是则返回 undefined。 */
function prefixOnly(text: string): string | undefined {
	const match = /^([a-z0-9-]+):$/i.exec(text);
	return match ? match[1].toLowerCase() : undefined;
}

interface CollectionList {
	title: string;
	/** 按字母排序、不含前缀的图标名。 */
	names: string[];
}

/** Iconify 公共接口的调用；扩展里唯一联网的入口。 */
export class IconifyApi {
	private readonly collectionCache = new Map<string, Promise<CollectionList | undefined>>();
	private readonly searchCache = new Map<string, SearchResult>();
	private prefixes: Promise<Set<string> | undefined> | undefined;
	private readonly log: ScopedLog;

	/**
	 * @param fetchText 取文本的函数，测试里换成假的。
	 * @param baseUrl 接口地址。
	 * @param cache 磁盘缓存；不给则只有内存缓存。
	 * @param logger 日志。
	 */
	constructor(
		private readonly fetchText: GetText = getText,
		private readonly baseUrl = 'https://api.iconify.design',
		private readonly cache?: TextCache,
		logger: Logger = NULL_LOGGER
	) {
		this.log = scoped(logger, 'api');
	}

	/**
	 * 搜索图标。支持三种写法：
	 * "关键字"、"前缀:关键字"（如 mdi:home）走搜索接口；只写 "前缀:"（如 mdi:），
	 * 或关键字恰好是某个图标集的前缀（如 mdi），列出该图标集全部图标，按字母排序。
	 * 搜索接口要求 start 小于 limit，所以第 N 页写成 start=(N-1)*50、limit=N*50。
	 *
	 * @param query 搜索词。
	 * @param start 从第几条开始，0 起。
	 * @param signal 取消信号。
	 */
	async search(query: string, start: number, signal?: AbortSignal): Promise<SearchResult> {
		const text = query.trim().slice(0, MAX_QUERY_LENGTH);
		if (text === '') {
			this.log.debug('search-empty', { start });
			return EMPTY;
		}
		const elapsed = stopwatch();
		const prefix = prefixOnly(text) ?? (await this.exactPrefix(text));
		if (prefix !== undefined) {
			this.log.debug('search-route', { query: text, start, route: 'collection', prefix });
			const listed = await this.listCollection(prefix, start);
			this.log.info('search-done', { query: text, start, route: 'collection', icons: listed.icons.length, hasMore: listed.hasMore, ms: elapsed() });
			return listed;
		}
		const limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, start + PAGE_SIZE));
		if (start >= limit) {
			this.log.warn('search-limit', { query: text, start, limit });
			return EMPTY;
		}
		const key = `${text}\n${start}`;
		const known = this.searchCache.get(key);
		if (known) {
			this.log.debug('search-memory-hit', { query: text, start, icons: known.icons.length });
			return known;
		}
		this.log.debug('search-route', { query: text, start, route: 'search', limit });
		const url = `${this.baseUrl}/search?query=${encodeURIComponent(text)}&start=${start}&limit=${limit}`;
		let result: SearchResult;
		try {
			result = await this.cachedJson(`search-${hash(key)}`, url, SEARCH_TTL_MS, { signal }, (data) => parseSearch(data, start));
		} catch (error) {
			this.log.warn('search-failed', { query: text, start, error: errorText(error), ms: elapsed() });
			throw error;
		}
		this.searchCache.set(key, result);
		if (this.searchCache.size > SEARCH_CACHE_SIZE) {
			this.searchCache.delete(this.searchCache.keys().next().value as string);
			this.log.debug('search-memory-evict', { size: this.searchCache.size });
		}
		this.log.info('search-done', { query: text, start, route: 'search', icons: result.icons.length, hasMore: result.hasMore, ms: elapsed() });
		return result;
	}

	/**
	 * 取 JSON：先看磁盘缓存，没有再联网。只有通过 parse 校验的联网结果才会写入缓存，损坏的缓存会被忽略。
	 *
	 * @param key 缓存键。
	 * @param url 地址。
	 * @param ttlMs 缓存有效期。
	 * @param options 请求选项。
	 * @param parse 校验并转换数据，数据不合格时抛错。
	 */
	private async cachedJson<T>(key: string, url: string, ttlMs: number, options: RequestOptions, parse: (data: unknown) => T): Promise<T> {
		const stored = await this.cache?.get(key, ttlMs);
		if (stored !== undefined) {
			try {
				const value = parse(JSON.parse(stored));
				this.log.debug('disk-cache-hit', { key });
				return value;
			} catch (error) {
				// 缓存损坏，改为联网
				this.log.warn('disk-cache-corrupt', { key, error: errorText(error) });
			}
		}
		const text = await this.fetchText(url, options);
		let value: T;
		try {
			value = parse(JSON.parse(text));
		} catch (error) {
			this.log.error('response-invalid', { key, bytes: text.length, error: errorText(error) });
			throw error;
		}
		void this.cache?.set(key, text);
		return value;
	}

	/** 搜索词恰好是某个图标集的前缀（如 mdi）时返回小写前缀；清单取不到时按普通关键字处理。 */
	private async exactPrefix(text: string): Promise<string | undefined> {
		if (!/^[a-z0-9-]+$/i.test(text)) {
			return undefined;
		}
		const known = await this.knownPrefixes();
		const lower = text.toLowerCase();
		if (!known) {
			this.log.debug('prefix-unknown', { query: text, reason: 'list-unavailable' });
		}
		return known?.has(lower) ? lower : undefined;
	}

	/** 全部图标集的前缀清单，取一次后缓存；失败返回 undefined 且不缓存。 */
	private knownPrefixes(): Promise<Set<string> | undefined> {
		this.prefixes ??= this.loadPrefixes().then(
			(set) => {
				this.log.info('prefixes-loaded', { count: set.size });
				return set;
			},
			(error: unknown) => {
				this.log.warn('prefixes-failed', { error: errorText(error) });
				this.prefixes = undefined;
				return undefined;
			}
		);
		return this.prefixes;
	}

	private async loadPrefixes(): Promise<Set<string>> {
		return this.cachedJson('collections', `${this.baseUrl}/collections?pretty=0`, LIST_TTL_MS, {}, (data) => {
			if (typeof data !== 'object' || data === null) {
				throw new Error('Unexpected collections data.');
			}
			return new Set(Object.keys(data).filter((prefix) => isValidIconName(`${prefix}:x`)));
		});
	}

	/** 列出一个图标集的一页图标；图标集不存在时返回空结果。 */
	private async listCollection(prefix: string, start: number): Promise<SearchResult> {
		const list = await this.collection(prefix);
		if (!list) {
			this.log.warn('collection-missing', { prefix });
			return EMPTY;
		}
		const names = list.names.slice(start, start + PAGE_SIZE);
		const next = start + names.length;
		return {
			icons: names.map((name) => `${prefix}:${name}`),
			next,
			hasMore: next < list.names.length,
			collections: { [prefix]: list.title },
		};
	}

	/** 取图标集的名字列表并缓存；失败不缓存，下次重试。下载被多次搜索共用，所以不绑定取消信号。 */
	private collection(prefix: string): Promise<CollectionList | undefined> {
		const cached = this.collectionCache.get(prefix);
		if (cached) {
			this.log.debug('collection-memory-hit', { prefix });
			return cached;
		}
		const elapsed = stopwatch();
		const pending = this.loadCollection(prefix);
		this.collectionCache.set(prefix, pending);
		if (this.collectionCache.size > COLLECTION_CACHE_SIZE) {
			this.collectionCache.delete(this.collectionCache.keys().next().value as string);
			this.log.debug('collection-memory-evict', { size: this.collectionCache.size });
		}
		pending.then(
			(list) => this.log.info('collection-loaded', { prefix, icons: list?.names.length, ms: elapsed() }),
			(error: unknown) => {
				this.log.warn('collection-failed', { prefix, error: errorText(error), ms: elapsed() });
				this.collectionCache.delete(prefix);
			}
		);
		return pending;
	}

	private async loadCollection(prefix: string): Promise<CollectionList | undefined> {
		if (!isValidIconName(`${prefix}:x`)) {
			return undefined;
		}
		try {
			return await this.cachedJson(`collection-${prefix}`, `${this.baseUrl}/collection?prefix=${prefix}`, LIST_TTL_MS, { maxBytes: COLLECTION_MAX_BYTES }, (data) => parseCollection(data, prefix));
		} catch (error) {
			if (error instanceof HttpError && error.status === 404) {
				return undefined;
			}
			throw error;
		}
	}

	/**
	 * 一次取同一个图标集里若干图标的 SVG（比逐个请求快得多，也不易被限流）。
	 * 高度固定为 32 像素；服务器没有的图标不会出现在结果里。
	 *
	 * @param prefix 图标集前缀，如 mdi。
	 * @param names 该图标集里的图标名，不含前缀。
	 * @param signal 取消信号。
	 * @returns 图标名到 SVG 文本的映射。
	 */
	async fetchIcons(prefix: string, names: readonly string[], signal?: AbortSignal): Promise<Record<string, string>> {
		const valid = names.filter((name) => isValidIconName(`${prefix}:${name}`));
		if (valid.length !== names.length) {
			this.log.warn('icons-invalid-names', { prefix, dropped: names.length - valid.length });
		}
		if (valid.length === 0) {
			return {};
		}
		const elapsed = stopwatch();
		const data: unknown = JSON.parse(await this.fetchText(`${this.baseUrl}/${prefix}.json?icons=${valid.join(',')}`, { signal }));
		if (typeof data !== 'object' || data === null) {
			this.log.error('icons-invalid', { prefix, requested: valid.length });
			throw new Error(`Unexpected icon data for ${prefix}.`);
		}
		const svgs = buildSvgs(data, valid);
		this.log.info('icons-fetched', { prefix, requested: valid.length, returned: Object.keys(svgs).length, ms: elapsed() });
		return svgs;
	}
}

function hash(text: string): string {
	return createHash('sha1').update(text).digest('hex');
}

function parseSearch(data: unknown, start: number): SearchResult {
	if (typeof data !== 'object' || data === null || !Array.isArray((data as { icons?: unknown }).icons)) {
		throw new Error('Unexpected response from the Iconify API.');
	}
	const { icons, collections } = data as { icons: unknown[]; collections?: unknown };
	const valid = icons.filter((item): item is string => typeof item === 'string' && isValidIconName(item));
	// 偏移按服务器返回的原始条数算，被过滤掉的非法名字也占位
	const next = start + icons.length;
	return { icons: valid, next, hasMore: icons.length >= PAGE_SIZE && next < MAX_LIMIT, collections: readCollectionNames(collections) };
}

function parseCollection(data: unknown, prefix: string): CollectionList {
	if (typeof data !== 'object' || data === null) {
		throw new Error(`Unexpected collection data for ${prefix}.`);
	}
	const { title, uncategorized, categories } = data as { title?: unknown; uncategorized?: unknown; categories?: unknown };
	const found = new Set<string>();
	const add = (value: unknown): void => {
		if (Array.isArray(value)) {
			for (const name of value) {
				if (typeof name === 'string' && isValidIconName(`${prefix}:${name}`)) {
					found.add(name);
				}
			}
		}
	};
	add(uncategorized);
	if (typeof categories === 'object' && categories !== null) {
		Object.values(categories).forEach(add);
	}
	return { title: typeof title === 'string' ? title : prefix, names: [...found].sort() };
}

function readCollectionNames(value: unknown): Record<string, string> {
	const names: Record<string, string> = {};
	if (typeof value === 'object' && value !== null) {
		for (const [prefix, info] of Object.entries(value)) {
			const title = (info as { name?: unknown } | null)?.name;
			if (typeof title === 'string') {
				names[prefix] = title;
			}
		}
	}
	return names;
}
