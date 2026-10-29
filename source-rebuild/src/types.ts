export type SessionKind = 'gym' | 'pitch' | 'match' | 'gps' | 'timer' | 'recovery' | 'rest';

export interface PlayerProfile {
  name: string;
  position: string;
  dominantFoot: 'Sağ' | 'Sol';
  createdAt: string;
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
}

export interface AppData {
  profile: PlayerProfile | null;
  sessions: TrainingSession[];
  completedGoals: string[];
}
