package com.tayaudit.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppInstallerPlugin.class);

        // Status bar transparente e inmersiva de inmediato desde el primer frame (sin barra gris superior)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                getWindow().getAttributes().layoutInDisplayCutoutMode = 
                    android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getWindow().setStatusBarContrastEnforced(false);
                getWindow().setNavigationBarContrastEnforced(false);
            }
            getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().setNavigationBarColor(android.graphics.Color.BLACK);
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        } catch (Exception ignored) {}

        super.onCreate(savedInstanceState);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                getWindow().setStatusBarContrastEnforced(false);
                getWindow().setNavigationBarContrastEnforced(false);
            }
            getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
            getWindow().setNavigationBarColor(android.graphics.Color.BLACK);
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        } catch (Exception ignored) {}

        // Eliminar ActionBar nativa bajo cualquier circunstancia
        try {
            if (getSupportActionBar() != null) {
                getSupportActionBar().hide();
            }
            if (getActionBar() != null) {
                getActionBar().hide();
            }
        } catch (Exception ignored) {}

        // Aceleración de Hardware GPU a 120 FPS, eliminación de scrollbars nativos y viewport fluido
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                webView.setVerticalScrollBarEnabled(false);
                webView.setHorizontalScrollBarEnabled(false);
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                WebSettings settings = webView.getSettings();
                settings.setUseWideViewPort(true);
                settings.setLoadWithOverviewMode(true);
                settings.setTextZoom(100);
            }
        } catch (Exception ignored) {}

        // Solicitar permisos de notificación en Android 13+ (API 33+) para que las notificaciones no sean bloqueadas
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // Iniciar el servicio monitor de tickets en segundo plano (sin notificación persistente de inicio)
        try {
            Intent serviceIntent = new Intent(this, TicketMonitorService.class);
            startService(serviceIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleTicketIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        handleTicketIntent(getIntent());
    }

    private void handleTicketIntent(Intent intent) {
        if (intent != null && intent.hasExtra("ticketId")) {
            String ticketId = intent.getStringExtra("ticketId");
            if (ticketId != null && !ticketId.isEmpty()) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().postDelayed(() -> {
                        String js = "window.dispatchEvent(new CustomEvent('app-open-ticket', { detail: { ticketId: '" + ticketId + "' } }));";
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }, 600);
                }
            }
        }
    }
}
