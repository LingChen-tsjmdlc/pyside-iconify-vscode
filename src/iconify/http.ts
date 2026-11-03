import * as https from 'https';
import { NULL_LOGGER, scoped, stopwatch, type Logger } from '../core/log';

/** 服务器返回了非 2xx 状态码。 */
export class HttpError extends Error {
	constructor(readonly status: number) {
		super(`HTTP ${status}`);
		this.name = 'HttpError';
	}
}

/** 请求被调用方主动取消。 */
export class AbortedError extends Error {
	constructor() {
		super('aborted');
		this.name = 'AbortedError';
	}
}

/** 单次请求的选项。 */
export interface RequestOptions {
	signal?: AbortSignal;
	/** 无数据往来多久算超时，单位毫秒。 */
	timeoutMs?: number;
	/** 响应体上限，超过即中止，单位字节。 */
	maxBytes?: number;
}

/** 日志里的地址：去掉查询参数（图标列表可能很长），只留路径和参数个数。 */
function describeUrl(url: string): { host: string; path: string; query?: string } {
	try {
		const parsed = new URL(url);
		const icons = parsed.searchParams.get('icons');
		return {
			host: parsed.host,
			path: parsed.pathname,
			query: icons === null ? parsed.search.slice(1) || undefined : `icons(${icons.split(',').length})`,
		};
	} catch {
		return { host: '?', path: url.slice(0, 80) };
	}
}

/**
 * 创建 HTTPS GET 取文本的函数，带日志。扩展宿主会为 https 模块套上 VS Code 的代理设置，
 * 所以这里不能传自己的 agent，否则会绕过用户配置的代理。
 * 1.73 的 Node 16 没有全局 fetch，所以用 https 模块。
 *
 * @param logger 日志。
 */
export function createGetText(logger: Logger = NULL_LOGGER): (url: string, options?: RequestOptions) => Promise<string> {
	const log = scoped(logger, 'http');
	let counter = 0;
	return (url, options = {}) => {
		const id = ++counter;
		const elapsed = stopwatch();
		const where = describeUrl(url);
		log.debug('start', { id, ...where });
		return getText(url, options).then(
			(text) => {
				log.debug('done', { id, bytes: text.length, ms: elapsed() });
				return text;
			},
			(error: unknown) => {
				if (error instanceof AbortedError) {
					log.debug('aborted', { id, ms: elapsed() });
				} else if (error instanceof HttpError) {
					log.warn('failed', { id, ...where, status: error.status, ms: elapsed() });
				} else {
					log.warn('failed', { id, ...where, error: error instanceof Error ? error.message : String(error), ms: elapsed() });
				}
				throw error;
			}
		);
	};
}

/**
 * 用 HTTPS GET 取文本。
 *
 * @param url 完整地址。
 * @param options 取消信号、超时与大小上限。
 */
export function getText(url: string, options: RequestOptions = {}): Promise<string> {
	const { signal, timeoutMs = 10_000, maxBytes = 2_000_000 } = options;
	return new Promise<string>((resolve, reject) => {
		if (signal?.aborted) {
			reject(new AbortedError());
			return;
		}
		let settled = false;
		const finish = (action: () => void): void => {
			if (settled) {
				return;
			}
			settled = true;
			signal?.removeEventListener('abort', onAbort);
			action();
		};
		const request = https.get(url, { headers: { 'User-Agent': 'pyside-iconify-vscode' } }, (response) => {
			const status = response.statusCode ?? 0;
			if (status < 200 || status >= 300) {
				response.resume();
				finish(() => reject(new HttpError(status)));
				return;
			}
			const chunks: Buffer[] = [];
			let size = 0;
			response.on('data', (chunk: Buffer) => {
				size += chunk.length;
				if (size > maxBytes) {
					request.destroy(new Error('response too large'));
					return;
				}
				chunks.push(chunk);
			});
			response.on('end', () => finish(() => resolve(Buffer.concat(chunks).toString('utf8'))));
			response.on('error', (error) => finish(() => reject(error)));
		});
		const onAbort = (): void => {
			request.destroy();
			finish(() => reject(new AbortedError()));
		};
		request.setTimeout(timeoutMs, () => request.destroy(new Error('timeout')));
		request.on('error', (error) => finish(() => reject(error)));
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}
