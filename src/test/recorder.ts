import type { Logger } from '../core/log';

/**
 * 测试用日志：把每条日志记成 "LEVEL module.event key=value ..." 的一行，方便断言。
 *
 * @returns lines 是记下的全部行；logger 传给被测对象。
 */
export function recorder(): { lines: string[]; logger: Logger } {
	const lines: string[] = [];
	const logger: Logger = {
		log: (level, module, event, fields = {}) => {
			const extra = Object.entries(fields)
				.filter(([, value]) => value !== undefined)
				.map(([key, value]) => `${key}=${String(value)}`)
				.join(' ');
			lines.push(`${level} ${module}.${event} ${extra}`.trim());
		},
	};
	return { lines, logger };
}
