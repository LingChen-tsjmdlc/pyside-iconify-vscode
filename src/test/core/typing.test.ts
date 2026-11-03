import * as assert from 'assert';
import { isSingleKeystroke } from '../../core/typing';

suite('core/typing', () => {
	test('a typed character counts', () => {
		assert.strictEqual(isSingleKeystroke('a', 0), true);
		assert.strictEqual(isSingleKeystroke(':', 0), true);
	});

	test('backspace and delete count', () => {
		assert.strictEqual(isSingleKeystroke('', 1), true);
	});

	test('a newline does not count', () => {
		assert.strictEqual(isSingleKeystroke('\n', 0), false);
		assert.strictEqual(isSingleKeystroke('\r', 0), false);
	});

	test('accepting a completion, pasting and auto-closed quotes do not count', () => {
		assert.strictEqual(isSingleKeystroke('mdi:home', 2), false);
		assert.strictEqual(isSingleKeystroke('""', 0), false);
		assert.strictEqual(isSingleKeystroke('abc', 0), false);
		assert.strictEqual(isSingleKeystroke('', 5), false);
	});

	test('replacing one character with another does not count', () => {
		assert.strictEqual(isSingleKeystroke('b', 1), false);
	});

	test('nothing changed does not count', () => {
		assert.strictEqual(isSingleKeystroke('', 0), false);
	});
});
