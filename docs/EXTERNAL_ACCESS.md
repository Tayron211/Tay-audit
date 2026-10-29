# Guía de Acceso Externo Seguro 24/7 para Tay-Audit (Sin Costos y Sin Abrir Puertos)

Tay-Audit almacena su base de datos localmente en un archivo SQLite ultra-estable (`tay_audit.db`) en tu propio equipo. Los datos nunca se borran ni dependen de servidores de terceros en la nube.

Para acceder a tu panel de control y conectar el celular o equipos remotos desde el exterior (fuera de la oficina o casa) 24/7 sin pagar nada y con máxima seguridad, dispones de dos soluciones recomendadas:

---

## Opción 1: Cloudflare Tunnel (`cloudflared`) - **Recomendada para Móviles y Auditorías**
Te proporciona una URL HTTPS segura (ej: `https://tay-audit.tudominio.com` o una URL pública temporal gratuita `https://xxxx.trycloudflare.com`) sin abrir puertos en el router.

### Pasos rápidos:
1. Descarga el ejecutable oficial gratuito de Cloudflare:
   - Descarga `cloudflared-windows-amd64.exe` desde [Cloudflare Downloads](https://github.com/cloudflare/cloudflared/releases).
2. Colócalo en la carpeta del proyecto o en tu `PATH`.
3. Ejecuta el archivo incluido:
   ```cmd
   scripts\start-external-tunnel.bat
   ```
4. Te entregará una URL HTTPS segura accesible desde cualquier celular en el mundo con conexión a internet para escanear QR y revisar el inventario en tiempo real.

---

## Opción 2: Tailscale (Red Privada Virtual Mesh P2P) - **Recomendada para Máxima Privacidad Corporativa**
Permite conectar tu teléfono móvil, laptops de empleados y el servidor central a una misma red privada cifrada de punto a punto (WireGuard):
1. Instala Tailscale gratuito en tu servidor local (PC donde corre Tay-Audit).
2. Instala la app Tailscale en tu celular (iOS / Android).
3. Entra desde tu celular directamente usando la IP fija de Tailscale (ej: `http://100.x.y.z:3001` o `http://100.x.y.z:5173`).
4. Nadie en internet puede ver ni entrar al sistema salvo tus dispositivos autenticados.

---

## Persistencia y Respaldos 24/7
- La base de datos reside en `tay_audit.db`.
- Para respaldarla, simplemente copia el archivo `tay_audit.db` a una memoria USB o disco de respaldo en cualquier momento.
- Tay-Audit realiza transacciones atómicas seguras mediante el motor SQLite de Node.js.
