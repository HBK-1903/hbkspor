import type { PushScheduleEntry } from './push-schedule';

interface PushCredentials { clientId: string; token: string; }
const CREDENTIALS_KEY = 'hbk_spor_push_credentials_v1';
const API_BASE = import.meta.env.VITE_PUSH_API_URL?.replace(/\/$/, '');

export function isPushBackendConfigured(): boolean { return Boolean(API_BASE); }
export function isPushLocallyEnabled(): boolean {
  try { return localStorage.getItem(CREDENTIALS_KEY) !== null; } catch { return false; }
}

function readCredentials(): PushCredentials | null {
  try {
    const value = JSON.parse(localStorage.getItem(CREDENTIALS_KEY) ?? 'null') as Partial<PushCredentials> | null;
    return value && typeof value.clientId === 'string' && typeof value.token === 'string' ? value as PushCredentials : null;
  } catch { return null; }
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function api(path: string, method: string, body?: unknown, credentials?: PushCredentials): Promise<Response> {
  if (!API_BASE) throw new Error('Push sunucusu yapılandırılmamış.');
  const response = await fetch(`${API_BASE}/api/push${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(credentials ? { Authorization: `Bearer ${credentials.clientId}.${credentials.token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ? `${payload.error} (${response.status})` : `Push sunucusu yanıt vermedi (${response.status}).`);
  }
  return response;
}

export async function enableWebPush(): Promise<void> {
  if (!API_BASE) throw new Error('Kapalı uygulama push’u için VITE_PUSH_API_URL yapılandırılmalı.');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Bu tarayıcı Web Push bildirimlerini desteklemiyor.');
  if (Notification.permission !== 'granted') throw new Error('Önce sistem bildirim iznini ver.');

  const existing = readCredentials();
  const credentials = existing ?? { clientId: crypto.randomUUID(), token: randomToken() };
  const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  const publicKeyResponse = await api('/public-key', 'GET');
  const { publicKey } = await publicKeyResponse.json() as { publicKey: string };
  if (!publicKey) throw new Error('Push sunucusunun VAPID anahtarı eksik.');
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const applicationServerKey = decodeBase64Url(publicKey);
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey as BufferSource });
  }
  await api('/register', 'POST', { clientId: credentials.clientId, token: credentials.token, subscription: subscription.toJSON() }, credentials);
  try { localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials)); }
  catch {
    await api('/register', 'DELETE', undefined, credentials).catch(() => undefined);
    await subscription.unsubscribe();
    throw new Error('Push aboneliği bu tarayıcıda güvenli biçimde saklanamadı.');
  }
}

export async function syncWebPushSchedule(schedule: PushScheduleEntry[]): Promise<void> {
  const credentials = readCredentials();
  if (!credentials || !API_BASE) return;
  await api('/schedule', 'PUT', { notices: schedule }, credentials);
}

export async function disableWebPush(): Promise<void> {
  const credentials = readCredentials();
  let serverError: unknown;
  if (credentials && API_BASE) {
    try { await api('/register', 'DELETE', undefined, credentials); }
    catch (error) {
      if (!(error instanceof Error) || !/\((401|404)\)$/.test(error.message)) serverError = error;
    }
  }
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  localStorage.removeItem(CREDENTIALS_KEY);
  if (serverError) throw new Error('Cihaz aboneliği kaldırıldı; push sunucusuna ulaşılamadı. Sunucu kalan bildirimi teslim etmeye çalışırsa geçersiz abonelik nedeniyle siler.');
}
