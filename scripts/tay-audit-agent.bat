@echo off
title Tay-Audit - Agente de Levantamiento y Auditoria TI
color 0b
cls
echo ====================================================================
echo             TAY-AUDIT: AGENTE INTELIGENTE DE AUDITORIA TI
echo ====================================================================
echo Este agente realiza el levantamiento automatico de inventario:
echo   - Clasificacion: Laptop / PC Escritorio OEM / PC Ensamblada
echo   - Direccion IP activa y Direccion MAC fisica real
echo   - Hostname, RAM, Sistema Operativo, Procesador, Placa Base, Discos
echo   - Compatibilidad con Windows 11 y Serial BIOS
echo ====================================================================
echo.

:: Configura la IP o dominio de tu servidor Tay-Audit si esta en otra maquina de la red
set SERVER_URL=http://localhost:3001
if not "%~1"=="" set SERVER_URL=%~1

echo Conectando con servidor: %SERVER_URL%
echo Analizando caracteristicas del equipo...
echo.

if exist "%~dp0tay-audit-agent.ps1" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tay-audit-agent.ps1" -ServerUrl "%SERVER_URL%"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { $code = Invoke-RestMethod -Uri '%SERVER_URL%/audit' -UseBasicParsing; Invoke-Expression $code } catch { Write-Host '[ERROR] No se pudo descargar el recolector de %SERVER_URL%/audit: ' $_.Exception.Message -ForegroundColor Red; exit 1 }"
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Se detecto un problema durante el levantamiento.
    echo Verifique que el servidor Tay-Audit este encendido en %SERVER_URL%
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Levantamiento completado con exito. Cerrando ventana en 3 segundos...
timeout /t 3 /nobreak >nul 2>&1
exit
