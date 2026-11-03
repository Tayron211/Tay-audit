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
  }
};

export default config;
