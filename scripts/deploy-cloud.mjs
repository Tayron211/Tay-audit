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
console.log('\n[2/5] Compilando interfaz web (dist/)...');
execSync('npm run build', { stdio: 'inherit', cwd: rootDir, shell: 'cmd.exe' });

// 3. Sincronizar y compilar App Nativa Android (TayAudit.apk)
console.log('\n[3/5] Sincronizando y compilando APK nativo de Android...');
execSync('npx cap sync android', { stdio: 'inherit', cwd: rootDir, shell: 'cmd.exe' });

// Eliminar APK anidado si Capacitor lo copió a assets para evitar sobrepeso
const nestedApk = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'TayAudit.apk');
if (fs.existsSync(nestedApk)) {
  fs.unlinkSync(nestedApk);
}

// Compilar APK con Gradle usando JDK configurado
const javaHome = process.env.JAVA_HOME || 'C:\\Program Files\\Microsoft\\jdk-21.0.13.21-hotspot';
const gradleEnv = { ...process.env, JAVA_HOME: javaHome };
execSync('gradlew.bat assembleDebug', {
  stdio: 'inherit',
  cwd: path.join(rootDir, 'android'),
  env: gradleEnv,
  shell: 'cmd.exe'
});

const builtApk = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (fs.existsSync(builtApk)) {
  fs.copyFileSync(builtApk, path.join(rootDir, 'public', 'TayAudit.apk'));
  fs.copyFileSync(builtApk, path.join(rootDir, 'dist', 'TayAudit.apk'));
  fs.copyFileSync(builtApk, path.join(rootDir, 'TayAudit.apk'));
  console.log('      TayAudit.apk nativo compilado y sincronizado con éxito.');
}

// 4. Publicar Frontend + Funciones Edge + APK en Cloudflare Pages
console.log('\n[4/5] Subiendo actualizacion a https://tay-audit.pages.dev ...');
execSync('npx wrangler pages deploy dist --project-name=tay-audit --branch=main --commit-dirty=true', {
  stdio: 'inherit',
  cwd: rootDir,
  shell: 'cmd.exe'
});

console.log('\n[5/5] ¡Actualizacion publicada con exito en https://tay-audit.pages.dev !');
console.log('      (La base de datos Cloud tay-audit-db permanece intacta con todos tus registros).');

