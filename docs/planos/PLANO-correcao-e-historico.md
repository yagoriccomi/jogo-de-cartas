# PLANO DE EXECUÇÃO — correcao-e-historico

| Campo                | Valor                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Tarefa**           | `correcao-e-historico`                                                     |
| **Origem**           | descrição livre (revisão de arquitetura + pedido de banco/login/histórico) |
| **Tipo**             | Melhoria + História                                                        |
| **Modo de execução** | 🔁 Loop (sem confirmação)                                                  |
| **Data**             | 2026-10-22                                                                 |
| **Branches**         | uma por módulo (ver Fatias)                                                |

---

## 1. Enunciado Canônico

- **Problema:** a revisão de arquitetura de 22/10 achou 10 pontos de atrito (dois com bug: o prazo da vez reinicia a cada mudança na sala; a placa da vez acende com a mesa pausada) e o jogo não guarda nada: sem login, sem histórico, sem dados para treinar bots.
- **Resultado esperado:** os 10 candidatos aprofundados; toda partida real gravada carta a carta no Turso (com o que cada jogador via e quem decidiu); login opcional com Google; o jogador logado revê o replay das próprias partidas; os dados exportáveis para treino.
- **Como validar:** bateria do projeto verde em cada PR; teste que prova que recarregar a página não devolve o prazo; partida de dev gravada num libSQL local e reproduzida no replay; login desligado sem as variáveis de ambiente.

## 2. Escopo

**Vou fazer:** os candidatos 1 a 10 do relatório de arquitetura; diário da partida + porta + adaptadores (memória e Turso) + migrations; exportação para treino; login Google (Better Auth) com convidado mantido; tela de histórico e replay.

**NÃO vou fazer** [#8]: criar conta no Turso ou no Google Cloud (é do usuário); mudar o plano da Render (decisão: deixar como está); mover as salas para o banco (continuam em memória); treinar bots; ranking; chat; deploy ou merge.

## 3. Premissas Assumidas

Decisões do usuário: `answers/2026_10_22 banco-login-historico 001.md`.

| #   | Premissa                                                                                                     | Por quê                                                                    | Se estiver errada…           |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------- |
| P1  | Agentes em nível `alto` em todas as fatias                                                                   | Modo Loop                                                                  | Trocar o preset no relance   |
| P2  | Toda sala real é gravada (logado ou convidado); tutorial e cenários de teste não                             | Treino precisa de volume `[#98]`                                           | Filtro no gravador           |
| P3  | Cada decisão grava a visão do jogador naquele momento e quem decidiu (humano / bot+perfil / prazo estourado) | Sem isso o treino aprende com os bots                                      | Coluna nova + migration      |
| P4  | Jogador por id opaco; apelido fora dos dados de treino; conta ligada só para o próprio replay                | LGPD `[#63]`                                                               | Ajustar a projeção do export |
| P5  | Gravação por rodada (uma linha com as jogadas em JSON), não por carta                                        | Limite de 10 M linhas/mês do Turso; queda perde no máximo a rodada `[#99]` | Normalizar depois            |
| P6  | Sem `TURSO_DATABASE_URL` o gravador usa um adaptador nulo; sem `GOOGLE_CLIENT_ID` o login some da tela       | O jogo roda igual sem as contas criadas `[#80]`                            | —                            |
| P7  | Dev e testes usam libSQL local (`file:`), sem conta                                                          | Paridade sem segredo `[#81][#37]`                                          | —                            |
| P8  | Mão alheia só no replay depois do fim da partida                                                             | Servidor autoritativo `[#51]`                                              | —                            |
| P9  | Login com Better Auth no próprio Fastify, sessões no mesmo Turso                                             | Sem fornecedor extra; OAuth2 `[#56]`                                       | Trocar adaptador de auth     |
| P10 | Uma branch por módulo; fatias do mesmo módulo em série na mesma branch                                       | Um PR por módulo; evita conflito                                           | —                            |
| P11 | Aviso de privacidade curto na entrada e na tela de login; retenção indefinida por ora                        | Decisão LGPD ainda aberta                                                  | Ajustar texto/retenção       |

## 4. Decisão Visual

- **Tem superfície visual?** Sim: botão "Entrar com Google", aviso de privacidade, tela de histórico, replay.
- **Mockup?** Não: segue a identidade aprovada (feltro + neon) e a mesa existente; o replay reaproveita a mesa de verdade, como o tutorial. A fatia de replay aciona `design-de-interface-projeto`.
- Refatorações 1–10: sem mudança visual (exceto corrigir a placa acesa na pausa).

## 5. Terreno

Ver o relatório de arquitetura (arquivos e linhas por candidato). Reaproveitamento [#6]: `RepositorioDeSalas`/portas em `application/portas.ts`; `test/apoio.ts` (`montarCenario`); `test/apoio/armazenamento.ts`; o mecanismo de mesa roteirizada do tutorial para o replay.

## 6. Passos (por fatia)

| Fatia                      | O que muda                                                                                                                                                                                                        | Prática         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| S1 agenda da mesa          | Partida/Sala registram desde quando a vez e o fim de rodada começaram; o próximo passo e o instante viram função pura; o condutor só arma o timer; teste: mudança lateral não reinicia o prazo                    | [#30][#41]      |
| S2 invariantes da Sala     | Toda mutação resolve votações e saídas e devolve o desfecho; uma fonte de verdade para "saindo"; log único                                                                                                        | [#6][#16]       |
| S3 jogar a vez             | Uma operação de domínio "a vez anda com esta estratégia" usada por condutor, `test/apoio.ts` e simulador; interface da estratégia simétrica; unificar o harness de `servico-de-salas.test.ts` com `montarCenario` | [#6]            |
| S4 projeção completa       | Estado visível por destinatário montado no domínio; condutor só entrega                                                                                                                                           | [#51][#30]      |
| S5 Sala esconde a Partida  | Sala é a costura das jogadas e aplica a pausa                                                                                                                                                                     | [#13]           |
| W1 visão da mesa           | `visaoDaMesa` puro e testado; TelaMesa, som/eventos, DialogoPlacar, PainelPalpite consomem; placa não acende na pausa                                                                                             | [#6][#41]       |
| W2 cena da vaza            | Núcleo puro da linha do tempo e do monte em voo; adaptador de DOM; pausas em `@fodinha/shared` com teste cliente ↔ servidor                                                                                       | [#3][#41]       |
| W3 fonte da partida        | Costura com adaptadores socket e roteiro cobrindo todas as ações; uma fonte de verdade para "tutorial ligado"; balões usam MARCADORES                                                                             | [#20]           |
| W4 planejadores dos hooks  | Planejador puro em Mao/useBaralho; relógio como argumento; testes de `planejarEntrega` e `detectarEventos`                                                                                                        | [#41]           |
| P1 preferência do aparelho | Módulo de preferência tipada; sessão, som, volumes, resumo, dica viram declarações                                                                                                                                | [#6]            |
| H1 diário + Turso          | Diário da partida no domínio; porta `RegistroDePartidas`; adaptadores memória/nulo/libSQL; migrations versionadas; gravação por rodada; script de export para treino                                              | [#87][#20][#52] |
| L1 login Google            | Better Auth no Fastify, Google opcional, conta ↔ jogador; web: botão e aviso; README/.env.example                                                                                                                 | [#56][#80][#96] |
| R1 histórico e replay      | Rota paginada das partidas do jogador; tela de histórico e replay na mesa                                                                                                                                         | [#67][#53]      |

## 7. Impacto em Dados e Contratos

- **Banco:** Turso (libSQL); migrations em `apps/server/migrations/` aplicadas no boot [#87].
- **Contrato:** novos eventos/rotas em `@fodinha/shared` (histórico, sessão de login); nada existente quebra.
- **Configuração:** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` — todas opcionais, no `.env.example` e no README [#80][#96].
- **LGPD:** e-mail e nome da conta Google; apelido fora dos dados de treino e dos logs `info` [#63].

## 8. Plano de Testes

Unidade no domínio (agenda, invariantes, projeção, diário, visão da mesa, cena da vaza, preferências); integração do adaptador libSQL com `file::memory:`; e2e existentes após mudanças na mesa. Comando: `npm run lint && npm run typecheck && npm test && npm run build` (+ `npm run test:e2e` nas fatias da mesa).

## 9. Riscos e Rollback

| Risco                                             | Prob. | Impacto                      | Mitigação                                            |
| ------------------------------------------------- | ----- | ---------------------------- | ---------------------------------------------------- |
| Refatoração do servidor muda tempo de bots/prazos | Média | Partidas mais lentas/rápidas | Testes de aplicação existentes + novo teste de prazo |
| Gravação falha e derruba partida                  | Baixa | Partida perdida              | Gravador assíncrono, erro só logado                  |
| Limite do Turso grátis                            | Baixa | Gravação para                | Uma linha por rodada (P5)                            |

**Rollback** [#84]: cada módulo é um PR; reverter o merge. Sem variáveis do Turso/Google o sistema volta ao comportamento atual.

## Fatias

Uma branch e um PR por fatia, em série dentro do módulo. O usuário autorizou o merge com tudo verde e pediu para vigiar os deploys.

| Fatia                      | Nível | Depende de | Branch (PR)                              | Estado              |
| -------------------------- | ----- | ---------- | ---------------------------------------- | ------------------- |
| S1 agenda da mesa          | alto  | —          | `refactor/servidor-arquitetura` (#25)    | mergeada, deploy ok |
| W1 visão da mesa           | alto  | —          | `refactor/web-mesa` (#27)                | mergeada, deploy ok |
| P1 preferência do aparelho | alto  | —          | `refactor/web-preferencias` (#26)        | mergeada, deploy ok |
| S2 invariantes da Sala     | alto  | S1         | `refactor/servidor-sala` (#28)           | mergeada, deploy ok |
| W2 cena da vaza            | alto  | W1         | `refactor/web-cena-da-vaza` (#29)        | mergeada, deploy ok |
| S3 jogar a vez             | alto  | S2         | `refactor/servidor-jogar-a-vez` (#30)    | mergeada, deploy ok |
| S4 projeção completa       | alto  | S3         | `refactor/servidor-projecao` (#31)       | mergeada, deploy ok |
| S5 Sala esconde a Partida  | alto  | S4         | `refactor/servidor-sala-esconde-partida` | revisada: pronta    |
| W3 fonte da partida        | alto  | W2         | `refactor/web-fonte-da-partida` (#32)    | mergeada, deploy ok |
| W4 planejadores dos hooks  | alto  | W3         | `refactor/web-planejadores` (#33)        | mergeada, deploy ok |
| H1 diário + Turso + export | alto  | S5         | `feat/historico-de-partidas`             | revisada: pronta    |
| L1 login Google            | alto  | H1         | `feat/login-google`                      | na fila             |
| R1 histórico e replay      | alto  | L1, W4     | `feat/replay-de-partidas`                | na fila             |

## 10. Definição de Pronto

- [ ] Todas as fatias `revisada: pronta`
- [ ] Bateria do projeto verde em cada PR [#49]
- [ ] Sem segredo em código [#37]
- [ ] README, `.env.example` e `CLAUDE.md` atualizados (banco, login, histórico) [#96]
- [ ] `docs/planos/ENTREGA-correcao-e-historico.md` escrito
