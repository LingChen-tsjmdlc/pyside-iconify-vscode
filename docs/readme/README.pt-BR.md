# PySide Iconify for VS Code

Documentação, preenchimento automático, verificações e busca de ícones para o `pyside-iconify`, direto no editor.

[English](../../README.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md) | [Русский](README.ru.md) | **Português (BR)**

> Este projeto **não** é afiliado ao projeto Iconify.
>
> Status: ainda não publicada no VS Code Marketplace nem no Open VSX. Para testar agora, execute-a a partir do código-fonte; veja [CONTRIBUTING](../contributing/CONTRIBUTING.pt-BR.md).

## Por que

O [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify) dá ao `QIcon` uma fonte de dados: `IconWidget("mdi:home", color="red")`. Os erros aparecem tarde:

- o nome de um ícone é só texto, então não dá para ver de qual ícone se trata
- um parâmetro que não existe, ou que pertence a outra função, só falha quando a linha é executada
- os valores aceitos por `size`, `color`, `opacity` e `animation` são fáceis de esquecer

Esta extensão leva essas respostas para o editor.

## Recursos

| Recurso          | O que você recebe                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Ícones no código | O ícone real é desenhado onde está o nome dele e, ao passar o mouse, aparece maior                                                       |
| Documentação     | Passe o mouse sobre uma chamada ou um de seus parâmetros para ver o que faz, os valores aceitos e o padrão                               |
| Parâmetros       | Preenchimento automático de nomes de parâmetros e dos valores de `animation`, `spin` e semelhantes                                       |
| Verificações     | Parâmetros desconhecidos ou em conflito e valores inválidos são sublinhados; se a grafia for parecida, há uma correção rápida            |
| Nomes de ícones  | Digite dois ou mais caracteres dentro da string `icon` e escolha entre os resultados da busca ao vivo do Iconify, cada um com sua imagem |
| Busca de ícones  | Pressione `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` no macOS) para buscar ícones e inserir um no cursor                                      |

Tudo funciona com `IconWidget`, `get_icon`, `get_pixmap` e `set_icon` importados de `pyside_iconify`. As verificações só informam o que têm certeza. O que não podem saber, como um valor vindo de uma variável, é deixado como está.

## Ícones embutidos

O ícone real é desenhado no seu código, onde está o nome do ícone. Só o argumento `icon` é tratado, e apenas strings simples de uma linha como `"mdi:home"`. A linha onde está o cursor sempre mostra o texto, para que você possa editá-lo. As aspas sempre ficam. Passar o mouse sobre o nome mostra um ícone maior em qualquer modo.

Escolha o estilo com a configuração `pyside-iconify.inlineIcons`:

| Valor               | Resultado                                                     |
| ------------------- | ------------------------------------------------------------- |
| `off`               | Só texto. Nenhum ícone é desenhado.                           |
| `iconBefore`        | O ícone e depois o texto.                                     |
| `iconAfter`         | O texto e depois o ícone.                                     |
| `iconOnly` (padrão) | Só o ícone. O nome do ícone fica oculto.                      |
| `gutter`            | Ícone na margem, antes do número da linha. O texto permanece. |

```json
"pyside-iconify.inlineIcons": "iconOnly"
```

## Atalhos de teclado

| Tecla                                           | O que faz                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl+Alt+Shift+I` (`Cmd+Alt+Shift+I` no macOS) | Abre a busca de ícones em um arquivo Python. O nome escolhido é escrito no cursor.                                            |
| `Alt+Enter`                                     | Mostra sugestões no cursor em um arquivo Python. Dentro de uma string `icon`, são nomes de ícones.                            |
| `Ctrl+Space`                                    | Tecla própria do VS Code para abrir ou fechar o painel de detalhes ao lado da lista de sugestões. O ícone grande aparece ali. |

## Iconify IntelliSense

O [Iconify IntelliSense](https://marketplace.visualstudio.com/items?itemName=antfu.iconify) é recomendado. Ele cobre o Iconify em linguagens web; esta extensão cobre o `pyside-iconify` em Python.

Por padrão eles não se sobrepõem, porque o Iconify IntelliSense só funciona nas linguagens da sua configuração `iconify.languageIds`, e `python` não está entre elas. Se você adicionou `python` ali, as sugestões de ícones e os ícones embutidos aparecem em dobro: remova-o dessa lista. Se ainda vir dois cartões ao passar o mouse em arquivos `.py`, adicione `**/*.py` à configuração `iconify.preview.exclude` dele.

## Idioma

As mensagens seguem o idioma de exibição do VS Code. Não há configuração própria. O inglês é o padrão e o idioma reserva.

Idiomas disponíveis: English, 中文, 日本語, 한국어, Español, Français, Deutsch, Русский, Português (BR).

## Requisitos e uso da rede

- VS Code 1.73 ou mais recente
- Arquivos Python que importam de `pyside_iconify`
- Acesso de rede à API pública do Iconify (`https://api.iconify.design`) para a busca de ícones e suas imagens

Só são enviadas as palavras que você busca e os nomes dos ícones. Seu código não é enviado, e o Python é analisado na sua máquina.

As respostas ficam em cache na pasta de armazenamento da extensão, então o que se repete é rápido e a API é chamada menos. As buscas são mantidas por 14 dias e as listas de conjuntos de ícones por 30 dias. As imagens dos ícones ficam até você apagar a pasta. Sem rede, a documentação, o preenchimento de parâmetros e as verificações continuam funcionando, e os ícones já guardados continuam aparecendo.

## Limitações conhecidas

- Não se verifica se um ícone existe, apenas se ele tem a forma `prefix:name`. Um nome desconhecido simplesmente fica sem imagem.
- As verificações só leem valores literais. Um valor vindo de uma variável nunca é julgado.
- `iconOnly` oculta o texto com um truque de CSS que o VS Code não documenta, o mesmo usado pelo Iconify IntelliSense. Se uma versão futura do VS Code o ignorar, o texto e o ícone aparecerão juntos.
- As imagens na caixa de busca exigem VS Code 1.81 ou mais recente. Versões anteriores mostram só os nomes.

## Projetos relacionados

| Projeto                                                                          | O que é                                                               |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [pyside-iconify](https://github.com/LingChen-tsjmdlc/pyside-iconify)             | A biblioteca                                                          |
| [pyside-iconify-mcp](https://github.com/LingChen-tsjmdlc/pyside-iconify-mcp)     | Um servidor MCP que ajuda assistentes de IA a escrever código correto |
| [pyside-iconify-skill](https://github.com/LingChen-tsjmdlc/pyside-iconify-skill) | Um Agent Skill com o uso exato                                        |

Esta extensão é para quem escreve código no editor; as outras duas são para assistentes de IA.

## Desenvolvimento

Veja [CONTRIBUTING](../contributing/CONTRIBUTING.pt-BR.md) para configurar, executar e depurar a extensão, e [architecture](../architecture.md) (em inglês) para entender a organização do código.

## Licença

[MIT](../../LICENSE). As coleções de ícones estão sujeitas às suas próprias licenças.
