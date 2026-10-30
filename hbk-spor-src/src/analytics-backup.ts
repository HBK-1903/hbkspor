import { isGpsActivity } from './analytics-data';
import type { GpsActivity, SetEffortStore } from './types';

export interface ValidatedAnalyticsBackup {
  schemaVersion: 1 | 2 | 3;
  setEffort: SetEffortStore;
  totalSetEntries: number;
  invalidSetEntries: number;
  gpsActivities: GpsActivity[];
  totalGpsEntries: number;
  invalidGpsEntries: number;
  includesGps: boolean;
  gpsMergeable: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/** Parse without writing to storage; callers can show a preview before applying anything. */
export function validateAnalyticsBackup(text: string): ValidatedAnalyticsBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Dosya geçerli JSON değil.');
  }
  if (!isRecord(parsed) || ![1, 2, 3].includes(Number(parsed.schemaVersion)) || !isRecord(parsed.setEffort)) {
    throw new Error('Bu dosya HBK Spor analiz yedeği değil veya biçimi desteklenmiyor.');
  }
  const version = Number(parsed.schemaVersion) as 1 | 2 | 3;
  if (parsed.app !== undefined && parsed.app !== 'hbk-spor-analytics') {
    throw new Error('Yedek başka bir uygulamaya ait görünüyor.');
  }
  const setEffort: SetEffortStore = {};
  const entries = Object.entries(parsed.setEffort);
  let invalidSetEntries = 0;
  for (const [key, value] of entries) {
    if (!key.trim() || key.length > 300 || ['__proto__', 'constructor', 'prototype'].includes(key) || /[\u0000-\u001f]/.test(key) || !isRecord(value)) {
      invalidSetEntries += 1;
      continue;
    }
    const fields = Object.keys(value);
    const rpeOk = value.rpe === undefined || (typeof value.rpe === 'number' && Number.isInteger(value.rpe) && value.rpe >= 1 && value.rpe <= 10);
    const restOk = value.restSeconds === undefined || (typeof value.restSeconds === 'number' && Number.isInteger(value.restSeconds) && value.restSeconds >= 0 && value.restSeconds <= 600);
    if (!fields.length || fields.some((field) => field !== 'rpe' && field !== 'restSeconds') || !rpeOk || !restOk) {
      invalidSetEntries += 1;
      continue;
    }
    setEffort[key] = {
      ...(typeof value.rpe === 'number' ? { rpe: value.rpe } : {}),
      ...(typeof value.restSeconds === 'number' ? { restSeconds: value.restSeconds } : {}),
    };
  }

  const includesGps = Object.prototype.hasOwnProperty.call(parsed, 'gpsImports');
  const rawGps = parsed.gpsImports;
  const gpsRows = Array.isArray(rawGps) ? rawGps : [];
  let invalidGpsEntries = includesGps && !Array.isArray(rawGps) ? 1 : 0;
  const gpsActivities = gpsRows.filter((row): row is GpsActivity => {
    const valid = isGpsActivity(row) && row.source !== 'app';
    if (!valid) invalidGpsEntries += 1;
    return valid;
  });

  return {
    schemaVersion: version,
    setEffort,
    totalSetEntries: entries.length,
    invalidSetEntries,
    gpsActivities,
    totalGpsEntries: gpsRows.length + (includesGps && !Array.isArray(rawGps) ? 1 : 0),
    invalidGpsEntries,
    includesGps,
    gpsMergeable: includesGps && Array.isArray(rawGps),
  };
}
