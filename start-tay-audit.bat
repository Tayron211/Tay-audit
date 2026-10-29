@echo off
title Tay-Audit - Sistema Integral de Auditoria e Inventario TI
cls
echo ====================================================================
echo                   INICIANDO SERVICIOS DE TAY-AUDIT
echo ====================================================================
echo.
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"
node start.js
pause
