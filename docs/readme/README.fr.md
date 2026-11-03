# PySide Iconify for VS Code

Documentation, complétion, vérifications et recherche d'icônes pour `pyside-iconify`, directement dans l'éditeur.

[English](../../README.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | **Français** | [Deutsch](README.de.md) | [Русский](README.ru.md) | [Português (BR)](README.pt-BR.md)

> Ce projet n'est **pas** affilié au projet Iconify.
>
> Disponible sur le [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=lingchen.pyside-iconify) et sur [Open VSX](https://open-vsx.org/extension/lingchen/pyside-iconify).

## Pourquoi

[pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify) donne à `QIcon` une source de données : `IconWidget("mdi:home", color="red")`. Ses erreurs apparaissent tard :

- un nom d'icône n'est que du texte, on ne voit donc pas de quelle icône il s'agit
- un paramètre qui n'existe pas, ou qui appartient à une autre fonction, n'échoue qu'à l'exécution de la ligne
- les valeurs acceptées par `size`, `color`, `opacity` et `animation` sont faciles à oublier

Cette extension met ces réponses dans l'éditeur.

## Fonctions

| Fonction            | Ce que vous obtenez                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Icônes dans le code | L'icône réelle est dessinée à la place du nom, et le survol l'affiche en grand                                                                   |
| Documentation       | Survolez un appel ou l'un de ses paramètres pour voir son rôle, ses valeurs acceptées et sa valeur par défaut                                    |
| Paramètres          | Complétion des noms de paramètres et des valeurs de `animation`, `spin` et similaires                                                            |
| Vérifications       | Les paramètres inconnus ou en conflit et les valeurs invalides sont soulignés ; une orthographe proche donne une correction rapide               |
| Noms d'icônes       | Saisissez au moins deux caractères dans la chaîne `icon` et choisissez parmi les résultats de recherche Iconify en direct, chacun avec son image |
| Recherche d'icônes  | Appuyez sur `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` sur macOS) pour chercher des icônes et en insérer une au curseur                               |

Tout fonctionne sur `IconWidget`, `get_icon`, `get_pixmap` et `set_icon` importés depuis `pyside_iconify`. Les vérifications ne signalent que ce dont elles sont sûres. Ce qu'elles ne peuvent pas savoir, comme une valeur issue d'une variable, est laissé tel quel.

## Icônes en ligne

L'icône réelle est dessinée dans votre code, à l'endroit du nom de l'icône. Seul l'argument `icon` est traité, et seulement les chaînes simples sur une ligne comme `"mdi:home"`. La ligne où se trouve le curseur affiche toujours le texte, pour que vous puissiez le modifier. Les guillemets restent toujours. Survoler le nom affiche une icône plus grande dans tous les modes.

Choisissez le style avec le réglage `pyside-iconify.inlineIcons` :

| Valeur                  | Résultat                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| `off`                   | Texte seul. Aucune icône n'est dessinée.                             |
| `iconBefore`            | L'icône, puis le texte.                                              |
| `iconAfter`             | Le texte, puis l'icône.                                              |
| `iconOnly` (par défaut) | L'icône seule. Le nom de l'icône est masqué.                         |
| `gutter`                | L'icône dans la gouttière, avant le numéro de ligne. Le texte reste. |

```json
"pyside-iconify.inlineIcons": "iconOnly"
```

## Raccourcis clavier

| Touche                                           | Effet                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` sur macOS) | Ouvre la recherche d'icônes dans un fichier Python. Le nom choisi est écrit au curseur.                                             |
| `Alt+Enter`                                      | Affiche les suggestions au curseur dans un fichier Python. Dans une chaîne `icon`, ce sont des noms d'icônes.                       |
| `Ctrl+Space`                                     | Touche propre à VS Code pour ouvrir ou fermer le panneau de détails à côté de la liste de suggestions. La grande icône s'y affiche. |

## Iconify IntelliSense

[Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify) est recommandée. Elle couvre Iconify dans les langages web ; cette extension couvre `pyside-iconify` en Python.

Par défaut, elles ne se chevauchent pas, car Iconify IntelliSense ne fonctionne que dans les langages listés dans son réglage `iconify.languageIds`, et `python` n'en fait pas partie. Si vous y avez ajouté `python`, les suggestions d'icônes et les icônes en ligne apparaissent en double : retirez-le de cette liste. Si vous voyez encore deux cartes de survol dans les fichiers `.py`, ajoutez `**/*.py` à son réglage `iconify.preview.exclude`.

## Langue

Les messages suivent la langue d'affichage de VS Code. Il n'y a pas de réglage séparé. L'anglais est la langue par défaut et de repli.

Langues prises en charge : English, 中文, 日本語, 한국어, Español, Français, Deutsch, Русский, Português (BR).

## Prérequis et usage du réseau

- VS Code 1.73 ou plus récent
- Des fichiers Python qui importent depuis `pyside_iconify`
- Un accès réseau à l'API publique d'Iconify (`https://api.iconify.design`) pour la recherche d'icônes et leurs images

Seuls les mots que vous cherchez et les noms d'icônes sont envoyés. Votre code n'est pas téléversé et Python est analysé sur votre machine.

Les réponses sont mises en cache dans le dossier de stockage de l'extension : les opérations répétées sont rapides et l'API est moins sollicitée. Les recherches sont conservées 14 jours et les listes de jeux d'icônes 30 jours. Les images d'icônes restent jusqu'à ce que vous supprimiez le dossier. Sans réseau, la documentation, la complétion des paramètres et les vérifications fonctionnent toujours, et les icônes déjà en cache continuent de s'afficher.

## Limites connues

- L'existence d'une icône n'est pas vérifiée, seulement la forme `prefix:name`. Un nom inconnu n'affiche simplement pas d'image.
- Les vérifications ne lisent que les valeurs littérales. Une valeur issue d'une variable n'est jamais jugée.
- `iconOnly` masque le texte avec une astuce CSS que VS Code ne documente pas, la même que celle d'Iconify IntelliSense. Si une future version de VS Code l'ignore, le texte et l'icône s'afficheront ensemble.
- Les images dans la zone de recherche demandent VS Code 1.81 ou plus récent. Les versions plus anciennes n'affichent que les noms.

## Projets liés

| Projet                                                                           | Ce que c'est                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)             | La bibliothèque                                                    |
| [pyside-iconify-mcp](https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp)     | Un serveur MCP qui aide les assistants IA à écrire du code correct |
| [pyside-iconify-skill](https://github.com/LingChen-tsjmdlc/pyside-iconify-skill) | Un Agent Skill avec l'usage exact                                  |

Cette extension s'adresse à ceux qui écrivent du code dans l'éditeur ; les deux autres s'adressent aux assistants IA.

## Développement

Voir [CONTRIBUTING](../contributing/CONTRIBUTING.fr.md) pour installer, lancer et déboguer l'extension, et [architecture](../architecture.md) (en anglais) pour l'organisation du code.

## Licence

[MIT](../../LICENSE). Les collections d'icônes sont soumises à leurs propres licences.
