# PLANO DE EXECUÇÃO — pausa-entrada-moderacao

| Campo | Valor |
|---|---|
| **Tarefa** | `pausa-entrada-moderacao` |
| **Origem** | descrição livre (conversa) |
| **Tipo** | História |
| **Modo de execução** | 💬 Interativo |
| **Data** | 2026-10-13 |
| **Branch** | `feature/pausa-entrada-moderacao` |

---

## 1. Enunciado Canônico

- **Problema:** hoje uma queda de conexão faz o servidor jogar sozinho pelo ausente; ninguém entra com a partida em andamento; o dono não consegue reiniciar a sala nem banir ninguém.
- **Resultado esperado:** (a) desconexão pausa a partida e abre votação "Deseja esperar o retorno do [APELIDO]?" — todos os presentes votando NÃO eliminam o ausente; (b) dá para entrar no meio da partida com a vida do jogador mais vivo; (c) só o dono reinicia a sala (rodada 1, vidas cheias para todos) e expulsa pessoas; expulso não volta.
- **Como validar:** com 2 navegadores + bots: fechar uma aba pausa o jogo para o outro, votar NÃO elimina; abrir uma 3ª aba com o código entra na rodada seguinte com a maior vida; o dono reinicia e expulsa; a aba expulsa não consegue reentrar.

## 2. Escopo

**Vou fazer:**
- Pausa por desconexão com votação SIM/NÃO por jogador ausente.
- Entrada no meio da partida (assento novo a partir da próxima rodada).
- Reiniciar sala (dono) e expulsar com banimento por navegador (dono).
- Ajustar regras confirmadas: teto recalculado a cada rodada (já é assim), vencedor menos negativo/empate, vaza anulada, ordem do truco paulista (já implementados).
- Interface funcional dessas ações no visual ATUAL (o restyle segue a direção de design aprovada, em tarefa própria).

**NÃO vou fazer (escopo negativo)** [#8]:
- Login/banimento à prova de aba anônima (fase 2).
- Aplicar o novo visual (aguarda escolha entre as 6 variações).
- Chat, tempo máximo de pausa, votação para expulsar (só o dono expulsa).

## 3. Premissas Assumidas (respostas do usuário + decisões a confirmar)

| # | Premissa | Por quê | Se estiver errada… |
|---|---|---|---|
| R1 | Máximo de cartas recalculado toda rodada | resposta do usuário | — |
| R2 | Quem sai no meio da rodada: bot termina a rodada dele e então ele é eliminado/removido | resposta do usuário | `Partida` |
| R3 | Banimento pelo navegador (identificador salvo no navegador) | resposta do usuário; driblável com aba anônima | fase 2 com login |
| R4 | Se o dono sai, o posto vai para quem está há mais tempo; o criador recupera se voltar pelo mesmo navegador | resposta do usuário | `Sala` |
| P1 | A pausa só começa após **10 s** desconectado (recarregar a página não pausa) | evitar pausa por piscada de rede `[#3]` | constante |
| P2 | Votam só os humanos conectados; bots não votam; voto pode ser trocado a qualquer momento | justiça | `Sala` |
| P3 | Basta um SIM para continuar esperando; sem limite de tempo; o ausente voltando, a partida segue | regra pedida | adicionar limite |
| P4 | Com a partida pausada, nada anda: sem prazo da vez e sem jogada de bot | consistência | `CondutorDePartidas` |
| P5 | Vários ausentes ao mesmo tempo: uma votação por ausente; a partida só volta quando todas se resolvem | regra pedida | — |
| P6 | Votado para fora = **eliminado** (continua na sala como espectador e volta num reinício); sair por vontade própria ou ser expulso = **removido** da sala | diferenciar castigo de saída | `Sala`/`Partida` |
| P7 | Quem entra no meio espera como espectador e senta na **próxima rodada**, no fim da mesa, com a maior vida entre os vivos | não dá para entrar com cartas já distribuídas | `Partida` |
| P8 | Limite de 10 participantes vale também para quem entra no meio | regra existente | — |
| P9 | Reiniciar: a qualquer momento (com confirmação na tela); todos — inclusive eliminados e quem está esperando — voltam com as vidas iniciais na rodada 1 | regra pedida | — |
| P10 | O dono expulsa humanos (com banimento) e bots (sem banimento), no lobby ou na partida | regra pedida | — |

## 4. Decisão Visual

- **Tem superfície visual?** Sim — aviso de pausa com SIM/NÃO, botões de reiniciar/expulsar, estado "esperando a próxima rodada".
- **Precisa de mockup?** Não agora — os elementos novos entram no visual atual; a direção visual definitiva está em aprovação (canvas das 6 variações) e será aplicada em tarefa própria.
- **`design-de-interface-projeto` acionada?** Sim, pelo agente do frontend, para os componentes novos (diálogo de confirmação, aviso de pausa).

## 5. Terreno (o que já existe)

| Arquivo | Papel hoje | O que muda |
|---|---|---|
| `packages/shared/src/eventos.ts` | Contrato de eventos | `dispositivoId` em criar/entrar/reconectar; `sala:expulsar`, `sala:reiniciar`, `jogo:votarEspera`; `ParticipanteSala.aguardandoRodada` |
| `packages/shared/src/estado.ts` | Estado visível | `pausa` (ausentes + votos) |
| `apps/server/src/domain/partida.ts` | Agregado da partida | saída ao fim da rodada, entrada de jogador, reinício |
| `apps/server/src/domain/sala.ts` | Regras de sala | banidos, criador, pausa/votação, entrada no meio |
| `apps/server/src/application/*` | Casos de uso e condutor | carência de 10 s, pausa congela agendamentos, novos casos de uso |
| `apps/server/src/infrastructure/socket/gateway.ts` | Eventos | novos eventos |
| `apps/web/src/*` | UI | identificador do navegador, aviso de pausa, reiniciar, expulsar, espera |

**Reaproveitamento** [#6]: a estratégia do bot já joga pelo ausente — usada para "bot termina a rodada".

## 6. Passos Atômicos

| # | Arquivo alvo | O que muda (1 frase) | Prática | Como verificar |
|---|---|---|---|---|
| 1 | `packages/shared` | Contrato novo (dispositivo, pausa, votos, expulsar, reiniciar, espera) | `[#11][#28]` | typecheck |
| 2 | `domain/partida.ts` | `agendarSaida` (bot termina a rodada, depois elimina/remove), `adicionarJogador` (entra na próxima rodada com a maior vida), `reiniciar` | `[#30][#2]` | testes unitários |
| 3 | `domain/sala.ts` | Criador, banidos por dispositivo, expulsar, reiniciar, entrada no meio, votação de espera | `[#16]` | testes unitários |
| 4 | `application/*` | Carência de 10 s antes de pausar, pausa congela o condutor, voto/expulsar/reiniciar como casos de uso | `[#21][#22]` | testes com relógio falso |
| 5 | `infrastructure/socket/gateway.ts` | Novos eventos com validação | `[#51][#93]` | typecheck + testes |
| 6 | `apps/web` (agente) | Identificador do navegador, aviso de pausa com SIM/NÃO, reiniciar (com confirmação), expulsar, "você entra na próxima rodada" | `[#53]` | build + navegador |
| 7 | docs | README (regras novas), CLAUDE.md, entrega | `[#96]` | revisão |
| 8 | — | Testes, lint, build e teste real com 2 abas no Docker | `[#49]` | tudo verde |

## 7. Impacto em Dados e Contratos

- **Banco:** nenhum.
- **Contrato:** muda (`@fodinha/shared`); servidor e web atualizados no mesmo ciclo — não há clientes externos ainda.
- **Configuração:** nenhuma variável nova.
- **LGPD:** identificador de navegador aleatório, sem dado pessoal; não vai para log em nível info [#63].

## 8. Plano de Testes

| Nível | O que cobre | Caminho de falha coberto |
|---|---|---|
| Unidade [#41] | saída ao fim da rodada, entrada com maior vida, reinício, banimento, votação | não-dono reiniciando/expulsando; banido reentrando; sala cheia |
| Integração [#42] | carência de 10 s, pausa congela prazos, todos NÃO → eliminado, voltar antes do fim da votação | reconectar dentro da carência não pausa |
| E2E [#43] | 2 abas no navegador (manual) | aba expulsa tentando voltar |

## 9. Riscos e Rollback

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Partida travada esperando para sempre (alguém sempre vota SIM) | Média | Mesa parada | Dono pode expulsar o ausente; limpeza de sala abandonada continua valendo |
| Banimento driblado por aba anônima | Alta | Expulso volta | Documentado; fase 2 com login |
| Índices de assento quebrarem ao remover jogador | Média | Ordem errada da mesa | Remoção só entre rodadas + testes de ordem |

**Rollback** [#84]: reverter os commits da branch.

## 10. Definição de Pronto

- [ ] Passos 1–8 executados
- [ ] Testes novos e existentes passando
- [ ] Build, lint, typecheck
- [ ] Teste real com 2 abas no Docker
- [ ] README/CLAUDE.md atualizados
- [ ] `ENTREGA-pausa-entrada-moderacao.md` escrito
