import { registerPlugin } from '@capacitor/core';
import { isNativeCapacitor } from '../services/api';

export const APP_CURRENT_VERSION = '1.0.31';
export const APP_CURRENT_BUILD = 32;

export interface AppInstallerPluginInterface {
  getAppVersion(): Promise<{ version: string; build: number }>;
  canRequestPackageInstalls(): Promise<{ value: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  launchInstaller(): Promise<{ success: boolean }>;
  installApk(options: { url: string }): Promise<{ started: boolean }>;
  addListener(eventName: 'downloadProgress', listenerFunc: (data: { percent: number; bytesDownloaded?: number; totalBytes?: number; completed?: boolean }) => void): Promise<any>;
  addListener(eventName: 'downloadError', listenerFunc: (data: { error: string }) => void): Promise<any>;
}

export const AppInstaller = registerPlugin<AppInstallerPluginInterface>('AppInstaller');

function parseVersionNumbers(v: string | number): number[] {
  return String(v || '0')
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map(n => parseInt(n, 10) || 0);
}

function isRemoteVersionNewer(localVer: string, localBuild: number, remoteVer: string, remoteBuild: number): boolean {
  const rBuild = parseInt(String(remoteBuild), 10) || 0;
  const lBuild = parseInt(String(localBuild), 10) || 0;

  if (rBuild > lBuild) return true;
  if (rBuild < lBuild && lBuild > 0) return false;

  const [lMaj = 0, lMin = 0, lPat = 0] = parseVersionNumbers(localVer);
  const [rMaj = 0, rMin = 0, rPat = 0] = parseVersionNumbers(remoteVer);

  if (rMaj > lMaj) return true;
  if (rMaj === lMaj && rMin > lMin) return true;
  if (rMaj === lMaj && rMin === lMin && rPat > lPat) return true;

  return false;
}

export interface AppUpdateFeature {
  title?: string;
  desc: string;
}

export interface AppUpdateInfo {
  isAvailable: boolean;
  isNative: boolean;
  currentVersion: string;
  currentBuild: number;
  latestVersion: string;
  latestBuild: number;
  releaseDate?: string;
  notes?: string;
  features?: AppUpdateFeature[];
  apkUrl: string;
  forceUpdate?: boolean;
}

export async function checkAppVersion(isManual = false): Promise<AppUpdateInfo | null> {
  try {
    // Los popups y chequeos automáticos de OTA operan exclusivamente en el APK nativo Android
    if (!isNativeCapacitor() && !isManual) {
      return null;
    }

    let localVersion = APP_CURRENT_VERSION;
    let localBuild = APP_CURRENT_BUILD;

    if (isNativeCapacitor()) {
      try {
        if (AppInstaller?.getAppVersion) {
          const info = await AppInstaller.getAppVersion();
          if (info) {
            localVersion = info.version || localVersion;
            localBuild = info.build || localBuild;
          }
        }
      } catch (e) {
        console.warn('[UpdateChecker] Could not read native package version:', e);
      }
    }

    // Consultar metadata de versión en Cloudflare Pages 24/7 sin caché
    const endpoint = `https://tay-audit.pages.dev/version.json?_t=${Date.now()}`;
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.version) return null;

    const isNewer = isRemoteVersionNewer(localVersion, localBuild, data.version, data.versionCode);

    const updateInfo: AppUpdateInfo = {
      isAvailable: isNewer,
      isNative: isNativeCapacitor(),
      currentVersion: localVersion,
      currentBuild: localBuild,
      latestVersion: data.version,
      latestBuild: data.versionCode || 1,
      releaseDate: data.releaseDate || '',
      notes: data.notes || 'Mejoras de rendimiento a 120 FPS y estabilidad.',
      features: Array.isArray(data.features) ? data.features : [],
      apkUrl: data.apkUrl || 'https://tay-audit.pages.dev/TayAudit.apk',
      forceUpdate: Boolean(data.forceUpdate)
    };

    // Emitir evento si hay actualización disponible dentro del APK
    if (isNewer && isNativeCapacitor() && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tayaudit:app-update-available', {
        detail: updateInfo
      }));
    }

    return updateInfo;
  } catch (err) {
    console.warn('[UpdateChecker] Error checking for app updates:', err);
    return null;
  }
}

export function initAppUpdateChecker(): () => void {
  if (!isNativeCapacitor()) {
    return () => { };
  }

  // Primer chequeo a los 3 segundos de abrir la app
  const initialTimer = setTimeout(() => {
    checkAppVersion(false);
  }, 3000);

  // Chequeo periódico cada 5 minutos
  const interval = setInterval(() => {
    checkAppVersion(false);
  }, 5 * 60 * 1000);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(interval);
  };
}

export async function triggerDirectApkInstall(
  apkUrl = 'https://tay-audit.pages.dev/TayAudit.apk',
  onProgress?: (data: { percent: number; bytesDownloaded?: number; totalBytes?: number; completed?: boolean }) => void
): Promise<{ success: boolean; method: string; detail?: any }> {
  if (isNativeCapacitor()) {
    try {
      if (typeof onProgress === 'function' && AppInstaller?.addListener) {
        await AppInstaller.addListener('downloadProgress', (data) => {
          onProgress(data);
        });
      }

      const res = await AppInstaller.installApk({ url: apkUrl });
      return { success: true, method: 'native', detail: res };
    } catch (e) {
      console.warn('[AppInstaller] Native AppInstaller error, fallback to system download:', e);
    }
  }

  // Fallback para navegador web o escritorio
  try {
    const a = document.createElement('a');
    a.href = apkUrl;
    a.setAttribute('download', 'TayAudit.apk');
    a.setAttribute('target', '_blank');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { success: true, method: 'browser' };
  } catch {
    window.open(apkUrl, '_blank');
    return { success: true, method: 'window.open' };
  }
}
