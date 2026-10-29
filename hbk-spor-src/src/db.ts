import type { ExerciseDefinition, LegacyWorkout, SetEffortStore } from './types';

export const LEGACY_DB_NAME = 'hbk_spor_performans_db';
export const LEGACY_DB_VERSION = 2;
export const SET_EFFORT_KEY = 'hbk_muscle_effort_v1';

async function openExistingDatabase(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in globalThis)) throw new Error('Bu tarayıcı IndexedDB desteği sunmuyor.');

  // IndexedDB.open(name) silently creates a v1 database when the name is new.
  // Check first so the extension never creates or upgrades the app's database.
  const factory = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };
  if (!factory.databases) throw new Error('Bu tarayıcı mevcut veritabanını güvenli biçimde denetleyemiyor. Güncel bir tarayıcı kullan.');
  const databases = await factory.databases();
  if (!databases.some((database) => database.name === LEGACY_DB_NAME)) return null;

  return new Promise((resolve, reject) => {
    // Deliberately omit a version: never trigger a schema upgrade from the
    // analytics extension. The full app remains the owner of DB migrations.
    const request = indexedDB.open(LEGACY_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('HBK Spor veritabanı açılamadı.'));
    request.onblocked = () => reject(new Error('Veritabanı başka bir ekranda güncelleniyor. Biraz sonra yenile.'));
  });
}

function readAll<T>(database: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!database.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    const transaction = database.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error(`${storeName} okunamadı.`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`${storeName} okuması iptal edildi.`));
  });
}

export async function readLegacyTrainingData(): Promise<{ workouts: LegacyWorkout[]; exercises: ExerciseDefinition[]; dbVersion: number }> {
  const database = await openExistingDatabase();
  if (!database) return { workouts: [], exercises: [], dbVersion: 0 };
  try {
    if (database.version < LEGACY_DB_VERSION) {
      return { workouts: [], exercises: [], dbVersion: database.version };
    }
    const [workouts, exercises] = await Promise.all([
      readAll<LegacyWorkout>(database, 'workouts'),
      readAll<ExerciseDefinition>(database, 'exercises'),
    ]);
    return { workouts, exercises, dbVersion: database.version };
  } finally {
    database.close();
  }
}

export function loadSetEffortMetadata(): SetEffortStore {
  try {
    const raw = window.localStorage.getItem(SET_EFFORT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as SetEffortStore;
  } catch {
    return {};
  }
}

export function saveSetEffortMetadata(metadata: SetEffortStore): boolean {
  try {
    window.localStorage.setItem(SET_EFFORT_KEY, JSON.stringify(metadata));
    return true;
  } catch {
    return false;
  }
}

export function setMetadataKey(workoutId: string, exerciseId: string, setId: string): string {
  return `${workoutId}::${exerciseId}::${setId}`;
}
