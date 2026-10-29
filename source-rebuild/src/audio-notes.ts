const DB_NAME = 'hbk_spor_media_v1';
const STORE_NAME = 'voiceNotes';
const MATCH_MEDIA_STORE = 'matchMedia';

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
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Ses notu kaydedilemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Ses notu kaydı iptal edildi.'));
  }).finally(() => database.close());
}

export async function saveMatchMedia(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MATCH_MEDIA_STORE, 'readwrite');
    transaction.objectStore(MATCH_MEDIA_STORE).put(blob, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Maç medyası kaydedilemedi.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Maç medyası kaydı iptal edildi.'));
  }).finally(() => database.close());
}

export async function getMatchMedia(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MATCH_MEDIA_STORE, 'readonly');
    const request = transaction.objectStore(MATCH_MEDIA_STORE).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
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
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('Ses notu okunamadı.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Ses notu okunamadı.')); };
  });
}
