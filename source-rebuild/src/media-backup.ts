export const MEDIA_BACKUP_APP = 'hbk-spor-media-backup';
export const MEDIA_BACKUP_SCHEMA = 2;
export const MAX_MEDIA_BACKUP_BYTES = 150 * 1024 * 1024;
export const MAX_MEDIA_ARCHIVE_FILE_BYTES = MAX_MEDIA_BACKUP_BYTES + 1_000_012;
const MAGIC = new TextEncoder().encode('HBKMED01');
const HEADER_BYTES = 12;
const MAX_ITEMS = 10_000;
const ALLOWED_TYPES = new Set([
  'audio/webm', 'audio/mp4', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm',
]);

export type MediaStore = 'voiceNotes' | 'matchMedia';
export interface MediaBackupSourceItem {
  store: MediaStore;
  id: string;
  blob: Blob;
}
export interface MediaBackupItem {
  store: MediaStore;
  id: string;
  type: string;
  size: number;
  offset: number;
  sha256: string;
}
interface MediaBackupManifest {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  items: MediaBackupItem[];
}
export interface ParsedMediaBackup {
  items: MediaBackupItem[];
  payload: ArrayBuffer;
  payloadOffset: number;
  byteLength: number;
  voiceNotes: number;
  matchMedia: number;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && /^[a-zA-Z0-9._-]+$/.test(value);
}
function validType(store: MediaStore, type: unknown): type is string {
  if (typeof type !== 'string' || type.length > 100 || /[^\x20-\x7e]/.test(type)) return false;
  const mediaType = type.split(';', 1)[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(mediaType)) return false;
  return store === 'voiceNotes' ? mediaType.startsWith('audio/') : mediaType.startsWith('image/') || mediaType.startsWith('video/');
}
function validateItem(store: unknown, id: unknown, type: unknown, size: unknown): store is MediaStore {
  return (store === 'voiceNotes' || store === 'matchMedia')
    && validId(id) && validType(store, type)
    && typeof size === 'number' && Number.isSafeInteger(size) && size > 0 && size <= MAX_MEDIA_BACKUP_BYTES;
}
async function sha256(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Bu tarayıcıda SHA-256 bütünlük denetimi desteklenmiyor.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createMediaBackup(sourceItems: MediaBackupSourceItem[], exportedAt = new Date().toISOString()): Promise<Blob> {
  if (!Array.isArray(sourceItems) || sourceItems.length > MAX_ITEMS) throw new Error('Medya yedeğinde çok fazla dosya var.');
  const seen = new Set<string>();
  let offset = 0;
  const items: MediaBackupItem[] = [];
  const blobs: Blob[] = [];
  for (const source of sourceItems) {
    if (!validateItem(source.store, source.id, source.blob?.type, source.blob?.size)) throw new Error('Medya yedeğinde desteklenmeyen veya bozuk bir dosya var.');
    const key = `${source.store}\u0000${source.id}`;
    if (seen.has(key)) throw new Error('Medya yedeğinde yinelenen dosya kimliği var.');
    seen.add(key);
    if (offset + source.blob.size > MAX_MEDIA_BACKUP_BYTES) throw new Error('Medya yedeği 150 MB sınırını aşıyor.');
    const bytes = await source.blob.arrayBuffer();
    items.push({ store: source.store, id: source.id, type: source.blob.type, size: source.blob.size, offset, sha256: await sha256(bytes) });
    blobs.push(source.blob);
    offset += source.blob.size;
  }
  if (!items.length) throw new Error('Bu cihazda yedeklenecek sesli not veya maç medyası yok.');
  if (!Number.isFinite(Date.parse(exportedAt))) throw new Error('Medya yedeği tarihi geçersiz.');

  const manifest: MediaBackupManifest = { app: MEDIA_BACKUP_APP, schemaVersion: MEDIA_BACKUP_SCHEMA, exportedAt, items };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > 1_000_000) throw new Error('Medya yedeği listesi beklenenden büyük.');
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC, 0);
  new DataView(header.buffer).setUint32(8, manifestBytes.byteLength, false);
  return new Blob([header, manifestBytes, ...blobs], { type: 'application/vnd.hbkspor.media-backup' });
}

export function parseMediaBackup(buffer: ArrayBuffer): ParsedMediaBackup {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < HEADER_BYTES || buffer.byteLength > MAX_MEDIA_ARCHIVE_FILE_BYTES) {
    throw new Error('Medya yedeği boş, çok büyük veya bozuk.');
  }
  const bytes = new Uint8Array(buffer);
  if (!MAGIC.every((byte, index) => bytes[index] === byte)) throw new Error('Dosya HBK Spor medya yedeği biçiminde değil.');
  const manifestLength = new DataView(buffer).getUint32(8, false);
  if (manifestLength === 0 || manifestLength > 1_000_000 || HEADER_BYTES + manifestLength > buffer.byteLength) throw new Error('Medya yedeği başlığı geçersiz.');
  let manifest: unknown;
  try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(HEADER_BYTES, HEADER_BYTES + manifestLength))); }
  catch { throw new Error('Medya yedeğinin dosya listesi okunamadı.'); }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Medya yedeğinin dosya listesi geçersiz.');
  const candidate = manifest as Partial<MediaBackupManifest>;
  if (candidate.app !== MEDIA_BACKUP_APP || candidate.schemaVersion !== MEDIA_BACKUP_SCHEMA) throw new Error('Medya yedeği uygulaması veya sürümü desteklenmiyor.');
  if (typeof candidate.exportedAt !== 'string' || !Number.isFinite(Date.parse(candidate.exportedAt)) || !Array.isArray(candidate.items) || candidate.items.length === 0 || candidate.items.length > MAX_ITEMS) {
    throw new Error('Medya yedeğinin dosya listesi geçersiz.');
  }

  const payloadOffset = HEADER_BYTES + manifestLength;
  const payloadLength = buffer.byteLength - payloadOffset;
  const seen = new Set<string>();
  let expectedOffset = 0;
  let voiceNotes = 0;
  let matchMedia = 0;
  const items: MediaBackupItem[] = [];
  for (const value of candidate.items) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Medya yedeğinde geçersiz bir dosya kaydı var.');
    const item = value as Partial<MediaBackupItem>;
    if (!validateItem(item.store, item.id, item.type, item.size) || !Number.isSafeInteger(item.offset) || item.offset !== expectedOffset || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      throw new Error('Medya yedeğinde bozuk dosya bilgisi var.');
    }
    const safeItem: MediaBackupItem = { store: item.store as MediaStore, id: item.id as string, type: item.type as string, size: item.size as number, offset: item.offset as number, sha256: item.sha256 };
    const key = `${safeItem.store}\u0000${safeItem.id}`;
    if (seen.has(key)) throw new Error('Medya yedeğinde yinelenen dosya kimliği var.');
    seen.add(key);
    expectedOffset += safeItem.size;
    if (expectedOffset > MAX_MEDIA_BACKUP_BYTES) throw new Error('Medya yedeği 150 MB sınırını aşıyor.');
    if (safeItem.store === 'voiceNotes') voiceNotes++; else matchMedia++;
    items.push(safeItem);
  }
  if (expectedOffset !== payloadLength) throw new Error('Medya dosyası eksik, bozuk veya beklenmeyen veri içeriyor.');
  return { items, payload: buffer, payloadOffset, byteLength: payloadLength, voiceNotes, matchMedia };
}

export async function verifyMediaBackup(backup: ParsedMediaBackup): Promise<ParsedMediaBackup> {
  for (const item of backup.items) {
    const start = backup.payloadOffset + item.offset;
    const actual = await sha256(backup.payload.slice(start, start + item.size));
    if (actual !== item.sha256) throw new Error(`Medya yedeği bozuk veya değişmiş: ${item.id}`);
  }
  return backup;
}
