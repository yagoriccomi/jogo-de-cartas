# Decisões — banco-login-historico — 2026-10-22

**Contexto:** colocar um banco de dados gratuito, que não pause por inatividade, com login e histórico de partidas para revisar.
**Modo:** rodada de perguntas de múltipla escolha.

| #   | Peso       | Pergunta                 | Decisão                                                                             | Consequência                                                                                                   |
| --- | ---------- | ------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Bloqueante | Qual banco               | Turso (SQLite na nuvem, plano grátis: 5 GB, 10 milhões de linhas gravadas por mês)  | Descartados: Supabase (pausa em 7 dias), Render Postgres (apagado em 30 dias), Atlas M0 (pausa em 60 dias)     |
| 2   | Bloqueante | Servidor que dorme       | Deixar a Render grátis como está                                                    | Só o banco não pausa; o servidor continua hibernando sem tráfego, e um reinício derruba a partida em andamento |
| 3   | Bloqueante | Login                    | Google opcional + convidado só com apelido                                          | Quem não loga continua jogando                                                                                 |
| 4   | Bloqueante | O que o histórico guarda | Replay carta a carta das salas criadas: as mãos de todos e o resultado de cada vaza | Finalidade principal: treinar bots com jeito de gente; secundária: o jogador revisar as próprias partidas      |

**Premissas (confirmar):**

- Toda sala real é gravada, com ou sem jogador logado (o treino precisa de volume). Tutorial e cenários de teste ficam de fora.
- Cada decisão (palpite ou carta) é gravada junto com o que o jogador via naquele momento e com quem decidiu: humano, bot (com o perfil) ou jogada automática por prazo estourado. Sem isso, os dados de treino se misturam com as jogadas dos próprios bots.
- Jogadores aparecem no histórico por id opaco; o apelido não entra nos dados de treino. Quem está logado fica ligado à conta para poder rever as próprias partidas.
- A gravação é feita por rodada (uma linha por rodada, com as jogadas dentro), não por carta: menos gravações no Turso, e uma queda do servidor perde no máximo a rodada em curso.
- Mão alheia só aparece no replay depois do fim da partida.

**Contradições com decisões antigas:** o `CLAUDE.md` põe login, banco e histórico fora do escopo do MVP ("fase 2") e diz "nada persistido". Isso passa a valer só para as salas, que continuam em memória.
**Ainda em aberto:** aviso de privacidade (LGPD) para o e-mail da conta e para a gravação das partidas de convidados; por quanto tempo guardar.
