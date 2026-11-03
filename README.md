# PySide Iconify for VS Code

Documentation, completion, checks and icon search for `pyside-iconify`, right in your editor.

English | [中文](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/readme/README.zh-CN.md) | [日本語](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/readme/README.ja.md) | [한국어](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/readme/README.ko.md) | [Español](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/readme/README.es.md) | [Français](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/readme/README.fr.md) | [Deutsch](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/readme/README.de.md) | [Русский](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/readme/README.ru.md) | [Português (BR)](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/readme/README.pt-BR.md)

> This project is **not** affiliated with the Iconify project.
>
> Available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lingchen.pyside-iconify) and [Open VSX](https://open-vsx.org/extension/lingchen/pyside-iconify).

## Why

[pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify) gives `QIcon` a data source: `IconWidget("mdi:home", color="red")`. Its mistakes show up late:

- an icon name is just text, so you cannot see which icon it is
- a parameter name that does not exist, or that belongs to another function, only fails when the line runs
- the accepted values of `size`, `color`, `opacity` and `animation` are easy to forget

This extension moves those answers into the editor.

## Features

| Feature       | What you get                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Icons in code | The real icon is drawn where the icon name is, and hovering shows it larger                                         |
| Documentation | Hover over a call or one of its parameters to see what it does, its accepted values and its default                 |
| Parameters    | Completion for parameter names, and for the values of `animation`, `spin` and similar parameters                    |
| Checks        | Unknown or conflicting parameters and invalid values are underlined; a close spelling gets a quick fix              |
| Icon names    | Type two or more characters inside the `icon` string and pick from live Iconify search results, each with a picture |
| Icon search   | Press `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` on macOS) to search icons and insert one at the cursor                  |

All of it works on `IconWidget`, `get_icon`, `get_pixmap` and `set_icon` imported from `pyside_iconify`. Checks only report what they are sure about. Anything they cannot know, such as a value that comes from a variable, is left alone.

## Inline icons

The real icon is drawn in your code, where the icon name is. Only the `icon` argument is handled, and only plain one-line strings such as `"mdi:home"`. The line that has the cursor always shows the text, so you can edit it. The quotes always stay. Hovering the name shows a larger icon in every mode.

Choose the style with the `pyside-iconify.inlineIcons` setting:

| Value                | Result                                                      |
| -------------------- | ----------------------------------------------------------- |
| `off`                | Text only. No icon is drawn.                                |
| `iconBefore`         | Icon, then the text.                                        |
| `iconAfter`          | Text, then the icon.                                        |
| `iconOnly` (default) | Icon only. The icon name is hidden.                         |
| `gutter`             | Icon in the gutter, before the line number. The text stays. |

```json
"pyside-iconify.inlineIcons": "iconOnly"
```

## Keyboard shortcuts

| Key                                             | What it does                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` on macOS) | Open icon search in a Python file. The chosen name goes to the cursor.                                          |
| `Alt+Enter`                                     | Show suggestions at the cursor in a Python file. Inside an `icon` string they are icon names.                   |
| `Ctrl+Space`                                    | VS Code's own key to open or close the details panel beside the suggestion list. The large icon is shown there. |

## Iconify IntelliSense

[Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify) is recommended. It covers Iconify in web languages; this extension covers `pyside-iconify` in Python.

By default they do not overlap, because Iconify IntelliSense only works in the languages listed in its `iconify.languageIds` setting, and `python` is not one of them. If you added `python` there, you get icon suggestions and inline icons twice. Remove it from that list. If you still see two hover cards in `.py` files, add `**/*.py` to its `iconify.preview.exclude` setting.

## Language

Messages follow the display language of VS Code. There is no separate setting. English is the default and the fallback.

Supported: English, 中文, 日本語, 한국어, Español, Français, Deutsch, Русский, Português (BR).

## Requirements and network use

- VS Code 1.73 or newer
- Python files that import from `pyside_iconify`
- Network access to the public Iconify API (`https://api.iconify.design`) for icon search and icon pictures

Only the words you search for and the names of icons are sent. Your code is not uploaded, and Python is parsed on your machine.

Answers are cached in the extension's storage folder, so repeated work is fast and the API is called less. Searches are kept for 14 days and lists of icon sets for 30 days. Icon pictures are kept until you delete the folder. Without a network, documentation, parameter completion and checks still work, and icons that were cached keep showing.

## Known limits

- Whether an icon exists is not checked. Only the form `prefix:name` is. An unknown name simply shows no picture.
- Checks read literal values only. A value from a variable is never judged.
- `iconOnly` hides the text with a CSS trick that VS Code does not document, the same one Iconify IntelliSense uses. If a future VS Code ignores it, the text and the icon both show.
- Pictures in the search box need VS Code 1.81 or newer. Older versions show names only.

## Related projects

| Project                                                                          | What it is                                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)             | The library                                               |
| [pyside-iconify-mcp](https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp)     | An MCP server that helps AI assistants write correct code |
| [pyside-iconify-skill](https://github.com/LingChen-tsjmdlc/pyside-iconify-skill) | An Agent Skill with the exact usage                       |

This extension is for people writing code in the editor; the other two are for AI assistants.

## Development

See [CONTRIBUTING.md](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/CONTRIBUTING.md) to set up, run and debug the extension, and [docs/architecture.md](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/docs/architecture.md) for how the code is laid out.

## License

[MIT](https://github.com/LingChen-tsjmdlc/pyside-iconify-vscode/blob/main/LICENSE). Icon collections are subject to their own licenses.
