import { sendWebPush } from './push-crypto';
import type { WebPushSubscription } from './push-crypto';

interface D1Result<T> { results?: T[]; success?: boolean; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown[]>; }
interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}
interface PushClientRow { token_hash: string; }
interface DuePushRow {
  client_id: string;
  notice_key: string;
  title: string;
  body: string;
  attempts: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}
interface NoticeInput { key: string; title: string; body: string; scheduledAt: number; }

const encoder = new TextEncoder();
const CLIENT_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;
const MAX_NOTICES = 250;
const MAX_SCHEDULE_AHEAD_MS = 91 * 24 * 60 * 60 * 1000;

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((entry) => entry.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function json(data: unknown, status: number, origin?: string | null): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function hashToken(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bearer(request: Request): { clientId: string; token: string } | null {
  const value = request.headers.get('Authorization')?.match(/^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,100})$/i);
  return value ? { clientId: value[1], token: value[2] } : null;
}

async function authorize(request: Request, env: Env): Promise<string | null> {
  const credentials = bearer(request);
  if (!credentials || !CLIENT_ID_PATTERN.test(credentials.clientId) || !TOKEN_PATTERN.test(credentials.token)) return null;
  const record = await env.DB.prepare('SELECT token_hash FROM push_clients WHERE client_id = ?').bind(credentials.clientId).first<PushClientRow>();
  if (!record || record.token_hash !== await hashToken(credentials.token)) return null;
  return credentials.clientId;
}

function isSubscription(value: unknown): value is WebPushSubscription {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WebPushSubscription>;
  return typeof candidate.endpoint === 'string' && candidate.endpoint.length <= 2048
    && typeof candidate.keys?.p256dh === 'string' && candidate.keys.p256dh.length <= 128
    && typeof candidate.keys?.auth === 'string' && candidate.keys.auth.length <= 128;
}

async function parseBody<T>(request: Request): Promise<T | null> {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 256_000) return null;
  try { return await request.json() as T; } catch { return null; }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ error: 'Origin is not allowed.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  } });

  const path = new URL(request.url).pathname.replace(/\/$/, '');
  if (path === '/api/push/public-key' && request.method === 'GET') {
    return env.VAPID_PUBLIC_KEY ? json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, origin) : json({ error: 'Push public key is not configured.' }, 503, origin);
  }

  if (path === '/api/push/register' && request.method === 'POST') {
    const body = await parseBody<{ clientId: string; token: string; subscription: WebPushSubscription }>(request);
    if (!body || !CLIENT_ID_PATTERN.test(body.clientId) || !TOKEN_PATTERN.test(body.token) || !isSubscription(body.subscription)) return json({ error: 'Invalid registration payload.' }, 400, origin);
    try {
      const url = new URL(body.subscription.endpoint);
      if (url.protocol !== 'https:' || url.username || url.password) return json({ error: 'Push endpoint must use HTTPS.' }, 400, origin);
    } catch { return json({ error: 'Invalid push endpoint.' }, 400, origin); }
    const tokenHash = await hashToken(body.token);
    const existing = await env.DB.prepare('SELECT token_hash FROM push_clients WHERE client_id = ?').bind(body.clientId).first<PushClientRow>();
    if (existing && existing.token_hash !== tokenHash) return json({ error: 'Push registration token mismatch.' }, 401, origin);
    await env.DB.prepare(`INSERT INTO push_clients (client_id, token_hash, endpoint, p256dh, auth, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(client_id) DO UPDATE SET endpoint = excluded.endpoint,
      p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at`)
      .bind(body.clientId, tokenHash, body.subscription.endpoint, body.subscription.keys.p256dh, body.subscription.keys.auth, Date.now()).run();
    return json({ ok: true }, 200, origin);
  }

  if (path === '/api/push/register' && request.method === 'DELETE') {
    const clientId = await authorize(request, env);
    if (!clientId) return json({ error: 'Push registration is not authorized.' }, 401, origin);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM push_schedule WHERE client_id = ?').bind(clientId),
      env.DB.prepare('DELETE FROM push_clients WHERE client_id = ?').bind(clientId),
    ]);
    return json({ ok: true }, 200, origin);
  }

  if (path === '/api/push/schedule' && request.method === 'PUT') {
    const clientId = await authorize(request, env);
    if (!clientId) return json({ error: 'Push registration is not authorized.' }, 401, origin);
    const body = await parseBody<{ notices: NoticeInput[] }>(request);
    if (!body || !Array.isArray(body.notices) || body.notices.length > MAX_NOTICES) return json({ error: 'Invalid schedule; at most 250 notices are accepted.' }, 400, origin);
    const now = Date.now();
    const unique = new Set<string>();
    for (const notice of body.notices) {
      if (!notice || typeof notice.key !== 'string' || notice.key.length < 1 || notice.key.length > 180 || unique.has(notice.key)
        || typeof notice.title !== 'string' || notice.title.length < 1 || notice.title.length > 100
        || typeof notice.body !== 'string' || notice.body.length > 240
        || !Number.isFinite(notice.scheduledAt) || notice.scheduledAt <= now || notice.scheduledAt > now + MAX_SCHEDULE_AHEAD_MS) {
        return json({ error: 'One or more push notices are invalid or outside the 90-day window.' }, 400, origin);
      }
      unique.add(notice.key);
    }
    const statements = [env.DB.prepare('DELETE FROM push_schedule WHERE client_id = ?').bind(clientId)];
    for (const notice of body.notices) statements.push(env.DB.prepare(`INSERT INTO push_schedule
      (client_id, notice_key, title, body, scheduled_at, next_attempt_at, attempts)
      VALUES (?, ?, ?, ?, ?, ?, 0)`).bind(clientId, notice.key, notice.title, notice.body, notice.scheduledAt, notice.scheduledAt));
    await env.DB.batch(statements);
    return json({ ok: true, scheduled: body.notices.length }, 200, origin);
  }

  return json({ error: 'Not found.' }, 404, origin);
}

async function sendDuePushes(env: Env): Promise<void> {
  const now = Date.now();
  const due = await env.DB.prepare(`SELECT q.client_id, q.notice_key, q.title, q.body, q.attempts,
    c.endpoint, c.p256dh, c.auth FROM push_schedule q JOIN push_clients c ON c.client_id = q.client_id
    WHERE q.next_attempt_at <= ? ORDER BY q.next_attempt_at LIMIT 100`).bind(now).all<DuePushRow>();
  for (const row of due.results ?? []) {
    try {
      const response = await sendWebPush({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        { title: row.title, body: row.body, tag: row.notice_key, url: '/' },
        { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT });
      if (response.ok || response.status === 201 || response.status === 202) {
        await env.DB.prepare('DELETE FROM push_schedule WHERE client_id = ? AND notice_key = ?').bind(row.client_id, row.notice_key).run();
      } else if (response.status === 404 || response.status === 410) {
        await env.DB.batch([
          env.DB.prepare('DELETE FROM push_schedule WHERE client_id = ?').bind(row.client_id),
          env.DB.prepare('DELETE FROM push_clients WHERE client_id = ?').bind(row.client_id),
        ]);
      } else {
        await retryOrDrop(env, row, now);
      }
    } catch {
      await retryOrDrop(env, row, now);
    }
  }
}

async function retryOrDrop(env: Env, row: DuePushRow, now: number): Promise<void> {
  const attempts = row.attempts + 1;
  if (attempts >= 5) {
    await env.DB.prepare('DELETE FROM push_schedule WHERE client_id = ? AND notice_key = ?').bind(row.client_id, row.notice_key).run();
    return;
  }
  const delay = Math.min(60 * 2 ** attempts, 3600) * 1000;
  await env.DB.prepare('UPDATE push_schedule SET attempts = ?, next_attempt_at = ? WHERE client_id = ? AND notice_key = ?')
    .bind(attempts, now + delay, row.client_id, row.notice_key).run();
}

export default {
  fetch(request: Request, env: Env): Promise<Response> { return handleRequest(request, env); },
  scheduled(_event: unknown, env: Env, context: { waitUntil(promise: Promise<unknown>): void }): void {
    context.waitUntil(sendDuePushes(env));
  },
};
