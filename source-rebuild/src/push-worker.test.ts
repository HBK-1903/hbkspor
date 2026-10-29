import { describe, expect, it } from 'vitest';
import worker from '../push-worker/src/worker';

class FakeStatement {
  private values: unknown[] = [];
  constructor(private sql: string, private db: FakeD1) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() {
    if (this.sql.includes('SELECT token_hash FROM push_clients')) return (this.db.clients.get(String(this.values[0])) ?? null) as T | null;
    return null;
  }
  async all<T>() { return { results: [] as T[] }; }
  async run() {
    const v = this.values;
    if (this.sql.startsWith('INSERT INTO push_clients')) this.db.clients.set(String(v[0]), { token_hash: v[1], endpoint: v[2], p256dh: v[3], auth: v[4] });
    if (this.sql.startsWith('INSERT INTO push_schedule')) this.db.schedules.set(`${v[0]}:${v[1]}`, { clientId: v[0], key: v[1], title: v[2], body: v[3], at: v[4] });
    if (this.sql.startsWith('DELETE FROM push_schedule')) {
      for (const [key, item] of this.db.schedules) if (item.clientId === v[0] && (v.length < 2 || item.key === v[1])) this.db.schedules.delete(key);
    }
    if (this.sql.startsWith('DELETE FROM push_clients')) this.db.clients.delete(String(v[0]));
    return {};
  }
}
class FakeD1 {
  clients = new Map<string, Record<string, unknown>>();
  schedules = new Map<string, { clientId: unknown; key: unknown; title: unknown; body: unknown; at: unknown }>();
  prepare(sql: string) { return new FakeStatement(sql, this); }
  async batch(statements: FakeStatement[]) { for (const statement of statements) await statement.run(); return []; }
}

const origin = 'https://hbkspor.example';
const clientId = '123e4567-e89b-12d3-a456-426614174000';
const token = 'x'.repeat(43);
const env = () => ({ DB: new FakeD1(), ALLOWED_ORIGINS: origin, VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private', VAPID_SUBJECT: 'mailto:test@example.com' });
const request = (path: string, method: string, body?: unknown, authorization?: string, requestOrigin = origin) => new Request(`https://push-worker.test${path}`, {
  method,
  headers: { Origin: requestOrigin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(authorization ? { Authorization: authorization } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

describe('push worker API', () => {
  it('requires an allowed app origin', async () => {
    const response = await worker.fetch(request('/api/push/public-key', 'GET', undefined, undefined, 'https://evil.example'), env() as never);
    expect(response.status).toBe(403);
  });

  it('registers a device, authenticates schedule updates, and removes it', async () => {
    const bindings = env();
    const subscription = { endpoint: 'https://push.example.test/subscription', keys: { p256dh: 'public-key', auth: 'auth-key' } };
    const registered = await worker.fetch(request('/api/push/register', 'POST', { clientId, token, subscription }), bindings as never);
    expect(registered.status).toBe(200);
    expect(bindings.DB.clients.get(clientId)?.token_hash).not.toBe(token);

    const unauthorized = await worker.fetch(request('/api/push/schedule', 'PUT', { notices: [] }, `Bearer ${clientId}.${'z'.repeat(43)}`), bindings as never);
    expect(unauthorized.status).toBe(401);

    const scheduled = await worker.fetch(request('/api/push/schedule', 'PUT', { notices: [{ key: 'plan:p1', title: 'Antrenman', body: 'Saat yaklaşıyor', scheduledAt: Date.now() + 60_000 }] }, `Bearer ${clientId}.${token}`), bindings as never);
    expect(scheduled.status).toBe(200);
    expect(bindings.DB.schedules.size).toBe(1);

    const removed = await worker.fetch(request('/api/push/register', 'DELETE', undefined, `Bearer ${clientId}.${token}`), bindings as never);
    expect(removed.status).toBe(200);
    expect(bindings.DB.clients.size).toBe(0);
    expect(bindings.DB.schedules.size).toBe(0);
  });
});
