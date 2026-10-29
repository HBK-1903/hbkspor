export type SessionKind = 'gym' | 'pitch' | 'match' | 'gps' | 'timer' | 'recovery' | 'rest';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export interface PlayerProfile {
  name: string;
  position: string;
  dominantFoot: 'Sağ' | 'Sol';
  createdAt: string;
}

export interface ExerciseSet {
  id: string;
  reps: number;
  weightKg: number;
  /** Self-reported effort (RPE), from 1 = easy to 10 = maximum. */
  rpe: number;
  restSeconds: number;
}

/** A muscle-map snapshot plus set-by-set performance for one movement. */
export interface LoggedExercise {
  id: string;
  exerciseId: string;
  name: string;
  /** Summary fields retained for older local records and CSV compatibility. */
  sets: number;
  reps: number;
  weightKg: number;
  rpe: number;
  setDetails?: ExerciseSet[];
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
}

export type MatchEventType = 'goal' | 'assist' | 'yellow-card' | 'red-card' | 'substitution' | 'note';

export interface MatchEvent {
  id: string;
  minute: number;
  type: MatchEventType;
  detail?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  kind: 'gym' | 'pitch';
  minutes: number;
  note?: string;
  exercises?: LoggedExercise[];
}

export interface SkillTestRecord {
  id: string;
  testId: string;
  name: string;
  category: string;
  unit: string;
  lowerIsBetter: boolean;
  value: number;
  date: string;
}

export interface TrainingSession {
  id: string;
  kind: SessionKind;
  title: string;
  minutes: number;
  xp: number;
  date: string;
  note?: string;
  score?: string;
  matchEvents?: MatchEvent[];
  exercises?: LoggedExercise[];
  voiceNoteId?: string;
}

export interface GpsRoutePoint {
  lat: number;
  lon: number;
  elevationM?: number;
  time?: string;
  speedKmh?: number;
}

export interface GpsActivity {
  id: string;
  fileName: string;
  date: string;
  distanceKm: number;
  durationSeconds: number;
  route: GpsRoutePoint[];
}

export type GoalMetric = 'sessions' | 'minutes' | 'gpsKm' | 'tests';
export type GoalPeriod = 'week' | 'month' | 'all';

export interface CustomGoal {
  id: string;
  title: string;
  metric: GoalMetric;
  period: GoalPeriod;
  target: number;
  createdAt: string;
}

export interface WeeklyPlanItem {
  id: string;
  date: string;
  kind: SessionKind;
  title: string;
  minutes: number;
  /** Filled only when the planned item is explicitly converted into a saved session. */
  completedSessionId?: string;
}

export interface CustomDrill {
  id: string;
  name: string;
  duration: number;
  description: string;
  equipment: string;
  routePoints: Array<[number, number]>;
  cones: Array<[number, number]>;
  createdAt: string;
}

export type PlayerCardTheme = 'field' | 'gold' | 'night';
export interface PlayerCardAppearance {
  photoDataUrl?: string;
  theme: PlayerCardTheme;
  zoom: number;
  positionY: number;
  saturation: number;
  brightness: number;
}

export interface AppData {
  profile: PlayerProfile | null;
  /** Demo fixture is intentionally excluded from achievement/progress claims. */
  demoMode?: boolean;
  sessions: TrainingSession[];
  /** Legacy field retained so existing locally saved data still loads. */
  completedGoals: string[];
  /** Daily check-offs, keyed by local YYYY-MM-DD. */
  goalCompletions?: Record<string, string[]>;
  workoutTemplates?: WorkoutTemplate[];
  skillTests?: SkillTestRecord[];
  /** User-imported GPX tracks remain separate from logged training sessions. */
  gpsActivities?: GpsActivity[];
  weeklyPlan?: WeeklyPlanItem[];
  customGoals?: CustomGoal[];
  playerCard?: PlayerCardAppearance;
  customDrills?: CustomDrill[];
}
