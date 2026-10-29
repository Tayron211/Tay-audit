# 🛡️ Tay-Audit + STIVIE — Sistema Integral de Auditoría, Inventario y Soporte TI 24/7

Sistema empresarial de auditoría, inventario, agente nativo de escritorio (**STIVIE**) y soporte técnico remoto en tiempo real. Desplegado globalmente 24/7 sobre **Cloudflare Pages + Pages Functions + Cloudflare D1 (SQLite Cloud)**.

- **Dominio Público 24/7:** https://tay-audit.pages.dev
- **Asistente Web STIVIE:** https://tay-audit.pages.dev/stivie
- **Actualizar despliegue en la nube:** `npm run deploy`

---

## 🚀 Inicio Rápido

### 1. Iniciar el Sistema Completo
Simplemente haz doble clic en:
```cmd
start-tay-audit.bat
```
o ejecuta en tu terminal:
```bash
npm start
```
Esto iniciará simultáneamente:
- **Panel Web Frontend**: `http://localhost:5173` (o `http://<TU_IP_LOCAL>:5173` desde tu celular en la misma red Wi-Fi).
- **Servidor Backend API**: `http://localhost:3001`
- **Base de Datos SQLite Persistente 24/7**: `tay_audit.db` (en la raíz del proyecto, nunca se borra).

---

## 📡 1. Agente de Recolección Automática (Batch / PowerShell)
Para levantar las especificaciones de cualquier computadora o laptop de la empresa sin llenar nada manualmente:

1. Ejecuta el archivo:
   ```cmd
   scripts\tay-audit-agent.bat
   ```
2. O ejecuta este comando directo en PowerShell (como Administrador):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\tay-audit-agent.ps1"
   ```
El agente recolecta automáticamente:
- **Hostname** (Identificador clave)
- **Memoria RAM**
- **Sistema Operativo y Arquitectura**
- **Procesador (CPU)**
- **Discos y Almacenamiento**
- **Dirección IP y Dirección MAC**
- **Número de Serie de BIOS y Fabricante**
- **Usuario Asignado**

Los datos se envían inmediatamente mediante la API REST y aparecen en el panel en **tiempo real** con estado **ONLINE**.

---

## 📱 2. Auditoría Móvil & Escáner con Cámara
- Abre `http://<IP_DE_TU_PC>:5173` desde el navegador de tu celular (Chrome o Safari).
- Pulsa el botón **"Escanear QR / Barra"** o el botón flotante inferior.
- Permite el acceso a la cámara y apunta hacia el código QR o código de barras de cualquier equipo:
  - Si el equipo ya existe en el inventario: Se abrirá su panel de control y ficha técnica.
  - Si es un equipo nuevo: Abrirá el formulario de **Auditoría Manual** con el código ya completado.

---

## 🖥️ 3. Panel de Control & Acciones de Soporte Técnico Remoto
Al hacer clic sobre cualquier equipo de la lista:
- **Si el equipo es PC, Laptop o Servidor**: Se habilitan los botones de control administrativo forzado:
  - 🖥️ **Duplicar Pantalla**: Genera y descarga un archivo `.rdp` optimizado con sesión administrativa para conectarte de inmediato a la pantalla del equipo.
  - 🔄 **Reiniciar Equipo**: Ejecuta instrucción forzada de reinicio (`Restart-Computer -Force`).
  - 🛑 **Apagar Equipo**: Ejecuta instrucción forzada de apagado (`Stop-Computer -Force`).
- **Si el equipo es Impresora o Switch de Red**: La interfaz oculta estas acciones y muestra una nota informativa indicando que es un periférico, tal como se especificó.
- 🏷️ **Etiqueta QR Imprimible**: Genera e imprime una etiqueta física con código QR, Hostname, Serial e IP para pegar en el chasis del equipo.

---

## 📊 4. Exportación a Excel Multicategoría
Haz clic en el botón verde **"Exportar Excel"** en la barra superior. El sistema descargará un archivo `.xlsx` organizado con hojas independientes:
1. **Hoja 1: Resumen General**: Métricas de inventario y estado operativo.
2. **Hoja 2: Computadoras & Laptops**: Equipos de usuarios finales.
3. **Hoja 3: Servidores**: Servidores de producción y datacenter.
4. **Hoja 4: Impresoras**: Impresoras de red y multifuncionales.
5. **Hoja 5: Equipos de Red**: Switches, routers y telecomunicaciones.
6. **Hoja 6: Monitores y Otros**: Periféricos y accesorios.

---

## 🌐 5. Acceso Seguro Externo 24/7 (Sin Servicios de Pago ni Abrir Puertos)
Consulta la guía completa en [EXTERNAL_ACCESS.md](file:///c:/Users/Arianny/Downloads/PROYECTOS/DEV/docs/EXTERNAL_ACCESS.md):
- **Cloudflare Tunnel (`cloudflared`)**: Ejecuta `scripts\start-external-tunnel.bat` para obtener un enlace HTTPS mundial cifrado y seguro.
- **Tailscale**: Crea una red VPN privada P2P para acceder desde cualquier celular en redes 4G/5G.
