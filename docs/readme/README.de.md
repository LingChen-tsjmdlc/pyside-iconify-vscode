# PySide Iconify for VS Code

Dokumentation, Autovervollständigung, Prüfungen und Icon-Suche für `pyside-iconify`, direkt im Editor.

[English](../../README.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | **Deutsch** | [Русский](README.ru.md) | [Português (BR)](README.pt-BR.md)

> Dieses Projekt steht in **keiner** Verbindung zum Iconify-Projekt.
>
> Verfügbar im [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lingchen.pyside-iconify) und auf [Open VSX](https://open-vsx.org/extension/lingchen/pyside-iconify).

## Warum

[pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify) gibt `QIcon` eine Datenquelle: `IconWidget("mdi:home", color="red")`. Fehler fallen dabei spät auf:

- ein Icon-Name ist nur Text, man sieht ihm nicht an, welches Icon gemeint ist
- ein Parameter, den es nicht gibt oder der zu einer anderen Funktion gehört, scheitert erst, wenn die Zeile läuft
- welche Werte `size`, `color`, `opacity` und `animation` annehmen, vergisst man leicht

Diese Erweiterung holt die Antworten in den Editor.

## Funktionen

| Funktion      | Was du bekommst                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Icons im Code | Das echte Icon wird dort gezeichnet, wo der Icon-Name steht; beim Überfahren erscheint es größer                                              |
| Dokumentation | Fahre über einen Aufruf oder einen seiner Parameter, um Zweck, erlaubte Werte und Standardwert zu sehen                                       |
| Parameter     | Vervollständigung von Parameternamen und der Werte von `animation`, `spin` und ähnlichen                                                      |
| Prüfungen     | Unbekannte oder widersprüchliche Parameter und ungültige Werte werden unterstrichen; bei ähnlicher Schreibweise gibt es eine Schnellkorrektur |
| Icon-Namen    | Tippe zwei oder mehr Zeichen in den `icon`-String und wähle aus Live-Suchergebnissen von Iconify, jeweils mit Bild                            |
| Icon-Suche    | Mit `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` unter macOS) Icons suchen und eines an der Cursorposition einfügen                                  |

Alles funktioniert für `IconWidget`, `get_icon`, `get_pixmap` und `set_icon`, die aus `pyside_iconify` importiert werden. Die Prüfungen melden nur, was sie sicher wissen. Was sie nicht wissen können, etwa ein Wert aus einer Variablen, lassen sie in Ruhe.

## Inline-Icons

Das echte Icon wird im Code gezeichnet, dort wo der Icon-Name steht. Behandelt wird nur das Argument `icon`, und nur einfache einzeilige Strings wie `"mdi:home"`. Die Zeile mit dem Cursor zeigt immer den Text, damit du ihn bearbeiten kannst. Die Anführungszeichen bleiben immer. Beim Überfahren des Namens erscheint in jedem Modus ein größeres Icon.

Den Stil wählst du mit der Einstellung `pyside-iconify.inlineIcons`:

| Wert                  | Ergebnis                                            |
| --------------------- | --------------------------------------------------- |
| `off`                 | Nur Text. Es wird kein Icon gezeichnet.             |
| `iconBefore`          | Icon, dann der Text.                                |
| `iconAfter`           | Text, dann das Icon.                                |
| `iconOnly` (Standard) | Nur das Icon. Der Icon-Name ist verborgen.          |
| `gutter`              | Icon im Rand vor der Zeilennummer. Der Text bleibt. |

```json
"pyside-iconify.inlineIcons": "iconOnly"
```

## Tastenkürzel

| Taste                                              | Wirkung                                                                                                                                |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` unter macOS) | Öffnet in einer Python-Datei die Icon-Suche. Der gewählte Name wird am Cursor eingefügt.                                               |
| `Alt+Enter`                                        | Zeigt in einer Python-Datei Vorschläge am Cursor. In einem `icon`-String sind es Icon-Namen.                                           |
| `Ctrl+Space`                                       | Eigenes Kürzel von VS Code, um das Detailfenster neben der Vorschlagsliste zu öffnen oder zu schließen. Das große Icon erscheint dort. |

## Iconify IntelliSense

[Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify) wird empfohlen. Es deckt Iconify in Web-Sprachen ab; diese Erweiterung deckt `pyside-iconify` in Python ab.

Standardmäßig überschneiden sie sich nicht, denn Iconify IntelliSense arbeitet nur in den Sprachen aus seiner Einstellung `iconify.languageIds`, und `python` gehört nicht dazu. Wenn du `python` dort hinzugefügt hast, erscheinen Icon-Vorschläge und Inline-Icons doppelt: Entferne es aus dieser Liste. Siehst du in `.py`-Dateien trotzdem zwei Hover-Karten, füge `**/*.py` zu seiner Einstellung `iconify.preview.exclude` hinzu.

## Sprache

Die Meldungen folgen der Anzeigesprache von VS Code. Es gibt keine eigene Einstellung. Englisch ist Standard und Rückfall.

Unterstützt: English, 中文, 日本語, 한국어, Español, Français, Deutsch, Русский, Português (BR).

## Voraussetzungen und Netzwerknutzung

- VS Code 1.73 oder neuer
- Python-Dateien, die aus `pyside_iconify` importieren
- Netzwerkzugriff auf die öffentliche Iconify-API (`https://api.iconify.design`) für die Icon-Suche und die Icon-Bilder

Gesendet werden nur deine Suchbegriffe und die Namen der Icons. Dein Code wird nicht hochgeladen, und Python wird auf deinem Rechner geparst.

Antworten werden im Speicherordner der Erweiterung zwischengespeichert, damit Wiederholtes schnell geht und die API seltener gefragt wird. Suchen bleiben 14 Tage, Listen der Icon-Sets 30 Tage erhalten. Icon-Bilder bleiben, bis du den Ordner löschst. Ohne Netzwerk funktionieren Dokumentation, Parameter-Vervollständigung und Prüfungen weiter, und bereits gespeicherte Icons werden weiter angezeigt.

## Bekannte Grenzen

- Ob ein Icon existiert, wird nicht geprüft, nur die Form `prefix:name`. Ein unbekannter Name zeigt einfach kein Bild.
- Die Prüfungen lesen nur Literalwerte. Ein Wert aus einer Variablen wird nie beurteilt.
- `iconOnly` verbirgt den Text mit einem CSS-Trick, den VS Code nicht dokumentiert; Iconify IntelliSense nutzt denselben. Ignoriert ein künftiges VS Code ihn, sind Text und Icon zugleich zu sehen.
- Bilder im Suchfeld brauchen VS Code 1.81 oder neuer. Ältere Versionen zeigen nur Namen.

## Verwandte Projekte

| Projekt                                                                          | Was es ist                                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)             | Die Bibliothek                                                        |
| [pyside-iconify-mcp](https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp)     | Ein MCP-Server, der KI-Assistenten hilft, korrekten Code zu schreiben |
| [pyside-iconify-skill](https://github.com/LingChen-tsjmdlc/pyside-iconify-skill) | Ein Agent Skill mit der genauen Verwendung                            |

Diese Erweiterung ist für Menschen, die im Editor Code schreiben; die anderen beiden sind für KI-Assistenten.

## Entwicklung

Siehe [CONTRIBUTING](../contributing/CONTRIBUTING.de.md) zum Einrichten, Starten und Debuggen der Erweiterung und [architecture](../architecture.md) (auf Englisch) für den Aufbau des Codes.

## Lizenz

[MIT](../../LICENSE). Für Icon-Sammlungen gelten ihre eigenen Lizenzen.
