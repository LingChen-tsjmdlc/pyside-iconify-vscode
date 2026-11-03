/** 日志级别：DEBUG 是细节，INFO 是正常流程，WARN 是预期内的跳过或降级，ERROR 是意料之外的异常。 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/** 日志字段的值；undefined 的字段不输出。 */
export type LogValue = string | number | boolean | null | undefined;

/** 一条日志附带的 键=值 字段。 */
export type LogFields = Record<string, LogValue>;

/** 日志的接收方：扩展里写进输出面板，测试里记在数组里。 */
export interface Logger {
	/**
	 * 记一条日志。
	 *
	 * @param level 级别。
	 * @param module 模块名，如 completion、api。
	 * @param event 事件，一个词的动词，如 start、done、skipped、failed。
	 * @param fields 附带的字段。
	 */
	log(level: LogLevel, module: string, event: string, fields?: LogFields): void;
}

/** 固定在某个模块上的日志，调用时不用再写模块名。 */
export interface ScopedLog {
	debug(event: string, fields?: LogFields): void;
	info(event: string, fields?: LogFields): void;
	warn(event: string, fields?: LogFields): void;
	error(event: string, fields?: LogFields): void;
}

/** 什么都不记的日志，用作默认值，测试和不关心日志的调用方不必传。 */
export const NULL_LOGGER: Logger = { log: () => undefined };

/** 字符串值超过这个长度就截断，避免一行日志过长。 */
const MAX_VALUE_LENGTH = 160;

/**
 * 把日志固定到一个模块上。
 *
 * @param logger 底层日志。
 * @param module 模块名。
 */
export function scoped(logger: Logger, module: string): ScopedLog {
	return {
		debug: (event, fields) => logger.log('DEBUG', module, event, fields),
		info: (event, fields) => logger.log('INFO', module, event, fields),
		warn: (event, fields) => logger.log('WARN', module, event, fields),
		error: (event, fields) => logger.log('ERROR', module, event, fields),
	};
}

function pad(value: number, width: number): string {
	return String(value).padStart(width, '0');
}

/** 把时间格式化为 HH:mm:ss.SSS（本地时间）。 */
export function formatTime(date: Date): string {
	return `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}.${pad(date.getMilliseconds(), 3)}`;
}

function formatValue(value: Exclude<LogValue, undefined>): string {
	if (typeof value !== 'string') {
		return String(value);
	}
	const text = value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}...(${value.length})` : value;
	// JSON 写法会转义引号和换行，保证一条日志始终只占一行
	return JSON.stringify(text);
}

/**
 * 拼出一行日志：`时间 级别 [模块] 事件 键=值 键=值`。
 * 级别补齐到 5 个字符让各行对齐；字符串值加双引号，undefined 的字段略过。
 *
 * @param date 时间。
 * @param level 级别。
 * @param module 模块名。
 * @param event 事件。
 * @param fields 附带的字段。
 */
export function formatLine(date: Date, level: LogLevel, module: string, event: string, fields: LogFields = {}): string {
	const parts = [formatTime(date), level.padEnd(5), `[${module}]`, event];
	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) {
			parts.push(`${key}=${formatValue(value)}`);
		}
	}
	return parts.join(' ');
}

/**
 * 创建把每行日志交给 write 的日志。
 *
 * @param write 接收成品文本行的函数。
 * @param now 取当前时间，测试里换成固定值。
 */
export function createLogger(write: (line: string) => void, now: () => Date = () => new Date()): Logger {
	return {
		log: (level, module, event, fields) => {
			try {
				write(formatLine(now(), level, module, event, fields));
			} catch {
				// 日志本身出问题不能影响功能
			}
		},
	};
}

/** 把任意抛出的东西变成一句简短的文字，用于 error= 字段。 */
export function errorText(error: unknown): string {
	if (error instanceof Error) {
		return error.name === 'Error' ? error.message : `${error.name}: ${error.message}`;
	}
	return String(error);
}

/** 开始计时；调用返回的函数得到已过去的毫秒数。 */
export function stopwatch(): () => number {
	const started = Date.now();
	return () => Date.now() - started;
}

/** 取路径最后一段，日志里只记文件名，不记目录。 */
export function baseName(file: string): string {
	return file.split(/[\\/]/).pop() ?? file;
}
