# 기여 가이드

관심을 가져 주셔서 감사합니다. 이 문서는 환경 설정, 일상 작업 흐름, 규칙, 번역을 다룹니다.

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md) | [日本語](CONTRIBUTING.ja.md) | **한국어** | [Español](CONTRIBUTING.es.md) | [Français](CONTRIBUTING.fr.md) | [Deutsch](CONTRIBUTING.de.md) | [Русский](CONTRIBUTING.ru.md) | [Português (BR)](CONTRIBUTING.pt-BR.md)

## 필요한 것

| 도구            | 용도                                 |
| --------------- | ------------------------------------ |
| Node.js 22 이상 | 빌드, 린터, 테스트 실행              |
| pnpm            | 패키지 관리자(`npm install -g pnpm`) |
| Git             | 버전 관리                            |
| VS Code         | 확장 실행 및 디버깅                  |

확장을 개발하는 데 Python을 작성할 필요는 없지만, `pyside-iconify`를 쓰는 작은 Python 파일이 있으면 시험해 보기 편합니다.

## 설정

```powershell
pnpm install
```

## 실행과 디버깅

확장은 VS Code 안에서 실행되므로 VS Code 창을 두 개 사용합니다:

- 첫 번째 창은 코드를 작성하고 디버깅하는 곳
- 두 번째 창은 Extension Development Host라고 하며, 확장이 로드된 일반 VS Code

순서:

1. 이 폴더를 VS Code로 엽니다.
2. `F5`를 누릅니다. 실행 구성 `Run Extension`이 TypeScript 컴파일러를 감시 모드로 시작하고 두 번째 창을 엽니다.
3. 두 번째 창에서 `.py` 파일을 열고 작업 중인 기능을 시험합니다.
4. 첫 번째 창에서 코드를 수정합니다. 감시 작업이 저장할 때마다 다시 컴파일합니다. 두 번째 창에서 `Developer: Reload Window`(`Ctrl+R`, macOS에서는 `Cmd+R`)를 실행해 새 빌드를 불러옵니다.
5. 중단점은 첫 번째 창에서 설정합니다. `console.log` 출력은 그 창의 디버그 콘솔에 나타납니다.

## 명령

| 명령               | 설명                                            |
| ------------------ | ----------------------------------------------- |
| `pnpm run compile` | TypeScript를 `out/`로 한 번 컴파일              |
| `pnpm run watch`   | 저장할 때마다 다시 컴파일                       |
| `pnpm run lint`    | ESLint로 `src/` 검사                            |
| `pnpm test`        | 컴파일, 린트 후 실제 VS Code 안에서 테스트 실행 |

처음 `pnpm test`를 실행하면 VS Code 사본을 `.vscode-test/`에 내려받으므로 한 번은 네트워크가 필요합니다. `.npmrc`는 `enable-pre-post-scripts`를 켭니다. 이것이 없으면 pnpm이 테스트 전의 컴파일과 린트 단계를 건너뜁니다.

## 테스트

- 테스트는 `src/test/`에 있고 이름은 `*.test.ts`입니다. Mocha를 사용합니다.
- 모든 버그 수정에는 수정 없이는 실패하는 회귀 테스트를 함께 넣습니다.
- "예외가 없다"만 보지 말고 동작을 테스트합니다. 자동 완성이라면 특정 코드 줄에 대해 어떤 항목이 돌아오는지 검증합니다.
- 테스트는 실제 네트워크를 사용하면 안 됩니다. Iconify 클라이언트는 가짜로 교체합니다.

## 프로젝트 구조

계층과 그 이유는 [docs/architecture.md](../architecture.md)(영어)를 보세요. "내 변경은 어디에 두나"의 요약:

| 변경 대상                                    | 위치               |
| -------------------------------------------- | ------------------ |
| Python 코드의 호출 읽기, 매개변수 규칙, 이름 | `src/core/`        |
| Iconify API 요청, 캐시                       | `src/iconify/`     |
| VS Code 기능: 호버, 자동 완성, 검사, 검색    | `src/features/`    |
| 시작 시 기능 등록                            | `src/extension.ts` |
| 사용자에게 보이는 문구                       | "현지화" 참고      |

## 현지화

확장은 VS Code의 표시 언어를 따릅니다. 자체 언어 설정은 없으며 대체 언어는 영어입니다.

- `package.json`의 문구(명령 제목, 설정 설명)는 `%pyside-iconify.search.title%` 같은 키를 사용합니다. 영어 원문은 `package.nls.json`에, 각 번역은 `package.nls.<locale>.json`에 둡니다.
- 코드 안의 문구는 `vscode.l10n.t("...")`를 거칩니다. 번역은 `l10n/bundle.l10n.<locale>.json`에 두고, `package.json`의 `l10n` 필드가 그 폴더를 가리킵니다.
- 문장 조각을 이어 붙이지 마세요. 자리 표시자를 사용합니다: `vscode.l10n.t("Unknown parameter {0}", name)`.
- 로케일: `en`(원문), `zh-cn`, `ja`, `ko`, `es`, `fr`, `de`, `ru`, `pt-br`.
- 사용자에게 보이는 영어 문구를 다른 곳에 하드코딩하지 마세요.

## 규칙

- TypeScript는 엄격 모드로 작성합니다. 내보내는 시그니처에 `any`를 쓰지 않습니다.
- 검사는 추측하지 않습니다. 확실할 때만 보고하고, 알 수 없는 것(예: 변수에서 오는 값)은 건드리지 않습니다.
- 입력을 절대 막지 않습니다. Iconify API 요청은 디바운스하고 캐시하며, 네트워크가 필요 없는 기능은 오프라인에서도 동작해야 합니다.
- 주석은 최소로 유지합니다: 함수의 용도와 매개변수의 의미만 적고, 디버깅 이력은 쓰지 않습니다.
- 코드, 문서, 커밋 메시지에 이모지를 쓰지 않습니다.
- 커밋 메시지는 Conventional Commits를 따릅니다: 영어, 소문자, 한 줄. 예: `feat: add icon search command`, `fix(completion): ignore strings outside calls`. 유형: `feat`, `fix`, `docs`, `ci`, `chore`.

## 번역

README와 이 문서는 `docs/` 아래에 여러 언어로 제공됩니다. 영어(`README.md`, `CONTRIBUTING.md`)가 기준입니다. 번역은 영어판과 같은 제목, 표, 코드 블록을 유지합니다. 번역 수정은 환영하며, 첫 기여로 가장 쉬운 것 중 하나입니다.
