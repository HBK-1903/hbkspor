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

export interface LegacyMatch {
  id: string;
  date: string;
  opponent?: string;
  scoreOur?: number;
  scoreOpponent?: number;
  isHome?: boolean;
  minutesPlayed?: number;
  goals?: number;
  assists?: number;
  rating?: number;
  isMvp?: boolean;
  [key: string]: unknown;
}

export interface LegacyPlan {
  date?: string;
  dayOfWeek?: number;
  type?: string;
  title?: string;
  [key: string]: unknown;
}

export interface LegacyPlayerProfile {
  name?: string;
  nickname?: string;
  position?: string;
  [key: string]: unknown;
}

export interface GpsRoutePoint {
  lat: number;
  lon: number;
}

export interface GpsSplit {
  number: number;
  distanceKm: number;
  movingSeconds: number;
  paceSecondsPerKm: number;
}

export interface GpsActivity {
  id: string;
  date: string;
  distanceKm: number;
  elapsedSeconds: number;
  movingSeconds: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  elevationGainM?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  splits?: GpsSplit[];
  route: GpsRoutePoint[];
  source: 'app' | 'gpx' | 'tcx' | 'fit';
  fileName?: string;
  importedAt?: string;
}

export interface SkillTestResult {
  date: string;
  value: number;
}

export interface SkillTestRecord {
  id: string;
  name: string;
  unit: string;
  category?: string;
  target?: number;
  history: SkillTestResult[];
}

export interface WellnessPoint {
  workoutId: string;
  date: string;
  title: string;
  sleep: number;
  energy: number;
  soreness: number;
  stress: number;
}

export interface AnalyticsData {
  workouts: LegacyWorkout[];
  catalog: ExerciseDefinition[];
  matches: LegacyMatch[];
  weeklyPlan: LegacyPlan[];
  customPlans: LegacyPlan[];
  profile?: LegacyPlayerProfile;
  gpsActivities: GpsActivity[];
  skillTests: SkillTestRecord[];
  wellness: WellnessPoint[];
  dbVersion: number;
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
