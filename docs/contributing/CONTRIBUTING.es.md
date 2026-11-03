# Contribuir

Gracias por tu interés en contribuir. Esta página cubre la preparación del entorno, el flujo de trabajo diario, las convenciones y las traducciones.

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md) | [日本語](CONTRIBUTING.ja.md) | [한국어](CONTRIBUTING.ko.md) | **Español** | [Français](CONTRIBUTING.fr.md) | [Deutsch](CONTRIBUTING.de.md) | [Русский](CONTRIBUTING.ru.md) | [Português (BR)](CONTRIBUTING.pt-BR.md)

## Qué necesitas

| Herramienta           | Para qué sirve                                  |
| --------------------- | ----------------------------------------------- |
| Node.js 22 o superior | Ejecuta la compilación, el linter y las pruebas |
| pnpm                  | Gestor de paquetes (`npm install -g pnpm`)      |
| Git                   | Control de versiones                            |
| VS Code               | Ejecuta y depura la extensión                   |

No necesitas escribir Python para trabajar en la extensión, pero un archivo Python pequeño que use `pyside-iconify` viene bien para probarla.

## Preparación

```powershell
pnpm install
```

## Ejecutar y depurar

Una extensión se ejecuta dentro del propio VS Code, así que trabajas con dos ventanas de VS Code:

- la primera ventana es donde escribes y depuras el código
- la segunda ventana, llamada Extension Development Host, es un VS Code normal con tu extensión cargada

Pasos:

1. Abre esta carpeta en VS Code.
2. Pulsa `F5`. La configuración de lanzamiento `Run Extension` inicia el compilador de TypeScript en modo de vigilancia y abre la segunda ventana.
3. En la segunda ventana, abre un archivo `.py` y prueba la función en la que trabajas.
4. Edita el código en la primera ventana. La tarea de vigilancia recompila al guardar. En la segunda ventana ejecuta `Developer: Reload Window` (`Ctrl+R`, o `Cmd+R` en macOS) para cargar la nueva compilación.
5. Pon los puntos de interrupción en la primera ventana. La salida de `console.log` aparece en su consola de depuración.

## Comandos

| Comando            | Qué hace                                                              |
| ------------------ | --------------------------------------------------------------------- |
| `pnpm run compile` | Compila TypeScript a `out/` una vez                                   |
| `pnpm run watch`   | Vuelve a compilar en cada guardado                                    |
| `pnpm run lint`    | Revisa `src/` con ESLint                                              |
| `pnpm test`        | Compila, revisa y luego ejecuta las pruebas dentro de un VS Code real |

La primera vez, `pnpm test` descarga una copia de VS Code en `.vscode-test/`, así que necesita red una vez. `.npmrc` activa `enable-pre-post-scripts`; sin eso, pnpm omite el paso de compilar y revisar antes de las pruebas.

## Pruebas

- Las pruebas están en `src/test/` y se llaman `*.test.ts`. Usan Mocha.
- Cada corrección de un error incluye una prueba de regresión que falla sin la corrección.
- Prueba el comportamiento, no solo que "no haya excepción": para una función de autocompletado, comprueba qué elementos devuelve una línea de código dada.
- Las pruebas no deben usar la red real. Sustituye el cliente de Iconify por uno falso.

## Estructura del proyecto

Consulta [docs/architecture.md](../architecture.md) (en inglés) para las capas y sus razones. La versión corta de "dónde va mi cambio":

| El cambio afecta a                                                      | Ubicación          |
| ----------------------------------------------------------------------- | ------------------ |
| Leer llamadas en código Python, reglas de parámetros, nombres           | `src/core/`        |
| Peticiones a la API de Iconify, caché                                   | `src/iconify/`     |
| Una función de VS Code: hover, autocompletado, comprobaciones, búsqueda | `src/features/`    |
| Registrar las funciones al arrancar                                     | `src/extension.ts` |
| Texto que ve el usuario                                                 | ver Localización   |

## Localización

La extensión sigue el idioma de la interfaz de VS Code. No tiene un ajuste de idioma propio, y el inglés es el idioma de reserva.

- El texto de `package.json` (títulos de comandos, descripciones de ajustes) usa una clave como `%pyside-iconify.search.title%`. El texto en inglés está en `package.nls.json`; cada traducción está en `package.nls.<locale>.json`.
- El texto en el código pasa por `vscode.l10n.t("...")`. Las traducciones están en `l10n/bundle.l10n.<locale>.json`, y `package.json` apunta a esa carpeta con el campo `l10n`.
- Nunca unas fragmentos de frases. Usa marcadores: `vscode.l10n.t("Unknown parameter {0}", name)`.
- Idiomas: `en` (el original), `zh-cn`, `ja`, `ko`, `es`, `fr`, `de`, `ru`, `pt-br`.
- No escribas en ningún otro sitio texto en inglés destinado al usuario.

## Convenciones

- TypeScript en modo estricto. Sin `any` en las firmas exportadas.
- Las comprobaciones no adivinan. Informa de un problema solo cuando sea seguro; deja en paz lo que no se puede saber (un valor que viene de una variable, por ejemplo).
- Nunca bloquees la escritura. Las peticiones a la API de Iconify se retrasan (debounce) y se guardan en caché, y toda función que no necesite red funciona sin ella.
- Los comentarios se mantienen mínimos: para qué sirve la función y qué significan sus parámetros. Sin historial de depuración.
- Sin emoji en el código, la documentación ni los mensajes de commit.
- Los mensajes de commit siguen Conventional Commits: en inglés, en minúsculas, una línea, por ejemplo `feat: add icon search command` o `fix(completion): ignore strings outside calls`. Tipos: `feat`, `fix`, `docs`, `ci`, `chore`.

## Traducciones

El README y esta página se ofrecen en varios idiomas dentro de `docs/`. El inglés (`README.md`, `CONTRIBUTING.md`) es la fuente de verdad. Una traducción mantiene los mismos títulos, tablas y bloques de código que la versión en inglés. Las correcciones de traducciones son bienvenidas y están entre las primeras contribuciones más fáciles.
