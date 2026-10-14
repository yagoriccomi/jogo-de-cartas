# Diretrizes do Projeto (CLAUDE.md)

> Documento vivo de regras. Toda decisão arquitetural deste projeto deriva do
> arquivo de referência **"100 Melhores Práticas de Programação"**. Os números
> entre colchetes (ex: `[#11]`, `[#22]`) referenciam a prática que justifica a regra.
> Plano e premissas do MVP: `docs/planos/PLANO-mvp-fodinha.md`.

## Objetivo e Escopo

**Fodinha** é um jogo de cartas multiplayer online (variação do truco/"fodinha"): salas por código, até 10 participantes (humanos + até 4 bots), partida completa no navegador.

**Servidor autoritativo:** o servidor é a única fonte de verdade. O cliente recebe somente o que pode ver: a própria mão, a vira, as cartas já jogadas e, na rodada cega, a carta na testa dos outros jogadores. Nenhuma carta oculta trafega para quem não deve vê-la.

**Regras do jogo (resumo, detalhe em `packages/shared` e no plano):**

- 1 a 4 baralhos; 5 a 10 vidas iniciais; com ou sem 8-9-10.
- Cartas iguais se anulam (a próxima maior vence; se todas se anulam, ninguém leva a vaza).
- Rodadas: 1 carta → máximo possível → volta a 1. A rodada de 1 carta é **cega** (vê-se a carta dos outros, não a própria); terminados os palpites, todas as cartas vão sozinhas à mesa e a vaza é resolvida (`Partida.revelarRodadaCega`).
- Perde 1 vida por vaza de diferença entre palpite e resultado. O "pé" (último a palpitar) não pode fechar a soma.
- Prazo da vez (`TURN_TIMEOUT_SECONDS`): estourou, o servidor joga automaticamente.
- Desconexão > 10 s (carência) pausa a partida e abre votação de espera por ausente; todos NÃO → eliminado (bot termina a rodada). Pausa congela prazos e bots.
- Entrada no meio da partida: senta na próxima rodada com a maior vida entre os vivos.
- Dono (criador; passa ao humano mais antigo e volta ao criador pelo mesmo `dispositivoId`): reinicia a sala e expulsa (humano expulso fica banido pelo `dispositivoId`).
- Saída/expulsão no meio da rodada: efetiva-se entre rodadas (`Partida.agendarSaida`), para não desfazer palpites e vazas.
- A mão vai ao cliente ordenada da mais forte para a mais fraca (o cliente não reordena).
- Plano dessas regras: `docs/planos/PLANO-pausa-entrada-moderacao.md`.

**Fora do escopo do MVP** (YAGNI [#8]): login/contas, banco de dados, histórico/ranking, escala horizontal, chat, sons e animações elaboradas. São a fase 2.

**Mobile:** em vez de app nativo, o web é responsivo e instalável (PWA). Publicar na Play Store, se necessário, será empacotar esse mesmo site (TWA/Capacitor) [#7][#26].

**Identidade visual aprovada:** "Feltro + neon Vice City" (fundo #120720, feltro #0d3a3c, neon rosa #ff2a8a e ciano #2de2e6, `Yellowtail` + `Kanit`) com cartas em pixel art (valor grande; naipe pequeno nas comuns, grande e holográfico só na manilha). Ficha "1º" marca quem abre a rodada.

## Stack Tecnológica e Ferramentas

- **Frontend:** React + Vite + TypeScript (`apps/web`), organização por feature.
- **Backend:** Node 24 + Fastify + Socket.IO + TypeScript (`apps/server`), bundle com tsup, dev com `tsx watch`.
- **Contratos compartilhados:** `packages/shared` (TypeScript puro; também será consumido pelo futuro app Android).
- **Banco de Dados:** nenhum no MVP. Salas em memória; sem login (convidado + código de sala).
- **Qualidade:** ESLint + Prettier, Vitest, `tsc` estrito.
- **Infraestrutura/DevOps:** Docker Compose (dev), Dockerfile multi-stage (prod) [#85], GitHub Actions (CI) [#76]; deploy: frontend na Vercel (root `apps/web`), backend na Render (web service Node, `render.yaml`).

## Arquitetura e Padrões (Baseado nas 100 Melhores Práticas)

- **Design Pattern Principal:** monolito modularizado em monorepo npm workspaces [#26]; **Clean Architecture** no servidor [#30]: `domain` ← `application` ← `infrastructure`, com dependências apontando só para dentro.
- **Decisão consciente de estado em memória:** as salas vivem na memória de **uma única instância** na Render. Isso contraria "servidor stateless" [#27], aceito porque o MVP não precisa de escala horizontal. Mitigação: o acesso às salas fica atrás de uma interface (`RepositorioDeSalas`) [#20][#21], para trocar por Redis (+ adapter do Socket.IO) na fase 2 sem tocar no domínio.
- **Consequência operacional:** o plano grátis da Render hiberna e reinicia o processo, derrubando as partidas em andamento. Documentado no README.
- **Contrato único:** todos os tipos de evento/estado vêm de `@fodinha/shared`; servidor e web nunca redefinem payloads [#6].
- **Regras Estritas:**
  - TypeScript estrito OBRIGATÓRIO (`strict`, `noUncheckedIndexedAccess`): proibido `any` (explícito ou implícito); use `unknown` + validação na borda. [#11]
  - Identificadores do domínio do jogo em **PT-BR** (`Partida`, `vaza`, `palpite`, `manilha`, `vidas`); termos técnicos de infraestrutura podem ficar em inglês (`socket`, `handler`). [#1]
  - Domínio puro: `domain/` não importa Fastify, Socket.IO, `process.env` nem relógio/aleatoriedade diretos (use `aleatoriedade.ts` injetável para testes determinísticos). [#30]
  - Early returns para reduzir aninhamento. [#9]
  - Injeção de dependências em serviços; proibido instanciar serviço dentro de classe; composição apenas em `main.ts`. [#20][#21]
  - Funções com responsabilidade única; máximo de 3-4 parâmetros (agrupe em objeto/interface acima disso). [#2][#10]
  - DRY e KISS: sem duplicação de regra de negócio. [#6][#7]
  - Sem magic numbers/strings: limites em `LIMITES`, prazos e pausas em constantes nomeadas. [#3]
  - Comentar o "porquê", nunca o "o quê". [#4]
  - Toda entrada do cliente (payload de socket) é validada na borda da infraestrutura antes de chegar à aplicação. [#51]
  - Erros tratados em ponto único (handler global/gateway), com mensagens limpas ao cliente e sem stack trace. [#93]
  - Níveis de log adequados; apelidos de jogadores não vão para logs em nível `info`. [#92][#63]
  - ESLint + Prettier como gate; `npm run lint`, `typecheck`, `test` e `build` devem passar antes de qualquer commit. [#5][#49]
  - **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`) em PT-BR, no imperativo.
  - Zero segredos no código ou no Git; configuração só por variável de ambiente (`.env` fora do Git, `.env.example` versionado). [#37][#80]

## Estrutura de Diretórios

```
fodinha/
├── apps/
│   ├── server/                      # Node 24 + Fastify + Socket.IO
│   │   ├── src/
│   │   │   ├── domain/              # regras puras: baralho, força, vaza, rodadas, partida, estratégia de bot
│   │   │   ├── application/         # salas, serviço de sala, bots, agendador de prazos da vez
│   │   │   ├── infrastructure/      # http (/health), gateway Socket.IO, repositório em memória
│   │   │   └── main.ts              # composition root (liga tudo; lê o ambiente)
│   │   ├── test/                    # Vitest: domínio, aplicação
│   │   ├── Dockerfile               # imagem de PRODUÇÃO (multi-stage, contexto = raiz)
│   │   └── tsup.config.ts
│   └── web/                         # React + Vite + TS, organização por feature
├── packages/
│   └── shared/                      # contratos TS: cartas, configuração, estado visível, eventos
├── docs/
│   └── planos/                      # plano e entrega do MVP
├── scripts/
│   ├── dev.bat                      # ambiente local (Windows)
│   └── dev.sh                       # ambiente local (Linux/Mac)
├── .github/workflows/ci.yml         # lint + typecheck + testes + build
├── docker-compose.yml               # DESENVOLVIMENTO (server + web, hot reload)
├── render.yaml                      # Blueprint do backend na Render
├── .env.example                     # variáveis documentadas (sem segredos)
├── eslint.config.js · tsconfig.base.json · .prettierrc
└── CLAUDE.md · README.md
```

Regra de dependência: `domain` não depende de nada; `application` depende de `domain` (e de `shared`); `infrastructure` depende de `application`; `main.ts` conhece todos. `apps/web` e `apps/server` dependem de `packages/shared`, nunca um do outro.

## Diretrizes de Segurança Mínimas

- Servidor autoritativo: projeção `visaoPara(jogador)` é a única forma de gerar estado para o cliente; ids de carta opacos; coberta por testes. [#51]
- Sanitização e validação de todo payload do cliente (tipos, tamanhos, apelido limitado por `LIMITES.maxApelido`). [#51]
- Verificar a identidade do remetente em cada ação (só joga na sua vez, só a carta que é sua, só o anfitrião configura/inicia). [#51]
- CORS restrito via `CORS_ORIGINS`; sem `*` em produção. [#57]
- Rate limiting nos eventos de socket/rotas públicas quando o servidor for exposto de forma ampla. [#58]
- Apenas apelido livre e efêmero (sem PII); nada persistido; apelidos fora dos logs `info`. [#63]
- `VITE_*` é público (vai para o navegador): nunca colocar segredo nelas. [#37]

## Ambiente Local (Docker)

Serviços do compose: **`deps`** (one-shot, instala dependências dentro do container), **`server`** e **`web`**. **Não há serviços acessórios** (banco, cache, fila) no MVP; quando entrarem (ex: Redis na fase 2), adicionar ao compose e atualizar o README. [#79][#81]

- **Subir / parar / reiniciar:**
  - Windows: `scripts\dev.bat start` | `stop` | `restart` | `status` | `logs`
  - Linux/Mac: `./scripts/dev.sh start` | `stop` | `restart` | `status` | `logs`
  - O `start` copia `.env.example` para `.env` se este não existir.
- **node_modules em volumes nomeados:** o host é Windows; binários nativos (esbuild, rollup) instalados lá não rodam no Linux do container. O `deps` instala dentro do container e só reinstala quando `package.json`/`package-lock.json` mudam. Para forçar reinstalação: `docker compose down -v` (apaga os volumes).
- **Hot reload:** `CHOKIDAR_USEPOLLING=true` (bind mount no Windows não propaga eventos de arquivo).
- **Healthchecks:** `server` expõe `GET /health`; `web` só sobe depois dele saudável. [#82]
- **Portas:** `PORT` (servidor, padrão 3001) e `WEB_PORT` (web, padrão 5173) vêm do `.env`.
- **Nativo (sem Docker):** `npm install` e `npm run dev` na raiz (concurrently sobe server e web). Útil para depurar.
- **Produção:** imagem do servidor em `apps/server/Dockerfile` (multi-stage, usuário não-root, `HEALTHCHECK`) [#85]; a Render pode usar o Blueprint `render.yaml` (build nativo Node) ou a imagem.

## Comandos Úteis

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run format`

## Protocolo de Atualização do README.md (CRÍTICO)

O arquivo `README.md` é a documentação pública deste projeto. **Sempre que ocorrer
uma das mudanças abaixo durante o desenvolvimento, o `README.md` DEVE ser atualizado
no mesmo ciclo de trabalho:** [#96]

1. Adição de novas variáveis de ambiente (`.env`) (e também no `.env.example`).
2. Mudança nos comandos de instalação ou execução.
3. Novo serviço acessório no `docker-compose.yml` ou mudança na forma de deploy.
4. Adição de integração de terceiros essencial.
5. Finalização de um módulo principal ou mudança de regra do jogo.

> Falha em manter o README sincronizado é tratada como bug de documentação.
> O README é público: NUNCA colocar tags `[#N]` nele; elas vivem só neste CLAUDE.md.
