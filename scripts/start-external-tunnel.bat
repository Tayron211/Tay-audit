@echo off
title Tay-Audit - Acceso Seguro Externo 24/7 (Cloudflare Tunnel)
cls
echo ====================================================================
echo              TAY-AUDIT: TUNEL DE ACCESO REMOTO 24/7
echo ====================================================================
echo Iniciando tunel HTTPS seguro hacia Tay-Audit en el puerto 3001/5173...
echo Esto permite acceder desde el celular en cualquier red o 4G/5G.
echo ====================================================================
echo.

cloudflared.exe tunnel --url http://localhost:3001

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [*] Nota: Si no tienes instalado 'cloudflared.exe', descargalo gratuitamente
    echo desde https://github.com/cloudflare/cloudflared/releases y pegalo aqui.
    echo O usa Tailscale para conexion directa privada punto a punto.
    echo.
    pause
)
