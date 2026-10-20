# Handoff: melhorias de usabilidade (avaliação heurística de 20/10/2026)

Origem: avaliação heurística feita no jogo rodando localmente (Pixel 7, 360×640 e 1366×768). Não
houve teste com jogadores reais; o plano de teste está no fim. Cada item traz a decisão do dono do
produto. "Aceito" quer dizer aplicar a sugestão original, descrita abaixo.

Regra para todos os itens: funcionar no celular e no computador, de 2 a 10 jogadores, sem um
elemento cobrir outro. Ao mexer em mesa, palpite ou tutorial, rodar `npm run test:e2e` e revisar os
textos e alvos dos balões do tutorial (`features/tutorial`).

## Alto impacto

### 1. Botão do palpite com rótulo claro (aceito)

- Hoje o botão desativado diz "ESCOLHA": parece ação, mas é aviso.
- Sem número selecionado: "Toque num número". Com seleção: "Confirmar 2".
- Logo abaixo, uma dica curta do gesto: "ou toque 2× no número".
- Arquivo: `apps/web/src/features/mesa/PainelPalpite.tsx`.

### 2. Ajuda na primeira partida: um único balão com o resumo geral

- Um único balão com o resumo geral das regras, mostrado na primeira partida do aparelho.
- Enquanto ele está aberto, o tempo da vez fica pausado e a mesa vê o aviso
  **"Jogador noob lendo as regras!"**.
- Botão "Não perguntar novamente neste computador" (preferência em `localStorage`, envolta em
  try/catch como as demais preferências).
- Precisa do servidor: hoje só o dono pausa e a desconexão pausa. Criar uma pausa "lendo regras"
  que congela prazos e bots, com limite de tempo (sugestão: 60 s) para ninguém travar a mesa, e
  1 vez por jogador por partida. Validar no gateway como as outras ações.
- Decidir na implementação: a pausa vale para a mesa inteira (mais simples e justo) ou só para o
  prazo de quem lê. Recomendado: a mesa inteira, com o aviso visível a todos.

### 3. Aviso da rodada cega uma vez só e setas mais discretas (pode fazer)

- Hoje aparecem dois textos com o mesmo aviso de rodada cega: manter um só.
- Setas "MAIS FORTE / MAIS FRACA": mais discretas, na parte de baixo da mão (sob as cartas), menores
  e com menos contraste. Esconder quando a mão tem 1 carta.

### 4. Explicar o "pé" e trocar o ícone (adaptar do jeito mais intuitivo)

- Trocar o ícone de sapato por uma **impressão de pé** (pegada), em pixel art como o ícone de "mão".
- Quando um número estiver bloqueado: frase curta "Você é o pé: não pode fechar a soma" junto ao
  número riscado.
- Nas placas, o selo do pé e da mão deve ser entendível sem legenda. Sugestão: no primeiro palpite
  da partida, mostrar o rótulo por extenso ("MÃO" / "PÉ") ao lado do ícone, que depois encolhe para
  só o ícone.
- Arquivos: `SimbolosMaoEPe.tsx`, `PainelPalpite.tsx`, `PlacaJogador.tsx`.

### 5. Feltro mostra o andamento dos palpites (aplicar)

- Hoje, no computador, o feltro fica vazio durante os palpites ("Palpites em andamento…") e o "Vez
  de Simas palpitar" fica num canto.
- No centro do feltro: de quem é a vez ("Simas está palpitando…") e a soma dos palpites já dados
  diante das cartas da rodada.
- Tem que caber no celular e no computador, de 2 a 10 jogadores, sem conflitar com o painel de
  palpite (que no celular ocupa o feltro na sua vez), com a vira, o contador da vaza e o monte de
  empates.

## Médio impacto

### 6. Entrada mais curta (aceito)

- Formulário da entrada só com apelido, "Criar sala" e "Entrar com código"; a configuração fica no
  lobby, onde já existe.
- Tirar a repetição "Criar sala" (aba e botão) e trazer o tutorial para cima da dobra no celular.

### 7. Campo de apelido (aceito)

- Placeholder com exemplo ("Ex.: Yago") e uma linha "Sem cadastro: é só o nome na mesa".

### 8. Lobby: resumo e motivo do botão desativado (aceito)

- Resumo da configuração sem quebrar "30 s" (espaço que não quebra).
- O motivo do bloqueio no próprio botão: "Adicione 1 jogador para iniciar".

### 9. Um único contador da vez, que pulsa e faz tic-tac (aceito, com ajustes)

- Mostrar o tempo uma vez só (hoje aparece no painel e no "SUA VEZ").
- A partir de **10 s**, o contador pulsa, e a intensidade aumenta progressivamente até o 0 (escala,
  brilho e ritmo crescentes).
- A partir de **5 s**, toca um **tic-tac** sintetizado no tema sonoro do app (fliperama, Web
  Audio, sem arquivo), só para quem está com a vez. Respeitar o mudo e o volume de efeitos;
  sem movimento quando `prefers-reduced-motion`.
- Sala sem limite de tempo: nada disso aparece.

### 10. Rótulo da manilha (aceito, melhorar o visual)

- Bug: no computador o rótulo "MANILHA" fica coberto pela carta da vira (aparece "MAI").
- Redesenhar o rótulo: hoje é só texto pequeno. Sugestão: selo próprio com o valor da manilha em
  destaque (pixel, com o brilho holográfico das manilhas), legível no celular e no computador.

### 11. Botão de emoji perto do palpite: não esconder, adaptar

- O 😀 fica sobre a borda do painel de palpite, perto dos números, e um gesto rápido de dois toques
  pode abrir as reações sem querer.
- Manter o botão visível o tempo todo, mas reposicionar e dar folga para que não fique colado nos
  números do palpite em nenhum tamanho de tela.

### 12. Informação de quem já palpitou (aceito)

- Resposta à dúvida "isso é o saldo que já aparece?": é a mesma informação. Saldo = cartas da rodada
  − soma dos palpites. A sugestão não é criar outro número, e sim deixar o saldo claro e visível
  sem "Mostrar mais".
- Exemplo: "Pediram 3 de 5 · sobram 2" (ou "passou 1" quando negativo).
- O "Mostrar mais" continua só para a lista nome a nome, com alvo de toque de pelo menos 44 px.

### 13. Painel de palpite em 360×640 e corações em grupos pares (aceito)

- O painel rola 5 px por dentro em algumas mãos em 360×640: dar folga de altura. Esse é o teste
  intermitente `mesa.spec.ts:39` do CI.
- Corações: até 5, uma linha. A partir de 6, quebrar em linhas iguais (6 = 2×3, 8 = 2×4,
  10 = 2×5). Com quantidade ímpar acima de 5, a linha de cima fica com o coração a mais
  (7 = 4+3, 9 = 5+4).

## Menor

### Explicar o gesto "1 toque seleciona, 2 confirmam" (pode explicar)

- Dica curta no primeiro uso de cada seletor (carta, palpite e reação), mostrada uma vez por
  aparelho.
- O resumo do item 2 também cita o gesto.
- O guia de regras e o tutorial devem citar o gesto.

## Plano de teste com jogadores (para depois)

- Quem: 5 pessoas, 3 que nunca jogaram e 2 que já jogam.
- Como: 20 min por vídeo, com a pessoa no próprio celular, pensando em voz alta.
- Tarefas:
  1. Entrar pelo link do WhatsApp.
  2. Criar uma sala com 2 bots e começar.
  3. Fazer o palpite da rodada cega.
  4. Jogar uma rodada de 3 cartas.
  5. Explicar por que um número está bloqueado.
  6. Instalar o app.
- O que medir: se concluiu sem ajuda, tempo até o primeiro palpite, toques errados e uma nota de
  1 a 5 para "entendi o que estava acontecendo".
