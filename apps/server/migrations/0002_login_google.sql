-- Login opcional com Google (Better Auth). Aditiva: não toca nas tabelas do histórico.
-- Nomes e tipos são os que o Better Auth espera (o teste do login compara com o esquema dele);
-- datas em texto ISO, booleanos em inteiro, como o adaptador Kysely do Better Auth grava no SQLite.
-- participantes_da_partida.conta_id (0001) aponta para "user".id, sem chave estrangeira: apagar uma
-- conta não pode apagar o histórico de quem jogou com ela.

-- Uma linha por conta Google: nome e e-mail exibidos na entrada. Nunca entram nos dados de treino.
CREATE TABLE "user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL,
  "image" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

-- Sessões abertas; o token é o que o web guarda e manda ao servidor (cabeçalho e socket).
CREATE TABLE "session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATE NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

-- Vínculo da conta com o provedor (só o Google). Os tokens do Google ficam cifrados.
CREATE TABLE "account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATE,
  "refreshTokenExpiresAt" DATE,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

-- Valores de vida curta: o estado do OAuth e o código de uso único que leva a sessão ao web.
CREATE TABLE "verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATE NOT NULL,
  "createdAt" DATE NOT NULL,
  "updatedAt" DATE NOT NULL
);

CREATE INDEX "session_userId_idx" ON "session" ("userId");
CREATE INDEX "account_userId_idx" ON "account" ("userId");
CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");
