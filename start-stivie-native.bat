@echo off
title STIVIE - Asistente de Operaciones Virtual
cd /d "%~dp0"
echo ====================================================================
echo   STIVIE - ASISTENTE DESKTOP NATIVO CON ACELERACION GPU
echo ====================================================================
echo * Mascota interactiva en el lateral de la pantalla
echo * Motor nativo STIVIE.exe con animaciones fluidas
echo * IA integrada con Llama 3.2 y Soporte TI en 1-clic
echo.

if exist "server\STIVIE.exe" (
    start "" "server\STIVIE.exe" "http://localhost:3001"
) else (
    echo [ERROR] No se encontro server\STIVIE.exe
    pause
)

