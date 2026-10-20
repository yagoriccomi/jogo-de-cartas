# Entrega: feedback dos jogadores e crítica de design

Branch: `feature/feedback-jogadores`. Plano: `PLANO-feedback-jogadores.md`.

## O que mudou

| Pedido | Como ficou | Arquivos |
|---|---|---|
| Fim da rodada rápido demais (sobretudo a primeira e a última, as cegas) | A pausa do servidor subiu de 6 s para 8 s, com mais 4 s quando a rodada é cega. No cliente, a última vaza fica 2 s na mesa (antes 0,8 s) e a revelação cega dá 2,5 s de leitura (antes 0,9 s). A última vaza da partida também voa antes de aparecer a tela do vencedor. | `condutor-de-partidas.ts`, `main.ts`, `useAnimacaoDeVaza.ts`, `TelaMesa.tsx` |
| Difícil saber que é a sua vez | Faixa "Sua vez!" sobre o feltro, mão pulsando em rosa, campainha própria, título da aba "🔴 Sua vez!" e rolagem das placas até quem joga | `useSinaisDaVez.ts`, `TelaMesa.tsx`, `mesa.css`, `sintetizador.ts` |
| Sem tela para o vencedor | Troféu em pixel art, nome em neon grande, confete em CSS, placar com posição e ações fixas no rodapé | `TelaFimDePartida.tsx`, `mesa.css` |
| Dono da carta na mesa | Nome sempre acima da carta que está ganhando; nas demais, contorno rosa e nome ao passar o mouse, focar ou tocar | `MesaLinhas.tsx`, `mesa.css` |
| Balão do tutorial cobrindo a mão no celular | O balão troca de lado quando cobriria mais de 25% da mão | `BalaoTutorial.tsx` |
| Feltro mal aproveitado no desktop | Cartas da mesa até 132 px (limitadas pela altura) e grupo centralizado | `mesa.css` |
| Contraste do rosa com texto branco (3,5:1) | Token `--rosa-forte` `#e0156f` (4,67:1) nos fundos com texto branco | `tokens.css` e CSS das telas |
| Verbo "Toque" no desktop | O tutorial diz "Clique" quando o ponteiro é mouse | `ponteiro.ts`, `roteiro.ts`, `BalaoTutorial.tsx` |
| Tutorial longo (34 passos) | Botão "Versão rápida" nas boas-vindas pula 9 passos só explicativos | `roteiro.ts`, `motor.ts` |
| Contador da vaza acima da vira | `1/5` em neon ciano | `TelaMesa.tsx`, `mesa.css` |
| Empates fora do feltro | Um monte abaixo da manilha; no celular só "Empates ×N" | `MonteDeEmpates.tsx`, `mesa.css` |
| Aviso "Acordando o servidor" no local | O servidor nativo lê o `.env` da raiz; em dev o aviso fala do servidor local | `apps/server/package.json`, `App.tsx`, `socket.ts` |
| "Iniciar partida" fora da dobra no celular | Preso no rodapé do lobby | `lobby.css` |

## Como validar

- `npm run lint`, `typecheck`, `test` (143 testes) e `build`: verdes.
- `npm run test:e2e`: 35 testes verdes em 5 tamanhos de tela, incluindo o teste novo da versão rápida do tutorial.
- No navegador: `http://localhost:5173/?cenario=10x5` em 375×812, 360×640, 1366×768 e 1440×900.

## Premissas

- "Fim da mão" foi lido como fim da rodada; a primeira e a última são as cegas.
- As vazas do meio continuam com 0,8 s: com bots a cada 2 s, uma pausa maior seria atropelada.
- Testes do servidor usam `pausaExtraRodadaCegaMs: 0` por padrão; um teste dedicado cobre o acréscimo.

## Pendências

- Ordem de eliminação no placar final (o contrato não traz).
- Placas cortadas no desktop com 9 adversários.
- A música de fundo está sendo feita em outra sessão/branch.
