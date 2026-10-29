import { describe, expect, it } from 'vitest';
import { decodeBase64Url, encodeBase64Url, sendWebPush } from '../push-worker/src/push-crypto';

async function createSubscription() {
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { endpoint: 'https://fcm.googleapis.com/subscription', keys: { p256dh: encodeBase64Url(publicKey), auth: encodeBase64Url(auth) } };
}

async function createVapid() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKey = new Uint8Array(65); publicKey[0] = 4;
  publicKey.set(decodeBase64Url(jwk.x!), 1);
  publicKey.set(decodeBase64Url(jwk.y!), 33);
  return { publicKey: encodeBase64Url(publicKey), privateKey: jwk.d!, subject: 'mailto:test@example.com' };
}

describe('Web Push payload encryption', () => {
  it('creates an aes128gcm record and signs VAPID authorization', async () => {
    const subscription = await createSubscription();
    const vapid = await createVapid();
    let captured: Request | undefined;
    const response = await sendWebPush(subscription, { title: 'Plan', body: 'Saha çalışması', tag: 'p1' }, vapid, async (input, init) => {
      captured = new Request(input, init);
      return new Response(null, { status: 201 });
    });
    expect(response.status).toBe(201);
    expect(captured?.headers.get('Content-Encoding')).toBe('aes128gcm');
    expect(captured?.headers.get('Authorization')).toMatch(/^vapid t=.+, k=.+$/);
    const bytes = new Uint8Array(await captured!.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(86 + 16);
    expect(bytes[16]).toBe(0); // 4096-byte record size, big-endian
    expect(bytes[17]).toBe(0);
    expect(bytes[18]).toBe(0x10);
    expect(bytes[19]).toBe(0);
    expect(bytes[20]).toBe(65); // sender public-key length
  });

  it('rejects insecure subscription endpoints', async () => {
    const subscription = await createSubscription();
    await expect(sendWebPush({ ...subscription, endpoint: 'http://localhost/private' }, { title: 'x', body: 'y', tag: 'z' }, await createVapid())).rejects.toThrow('Invalid Web Push endpoint');
  });
});
