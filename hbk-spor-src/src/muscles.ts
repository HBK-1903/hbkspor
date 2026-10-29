import type { ExerciseDefinition, LegacyGymExercise, LegacyWorkout, MuscleGroup, MuscleLoad, SetEffortStore } from './types';
import { setMetadataKey } from './db';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Göğüs', back: 'Sırt', shoulders: 'Omuz', rearDelts: 'Arka omuz', traps: 'Trapez',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Ön kol', core: 'Core', obliques: 'Yan karın',
  hipFlexors: 'Kalça fleksörleri', quadriceps: 'Ön bacak', hamstrings: 'Arka bacak', glutes: 'Kalça',
  adductors: 'İç bacak', calves: 'Baldır', tibialis: 'Ön kaval',
};

export interface MuscleMapping {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  track?: boolean;
}

const M = (primary: MuscleGroup[], secondary: MuscleGroup[] = []): MuscleMapping => ({ primary, secondary });
const exerciseMap: Record<string, MuscleMapping> = {
  // Lower body and posterior chain
  'ex-leg-1': M(['quadriceps', 'glutes'], ['hamstrings', 'core']),
  'ex-leg-2': M(['quadriceps'], ['glutes', 'core']),
  'ex-leg-3': M(['quadriceps', 'glutes'], ['hamstrings', 'calves']),
  'ex-leg-4': M(['hamstrings', 'glutes'], ['back', 'core']),
  'ex-leg-5': M(['hamstrings'], ['glutes']),
  'ex-leg-6': M(['glutes', 'hamstrings', 'back'], ['quadriceps', 'traps', 'core']),
  'ex-leg-7': M(['quadriceps', 'glutes'], ['hamstrings', 'traps', 'core']),
  'ex-leg-8': M(['quadriceps', 'glutes'], ['hamstrings', 'core']),
  'ex-leg-9': M(['glutes'], ['hamstrings', 'core']),
  'ex-leg-10': M(['quadriceps'], ['glutes']),
  'ex-leg-11': M(['quadriceps']),
  'ex-leg-12': M(['hamstrings']),
  'ex-leg-13': M(['calves']),
  'ex-leg-14': M(['calves']),
  'ex-leg-15': M(['tibialis']),
  'ex-leg-16': M(['adductors', 'core']),
  // Chest and pressing
  'ex-ch-1': M(['chest'], ['triceps', 'shoulders']),
  'ex-ch-2': M(['chest'], ['shoulders', 'triceps']),
  'ex-ch-3': M(['chest'], ['shoulders', 'triceps']),
  'ex-ch-4': M(['chest'], ['shoulders', 'triceps']),
  'ex-ch-5': M(['chest'], ['shoulders']),
  'ex-ch-6': M(['chest'], ['shoulders']),
  'ex-ch-7': M(['chest', 'triceps'], ['shoulders']),
  'ex-ch-8': M(['chest'], ['shoulders']),
  'ex-ch-9': M(['chest'], ['shoulders', 'triceps', 'core']),
  'ex-ch-10': M(['chest'], ['triceps', 'shoulders', 'core']),
  // Pulling and upper back
  'ex-bk-1': M(['back'], ['biceps', 'rearDelts', 'core']),
  'ex-bk-2': M(['back'], ['biceps', 'forearms']),
  'ex-bk-3': M(['back'], ['biceps', 'forearms']),
  'ex-bk-4': M(['back'], ['biceps', 'rearDelts']),
  'ex-bk-5': M(['back'], ['biceps', 'core']),
  'ex-bk-6': M(['back'], ['biceps', 'traps']),
  'ex-bk-7': M(['rearDelts', 'traps'], ['back']),
  'ex-bk-8': M(['back'], ['biceps', 'rearDelts']),
  'ex-bk-9': M(['back'], ['biceps']),
  'ex-bk-10': M(['traps'], ['forearms']),
  'ex-bk-11': M(['back'], ['glutes', 'hamstrings', 'core']),
  // Shoulders
  'ex-sh-1': M(['shoulders'], ['triceps', 'traps', 'core']),
  'ex-sh-2': M(['shoulders'], ['triceps']),
  'ex-sh-3': M(['shoulders']),
  'ex-sh-4': M(['shoulders']),
  'ex-sh-5': M(['shoulders'], ['triceps']),
  'ex-sh-6': M(['shoulders'], ['chest']),
  'ex-sh-7': M(['rearDelts'], ['back']),
  'ex-sh-8': M(['rearDelts'], ['back']),
  'ex-sh-9': M(['shoulders', 'traps'], ['biceps']),
  'ex-sh-10': M(['shoulders'], ['triceps', 'glutes', 'quadriceps', 'core']),
  // Arms
  'ex-arm-1': M(['biceps'], ['forearms']),
  'ex-arm-2': M(['biceps', 'forearms']),
  'ex-arm-3': M(['biceps']),
  'ex-arm-4': M(['biceps']),
  'ex-arm-5': M(['biceps'], ['forearms']),
  'ex-arm-6': M(['triceps']),
  'ex-arm-7': M(['triceps']),
  'ex-arm-8': M(['triceps'], ['shoulders']),
  'ex-arm-9': M(['triceps'], ['chest', 'shoulders']),
  'ex-arm-10': M(['triceps'], ['chest', 'shoulders']),
  // Trunk
  'ex-cr-1': M(['core']),
  'ex-cr-2': M(['obliques', 'core']),
  'ex-cr-3': M(['core'], ['hipFlexors']),
  'ex-cr-4': M(['core'], ['shoulders']),
  'ex-cr-5': M(['obliques', 'core']),
  'ex-cr-6': M(['core'], ['shoulders']),
  'ex-cr-7': M(['obliques', 'core']),
  'ex-cr-8': M(['core']),
  'ex-cr-9': M(['core', 'obliques'], ['hipFlexors']),
  'ex-cr-10': M(['core']),
  'ex-cr-11': M(['core'], ['back', 'glutes']),
  'ex-cr-12': M(['core'], ['shoulders', 'quadriceps', 'hipFlexors']),
  // Football power and mobility
  'ex-fb-1': M(['quadriceps', 'glutes'], ['calves', 'core']),
  'ex-fb-2': M(['glutes', 'hamstrings'], ['quadriceps', 'calves', 'core']),
  'ex-fb-3': M(['glutes', 'quadriceps'], ['calves', 'core']),
  'ex-fb-4': M(['glutes', 'hamstrings'], ['back', 'core']),
  'ex-fb-5': M(['adductors', 'quadriceps', 'glutes'], ['hamstrings']),
  'ex-fb-6': M(['hipFlexors'], ['glutes', 'adductors']),
  'ex-fb-7': M(['hipFlexors', 'adductors'], ['quadriceps', 'core']),
  'ex-fb-8': { primary: [], secondary: [], track: false },
  'ex-fb-9': M(['calves'], ['tibialis']),
  'ex-fb-10': M(['obliques', 'core'], ['shoulders']),
  'ex-fb-11': M(['glutes', 'quadriceps'], ['adductors', 'calves']),
  'ex-fb-12': M(['glutes', 'adductors'], ['core']),
};

export function mapExerciseMuscles(definition?: ExerciseDefinition, exercise?: LegacyGymExercise): MuscleMapping | undefined {
  const id = exercise?.exerciseId ?? definition?.id;
  if (id && exerciseMap[id]) return exerciseMap[id].track === false ? undefined : exerciseMap[id];
  const category = definition?.category ?? '';
  if (category.includes('Bacak')) return M(['quadriceps', 'glutes'], ['hamstrings', 'core']);
  if (category === 'Göğüs') return M(['chest'], ['triceps', 'shoulders']);
  if (category.includes('Sırt')) return M(['back'], ['biceps', 'rearDelts']);
  if (category === 'Omuz') return M(['shoulders'], ['triceps']);
  if (category === 'Kol') return M(['biceps', 'triceps'], ['forearms']);
  if (category.includes('Core')) return M(['core'], ['obliques']);
  if (category.includes('Futbol')) return M(['glutes', 'quadriceps'], ['calves', 'core']);
  // Unknown/custom movements are not guessed: a false muscle report would be
  // worse than leaving them out and flagging them to the user.
  return undefined;
}

export interface FlattenedSet {
  workoutId: string;
  workoutTitle: string;
  date: string;
  workoutRpe?: number;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory?: string;
  setId: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  note?: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  rpe?: number;
  restSeconds?: number;
}

export function flattenGymWorkouts(
  workouts: LegacyWorkout[],
  definitions: ExerciseDefinition[],
  effort: SetEffortStore,
): FlattenedSet[] {
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  return workouts.flatMap((workout) => {
    if (workout.type !== 'gym' || !/^\d{4}-\d{2}-\d{2}$/.test(workout.date) || !Array.isArray(workout.gymExercises)) return [];
    return workout.gymExercises.flatMap((exercise) => {
      const definition = definitionsById.get(exercise.exerciseId);
      const mapping = mapExerciseMuscles(definition, exercise);
      if (!mapping || !Array.isArray(exercise.sets)) return [];
      return exercise.sets.flatMap((set, index) => {
        const reps = Number(set.reps);
        const weightKg = Number(set.weight);
        if (!Number.isFinite(reps) || reps < 0 || !Number.isFinite(weightKg) || weightKg < 0) return [];
        const metadata = effort[setMetadataKey(workout.id, exercise.id, set.id)] ?? {};
        const sessionRpe = typeof workout.rpeScale === 'number' ? workout.rpeScale : undefined;
        const rpe = Number(metadata.rpe ?? sessionRpe);
        const restSeconds = metadata.restSeconds;
        return [{
          workoutId: workout.id,
          workoutTitle: workout.title || 'Gym antrenmanı',
          date: workout.date,
          ...(sessionRpe !== undefined && Number.isInteger(sessionRpe) && sessionRpe >= 1 && sessionRpe <= 10 ? { workoutRpe: sessionRpe } : {}),
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName || definition?.name || 'Hareket',
          ...(definition?.category ? { exerciseCategory: definition.category } : {}),
          setId: set.id,
          setNumber: Number.isInteger(set.setNumber) ? Number(set.setNumber) : index + 1,
          reps,
          weightKg,
          ...(set.note ? { note: set.note } : {}),
          primaryMuscles: mapping.primary,
          secondaryMuscles: mapping.secondary,
          ...(Number.isInteger(rpe) && rpe >= 1 && rpe <= 10 ? { rpe } : {}),
          ...(typeof restSeconds === 'number' && Number.isInteger(restSeconds) && restSeconds >= 0 && restSeconds <= 600 ? { restSeconds } : {}),
        }];
      });
    });
  });
}

export function summarizeMuscleLoads(rows: FlattenedSet[], startDate: string, endDate: string): MuscleLoad[] {
  const result = new Map<MuscleGroup, { sets: number; volume: number; rpeTotal: number; rpeCount: number; movementIds: Set<string> }>();
  for (const row of rows) {
    if (row.date < startDate || row.date > endDate) continue;
    const primary = new Set(row.primaryMuscles);
    const secondary = new Set(row.secondaryMuscles);
    for (const muscle of new Set([...primary, ...secondary])) {
      const factor = primary.has(muscle) ? 1 : 0.5;
      const acc = result.get(muscle) ?? { sets: 0, volume: 0, rpeTotal: 0, rpeCount: 0, movementIds: new Set<string>() };
      acc.sets += factor;
      acc.volume += row.reps * row.weightKg * factor;
      if (row.rpe) { acc.rpeTotal += row.rpe; acc.rpeCount += 1; }
      acc.movementIds.add(row.exerciseId);
      result.set(muscle, acc);
    }
  }
  return (Object.keys(MUSCLE_LABELS) as MuscleGroup[])
    .map((muscle) => {
      const acc = result.get(muscle);
      return {
        muscle,
        effectiveSets: acc?.sets ?? 0,
        weightedVolume: acc?.volume ?? 0,
        avgRpe: acc && acc.rpeCount ? acc.rpeTotal / acc.rpeCount : null,
        movements: acc?.movementIds.size ?? 0,
      };
    })
    .sort((a, b) => b.effectiveSets - a.effectiveSets || MUSCLE_LABELS[a.muscle].localeCompare(MUSCLE_LABELS[b.muscle], 'tr'));
}
