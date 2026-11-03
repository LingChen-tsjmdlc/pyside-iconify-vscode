# PySide Iconify for VS Code

`pyside-iconify` のドキュメント、補完、チェック、アイコン検索をエディタの中で。

[English](../../README.md) | [中文](README.zh-CN.md) | **日本語** | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Русский](README.ru.md) | [Português (BR)](README.pt-BR.md)

> このプロジェクトは Iconify プロジェクトとは **無関係** です。
>
> [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lingchen.pyside-iconify) と [Open VSX](https://open-vsx.org/extension/lingchen/pyside-iconify) で公開中。

## なぜ必要か

[pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify) は `QIcon` に新しいデータ源を与えます：`IconWidget("mdi:home", color="red")`。ただ、書き間違いに気づくのが遅くなりがちです：

- アイコン名はただの文字列なので、どのアイコンなのか見ただけではわからない
- 存在しないパラメータ名や、別の関数のパラメータは、その行が実行されて初めて失敗する
- `size`、`color`、`opacity`、`animation` に何を渡せるのか、つい忘れてしまう

この拡張機能は、その答えをエディタの中に持ち込みます。

## 機能

| 機能               | できること                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| コード内のアイコン | アイコン名の位置に実際のアイコンを描画し、ホバーすると大きく表示する                               |
| ドキュメント       | 呼び出しやそのパラメータにホバーすると、役割、受け付ける値、既定値を表示する                       |
| パラメータ         | パラメータ名の補完と、`animation`、`spin` などの値の補完                                           |
| チェック           | 不明なパラメータや矛盾するパラメータ、不正な値に下線を引く。綴りが近ければクイックフィックスを出す |
| アイコン名         | `icon` の文字列に 2 文字以上入力すると、Iconify のリアルタイム検索結果から画像付きで選べる         |
| アイコン検索       | `Ctrl+Alt+Shift+I`（macOS は `Cmd+Alt+Shift+I`）でアイコンを検索し、カーソル位置に挿入する         |

すべて、`pyside_iconify` からインポートした `IconWidget`、`get_icon`、`get_pixmap`、`set_icon` に対して働きます。チェックは確実なことだけを報告します。変数から来る値のように判断できないものには触れません。

## インラインアイコン

実際のアイコンを、アイコン名のある場所のコード内に描画します。対象は `icon` 引数だけで、`"mdi:home"` のような 1 行の通常の文字列に限ります。カーソルがある行は常に文字を表示するので、そのまま編集できます。引用符は常に残ります。どのスタイルでも、名前にホバーすると大きなアイコンが出ます。

スタイルは設定 `pyside-iconify.inlineIcons` で選びます：

| 値                 | 結果                                                 |
| ------------------ | ---------------------------------------------------- |
| `off`              | 文字のみ。アイコンは描画しません。                   |
| `iconBefore`       | アイコン、続いて文字。                               |
| `iconAfter`        | 文字、続いてアイコン。                               |
| `iconOnly`（既定） | アイコンのみ。アイコン名は隠します。                 |
| `gutter`           | 行番号の前のガターにアイコンを表示。文字は残ります。 |

```json
"pyside-iconify.inlineIcons": "iconOnly"
```

## キーボードショートカット

| キー                                             | 動作                                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `Ctrl+Alt+Shift+I`（macOS は `Cmd+Alt+Shift+I`） | Python ファイルでアイコン検索を開く。選んだ名前がカーソル位置に入る。                          |
| `Alt+Enter`                                      | Python ファイルでカーソル位置に候補を表示する。`icon` の文字列内では、候補はアイコン名になる。 |
| `Ctrl+Space`                                     | VS Code 標準のキー。候補リストの横の詳細パネルを開閉する。大きなアイコンはそこに表示される。   |

## Iconify IntelliSense

[Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify) の併用をおすすめします。こちらは Web 系の言語での Iconify を担当し、この拡張機能は Python の `pyside-iconify` を担当します。

既定では両者は重なりません。Iconify IntelliSense は設定 `iconify.languageIds` に挙げた言語でしか動かず、`python` は既定では含まれないからです。そこに `python` を追加した場合は、アイコン候補とインラインアイコンが二重に出ます。そのリストから外してください。それでも `.py` ファイルでホバーカードが二つ出るなら、その設定 `iconify.preview.exclude` に `**/*.py` を追加してください。

## 言語

メッセージは VS Code の表示言語に従います。専用の設定はありません。既定とフォールバックは英語です。

対応言語：English、中文、日本語、한국어、Español、Français、Deutsch、Русский、Português (BR)。

## 必要なものとネットワーク

- VS Code 1.73 以降
- `pyside_iconify` からインポートしている Python ファイル
- アイコン検索とアイコン画像のための、公開 Iconify API（`https://api.iconify.design`）へのネットワーク接続

送信するのは、検索した語とアイコン名だけです。コードはアップロードされず、Python の解析は手元のマシンで行います。

結果は拡張機能のストレージフォルダーにキャッシュされるので、繰り返しの操作は速く、API への呼び出しも減ります。検索結果は 14 日間、アイコンセットの一覧は 30 日間保持されます。アイコン画像はフォルダーを削除するまで残ります。ネットワークがなくても、ドキュメント、パラメータ補完、チェックは動き、キャッシュ済みのアイコンも表示されます。

## 既知の制限

- アイコンが存在するかどうかは確認しません。確認するのは `prefix:name` という形かどうかだけです。存在しない名前は、画像が出ないだけです。
- チェックはリテラル値だけを読みます。変数から来る値は判断しません。
- `iconOnly` は、VS Code が文書化していない CSS の書き方で文字を隠します。Iconify IntelliSense も同じ方法です。将来の VS Code がこれを無視すると、文字とアイコンの両方が表示されます。
- 検索ボックス内の画像には VS Code 1.81 以降が必要です。それより古い版では名前だけが表示されます。

## 関連プロジェクト

| プロジェクト                                                                     | 内容                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)             | ライブラリ本体                                         |
| [pyside-iconify-mcp](https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp)     | AI アシスタントが正しいコードを書くための MCP サーバー |
| [pyside-iconify-skill](https://github.com/LingChen-tsjmdlc/pyside-iconify-skill) | 正確な使い方をまとめた Agent Skill                     |

この拡張機能はエディタでコードを書く人向けで、残りの二つは AI アシスタント向けです。

## 開発

セットアップ、実行、デバッグは [CONTRIBUTING](../contributing/CONTRIBUTING.ja.md) を、コードの構成は [architecture](../architecture.md)（英語）を参照してください。

## ライセンス

[MIT](../../LICENSE)。アイコンコレクションはそれぞれのライセンスに従います。
