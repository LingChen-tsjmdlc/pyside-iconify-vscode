# Mitwirken

Danke für Ihr Interesse am Mitwirken. Diese Seite behandelt Einrichtung, den täglichen Ablauf, Konventionen und Übersetzungen.

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md) | [日本語](CONTRIBUTING.ja.md) | [한국어](CONTRIBUTING.ko.md) | [Español](CONTRIBUTING.es.md) | [Français](CONTRIBUTING.fr.md) | **Deutsch** | [Русский](CONTRIBUTING.ru.md) | [Português (BR)](CONTRIBUTING.pt-BR.md)

## Was Sie brauchen

| Werkzeug              | Wofür                                     |
| --------------------- | ----------------------------------------- |
| Node.js 22 oder neuer | Führt Build, Linter und Tests aus         |
| pnpm                  | Paketmanager (`npm install -g pnpm`)      |
| Git                   | Versionsverwaltung                        |
| VS Code               | Führt die Erweiterung aus und debuggt sie |

Sie müssen kein Python schreiben, um an der Erweiterung zu arbeiten, aber eine kleine Python-Datei, die `pyside-iconify` verwendet, ist zum Ausprobieren praktisch.

## Einrichten

```powershell
pnpm install
```

## Ausführen und debuggen

Eine Erweiterung läuft in VS Code selbst, daher arbeiten Sie mit zwei VS-Code-Fenstern:

- im ersten Fenster schreiben und debuggen Sie den Code
- das zweite Fenster, der Extension Development Host, ist ein normales VS Code mit geladener Erweiterung

Schritte:

1. Öffnen Sie diesen Ordner in VS Code.
2. Drücken Sie `F5`. Die Startkonfiguration `Run Extension` startet den TypeScript-Compiler im Überwachungsmodus und öffnet das zweite Fenster.
3. Öffnen Sie im zweiten Fenster eine `.py`-Datei und probieren Sie die Funktion aus, an der Sie arbeiten.
4. Bearbeiten Sie den Code im ersten Fenster. Die Überwachungsaufgabe kompiliert beim Speichern neu. Führen Sie im zweiten Fenster `Developer: Reload Window` aus (`Ctrl+R`, unter macOS `Cmd+R`), um den neuen Build zu laden.
5. Setzen Sie Haltepunkte im ersten Fenster. Ausgaben von `console.log` erscheinen in dessen Debugging-Konsole.

## Befehle

| Befehl             | Was er tut                                                             |
| ------------------ | ---------------------------------------------------------------------- |
| `pnpm run compile` | Kompiliert TypeScript einmal nach `out/`                               |
| `pnpm run watch`   | Kompiliert bei jedem Speichern neu                                     |
| `pnpm run lint`    | Prüft `src/` mit ESLint                                                |
| `pnpm test`        | Kompiliert, prüft und führt dann die Tests in einem echten VS Code aus |

Beim ersten `pnpm test` wird eine Kopie von VS Code nach `.vscode-test/` heruntergeladen, dafür ist einmal Netzwerkzugriff nötig. `.npmrc` schaltet `enable-pre-post-scripts` ein; ohne das überspringt pnpm den Kompilier- und Prüfschritt vor den Tests.

## Tests

- Tests liegen in `src/test/` und heißen `*.test.ts`. Sie verwenden Mocha.
- Jede Fehlerbehebung bringt einen Regressionstest mit, der ohne die Behebung fehlschlägt.
- Testen Sie das Verhalten, nicht nur „keine Ausnahme": Prüfen Sie bei einer Vervollständigung, welche Einträge für eine bestimmte Codezeile zurückkommen.
- Tests dürfen das echte Netzwerk nicht verwenden. Ersetzen Sie den Iconify-Client durch eine Attrappe.

## Projektaufbau

Die Schichten und ihre Gründe stehen in [docs/architecture.md](../architecture.md) (auf Englisch). Die Kurzfassung von „Wohin gehört meine Änderung":

| Die Änderung betrifft                                             | Ort                 |
| ----------------------------------------------------------------- | ------------------- |
| Aufrufe im Python-Code lesen, Parameterregeln, Namen              | `src/core/`         |
| Anfragen an die Iconify-API, Cache                                | `src/iconify/`      |
| Eine VS-Code-Funktion: Hover, Vervollständigung, Prüfungen, Suche | `src/features/`     |
| Funktionen beim Start registrieren                                | `src/extension.ts`  |
| Text, den der Benutzer sieht                                      | siehe Lokalisierung |

## Lokalisierung

Die Erweiterung folgt der Anzeigesprache von VS Code. Sie hat keine eigene Spracheinstellung, und Englisch ist der Rückfall.

- Text in `package.json` (Befehlstitel, Einstellungsbeschreibungen) verwendet einen Schlüssel wie `%pyside-iconify.search.title%`. Der englische Text steht in `package.nls.json`; jede Übersetzung in `package.nls.<locale>.json`.
- Text im Code läuft über `vscode.l10n.t("...")`. Übersetzungen liegen in `l10n/bundle.l10n.<locale>.json`, und `package.json` verweist mit dem Feld `l10n` auf diesen Ordner.
- Setzen Sie niemals Satzteile zusammen. Verwenden Sie Platzhalter: `vscode.l10n.t("Unknown parameter {0}", name)`.
- Locales: `en` (die Quelle), `zh-cn`, `ja`, `ko`, `es`, `fr`, `de`, `ru`, `pt-br`.
- Schreiben Sie keinen für Benutzer sichtbaren englischen Text an anderer Stelle fest.

## Konventionen

- TypeScript im Strict-Modus. Kein `any` in exportierten Signaturen.
- Prüfungen raten nicht. Melden Sie ein Problem nur, wenn es sicher ist; lassen Sie in Ruhe, was sich nicht wissen lässt (etwa ein Wert aus einer Variablen).
- Blockieren Sie nie das Tippen. Anfragen an die Iconify-API werden entprellt (Debounce) und zwischengespeichert, und jede Funktion, die kein Netzwerk braucht, funktioniert ohne.
- Kommentare bleiben minimal: wofür die Funktion da ist und was ihre Parameter bedeuten. Keine Fehlersuche-Geschichte.
- Keine Emojis in Code, Dokumentation oder Commit-Nachrichten.
- Commit-Nachrichten folgen Conventional Commits: Englisch, klein geschrieben, eine Zeile, zum Beispiel `feat: add icon search command` oder `fix(completion): ignore strings outside calls`. Typen: `feat`, `fix`, `docs`, `ci`, `chore`.

## Übersetzungen

Die README und diese Seite gibt es in mehreren Sprachen unter `docs/`. Englisch (`README.md`, `CONTRIBUTING.md`) ist maßgeblich. Eine Übersetzung behält dieselben Überschriften, Tabellen und Codeblöcke wie die englische Fassung. Korrekturen an Übersetzungen sind willkommen und gehören zu den einfachsten ersten Beiträgen.
