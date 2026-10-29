import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('==========================================================');
console.log('  TAY-AUDIT + STIVIE: ACTUALIZANDO PLATAFORMA CLOUD 24/7');
console.log('==========================================================');

// 1. Recompilar STIVIE.cs -> server/STIVIE.exe + public/STIVIE.exe + functions/_stivieCsSource.js
const csPath = path.join(rootDir, 'server', 'STIVIE.cs');
if (fs.existsSync(csPath)) {
  const csc64 = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
  const csc32 = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
  const csc = fs.existsSync(csc64) ? csc64 : (fs.existsSync(csc32) ? csc32 : null);

  if (csc) {
    console.log('\n[1/4] Compilando agente nativo STIVIE.exe...');
    const wpfLib = path.join(path.dirname(csc), 'WPF');
    const outServerExe = path.join(rootDir, 'server', 'STIVIE.exe');
    const outPublicExe = path.join(rootDir, 'public', 'STIVIE.exe');
    const iconArg = fs.existsSync(path.join(rootDir, 'public', 'stivie-icon.ico'))
      ? `/win32icon:"${path.join(rootDir, 'public', 'stivie-icon.ico')}"`
      : '';

    execSync(
      `"${csc}" /nologo /target:winexe ${iconArg} /lib:"${wpfLib}" /r:PresentationFramework.dll /r:PresentationCore.dll /r:WindowsBase.dll /r:System.Xaml.dll /r:System.dll /out:"${outServerExe}" "${csPath}"`,
      { stdio: 'inherit', cwd: rootDir }
    );
    fs.copyFileSync(outServerExe, outPublicExe);
  }

  const csB64 = fs.readFileSync(csPath).toString('base64');
  fs.writeFileSync(
    path.join(rootDir, 'functions', '_stivieCsSource.js'),
    `// Auto-generated Base64 of server/STIVIE.cs for Cloud fallback compilation\nexport const STIVIE_CS_BASE64 = '${csB64}';\n`,
    'utf8'
  );
  console.log('      STIVIE.exe y respaldo Cloud sincronizados.');
}

// 2. Compilar Frontend (TypeScript + Vite)
console.log('\n[2/4] Compilando interfaz web (dist/)...');
execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

// 3. Publicar Frontend + Funciones Edge en Cloudflare Pages (sin tocar los datos de D1)
console.log('\n[3/4] Subiendo actualizacion a https://tay-audit.pages.dev ...');
execSync('npx wrangler pages deploy dist --project-name=tay-audit --branch=main --commit-dirty=true', {
  stdio: 'inherit',
  cwd: rootDir
});

console.log('\n[4/4] ¡Actualizacion publicada con exito en https://tay-audit.pages.dev !');
console.log('      (La base de datos Cloud tay-audit-db permanece intacta con todos tus registros).');

