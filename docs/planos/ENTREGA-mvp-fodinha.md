# ENTREGA — mvp-fodinha

| Campo                | Valor                                            |
| -------------------- | ------------------------------------------------ |
| **Tarefa**           | `mvp-fodinha`                                    |
| **Plano**            | [`PLANO-mvp-fodinha.md`](PLANO-mvp-fodinha.md)   |
| **Modo**             | 🔁 Loop                                          |
| **Data**             | 2026-10-13                                       |
| **Branch / Commits** | `main` — ver `git log`                           |
| **Status**           | ✅ Entregue (com pendências listadas na seção 7) |

---

## 1. O que foi feito

MVP jogável da Fodinha: criar sala, convidar por código/link, adicionar até 4 bots e jogar uma partida completa com todas as regras combinadas. O servidor é a única autoridade — cada navegador recebe só a própria mão, a vira, as cartas jogadas e, na rodada cega, a carta "na testa" dos outros. Quem demora joga automaticamente após o prazo; quem recarrega a página volta ao mesmo assento. O ambiente de desenvolvimento roda inteiro em Docker.

## 2. Arquivos alterados

| Arquivo                                                         | Mudança                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/*`                                         | Contratos: cartas, configuração/limites, estado visível, eventos Socket.IO tipados                                                    |
| `apps/server/src/domain/*`                                      | Regras puras: baralho, manilha/força, vaza com anulação, rodadas, `Partida`, `Sala`, estratégia do bot                                |
| `apps/server/src/application/*`                                 | `ServicoDeSalas` (casos de uso), `CondutorDePartidas` (prazos, bots, pausas, publicação), portas                                      |
| `apps/server/src/infrastructure/*`                              | Gateway Socket.IO (validação, rate limit, erro centralizado), adaptadores (memória, relógio, ids criptográficos), leitura do ambiente |
| `apps/server/src/main.ts`                                       | Composition root, `/health`, desligamento gracioso                                                                                    |
| `apps/server/test/*`                                            | 48 testes (domínio + aplicação com relógio falso)                                                                                     |
| `apps/web/*`                                                    | Frontend React + Vite: entrada, lobby, mesa, tema claro/escuro, reconexão                                                             |
| `docker-compose.yml`, `scripts/dev.*`, `.dockerignore`          | Ambiente de desenvolvimento dockerizado com hot reload                                                                                |
| `apps/server/Dockerfile`, `render.yaml`, `apps/web/vercel.json` | Deploy (Render + Vercel)                                                                                                              |
| `.github/workflows/ci.yml`                                      | CI: lint, typecheck, testes, build                                                                                                    |
| `CLAUDE.md`, `README.md`                                        | Regras do projeto e documentação pública                                                                                              |

## 3. Como validar

1. `scripts\dev.bat start` (Windows) ou `./scripts/dev.sh start`.
2. Abrir http://localhost:5173, digitar um apelido e criar a sala.
3. Adicionar 3 bots e iniciar: a rodada 1 é cega (você vê a carta dos bots, não a sua).
4. Palpitar e jogar; ao fim da rodada aparece o resultado e a próxima começa com 2 cartas.
5. Recarregar a página no meio da partida: você volta ao mesmo assento.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## 4. Verificações executadas

- [x] Build — `@fodinha/server` (tsup) e `@fodinha/web` (Vite 8) compilam.
- [x] Testes — 48/48 passando (Vitest 5).
- [x] Typecheck e lint — sem erros em todos os workspaces.
- [x] Docker dev — `scripts\dev.bat start/restart` sobe `deps` → `server` (healthy) → `web`; `/health` 200; web 200; hot reload do servidor confirmado (`tsx` reiniciou ao editar `main.ts`).
- [x] Imagem de produção — `docker build -f apps/server/Dockerfile .` ok; container rodou como usuário `node` e respondeu `/health`.
- [x] Navegador — sala criada, 3 bots, rodada cega correta, anulação verificada na prática (dois 3 se anularam e o Ás venceu), resultado da rodada, rodada 2 com mão aberta, reconexão após recarregar, layout em 375px.
- [ ] Partida jogada até o fim no navegador — coberta por teste automatizado (partida só com prazos/bots até `encerrada`), não manualmente.
- [ ] Dois humanos em navegadores diferentes — não testado manualmente.

## 5. ⚠️ Premissas assumidas (revisar)

| #   | Premissa                                                                                                     | Por quê                                 | Como mudar se estiver errada                 |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------- | -------------------------------------------- |
| P1  | Força: 4 < 5 < 6 < 7 < (8 < 9 < 10) < Q < J < K < A < 2 < 3                                                  | `[#3]` ordem do truco paulista          | `VALORES` em `packages/shared/src/cartas.ts` |
| P2  | Manilhas: ouros < espadas < copas < paus                                                                     | padrão do truco                         | `NAIPES`                                     |
| P3  | Cartas comuns de mesmo valor empatam (naipe não desempata); manilhas idênticas de baralhos diferentes também | decorre de "cartas iguais se anulam"    | `domain/forca.ts`                            |
| P4  | Vaza toda anulada: quem abriu abre a próxima                                                                 | `[#7]`                                  | `Partida.fecharVaza`                         |
| P5  | Primeiro pé sorteado; depois roda para a esquerda                                                            | convenção                               | `Partida`                                    |
| P6  | Palpites e 1ª vaza começam à esquerda do pé; vencedor da vaza abre a seguinte                                | convenção                               | `Partida`                                    |
| P7  | Máximo de cartas = ⌊(monte − 1) / vivos⌋, sem teto (com 4 baralhos e 2 jogadores dá 103 cartas!)             | regra literal                           | adicionar teto configurável                  |
| P8  | Todos zeram na mesma rodada → vence quem ficou menos negativo; empate se igual                               | `[#7]`                                  | `Partida.encerrarRodada`                     |
| P9  | Prazo da vez 30s (`TURN_TIMEOUT_SECONDS`); estourou → joga a estratégia do bot                               | `[#80]`                                 | `.env`                                       |
| P10 | Pausa de 4s no fim da rodada; bot joga após 0,9s                                                             | UX                                      | constantes em `main.ts`                      |
| P11 | Quem sai durante a partida vira bot até o fim e perde o assento na próxima                                   | não quebrar a ordem da mesa             | `Sala.sair`                                  |
| P12 | Salas em memória, instância única                                                                            | `[#26]` (viola `[#27]` conscientemente) | implementar `RepositorioDeSalas` em Redis    |
| P13 | Sala sem humano conectado por 10 min é removida                                                              | evitar vazamento de memória             | `TEMPO_DE_ABANDONO_MS`                       |

## 6. Decisão visual

- **Mockup:** rascunho textual (o agente de frontend descreveu as três telas antes de implementar; não houve imagem de mockup).
- **`design-de-interface-projeto`:** acionada — minimalista, mobile first, tokens de tema claro/escuro, estados de carregando/erro/vazio/offline, cartas em SVG, toasts de erro, `aria-live`, alvos de toque ≥ 44px.

## 7. Pendências e fora de escopo

- **Porta local:** a 3001 já está ocupada na sua máquina (container `rescisao-web-web-1`); o `.env` local foi ajustado para `PORT=3011` / `VITE_SERVER_URL=http://localhost:3011`. O padrão do projeto continua 3001.
- **Alerta de segurança aceito:** `npm audit` aponta 1 alerta _low_ no esbuild 0.27 (usado pelo tsup/vite) — afeta só o modo servidor de desenvolvimento do próprio esbuild no Windows, que o projeto não usa. Some quando o tsup aceitar esbuild 0.28. Dependências de produção: 0 vulnerabilidades.
- **Relógio do cliente:** a contagem regressiva usa `prazoDaVezEm` absoluto; relógio do celular desajustado mostra contagem errada (o servidor continua correto). Melhoria: enviar também o tempo restante.
- **Teto de cartas por rodada** (premissa P7) — vale confirmar.
- **Fase 2:** login/histórico, Redis (escala + sobreviver a reinícios), app Android reaproveitando `@fodinha/shared`.
- **Deploy real** na Vercel/Render não foi feito (ação externa — exige suas contas).

## 8. Próximo passo natural

Jogar uma partida com amigos em rede local, decidir as premissas P7/P8/P11 e então fazer o deploy (Render + Vercel). Depois, `testes-projeto` para um E2E automatizado (Playwright) com dois navegadores.

## 9. Rastreabilidade

- **Jira:** sem integração.
- **`CLAUDE.md`:** criado com as regras do projeto.
