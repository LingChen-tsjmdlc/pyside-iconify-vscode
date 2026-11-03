# Changelog

All notable changes to this extension are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.0.1]

### Fixed

- The Marketplace listing now shows the real display name and description; in 1.0.0 they appeared as raw `%key%` references because the manifest translation keys contained hyphens, which the packaging tool cannot resolve
- Continuous integration now passes the packaged `.vsix` file to Open VSX correctly, so both marketplaces receive every release

## [1.0.0]

### Added

- Inline icons: the real icon drawn next to the icon name, in five styles controlled by the `pyside-iconify.inlineIcons` setting (`off`, `iconBefore`, `iconAfter`, `iconOnly`, `gutter`); the cursor line always keeps its text
- Documentation: hover on a call or parameter shows its type, default and description, localized in 9 languages
- Parameters: completion for parameter names and for the values of `animation`, `spin` and similar parameters; typing `name=` opens the value list automatically
- Checks: unknown parameters, invalid values and conflicting combinations are underlined, with a quick fix for misspelled parameter names
- Icon names: completion with live Iconify search and picture previews inside the `icon` string
- Icon search: the `PySide Iconify: Search Icons` command (`Ctrl+Alt+Shift+I` in Python files, `Cmd+Alt+Shift+I` on macOS), with paged results and preview images
- A `PySide Iconify` output channel with detailed diagnostic logs
- Support for `IconWidget`, `get_icon`, `get_pixmap` and `set_icon` calls, including aliases and `module.function` access, recognized via imports from `pyside_iconify`
