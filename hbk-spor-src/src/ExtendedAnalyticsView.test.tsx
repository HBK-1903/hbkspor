// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExtendedAnalyticsView from './ExtendedAnalyticsView';
import { currentWeekStart, localDayKey } from './dates';
import type { AnalyticsData } from './types';

afterEach(() => cleanup());

const today = localDayKey();
const gpsRoute = [{ lat: 37.776, lon: 29.086 }, { lat: 37.777, lon: 29.086 }];
const dataset: AnalyticsData = {
  workouts: [{ id: 'workout-1', type: 'gym', date: today, title: 'Kuvvet', durationMinutes: 60, rpeScale: 7, gymExercises: [{ id: 'exercise-entry', exerciseId: 'squat', exerciseName: 'Squat', sets: [{ id: 'set-1', reps: 8, weight: 80 }] }], wellness: { sleep: 4, energy: 4, soreness: 2, stress: 2 } }],
  catalog: [],
  matches: [{ id: 'match-1', date: today, opponent: 'Denizli FK', scoreOur: 2, scoreOpponent: 1, goals: 1, assists: 1, minutesPlayed: 90, yellowCard: true }],
  weeklyPlan: [{ dayOfWeek: new Date(`${today}T12:00:00`).getDay(), type: 'gym', title: 'Kuvvet' }],
  customPlans: [],
  profile: { name: 'Oyuncu' },
  gpsActivities: [{ id: 'gpx-1', date: today, distanceKm: 2, elapsedSeconds: 900, movingSeconds: 840, avgSpeedKmh: 8.6, route: gpsRoute, source: 'gpx', fileName: 'training.gpx' }],
  skillTests: [{ id: 'test-1', name: '20 metre Sprint Süresi', unit: 'sn', category: 'Hız', history: [{ date: today, value: 3.2 }] }],
  wellness: [{ workoutId: 'workout-1', date: today, title: 'Toparlanma check-in', sleep: 4, energy: 4, soreness: 2, stress: 2 }],
  dbVersion: 2,
};

const baseProps = { data: dataset, weeks: 4 as const, setWeeks: vi.fn(), onGpsImport: vi.fn(), onDeleteGps: vi.fn() };

describe('extended performance analytics', () => {
  it('summarizes existing records and compares a planned session with actual activity', () => {
    render(<ExtendedAnalyticsView {...baseProps} section="overview" />);
    expect(screen.getAllByText('420').length).toBeGreaterThan(0);
    expect(screen.getByText('1 / 4')).toBeTruthy();
    expect(screen.getByText('Oyuncu · Genel bakış')).toBeTruthy();
    expect(screen.getByText('Önceki döneme göre')).toBeTruthy();
    expect(screen.getByText('Aktivite takvimi')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'CSV raporu indir' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '8 hf' }));
    expect(baseProps.setWeeks).toHaveBeenCalledWith(8);
  });

  it('shows match cards and transfers selected GPS files to the local importer', () => {
    const onGpsImport = vi.fn();
    const { rerender } = render(<ExtendedAnalyticsView {...baseProps} section="matches" />);
    expect(screen.getByText('Denizli FK')).toBeTruthy();
    expect(screen.getByText(/Sarı kart/)).toBeTruthy();

    rerender(<ExtendedAnalyticsView {...baseProps} section="gps" onGpsImport={onGpsImport} />);
    expect(screen.queryByText('FIT içe aktarıldı')).toBeNull();
    expect(screen.getByText(/GPX içe aktarıldı/)).toBeTruthy();
    const file = new File(['<gpx/>'], 'activity.gpx', { type: 'application/gpx+xml' });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(onGpsImport).toHaveBeenCalledWith(file);
  });

  it('shows self-reported recovery trends, test results and personal bests from existing data', () => {
    const { unmount } = render(<ExtendedAnalyticsView {...baseProps} section="recovery" />);
    expect(screen.getByText('Öz bildirimli toparlanma')).toBeTruthy();
    expect(screen.getByText('Toparlanma eğilimi')).toBeTruthy();
    unmount();

    const { unmount: unmountTests } = render(<ExtendedAnalyticsView {...baseProps} section="tests" />);
    expect(screen.getByText('20 metre Sprint Süresi')).toBeTruthy();
    unmountTests();

    render(<ExtendedAnalyticsView {...baseProps} section="records" />);
    expect(screen.getByText('En ağır set')).toBeTruthy();
    expect(screen.getByText('Bir maçta en çok gol')).toBeTruthy();
  });

  it('keeps the shared plan date anchored to the current Monday week', () => {
    expect(currentWeekStart()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
