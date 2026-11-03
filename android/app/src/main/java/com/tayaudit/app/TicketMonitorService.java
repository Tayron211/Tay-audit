package com.tayaudit.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

public class TicketMonitorService extends Service {
    private static final String TAG = "TicketMonitorService";
    public static final String CHANNEL_ID = "tay_audit_tickets_channel";
    public static final String SILENT_CHANNEL_ID = "tay_audit_service_channel";
    private static final int FOREGROUND_NOTIFICATION_ID = 9901;
    private static final String PREFS_NAME = "tay_ticket_monitor_prefs";
    private static final String PREF_NOTIFIED_IDS = "notified_ticket_ids";
    private static final String CLOUD_URL = "https://tay-audit.pages.dev";

    private Thread workerThread;
    private volatile boolean isRunning = false;
    private String lastSyncVersion = null;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        createSilentNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        createSilentNotificationChannel();

        // En Android 8.0+ activar modo primer plano para ejecución 24/7 ininterrumpida
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Intent appIntent = new Intent(this, MainActivity.class);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                    this, 0, appIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                );

                NotificationCompat.Builder fgBuilder = new NotificationCompat.Builder(this, SILENT_CHANNEL_ID)
                    .setContentTitle("TayAudit Activo")
                    .setContentText("Sincronización y alertas 24/7 activas")
                    .setSmallIcon(R.drawable.ic_stat_notification)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setOngoing(true)
                    .setContentIntent(pendingIntent);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(FOREGROUND_NOTIFICATION_ID, fgBuilder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
                } else {
                    startForeground(FOREGROUND_NOTIFICATION_ID, fgBuilder.build());
                }
            } catch (Exception e) {
                Log.w(TAG, "No se pudo iniciar en primer plano: " + e.getMessage());
            }
        }

        if (!isRunning) {
            isRunning = true;
            startMonitoring();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (workerThread != null) {
            workerThread.interrupt();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createSilentNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                SILENT_CHANNEL_ID,
                "Monitor 24/7 TayAudit",
                NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Mantiene la conexión y alertas de nuevos tickets en segundo plano");
            serviceChannel.setShowBadge(false);
            serviceChannel.enableVibration(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Tickets de Soporte TI UPN",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificaciones en tiempo real de nuevos tickets de soporte e incidencias");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300, 200, 450});
            channel.enableLights(true);
            channel.setLightColor(0xFFFFB800);

            try {
                Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.notification);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
                channel.setSound(soundUri, audioAttributes);
            } catch (Exception e) {
                // Fallback a sonido por defecto
            }

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startMonitoring() {
        workerThread = new Thread(() -> {
            Log.d(TAG, "Iniciando monitor nativo de tickets en segundo plano 24/7");
            boolean isFirstRun = true;

            while (isRunning) {
                try {
                    checkTickets(isFirstRun);
                    isFirstRun = false;
                } catch (Exception e) {
                    Log.w(TAG, "Error al comprobar tickets: " + e.getMessage());
                }

                try {
                    // Consultar cada 3 segundos
                    Thread.sleep(3000);
                } catch (InterruptedException ie) {
                    break;
                }
            }
        });
        workerThread.setDaemon(true);
        workerThread.start();
    }

    private void checkTickets(boolean isFirstRun) {
        try {
            // 1. Consultar sync-state ultra-rápido sin caché
            URL syncUrl = new URL(CLOUD_URL + "/api/sync-state?t=" + System.currentTimeMillis());
            HttpURLConnection conn = (HttpURLConnection) syncUrl.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);
            conn.setUseCaches(false);
            conn.setDefaultUseCaches(false);
            conn.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
            conn.setRequestProperty("Pragma", "no-cache");

            if (conn.getResponseCode() != 200) {
                conn.disconnect();
                return;
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();
            conn.disconnect();

            JSONObject syncJson = new JSONObject(sb.toString());
            String currentVersion = syncJson.optString("version", "");

            if (!isFirstRun && currentVersion.equals(lastSyncVersion)) {
                return;
            }
            lastSyncVersion = currentVersion;

            // 2. Si es la primera ejecución o la versión cambió, consultar los tickets
            URL ticketsUrl = new URL(CLOUD_URL + "/api/tickets?t=" + System.currentTimeMillis());
            HttpURLConnection tConn = (HttpURLConnection) ticketsUrl.openConnection();
            tConn.setRequestMethod("GET");
            tConn.setConnectTimeout(5000);
            tConn.setReadTimeout(5000);
            tConn.setUseCaches(false);
            tConn.setDefaultUseCaches(false);
            tConn.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
            tConn.setRequestProperty("Pragma", "no-cache");

            if (tConn.getResponseCode() != 200) {
                tConn.disconnect();
                return;
            }

            BufferedReader tReader = new BufferedReader(new InputStreamReader(tConn.getInputStream()));
            StringBuilder tSb = new StringBuilder();
            while ((line = tReader.readLine()) != null) {
                tSb.append(line);
            }
            tReader.close();
            tConn.disconnect();

            JSONArray ticketsArray = new JSONArray(tSb.toString());
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            Set<String> notified = new HashSet<>(prefs.getStringSet(PREF_NOTIFIED_IDS, new HashSet<>()));

            if (isFirstRun) {
                // Registrar todos los tickets existentes para no notificar tickets viejos ya resueltos o previos
                for (int i = 0; i < ticketsArray.length(); i++) {
                    JSONObject t = ticketsArray.getJSONObject(i);
                    notified.add(t.optString("id", ""));
                }
                prefs.edit().putStringSet(PREF_NOTIFIED_IDS, notified).apply();
                return;
            }

            // Buscar tickets nuevos no notificados que no estén resueltos
            boolean updated = false;
            for (int i = 0; i < ticketsArray.length(); i++) {
                JSONObject t = ticketsArray.getJSONObject(i);
                String id = t.optString("id", "");
                String status = t.optString("status", "abierto");

                if (!notified.contains(id) && !"resuelto".equalsIgnoreCase(status)) {
                    notified.add(id);
                    updated = true;

                    // Emitir notificación nativa
                    postNotification(t);
                }
            }

            if (updated) {
                prefs.edit().putStringSet(PREF_NOTIFIED_IDS, notified).apply();
            }

        } catch (Exception e) {
            Log.w(TAG, "checkTickets exception: " + e.getMessage());
        }
    }

    private void postNotification(JSONObject ticket) {
        try {
            String id = ticket.optString("id", "TCK-0000");
            String hostname = ticket.optString("hostname", "PC-UPN");
            String userName = ticket.optString("userName", "Docente / Usuario");
            String category = ticket.optString("category", "General");
            String description = ticket.optString("description", "Nueva incidencia reportada");
            String urgency = ticket.optString("urgency", "media");

            String urgencyTag = "critica".equalsIgnoreCase(urgency) ? "🔴 CRÍTICA" :
                                "alta".equalsIgnoreCase(urgency) ? "🟠 ALTA" : "🟡 TI";

            String title = "🎫 [" + urgencyTag + "] " + category + " • " + hostname;
            String body = userName + ": " + description;

            int notifId = 100;
            try {
                String digits = id.replaceAll("\\D+", "");
                if (!digits.isEmpty()) {
                    notifId = Integer.parseInt(digits);
                }
            } catch (Exception ignored) {}

            Intent intent = new Intent(this, MainActivity.class);
            intent.putExtra("ticketId", id);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                notifId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.notification);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(new long[]{0, 300, 200, 300, 200, 450})
                .setContentIntent(pendingIntent);

            NotificationManagerCompat manager = NotificationManagerCompat.from(this);
            manager.notify(notifId, builder.build());

        } catch (Exception e) {
            Log.e(TAG, "Error posting notification: " + e.getMessage());
        }
    }
}

