const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface VapidConfig { publicKey: string; privateKey: string; subject: string; }

export function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
export function encodeBase64Url(value: Uint8Array): string {
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

async function hmac(keyBytes: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, toArrayBuffer(message)));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const blocks: Uint8Array[] = [];
  let previous: Uint8Array<ArrayBufferLike> = new Uint8Array();
  let generated = 0;
  for (let counter = 1; generated < length; counter++) {
    previous = await hmac(prk, concat(previous, info, Uint8Array.of(counter)));
    blocks.push(previous);
    generated += previous.length;
  }
  return concat(...blocks).slice(0, length);
}

function encodeJson(value: unknown): string { return encodeBase64Url(encoder.encode(JSON.stringify(value))); }

async function vapidAuthorization(endpoint: URL, config: VapidConfig): Promise<string> {
  const publicBytes = decodeBase64Url(config.publicKey);
  const privateBytes = decodeBase64Url(config.privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) throw new Error('Invalid VAPID key lengths.');
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: encodeBase64Url(publicBytes.slice(1, 33)),
    y: encodeBase64Url(publicBytes.slice(33, 65)),
    d: encodeBase64Url(privateBytes),
    ext: true,
    key_ops: ['sign'],
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = encodeJson({ typ: 'JWT', alg: 'ES256' });
  const claims = encodeJson({ aud: endpoint.origin, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: config.subject });
  const content = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, toArrayBuffer(encoder.encode(content))));
  return `vapid t=${content}.${encodeBase64Url(signature)}, k=${config.publicKey}`;
}

async function encryptPayload(subscription: WebPushSubscription, payload: Uint8Array): Promise<Uint8Array> {
  const receiverPublic = decodeBase64Url(subscription.keys.p256dh);
  const authSecret = decodeBase64Url(subscription.keys.auth);
  if (receiverPublic.length !== 65 || receiverPublic[0] !== 4 || authSecret.length < 16) throw new Error('Invalid Web Push subscription keys.');
  if (payload.length + 1 + 16 > 4096 - 86) throw new Error('Web Push message exceeds one record.');
  const receiverKey = await crypto.subtle.importKey('raw', toArrayBuffer(receiverPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, ephemeral.privateKey, 256));

  const keyInfo = concat(encoder.encode('WebPush: info\0'), receiverPublic, senderPublic);
  const keyPrk = await hmac(authSecret, sharedSecret);
  const inputKeyMaterial = await hkdfExpand(keyPrk, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const messagePrk = await hmac(salt, inputKeyMaterial);
  const contentKey = await hkdfExpand(messagePrk, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(messagePrk, encoder.encode('Content-Encoding: nonce\0'), 12);
  const aesKey = await crypto.subtle.importKey('raw', toArrayBuffer(contentKey), { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(nonce), tagLength: 128 }, aesKey, toArrayBuffer(concat(payload, Uint8Array.of(2)))));
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  return concat(salt, recordSize, Uint8Array.of(senderPublic.length), senderPublic, ciphertext);
}

function safePushEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  const hostname = url.hostname.toLowerCase();
  const trustedPushService = hostname === 'fcm.googleapis.com'
    || hostname === 'web.push.apple.com'
    || hostname.endsWith('.notify.windows.com')
    || hostname.endsWith('.push.services.mozilla.com');
  if (url.protocol !== 'https:' || url.username || url.password || !trustedPushService) throw new Error('Invalid Web Push endpoint.');
  return url;
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  message: { title: string; body: string; tag: string; url?: string },
  vapid: VapidConfig,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const endpoint = safePushEndpoint(subscription.endpoint);
  const authorization = await vapidAuthorization(endpoint, vapid);
  const payload = encoder.encode(JSON.stringify({ ...message, url: message.url || '/' }));
  const body = await encryptPayload(subscription, payload);
  return fetcher(endpoint, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'normal',
    },
    body: toArrayBuffer(body),
  });
}

export function decodePushPayloadForTests(bytes: Uint8Array): string { return decoder.decode(bytes); }
