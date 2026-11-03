# Architecture

This page is for contributors: how the code is laid out, which rules keep it tidy, and the decisions behind it. Usage is in the [README](../README.md); setup is in [CONTRIBUTING.md](../CONTRIBUTING.md).

The project has just started. This page describes the layout that new code follows.

## How it works in one line

**The extension reads the `pyside-iconify` calls in a Python file and answers with editor features: documentation, completion, checks and icon search.**

## Layout

```text
src/
├── extension.ts   # activate(): registers the features; no logic
├── core/          # pure logic; never imports vscode
├── iconify/       # the only place that talks to the Iconify API
├── features/      # one file per VS Code feature
└── test/          # tests, mirroring the folders above
l10n/              # bundle.l10n.<locale>.json, text used in code
package.nls*.json  # text used in package.json
```

| Folder      | Responsibility                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| `core/`     | Find `pyside-iconify` calls in source text, hold the parameter and value rules, validate icon names      |
| `iconify/`  | Search and look up icons through the public Iconify API; debounce, in-memory cache                       |
| `features/` | Hover, completion, diagnostics, and the icon search box. Each turns `core/` results into VS Code objects |

## Rules

| Rule                                                   | Why                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `extension.ts` contains no feature logic               | Start-up code stays readable                                           |
| `core/` does not import `vscode`                       | Pure logic is easy to test and can be reused outside the editor        |
| Only `iconify/` makes network requests                 | One place to cache, rate-limit and fake in tests                       |
| Features do not import each other                      | A feature can be changed or removed alone; shared code goes to `core/` |
| One source of rules feeds hover, completion and checks | The three never disagree about what a parameter accepts                |
| No `utils`, `helpers` or `misc`                        | A shared file needs a name that says what it does                      |

Dependencies point one way:

```text
features/  ->  core/
     \-->  iconify/
```

## Design decisions

- **Native editor UI, no Webview.** Completion uses VS Code's completion list, and the search box uses a Quick Pick. Both give the keyboard behavior people expect (arrow keys to move, `Tab` or `Enter` to accept) without a web page to maintain.
- **The language follows VS Code.** Messages use `vscode.l10n` and `package.nls` files, chosen by the display language of VS Code. There is no extension setting for it.
- **Do not duplicate Pylance.** The library ships type stubs, so signatures are already shown by Python language servers. This extension adds what they cannot: accepted values, why a name was removed, icon names.
- **Checks do not guess.** A problem is reported only when it is certain. Values that come from variables or function calls are skipped.
- **Written in TypeScript on its own.** The extension does not call `pyside-iconify-mcp`; the rules it needs are implemented here.
- **The network is optional.** Everything except icon search and checking that an icon exists works offline.
