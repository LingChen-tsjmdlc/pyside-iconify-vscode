/**
 * 判断 VS Code 版本号是否不低于 major.minor。
 *
 * @param version 如 "1.73.0"、"1.90.0-insider"。
 * @param major 主版本。
 * @param minor 次版本。
 */
export function isAtLeast(version: string, major: number, minor: number): boolean {
	const match = /^(\d+)\.(\d+)/.exec(version);
	if (!match) {
		return false;
	}
	const actualMajor = Number(match[1]);
	const actualMinor = Number(match[2]);
	return actualMajor > major || (actualMajor === major && actualMinor >= minor);
}
