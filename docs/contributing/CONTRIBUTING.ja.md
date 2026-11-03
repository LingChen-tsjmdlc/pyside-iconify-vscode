# コントリビューションガイド

関心をお寄せいただきありがとうございます。このページでは、セットアップ、日常の作業の流れ、規約、翻訳について説明します。

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md) | **日本語** | [한국어](CONTRIBUTING.ko.md) | [Español](CONTRIBUTING.es.md) | [Français](CONTRIBUTING.fr.md) | [Deutsch](CONTRIBUTING.de.md) | [Русский](CONTRIBUTING.ru.md) | [Português (BR)](CONTRIBUTING.pt-BR.md)

## 必要なもの

| ツール          | 用途                                            |
| --------------- | ----------------------------------------------- |
| Node.js 22 以上 | ビルド、リンター、テストの実行                  |
| pnpm            | パッケージマネージャー（`npm install -g pnpm`） |
| Git             | バージョン管理                                  |
| VS Code         | 拡張機能の実行とデバッグ                        |

拡張機能の開発に Python を書く必要はありませんが、`pyside-iconify` を使う小さな Python ファイルがあると試すのに便利です。

## セットアップ

```powershell
pnpm install
```

## 実行とデバッグ

拡張機能は VS Code の中で動くため、VS Code のウィンドウを二つ使います：

- 一つ目のウィンドウは、コードを書いてデバッグする場所
- 二つ目のウィンドウは Extension Development Host と呼ばれ、拡張機能が読み込まれた通常の VS Code

手順：

1. このフォルダーを VS Code で開きます。
2. `F5` を押します。起動構成 `Run Extension` が TypeScript コンパイラーをウォッチモードで起動し、二つ目のウィンドウを開きます。
3. 二つ目のウィンドウで `.py` ファイルを開き、作業中の機能を試します。
4. 一つ目のウィンドウでコードを編集します。ウォッチタスクが保存時に再コンパイルします。二つ目のウィンドウで `Developer: Reload Window`（`Ctrl+R`、macOS では `Cmd+R`）を実行して新しいビルドを読み込みます。
5. ブレークポイントは一つ目のウィンドウで設定します。`console.log` の出力はそのデバッグコンソールに表示されます。

## コマンド

| コマンド           | 内容                                                          |
| ------------------ | ------------------------------------------------------------- |
| `pnpm run compile` | TypeScript を `out/` に一度だけコンパイルする                 |
| `pnpm run watch`   | 保存のたびに再コンパイルする                                  |
| `pnpm run lint`    | `src/` を ESLint でチェックする                               |
| `pnpm test`        | コンパイルとリントの後、実際の VS Code の中でテストを実行する |

初回の `pnpm test` は VS Code のコピーを `.vscode-test/` にダウンロードするため、一度だけネットワーク接続が必要です。`.npmrc` で `enable-pre-post-scripts` を有効にしています。これがないと、pnpm はテスト前のコンパイルとリントを省略します。

## テスト

- テストは `src/test/` にあり、名前は `*.test.ts` です。Mocha を使います。
- バグ修正には、修正がなければ失敗する回帰テストを付けます。
- 「例外が出ない」だけでなく、振る舞いをテストします。補完機能なら、あるコード行に対してどの候補が返るかを検証します。
- テストで実際のネットワークを使ってはいけません。Iconify クライアントはフェイクに置き換えます。

## プロジェクト構成

レイヤーとその理由は [docs/architecture.md](../architecture.md)（英語）を参照してください。「変更をどこに置くか」の要約：

| 変更の対象                                                  | 場所                   |
| ----------------------------------------------------------- | ---------------------- |
| Python コード中の呼び出しの読み取り、パラメータの規則、名前 | `src/core/`            |
| Iconify API へのリクエスト、キャッシュ                      | `src/iconify/`         |
| VS Code の機能：ホバー、補完、チェック、検索                | `src/features/`        |
| 起動時の機能登録                                            | `src/extension.ts`     |
| ユーザーに見えるテキスト                                    | 「ローカライズ」を参照 |

## ローカライズ

拡張機能は VS Code の表示言語に従います。独自の言語設定はなく、フォールバックは英語です。

- `package.json` 内のテキスト（コマンドのタイトル、設定の説明）は、`%pyside-iconify.search.title%` のようなキーを使います。英語の原文は `package.nls.json` に、各翻訳は `package.nls.<locale>.json` に置きます。
- コード内のテキストは `vscode.l10n.t("...")` を通します。翻訳は `l10n/bundle.l10n.<locale>.json` に置き、`package.json` の `l10n` フィールドでそのフォルダーを指します。
- 文の断片を連結してはいけません。プレースホルダーを使います：`vscode.l10n.t("Unknown parameter {0}", name)`。
- ロケール：`en`（原文）、`zh-cn`、`ja`、`ko`、`es`、`fr`、`de`、`ru`、`pt-br`。
- ユーザー向けの英語テキストを、ほかの場所にハードコードしないでください。

## 規約

- TypeScript は strict モードで書く。エクスポートするシグネチャに `any` を使わない。
- チェックは推測しない。確実なときだけ報告し、分からないもの（たとえば変数から来る値）には触れない。
- 入力を決して妨げない。Iconify API へのリクエストはデバウンスしてキャッシュし、ネットワークを必要としない機能はオフラインでも動くようにする。
- コメントは最小限にする：その関数が何のためにあり、引数が何を意味するかだけ。デバッグの経緯は書かない。
- コード、ドキュメント、コミットメッセージに絵文字を使わない。
- コミットメッセージは Conventional Commits に従う：英語、小文字、1 行。例：`feat: add icon search command`、`fix(completion): ignore strings outside calls`。種類：`feat`、`fix`、`docs`、`ci`、`chore`。

## 翻訳

README とこのページは `docs/` 以下に複数の言語で用意されています。英語（`README.md`、`CONTRIBUTING.md`）が正です。翻訳は英語版と同じ見出し、表、コードブロックを保ちます。翻訳の修正は歓迎で、最初のコントリビューションに最適です。
