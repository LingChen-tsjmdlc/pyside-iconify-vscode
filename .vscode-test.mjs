import { defineConfig } from '@vscode/test-cli';

// 依次在声明的最低版本和最新稳定版里各跑一遍；只跑其中一套：pnpm test -- --label minimum
export default defineConfig([
	{ label: 'minimum', version: '1.73.0', files: 'out/test/**/*.test.js' },
	{ label: 'stable', version: 'stable', files: 'out/test/**/*.test.js' },
]);
