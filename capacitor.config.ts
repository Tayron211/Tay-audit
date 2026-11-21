import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tayaudit.app',
  appName: 'TayAudit',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'tay-audit.pages.dev',
      '*.pages.dev',
      '*.cloudflare.com',
      '*.workers.dev'
    ]
  },
  plugins: {
    SystemBars: {
      insetsHandling: "disable",
      initialViewportFitValueHint: "cover"
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#000000"
    },
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#FFB800",
      sound: "notification.wav"
    }
  }
};

export default config;
