# Entrega: melhorias de usabilidade (avaliação heurística de 20/10/2026)

| Campo  | Valor                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------- |
| Plano  | [`PLANO-usabilidade.md`](PLANO-usabilidade.md)                                                 |
| Modo   | Loop (sem confirmação do plano)                                                                |
| Data   | 2026-10-20                                                                                     |
| Branch | `feature/feedback-jogadores`: `99f7ef7`, `8b3e06d`, `df06b53`, `e7918a0`, `7732b19`, `6b0dda2` |
| Status | Entregue; o teste com jogadores reais fica para depois                                         |

## O que mudou

| Item do handoff                    | Como ficou                                                                                                                                                                                                                               | Commit                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 9 (pré-requisito): sala sem limite | O dono escolhe o prazo da vez no lobby: 15, 30, 45, 60, 90 s ou "Sem limite". `TURN_TIMEOUT_SECONDS` saiu do ambiente.                                                                                                                   | `99f7ef7`                              |
| 1. Botão do palpite                | "Toque num número" sem seleção; "Confirmar N" com a dica "ou toque 2× no número". Dois toques no mesmo número confirmam.                                                                                                                 | `8b3e06d`                              |
| 6, 7, 8. Entrada e lobby           | Entrada só com apelido, "Criar sala" e "Entrar com código"; a configuração fica no lobby, com resumo e o motivo no botão ("Adicione 1 jogador para iniciar").                                                                            | `8b3e06d` (entrada), `99f7ef7` (lobby) |
| 9. Contador da vez                 | Um só, na pílula "Sua vez": pulsa a partir de 10 s, cada vez mais forte, e faz tic-tac a partir de 5 s.                                                                                                                                  | `8b3e06d`                              |
| 12, 13. Quem palpitou e 360×640    | "Mostrar mais" recolhido abaixo do Confirmar; corações em linhas iguais; o painel não rola em 360×640.                                                                                                                                   | `8b3e06d`                              |
| 3. Rodada cega e setas             | Aviso da rodada cega só na dica da mão; "Mais forte / Mais fraca" discreto sob as cartas e escondido com 1 carta.                                                                                                                        | `df06b53`                              |
| 4. Pé                              | Ícone de pegada; no primeiro palpite da partida as placas dizem "MÃO" e "PÉ" por extenso; selo "Você é o pé: não pode fechar a soma".                                                                                                    | `df06b53`                              |
| 10. Manilha                        | Selo próprio com moldura rosa e brilho holográfico, que a vira não cobre.                                                                                                                                                                | `df06b53`                              |
| 11. Botão de emoji                 | Continua visível, com folga mínima de 8 px dos números do palpite em todos os tamanhos (coberto por teste de tela).                                                                                                                      | `df06b53`                              |
| 5. Feltro durante os palpites      | O centro mostra quem está palpitando, o saldo em palavras e quantos já palpitaram.                                                                                                                                                       | `e7918a0`                              |
| 2. Ajuda na primeira partida       | "Regras em 1 minuto" abre no começo de cada partida até o jogador tocar "Não perguntar novamente neste computador". Enquanto lê, a mesa pausa e os outros veem "Jogador noob lendo as regras!": até 60 s, 1 vez por jogador por partida. | `7732b19`                              |
| Menor. Gesto de 1 e 2 toques       | No primeiro uso de cada seletor do aparelho a dica fica em destaque (carta, palpite) e o painel de reações avisa que um toque já envia. O guia de regras, o tutorial e o resumo citam o gesto.                                           | `6b0dda2`                              |

Achados no caminho, corrigidos:

- Quem era o pé perdia o Confirmar para fora do painel de palpite no notebook (`df06b53`).
- O "ou toque 2× no número" vazava do botão em 360 e 375 px: o padding do `.botao` base vencia o do painel (`6b0dda2`).

## Como validar

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

No navegador (dev): `http://localhost:5173/?cenario=10x13` em 360×640, 375×812 e 1366×768. Para ver o resumo das regras de novo, apague a chave `fodinha:resumo-das-regras` do localStorage; para as dicas do gesto, as chaves `fodinha:dica-do-gesto:*`.

## Verificações executadas

- Lint, typecheck e build: verdes.
- `npm test`: 171 testes verdes, incluindo os novos da pausa de leitura (congela a mesa, acaba sozinha em 60 s, 1 vez por partida, um leitor por vez, encerra quando o leitor cai) e o de integração com dois clientes no gateway.
- `npm run test:e2e`: 50 testes verdes em 5 tamanhos de tela. Testes novos: resumo das regras cabe sem rolar e não volta depois de dispensado; dica das reações some após a primeira reação; botão de reações longe do palpite; "ou toque 2×" não vaza do botão.
- Uma execução teve o teste do tutorial falhando em 360×640 com a máquina carregada; passou sozinho e na execução seguinte da suíte completa.
- Capturas conferidas em 360×640, 375×812 e 1366×768.

## Premissas assumidas (revisar)

| #   | Premissa                                                                                                                     | Como mudar                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P1  | O trabalho não commitado do prazo por sala era pré-requisito do item 9 e foi concluído primeiro.                             | Reverter `99f7ef7`.                                                     |
| P2  | Prazo da vez: 15, 30, 45, 60, 90 s ou sem limite, padrão 30 s.                                                               | `ConfiguracaoControles.tsx`.                                            |
| P3  | O resumo das regras abre em toda partida até ser dispensado ("Entendi" fecha só nesta partida).                              | `ResumoDasRegras.tsx`: gravar a preferência também no "Entendi".        |
| P4  | A pausa de leitura é da mesa inteira, 60 s, 1 vez por jogador por partida e um leitor por vez; quem entra no meio não a usa. | `LIMITES.maxLeituraDasRegrasSegundos` e `Sala.comecarLeituraDasRegras`. |
| P5  | A reação não tem gesto de dois toques (um toque no emoji já envia); a dica dela explica isso em vez de ensinar o 2×.         | `ReacoesDaMesa.tsx`.                                                    |
| P6  | Sem mockup: ajustes dentro da identidade visual aprovada.                                                                    | —                                                                       |

## Pendências

- Teste com jogadores reais (plano no fim do handoff): fica para depois.
- O aviso "Jogador noob lendo as regras!" visto pelos outros só é coberto pelo teste de integração (dois clientes); não há teste de tela com dois navegadores.
