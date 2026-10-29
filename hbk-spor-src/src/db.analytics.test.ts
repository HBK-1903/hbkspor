// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { LEGACY_DB_NAME, readLegacyTrainingData } from './db';

const deleteDb = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
});

afterEach(async () => {
  await deleteDb();
});

describe('existing app analytics data adapter', () => {
  it('reads workouts, match events, weekly plans and profile without changing the legacy database version', async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(LEGACY_DB_NAME, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('workouts', { keyPath: 'id' });
        db.createObjectStore('exercises', { keyPath: 'id' });
        db.createObjectStore('matches', { keyPath: 'id' });
        db.createObjectStore('weeklyPlan', { keyPath: 'dayOfWeek' });
        db.createObjectStore('customPlans', { keyPath: 'date' });
        db.createObjectStore('playerProfile', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['workouts', 'exercises', 'matches', 'weeklyPlan', 'customPlans', 'playerProfile'], 'readwrite');
    transaction.objectStore('workouts').put({ id: 'w-1', type: 'gym', date: '2026-10-28', durationMinutes: 50 });
    transaction.objectStore('workouts').put({ id: 'demo-w1', type: 'gym', date: '2026-10-28', title: 'Demo session', durationMinutes: 55 });
    transaction.objectStore('exercises').put({ id: 'ex-1', name: 'Squat', category: 'gym' });
    transaction.objectStore('matches').put({ id: 'm-1', date: '2026-10-27', opponent: 'Denizli FK', goals: 1, yellowCard: true });
    transaction.objectStore('matches').put({ id: 'demo-m1', date: '2026-10-27', opponent: 'Demo FK', goals: 9 });
    transaction.objectStore('weeklyPlan').put({ dayOfWeek: 3, type: 'gym', title: 'Kuvvet' });
    transaction.objectStore('customPlans').put({ date: '2026-10-29', type: 'saha', title: 'Hız' });
    transaction.objectStore('playerProfile').put({ id: 'current', profile: { name: 'Oyuncu', position: 'RW' } });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();

    const snapshot = await readLegacyTrainingData();
    expect(snapshot.workouts).toHaveLength(1);
    expect(snapshot.exercises).toHaveLength(1);
    expect(snapshot.matches[0]).toMatchObject({ goals: 1, yellowCard: true });
    expect(snapshot.weeklyPlan[0]).toMatchObject({ dayOfWeek: 3, type: 'gym' });
    expect(snapshot.customPlans[0]).toMatchObject({ date: '2026-10-29', type: 'saha' });
    expect(snapshot.profile).toMatchObject({ name: 'Oyuncu', position: 'RW' });
    expect(snapshot.dbVersion).toBe(2);
  });

  it('does not create an empty IndexedDB when the application database is absent', async () => {
    const snapshot = await readLegacyTrainingData();
    expect(snapshot).toMatchObject({ workouts: [], matches: [], weeklyPlan: [], customPlans: [], dbVersion: 0 });
    expect((await indexedDB.databases()).some((database) => database.name === LEGACY_DB_NAME)).toBe(false);
  });
});
