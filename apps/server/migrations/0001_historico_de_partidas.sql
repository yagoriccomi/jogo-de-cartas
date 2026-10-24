-- Histórico das partidas: uma linha por partida, uma por participante e uma por rodada (P5).
-- Jogadores só por id opaco (o id do assento na sala); o apelido nunca é gravado.
-- Instantes em milissegundos desde 1970 (UTC), como o relógio do servidor.

CREATE TABLE partidas (
  id TEXT PRIMARY KEY,
  iniciada_em INTEGER NOT NULL,
  encerrada_em INTEGER,
  -- fim | interrompida (reiniciada pelo dono) | abandonada (a sala sumiu); nulo = em andamento
  -- ou perdida numa queda do servidor.
  desfecho TEXT CHECK (desfecho IN ('fim', 'interrompida', 'abandonada')),
  -- ConfiguracaoPartida em JSON.
  configuracao TEXT NOT NULL,
  rodadas_gravadas INTEGER NOT NULL DEFAULT 0,
  versao_do_diario INTEGER NOT NULL
);

-- Listagens do histórico, da mais recente para a mais antiga.
CREATE INDEX partidas_por_data ON partidas (iniciada_em DESC);

CREATE TABLE participantes_da_partida (
  partida_id TEXT NOT NULL REFERENCES partidas (id) ON DELETE CASCADE,
  jogador_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('humano', 'bot')),
  -- Perfil sorteado para o bot nesta partida; nulo nos humanos.
  perfil TEXT,
  -- 1 = vencedor; nulo enquanto a partida não termina pelas regras.
  colocacao INTEGER,
  vidas_finais INTEGER,
  -- Conta logada dona deste assento (login, fase seguinte). Nulo para convidados e bots.
  conta_id TEXT,
  PRIMARY KEY (partida_id, jogador_id)
);

CREATE INDEX participantes_por_jogador ON participantes_da_partida (jogador_id);
-- "Minhas partidas": só assentos ligados a uma conta entram no índice.
CREATE INDEX participantes_por_conta ON participantes_da_partida (conta_id, partida_id)
  WHERE conta_id IS NOT NULL;

CREATE TABLE rodadas (
  partida_id TEXT NOT NULL REFERENCES partidas (id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  gravada_em INTEGER NOT NULL,
  -- RodadaDoDiario em JSON (mãos, palpites e cartas com a visão e o autor de cada decisão).
  dados TEXT NOT NULL,
  PRIMARY KEY (partida_id, numero)
);
