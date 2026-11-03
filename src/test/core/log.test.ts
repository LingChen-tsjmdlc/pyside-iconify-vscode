import * as assert from 'assert';
import { baseName, createLogger, errorText, formatLine, formatTime, NULL_LOGGER, scoped, stopwatch } from '../../core/log';

const AT = new Date(2026, 10, 3, 21, 5, 7, 9);

suite('core/log', () => {
	test('time is HH:mm:ss.SSS with leading zeros', () => {
		assert.strictEqual(formatTime(AT), '21:05:07.009');
	});

	test('a line is time, padded level, [module], event, then key=value', () => {
		assert.strictEqual(
			formatLine(AT, 'INFO', 'completion', 'done', { id: 6, query: 'hom', ok: true, none: null }),
			'21:05:07.009 INFO  [completion] done id=6 query="hom" ok=true none=null'
		);
		assert.strictEqual(formatLine(AT, 'ERROR', 'api', 'failed'), '21:05:07.009 ERROR [api] failed');
		assert.strictEqual(formatLine(AT, 'DEBUG', 'api', 'x'), '21:05:07.009 DEBUG [api] x');
		assert.strictEqual(formatLine(AT, 'WARN', 'api', 'x'), '21:05:07.009 WARN  [api] x');
	});

	test('undefined fields are left out', () => {
		assert.strictEqual(formatLine(AT, 'INFO', 'm', 'e', { a: 1, b: undefined, c: 2 }), '21:05:07.009 INFO  [m] e a=1 c=2');
	});

	test('a value never breaks the line: quotes and newlines are escaped', () => {
		const line = formatLine(AT, 'INFO', 'm', 'e', { text: 'a "b"\nc' });
		assert.ok(!line.includes('\n'));
		assert.ok(line.endsWith('text="a \\"b\\"\\nc"'));
	});

	test('a very long string is cut and shows the full length', () => {
		const line = formatLine(AT, 'INFO', 'm', 'e', { text: 'x'.repeat(500) });
		assert.ok(line.length < 260);
		assert.ok(line.includes('...(500)'));
	});

	test('createLogger hands formatted lines to write, with the clock it was given', () => {
		const lines: string[] = [];
		createLogger((line) => lines.push(line), () => AT).log('WARN', 'api', 'retry', { n: 2 });
		assert.deepStrictEqual(lines, ['21:05:07.009 WARN  [api] retry n=2']);
	});

	test('a failing write never throws into the caller', () => {
		const logger = createLogger(() => {
			throw new Error('disk full');
		});
		assert.doesNotThrow(() => logger.log('INFO', 'm', 'e'));
	});

	test('scoped fixes the module and maps each method to its level', () => {
		const lines: string[] = [];
		const log = scoped(createLogger((line) => lines.push(line), () => AT), 'hover');
		log.debug('a');
		log.info('b');
		log.warn('c');
		log.error('d', { k: 'v' });
		assert.deepStrictEqual(lines, [
			'21:05:07.009 DEBUG [hover] a',
			'21:05:07.009 INFO  [hover] b',
			'21:05:07.009 WARN  [hover] c',
			'21:05:07.009 ERROR [hover] d k="v"',
		]);
	});

	test('the null logger accepts anything', () => {
		assert.doesNotThrow(() => scoped(NULL_LOGGER, 'x').error('y', { a: 1 }));
	});

	test('errorText shows the message, and the class name for specific errors', () => {
		assert.strictEqual(errorText(new Error('boom')), 'boom');
		assert.strictEqual(errorText(new TypeError('bad')), 'TypeError: bad');
		assert.strictEqual(errorText('plain'), 'plain');
		assert.strictEqual(errorText(undefined), 'undefined');
	});

	test('stopwatch counts elapsed milliseconds', async () => {
		const elapsed = stopwatch();
		await new Promise((resolve) => setTimeout(resolve, 30));
		const ms = elapsed();
		assert.ok(ms >= 20 && ms < 1000, String(ms));
	});

	test('baseName keeps only the file name for both separators', () => {
		assert.strictEqual(baseName('C:\\a\\b\\demo.py'), 'demo.py');
		assert.strictEqual(baseName('/a/b/demo.py'), 'demo.py');
		assert.strictEqual(baseName('Untitled-1'), 'Untitled-1');
	});
});
