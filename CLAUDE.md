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
- Prazo da vez por sala (`prazoDaVezSegundos`: 10 a 120 s, padrão 30, ou `null` = sem limite; o dono escolhe no lobby entre os degraus do `ConfiguracaoControles`): estourou, o servidor joga automaticamente e todos os bots da mesa reagem com emoji sorteado.
- Pausa de fim de rodada: 10 s (3 s da última vaza parada + voo + ~6 s de resultado), mais 4 s quando a rodada era cega (`pausaExtraRodadaCegaMs`); o cliente segura a última vaza (`PAUSA_DA_ULTIMA_VAZA_MS`) e a revelação cega (`useAnimacaoDeVaza`).
- Lugares e primeiro pé sorteados a cada partida/reinício (`Partida` com `GeradorAleatorio`); a mão é o vivo seguinte ao pé.
- Desconexão > 10 s (carência) pausa a partida e abre votação de espera por ausente; todos NÃO → eliminado (bot termina a rodada). Pausa congela prazos e bots.
- Entrada no meio da partida: senta na próxima rodada com a maior vida entre os vivos.
- Resumo das regras (`ResumoDasRegras`): abre no começo de cada partida (rodada 1, palpites) até o jogador tocar "Não perguntar novamente neste computador" (localStorage `fodinha:resumo-das-regras`; os e2e o dispensam em `abrirCenario`). Aberto, pede `jogo:lerRegras`: a mesa inteira pausa (prazos e bots congelados) e os outros veem "Jogador noob lendo as regras!" com o tempo restante; no máximo `LIMITES.maxLeituraDasRegrasSegundos` (60 s), 1 vez por jogador por partida, um leitor por vez; cai/sai = leitura encerrada (`Sala.comecarLeituraDasRegras`).
- Dono (criador; passa ao humano mais antigo e volta ao criador pelo mesmo `dispositivoId`): pausa/retoma a partida a qualquer momento (congela prazos e bots), reinicia a sala e expulsa (humano expulso fica banido pelo `dispositivoId`).
- Opção da sala `mortosVeemCartas` (padrão desligada; só o dono muda, também no meio da partida por `sala:definirMortosVeemCartas`): eliminado recebe a mão dos outros em `maoRevelada` e a vê tocando na placa. Vivo nunca recebe mão alheia.
- Saída/expulsão no meio da rodada: efetiva-se entre rodadas (`Partida.agendarSaida`), para não desfazer palpites e vazas.
- Seletores do jogador em jogo (cartas, palpite, reações): 1 toque seleciona, 2 rápidos confirmam (`useDuploToque`; Enter/Espaço confirmam direto).
- A mão vai ao cliente ordenada da mais forte para a mais fraca (o cliente não reordena).
- Bots reagem: a cada carta jogada, 10% de chance de um emoji sorteado (`CHANCE_DE_REACAO_DO_BOT`, sorteio injetado no `CondutorDePartidas`).
- Plano dessas regras: `docs/planos/PLANO-pausa-entrada-moderacao.md`.

**Fora do escopo do MVP** (YAGNI [#8]): login/contas, banco de dados, histórico/ranking, escala horizontal, chat, sons e animações elaboradas. São a fase 2.

**Mobile:** em vez de app nativo, o web é responsivo e instalável (PWA). Publicar na Play Store, se necessário, será empacotar esse mesmo site (TWA/Capacitor) [#7][#26].

**Identidade visual aprovada:** "Feltro + neon Vice City" (fundo #120720, feltro #0d3a3c, neon rosa #ff2a8a e ciano #2de2e6, `Yellowtail` + `Kanit`; números em `Jersey 15`, escolhida por distinguir bem 2, 3 e 8 em tamanho pequeno) com cartas em pixel art (valor grande; naipe pequeno nas comuns, grande e holográfico só na manilha; verso com uma estrela pixel neon, que não se confunde com valor nem naipe). Símbolos pixel de "mão" (abre a rodada) e "pé" (pegada; último a palpitar) no canto do status; no primeiro palpite da partida aparecem com o rótulo "MÃO"/"PÉ" por extenso, depois só o ícone. Manilha num selo próprio (moldura rosa com o brilho holográfico, rótulo dentro), que a vira nunca cobre.

**Mesa (decisões de layout):** a partida nunca rola a página nem deixa arrastar além da tela (`html`/`body` presos e `overscroll-behavior: none`; o que precisar aparecer se sobrepõe à mesa; `.app` com `100dvh`; as áreas internas encolhem, cartas da mesa medidas por `cqw/cqh`). Linha de cima: a carta que está ganhando sozinha à esquerda e a pilha das demais válidas (forte → fraca, cada uma por cima da anterior). Linha de baixo: as anuladas. O dono da carta líder aparece sempre acima dela; nas demais, ao passar o mouse/focar/tocar (contorno rosa). Vaza ganha vira montinho no jogador (no celular o destino é a caixinha "Fez"); vazas todas empatadas viram um só monte abaixo da manilha (`MonteDeEmpates`; no celular só o contador; no computador a coluna da vira vira duas colunas). Contador da vaza (`n/total`) acima da vira. Enquanto os outros palpitam, o centro do feltro mostra quem palpita, o saldo em palavras e quantos já palpitaram (`AndamentoDosPalpites`, que também fornece o texto do saldo ao painel). Placas de cima na ordem de jogo (`emOrdemDeJogo`: mão à esquerda, pé à direita, eliminados no fim); no computador têm largura mínima e a faixa rola acompanhando a vez, como no celular. Mão: dica de toque acima das cartas; "Mais forte / Mais fraca" discreto, fora do fluxo e sob as cartas, escondido com 1 carta. Rodadas longas: as cartas da mão encolhem (até um mínimo legível) para a mão ocupar no máximo 30% da tela (`FRACAO_DA_TELA_PARA_A_MAO`); se nem assim couber (39 cartas ou mais), cada fileira leva o máximo de cartas, as fileiras se aproximam (o valor sempre à vista) e a carta encolhe mais um pouco, e no palpite só a grade de números rola (10 colunas no computador, 7 no celular), com título e Confirmar sempre à vista. Painel de palpite: "Vai fazer quantas?", selo "Você é o pé: não pode fechar a soma" (ao lado do título no computador; sem linha extra de bloqueio, o número fica riscado), saldo em palavras ("Pediram 3 de 5 · sobram 2", ou "passou 1") ao lado do botão, que diz "Toque num número" sem seleção e "Confirmar N / ou toque 2× no número" com ela (dois toques no mesmo número confirmam); no aperto o saldo quebra entre as duas metades e o "Toque num número" em duas linhas, nunca cortando o texto do botão, e "Mostrar mais" recolhido (lista de quem já palpitou e "depois de você +K") abaixo do Confirmar, para o botão nunca sair de vista. Gesto único (`useDuploToque`): cartas, palpite e reações, 1 toque seleciona (na reação, prévia) e 2 rápidos confirmam. A mesa pede `touch-action: manipulation` e não deixa selecionar texto: o toque duplo não dá zoom (iPhone) nem marca palavras; pinça e rolagem continuam. Dica do gesto (`useDicaDoGesto`): no primeiro uso de cada seletor do aparelho, a dica da mão, o "ou toque 2×" do palpite e a dica das reações ficam em destaque ciano com o selo "Dica"; voltam ao normal no primeiro uso (localStorage `fodinha:dica-do-gesto:*`). Sinais da vez: faixa "Sua vez!", mão pulsando, campainha própria, título da aba e rolagem das placas até quem joga. O meu tempo aparece uma vez só, na pílula "Sua vez" (nunca quebra de linha): pulsa a partir de 10 s, cada vez mais forte, e faz tic-tac a partir de 5 s. Meus corações no celular: até 5 numa linha; acima, duas linhas iguais (ímpar: a de cima leva o a mais). Entrada só com apelido, "Criar sala" e "Entrar com código"; a configuração fica no lobby, cujo botão diz o que falta ("Adicione 1 jogador para iniciar"). Fundos rosa com texto branco usam `--rosa-forte` (contraste AA); o neon `--rosa` fica para brilhos e contornos. Fim da rodada (folha): só a tabela rola e a contagem da próxima rodada fica sempre à vista; no celular baixo as linhas se aproximam para os 10 jogadores caberem. Palpite dentro do feltro; placar e regras ilustradas no topo, que no celular fica recolhido atrás de uma alça.

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
│   ├── web/                         # React + Vite + TS, organização por feature
│   └── e2e/                         # testes de tela (Playwright) contra servidor e web de dev
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
- **Tutorial (`features/tutorial`):** roda só no navegador, sem servidor. Um roteiro fixo de estados (`roteiro.ts`, no formato que o servidor envia) alimenta a mesa de verdade; `interceptarAcoes` desvia palpitar/jogar/sair para o motor do tutorial. O roteiro descreve resultados já conhecidos e não recalcula regra; ao mudar regra ou layout da mesa, revise os textos e os alvos dos balões.
- **Cenário de teste (só dev):** `http://localhost:5173/?cenario=10x13` cria uma partida sua com 9 bots já na rodada de 13 cartas (`CENARIOS_DE_TESTE=true` no servidor; ligado no compose de dev). Sobrevive a hot reload do web e a reinício do servidor (recria sozinho). Nunca ligar em produção.
- **Nativo (sem Docker):** `npm install` e `npm run dev` na raiz (concurrently sobe server e web). Útil para depurar.
- **Produção:** imagem do servidor em `apps/server/Dockerfile` (multi-stage, usuário não-root, `HEALTHCHECK`) [#85]; a Render pode usar o Blueprint `render.yaml` (build nativo Node) ou a imagem.

## Comandos Úteis

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run format` · `npm run test:e2e` (testes de tela, Playwright em `apps/e2e`; ao mudar layout da mesa, do palpite ou do tutorial, rode-os)

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
