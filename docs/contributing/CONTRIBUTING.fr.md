# Contribuer

Merci de votre intérêt pour la contribution. Cette page couvre la mise en place, le travail au quotidien, les conventions et les traductions.

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md) | [日本語](CONTRIBUTING.ja.md) | [한국어](CONTRIBUTING.ko.md) | [Español](CONTRIBUTING.es.md) | **Français** | [Deutsch](CONTRIBUTING.de.md) | [Русский](CONTRIBUTING.ru.md) | [Português (BR)](CONTRIBUTING.pt-BR.md)

## Ce qu'il vous faut

| Outil              | À quoi il sert                                  |
| ------------------ | ----------------------------------------------- |
| Node.js 22 ou plus | Exécute la compilation, le linter et les tests  |
| pnpm               | Gestionnaire de paquets (`npm install -g pnpm`) |
| Git                | Gestion de versions                             |
| VS Code            | Exécute et débogue l'extension                  |

Vous n'avez pas besoin d'écrire du Python pour travailler sur l'extension, mais un petit fichier Python qui utilise `pyside-iconify` est pratique pour l'essayer.

## Mise en place

```powershell
pnpm install
```

## Lancer et déboguer

Une extension s'exécute dans VS Code lui-même, vous travaillez donc avec deux fenêtres VS Code :

- la première fenêtre sert à écrire et déboguer le code
- la seconde fenêtre, appelée Extension Development Host, est un VS Code ordinaire avec votre extension chargée

Étapes :

1. Ouvrez ce dossier dans VS Code.
2. Appuyez sur `F5`. La configuration de lancement `Run Extension` démarre le compilateur TypeScript en mode surveillance et ouvre la seconde fenêtre.
3. Dans la seconde fenêtre, ouvrez un fichier `.py` et essayez la fonction sur laquelle vous travaillez.
4. Modifiez le code dans la première fenêtre. La tâche de surveillance recompile à chaque enregistrement. Dans la seconde fenêtre, lancez `Developer: Reload Window` (`Ctrl+R`, ou `Cmd+R` sur macOS) pour charger la nouvelle version.
5. Posez les points d'arrêt dans la première fenêtre. La sortie de `console.log` apparaît dans sa console de débogage.

## Commandes

| Commande           | Ce qu'elle fait                                             |
| ------------------ | ----------------------------------------------------------- |
| `pnpm run compile` | Compile le TypeScript vers `out/` une fois                  |
| `pnpm run watch`   | Recompile à chaque enregistrement                           |
| `pnpm run lint`    | Vérifie `src/` avec ESLint                                  |
| `pnpm test`        | Compile, vérifie, puis lance les tests dans un vrai VS Code |

Le premier `pnpm test` télécharge une copie de VS Code dans `.vscode-test/`, il faut donc un accès réseau une fois. `.npmrc` active `enable-pre-post-scripts` ; sans cela, pnpm saute l'étape de compilation et de vérification avant les tests.

## Tests

- Les tests se trouvent dans `src/test/` et s'appellent `*.test.ts`. Ils utilisent Mocha.
- Chaque correction de bogue s'accompagne d'un test de régression qui échoue sans la correction.
- Testez le comportement, pas seulement l'absence d'exception : pour une fonction de complétion, vérifiez quels éléments reviennent pour une ligne de code donnée.
- Les tests ne doivent pas utiliser le vrai réseau. Remplacez le client Iconify par un faux.

## Structure du projet

Voir [docs/architecture.md](../architecture.md) (en anglais) pour les couches et leurs raisons. La version courte de « où va mon changement » :

| Le changement touche                                                   | Emplacement        |
| ---------------------------------------------------------------------- | ------------------ |
| Lecture des appels dans le code Python, règles de paramètres, noms     | `src/core/`        |
| Requêtes à l'API Iconify, cache                                        | `src/iconify/`     |
| Une fonction de VS Code : survol, complétion, vérifications, recherche | `src/features/`    |
| Enregistrement des fonctions au démarrage                              | `src/extension.ts` |
| Texte vu par l'utilisateur                                             | voir Localisation  |

## Localisation

L'extension suit la langue d'affichage de VS Code. Elle n'a pas de réglage de langue propre, et l'anglais est la langue de repli.

- Le texte dans `package.json` (titres de commandes, descriptions de réglages) utilise une clé comme `%pyside-iconify.search.title%`. Le texte anglais se trouve dans `package.nls.json` ; chaque traduction dans `package.nls.<locale>.json`.
- Le texte dans le code passe par `vscode.l10n.t("...")`. Les traductions se trouvent dans `l10n/bundle.l10n.<locale>.json`, et `package.json` pointe vers ce dossier avec le champ `l10n`.
- Ne collez jamais des morceaux de phrases. Utilisez des marqueurs : `vscode.l10n.t("Unknown parameter {0}", name)`.
- Locales : `en` (la source), `zh-cn`, `ja`, `ko`, `es`, `fr`, `de`, `ru`, `pt-br`.
- N'écrivez en dur nulle part ailleurs du texte anglais destiné à l'utilisateur.

## Conventions

- TypeScript en mode strict. Pas de `any` dans les signatures exportées.
- Les vérifications ne devinent pas. Ne signalez un problème que s'il est certain ; laissez de côté ce qui ne peut pas être su (une valeur issue d'une variable, par exemple).
- Ne bloquez jamais la saisie. Les requêtes à l'API Iconify sont temporisées (debounce) et mises en cache, et toute fonction qui n'a pas besoin du réseau marche sans lui.
- Les commentaires restent minimaux : à quoi sert la fonction et ce que signifient ses paramètres. Pas d'historique de débogage.
- Pas d'emoji dans le code, la documentation ni les messages de commit.
- Les messages de commit suivent Conventional Commits : en anglais, en minuscules, sur une ligne, par exemple `feat: add icon search command` ou `fix(completion): ignore strings outside calls`. Types : `feat`, `fix`, `docs`, `ci`, `chore`.

## Traductions

Le README et cette page existent en plusieurs langues sous `docs/`. L'anglais (`README.md`, `CONTRIBUTING.md`) fait foi. Une traduction garde les mêmes titres, tableaux et blocs de code que la version anglaise. Les corrections de traductions sont les bienvenues et comptent parmi les premières contributions les plus faciles.
