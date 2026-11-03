# PySide Iconify for VS Code

`pyside-iconify`의 문서, 자동 완성, 검사, 아이콘 검색을 에디터 안에서 제공합니다.

[English](../../README.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md) | **한국어** | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Русский](README.ru.md) | [Português (BR)](README.pt-BR.md)

> 이 프로젝트는 Iconify 프로젝트와 **관련이 없습니다**.
>
> [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lingchen.pyside-iconify)와 [Open VSX](https://open-vsx.org/extension/lingchen/pyside-iconify)에서 이용 가능합니다.

## 왜 필요한가

[pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)는 `QIcon`에 새로운 데이터 원본을 줍니다: `IconWidget("mdi:home", color="red")`. 하지만 실수는 뒤늦게 드러납니다:

- 아이콘 이름은 그냥 문자열이라서 어떤 아이콘인지 보이지 않는다
- 존재하지 않는 매개변수 이름이나 다른 함수의 매개변수는 그 줄이 실행될 때에야 실패한다
- `size`, `color`, `opacity`, `animation`이 어떤 값을 받는지 쉽게 잊는다

이 확장은 그 답을 에디터 안으로 가져옵니다.

## 기능

| 기능           | 제공하는 것                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------- |
| 코드 속 아이콘 | 아이콘 이름 자리에 실제 아이콘을 그리고, 마우스를 올리면 크게 보여 줌                           |
| 문서           | 호출이나 그 매개변수에 마우스를 올리면 역할, 허용하는 값, 기본값을 보여 줌                      |
| 매개변수       | 매개변수 이름과 `animation`, `spin` 같은 매개변수의 값을 자동 완성                              |
| 검사           | 알 수 없거나 서로 충돌하는 매개변수와 잘못된 값에 밑줄을 긋고, 철자가 비슷하면 빠른 수정을 제안 |
| 아이콘 이름    | `icon` 문자열 안에 두 글자 이상 입력하면 Iconify 실시간 검색 결과에서 그림과 함께 선택          |
| 아이콘 검색    | `Ctrl+Alt+Shift+I`(macOS는 `Cmd+Alt+Shift+I`)로 아이콘을 검색하고 커서 위치에 삽입              |

모두 `pyside_iconify`에서 가져온 `IconWidget`, `get_icon`, `get_pixmap`, `set_icon`에 대해 동작합니다. 검사는 확실한 것만 알려 줍니다. 변수에서 오는 값처럼 알 수 없는 것은 건드리지 않습니다.

## 인라인 아이콘

실제 아이콘을 코드 안의 아이콘 이름 자리에 그립니다. `icon` 인수만 다루며, `"mdi:home"` 같은 한 줄짜리 일반 문자열만 대상입니다. 커서가 있는 줄은 항상 글자를 보여 주므로 바로 편집할 수 있습니다. 따옴표는 언제나 남습니다. 어떤 스타일이든 이름 위에 마우스를 올리면 큰 아이콘이 나옵니다.

스타일은 `pyside-iconify.inlineIcons` 설정으로 고릅니다:

| 값                 | 결과                                                   |
| ------------------ | ------------------------------------------------------ |
| `off`              | 글자만. 아이콘을 그리지 않습니다.                      |
| `iconBefore`       | 아이콘, 그다음 글자.                                   |
| `iconAfter`        | 글자, 그다음 아이콘.                                   |
| `iconOnly`(기본값) | 아이콘만. 아이콘 이름은 숨깁니다.                      |
| `gutter`           | 줄 번호 앞 여백에 아이콘을 표시. 글자는 그대로 둡니다. |

```json
"pyside-iconify.inlineIcons": "iconOnly"
```

## 단축키

| 키                                            | 동작                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Ctrl+Alt+Shift+I`(macOS는 `Cmd+Alt+Shift+I`) | Python 파일에서 아이콘 검색을 엽니다. 고른 이름이 커서 위치에 들어갑니다.                          |
| `Alt+Enter`                                   | Python 파일에서 커서 위치에 제안을 표시합니다. `icon` 문자열 안에서는 제안이 아이콘 이름입니다.    |
| `Ctrl+Space`                                  | VS Code 기본 키로, 제안 목록 옆의 세부 정보 패널을 열거나 닫습니다. 큰 아이콘이 거기에 표시됩니다. |

## Iconify IntelliSense

[Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify)를 함께 설치하길 권합니다. 웹 언어에서의 Iconify는 그 확장이, Python의 `pyside-iconify`는 이 확장이 맡습니다.

기본값에서는 둘이 겹치지 않습니다. Iconify IntelliSense는 `iconify.languageIds` 설정에 나열된 언어에서만 동작하고, 기본 목록에는 `python`이 없기 때문입니다. 거기에 `python`을 추가했다면 아이콘 제안과 인라인 아이콘이 두 번씩 나옵니다. 그 목록에서 `python`을 지우세요. 그래도 `.py` 파일에서 호버 카드가 두 장 보이면, 그 확장의 `iconify.preview.exclude` 설정에 `**/*.py`를 추가하세요.

## 언어

메시지는 VS Code의 표시 언어를 따릅니다. 별도 설정은 없습니다. 기본 언어이자 대체 언어는 영어입니다.

지원: English, 中文, 日本語, 한국어, Español, Français, Deutsch, Русский, Português (BR).

## 요구 사항과 네트워크 사용

- VS Code 1.73 이상
- `pyside_iconify`에서 가져오는 Python 파일
- 아이콘 검색과 아이콘 그림을 위한 공개 Iconify API(`https://api.iconify.design`)에 대한 네트워크 접근

전송되는 것은 검색한 단어와 아이콘 이름뿐입니다. 코드는 업로드되지 않으며 Python 구문 분석은 내 컴퓨터에서 이루어집니다.

결과는 확장의 저장 폴더에 캐시되어 반복 작업이 빨라지고 API 호출도 줄어듭니다. 검색 결과는 14일, 아이콘 세트 목록은 30일 동안 보관됩니다. 아이콘 그림은 폴더를 지울 때까지 남습니다. 네트워크가 없어도 문서, 매개변수 자동 완성, 검사는 동작하고 캐시된 아이콘은 계속 표시됩니다.

## 알려진 제한

- 아이콘이 존재하는지는 확인하지 않습니다. `prefix:name` 형태인지만 확인합니다. 없는 이름은 그림이 나오지 않을 뿐입니다.
- 검사는 리터럴 값만 읽습니다. 변수에서 오는 값은 판단하지 않습니다.
- `iconOnly`는 VS Code가 문서화하지 않은 CSS 방식으로 글자를 숨기며, Iconify IntelliSense도 같은 방법을 씁니다. 이후 VS Code가 이를 무시하면 글자와 아이콘이 함께 표시됩니다.
- 검색 상자 안의 그림은 VS Code 1.81 이상이 필요합니다. 이전 버전에서는 이름만 표시됩니다.

## 관련 프로젝트

| 프로젝트                                                                         | 설명                                               |
| -------------------------------------------------------------------------------- | -------------------------------------------------- |
| [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)             | 라이브러리 본체                                    |
| [pyside-iconify-mcp](https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp)     | AI 어시스턴트가 올바른 코드를 쓰도록 돕는 MCP 서버 |
| [pyside-iconify-skill](https://github.com/LingChen-tsjmdlc/pyside-iconify-skill) | 정확한 사용법을 담은 Agent Skill                   |

이 확장은 에디터에서 코드를 쓰는 사람을 위한 것이고, 나머지 둘은 AI 어시스턴트를 위한 것입니다.

## 개발

확장을 설정하고 실행하고 디버그하는 방법은 [CONTRIBUTING](../contributing/CONTRIBUTING.ko.md), 코드 구조는 [architecture](../architecture.md)(영어)를 참고하세요.

## 라이선스

[MIT](../../LICENSE). 아이콘 컬렉션은 각자의 라이선스를 따릅니다.
