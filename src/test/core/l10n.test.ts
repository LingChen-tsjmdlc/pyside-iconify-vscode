import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { CALLABLES } from '../../core/rules';

/** VS Code 的语言标识；每种都要有 package.nls.<locale>.json 和 l10n/bundle.l10n.<locale>.json。 */
const LOCALES = ['zh-cn', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'pt-br'];

// 编译后位于 out/test/core，向上三层是仓库根目录
const ROOT = path.resolve(__dirname, '../../..');

function readJson(file: string): Record<string, string> {
	return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')) as Record<string, string>;
}

function placeholders(text: string): string[] {
	return [...new Set(text.match(/\{\d+\}/g) ?? [])].sort();
}

/** 取出源码里 vscode.l10n.t('...') 的字面量，以及 check.ts 里 message: '...' 的模板。 */
function sourceStrings(): string[] {
	const found = new Set<string>();
	const literal = String.raw`(['"])((?:\\.|(?!\1).)*)\1`;
	const patterns = [new RegExp(String.raw`l10n\.t\(\s*${literal}`, 'g'), new RegExp(String.raw`message:\s*${literal}`, 'g')];
	const walk = (directory: string): void => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				if (entry.name !== 'test') {
					walk(full);
				}
			} else if (entry.name.endsWith('.ts')) {
				const text = fs.readFileSync(full, 'utf8');
				for (const pattern of patterns) {
					for (const match of text.matchAll(pattern)) {
						found.add(match[2].replace(/\\(.)/g, '$1'));
					}
				}
			}
		}
	};
	walk(path.join(ROOT, 'src'));
	return [...found];
}

suite('core/l10n', () => {
	const english = readJson('package.nls.json');
	const reference = readJson('l10n/bundle.l10n.zh-cn.json');

	test('the reference bundle covers every message in the code and every doc in the rules', () => {
		const wanted = new Set(sourceStrings());
		for (const rule of Object.values(CALLABLES)) {
			wanted.add(rule.summary);
			for (const param of rule.params) {
				wanted.add(param.doc);
			}
		}
		assert.ok(wanted.size > 40, `only found ${wanted.size} strings, the scan is probably broken`);
		const missing = [...wanted].filter((text) => !(text in reference));
		assert.deepStrictEqual(missing, []);
	});

	for (const locale of LOCALES) {
		suite(locale, () => {
			test('bundle has exactly the keys of the reference bundle, with the same placeholders', () => {
				const bundle = readJson(`l10n/bundle.l10n.${locale}.json`);
				assert.deepStrictEqual(Object.keys(bundle).sort(), Object.keys(reference).sort());
				for (const [key, value] of Object.entries(bundle)) {
					assert.ok(typeof value === 'string' && value.trim() !== '', `empty translation for: ${key}`);
					assert.deepStrictEqual(placeholders(value), placeholders(key), `placeholders differ for: ${key}`);
				}
			});

			test('package.nls has exactly the keys of the English file', () => {
				const nls = readJson(`package.nls.${locale}.json`);
				assert.deepStrictEqual(Object.keys(nls).sort(), Object.keys(english).sort());
				for (const [key, value] of Object.entries(nls)) {
					assert.ok(typeof value === 'string' && value.trim() !== '', `empty text for: ${key}`);
				}
			});
		});
	}
});
