import { describe, expect, it } from 'vitest';
import {
  EXERCISE_LIBRARY,
  getExerciseAverageRpe,
  getExerciseTonnage,
  getStreak,
  getWeekStartKey,
  localDateKey,
  makeLoggedExercise,
  makeLoggedExerciseFromSets,
  summarizeMuscleWorkload,
} from './training';
import type { TrainingSession } from './types';

const bench = EXERCISE_LIBRARY.find((exercise) => exercise.id === 'bench-press')!;
const benchLog = makeLoggedExercise(bench, 3, 10, 40, 8)!;

function gymSession(date: string, exercises = [benchLog]): TrainingSession {
  return { id: `session-${date}`, kind: 'gym', title: 'Test gym', minutes: 45, xp: 40, date, exercises };
}

describe('local training dates and streaks', () => {
  it('uses the local calendar date rather than converting to UTC', () => {
    expect(localDateKey(new Date(2026, 9, 29, 23, 30))).toBe('2026-10-29');
  });

  it('starts the week on Monday using the local date', () => {
    expect(getWeekStartKey(new Date(2026, 9, 29, 12))).toBe('2026-10-26');
  });

  it('keeps yesterday streak visible before the user trains today', () => {
    expect(getStreak([gymSession('2026-10-28')], new Date(2026, 9, 29, 9))).toBe(1);
  });

  it('does not bridge gaps in an activity streak', () => {
    expect(getStreak([gymSession('2026-10-27')], new Date(2026, 9, 29, 12))).toBe(0);
  });
});

describe('gym exercise tracking', () => {
  it('rejects invalid exercise inputs', () => {
    expect(makeLoggedExercise(bench, 0, 10, 40, 8)).toBeNull();
    expect(makeLoggedExercise(bench, 3, 101, 40, 8)).toBeNull();
    expect(makeLoggedExercise(bench, 3, 10, 501, 8)).toBeNull();
    expect(makeLoggedExercise(bench, 3, 10, 40, 11)).toBeNull();
  });

  it('calculates external-load volume as sets × reps × kilograms', () => {
    expect(getExerciseTonnage(benchLog)).toBe(1200);
  });

  it('keeps per-set weights and repetitions exact when they differ', () => {
    const varied = makeLoggedExerciseFromSets(bench, [
      { id: 'set-1', reps: 10, weightKg: 20, rpe: 7, restSeconds: 90 },
      { id: 'set-2', reps: 8, weightKg: 22.5, rpe: 9, restSeconds: 120 },
    ]);
    expect(varied?.sets).toBe(2);
    expect(getExerciseTonnage(varied!)).toBe(380);
    expect(getExerciseAverageRpe(varied!)).toBe(8);
  });

  it('counts primary sets fully and secondary sets as half sets', () => {
    const summary = summarizeMuscleWorkload([gymSession('2026-10-29')], '2026-10-26', '2026-11-01');
    const byMuscle = new Map(summary.map((item) => [item.muscle, item]));
    expect(byMuscle.get('chest')?.effectiveSets).toBe(3);
    expect(byMuscle.get('triceps')?.effectiveSets).toBe(1.5);
    expect(byMuscle.get('shoulders')?.effectiveSets).toBe(1.5);
    expect(byMuscle.get('back')?.effectiveSets).toBe(0);
    expect(byMuscle.get('chest')?.weightedRpe).toBe(8);
  });

  it('excludes sessions outside the selected week', () => {
    const summary = summarizeMuscleWorkload([gymSession('2026-10-20')], '2026-10-26', '2026-11-01');
    expect(summary.every((item) => item.effectiveSets === 0)).toBe(true);
  });
});
