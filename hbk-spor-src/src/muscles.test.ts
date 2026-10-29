import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import catalog from './data/exercise-catalog.json';
import { LEGACY_DB_NAME, readLegacyTrainingData, setMetadataKey } from './db';
import { flattenGymWorkouts, mapExerciseMuscles, summarizeMuscleLoads } from './muscles';
import type { ExerciseDefinition, LegacyWorkout } from './types';

const exerciseCatalog = catalog as ExerciseDefinition[];
const bench = exerciseCatalog.find((exercise) => exercise.id === 'ex-ch-1')!;

function makeWorkout(overrides: Partial<LegacyWorkout> = {}): LegacyWorkout {
  return {
    id: 'workout-1',
    type: 'gym',
    date: '2026-10-29',
    title: 'İtiş günü',
    rpeScale: 7,
    gymExercises: [{
      id: 'gym-ex-1',
      exerciseId: 'ex-ch-1',
      exerciseName: 'Barbell Bench Press',
      sets: [
        { id: 'set-1', setNumber: 1, reps: 10, weight: 40 },
        { id: 'set-2', setNumber: 2, reps: 8, weight: 50 },
      ],
    }],
    ...overrides,
  };
}

function deleteLegacyDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database delete blocked'));
  });
}

afterEach(async () => {
  await deleteLegacyDatabase();
});

describe('full app IndexedDB compatibility', () => {
  it('does not create an app database if no existing database is present', async () => {
    const read = await readLegacyTrainingData();
    expect(read.dbVersion).toBe(0);
    expect((await indexedDB.databases()).some((database) => database.name === LEGACY_DB_NAME)).toBe(false);
  });

  it('reads existing v2 stores without upgrading or rewriting the schema', async () => {
    const setup = indexedDB.open(LEGACY_DB_NAME, 2);
    setup.onupgradeneeded = () => {
      const db = setup.result;
      db.createObjectStore('workouts', { keyPath: 'id' });
      db.createObjectStore('exercises', { keyPath: 'id' });
      db.createObjectStore('weeklyPlan', { keyPath: 'dayOfWeek' });
      db.createObjectStore('customPlans', { keyPath: 'date' });
      db.createObjectStore('dailyGoals', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'key' });
      db.createObjectStore('matches', { keyPath: 'id' });
      db.createObjectStore('playerProfile', { keyPath: 'id' });
      db.createObjectStore('badges', { keyPath: 'id' });
    };
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      setup.onsuccess = () => resolve(setup.result);
      setup.onerror = () => reject(setup.error);
    });
    const tx = database.transaction(['workouts', 'exercises'], 'readwrite');
    tx.objectStore('workouts').put(makeWorkout());
    tx.objectStore('exercises').put(bench);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    database.close();

    const read = await readLegacyTrainingData();
    expect(read.dbVersion).toBe(2);
    expect(read.workouts).toHaveLength(1);
    expect(read.workouts[0].gymExercises?.[0].sets).toHaveLength(2);
    expect(read.exercises).toHaveLength(1);

    const verifyRequest = indexedDB.open(LEGACY_DB_NAME);
    const verifyDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      verifyRequest.onsuccess = () => resolve(verifyRequest.result);
      verifyRequest.onerror = () => reject(verifyRequest.error);
    });
    expect(verifyDatabase.version).toBe(2);
    const originalWorkout = await new Promise<LegacyWorkout>((resolve, reject) => {
      const get = verifyDatabase.transaction('workouts', 'readonly').objectStore('workouts').get('workout-1');
      get.onsuccess = () => resolve(get.result as LegacyWorkout);
      get.onerror = () => reject(get.error);
    });
    expect(originalWorkout.gymExercises?.[0].sets[0]).toMatchObject({ id: 'set-1', reps: 10, weight: 40 });
    verifyDatabase.close();
  });
});

describe('legacy gym data analysis', () => {
  it('flattens the original workout → gymExercises → sets structure', () => {
    const rows = flattenGymWorkouts([makeWorkout()], exerciseCatalog, {});
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ exerciseName: 'Barbell Bench Press', reps: 10, weightKg: 40, setNumber: 1, date: '2026-10-29' });
    expect(rows[0].primaryMuscles).toContain('chest');
    expect(rows[0].secondaryMuscles).toContain('triceps');
  });

  it('uses optional set RPE metadata and the original workout RPE as fallback', () => {
    const metadata = { [setMetadataKey('workout-1', 'gym-ex-1', 'set-1')]: { rpe: 9, restSeconds: 120 } };
    const rows = flattenGymWorkouts([makeWorkout()], exerciseCatalog, metadata);
    expect(rows[0]).toMatchObject({ rpe: 9, restSeconds: 120 });
    expect(rows[1].rpe).toBe(7);
  });

  it('does not treat field sessions or unmapped recovery tools as muscle-strength work', () => {
    const fieldWorkout = makeWorkout({ type: 'saha' });
    const roller = makeWorkout({ gymExercises: [{ id: 'roller', exerciseId: 'ex-fb-8', exerciseName: 'Foam Roller', sets: [{ id: 's', reps: 10, weight: 0 }] }] });
    expect(flattenGymWorkouts([fieldWorkout, roller], exerciseCatalog, {})).toEqual([]);
  });

  it('does not guess muscle groups for unknown custom exercises', () => {
    expect(mapExerciseMuscles({ id: 'custom-1', name: 'Özel hareket', category: 'Diğer' })).toBeUndefined();
    expect(mapExerciseMuscles({ id: 'custom-2', name: 'Özel squat', category: 'Bacak & Kalça' })?.primary).toContain('quadriceps');
  });

  it('splits primary and secondary muscle sets and weighted tonnage', () => {
    const rows = flattenGymWorkouts([makeWorkout()], exerciseCatalog, {});
    const summary = new Map(summarizeMuscleLoads(rows, '2026-10-26', '2026-11-01').map((item) => [item.muscle, item]));
    expect(summary.get('chest')?.effectiveSets).toBe(2);
    expect(summary.get('chest')?.weightedVolume).toBe(800);
    expect(summary.get('triceps')?.effectiveSets).toBe(1);
    expect(summary.get('triceps')?.weightedVolume).toBe(400);
    expect(summary.get('back')?.effectiveSets).toBe(0);
  });
});
