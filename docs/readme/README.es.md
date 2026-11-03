# PySide Iconify for VS Code

Documentación, autocompletado, comprobaciones y búsqueda de iconos para `pyside-iconify`, dentro del editor.

[English](../../README.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | **Español** | [Français](README.fr.md) | [Deutsch](README.de.md) | [Русский](README.ru.md) | [Português (BR)](README.pt-BR.md)

> Este proyecto **no** está afiliado al proyecto Iconify.
>
> Estado: todavía no está publicada en el VS Code Marketplace ni en Open VSX. Para probarla ahora, ejecútala desde el código fuente; consulta [CONTRIBUTING](../contributing/CONTRIBUTING.es.md).

## Por qué

[pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify) da a `QIcon` una fuente de datos: `IconWidget("mdi:home", color="red")`. Sus errores se descubren tarde:

- un nombre de icono es solo texto, así que no se ve de qué icono se trata
- un parámetro que no existe, o que pertenece a otra función, solo falla cuando se ejecuta la línea
- los valores aceptados por `size`, `color`, `opacity` y `animation` son fáciles de olvidar

Esta extensión lleva esas respuestas al editor.

## Funciones

| Función             | Qué obtienes                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iconos en el código | El icono real se dibuja donde está su nombre y, al pasar el ratón, se muestra más grande                                                          |
| Documentación       | Pasa el ratón sobre una llamada o uno de sus parámetros para ver qué hace, sus valores aceptados y su valor por defecto                           |
| Parámetros          | Autocompletado de nombres de parámetros y de los valores de `animation`, `spin` y similares                                                       |
| Comprobaciones      | Se subrayan los parámetros desconocidos o en conflicto y los valores no válidos; si el nombre se parece a uno correcto, hay una corrección rápida |
| Nombres de iconos   | Escribe dos o más caracteres dentro de la cadena `icon` y elige entre los resultados de búsqueda en vivo de Iconify, cada uno con su imagen       |
| Búsqueda de iconos  | Pulsa `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` en macOS) para buscar iconos e insertar uno en el cursor                                              |

Todo funciona con `IconWidget`, `get_icon`, `get_pixmap` y `set_icon` importados de `pyside_iconify`. Las comprobaciones solo informan de lo que tienen claro. Lo que no pueden saber, como un valor que viene de una variable, se deja tal cual.

## Iconos en línea

El icono real se dibuja en tu código, donde está el nombre del icono. Solo se trata el argumento `icon`, y solo cadenas normales de una línea como `"mdi:home"`. La línea donde está el cursor siempre muestra el texto, para que puedas editarlo. Las comillas siempre se conservan. Al pasar el ratón sobre el nombre se muestra un icono más grande en cualquier modo.

Elige el estilo con el ajuste `pyside-iconify.inlineIcons`:

| Valor                    | Resultado                                                            |
| ------------------------ | -------------------------------------------------------------------- |
| `off`                    | Solo texto. No se dibuja ningún icono.                               |
| `iconBefore`             | Icono y después el texto.                                            |
| `iconAfter`              | Texto y después el icono.                                            |
| `iconOnly` (por defecto) | Solo el icono. El nombre del icono se oculta.                        |
| `gutter`                 | Icono en el margen, antes del número de línea. El texto se mantiene. |

```json
"pyside-iconify.inlineIcons": "iconOnly"
```

## Atajos de teclado

| Tecla                                           | Qué hace                                                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` en macOS) | Abre la búsqueda de iconos en un archivo Python. El nombre elegido se escribe en el cursor.                                        |
| `Alt+Enter`                                     | Muestra sugerencias en el cursor en un archivo Python. Dentro de una cadena `icon`, son nombres de iconos.                         |
| `Ctrl+Space`                                    | Tecla propia de VS Code para abrir o cerrar el panel de detalles junto a la lista de sugerencias. Allí se muestra el icono grande. |

## Iconify IntelliSense

Se recomienda [Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify). Cubre Iconify en lenguajes web; esta extensión cubre `pyside-iconify` en Python.

Por defecto no se solapan, porque Iconify IntelliSense solo funciona en los lenguajes de su ajuste `iconify.languageIds`, y `python` no está entre ellos. Si añadiste `python` ahí, obtienes sugerencias de iconos e iconos en línea por duplicado: quítalo de esa lista. Si aun así ves dos tarjetas al pasar el ratón en archivos `.py`, añade `**/*.py` a su ajuste `iconify.preview.exclude`.

## Idioma

Los mensajes siguen el idioma de la interfaz de VS Code. No hay un ajuste aparte. El inglés es el idioma por defecto y el de reserva.

Idiomas disponibles: English, 中文, 日本語, 한국어, Español, Français, Deutsch, Русский, Português (BR).

## Requisitos y uso de la red

- VS Code 1.73 o posterior
- Archivos Python que importen de `pyside_iconify`
- Acceso de red a la API pública de Iconify (`https://api.iconify.design`) para la búsqueda de iconos y sus imágenes

Solo se envían las palabras que buscas y los nombres de los iconos. Tu código no se sube y Python se analiza en tu equipo.

Las respuestas se guardan en la carpeta de almacenamiento de la extensión, así que lo repetido es rápido y se llama menos a la API. Las búsquedas se conservan 14 días y las listas de conjuntos de iconos 30 días. Las imágenes de los iconos se conservan hasta que borres la carpeta. Sin red, la documentación, el autocompletado de parámetros y las comprobaciones siguen funcionando, y los iconos ya guardados se siguen mostrando.

## Limitaciones conocidas

- No se comprueba si un icono existe, solo que tenga la forma `prefix:name`. Un nombre desconocido simplemente no muestra imagen.
- Las comprobaciones solo leen valores literales. Un valor que viene de una variable nunca se juzga.
- `iconOnly` oculta el texto con un truco de CSS que VS Code no documenta, el mismo que usa Iconify IntelliSense. Si una versión futura de VS Code lo ignora, se verán a la vez el texto y el icono.
- Las imágenes del cuadro de búsqueda requieren VS Code 1.81 o posterior. Las versiones anteriores muestran solo los nombres.

## Proyectos relacionados

| Proyecto                                                                         | Qué es                                                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)             | La biblioteca                                                               |
| [pyside-iconify-mcp](https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp)     | Un servidor MCP que ayuda a los asistentes de IA a escribir código correcto |
| [pyside-iconify-skill](https://github.com/LingChen-tsjmdlc/pyside-iconify-skill) | Un Agent Skill con el uso exacto                                            |

Esta extensión es para quien escribe código en el editor; las otras dos son para asistentes de IA.

## Desarrollo

Consulta [CONTRIBUTING](../contributing/CONTRIBUTING.es.md) para preparar, ejecutar y depurar la extensión, y [architecture](../architecture.md) (en inglés) para ver cómo está organizado el código.

## Licencia

[MIT](../../LICENSE). Las colecciones de iconos están sujetas a sus propias licencias.
