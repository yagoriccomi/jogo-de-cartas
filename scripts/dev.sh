#!/usr/bin/env bash
# ============================================================
#  dev.sh - controle do ambiente local (Linux/Mac)
#  Uso:  ./scripts/dev.sh [start|stop|restart|status|logs]
#  Encapsula o docker compose para nao decorar comandos.
#  Le a config do .env (fonte unica de verdade).
#  Lembre de tornar executavel:  chmod +x scripts/dev.sh
# ============================================================
set -euo pipefail

# roda sempre a partir da raiz do projeto
cd "$(dirname "$0")/.."

ACAO="${1:-start}"

garantir_env() {
  if [ ! -f .env ]; then
    echo "[dev] .env nao encontrado - criando a partir de .env.example"
    cp .env.example .env
  fi
}

mostrar_enderecos() {
  local porta_server porta_web
  porta_server="$(grep -E '^PORT=' .env | tail -n1 | cut -d= -f2 || true)"
  porta_web="$(grep -E '^WEB_PORT=' .env | tail -n1 | cut -d= -f2 || true)"
  echo "[dev] Web:    http://localhost:${porta_web:-5173}"
  echo "[dev] Server: http://localhost:${porta_server:-3001}/health"
  echo "[dev] Na primeira vez a instalacao das dependencias leva alguns minutos (acompanhe: ./scripts/dev.sh logs)"
}

case "$ACAO" in
  start)
    garantir_env
    docker compose up -d
    mostrar_enderecos
    ;;
  stop)
    docker compose down
    ;;
  restart)
    garantir_env
    docker compose down
    docker compose up -d
    mostrar_enderecos
    ;;
  status)
    docker compose ps
    ;;
  logs)
    docker compose logs -f
    ;;
  *)
    echo "Uso: ./scripts/dev.sh [start|stop|restart|status|logs]"
    exit 1
    ;;
esac
