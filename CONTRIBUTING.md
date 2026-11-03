# Contributing

Thanks for your interest in contributing. This page covers setup, the daily workflow, conventions and translations.

English | [中文](docs/contributing/CONTRIBUTING.zh-CN.md) | [日本語](docs/contributing/CONTRIBUTING.ja.md) | [한국어](docs/contributing/CONTRIBUTING.ko.md) | [Español](docs/contributing/CONTRIBUTING.es.md) | [Français](docs/contributing/CONTRIBUTING.fr.md) | [Deutsch](docs/contributing/CONTRIBUTING.de.md) | [Русский](docs/contributing/CONTRIBUTING.ru.md) | [Português (BR)](docs/contributing/CONTRIBUTING.pt-BR.md)

## What you need

| Tool                | Why                                      |
| ------------------- | ---------------------------------------- |
| Node.js 22 or newer | Runs the build, the linter and the tests |
| pnpm                | Package manager (`npm install -g pnpm`)  |
| Git                 | Version control                          |
| VS Code             | Runs and debugs the extension            |

You do not need to write Python to work on the extension, but a small Python file that uses `pyside-iconify` is handy for trying it.

## Set up

```powershell
pnpm install
```

## Run and debug

An extension runs inside VS Code itself, so you work with two VS Code windows:

- the first window is where you write and debug the code
- the second window, called the Extension Development Host, is a normal VS Code with your extension loaded

Steps:

1. Open this folder in VS Code.
2. Press `F5`. The launch configuration `Run Extension` starts the TypeScript compiler in watch mode and opens the second window.
3. In the second window, open a `.py` file and try the feature you are working on.
4. Edit the code in the first window. The watch task recompiles on save. In the second window run `Developer: Reload Window` (`Ctrl+R`, or `Cmd+R` on macOS) to load the new build.
5. Set breakpoints in the first window. Output from `console.log` appears in its Debug Console.

## Commands

| Command            | What it does                                            |
| ------------------ | ------------------------------------------------------- |
| `pnpm run compile` | Compile TypeScript to `out/` once                       |
| `pnpm run watch`   | Compile again on every save                             |
| `pnpm run lint`    | Check `src/` with ESLint                                |
| `pnpm test`        | Compile, lint, then run the tests inside a real VS Code |

The first `pnpm test` downloads a copy of VS Code into `.vscode-test/`, so it needs network access once. `.npmrc` turns on `enable-pre-post-scripts`; without it pnpm skips the compile and lint step before the tests.

## Tests

- Tests live in `src/test/` and are named `*.test.ts`. They use Mocha.
- Every bug fix ships with a regression test that fails without the fix.
- Test behavior, not just "no exception": for a completion feature, assert which items come back for a given line of code.
- Tests must not use the real network. Replace the Iconify client with a fake.

## Project layout

See [docs/architecture.md](docs/architecture.md) for the layers and the reasons behind them. The short version of "where does my change go":

| Change touches                                       | Location           |
| ---------------------------------------------------- | ------------------ |
| Reading calls in Python code, parameter rules, names | `src/core/`        |
| Requests to the Iconify API, caching                 | `src/iconify/`     |
| A VS Code feature: hover, completion, checks, search | `src/features/`    |
| Registering features on start-up                     | `src/extension.ts` |
| Text the user sees                                   | see Localization   |

## Localization

The extension follows the display language of VS Code. There is no language setting of its own, and English is the fallback.

- Text in `package.json` (command titles, setting descriptions) uses a key such as `%pyside-iconify.search.title%`. The English text lives in `package.nls.json`; each translation lives in `package.nls.<locale>.json`.
- Text in code goes through `vscode.l10n.t("...")`. Translations live in `l10n/bundle.l10n.<locale>.json`, and `package.json` points to that folder with the `l10n` field.
- Never join sentence pieces together. Use placeholders: `vscode.l10n.t("Unknown parameter {0}", name)`.
- Locales: `en` (the source), `zh-cn`, `ja`, `ko`, `es`, `fr`, `de`, `ru`, `pt-br`.
- Do not hard-code user-facing text in English anywhere else.

## Conventions

- TypeScript in strict mode. No `any` in exported signatures.
- Checks must not guess. Report a problem only when it is certain; leave what cannot be known (a value from a variable, for example) alone.
- Never block typing. Requests to the Iconify API are debounced and cached, and every feature that does not need the network works without it.
- Comments stay minimal: what the function is for and what its parameters mean. No debugging history.
- No emoji in code, docs or commit messages.
- Commit messages follow Conventional Commits: English, lowercase, one line, for example `feat: add icon search command` or `fix(completion): ignore strings outside calls`. Types: `feat`, `fix`, `docs`, `ci`, `chore`.

## Translations

The README and this page ship in several languages under `docs/`. English (`README.md`, `CONTRIBUTING.md`) is the source of truth. A translation keeps the same headings, tables and code blocks as the English version. Fixes to translations are welcome and are among the easiest first contributions.
