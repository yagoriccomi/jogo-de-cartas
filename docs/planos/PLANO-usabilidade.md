# Plano: melhorias de usabilidade (avaliação heurística de 20/10/2026)

Modo: Loop (sem confirmação). Branch: `feature/feedback-jogadores`. Origem: `HANDOFF-usabilidade.md`.

## Enunciado canônico

- **Problema:** a avaliação heurística apontou rótulos ambíguos, avisos duplicados, ícone do pé
  incompreensível, feltro vazio durante os palpites, entrada longa, tempo exibido duas vezes,
  rótulo da manilha coberto e painel de palpite apertado em 360×640.
- **Resultado esperado:** cada item do handoff aplicado com a decisão do dono, no celular e no
  computador, de 2 a 10 jogadores, sem um elemento cobrir outro.
- **Como validar:** `npm run lint`, `typecheck`, `test`, `build` e `test:e2e` verdes; conferência
  visual em 360×640, 375×812 e 1366×768 com `?cenario=NxM` e com o tutorial.

## Escopo negativo

- Teste com jogadores reais (plano no fim do handoff): fica para depois [#8].
- Nenhuma regra de jogo muda, exceto o prazo da vez, que passa a ser configurado por sala.

## Premissas assumidas

1. O trabalho não commitado encontrado na branch (prazo da vez por sala, 10 a 120 s ou sem
   limite, e bots reagindo quando um humano estoura o prazo) é pré-requisito do item 9 ("sala sem
   limite de tempo"). Ele é concluído primeiro: controle no lobby, `TURN_TIMEOUT_SECONDS`
   removido do ambiente, testes [#6][#80].
2. Opções do prazo no lobby: 15, 30, 45, 60, 90 s e "Sem limite", num seletor de passos como os
   demais controles (padrão 30 s) [#7].
3. Item 2 (pausa "lendo regras"): pausa da mesa inteira, 60 s no máximo, 1 vez por jogador por
   partida, com aviso a todos, como o handoff recomenda.
4. Item 6: a configuração sai da entrada; a sala nasce com `CONFIGURACAO_PADRAO` e o dono ajusta
   no lobby, onde já existe [#7].
5. Decisão visual: sem mockup. São ajustes dentro da identidade aprovada (CLAUDE.md), e o
   handoff já descreve o resultado esperado de cada tela [#98].

## Passos (cada linha = um commit)

| #   | Itens                       | Arquivos principais                                                                                         | Prática        | Verificação             |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------- | ----------------------- |
| 1   | Prazo por sala (premissa 1) | `ConfiguracaoControles.tsx`, `TelaLobby.tsx`, README, `.env.example`, compose, `render.yaml`, testes        | [#6][#41][#96] | vitest + lobby          |
| 2   | 1, 6, 7, 8                  | `PainelPalpite.tsx`, `TelaEntrada.tsx`, `TelaLobby.tsx`                                                     | [#1][#98]      | e2e entrada e mesa      |
| 3   | 3, 9, 12, 13                | `TelaMesa.tsx`, `Mao.tsx`, `PainelPalpite.tsx`, `ContagemRegressiva.tsx`, `Coracoes.tsx`, `sintetizador.ts` | [#2][#3]       | e2e + visual            |
| 4   | 4, 10, 11                   | `SimbolosMaoEPe.tsx`, `PlacaJogador.tsx`, `PainelPalpite.tsx`, `mesa.css`, `ReacoesDaMesa.tsx`              | [#2]           | visual                  |
| 5   | 5                           | `TelaMesa.tsx`, `mesa.css`                                                                                  | [#98]          | visual 2 e 10 jogadores |
| 6   | 2 e "Menor"                 | shared (evento), `sala.ts`/condutor, gateway, web (balão), tutorial, guia                                   | [#51][#41]     | vitest + e2e            |
| 7   | Docs                        | README, CLAUDE.md, `ENTREGA-usabilidade.md`                                                                 | [#96]          | leitura                 |

## Progresso

- [x] 1 · [x] 2 (com 9, 12 e 13, adiantados: o painel só parou de rolar em 360×640 com o contador único e os corações em linhas iguais) · [x] 3 · [x] 4 (achado no caminho: quem era o pé perdia o Confirmar para fora do painel no notebook; a linha de bloqueio saiu e o selo foi para o lado do título) · [ ] 5 · [ ] 6 · [ ] 7

## Riscos e rollback

- Seletores do e2e mudam com os rótulos novos: ajustar junto (`palpite__rodape .botao`).
- Pausa "lendo regras" mexe no condutor: coberta por testes de aplicação e de gateway.
- Rollback: reverter os commits da iteração [#84].

## Definição de pronto

Lint, typecheck, testes, build e e2e verdes; capturas conferidas; README e CLAUDE.md atualizados;
`ENTREGA-usabilidade.md` escrito.
