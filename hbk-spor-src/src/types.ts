export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'rearDelts' | 'traps'
  | 'biceps' | 'triceps' | 'forearms' | 'core' | 'obliques'
  | 'hipFlexors' | 'quadriceps' | 'hamstrings' | 'glutes'
  | 'adductors' | 'calves' | 'tibialis';

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: string;
  footballTag?: string;
  track?: boolean;
  isDefault?: boolean;
  createdAt?: string;
}

export interface LegacySet {
  id: string;
  setNumber?: number;
  reps: number;
  weight: number;
  note?: string;
}

export interface LegacyGymExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: LegacySet[];
}

export interface LegacyWorkout {
  id: string;
  type: string;
  date: string;
  title?: string;
  durationMinutes?: number;
  notes?: string;
  rpeScale?: number;
  gymExercises?: LegacyGymExercise[];
  [key: string]: unknown;
}

export interface SetEffortMetadata {
  rpe?: number;
  restSeconds?: number;
}

export type SetEffortStore = Record<string, SetEffortMetadata>;

export interface MuscleLoad {
  muscle: MuscleGroup;
  effectiveSets: number;
  weightedVolume: number;
  avgRpe: number | null;
  movements: number;
}

export interface ExerciseRecord {
  workout: LegacyWorkout;
  exercise: LegacyGymExercise;
  definition?: ExerciseDefinition;
}
