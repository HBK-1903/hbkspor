import { createMediaBackup, parseMediaBackup, verifyMediaBackup, type MediaBackupSourceItem } from './media-backup';

const DB_NAME = 'hbk_spor_media_v1';
const STORE_NAME = 'voiceNotes';
const MATCH_MEDIA_STORE = 'matchMedia';
const MEDIA_RECORD_FORMAT = 'hbk-spor-media-v1';
interface StoredMediaRecord { format: string; type: string; bytes: ArrayBuffer; }

function decodeMedia(value: unknown): Blob | null {
  if (value instanceof Blob) return value;
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<StoredMediaRecord>;
  return record.format === MEDIA_RECORD_FORMAT && typeof record.type === 'string' && record.bytes instanceof ArrayBuffer
    ? new Blob([record.bytes], { type: record.type })
    : null;
}

async function writeMediaRecord(storeName: string, id: string, blob: Blob, errorMessage: string): Promise<void> {
  const record: StoredMediaRecord = { format: MEDIA_RECORD_FORMAT, type: blob.type, bytes: await blob.arrayBuffer() };
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const request = transaction.objectStore(storeName).put(record, id);
    request.onerror = () => reject(request.error ?? new Error(errorMessage));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(errorMessage));
    transaction.onabort = () => reject(transaction.error ?? new Error(errorMessage));
  }).finally(() => database.close());
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Bu tarayıcı yerel ses notlarını saklamayı desteklemiyor.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      if (!request.result.objectStoreNames.contains(MATCH_MEDIA_STORE)) request.result.createObjectStore(MATCH_MEDIA_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ses notu deposu açılamadı.'));
    request.onblocked = () => reject(new Error('Ses notu deposu başka bir sekmede meşgul.'));
  });
}

export async function saveVoiceNote(id: string, blob: Blob): Promise<void> {
  await writeMediaRecord(STORE_NAME, id, blob, 'Ses notu kaydedilemedi.');
}

export async function saveMatchMedia(id: string, blob: Blob): Promise<void> {
  await writeMediaRecord(MATCH_MEDIA_STORE, id, blob, 'Maç medyası kaydedilemedi.');
}

export async function getMatchMedia(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MATCH_MEDIA_STORE, 'readonly');
    const request = transaction.objectStore(MATCH_MEDIA_STORE).get(id);
    request.onsuccess = () => resolve(decodeMedia(request.result));
    request.onerror = () => reject(request.error ?? new Error('Maç medyası okunamadı.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Maç medyası okunamadı.')); };
  });
}

export async function deleteMatchMedia(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MATCH_MEDIA_STORE, 'readwrite');
    transaction.objectStore(MATCH_MEDIA_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Maç medyası silinemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Maç medyası silme işlemi iptal edildi.'));
  }).finally(() => database.close());
}

export async function clearMatchMedia(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MATCH_MEDIA_STORE, 'readwrite');
    transaction.objectStore(MATCH_MEDIA_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Maç medyası temizlenemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Maç medyası temizleme işlemi iptal edildi.'));
  }).finally(() => database.close());
}

export async function deleteVoiceNote(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Sesli not silinemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Sesli not silme işlemi iptal edildi.'));
  }).finally(() => database.close());
}

export async function clearVoiceNotes(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Ses notları temizlenemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Ses notları temizleme işlemi iptal edildi.'));
  }).finally(() => database.close());
}

export async function getVoiceNote(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(decodeMedia(request.result));
    request.onerror = () => reject(request.error ?? new Error('Ses notu okunamadı.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Ses notu okunamadı.')); };
  });
}

export async function exportLocalMediaBackup(): Promise<Blob> {
  const database = await openDatabase();
  const sourceItems = await new Promise<MediaBackupSourceItem[]>((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, MATCH_MEDIA_STORE], 'readonly');
    const voiceStore = transaction.objectStore(STORE_NAME);
    const matchStore = transaction.objectStore(MATCH_MEDIA_STORE);
    const voiceKeys = voiceStore.getAllKeys();
    const voiceValues = voiceStore.getAll();
    const matchKeys = matchStore.getAllKeys();
    const matchValues = matchStore.getAll();
    let entries: MediaBackupSourceItem[] = [];
    transaction.oncomplete = () => {
      const append = (store: 'voiceNotes' | 'matchMedia', keys: IDBValidKey[], values: unknown[]) => {
        keys.forEach((key, index) => {
          const blob = decodeMedia(values[index]);
          if (typeof key === 'string' && blob) entries.push({ store, id: key, blob });
        });
      };
      append('voiceNotes', voiceKeys.result, voiceValues.result);
      append('matchMedia', matchKeys.result, matchValues.result);
      resolve(entries);
    };
    transaction.onerror = () => reject(transaction.error ?? new Error('Cihazdaki medya listesi okunamadı.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Cihazdaki medya listesi okunamadı.'));
  }).finally(() => database.close());
  return createMediaBackup(sourceItems);
}

export async function inspectMediaBackup(buffer: ArrayBuffer) {
  return verifyMediaBackup(parseMediaBackup(buffer));
}

export async function restoreLocalMediaBackup(buffer: ArrayBuffer): Promise<{ voiceNotes: number; matchMedia: number; byteLength: number }> {
  const backup = await verifyMediaBackup(parseMediaBackup(buffer));
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, MATCH_MEDIA_STORE], 'readwrite');
    for (const item of backup.items) {
      const start = backup.payloadOffset + item.offset;
      const record: StoredMediaRecord = { format: MEDIA_RECORD_FORMAT, type: item.type, bytes: backup.payload.slice(start, start + item.size) };
      const request = transaction.objectStore(item.store === 'voiceNotes' ? STORE_NAME : MATCH_MEDIA_STORE).put(record, item.id);
      request.onerror = () => reject(request.error ?? new Error(`Medya dosyası yazılamadı: ${item.id}`));
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Medya dosyaları geri yüklenemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Medya geri yüklemesi iptal edildi; yerel kayıtlar korunmalı.'));
  }).finally(() => database.close());
  return { voiceNotes: backup.voiceNotes, matchMedia: backup.matchMedia, byteLength: backup.byteLength };
}
