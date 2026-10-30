import type { AppData, CustomDrill, CustomGoal, ExerciseSet, GpsActivity, GpsRoutePoint, LoggedExercise, MatchEvent, NotificationPreferences, PlayerCardAppearance, PlayerProfile, SessionKind, SkillTestRecord, TrainingSession, WeeklyPlanItem, WorkoutTemplate } from './types';

export const BACKUP_APP_ID = 'hbk-spor-source-rebuild';
export const BACKUP_SCHEMA_VERSION = 1;
const SESSION_KINDS = new Set<SessionKind>(['gym', 'pitch', 'match', 'gps', 'timer', 'recovery', 'rest']);
const MUSCLES = new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core', 'quadriceps', 'hamstrings', 'glutes', 'calves']);
const GOAL_METRICS = new Set(['sessions', 'minutes', 'gpsKm', 'tests']);
const GOAL_PERIODS = new Set(['week', 'month', 'all']);
const EVENT_TYPES = new Set(['goal', 'assist', 'yellow-card', 'red-card', 'substitution', 'note']);

export interface BackupCollectionCount {
  valid: number;
  total: number;
  rejected: number;
}

export interface ValidatedAppBackup {
  data: AppData;
  schemaVersion: number | 'legacy';
  exportedAt?: string;
  counts: Record<string, BackupCollectionCount>;
  invalidFields: string[];
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function string(value: unknown, max = 500): value is string {
  return typeof value === 'string' && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
function id(value: unknown): value is string {
  return string(value, 160) && value.trim().length > 0 && !['__proto__', 'constructor', 'prototype'].includes(value);
}
function finite(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function dateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  const [year, month, day] = value.split('-').map(Number);
  return Number.isFinite(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day;
}
function validStringArray(value: unknown, maxItems: number, maxString = 160): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => string(item, maxString));
}
function uniqueIds<T extends { id: string }>(items: T[]): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}
function validPoint(value: unknown): value is GpsRoutePoint {
  if (!record(value)) return false;
  return finite(value.lat, -90, 90) && finite(value.lon, -180, 180)
    && (value.elevationM === undefined || finite(value.elevationM, -12000, 100000))
    && (value.time === undefined || (string(value.time, 40) && Number.isFinite(Date.parse(value.time))))
    && (value.speedKmh === undefined || finite(value.speedKmh, 0, 500));
}
function validGps(value: unknown): value is GpsActivity {
  if (!record(value)) return false;
  return id(value.id) && string(value.fileName, 120) && dateKey(value.date)
    && finite(value.distanceKm, 0, 10000) && finite(value.durationSeconds, 0, 10_000_000)
    && Array.isArray(value.route) && value.route.length <= 300 && value.route.every(validPoint);
}
function validSet(value: unknown): value is ExerciseSet {
  if (!record(value)) return false;
  return id(value.id) && finite(value.reps, 1, 100) && Number.isInteger(value.reps)
    && finite(value.weightKg, 0, 500) && finite(value.rpe, 1, 10) && Number.isInteger(value.rpe)
    && finite(value.restSeconds, 0, 600) && Number.isInteger(value.restSeconds);
}
function validExercise(value: unknown): value is LoggedExercise {
  if (!record(value)) return false;
  return id(value.id) && id(value.exerciseId) && string(value.name, 120)
    && finite(value.sets, 0, 100) && Number.isInteger(value.sets)
    && finite(value.reps, 0, 1000) && Number.isInteger(value.reps)
    && finite(value.weightKg, 0, 500) && finite(value.rpe, 0, 10)
    && Array.isArray(value.primaryMuscles) && value.primaryMuscles.length <= 10 && value.primaryMuscles.every((muscle) => typeof muscle === 'string' && MUSCLES.has(muscle))
    && Array.isArray(value.secondaryMuscles) && value.secondaryMuscles.length <= 10 && value.secondaryMuscles.every((muscle) => typeof muscle === 'string' && MUSCLES.has(muscle))
    && (value.setDetails === undefined || (Array.isArray(value.setDetails) && value.setDetails.length <= 60 && value.setDetails.every(validSet) && uniqueIds(value.setDetails)));
}
function validEvent(value: unknown): value is MatchEvent {
  if (!record(value)) return false;
  return id(value.id) && finite(value.minute, 0, 150) && Number.isInteger(value.minute)
    && typeof value.type === 'string' && EVENT_TYPES.has(value.type)
    && (value.detail === undefined || string(value.detail, 100));
}
function validSession(value: unknown): value is TrainingSession {
  if (!record(value)) return false;
  return id(value.id) && typeof value.kind === 'string' && SESSION_KINDS.has(value.kind as SessionKind)
    && string(value.title, 120) && dateKey(value.date)
    && finite(value.minutes, 0, 600) && Number.isInteger(value.minutes)
    && finite(value.xp, 0, 10000)
    && (value.note === undefined || string(value.note, 2000))
    && (value.score === undefined || string(value.score, 80))
    && (value.matchEvents === undefined || (Array.isArray(value.matchEvents) && value.matchEvents.length <= 50 && value.matchEvents.every(validEvent) && uniqueIds(value.matchEvents)))
    && (value.exercises === undefined || (Array.isArray(value.exercises) && value.exercises.length <= 50 && value.exercises.every(validExercise) && uniqueIds(value.exercises)))
    && (value.voiceNoteId === undefined || id(value.voiceNoteId))
    && (value.matchMediaIds === undefined || validStringArray(value.matchMediaIds, 6, 160));
}
function validProfile(value: unknown): value is PlayerProfile {
  if (!record(value)) return false;
  return string(value.name, 60) && value.name.trim().length > 0 && string(value.position, 60)
    && (value.dominantFoot === 'Sağ' || value.dominantFoot === 'Sol') && dateKey(value.createdAt);
}
function validTemplate(value: unknown): value is WorkoutTemplate {
  if (!record(value)) return false;
  return id(value.id) && string(value.name, 48) && value.name.trim().length > 0
    && (value.kind === 'gym' || value.kind === 'pitch') && finite(value.minutes, 0, 600) && Number.isInteger(value.minutes)
    && (value.note === undefined || string(value.note, 500))
    && (value.exercises === undefined || (Array.isArray(value.exercises) && value.exercises.length <= 50 && value.exercises.every(validExercise)));
}
function validSkillTest(value: unknown): value is SkillTestRecord {
  if (!record(value)) return false;
  return id(value.id) && id(value.testId) && string(value.name, 100) && string(value.category, 60)
    && string(value.unit, 20) && typeof value.lowerIsBetter === 'boolean' && finite(value.value, 0.000001, 100000) && dateKey(value.date);
}
function validWeeklyPlan(value: unknown): value is WeeklyPlanItem {
  if (!record(value)) return false;
  return id(value.id) && dateKey(value.date) && typeof value.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
    && typeof value.kind === 'string' && SESSION_KINDS.has(value.kind as SessionKind)
    && string(value.title, 120) && finite(value.minutes, 0, 600) && Number.isInteger(value.minutes)
    && (value.recurrenceId === undefined || id(value.recurrenceId))
    && (value.completedSessionId === undefined || id(value.completedSessionId));
}
function validCustomGoal(value: unknown): value is CustomGoal {
  if (!record(value)) return false;
  return id(value.id) && string(value.title, 80) && value.title.trim().length > 0
    && typeof value.metric === 'string' && GOAL_METRICS.has(value.metric)
    && typeof value.period === 'string' && GOAL_PERIODS.has(value.period)
    && finite(value.target, 0.001, 100000) && dateKey(value.createdAt);
}
function validDrillPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && finite(value[0], 0, 320) && finite(value[1], 0, 190);
}
function validDrill(value: unknown): value is CustomDrill {
  if (!record(value)) return false;
  return id(value.id) && string(value.name, 48) && value.name.trim().length > 0
    && finite(value.duration, 1, 120) && Number.isInteger(value.duration)
    && string(value.description, 160) && string(value.equipment, 60) && dateKey(value.createdAt)
    && Array.isArray(value.routePoints) && value.routePoints.length >= 2 && value.routePoints.length <= 12 && value.routePoints.every(validDrillPoint)
    && Array.isArray(value.cones) && value.cones.length <= 30 && value.cones.every(validDrillPoint);
}
function validAppearance(value: unknown): value is PlayerCardAppearance {
  if (!record(value)) return false;
  return (value.theme === 'field' || value.theme === 'gold' || value.theme === 'night')
    && finite(value.zoom, 1, 2.5) && finite(value.positionY, 0, 100)
    && finite(value.saturation, 0, 2) && finite(value.brightness, 0.5, 1.5)
    && (value.photoDataUrl === undefined || (typeof value.photoDataUrl === 'string' && value.photoDataUrl.length <= 6_000_000 && /^data:image\/(jpeg|png|webp);base64,/.test(value.photoDataUrl)));
}
function validPreferences(value: unknown): value is NotificationPreferences {
  if (!record(value)) return false;
  return typeof value.enabled === 'boolean' && typeof value.planReminders === 'boolean'
    && [0, 15, 30, 60].includes(Number(value.leadMinutes))
    && typeof value.dailyReminder === 'boolean' && typeof value.weeklySummary === 'boolean'
    && typeof value.dailyTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.dailyTime);
}

function readCollection<T>(
  source: Record<string, unknown>, key: string, guard: (value: unknown) => value is T, limit: number,
  counts: Record<string, BackupCollectionCount>, invalidFields: string[],
): T[] {
  const value = source[key];
  if (value === undefined) { counts[key] = { valid: 0, total: 0, rejected: 0 }; return []; }
  if (!Array.isArray(value)) {
    counts[key] = { valid: 0, total: 1, rejected: 1 };
    invalidFields.push(key);
    return [];
  }
  const validRows: T[] = [];
  const seen = new Set<string>();
  for (const candidate of value.slice(0, limit)) {
    if (!guard(candidate)) continue;
    const rowId = record(candidate) && typeof candidate.id === 'string' ? candidate.id : null;
    if (rowId && seen.has(rowId)) continue;
    if (rowId) seen.add(rowId);
    validRows.push(candidate);
  }
  const rejected = value.length - validRows.length;
  counts[key] = { valid: validRows.length, total: value.length, rejected };
  if (rejected) invalidFields.push(key);
  return validRows;
}

/** Validate a JSON backup without writing to local storage. Legacy flat AppData exports remain supported. */
export function validateAppBackup(text: string): ValidatedAppBackup {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error('Dosya geçerli JSON biçiminde değil.'); }
  if (!record(parsed)) throw new Error('Yedek dosyasının ana yapısı geçersiz.');
  const isEnvelope = Object.prototype.hasOwnProperty.call(parsed, 'app') || Object.prototype.hasOwnProperty.call(parsed, 'data');
  if (isEnvelope && (parsed.app !== BACKUP_APP_ID || parsed.schemaVersion !== BACKUP_SCHEMA_VERSION || !record(parsed.data))) {
    throw new Error('Yedek HBK Spor prototipine ait değil veya sürümü desteklenmiyor.');
  }
  const source = (isEnvelope ? parsed.data : parsed) as Record<string, unknown>;
  if (!Array.isArray(source.sessions)) throw new Error('Yedekte antrenman kayıtları listesi bulunamadı.');
  const counts: Record<string, BackupCollectionCount> = {};
  const invalidFields: string[] = [];
  const sessions = readCollection(source, 'sessions', validSession, 10000, counts, invalidFields);
  const workoutTemplates = readCollection(source, 'workoutTemplates', validTemplate, 20, counts, invalidFields);
  const skillTests = readCollection(source, 'skillTests', validSkillTest, 5000, counts, invalidFields);
  const gpsActivities = readCollection(source, 'gpsActivities', validGps, 30, counts, invalidFields);
  const weeklyPlan = readCollection(source, 'weeklyPlan', validWeeklyPlan, 1000, counts, invalidFields);
  const customGoals = readCollection(source, 'customGoals', validCustomGoal, 100, counts, invalidFields);
  const customDrills = readCollection(source, 'customDrills', validDrill, 20, counts, invalidFields);
  const profile = source.profile === null || source.profile === undefined ? null : validProfile(source.profile) ? source.profile : null;
  if (source.profile !== null && source.profile !== undefined && !profile) invalidFields.push('profile');
  let completedGoals: string[] = [];
  if (source.completedGoals !== undefined) {
    if (Array.isArray(source.completedGoals)) {
      completedGoals = source.completedGoals.slice(0, 1000).filter((item): item is string => id(item));
      if (completedGoals.length !== source.completedGoals.length) invalidFields.push('completedGoals');
    } else invalidFields.push('completedGoals');
  }
  const goalCompletions: Record<string, string[]> = {};
  if (source.goalCompletions !== undefined) {
    if (record(source.goalCompletions)) {
      const entries = Object.entries(source.goalCompletions);
      if (entries.length > 4000) invalidFields.push('goalCompletions');
      for (const [key, value] of entries.slice(0, 4000)) {
        if (dateKey(key) && Array.isArray(value) && value.length <= 100 && value.every((item) => id(item))) goalCompletions[key] = [...new Set(value as string[])];
        else invalidFields.push('goalCompletions');
      }
    } else invalidFields.push('goalCompletions');
  }
  const skillTestTargets: Record<string, number> = {};
  if (source.skillTestTargets !== undefined) {
    if (record(source.skillTestTargets)) {
      const entries = Object.entries(source.skillTestTargets);
      if (entries.length > 100) invalidFields.push('skillTestTargets');
      for (const [key, value] of entries.slice(0, 100)) {
        if (id(key) && finite(value, 0.001, 100000)) skillTestTargets[key] = value;
        else invalidFields.push('skillTestTargets');
      }
    } else invalidFields.push('skillTestTargets');
  }
  const notificationPreferences = validPreferences(source.notificationPreferences) ? source.notificationPreferences : undefined;
  if (source.notificationPreferences !== undefined && !notificationPreferences) invalidFields.push('notificationPreferences');
  const playerCard = source.playerCard === undefined ? undefined : validAppearance(source.playerCard) ? source.playerCard : undefined;
  if (source.playerCard !== undefined && !playerCard) invalidFields.push('playerCard');
  let notificationSentKeys: string[] = [];
  if (source.notificationSentKeys !== undefined) {
    if (Array.isArray(source.notificationSentKeys)) {
      notificationSentKeys = [...new Set(source.notificationSentKeys.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 300))].slice(-500);
      if (notificationSentKeys.length !== Math.min(source.notificationSentKeys.length, 500)) invalidFields.push('notificationSentKeys');
    } else invalidFields.push('notificationSentKeys');
  }
  if (source.demoMode !== undefined && typeof source.demoMode !== 'boolean') invalidFields.push('demoMode');

  const data: AppData = {
    profile, demoMode: source.demoMode === true, sessions,
    completedGoals: completedGoals.filter((item) => id(item)), goalCompletions,
    workoutTemplates, skillTests, skillTestTargets, gpsActivities, weeklyPlan,
    customGoals, customDrills, playerCard, notificationPreferences, notificationSentKeys,
  };
  return {
    data, schemaVersion: isEnvelope ? BACKUP_SCHEMA_VERSION : 'legacy',
    exportedAt: isEnvelope && typeof parsed.exportedAt === 'string' && Number.isFinite(Date.parse(parsed.exportedAt)) ? parsed.exportedAt : undefined,
    counts, invalidFields: [...new Set(invalidFields)],
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const records = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => records.set(item.id, item));
  return [...records.values()];
}

export function mergeAppData(current: AppData, incoming: AppData): AppData {
  const goalCompletions: Record<string, string[]> = {};
  const dates = new Set([...Object.keys(current.goalCompletions ?? {}), ...Object.keys(incoming.goalCompletions ?? {})]);
  for (const date of dates) goalCompletions[date] = [...new Set([...(current.goalCompletions?.[date] ?? []), ...(incoming.goalCompletions?.[date] ?? [])])];
  return {
    profile: current.profile ?? incoming.profile,
    demoMode: current.demoMode === true && incoming.demoMode === true,
    sessions: mergeById(current.sessions, incoming.sessions),
    completedGoals: [...new Set([...current.completedGoals, ...incoming.completedGoals])],
    goalCompletions,
    workoutTemplates: mergeById(current.workoutTemplates ?? [], incoming.workoutTemplates ?? []),
    skillTests: mergeById(current.skillTests ?? [], incoming.skillTests ?? []),
    skillTestTargets: { ...(current.skillTestTargets ?? {}), ...(incoming.skillTestTargets ?? {}) },
    gpsActivities: mergeById(current.gpsActivities ?? [], incoming.gpsActivities ?? []),
    weeklyPlan: mergeById(current.weeklyPlan ?? [], incoming.weeklyPlan ?? []),
    customGoals: mergeById(current.customGoals ?? [], incoming.customGoals ?? []),
    customDrills: mergeById(current.customDrills ?? [], incoming.customDrills ?? []),
    playerCard: current.playerCard ?? incoming.playerCard,
    notificationPreferences: incoming.notificationPreferences ?? current.notificationPreferences,
    notificationSentKeys: [...new Set([...(current.notificationSentKeys ?? []), ...(incoming.notificationSentKeys ?? [])])].slice(-500),
  };
}
