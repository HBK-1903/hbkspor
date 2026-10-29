import type { ExerciseSet, LoggedExercise, MuscleGroup, SessionKind, TrainingSession } from './types';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Göğüs',
  back: 'Sırt',
  shoulders: 'Omuz',
  biceps: 'Biceps',
  triceps: 'Triceps',
  core: 'Karın & core',
  quadriceps: 'Ön bacak',
  hamstrings: 'Arka bacak',
  glutes: 'Kalça',
  calves: 'Baldır',
};

export interface ExerciseDefinition {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
}

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  { id: 'bench-press', name: 'Bench press', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'] },
  { id: 'push-up', name: 'Şınav', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders', 'core'] },
  { id: 'shoulder-press', name: 'Omuz press', primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps'] },
  { id: 'lateral-raise', name: 'Yana omuz açış', primaryMuscles: ['shoulders'], secondaryMuscles: [] },
  { id: 'lat-pulldown', name: 'Lat pulldown', primaryMuscles: ['back'], secondaryMuscles: ['biceps'] },
  { id: 'seated-row', name: 'Kablo row', primaryMuscles: ['back'], secondaryMuscles: ['biceps', 'shoulders'] },
  { id: 'biceps-curl', name: 'Biceps curl', primaryMuscles: ['biceps'], secondaryMuscles: [] },
  { id: 'triceps-pushdown', name: 'Triceps pushdown', primaryMuscles: ['triceps'], secondaryMuscles: [] },
  { id: 'squat', name: 'Squat', primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['hamstrings', 'core'] },
  { id: 'leg-extension', name: 'Leg extension', primaryMuscles: ['quadriceps'], secondaryMuscles: [] },
  { id: 'leg-curl', name: 'Leg curl', primaryMuscles: ['hamstrings'], secondaryMuscles: [] },
  { id: 'romanian-deadlift', name: 'Romanian deadlift', primaryMuscles: ['hamstrings', 'glutes'], secondaryMuscles: ['back', 'core'] },
  { id: 'hip-thrust', name: 'Hip thrust', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'core'] },
  { id: 'lunge', name: 'Lunge', primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['hamstrings', 'core'] },
  { id: 'calf-raise', name: 'Calf raise', primaryMuscles: ['calves'], secondaryMuscles: [] },
  { id: 'plank', name: 'Plank', primaryMuscles: ['core'], secondaryMuscles: ['shoulders'] },
];

export const XP_REWARDS: Record<SessionKind, number> = {
  gym: 40,
  pitch: 40,
  match: 50,
  gps: 35,
  timer: 30,
  recovery: 20,
  rest: 10,
};

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Use the player's local calendar date; ISO/UTC dates shift around midnight. */
export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function dateFromLocalKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function shiftLocalDate(key: string, amount: number): string {
  const date = dateFromLocalKey(key);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

export function getWeekStartKey(date = new Date()): string {
  const today = localDateKey(date);
  const mondayOffset = (date.getDay() + 6) % 7;
  return shiftLocalDate(today, -mondayOffset);
}

export function getStreak(sessions: TrainingSession[], today = new Date()): number {
  const activeDates = new Set(sessions.map((session) => session.date));
  const todayKey = localDateKey(today);
  // Before today's workout, keep showing the streak that ended yesterday.
  let cursor = activeDates.has(todayKey) ? todayKey : shiftLocalDate(todayKey, -1);
  let streak = 0;
  while (activeDates.has(cursor)) {
    streak++;
    cursor = shiftLocalDate(cursor, -1);
  }
  return streak;
}

function validSet(set: Pick<ExerciseSet, 'reps' | 'weightKg' | 'rpe' | 'restSeconds'>): boolean {
  return Number.isInteger(set.reps) && set.reps >= 1 && set.reps <= 100
    && Number.isFinite(set.weightKg) && set.weightKg >= 0 && set.weightKg <= 500
    && Number.isInteger(set.rpe) && set.rpe >= 1 && set.rpe <= 10
    && Number.isInteger(set.restSeconds) && set.restSeconds >= 0 && set.restSeconds <= 600;
}

export function makeLoggedExerciseFromSets(definition: ExerciseDefinition, setDetails: ExerciseSet[]): LoggedExercise | null {
  if (setDetails.length < 1 || setDetails.length > 20 || !setDetails.every(validSet)) return null;
  const totalReps = setDetails.reduce((sum, set) => sum + set.reps, 0);
  const averageReps = Math.round(totalReps / setDetails.length);
  const repWeightedKg = totalReps > 0
    ? setDetails.reduce((sum, set) => sum + set.reps * set.weightKg, 0) / totalReps
    : 0;
  const averageRpe = setDetails.reduce((sum, set) => sum + set.rpe, 0) / setDetails.length;
  return {
    id: crypto.randomUUID(),
    exerciseId: definition.id,
    name: definition.name,
    sets: setDetails.length,
    reps: averageReps,
    weightKg: repWeightedKg,
    rpe: averageRpe,
    setDetails: setDetails.map((set) => ({ ...set })),
    primaryMuscles: [...definition.primaryMuscles],
    secondaryMuscles: [...definition.secondaryMuscles],
  };
}

/** Compatibility helper for legacy uniform-set records/tests. */
export function makeLoggedExercise(
  definition: ExerciseDefinition,
  sets: number,
  reps: number,
  weightKg: number,
  rpe: number,
): LoggedExercise | null {
  if (!Number.isInteger(sets) || sets < 1 || sets > 20) return null;
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) return null;
  if (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 500) return null;
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return null;
  const uniformSets = Array.from({ length: sets }, () => ({
    id: crypto.randomUUID(), reps, weightKg, rpe, restSeconds: 0,
  }));
  return makeLoggedExerciseFromSets(definition, uniformSets);
}

export function getExerciseSetCount(exercise: LoggedExercise): number {
  return exercise.setDetails?.length ?? exercise.sets;
}

export function getExerciseTotalReps(exercise: LoggedExercise): number {
  return exercise.setDetails?.reduce((sum, set) => sum + set.reps, 0) ?? exercise.sets * exercise.reps;
}

export function getExerciseTonnage(exercise: LoggedExercise): number {
  if (exercise.setDetails) return exercise.setDetails.reduce((sum, set) => sum + set.reps * set.weightKg, 0);
  return exercise.sets * exercise.reps * exercise.weightKg;
}

export function getExerciseAverageRpe(exercise: LoggedExercise): number {
  if (exercise.setDetails?.length) return exercise.setDetails.reduce((sum, set) => sum + set.rpe, 0) / exercise.setDetails.length;
  return exercise.rpe;
}

export function formatSetDetails(exercise: LoggedExercise): string {
  if (!exercise.setDetails?.length) return `${exercise.sets} × ${exercise.reps} · ${exercise.weightKg ? `${exercise.weightKg} kg` : 'vücut ağırlığı'}`;
  return exercise.setDetails.map((set) => `${set.reps}×${set.weightKg ? `${set.weightKg} kg` : 'vücut ağırlığı'}`).join(' · ');
}

export interface MuscleSummary {
  muscle: MuscleGroup;
  effectiveSets: number;
  weightedRpe: number | null;
  movementCount: number;
}

/**
 * Estimated set-equivalents: a primary muscle gets 1 set and a secondary
 * muscle gets 0.5. This is a planning aid, not a fatigue or medical
 * measurement.
 */
export function summarizeMuscleWorkload(
  sessions: TrainingSession[],
  startDate: string,
  endDate: string,
): MuscleSummary[] {
  const accumulators = new Map<MuscleGroup, { sets: number; rpeTotal: number; rpeWeight: number; movements: Set<string> }>();

  for (const session of sessions) {
    if (session.date < startDate || session.date > endDate) continue;
    for (const exercise of session.exercises ?? []) {
      const primary = new Set(exercise.primaryMuscles ?? []);
      const secondary = new Set(exercise.secondaryMuscles ?? []);
      const setCount = getExerciseSetCount(exercise);
      const averageRpe = getExerciseAverageRpe(exercise);
      for (const muscle of new Set([...primary, ...secondary])) {
        const share = primary.has(muscle) ? 1 : 0.5;
        const item = accumulators.get(muscle) ?? { sets: 0, rpeTotal: 0, rpeWeight: 0, movements: new Set<string>() };
        const contribution = setCount * share;
        item.sets += contribution;
        item.rpeTotal += averageRpe * contribution;
        item.rpeWeight += contribution;
        item.movements.add(exercise.exerciseId);
        accumulators.set(muscle, item);
      }
    }
  }

  return (Object.keys(MUSCLE_LABELS) as MuscleGroup[])
    .map((muscle) => {
      const item = accumulators.get(muscle);
      return {
        muscle,
        effectiveSets: item?.sets ?? 0,
        weightedRpe: item && item.rpeWeight > 0 ? item.rpeTotal / item.rpeWeight : null,
        movementCount: item?.movements.size ?? 0,
      };
    })
    .sort((a, b) => b.effectiveSets - a.effectiveSets || MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle], 'tr'));
}
