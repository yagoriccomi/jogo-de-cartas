@echo off
rem ============================================================
rem  dev.bat - controle do ambiente local (Windows)
rem  Uso:  scripts\dev.bat [start^|stop^|restart^|status^|logs]
rem  Encapsula o docker compose para nao decorar comandos.
rem  Le a config do .env (fonte unica de verdade).
rem ============================================================
setlocal
cd /d "%~dp0\.."

set "ACAO=%~1"
if "%ACAO%"=="" set "ACAO=start"

if /i "%ACAO%"=="start"   goto iniciar
if /i "%ACAO%"=="stop"    goto parar
if /i "%ACAO%"=="restart" goto reiniciar
if /i "%ACAO%"=="status"  goto estado
if /i "%ACAO%"=="logs"    goto logs

echo Uso: scripts\dev.bat [start^|stop^|restart^|status^|logs]
exit /b 1

:garantir_env
if not exist ".env" (
  echo [dev] .env nao encontrado - criando a partir de .env.example
  copy /y ".env.example" ".env" >nul
)
exit /b 0

:mostrar_enderecos
echo [dev] Web:    http://localhost:5173  (ou WEB_PORT do .env)
echo [dev] Server: http://localhost:3001/health  (ou PORT do .env)
echo [dev] Na primeira vez a instalacao das dependencias leva alguns minutos (acompanhe: scripts\dev.bat logs)
exit /b 0

:iniciar
call :garantir_env
docker compose up -d
if errorlevel 1 goto erro
call :mostrar_enderecos
goto fim

:parar
docker compose down
if errorlevel 1 goto erro
goto fim

:reiniciar
call :garantir_env
docker compose down
docker compose up -d
if errorlevel 1 goto erro
call :mostrar_enderecos
goto fim

:estado
docker compose ps
goto fim

:logs
docker compose logs -f
goto fim

:erro
echo [dev] Falha ao executar o docker compose. O Docker Desktop esta em execucao?
endlocal
exit /b 1

:fim
endlocal
