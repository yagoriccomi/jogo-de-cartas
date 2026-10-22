# Decisões — bot-situacoes — 2026-10-22

**Contexto:** treinar o bot (`apps/server/src/domain/estrategia-bot.ts`) para situações de empate (anulação), perda de vidas, anular a carta do outro e jogar menor. Hoje ele ignora quem joga depois, as cartas que já saíram, os palpites alheios e a anulação como tática.
**Modo:** levantar

## Situações de jogo previstas (viram casos de teste)

1. **Anular a líder:** A joga um 3 e está ganhando; o bot tem um 3 e já cumpriu o palpite. Anulando, a vaza vai para a segunda maior ou fica sem dono.
2. **Ser anulado depois:** o bot ganha com um K, mas ainda faltam jogadores e já se viu um K na última vaza (2 ou mais baralhos).
3. **Jogar menor:** o bot precisa de 1 vaza e tem manilha e um 2; a vaza atual está perdida, então ele queima o 2 e guarda a manilha.
4. **Palpite estourado:** pediu 1 e já fez 2. Foge de tudo pela escada abaixo.
5. **Palpite impossível:** pediu 3 e só dá 1. Ganha o máximo que puder.
6. **Vaza toda anulada:** quem abriu continua abrindo.
7. **Pé com número proibido:** o ideal fecharia a soma, então vai para o lado mais provável.
8. **Rodada cega:** se todos pediram 0 olhando a carta do bot, ela é forte.
9. **Manilhas saídas:** já saíram manilhas mais fortes, então a dele vale mais.
10. **Esperar a posição de pé da vaza:** o jogador logo depois do bot também precisa de vaza. O bot deixa esse jogador fazer a dele agora; na vaza seguinte, ele abre e o bot fica por último.

## Escada "não quero esta vaza" (vale antes da força das cartas)

1. Igualar a **maior** carta já anulada na mesa (carta morta).
2. Igualar a **menor** carta já anulada.
3. Anular a carta que está ganhando.
4. Jogar a **maior carta segura**: cada jogador que falta só consegue anular uma carta, então ela é segura quando há mais cartas válidas acima dela do que jogadores por vir. Exemplo: 3 e A na mesa, só falta o pé; qualquer carta abaixo do A está segura.
5. Uma carta menor que todas as válidas da mesa.
6. Uma menor que a que está ganhando.
7. A menor da mão (se não for o pé).
8. Sendo o pé e tudo ganha: joga a maior, porque fazer a vaza era inevitável.

| #   | Peso       | Pergunta                                      | Decisão                                                                                           | Consequência                                                                          |
| --- | ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Bloqueante | Como treinar o bot                            | Regras escritas + simulação de milhares de partidas para ajustar os números                       | Previsível e testável; sem serviço extra                                              |
| 2   | Bloqueante | Níveis de dificuldade                         | Um bot só, mais esperto (substitui o atual)                                                       | Nada muda no lobby                                                                    |
| 3   | Importante | Errar de propósito                            | Sim, as decisões não são estáticas; erro fixo de ~10% (vai para a 2ª melhor jogada)               | Precisa de sorteio injetado (`GeradorAleatorio`) para os testes serem determinísticos |
| 4   | Importante | Memória de cartas                             | Só a última vaza e as manilhas que já saíram na rodada ("bom, mas não perfeito")                  | A visão do bot precisa trazer a última vaza e as manilhas saídas                      |
| 5   | Importante | Anular a líder de propósito                   | Sempre que puder estragar, sem perder vida com isso                                               | Vira degrau 3 da escada e parte da sabotagem                                          |
| 6   | Importante | Qual carta usar quando várias ganham          | Depende de quem falta: sendo o último, a menor que ganha; senão, uma difícil de superar ou anular | Menos vazas perdidas para quem joga depois                                            |
| 7   | Importante | Risco de ser anulado depois                   | Sim, mas só com as cartas vistas na última vaza                                                   | Coerente com a memória limitada                                                       |
| 8   | Detalhe    | Descarte com o palpite cumprido               | A maior que perde, seguindo a escada acima                                                        | Escada substitui a regra atual                                                        |
| 9   | Importante | Palpite estourado                             | Fugir de toda vaza                                                                                | Usa a escada                                                                          |
| 10  | Importante | Palpite impossível                            | Ganhar o máximo                                                                                   | Cada vaza a mais salva uma vida                                                       |
| 11  | Importante | Sabotar os outros                             | Sempre que puder, sem custar vida a ele                                                           | Mesa mais competitiva                                                                 |
| 12  | Detalhe    | Alvo da sabotagem                             | Quem tem mais vidas; em empate, quem está para acertar                                            | Segura o líder sem perseguir humanos                                                  |
| 13  | Importante | Olhar os palpites dos outros                  | Sim, para ajustar (mesa pediu muito: pede menos, e vice-versa)                                    | Palpite mais realista                                                                 |
| 14  | Detalhe    | Pé com número proibido                        | O lado mais provável                                                                              | Erra menos                                                                            |
| 15  | Importante | Rodada cega                                   | Ler os palpites dos outros como pista da própria carta                                            | Bot bem mais forte na rodada de 1 carta                                               |
| 16  | Importante | Jogada automática do humano (prazo estourado) | O mesmo bot, inclusive sabotagem e escada                                                         | Um cérebro só para tudo                                                               |
| 17  | Bloqueante | Escada "não quero esta vaza"                  | Confirmada como descrita acima                                                                    | Cada degrau vira um caso de teste                                                     |
| 18  | Importante | Degrau 4 com várias cartas seguras            | Sem querer a vaza: a maior segura. Querendo: ganhar o mais perto possível do pé da vaza           | Posição tardia vira prioridade                                                        |
| 19  | Importante | Medida de sucesso na simulação                | Vidas perdidas por rodada e partidas vencidas, bot novo contra o atual                            | Números claros para ajustar as constantes                                             |

**Princípio de posição (do usuário):** a melhor posição de jogo é ser o "pé" da vaza. Se quem joga logo depois do bot também precisa de vaza, o bot deixa essa pessoa fazer a dela primeiro; na vaza seguinte, ela abre e o bot joga por último.

**Confirmações** (decisões antigas que continuam valendo): nenhuma (não havia decisões anteriores sobre o bot).
**Premissas:** nenhuma.
**Ainda em aberto:** nenhuma.
