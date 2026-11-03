import * as fs from 'fs';
import * as path from 'path';
import { errorText, NULL_LOGGER, scoped, stopwatch, type Logger, type ScopedLog } from '../core/log';
import { PREVIEW_COLORS, resizeSvg, tintSvg } from '../core/preview';
import { isValidIconName } from '../core/rules';

/** 一个图标在浅色、深色主题下各自的预览文件路径。 */
export interface PreviewFiles {
	light: string;
	dark: string;
}

/** 同时发出的请求数；按图标集批量取之后请求很少，不需要太多。 */
const CONCURRENCY = 4;
/** 一个请求最多带多少个图标，避免地址过长。 */
const BATCH_SIZE = 50;
/** 取预览失败或服务器没有的图标，隔多久才再试，单位毫秒。 */
const RETRY_AFTER_MS = 10 * 60_000;

/**
 * 把预览文件读成可嵌入 Markdown 图片的数据地址，并放大到指定高度。
 *
 * @param files 预览文件。
 * @param light 是否取浅色主题那份。
 * @param height 显示高度，单位像素。
 */
export async function previewDataUri(files: PreviewFiles, light: boolean, height: number): Promise<string> {
	const svg = await fs.promises.readFile(light ? files.light : files.dark, 'utf8');
	return toDataUri(resizeSvg(svg, height));
}

function toDataUri(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/** 浅色和深色主题各一份的数据地址，加上按比例算出的显示宽度。 */
export interface PreviewImages {
	light: string;
	dark: string;
	/** 显示宽度，单位像素；读不出比例时等于高度。 */
	width: number;
}

/**
 * 把预览文件读成浅色、深色两份数据地址，并给出放大到指定高度后的宽度，用于行内图标。
 *
 * @param files 预览文件。
 * @param height 显示高度，单位像素。
 */
export async function previewImages(files: PreviewFiles, height: number): Promise<PreviewImages> {
	const [light, dark] = (await Promise.all([files.light, files.dark].map((file) => fs.promises.readFile(file, 'utf8')))).map(
		(svg) => resizeSvg(svg, height)
	);
	const width = Number(/<svg\b[^>]*?\swidth="([\d.]+)"/.exec(light)?.[1]);
	return { light: toDataUri(light), dark: toDataUri(dark), width: Number.isFinite(width) && width > 0 ? width : height };
}

function exists(file: string): Promise<boolean> {
	return fs.promises.access(file).then(
		() => true,
		() => false
	);
}

let tempCounter = 0;

/**
 * 先写临时文件再改名，别的请求读到的要么没有文件，要么是完整文件，不会读到写了一半的。
 * 补全和悬停可能同时在准备同一个图标。
 */
async function writeAtomically(file: string, content: string): Promise<void> {
	const temporary = `${file}.${process.pid}.${tempCounter++}.tmp`;
	try {
		await fs.promises.writeFile(temporary, content);
		await fs.promises.rename(temporary, file);
	} catch (error) {
		await fs.promises.rm(temporary, { force: true });
		throw error;
	}
}

/** 按前缀分组："mdi:home" -> { mdi: ["home"] }。 */
function groupByPrefix(names: readonly string[]): Map<string, string[]> {
	const groups = new Map<string, string[]>();
	for (const name of names) {
		const colon = name.indexOf(':');
		const prefix = name.slice(0, colon);
		const list = groups.get(prefix) ?? [];
		list.push(name.slice(colon + 1));
		groups.set(prefix, list);
	}
	return groups;
}

/**
 * 把图标预览缓存成本地 SVG 文件，供 Quick Pick 的 iconPath 使用。
 * 一个图标只下载一次；没缓存的图标按图标集合并成一次请求。
 */
export class PreviewStore {
	/** 最近取不到预览的图标及失败时间，一段时间内不再请求。 */
	private readonly failed = new Map<string, number>();
	private readonly log: ScopedLog;

	/**
	 * @param directory 缓存目录，不存在时会创建。
	 * @param api 只需要 fetchIcons，测试里换成假的。
	 * @param logger 日志。
	 */
	constructor(
		private readonly directory: string,
		private readonly api: {
			fetchIcons(prefix: string, names: readonly string[], signal?: AbortSignal): Promise<Record<string, string>>;
		},
		logger: Logger = NULL_LOGGER
	) {
		this.log = scoped(logger, 'previews');
	}

	/**
	 * 准备一批图标的预览，每准备好一个就回调一次：已缓存的先回调，其余随网络返回陆续回调。
	 * 单个图标或单个图标集失败只是没有预览，不影响其余。
	 *
	 * @param names "prefix:name" 格式的图标名；格式不对的会被略过。
	 * @param signal 取消信号，取消后不再发请求、不再回调。
	 * @param onReady 某个图标的预览文件就绪时调用。
	 */
	async load(
		names: readonly string[],
		signal: AbortSignal,
		onReady: (name: string, files: PreviewFiles) => void
	): Promise<void> {
		const valid = names.filter((name) => isValidIconName(name));
		if (valid.length !== names.length) {
			this.log.warn('load-invalid-names', { requested: names.length, dropped: names.length - valid.length });
		}
		if (valid.length === 0 || signal.aborted) {
			this.log.debug('load-skipped', { requested: names.length, reason: signal.aborted ? 'aborted' : 'nothing-valid' });
			return;
		}
		const elapsed = stopwatch();
		await fs.promises.mkdir(this.directory, { recursive: true });

		const missing: string[] = [];
		let cached = 0;
		let coolingDown = 0;
		for (const name of valid) {
			const files = this.filesOf(name);
			if ((await exists(files.light)) && (await exists(files.dark))) {
				cached++;
				if (!signal.aborted) {
					onReady(name, files);
				}
			} else if (!this.recentlyFailed(name)) {
				missing.push(name);
			} else {
				coolingDown++;
			}
		}

		const jobs: Array<{ prefix: string; names: string[] }> = [];
		for (const [prefix, list] of groupByPrefix(missing)) {
			for (let index = 0; index < list.length; index += BATCH_SIZE) {
				jobs.push({ prefix, names: list.slice(index, index + BATCH_SIZE) });
			}
		}
		this.log.debug('load-plan', { requested: valid.length, cached, coolingDown, toFetch: missing.length, batches: jobs.length });
		let fetched = 0;
		let absent = 0;
		let failedBatches = 0;
		const worker = async (): Promise<void> => {
			for (let job = jobs.shift(); job !== undefined && !signal.aborted; job = jobs.shift()) {
				try {
					const svgs = await this.api.fetchIcons(job.prefix, job.names, signal);
					for (const name of job.names) {
						const svg = svgs[name];
						if (svg === undefined) {
							this.failed.set(`${job.prefix}:${name}`, Date.now());
							absent++;
							this.log.debug('icon-absent', { icon: `${job.prefix}:${name}` });
							continue;
						}
						if (signal.aborted) {
							continue;
						}
						const full = `${job.prefix}:${name}`;
						onReady(full, await this.write(full, svg));
						fetched++;
					}
				} catch (error) {
					// 这个图标集没有预览，继续下一个；被取消不算失败
					if (!signal.aborted) {
						const now = Date.now();
						job.names.forEach((name) => this.failed.set(`${job.prefix}:${name}`, now));
						failedBatches++;
						this.log.warn('batch-failed', { prefix: job.prefix, icons: job.names.length, error: errorText(error) });
					} else {
						this.log.debug('batch-aborted', { prefix: job.prefix, icons: job.names.length });
					}
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
		this.log.info('load-done', { requested: valid.length, cached, fetched, absent, failedBatches, coolingDown, aborted: signal.aborted, ms: elapsed() });
	}

	/**
	 * 准备单个图标的预览；已缓存则直接返回。
	 *
	 * @param name "prefix:name" 格式的图标名。
	 * @param signal 取消信号。
	 * @returns 预览文件；取不到时为 undefined。
	 */
	async get(name: string, signal: AbortSignal): Promise<PreviewFiles | undefined> {
		let found: PreviewFiles | undefined;
		await this.load([name], signal, (_ready, files) => {
			found = files;
		});
		return found;
	}

	private recentlyFailed(name: string): boolean {
		const at = this.failed.get(name);
		if (at === undefined) {
			return false;
		}
		if (Date.now() - at < RETRY_AFTER_MS) {
			return true;
		}
		this.failed.delete(name);
		return false;
	}

	/** 图标名只含小写字母、数字和连字符，所以用下划线分隔不会撞名，也不会逃出缓存目录。 */
	private filesOf(name: string): PreviewFiles {
		const base = name.replace(':', '_');
		return {
			light: path.join(this.directory, `${base}.light.svg`),
			dark: path.join(this.directory, `${base}.dark.svg`),
		};
	}

	private async write(name: string, svg: string): Promise<PreviewFiles> {
		const files = this.filesOf(name);
		await Promise.all([
			writeAtomically(files.light, tintSvg(svg, PREVIEW_COLORS.light)),
			writeAtomically(files.dark, tintSvg(svg, PREVIEW_COLORS.dark)),
		]);
		return files;
	}
}
