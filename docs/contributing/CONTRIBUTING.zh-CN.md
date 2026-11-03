# 贡献指南

感谢你愿意参与贡献。本页涵盖环境准备、日常流程、约定和翻译。

[English](../../CONTRIBUTING.md) | **中文** | [日本語](CONTRIBUTING.ja.md) | [한국어](CONTRIBUTING.ko.md) | [Español](CONTRIBUTING.es.md) | [Français](CONTRIBUTING.fr.md) | [Deutsch](CONTRIBUTING.de.md) | [Русский](CONTRIBUTING.ru.md) | [Português (BR)](CONTRIBUTING.pt-BR.md)

## 你需要什么

| 工具                  | 用途                              |
| --------------------- | --------------------------------- |
| Node.js 22 或更新版本 | 运行构建、代码检查和测试          |
| pnpm                  | 包管理器（`npm install -g pnpm`） |
| Git                   | 版本控制                          |
| VS Code               | 运行和调试扩展                    |

开发扩展不需要会写 Python，但准备一个用到 `pyside-iconify` 的小 Python 文件，试起来更方便。

## 准备环境

```powershell
pnpm install
```

## 运行和调试

扩展运行在 VS Code 里，所以你会同时用到两个 VS Code 窗口：

- 第一个窗口用来写代码和调试
- 第二个窗口叫扩展开发宿主（Extension Development Host），是一个加载了你扩展的普通 VS Code

步骤：

1. 用 VS Code 打开本文件夹。
2. 按 `F5`。启动配置 `Run Extension` 会以监视模式启动 TypeScript 编译器，并打开第二个窗口。
3. 在第二个窗口里打开一个 `.py` 文件，试用你正在做的功能。
4. 在第一个窗口里改代码。监视任务会在保存时重新编译。在第二个窗口里执行 `Developer: Reload Window`（`Ctrl+R`，macOS 上是 `Cmd+R`）来加载新构建。
5. 在第一个窗口里设置断点。`console.log` 的输出会出现在它的调试控制台里。

## 命令

| 命令               | 作用                                          |
| ------------------ | --------------------------------------------- |
| `pnpm run compile` | 把 TypeScript 编译到 `out/`，只编译一次       |
| `pnpm run watch`   | 每次保存都重新编译                            |
| `pnpm run lint`    | 用 ESLint 检查 `src/`                         |
| `pnpm test`        | 先编译、再检查，然后在真实的 VS Code 里跑测试 |

第一次运行 `pnpm test` 会把一份 VS Code 下载到 `.vscode-test/`，所以需要联网一次。`.npmrc` 打开了 `enable-pre-post-scripts`；没有它，pnpm 会跳过测试之前的编译和检查步骤。

## 测试

- 测试放在 `src/test/`，文件名为 `*.test.ts`，使用 Mocha。
- 每个缺陷修复都要带一个回归测试，且该测试在没有修复时会失败。
- 测试行为，而不是只看"没有抛异常"：对补全功能，要断言某一行代码会返回哪些候选项。
- 测试不能使用真实网络。用假的实现替换 Iconify 客户端。

## 项目结构

分层和原因见 [docs/architecture.md](../architecture.md)（英文）。"我的改动该放哪里"的简版：

| 改动涉及                                 | 位置               |
| ---------------------------------------- | ------------------ |
| 读取 Python 代码里的调用、参数规则、名称 | `src/core/`        |
| 请求 Iconify API、缓存                   | `src/iconify/`     |
| VS Code 功能：悬停、补全、检查、搜索     | `src/features/`    |
| 启动时注册功能                           | `src/extension.ts` |
| 用户看到的文字                           | 见"本地化"         |

## 本地化

扩展跟随 VS Code 的显示语言，自己没有语言设置，回退语言是英文。

- `package.json` 里的文字（命令标题、设置说明）使用 `%pyside-iconify.search.title%` 这样的键。英文原文放在 `package.nls.json`，每种译文放在 `package.nls.<locale>.json`。
- 代码里的文字走 `vscode.l10n.t("...")`。译文放在 `l10n/bundle.l10n.<locale>.json`，`package.json` 用 `l10n` 字段指向该文件夹。
- 不要把句子片段拼接起来，用占位符：`vscode.l10n.t("Unknown parameter {0}", name)`。
- 语言代码：`en`（源语言）、`zh-cn`、`ja`、`ko`、`es`、`fr`、`de`、`ru`、`pt-br`。
- 不要在其他地方硬编码给用户看的英文文字。

## 约定

- TypeScript 使用严格模式。导出的签名里不用 `any`。
- 检查不许猜。只有确定有问题才报告；无法知道的内容（比如来自变量的值）不要去动。
- 绝不阻塞输入。对 Iconify API 的请求要防抖并缓存，不需要网络的功能在离线时也必须可用。
- 注释保持精简：说明函数是做什么的、参数是什么意思，不写排障历史。
- 代码、文档和提交信息里不用 emoji。
- 提交信息遵循 Conventional Commits：英文、小写、一行，例如 `feat: add icon search command` 或 `fix(completion): ignore strings outside calls`。类型：`feat`、`fix`、`docs`、`ci`、`chore`。

## 翻译

README 和本页在 `docs/` 下有多语言版本。英文（`README.md`、`CONTRIBUTING.md`）是唯一依据。译文要保持与英文版相同的标题、表格和代码块。欢迎修正译文，这是最容易上手的贡献之一。
