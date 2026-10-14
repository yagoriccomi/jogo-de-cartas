# Fodinha

![Versão](https://img.shields.io/badge/vers%C3%A3o-0.1.0-blue)
![Node](https://img.shields.io/badge/node-24-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)

Fodinha é um jogo de cartas multiplayer online, jogado direto no navegador. Crie uma sala, compartilhe o código com os amigos, complete a mesa com bots se faltar gente e jogue uma partida inteira. O servidor é a única autoridade do jogo: cada jogador recebe apenas o que pode ver, então não há como espiar cartas dos outros.

## Regras resumidas

- **Baralhos e vidas:** de 1 a 4 baralhos misturados; cada jogador começa com 5 a 10 vidas. Dá para jogar com ou sem as cartas 8, 9 e 10.
- **Rodadas:** começam com 1 carta por jogador, sobem até o máximo que o baralho permite e voltam a 1, repetindo o ciclo.
- **Vira e manilhas:** uma carta é virada a cada rodada; a partir dela definem-se as manilhas, as cartas mais fortes.
- **Palpite:** antes de jogar, cada um diz quantas vazas (mãos) vai ganhar. O último a palpitar (o "pé") não pode dizer um número que feche a soma exatamente igual ao total de vazas da rodada, para que alguém sempre erre.
- **Vazas:** vence a carta mais forte. Cartas iguais se anulam: vale a próxima maior; se todas se anularem, ninguém leva a vaza.
- **Rodada cega:** na rodada de 1 carta, você não vê a sua, mas vê a dos outros jogadores (na testa). Assim que todos palpitam, as cartas vão sozinhas para a mesa, o resultado sai e o jogo segue.
- **Vidas:** ao fim da rodada, cada jogador perde 1 vida por vaza de diferença entre o palpite e o que ganhou. Quem zera vidas é eliminado; vence o último de pé.
- **Mesa:** até 10 participantes, com até 4 bots.
- **Tempo da vez:** se o jogador não agir dentro do prazo, o servidor joga por ele automaticamente.
- **Queda de conexão:** se alguém fica mais de 10 segundos desconectado, a partida pausa e os jogadores votam "Deseja esperar o retorno de [apelido]?". Basta um SIM para continuar esperando; se todos votarem NÃO, um bot termina a rodada dele e ele é eliminado.
- **Entrar no meio:** dá para entrar com a partida em andamento. Quem chega assiste até a próxima rodada e senta com a mesma quantidade de vidas do jogador vivo com mais vidas.
- **Dono da sala:** quem criou a sala pode pausar e retomar a partida quando quiser, reiniciá-la (volta à rodada 1 com vidas cheias para todos) e expulsar pessoas. Quem é expulso não consegue voltar àquela sala pelo mesmo navegador. Se o dono sair, o posto passa para quem está há mais tempo na sala, e volta para o criador se ele retornar.
- **Saída no meio da rodada:** quem sai (ou é expulso) tem a rodada terminada por um bot e só então deixa a mesa.
- **Mão organizada:** suas cartas aparecem sempre da mais forte (à esquerda) para a mais fraca (à direita), considerando a manilha da rodada.
- **Mesa:** a carta que está ganhando fica sozinha à esquerda; as demais que valem formam uma pilha ao lado, da mais forte para a mais fraca. As que empataram e se anularam ficam na linha de baixo. Cada vaza ganha vira um montinho na frente de quem ganhou; vaza toda empatada vira um montinho no canto inferior direito da mesa.

## Features

- Salas por código, sem cadastro: entre como convidado com um apelido.
- Site responsivo e instalável no celular (abre em tela cheia, com ícone na tela inicial).
- Visual "Vice City": mesa de feltro com neon e cartas em pixel art; manilhas com brilho holográfico.
- Anfitrião configura a partida (baralhos, vidas, 8-9-10), adiciona bots e inicia.
- Bots com estratégia simples para completar a mesa.
- Servidor autoritativo: o cliente só recebe a própria mão, a vira, as cartas jogadas e, na rodada cega, a carta dos outros.
- Reconexão por token após recarregar a página.
- Prazo da vez com jogada automática, para a mesa nunca travar.
- Placar a qualquer momento (vidas, palpite e vazas feitas de todos) e guia de regras ilustrado, passo a passo.
- Partida sem rolar a tela: no celular o topo fica recolhido (toque na alça ou deslize para baixo a partir do topo para abrir) e o palpite aparece dentro da mesa, sem cobrir a mão nem as suas vidas.

## Tecnologias Utilizadas

- **Monorepo** com npm workspaces: `packages/shared`, `apps/server`, `apps/web`
- **Servidor:** Node 24, Fastify, Socket.IO, TypeScript, tsup
- **Web:** React, Vite, TypeScript
- **Contratos compartilhados:** `@fodinha/shared` (reaproveitável pelo futuro app Android)
- **Qualidade:** ESLint, Prettier, Vitest, GitHub Actions
- **Infra:** Docker e Docker Compose (desenvolvimento), Vercel (frontend), Render (backend)

## Como Rodar o Projeto Localmente

### Pré-requisitos

- **Opção Docker (recomendada):** Docker Desktop (ou Docker Engine) com Compose v2.24 ou superior.
- **Opção nativa:** Node.js 24 e npm.

### Opção 1: Docker (um comando)

1. Clone o repositório e entre na pasta:

   ```
   git clone <url-do-repositorio>
   cd fodinha
   ```

2. Suba o ambiente:
   - Windows: `scripts\dev.bat start`
   - Linux/Mac: `./scripts/dev.sh start`

   Se o arquivo `.env` não existir, ele é criado automaticamente a partir do `.env.example`. Na primeira execução, as dependências são instaladas dentro do container, o que leva alguns minutos.

3. Acesse:
   - Jogo: http://localhost:5173
   - Saúde do servidor: http://localhost:3001/health

Outros comandos (no mesmo script): `stop`, `restart`, `status` e `logs`.

Detalhes do ambiente Docker:

- Sobem os serviços `server` e `web` com recarga automática ao salvar arquivos. O serviço `deps` roda uma vez para instalar as dependências e termina.
- O `node_modules` fica em volumes do Docker (não na sua pasta), porque binários instalados no Windows não funcionam dentro do container Linux. Para forçar uma reinstalação completa: `docker compose down -v`.
- Não há banco de dados, cache nem fila neste projeto: as salas ficam na memória do servidor.
- Porta já em uso (erro `port is already allocated`)? Troque `PORT` no `.env` e ajuste `VITE_SERVER_URL` para a mesma porta (ex.: `PORT=3011` e `VITE_SERVER_URL=http://localhost:3011`). Depois rode `restart`.
- O `package-lock.json` precisa conter os binários de todas as plataformas (Windows e Linux). Se for regenerá-lo, apague antes o `node_modules` e rode `npm install` do zero; caso contrário, o container pode falhar com erro de binário nativo (ex.: `rolldown`).

### Opção 2: Nativo (sem Docker)

1. Instale as dependências:

   ```
   npm install
   ```

2. Crie o arquivo de ambiente:

   ```
   cp .env.example .env
   ```

   No Windows (PowerShell): `Copy-Item .env.example .env`

3. Inicie servidor e web juntos:

   ```
   npm run dev
   ```

   Ou separadamente: `npm run dev:server` e `npm run dev:web`.

## Testes e Qualidade

```
npm test            # testes (Vitest)
npm run typecheck   # checagem de tipos
npm run lint        # ESLint
npm run build       # build de todos os pacotes
npm run format      # formata com Prettier
```

A cada push e pull request, o GitHub Actions executa lint, typecheck, testes e build.

## Variáveis de Ambiente

Copie o `.env.example` para `.env`. Nada neste projeto exige segredos.

| Variável               | Onde     | Para que serve                                                                                                                      |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                 | servidor | Porta HTTP/WebSocket do servidor de jogo (padrão `3001`).                                                                           |
| `CORS_ORIGINS`         | servidor | Origens autorizadas a conectar, separadas por vírgula (padrão `http://localhost:5173`).                                             |
| `LOG_LEVEL`            | servidor | Nível de log: `debug`, `info`, `warn` ou `error`.                                                                                   |
| `TURN_TIMEOUT_SECONDS` | servidor | Segundos que o jogador tem para agir antes da jogada automática (padrão `30`).                                                      |
| `CENARIOS_DE_TESTE`    | servidor | Só desenvolvimento (padrão `false`; o Docker de dev liga). Libera a criação de salas de teste com bots. Nunca habilite em produção. |
| `VITE_SERVER_URL`      | web      | URL pública do servidor de jogo. Fica exposta no navegador: nunca coloque nada sensível.                                            |
| `WEB_PORT`             | Docker   | Opcional. Porta do frontend no host (padrão `5173`). Se mudar, inclua a nova origem em `CORS_ORIGINS`.                              |

### Testar com 10 jogadores

Com o servidor de desenvolvimento (`CENARIOS_DE_TESTE=true`, já ligado no Docker de dev; no modo nativo, defina a variável) e o web em `npm run dev`, abra `http://localhost:5173/?cenario=10x13`: você entra sozinho numa partida com 10 jogadores (você + 9 bots), 4 baralhos sem 8, 9 e 10, e 13 cartas na primeira rodada (`?cenario=JOGADORESxCARTAS`; só `?cenario` equivale a `10x13`). Com 10 jogadores o máximo é 15 cartas. Se o servidor reiniciar com a alteração do código, o cliente recria o cenário sozinho; se só o web recarregar, você volta à mesma partida. O parâmetro é ignorado no build de produção.

## Deploy

O frontend vai para a Vercel e o servidor de jogo para a Render.

### Backend na Render

1. No painel da Render, crie um **Blueprint** apontando para este repositório; o arquivo `render.yaml` na raiz descreve o serviço (web service Node, plano grátis, verificação de saúde em `/health`).
2. Defina `CORS_ORIGINS` com a URL do frontend na Vercel (por exemplo `https://fodinha.vercel.app`). Várias origens são separadas por vírgula.
3. `LOG_LEVEL` e `TURN_TIMEOUT_SECONDS` já têm valores padrão no Blueprint.

Também há um `Dockerfile` de produção em `apps/server/Dockerfile` (build multi-stage, usuário não-root). Para gerar a imagem, a partir da raiz: `docker build -f apps/server/Dockerfile -t fodinha-server .`

> **Atenção ao plano grátis da Render:** o serviço hiberna depois de alguns minutos sem tráfego e reinicia ao receber a próxima requisição. Como as salas ficam na memória do servidor, **toda partida em andamento é perdida** quando isso acontece, e a primeira conexão após a hibernação demora. Para jogar com amigos sem surpresas, use um plano pago ou, na fase 2, a persistência em Redis.

### Frontend na Vercel

1. Importe o repositório na Vercel e defina o **Root Directory** como `apps/web`.
2. Configure `VITE_SERVER_URL` com a URL pública do serviço na Render.
3. Faça o deploy. Depois, volte à Render e confirme que `CORS_ORIGINS` contém a URL final da Vercel.

## Roadmap (fase 2)

- Publicar na Play Store empacotando o site instalável (TWA/Capacitor), sem reescrever o jogo
- Banimento à prova de aba anônima (depende de login)
- Login e contas de jogador
- Persistência de histórico e ranking
- Redis para estado das salas e escala horizontal (o repositório de salas já fica atrás de uma interface para essa troca)
- Chat, sons e animações
