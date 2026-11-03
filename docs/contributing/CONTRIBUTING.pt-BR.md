# Contribuindo

Obrigado pelo seu interesse em contribuir. Esta página cobre a configuração, o fluxo de trabalho diário, as convenções e as traduções.

[English](../../CONTRIBUTING.md) | [中文](CONTRIBUTING.zh-CN.md) | [日本語](CONTRIBUTING.ja.md) | [한국어](CONTRIBUTING.ko.md) | [Español](CONTRIBUTING.es.md) | [Français](CONTRIBUTING.fr.md) | [Deutsch](CONTRIBUTING.de.md) | [Русский](CONTRIBUTING.ru.md) | **Português (BR)**

## O que você precisa

| Ferramenta             | Para quê                                       |
| ---------------------- | ---------------------------------------------- |
| Node.js 22 ou superior | Executa a compilação, o linter e os testes     |
| pnpm                   | Gerenciador de pacotes (`npm install -g pnpm`) |
| Git                    | Controle de versão                             |
| VS Code                | Executa e depura a extensão                    |

Você não precisa escrever Python para trabalhar na extensão, mas um pequeno arquivo Python que use `pyside-iconify` ajuda a experimentá-la.

## Configuração

```powershell
pnpm install
```

## Executar e depurar

Uma extensão roda dentro do próprio VS Code, então você trabalha com duas janelas do VS Code:

- a primeira janela é onde você escreve e depura o código
- a segunda janela, chamada Extension Development Host, é um VS Code normal com a sua extensão carregada

Passos:

1. Abra esta pasta no VS Code.
2. Pressione `F5`. A configuração de execução `Run Extension` inicia o compilador TypeScript em modo de observação e abre a segunda janela.
3. Na segunda janela, abra um arquivo `.py` e experimente o recurso em que você está trabalhando.
4. Edite o código na primeira janela. A tarefa de observação recompila ao salvar. Na segunda janela, execute `Developer: Reload Window` (`Ctrl+R`, ou `Cmd+R` no macOS) para carregar a nova versão.
5. Defina os pontos de interrupção na primeira janela. A saída de `console.log` aparece no console de depuração dela.

## Comandos

| Comando            | O que faz                                                             |
| ------------------ | --------------------------------------------------------------------- |
| `pnpm run compile` | Compila o TypeScript para `out/` uma vez                              |
| `pnpm run watch`   | Recompila a cada salvamento                                           |
| `pnpm run lint`    | Verifica `src/` com o ESLint                                          |
| `pnpm test`        | Compila, verifica e depois executa os testes em um VS Code de verdade |

O primeiro `pnpm test` baixa uma cópia do VS Code em `.vscode-test/`, então precisa de rede uma vez. O `.npmrc` ativa `enable-pre-post-scripts`; sem isso, o pnpm pula a etapa de compilar e verificar antes dos testes.

## Testes

- Os testes ficam em `src/test/` e se chamam `*.test.ts`. Eles usam Mocha.
- Toda correção de bug traz um teste de regressão que falha sem a correção.
- Teste o comportamento, não apenas "nenhuma exceção": para um recurso de preenchimento, verifique quais itens voltam para uma dada linha de código.
- Os testes não devem usar a rede real. Troque o cliente do Iconify por um falso.

## Estrutura do projeto

Veja [docs/architecture.md](../architecture.md) (em inglês) para as camadas e seus motivos. A versão curta de "onde vai a minha mudança":

| A mudança afeta                                                  | Local              |
| ---------------------------------------------------------------- | ------------------ |
| Ler chamadas no código Python, regras de parâmetros, nomes       | `src/core/`        |
| Requisições à API do Iconify, cache                              | `src/iconify/`     |
| Um recurso do VS Code: hover, preenchimento, verificações, busca | `src/features/`    |
| Registrar os recursos na inicialização                           | `src/extension.ts` |
| Texto que o usuário vê                                           | veja Localização   |

## Localização

A extensão segue o idioma de exibição do VS Code. Ela não tem uma configuração de idioma própria, e o inglês é o idioma reserva.

- O texto em `package.json` (títulos de comandos, descrições de configurações) usa uma chave como `%pyside-iconify.search.title%`. O texto em inglês fica em `package.nls.json`; cada tradução fica em `package.nls.<locale>.json`.
- O texto no código passa por `vscode.l10n.t("...")`. As traduções ficam em `l10n/bundle.l10n.<locale>.json`, e o `package.json` aponta para essa pasta com o campo `l10n`.
- Nunca junte pedaços de frases. Use marcadores: `vscode.l10n.t("Unknown parameter {0}", name)`.
- Locales: `en` (a fonte), `zh-cn`, `ja`, `ko`, `es`, `fr`, `de`, `ru`, `pt-br`.
- Não escreva texto em inglês voltado ao usuário fixo em nenhum outro lugar.

## Convenções

- TypeScript em modo estrito. Sem `any` nas assinaturas exportadas.
- As verificações não adivinham. Informe um problema só quando houver certeza; deixe em paz o que não se pode saber (um valor vindo de uma variável, por exemplo).
- Nunca bloqueie a digitação. As requisições à API do Iconify usam debounce e cache, e todo recurso que não precisa de rede funciona sem ela.
- Os comentários ficam mínimos: para que serve a função e o que significam seus parâmetros. Sem histórico de depuração.
- Sem emoji no código, na documentação nem nas mensagens de commit.
- As mensagens de commit seguem o Conventional Commits: em inglês, minúsculas, uma linha, por exemplo `feat: add icon search command` ou `fix(completion): ignore strings outside calls`. Tipos: `feat`, `fix`, `docs`, `ci`, `chore`.

## Traduções

O README e esta página são oferecidos em vários idiomas em `docs/`. O inglês (`README.md`, `CONTRIBUTING.md`) é a fonte de verdade. Uma tradução mantém os mesmos títulos, tabelas e blocos de código da versão em inglês. Correções de traduções são bem-vindas e estão entre as primeiras contribuições mais fáceis.
