# PLANO DE EXECUÇÃO — mvp-fodinha

| Campo                | Valor                                       |
| -------------------- | ------------------------------------------- |
| **Tarefa**           | `mvp-fodinha`                               |
| **Origem**           | descrição livre (conversa)                  |
| **Tipo**             | História                                    |
| **Modo de execução** | 🔁 Loop (sinal: "pode dar sequência")       |
| **Data**             | 2026-10-13                                  |
| **Branch**           | `main` (repositório ainda não inicializado) |

---

## 1. Enunciado Canônico

- **Problema:** o projeto tem só o esqueleto e parte do motor de regras; ninguém consegue jogar.
- **Resultado esperado:** MVP jogável — criar sala, entrar por código, adicionar bots, jogar uma partida completa com as regras definidas, com o servidor como única autoridade e o cliente recebendo só o que pode ver.
- **Como validar:** testes do motor verdes; build de todos os pacotes; servidor + web sobem localmente; uma partida completa contra bots termina com vencedor.

## 2. Escopo

**Vou fazer:**

- Motor de regras completo no domínio (`Partida`): distribuição, vira/manilha, palpites com restrição do pé, vazas com anulação, perda de vidas, eliminação, rodadas 1→máx→1, rodada cega.
- Camada de aplicação: salas em memória, anfitrião, bots (estratégia simples), prazo da vez com jogada automática, reconexão por token.
- Infraestrutura: Fastify (`/health`) + Socket.IO tipado, CORS restrito, validação de payloads.
- Frontend web (React + Vite): telas de entrada, lobby e mesa, com design via `design-de-interface-projeto`.
- Documentação e ambiente: `CLAUDE.md`, `README.md`, `docker-compose.yml`, `scripts/dev.*`, `Dockerfile` do servidor, `render.yaml`, `vercel.json`, CI.

**NÃO vou fazer (escopo negativo)** [#8]:

- Login/contas, banco de dados, histórico e ranking (fase 2).
- App Android (fase 2 — o pacote `@fodinha/shared` já fica pronto para reaproveitamento).
- Escala horizontal do servidor (exige Redis + adapter do Socket.IO; o repositório de salas já é uma interface para isso).
- Chat, sons, animações elaboradas.
- Deploy real na Vercel/Render (ação externa — só os arquivos de configuração).

## 3. Premissas Assumidas

| #   | Premissa                                                                                                         | Por quê                                                                                                                 | Se estiver errada…                                   |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| P1  | Ordem de força das cartas comuns: 4 < 5 < 6 < 7 < (8 < 9 < 10) < Q < J < K < A < 2 < 3                           | Ordem do truco paulista, a mais usada na Fodinha `[#3]`                                                                 | Alterar `VALORES` em `packages/shared/src/cartas.ts` |
| P2  | Manilhas por naipe: ouros < espadas < copas < paus                                                               | Padrão do truco `[#3]`                                                                                                  | Alterar `NAIPES`                                     |
| P3  | Cartas comuns de mesmo valor empatam (naipe não desempata); manilhas idênticas (vários baralhos) também empatam  | Decorre de "cartas iguais se anulam"                                                                                    | `forcaDaCarta` em `domain/forca.ts`                  |
| P4  | Se todas as cartas da vaza se anulam, quem abriu a vaza abre a próxima                                           | Regra simples e determinística `[#7]`                                                                                   | `Partida.jogarCarta`                                 |
| P5  | Primeiro pé sorteado; depois roda para o próximo jogador vivo à esquerda                                         | Convenção de mesa                                                                                                       | `Partida`                                            |
| P6  | Palpites começam à esquerda do pé; quem está à esquerda do pé abre a 1ª vaza; o vencedor da vaza abre a seguinte | Convenção de mesa                                                                                                       | `Partida`                                            |
| P7  | Máximo de cartas por jogador = ⌊(cartas do monte − 1) / vivos⌋ (uma carta é a vira), sem teto extra              | Regra literal pedida                                                                                                    | Adicionar teto configurável                          |
| P8  | Se todos os restantes zeram na mesma rodada, vence quem ficou com mais vidas (menos negativo); empate se igual   | Evita partida sem vencedor `[#7]`                                                                                       | `Partida.encerrarRodada`                             |
| P9  | Prazo da vez padrão 30s (`TURN_TIMEOUT_SECONDS`); estourou → servidor joga com a estratégia do bot               | Mesa não trava com jogador ausente `[#80]`                                                                              | Variável de ambiente                                 |
| P10 | Pausa de 4s no fim de rodada para exibir o resultado                                                             | UX — tempo de leitura                                                                                                   | Constante em `application`                           |
| P11 | Mínimo de 2 participantes (humanos + bots) para iniciar; só o anfitrião configura/inicia/adiciona bots           | Controle de sala                                                                                                        | `SalaService`                                        |
| P12 | Estado das salas em memória numa instância única na Render                                                       | Monolito primeiro `[#26]`; viola `[#27]` conscientemente — repositório atrás de interface `[#20]` para trocar por Redis | Implementar `RepositorioDeSalas` em Redis            |
| P13 | Identificadores de código em PT-BR (domínio do jogo é brasileiro)                                                | `[#1]` nomes que revelam intenção                                                                                       | —                                                    |

## 4. Decisão Visual

- **Tem superfície visual?** Sim (entrada, lobby, mesa).
- **Precisa de mockup?** Sim — telas novas e mais de um caminho visual possível.
- **`design-de-interface-projeto` acionada?** Sim — pelo agente do frontend, antes de implementar.
- **Referência visual existente:** nenhuma.

## 5. Terreno (o que já existe)

| Arquivo                                                                                   | Papel hoje                                          | O que muda                                            |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| `packages/shared/src/*`                                                                   | Contratos (cartas, config, estado visível, eventos) | Estável — só ajustes se necessário                    |
| `apps/server/src/domain/{baralho,forca,vaza,rodadas,configuracao,erros,aleatoriedade}.ts` | Regras puras                                        | Criar `partida.ts`, `estrategia-bot.ts`               |
| `apps/server/src/application/`                                                            | —                                                   | Criar salas, serviço, agendador                       |
| `apps/server/src/infrastructure/`                                                         | —                                                   | Criar gateway Socket.IO, HTTP, repositório em memória |
| `apps/web/`                                                                               | —                                                   | Criar (agente em segundo plano)                       |
| docs/infra na raiz                                                                        | parcial                                             | Completar (agente em segundo plano)                   |

**Reaproveitamento** [#6]: todos os tipos de payload vêm de `@fodinha/shared` — servidor, web e (futuro) Android usam o mesmo contrato.
**Convenções locais** [#5][#13]: Clean Architecture no servidor (domain ← application ← infrastructure), ESLint + Prettier, TypeScript estrito.

## 6. Passos Atômicos

| #   | Arquivo alvo                                   | O que muda (1 frase)                                                          | Prática                     | Como verificar                    |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------- | --------------------------------- |
| 1   | `apps/server/src/domain/partida.ts`            | Agregado `Partida` com máquina de estados da partida                          | `[#30][#2]`                 | testes unitários                  |
| 2   | `apps/server/test/domain/*.test.ts`            | Testes de força, vaza/anulação, rodadas, palpite do pé, partida completa      | `[#41][#46]`                | `npm test`                        |
| 3   | `apps/server/src/domain/estrategia-bot.ts`     | Estratégia simples de palpite e jogada                                        | `[#23]` Strategy            | teste: partida só de bots termina |
| 4   | `apps/server/src/application/*`                | Sala, serviço de sala, agendador de prazos/bots                               | `[#21][#22]`                | testes de aplicação               |
| 5   | `apps/server/src/infrastructure/*` + `main.ts` | Fastify `/health`, Socket.IO tipado, validação, CORS, logs                    | `[#51][#57][#82][#91][#93]` | servidor sobe; `/health` 200      |
| 6   | `apps/web/*` (agente)                          | Telas de entrada, lobby e mesa                                                | `[#13][#53]`                | build + partida no navegador      |
| 7   | raiz (agente)                                  | CLAUDE.md, README, compose, scripts, Dockerfile, render.yaml, vercel.json, CI | `[#76][#78][#79][#85][#96]` | `scripts/dev.bat start` sobe tudo |
| 8   | —                                              | `npm install`, typecheck, lint, test, build; jogo real no navegador           | `[#49]`                     | tudo verde                        |

## 7. Impacto em Dados e Contratos

- **Banco de dados:** nenhum.
- **Contrato:** eventos Socket.IO tipados em `@fodinha/shared` (fonte única).
- **Configuração:** `PORT`, `CORS_ORIGINS`, `LOG_LEVEL`, `TURN_TIMEOUT_SECONDS`, `VITE_SERVER_URL` [#80].
- **LGPD:** apenas apelido livre, efêmero, sem persistência; não logar apelidos em nível info [#63].

## 8. Plano de Testes

| Nível            | O que cobre                                                             | Caminho de falha coberto                                 |
| ---------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Unidade [#41]    | força/manilha, anulação, rodadas, pé, perda de vidas, visão por jogador | jogar fora da vez, carta que não é sua, palpite proibido |
| Integração [#42] | serviço de sala + partida + bots                                        | sala cheia, não-anfitrião iniciando                      |
| E2E [#43]        | partida no navegador contra bots (manual nesta fase)                    | reconexão após recarregar a página                       |

**Comando:** `npm test`

## 9. Riscos e Rollback

| Risco                                                        | Probabilidade | Impacto              | Mitigação                                |
| ------------------------------------------------------------ | ------------- | -------------------- | ---------------------------------------- |
| Plano grátis da Render hiberna e derruba partidas em memória | Alta          | Partidas perdidas    | Documentar; fase 2 com Redis             |
| Vazamento de carta oculta para o cliente                     | Média         | Trapaça              | Projeção `visaoPara` testada; ids opacos |
| Timers órfãos após sala esvaziar                             | Média         | Vazamento de memória | Agendador cancela ao remover sala        |

**Rollback** [#84]: projeto novo — reverter commit.

## 10. Definição de Pronto

- [x] Todos os passos da seção 6 executados
- [x] Build passa
- [x] Testes passam [#49]
- [x] Aplicação subiu e uma partida foi jogada
- [x] Sem segredo em código [#37]
- [x] Erros tratados no ponto único e logados no nível certo [#92][#93]
- [x] `docs/planos/ENTREGA-mvp-fodinha.md` escrito
