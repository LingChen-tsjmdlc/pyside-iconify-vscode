import type { SearchResult } from './api';

/** 搜索会话只需要接口的 search 方法，测试里换成假的。 */
export interface SearchSource {
	search(query: string, start: number, signal?: AbortSignal): Promise<SearchResult>;
}

/**
 * 一次搜索框打开期间的结果状态：当前搜索词、已加载的图标、是否还有下一页。
 * 不依赖 vscode，方便单独测试；防抖和界面刷新由调用方负责。
 */
export class SearchSession {
	private found: string[] = [];
	private names: Record<string, string> = {};
	private more = false;
	private offset = 0;
	private text = '';
	/** 每次 start 加一；等待网络期间搜索词变了，旧请求的结果就丢弃。 */
	private generation = 0;

	constructor(private readonly source: SearchSource) {}

	/** 当前搜索词。 */
	get query(): string {
		return this.text;
	}

	/** 已加载的全部图标名，按服务器返回的顺序，不重复。 */
	get icons(): readonly string[] {
		return this.found;
	}

	/** 后面是否可能还有结果。 */
	get hasMore(): boolean {
		return this.more;
	}

	/** 图标集前缀到全名的映射，如 mdi -> Material Design Icons。 */
	get collections(): Readonly<Record<string, string>> {
		return this.names;
	}

	/**
	 * 换一个搜索词，丢掉旧结果并取第一页。
	 *
	 * @param query 新的搜索词。
	 * @param signal 取消信号。
	 * @returns 是否应用了结果；中途又有新的 start 时为 false。
	 */
	async start(query: string, signal?: AbortSignal): Promise<boolean> {
		const generation = ++this.generation;
		this.text = query;
		this.found = [];
		this.names = {};
		this.more = false;
		this.offset = 0;
		const result = await this.source.search(query, 0, signal);
		return this.apply(generation, result);
	}

	/**
	 * 取下一页并接在已有结果后面。没有下一页时什么也不做。
	 *
	 * @param signal 取消信号。
	 * @returns 新增的图标名；结果被丢弃时为空数组。
	 */
	async loadMore(signal?: AbortSignal): Promise<string[]> {
		if (!this.more) {
			return [];
		}
		const generation = this.generation;
		const before = this.found.length;
		const result = await this.source.search(this.text, this.offset, signal);
		return this.apply(generation, result) ? this.found.slice(before) : [];
	}

	private apply(generation: number, result: SearchResult): boolean {
		if (generation !== this.generation) {
			return false;
		}
		const known = new Set(this.found);
		for (const icon of result.icons) {
			if (!known.has(icon)) {
				known.add(icon);
				this.found.push(icon);
			}
		}
		this.names = { ...this.names, ...result.collections };
		this.offset = result.next;
		this.more = result.hasMore;
		return true;
	}
}
