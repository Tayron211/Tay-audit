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
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000"
    },
    LocalNotifications: {
      smallIcon: "ic_launcher",
      iconColor: "#FFB800",
      sound: "notification.wav"
    }
  }
};

export default config;
