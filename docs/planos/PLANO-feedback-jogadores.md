# Plano: feedback dos jogadores e crítica de design

Modo: Loop (sem confirmação). Branch: `feature/feedback-jogadores`.

## Enunciado canônico

- **Problema:** jogadores reclamam que o fim da rodada (sobretudo a primeira e a última, as cegas) passa rápido demais, que é difícil perceber a própria vez e que não há uma tela celebrando o vencedor. A crítica de design apontou ainda: carta na mesa sem dono visível, balão do tutorial cobrindo a mão no celular, feltro mal aproveitado no desktop, contraste do rosa com texto branco, verbo "toque" no desktop e tutorial longo.
- **Resultado esperado:** cada item abaixo corrigido, sem mudar as regras do jogo.
- **Como validar:** `npm run lint`, `typecheck`, `test`, `build` e `test:e2e` verdes; conferência visual no desktop (1440×900) e no celular (375×812) com `?cenario=10x5` e com o tutorial.

## Escopo negativo

- Sem ordem de eliminação no fim de partida: o contrato não traz a rodada em que cada um saiu [#8].
- Sem sons novos: "sua vez" já toca som e vibra (`useSonsDaMesa`).
- Placas cortadas no desktop com 9 adversários e layout de duas colunas no lobby ficam para depois.

## Premissas assumidas

1. "Fim da mão" = fim da rodada. A primeira e a última rodada são as cegas, que se resolvem sozinhas: a pausa do servidor cresce nelas e o cliente segura a revelação por mais tempo [#98].
2. A pausa normal entre vazas não muda: com bots jogando a cada 2 s, uma pausa maior faria a próxima carta cancelar a animação da vaza. Só a última vaza da rodada ganha leitura mais longa.
3. O dono da carta aparece com o primeiro nome completo, cortado com reticências quando for longo; o meu aparece como "Você".
4. Ao passar o mouse, focar ou tocar numa carta da mesa, ela ganha contorno rosa e o nome de quem jogou aparece acima dela. Isso sai só com CSS (`:hover` e `:focus-visible`/`:focus`, com `tabIndex=0`), sem estado [#7].
5. Rosa forte para fundos com texto branco: `#e0156f` (4,66:1). O neon `--rosa` continua nos brilhos e contornos [#3].
6. Tutorial rápido: o passo de boas-vindas oferece "Versão rápida", que pula os passos só explicativos (marcados `opcional`).
7. Decisões visuais seguem a identidade aprovada no CLAUDE.md. Mockup: não, porque são ajustes dentro de padrões que já existem e a tela do vencedor reaproveita painel, neon e tipografia.

## Passos

| #   | Arquivo                                            | Mudança                                                                                                                          | Prática    | Verificação                            |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------- |
| 1   | `apps/server/package.json`, `apps/web/src/App.tsx` | O servidor nativo lê o `.env` da raiz (`--env-file-if-exists`). Em dev, o aviso fala do servidor local em vez do plano gratuito. | [#80][#81] | `npm run dev` sobe na `PORT` do `.env` |
| 2   | `tokens.css` e CSS com fundo rosa e texto branco   | Token `--rosa-forte`                                                                                                             | [#3]       | Contraste ≥ 4,5                        |
| 3   | `MesaLinhas.tsx`, `mesa.css`                       | Nome do dono acima da carta que lidera; contorno rosa e nome nas demais ao passar o mouse, focar ou tocar                        | [#2]       | e2e + visual                           |
| 4   | `mesa.css`                                         | No desktop, cartas da mesa até 132 px e grupo centralizado                                                                       | [#7]       | visual 1440×900                        |
| 5   | `BalaoTutorial.tsx`, `roteiro.ts`                  | O balão evita cobrir a área preservada (`preservar`), usada no palpite da rodada de 3                                            | [#9]       | celular, passo 9                       |
| 6   | `roteiro.ts`, `BalaoTutorial.tsx`, `motor.ts`      | Verbo por tipo de ponteiro (tocar ou clicar) e versão rápida do tutorial                                                         | [#6]       | unit + e2e                             |
| 7   | `condutor-de-partidas.ts`, `main.ts`, testes       | Pausa de fim de rodada maior e com acréscimo na rodada cega                                                                      | [#3][#41]  | vitest                                 |
| 8   | `useAnimacaoDeVaza.ts`, `TelaMesa.tsx`             | Leitura maior na revelação cega e na última vaza da rodada                                                                       | [#3]       | visual                                 |
| 9   | `TelaMesa.tsx`, `mesa.css`, `useTituloDaVez`       | Faixa "SUA VEZ!" sobre o feltro, mão pulsando, título da aba e rolagem até a placa da vez                                        | [#2][#98]  | visual + e2e                           |
| 10  | `TelaFimDePartida.tsx`, `mesa.css`                 | Tela de vencedor com troféu, nome em destaque, confete em CSS e ações fixas                                                      | [#98]      | visual                                 |
| 11  | `lobby.css`                                        | "Iniciar partida" fixo no rodapé no celular                                                                                      | [#98]      | visual 375×812                         |
| 12  | README, CLAUDE.md, ENTREGA                         | Documentar os tempos novos e as decisões de layout                                                                               | [#96]      | leitura                                |

## Riscos e rollback

- Animação da vaza cancelada se a pausa crescer demais: mitigado pela premissa 2.
- Seletores do e2e podem mudar: rodar `test:e2e`.
- Rollback: reverter o merge da branch [#84].

## Definição de pronto

Lint, typecheck, testes, build e e2e verdes; capturas de desktop e celular conferidas; README e CLAUDE.md atualizados; `ENTREGA-feedback-jogadores.md` escrito.
