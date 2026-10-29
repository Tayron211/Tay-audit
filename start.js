import { spawn } from 'node:child_process';
import os from 'node:os';

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();

console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log('\x1b[32m%s\x1b[0m', '        TAY-AUDIT: SISTEMA DE GESTIÓN Y AUDITORÍA TI      ');
console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log(`📡 Panel PC Local      : \x1b[33mhttp://localhost:5173\x1b[0m`);
console.log(`📱 Acceso Celular / Wi-Fi: \x1b[32mhttp://${localIp}:5173\x1b[0m`);
console.log(`⚙️ Servidor Backend API : \x1b[34mhttp://localhost:3001\x1b[0m`);
console.log(`💾 Base de Datos SQLite  : \x1b[35mtay_audit.db (Local & Permanente 24/7)\x1b[0m`);
console.log('\x1b[36m%s\x1b[0m', '==========================================================\n');

let isShuttingDown = false;
let backendProcess = null;
let frontendProcess = null;

function runBackend() {
  if (isShuttingDown) return;
  console.log('\x1b[34m[Supervisor]\x1b[0m Iniciando Backend API (Node)...');
  backendProcess = spawn('node', ['server/index.js'], {
    stdio: 'inherit',
    shell: true
  });

  backendProcess.on('exit', (code, signal) => {
    backendProcess = null;
    if (!isShuttingDown) {
      console.warn(`\x1b[33m[Supervisor ⚠️]\x1b[0m El Backend se detuvo (código: ${code}, señal: ${signal}). Reiniciando automáticamente en 1.5s...`);
      setTimeout(runBackend, 1500);
    }
  });

  backendProcess.on('error', (err) => {
    console.error('\x1b[31m[Supervisor ❌]\x1b[0m Error en proceso backend:', err.message);
  });
}

function runFrontend() {
  if (isShuttingDown) return;
  console.log('\x1b[32m[Supervisor]\x1b[0m Iniciando Frontend (Vite)...');
  frontendProcess = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], {
    stdio: 'inherit',
    shell: true
  });

  frontendProcess.on('exit', (code, signal) => {
    frontendProcess = null;
    if (!isShuttingDown) {
      console.warn(`\x1b[33m[Supervisor ⚠️]\x1b[0m El Frontend se detuvo (código: ${code}, señal: ${signal}). Reiniciando automáticamente en 1.5s...`);
      setTimeout(runFrontend, 1500);
    }
  });

  frontendProcess.on('error', (err) => {
    console.error('\x1b[31m[Supervisor ❌]\x1b[0m Error en proceso frontend:', err.message);
  });
}

// Iniciar ambos servicios con supervisión continua 24/7
runBackend();
runFrontend();

const cleanup = () => {
  isShuttingDown = true;
  console.log('\n\x1b[33m[Supervisor]\x1b[0m Apagando servicios ordenadamente...');
  if (backendProcess) backendProcess.kill();
  if (frontendProcess) frontendProcess.kill();
  setTimeout(() => process.exit(0), 500);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
