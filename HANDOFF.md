# 交接文档：pyside-iconify-vscode

> 写给下一个接手的 AI。读完再动手。本文件由对话记忆整理，细节可能有偏差，
> 涉及主库、MCP、Skill 的具体行为，**以它们的源码为准**。
> 这是内部交接用文件，不要当 README 发布；用完可以删，或加入 `.gitignore`。

## 1. 这个仓库是什么

为 `pyside-iconify` 做的 **VS Code 扩展**（仓库名 `pyside-iconify-vscode`，
目录 `D:\Code\pyside-iconify-vscode`，目前是空的，只有本文件）。

命名约定：后缀写“面向哪个平台”，不写形态，和 `pyside-iconify-mcp`、
`pyside-iconify-skill` 保持一致。将来的 JetBrains 插件叫 `pyside-iconify-jetbrains`，
另开仓库。

Marketplace 里的显示名建议 `PySide Iconify`，扩展名（ID 的后半段）建议 `pyside-iconify`，
不带 `vscode` 后缀。Publisher ID 和扩展 ID 发布后基本不能改，**定名前先问用户**，
并先去 VS Code Marketplace 和 Open VSX 查重。

**必须写明“非 Iconify 官方项目”**：README、扩展描述、Marketplace 页面都要写。

## 2. 为什么有这个仓库（上下文）

`pyside-iconify` 是给 Qt（PySide6 / PyQt6，兼容 PyQt5 / PySide2）用的 Iconify 图标库，
一句话：给 `QIcon` 换一个数据来源。主推写法 `IconWidget("mdi:home", color="red")`，
第二入口 `get_icon()`。图标名格式 `前缀:名称`。当前主库版本 1.2.0。

周边生态**全部各开独立仓库、各有版本号**，主库只在需要新接口时才发版
（主库每发一次要发四个 PyPI 包，成本高）：

| 仓库                       | 内容                                                                                   | 状态   |
| -------------------------- | -------------------------------------------------------------------------------------- | ------ |
| `pyside-iconify`           | 主库                                                                                   | 已发布 |
| `pyside-iconify-mcp`       | MCP 服务，目前有 `search_icons`、`check_icons`、`get_reference`、`check_code` 四个工具 | 已发布 |
| `pyside-iconify-skill`     | Skill，服务于语法和参数，保证 AI 写对                                                  | 进行中 |
| `pyside-iconify-vscode`    | **本仓库**                                                                             | 未开始 |
| `pyside-iconify-jetbrains` | JetBrains 插件                                                                         | 未开始 |
| 官网                       | 单独仓库                                                                               | 未开始 |

主库路线图：`D:\Code\pyside-iconify\docs\roadmap.md` 的 Step 7（生态）。

## 3. 扩展要做什么

### 用户已确认的方向与优先级（2026-10-28）

搜索只是其中一方面。用户要求扩展同时提供**多语言**的语法提示和语法检查。优先级：

1. **文档**（最高）
2. **语法提示和语法补全**（参数名、取值、签名等，同时支持语法检查）
3. **搜索与图标名称补全、校验**

**“多语言”指自然语言**（用户已确认）：扩展的文档、悬停提示、补全说明、诊断信息
都要有多个语种（至少中文、英文；主库 README 有 9 个语种译本，可参考范围，具体
语种清单问用户）。**不是**多种编程语言（本库只有 Python），**也不是**多个 Qt 绑定：
主库自己的 `_qt.py` 垫片在运行时跟随用户导入的绑定，库本体不依赖 Qt，
扩展不需要为绑定写不同逻辑，也不要去检查用户用了哪个绑定的导入写法。

要想清楚的实现问题（未定，和用户讨论）：

- VS Code 的界面文案有标准的本地化机制，请查最新官方文档；
  但悬停文档、补全说明的多语言内容怎么存放、怎么与主库文档保持一致，要设计。
- 每新增一个语种就多一份维护成本，内容应尽量由一份源数据生成。

### 以下是我的推测，不是已确认的需求，只作讨论起点

- “文档”：悬停显示 `IconWidget`、`get_icon` 等的说明、参数表和示例，
  可能和 MCP 的 `get_reference` 重叠，来源要统一，避免与主库漂移。
- “语法提示、补全、检查”：参数名补全、取值提示、对旧名和假名（如 `light_color`、
  `class_name`）给诊断。注意主库 `.pyi` 已有类型信息，Pylance 和 pyright 本来就会
  提示签名；扩展要补的是它们**做不到的**部分（取值范围、废弃写法的原因、颜色和
  尺寸的可接受形式等）。先确认哪些是现有工具已覆盖的，别重复。
- “搜索和校验”：搜索图标并插入、悬停预览、`"mdi:` 补全、图标名不存在时给诊断
  （对应主库最大的痛点：会编出 `mdi:home-filled` 这类不存在的名字，运行时只得到占位图）。

要判断每一项是否必要，用户的标准是：**必要才做，不设数量上限，也不是越少越好**
（这是他对 MCP 工具设计的原话精神，同样适用于这里）。他明确批评过
“照搬 HeroUI 的做法而不顾这个库实际需要什么”，不要照搬别的扩展的功能清单。

和已有项目的分工要先想清楚，避免三处做同一件事：

- MCP 面向“AI 助手”，扩展面向“人在编辑器里写代码”。
- 若能直接调用已发布的 MCP 或复用其逻辑，就别重写一遍；但扩展是 TypeScript，
  MCP 是 Python，能不能复用、怎么复用，需要和用户讨论。

## 4. 技术与发布（均为建议，未定，动手前自己查最新文档）

- 语言与工具链：TypeScript + Node，`@vscode/vsce` 打包发布，`ovsx` 发 Open VSX。
  这与用户熟悉的 Python / uv 不同，**写 README 和 CONTRIBUTING 时讲清楚怎么装环境、
  怎么本地调试（Extension Development Host）和测试**。
- 要发**两个市场**：VS Code Marketplace（微软）和 Open VSX（Cursor、VSCodium 等用）。
  用户的用户里大概率有 AI 编辑器使用者。
- 凭据：据我查到的资料，两边都是用令牌（Azure DevOps 的 PAT，权限 Marketplace
  (Manage)；Open VSX 的 Access Token），存进 GitHub Secrets（常见命名 `VSCE_PAT`、
  `OVSX_PAT`）。**我没有核实微软是否已有类似 PyPI Trusted Publishing 的免令牌方式，
  请自己确认。** 令牌会过期，要在文档里写明更换办法。
- 账号与验证是首次发布最耗时的部分：Azure DevOps 组织和 Publisher、Eclipse 账号
  和发布者协议、Open VSX namespace；Cursor 还有额外验证（可选）。**这些只有用户能做，
  你只能给他一步一步的指引，且他嫌“说得太快”，一步一步来。**
- Marketplace 要求：必须有 LICENSE；README 里的图片要用 https 绝对地址（不能是 SVG）；
  审核大约一天。
- 发布方式倾向：推 `v*` tag 由 GitHub Actions 自动测试、打包、发布，
  与主库流程类似。CI 只在 macOS 上跑是主库的约定（用户踩过坑），本仓库是否沿用，问他。
- 许可证：MIT，与其他仓库一致。

## 5. 与用户协作的规则（他反复强调过）

1. **问方案时不要执行任何代码。** 他问“方案/怎么做”，你只回答，不动手。
2. **未得到明确的“开始/动手”之前不实施**，先讲清意图、要改哪些文件、影响面，再停下等确认。
3. **git 只读**：只准 `status`、`diff`、`log` 等，不准 add、commit、push 等。
   提交由用户做；你只告诉他 message 怎么写，命令用 PowerShell 写法。
4. **`uv` / `npm install` 之类安装和构建命令交给用户执行**，你给命令和说明。
   不要代用户跑测试，改完只做静态或语法检查。
5. **改文件用 Edit / Write，不要用 Bash 写脚本批量替换**（沙盒写入不可靠，他批评过）。
6. **不要在失败的方向上反复试**（他看过耗时截图后批评过）。同一路线两三次不成就停下说明。
7. **不要说废话和问显而易见的事**：这是开源项目、仓库公开，别再问。
8. **先说结论，再说理由**；他喜欢短交付。不要用 emoji。
9. 文档要让人看得懂，面向外部使用者和贡献者，**不能写成维护者私人项目记录**。
   README、公开文档、示例、错误提示用英文；给他的对话和交接文档用中文。
10. 代码注释精简，只说明用途和参数；“历史教训”不写进代码。
11. 自己没核实的事要如实标明“未核实”，不要当结论说。

## 6. 建议的第一步

1. 向用户复述你的理解，并问他：需要哪些语种，各功能具体做到什么程度，
   以及是否复用 MCP。
2. 读主库 `D:\Code\pyside-iconify` 的 `README.md`、`docs/architecture.md`，
   以及 MCP 的 `D:\Code\pyside-iconify-mcp\README.md`，了解已有能力和边界。
3. 查 VS Code 扩展开发和发布的最新官方文档，把结论（附来源）告诉用户。
4. 提出功能清单和目录结构方案，讲清取舍，**停下等用户说“开始”**。
5. 得到许可后再建 `package.json`、源码、测试、`README.md`、`LICENSE`、CI。

## 7. 参考位置

- 主库：`D:\Code\pyside-iconify`（`docs/roadmap.md`、`docs/architecture.md`）
- MCP：`D:\Code\pyside-iconify-mcp`
- Skill：`D:\Code\pyside-iconify-skill`
- MCP GitHub：<https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp>
- Skill GitHub：<https://github.com/LingChen-tsjmdlc/pyside-iconify-skill>
- 主库 GitHub：<https://github.com/LingChen-tsjmdlc/pyside-iconify>
