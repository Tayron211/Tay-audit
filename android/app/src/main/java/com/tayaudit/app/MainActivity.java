package com.tayaudit.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Iniciar el servicio monitor de tickets en segundo plano 24/7
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
