# Diretrizes do Projeto (CLAUDE.md)

> Documento vivo de regras. Toda decisão arquitetural deste projeto deriva do
> arquivo de referência **"100 Melhores Práticas de Programação"**. Os números
> entre colchetes (ex: `[#11]`, `[#22]`) referenciam a prática que justifica a regra.
> Plano e premissas do MVP: `docs/planos/PLANO-mvp-fodinha.md`.

## Objetivo e Escopo

**Fodinha** é um jogo de cartas multiplayer online (variação do truco/"fodinha"): salas por código, até 10 participantes (humanos + até 6 bots), partida completa no navegador.

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
- Bot (`EstrategiaDoBot`, `domain/bot/`): decisões em `answers/2026_10_22 bot-situacoes 001.md` (escada para não ganhar a vaza, esperar a posição de último, sabotagem sem custo próprio, memória só da última vaza e manilhas à vista, erro com sorteio injetado; no palpite, só erra na dúvida).
- Perfis dos bots (`domain/bot/perfis.ts`, decisões em `answers/2026_10_22 bot-perfis 001.md`): 6 estilos em 3 grupos (cautelosos, equilibrados, agressivos), o mesmo cérebro com outros números (`AjustesDoPerfil`). Sorteados em `Sala.comecarPartida` conforme quantos bots jogam (`sortearPerfis`; no lobby o bot não tem perfil). Quem estoura o prazo joga com o Equilibrado (`PERFIL_DA_JOGADA_AUTOMATICA`).
- Mudou bot ou perfil: meça nas duas pontas, mesa de 3 e de 10 (`npm run simular -w apps/server -- --pares 2000`, mesas em paralelo, só números); os testes de `apps/server/test/simulacao` cobram que cada perfil vença o bot anterior na mesa de 3 e não fique muito atrás na de 10.
- Bots reagem: a cada carta jogada, 10% de chance de um emoji sorteado (`CHANCE_DE_REACAO_DO_BOT`, sorteio injetado no `CondutorDePartidas`).
- Plano dessas regras: `docs/planos/PLANO-pausa-entrada-moderacao.md`.

**Fora do escopo do MVP** (YAGNI [#8]): login/contas, tela de histórico/replay, ranking, escala horizontal e chat. São a fase 2. A gravação do histórico por rodada já existe (veja Banco de Dados).

**Som (`features/som`):** tudo sintetizado no navegador com Web Audio, sem arquivo de áudio nem licença de terceiros: efeitos de fliperama, tic-tac da vez, som de cada reação e a música de fundo (`musica.ts`, gerada em loop com variação). Vibração na vez e ao perder vida. Mudo geral e volumes separados (música, efeitos, reações; começam em 50%) no menu lateral, salvos no localStorage (`fodinha:som`, `fodinha:volume-*`). A música só começa depois do primeiro toque e pausa com a aba oculta.

**Mobile:** em vez de app nativo, o web é responsivo e instalável (PWA). Publicar na Play Store, se necessário, será empacotar esse mesmo site (TWA/Capacitor) [#7][#26].

**Identidade visual aprovada:** "Feltro + neon Vice City" (fundo #120720, feltro #0d3a3c, neon rosa #ff2a8a e ciano #2de2e6, `Yellowtail` + `Kanit`; números em `Jersey 15`, escolhida por distinguir bem 2, 3 e 8 em tamanho pequeno) com cartas em pixel art (valor grande; naipe pequeno nas comuns, grande e holográfico só na manilha; verso com uma estrela pixel neon, que não se confunde com valor nem naipe). Símbolos pixel de "mão" (abre a rodada) e "pé" (pegada; último a palpitar) no canto do status; no primeiro palpite da partida aparecem com o rótulo "MÃO"/"PÉ" por extenso, depois só o ícone. Manilha num selo próprio (moldura rosa com o brilho holográfico, rótulo dentro), que a vira nunca cobre.

**Mesa (decisões de layout):** estilos em `features/mesa/estilos/`, um arquivo por área; `mesa.css` só os importa, e a ordem dos imports é a ordem da cascata (computador, celular e celular baixo por último, porque sobrescrevem as áreas).

- **Sem rolagem:** a partida nunca rola a página nem deixa arrastar além da tela (`html`/`body` presos e `overscroll-behavior: none`; o que precisar aparecer se sobrepõe à mesa; `.app` com `100dvh`; as áreas internas encolhem, cartas da mesa medidas por `cqw/cqh`).
- **Cartas no feltro:** linha de cima: a carta que está ganhando sozinha à esquerda e a pilha das demais válidas (forte → fraca, cada uma por cima da anterior). Linha de baixo: as anuladas. O dono da carta líder aparece sempre acima dela; nas demais, ao passar o mouse/focar/tocar (contorno rosa).
- **Vazas:** vaza ganha vira montinho no jogador (no celular o destino é a caixinha "Fez"); vazas todas empatadas viram um só monte abaixo da manilha (`MonteDeEmpates`; no celular só o contador; no computador a coluna da vira vira duas colunas). Contador da vaza (`n/total`) acima da vira.
- **Andamento dos palpites:** enquanto os outros palpitam, o centro do feltro mostra quem palpita, o saldo em palavras e quantos já palpitaram (`AndamentoDosPalpites`, que também fornece o texto do saldo ao painel).
- **Placas:** placas de cima na ordem de jogo (`emOrdemDeJogo`: mão à esquerda, pé à direita, eliminados no fim); no computador têm largura mínima e a faixa rola acompanhando a vez, como no celular. Meus corações no celular: até 5 numa linha; acima, duas linhas iguais (ímpar: a de cima leva o a mais).
- **Mão:** dica de toque acima das cartas; "Mais forte / Mais fraca" discreto, fora do fluxo e sob as cartas, escondido com 1 carta.
- **Rodadas longas:** as cartas da mão encolhem (até um mínimo legível) para a mão ocupar no máximo 30% da tela (`FRACAO_DA_TELA_PARA_A_MAO`); se nem assim couber (39 cartas ou mais), cada fileira leva o máximo de cartas, as fileiras se aproximam (o valor sempre à vista) e a carta encolhe mais um pouco, e no palpite só a grade de números rola (10 colunas no computador, 7 no celular), com título e Confirmar sempre à vista.
- **Painel de palpite:** dentro do feltro. "Vai fazer quantas?", selo "Você é o pé: não pode fechar a soma" (ao lado do título no computador; sem linha extra de bloqueio, o número fica riscado), saldo em palavras ("Pediram 3 de 5 · sobram 2", ou "passou 1") ao lado do botão, que diz "Toque num número" sem seleção e "Confirmar N / ou toque 2× no número" com ela (dois toques no mesmo número confirmam); no aperto o saldo quebra entre as duas metades e o "Toque num número" em duas linhas, nunca cortando o texto do botão, e "Mostrar mais" recolhido (lista de quem já palpitou e "depois de você +K") abaixo do Confirmar, para o botão nunca sair de vista.
- **Gesto único (`useDuploToque`):** cartas, palpite e reações, 1 toque seleciona (na reação, prévia) e 2 rápidos confirmam. A mesa pede `touch-action: manipulation` e não deixa selecionar texto: o toque duplo não dá zoom (iPhone) nem marca palavras; pinça e rolagem continuam.
- **Dica do gesto (`useDicaDoGesto`):** no primeiro uso de cada seletor do aparelho, a dica da mão, o "ou toque 2×" do palpite e a dica das reações ficam em destaque ciano com o selo "Dica"; voltam ao normal no primeiro uso (localStorage `fodinha:dica-do-gesto:*`).
- **Sinais da vez:** faixa "Sua vez!", mão pulsando, campainha própria, título da aba e rolagem das placas até quem joga. O meu tempo aparece uma vez só, na pílula "Sua vez" (nunca quebra de linha): pulsa a partir de 10 s, cada vez mais forte, e faz tic-tac a partir de 5 s.
- **Entrada e lobby:** entrada só com apelido, "Criar sala" e "Entrar com código"; a configuração fica no lobby, cujo botão diz o que falta ("Adicione 1 jogador para iniciar").
- **Cores:** fundos rosa com texto branco usam `--rosa-forte` (contraste AA); o neon `--rosa` fica para brilhos e contornos.
- **Fim da rodada (folha):** só a tabela rola e a contagem da próxima rodada fica sempre à vista; no celular baixo as linhas se aproximam para os 10 jogadores caberem.
- **Topo:** placar e regras ilustradas no topo, que no celular fica recolhido atrás de uma alça.

## Stack Tecnológica e Ferramentas

- **Frontend:** React + Vite + TypeScript (`apps/web`), organização por feature.
- **Backend:** Node 24 + Fastify + Socket.IO + TypeScript (`apps/server`), bundle com tsup, dev com `tsx watch`.
- **Contratos compartilhados:** `packages/shared` (TypeScript puro; também será consumido pelo futuro app Android).
- **Banco de Dados:** Turso/libSQL (`@libsql/client`) só para o histórico das partidas; as salas continuam em memória e não há login (convidado + código de sala). Cada partida real vira o diário do domínio (`domain/diario.ts`, versão 2: só fatos, isto é, os assentos com vidas e mãos, palpites e cartas na ordem, quem decidiu cada lance e as `ocorrencias` que mudam a visão no meio da rodada: saída marcada e troca de `mortosVeemCartas`), gravado uma linha JSON por rodada pela porta `RegistroDePartidas` (`application/historico-de-partidas.ts`, fila assíncrona: falha só vai ao log `error`, nunca para o jogo). Tutorial e `CENARIOS_DE_TESTE` não gravam. Sem `TURSO_DATABASE_URL`, adaptador nulo; banco que não abre na subida também cai no nulo. Migrations versionadas em `apps/server/migrations/` (`NNNN_nome.sql`), aplicadas na subida com a tabela `migracoes_aplicadas`; migration nova é sempre um arquivo novo, nunca edição de um já aplicado. Export para treino: `npm run exportar-treino -w apps/server` (JSONL, uma linha por decisão). A visão de cada decisão não é gravada: `reconstruirRodada` (`domain/reconstrucao.ts`) reencena a rodada numa `Partida` (`Partida.reencenar`) e pergunta a `visaoPara`, para a regra de quem vê o quê ficar num lugar só [#6]. O que a visão mostra e vem de fora da rodada (última vaza e resultado anteriores) sai da rodada anterior do mesmo diário; ao mudar a projeção ou o que muda a visão no meio da rodada, o teste de equivalência do diário (`test/domain/diario.test.ts`) tem de continuar idêntico.
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
│   │   │   ├── domain/              # regras puras: baralho, força, vaza, rodadas, partida, projeção (quem vê o quê), estratégia de bot
│   │   │   ├── application/         # salas, serviço de sala, bots, agendador de prazos da vez
│   │   │   ├── infrastructure/      # http (/health), gateway Socket.IO (+ entradas: unknown → tipos), repositório em memória, historico/ (libSQL, migrations, export)
│   │   │   └── main.ts              # composition root (liga tudo; lê o ambiente)
│   │   ├── migrations/              # SQL versionado do histórico (aplicado na subida)
│   │   ├── test/                    # Vitest: domínio, aplicação
│   │   ├── Dockerfile               # imagem de PRODUÇÃO (multi-stage, contexto = raiz)
│   │   └── tsup.config.ts
│   ├── web/                         # React + Vite + TS, organização por feature
│   │   └── test/                    # Vitest: cálculos puros da mesa e coerência do tutorial
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

- Servidor autoritativo: `projetarMesa(sala, instantes)` (`domain/projecao.ts`) é a única forma de gerar estado para o cliente: decide os destinatários (quem está saindo não recebe) e o que cada um vê (as cartas via `projetarPara`); a aplicação só entrega; ids de carta opacos; coberta por testes. [#51]
- Sanitização e validação de todo payload do cliente (tipos, tamanhos, apelido limitado por `LIMITES.maxApelido`). [#51]
- Verificar a identidade do remetente em cada ação (só joga na sua vez, só a carta que é sua, só o anfitrião configura/inicia). [#51]
- CORS restrito via `CORS_ORIGINS`; sem `*` em produção. [#57]
- Rate limiting nos eventos de socket/rotas públicas quando o servidor for exposto de forma ampla. [#58]
- Apenas apelido livre e efêmero (sem PII); apelidos fora dos logs `info`. O histórico grava as partidas só por id opaco de jogador (o lugar na sala), sem apelido nem `dispositivoId`; o teste do diário cobra isso. [#63]
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
- **Tutorial (`features/tutorial`):** roda só no navegador, sem servidor. Um roteiro fixo de estados (`roteiro.ts`, no formato que o servidor envia) alimenta a mesa de verdade; a fonte da partida (`estado/fonteDaPartida.ts`) liga o motor do tutorial no lugar do servidor; ele responde a todas as ações e recusa as que não ensina. O roteiro descreve resultados já conhecidos e não recalcula regra; ao mudar regra ou layout da mesa, revise os textos e os alvos dos balões (`apps/web/test/features/tutorial/roteiro.test.ts` confere que cada momento do roteiro continua possível).
- **Cenário de teste (só dev):** `http://localhost:5173/?cenario=10x13` cria uma partida sua com 9 bots já na rodada de 13 cartas (`CENARIOS_DE_TESTE=true` no servidor; ligado no compose de dev). Sobrevive a hot reload do web e a reinício do servidor (recria sozinho). Nunca ligar em produção.
- **Nativo (sem Docker):** `npm install` e `npm run dev` na raiz (concurrently sobe server e web). Útil para depurar.
- **Produção:** imagem do servidor em `apps/server/Dockerfile` (multi-stage, usuário não-root, `HEALTHCHECK`) [#85]; a Render pode usar o Blueprint `render.yaml` (build nativo Node) ou a imagem.

## Comandos Úteis

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint` · `npm run format` · `npm run test:e2e` (testes de tela, Playwright em `apps/e2e`; ao mudar layout da mesa, do palpite ou do tutorial, rode-os) · `npm run exportar-treino -w apps/server -- --url <banco> --saida <arquivo.jsonl>`

## Deploy (automático a cada merge na `main`)

**Depois de todo merge na `main`, acompanhe os dois deploys e avise o usuário quando ambos terminarem**, com o estado de cada um (ou o erro, se falhar). Não encerre a tarefa só com o merge.

- **Vercel (web):** projeto `jogo-de-cartas` (`prj_9E6hAaZqI1octiX3pNlpMVmhRiP4`, time `team_ZAm2WtQRBFWlkdJvPlSUhe1u`). Pelo MCP da Vercel: `list_deployments` com esse `projectId`/`teamId` e `sha` do commit de merge; pronto quando `target: production` e `state: READY` (`ERROR`/`CANCELED` = falhou: leia os logs de build).
- **Render (servidor):** serviço `fodinha-server` (`srv-db7p6avavr4c7392fkkg`, workspace `tea-d1hc27mr433s738ri6u0`), autodeploy da `main`. Pelo MCP da Render: `list_deploys` do serviço e `get_deploy` do deploy com o commit do merge; pronto quando `status: live` (`build_failed`/`update_failed` = falhou). O deploy leva ~40 s.
- **Confirmação final:** `GET https://fodinha-server-2sg2.onrender.com/health` deve responder 200 (no plano grátis, a primeira chamada pode demorar enquanto o serviço acorda).

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
