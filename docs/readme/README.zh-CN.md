# PySide Iconify for VS Code

在编辑器里获得 `pyside-iconify` 的文档、补全、检查和图标搜索。

[English](../../README.md) | **中文** | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Русский](README.ru.md) | [Português (BR)](README.pt-BR.md)

> 本项目 **不是** Iconify 官方项目。
>
> 状态：尚未发布到 VS Code Marketplace 或 Open VSX。现在想试用，请从源码运行，见 [CONTRIBUTING](../contributing/CONTRIBUTING.zh-CN.md)。

## 为什么需要它

[pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify) 给 `QIcon` 换了一个数据来源：`IconWidget("mdi:home", color="red")`。用它写代码时，错误暴露得很晚：

- 图标名只是一段文字，看不出它到底是哪个图标
- 不存在的参数名，或属于别的函数的参数，要等那一行执行时才出错
- `size`、`color`、`opacity`、`animation` 能接受什么值，很容易忘

这个扩展把这些答案放进编辑器里。

## 功能

| 功能         | 你会得到什么                                                                    |
| ------------ | ------------------------------------------------------------------------------- |
| 代码里的图标 | 在图标名的位置直接画出真实图标，悬停时显示大图                                  |
| 文档         | 悬停在调用或它的参数上，查看作用、可接受的值和默认值                            |
| 参数         | 补全参数名，以及 `animation`、`spin` 等参数的取值                               |
| 检查         | 用波浪线标出未知或相互冲突的参数和不合法的取值；拼写相近时提供快速修复          |
| 图标名       | 在 `icon` 字符串里输入两个以上字符，从 Iconify 实时搜索结果里选择，每项都带图   |
| 图标搜索     | 按 `Ctrl+Alt+Shift+I`（macOS 为 `Cmd+Alt+Shift+I`）搜索图标，并把名字插入光标处 |

以上功能都作用于从 `pyside_iconify` 导入的 `IconWidget`、`get_icon`、`get_pixmap` 和 `set_icon`。检查只报告有把握的问题。无法确定的内容，比如来自变量的值，不会去动。

## 行内图标

真实图标直接画在代码里，位置就在图标名处。只处理 `icon` 参数，并且只处理 `"mdi:home"` 这样的单行普通字符串。光标所在的行始终显示文字，方便你编辑。引号始终保留。无论哪种样式，悬停在名字上都会显示大图。

用设置项 `pyside-iconify.inlineIcons` 选择样式：

| 取值               | 效果                                 |
| ------------------ | ------------------------------------ |
| `off`              | 仅文字，不画图标。                   |
| `iconBefore`       | 先图标，后文字。                     |
| `iconAfter`        | 先文字，后图标。                     |
| `iconOnly`（默认） | 仅图标，隐藏图标名。                 |
| `gutter`           | 图标显示在行号前的边栏里，文字保留。 |

```json
"pyside-iconify.inlineIcons": "iconOnly"
```

## 快捷键

| 按键                                             | 作用                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `Ctrl+Alt+Shift+I`（macOS 为 `Cmd+Alt+Shift+I`） | 在 Python 文件里打开图标搜索，选中的名字会写到光标处。                       |
| `Alt+Enter`                                      | 在 Python 文件里于光标处弹出候选。在 `icon` 字符串里，候选就是图标名。       |
| `Ctrl+Space`                                     | VS Code 自带的快捷键，用来展开或收起候选列表旁的详情面板，大图就显示在那里。 |

## Iconify IntelliSense

推荐同时安装 [Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify)。它负责网页语言里的 Iconify；本扩展负责 Python 里的 `pyside-iconify`。

默认情况下两者不会重叠：Iconify IntelliSense 只在它的 `iconify.languageIds` 设置所列的语言里生效，而 `python` 默认不在其中。如果你把 `python` 加了进去，图标候选和行内图标就会各出现两份，请把它从那个列表里删掉。如果在 `.py` 文件里仍然看到两张悬停卡片，请把 `**/*.py` 加到它的 `iconify.preview.exclude` 设置里。

## 语言

提示信息跟随 VS Code 的显示语言，没有单独的设置项。默认语言和回退语言是英文。

支持：English、中文、日本語、한국어、Español、Français、Deutsch、Русский、Português (BR)。

## 环境要求与联网

- VS Code 1.73 或更高版本
- 从 `pyside_iconify` 导入的 Python 文件
- 能访问公开的 Iconify API（`https://api.iconify.design`），用于图标搜索和图标图片

发出去的只有你搜索的词和图标名。你的代码不会被上传，Python 的解析在你本机完成。

得到的结果会缓存在扩展的存储目录里，重复的操作更快，也少调用一些 API。搜索结果保留 14 天，图标集列表保留 30 天，图标图片会一直保留，直到你删除该目录。没有网络时，文档、参数补全和检查照常工作，已缓存的图标仍会显示。

## 已知限制

- 不检查图标是否存在，只检查是否符合 `prefix:name` 的形式。不存在的名字只是不显示图片。
- 检查只看字面量。来自变量的值不会被判断。
- `iconOnly` 用一个 VS Code 没有公开文档的 CSS 写法来隐藏文字，Iconify IntelliSense 用的是同一个办法。如果将来的 VS Code 不再认它，文字和图标会同时显示。
- 搜索框里的图片需要 VS Code 1.81 或更高版本，更低的版本只显示名字。

## 相关项目

| 项目                                                                             | 是什么                          |
| -------------------------------------------------------------------------------- | ------------------------------- |
| [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)             | 库本体                          |
| [pyside-iconify-mcp](https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp)     | 帮助 AI 助手写对代码的 MCP 服务 |
| [pyside-iconify-skill](https://github.com/LingChen-tsjmdlc/pyside-iconify-skill) | 记录准确用法的 Agent Skill      |

本扩展面向在编辑器里写代码的人；另外两个面向 AI 助手。

## 开发

准备环境、运行和调试扩展见 [CONTRIBUTING](../contributing/CONTRIBUTING.zh-CN.md)，代码结构见 [architecture](../architecture.md)（英文）。

## 许可证

[MIT](../../LICENSE)。图标集合受各自的许可证约束。
