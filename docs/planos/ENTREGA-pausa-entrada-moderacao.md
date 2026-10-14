# ENTREGA — pausa-entrada-moderacao

| Campo                | Valor                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| **Tarefa**           | `pausa-entrada-moderacao` (+ visual aprovado "Feltro + neon Vice City") |
| **Plano**            | [`PLANO-pausa-entrada-moderacao.md`](PLANO-pausa-entrada-moderacao.md)  |
| **Modo**             | 💬 Interativo (plano e visual aprovados pelo usuário)                   |
| **Data**             | 2026-10-14                                                              |
| **Branch / Commits** | `feature/pausa-entrada-moderacao` — ver `git log main..`                |
| **Status**           | ✅ Entregue                                                             |

---

## 1. O que foi feito

- **Pausa por queda de conexão:** após 10 s desconectado, a mesa congela e os jogadores votam "Deseja esperar o retorno de [apelido]?". Basta um SIM para esperar; todos NÃO → um bot termina a rodada e o ausente é eliminado.
- **Entrada no meio da partida:** quem chega assiste e senta na próxima rodada com a maior vida entre os vivos.
- **Dono da sala:** reinicia (rodada 1, vidas cheias para todos) e expulsa; expulso fica banido pelo navegador. Se o dono sai, o posto passa ao humano conectado mais antigo e volta ao criador.
- **Saída no meio da rodada:** um bot termina a rodada de quem saiu/foi expulso.
- **Visual aprovado no site responsivo e instalável (PWA):** feltro com neon Vice City, cartas em pixel art (manilha holográfica), ficha "1º", palpite em painel que não cobre a mão, menu em gaveta, mão ordenada da mais forte para a mais fraca, montinhos de vazas animados (sem "última vaza") e vidas como corações neon que apagam.

## 2. Arquivos alterados (resumo)

| Área                             | Mudança                                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared`                | `dispositivoId`, `sala:expulsar`, `sala:reiniciar`, `jogo:votarEspera`, `sala:expulso`, `pausa`, `idDoPrimeiro`, `prazoDaVezRestanteMs`, `vazasGanhas`, `proximaRodada`; cálculo do baralho compartilhado |
| `apps/server/src/domain`         | `Partida` (saídas agendadas, entrantes, mão ordenada, montinhos, previsão da próxima rodada); `Sala` (dono/criador, banimento, votação, reinício)                                                         |
| `apps/server/src/application`    | Condutor reconcilia carências e pausa; serviço com os novos casos de uso                                                                                                                                  |
| `apps/server/src/infrastructure` | Gateway com eventos novos e retirada do expulso                                                                                                                                                           |
| `apps/server/test`               | 105 testes: domínio, aplicação, regressão das 7 correções da revisão e integração do gateway com cliente real                                                                                             |
| `apps/web`                       | Reescrita visual + telas e fluxos novos + PWA                                                                                                                                                             |
| docs                             | README (regras e features), CLAUDE.md (regras e identidade visual), plano (premissas P11–P15)                                                                                                             |

## 3. Como validar

```bash
scripts\dev.bat start
```

1. Abrir http://localhost:5173, criar sala, adicionar bot e iniciar.
2. Outro navegador/aparelho entra pelo código; fechar a aba dele → em 10 s a mesa pausa com SIM/NÃO.
3. Entrar com a partida em andamento → aviso "Você entra na próxima rodada".
4. Menu ☰ → Expulsar / Reiniciar sala.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## 4. Verificações executadas

- [x] Testes — 105/105 (servidor).
- [x] Typecheck, lint, Prettier e build — todos os workspaces.
- [x] Docker dev (servidor + web com hot reload) — no ar durante todo o teste.
- [x] Navegador (computador e 375 px), com um segundo jogador simulado por script:
  - rodada cega, ficha 1º, pé com número bloqueado, manilha holográfica, mão ordenada;
  - montinho voando até quem ganhou e resultado só depois da animação; corações apagando;
  - pausa aberta por 20 s+ sem ninguém agir; voto SIM mantém, NÃO retoma com "bot terminando a rodada";
  - entrada no meio sentando com 5 vidas na rodada seguinte;
  - expulsão: expulso recebe aviso e, ao tentar voltar, `BANIDO`;
  - reinício: rodada 1, vidas cheias, eliminada de volta, expulsa fora; ausente sentado já desconectado pausa a mesa (correção 2).
- [x] Revisão de código por agente: 7 bugs encontrados e corrigidos, cada um com teste de regressão.

## 5. ⚠️ Premissas assumidas (revisar)

Ver plano, seção 3 (P1–P15). Destaques: carência de 10 s; eleitor que pisca a rede continua eleitor até a própria carência vencer; sem eleitores mas com espectador, a mesa segue sem o ausente; pausa entre rodadas passou de 4 s para 6 s (inclui a animação do último montinho).

## 6. Decisão visual

- **Mockups:** canvas aprovado (Mesa estilo 7, Cartas pixel, Palpite, Página inicial, Menu, Celular, Mão cheia).
- **Pedidos durante a implementação:** sem "última vaza" → montinhos animados; vidas → corações neon.

## 7. Pendências e fora de escopo

- Banimento é driblável com aba anônima/outro aparelho (precisa de login — fase 2).
- Teste de instalação do PWA no Android real não foi feito (só manifest/ícones/service worker gerados).
- O canvas de design ainda mostra as cartas antigas na aba "Mão cheia" (o jogo já usa as aprovadas).
- Um voto NÃO foi registrado no primeiro teste sem clique meu — os logs e o código mostram que só um clique envia voto; no segundo teste, sem interação, a pausa se manteve. Provável clique no painel do navegador.

## 8. Próximo passo natural

Jogar com amigos na rede local/celular, depois publicar (Render + Vercel) e testar a instalação no Android.
