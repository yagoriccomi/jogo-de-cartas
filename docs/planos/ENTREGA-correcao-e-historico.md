# ENTREGA — correcao-e-historico

| Campo              | Valor                                                            |
| ------------------ | ---------------------------------------------------------------- |
| **Tarefa**         | `correcao-e-historico`                                           |
| **Plano**          | [`PLANO-correcao-e-historico.md`](PLANO-correcao-e-historico.md) |
| **Modo**           | 🔁 Loop (sem confirmação)                                        |
| **Data**           | 2026-10-22 a 2026-10-24                                          |
| **Branches / PRs** | 13 fatias, uma branch e um PR por fatia (ver tabela)             |
| **Status**         | ✅ Entregue — todas as fatias mergeadas, os dois deploys no ar   |

---

## 1. O que foi feito

- **Os 10 candidatos da revisão de arquitetura de 22/10** (fatias S1–S5, W1–W4, P1): prazo da vez não reinicia mais com mudança lateral na sala; a placa da vez não acende com a mesa pausada; invariantes de saída/votação centralizados na `Sala`; projeção do estado visível movida para o domínio; preferências do aparelho (som, sessão, dica, resumo) como módulo tipado único.
- **Histórico de partidas (H1):** cada partida real vira um diário no domínio (`domain/diario.ts`, versão 2 — só fatos), gravado rodada a rodada no Turso via porta `RegistroDePartidas` (adaptador nulo sem `TURSO_DATABASE_URL`); migrations versionadas aplicadas no boot; script de export para treino (JSONL) que reconstrói a visão de cada decisão por `reconstruirRodada`, sem gravar o que o jogador via.
- **Login opcional com Google (L1):** Better Auth no próprio Fastify, sessões no mesmo Turso; convidado continua sendo o padrão; sem as quatro variáveis (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) ou sem banco, o botão "Entrar com Google" não aparece (`disponivel: false`). Cookie entre domínios (Vercel ↔ Render) contornado por um código de uso único no fragmento da URL, trocado por token Bearer.
- **Histórico e replay (R1):** tela "Minhas partidas" na entrada, listando as partidas terminadas da conta logada, paginada por cursor opaco; replay reencena cada rodada na mesma mesa do jogo ao vivo (reaproveitando `fonteDaPartida`, como o tutorial faz); mão alheia só é revelada depois do fim da partida (`MomentoDaVisao: 'depoisDoFim'`), nunca ao vivo; nomes no replay vêm da conta (primeiro nome) ou "Bot N"/"Jogador N" — nenhum apelido gravado no diário, sem LGPD exposta.

## 2. Fatias entregues

| Fatia                      | PR  | O que mudou                                                           |
| -------------------------- | --- | --------------------------------------------------------------------- |
| S1 agenda da mesa          | #25 | Prazo da vez e fim de rodada como função pura; condutor só arma timer |
| P1 preferência do aparelho | #26 | Módulo de preferência tipada (sessão, som, volumes, resumo, dica)     |
| W1 visão da mesa           | #27 | `visaoDaMesa` puro e testado; placa não acende na pausa               |
| S2 invariantes da Sala     | #28 | Toda mutação resolve votações/saídas e devolve o desfecho             |
| W2 cena da vaza            | #29 | Núcleo puro da linha do tempo; pausas compartilhadas cliente↔servidor |
| S3 jogar a vez             | #30 | Operação de domínio única usada por condutor, testes e simulador      |
| S4 projeção completa       | #31 | Estado visível por destinatário movido para o domínio                 |
| W3 fonte da partida        | #32 | Costura com adaptadores socket + roteiro do tutorial                  |
| W4 planejadores dos hooks  | #33 | Planejador puro em Mao/useBaralho; relógio como argumento             |
| S5 Sala esconde a Partida  | #34 | Sala é a costura das jogadas e aplica a pausa num só lugar            |
| H1 diário + Turso + export | #35 | Diário v2, porta `RegistroDePartidas`, migrations, export para treino |
| L1 login Google            | #37 | Better Auth, botão "Entrar com Google", aviso de privacidade          |
| R1 histórico e replay      | #38 | Rota paginada, "Minhas partidas", replay na mesa com `MomentoDaVisao` |

## 3. Como validar

```bash
scripts\dev.bat start
```

1. Jogar uma partida até o fim (com ou sem login) — ela vira diário no Turso dev.
2. Entrar com Google (variáveis configuradas) → "Minhas partidas" na entrada lista a partida terminada.
3. Abrir o replay de uma rodada: mãos de todos aparecem (a partida já terminou); ao vivo, nenhum vivo vê mão alheia.
4. Sem `TURSO_DATABASE_URL`/`GOOGLE_CLIENT_ID`: botão de login some, jogo roda igual como convidado.

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:e2e
```

## 4. Verificações executadas

- [x] Bateria completa (lint, typecheck, test, build) verde em cada um dos 13 PRs.
- [x] `npm run test:e2e` verde em cada fatia que tocou a mesa/web (90/90 em R1, incluindo reinstalação do Chromium na worktree isolada).
- [x] Teste de equivalência do diário (`test/domain/diario.test.ts`) continua idêntico após o refactor de `reconstrucao.ts`/`replay.ts` (12/12).
- [x] Revisão adversarial (agente `verification`) em cada fatia de nível alto antes de marcar `revisada: pronta`; em R1, achou README desatualizado (gate crítico do CLAUDE.md) — corrigido e reverificado, PASS.
- [x] Segurança: rota de replay recusa quem não participou com erro genérico (`nao_encontrada`), nunca revela que a partida existe; conta identificada só por token Bearer, nunca por parâmetro de URL.
- [x] LGPD: e-mail nunca trafega no contrato de histórico; apelido não vem do diário (id opaco); replay usa nome da conta ou "Bot N".
- [x] Os dois deploys confirmados no ar após cada merge: Vercel `READY`, Render `live`, `/health` 200.

## 5. ⚠️ Premissas assumidas (revisar)

Ver plano, seção 3 (P1–P11). Destaques: agentes em nível `alto` em todas as fatias (Modo Loop); gravação por rodada (não por carta), limite do Turso grátis; sem as variáveis de ambiente, login e histórico somem da tela sem derrubar o boot; aviso de privacidade curto, retenção indefinida por ora (decisão LGPD ainda aberta — P11).

## 6. Decisão visual

- **Mockup:** não solicitado — login e replay seguem a identidade já aprovada (feltro + neon) e a mesa existente; o replay reaproveita a mesma mesa do jogo ao vivo, como o tutorial.
- Refatorações S1–S5/W1–W4/P1: sem mudança visual, exceto a correção da placa acesa durante a pausa (W1).

## 7. Pendências e fora de escopo

- Conta no Turso e no Google Cloud, variáveis na Render e checagem do `CORS_ORIGINS` na Vercel: tarefas do usuário, não executadas por esta fila (ver instruções enviadas por ele).
- Banimento ainda é driblável com aba anônima/outro dispositivo (depende de login mais forte — fora do escopo desta fila).
- Ranking, chat na mesa e Redis para escala horizontal continuam fora do escopo (fase 2, YAGNI `[#8]`).
- `mesa.spec.ts:102` (botão de reações sobre o selo da manilha, viewport celular-360x640) é uma falha e2e intermitente conhecida, presente na `main` mesmo sem as mudanças desta fila — não investigada aqui por já ter sido relatada como fora do escopo pelo usuário.
- 3 arquivos de documentação de outras fatias (`ENTREGA-divida-tecnica.md`, `ENTREGA-feedback-jogadores.md`, `PLANO-divida-tecnica.md`) continuam reprovando `format:check`; pré-existente, fora do escopo desta fila.

## 8. Próximo passo natural

Usuário configura OAuth do Google e as variáveis na Render (README, seção "Login com Google"); com o banco e o Google ligados, login, histórico e replay saem do estado "desligado" em produção.
