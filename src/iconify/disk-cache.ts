import * as fs from 'fs';
import * as path from 'path';
import { NULL_LOGGER, errorText, scoped, type Logger, type ScopedLog } from '../core/log';

/** 按键存取文本，带过期时间；任何失败都当作没有缓存，不抛错。 */
export interface TextCache {
	/**
	 * 读取缓存。
	 *
	 * @param key 键，只含字母、数字、点、下划线和连字符。
	 * @param maxAgeMs 超过这个年龄的缓存视为不存在。
	 */
	get(key: string, maxAgeMs: number): Promise<string | undefined>;
	/**
	 * 写入缓存。
	 *
	 * @param key 键。
	 * @param text 内容。
	 */
	set(key: string, text: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9._-]+$/i;

/** 把文本存成缓存目录下的文件，重启后仍然有效。 */
export class DiskCache implements TextCache {
	private readonly log: ScopedLog;

	/**
	 * @param directory 缓存目录，写入时按需创建。
	 * @param logger 日志。
	 */
	constructor(
		private readonly directory: string,
		logger: Logger = NULL_LOGGER
	) {
		this.log = scoped(logger, 'cache');
	}

	async get(key: string, maxAgeMs: number): Promise<string | undefined> {
		if (!SAFE_KEY.test(key)) {
			this.log.warn('get-rejected', { key, reason: 'unsafe-key' });
			return undefined;
		}
		const file = this.fileOf(key);
		try {
			const { mtimeMs } = await fs.promises.stat(file);
			const age = Date.now() - mtimeMs;
			if (age > maxAgeMs) {
				this.log.debug('miss', { key, reason: 'expired', ageDays: Math.round(age / 86_400_000) });
				return undefined;
			}
			const text = await fs.promises.readFile(file, 'utf8');
			this.log.debug('hit', { key, bytes: text.length });
			return text;
		} catch (error) {
			const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
			if (missing) {
				this.log.debug('miss', { key, reason: 'absent' });
			} else {
				this.log.warn('read-failed', { key, error: errorText(error) });
			}
			return undefined;
		}
	}

	async set(key: string, text: string): Promise<void> {
		if (!SAFE_KEY.test(key)) {
			this.log.warn('set-rejected', { key, reason: 'unsafe-key' });
			return;
		}
		try {
			await fs.promises.mkdir(this.directory, { recursive: true });
			// 先写临时文件再改名，避免被中断时留下写了一半的缓存
			const temp = `${this.fileOf(key)}.${process.pid}.tmp`;
			await fs.promises.writeFile(temp, text);
			await fs.promises.rename(temp, this.fileOf(key));
			this.log.debug('stored', { key, bytes: text.length });
		} catch (error) {
			// 写不进去只是没有缓存
			this.log.warn('write-failed', { key, error: errorText(error) });
		}
	}

	/**
	 * 删除超过指定年龄的缓存文件，在扩展启动时调用一次。
	 *
	 * @param maxAgeMs 最大年龄。
	 */
	async prune(maxAgeMs: number): Promise<void> {
		let kept = 0;
		let removed = 0;
		try {
			for (const name of await fs.promises.readdir(this.directory)) {
				const file = path.join(this.directory, name);
				const { mtimeMs } = await fs.promises.stat(file);
				if (Date.now() - mtimeMs > maxAgeMs) {
					await fs.promises.rm(file, { force: true });
					removed++;
				} else {
					kept++;
				}
			}
			this.log.info('pruned', { kept, removed });
		} catch (error) {
			// 目录不存在或被占用，下次再清
			const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
			this.log[missing ? 'debug' : 'warn']('prune-skipped', { reason: missing ? 'no-directory' : errorText(error), kept, removed });
		}
	}

	private fileOf(key: string): string {
		return path.join(this.directory, `${key}.json`);
	}
}
