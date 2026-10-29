// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import catalogJson from './data/exercise-catalog.json';
import MovementLibrary from './MovementLibrary';
import { getExerciseCoaching, hasExerciseCoaching } from './exercise-coaching';
import type { ExerciseDefinition, LegacyWorkout } from './types';

const catalog = catalogJson as ExerciseDefinition[];
const workouts: LegacyWorkout[] = [];

afterEach(cleanup);

describe('movement library', () => {
  it('has complete, distinct authored coaching for all 81 built-in exercises', () => {
    expect(catalog.filter(hasExerciseCoaching)).toHaveLength(81);
    const authoredSteps = catalog.map((exercise) => getExerciseCoaching(exercise)?.steps.join(' '));
    expect(new Set(authoredSteps).size).toBe(81);
    for (const exercise of catalog) {
      const coaching = getExerciseCoaching(exercise);
      expect(coaching?.setup.length).toBeGreaterThan(20);
      expect(coaching?.steps.every((step) => step.length > 20)).toBe(true);
      expect(coaching?.watchOut.length).toBeGreaterThan(20);
      expect(coaching?.easier.length).toBeGreaterThan(10);
      expect(coaching?.harder.length).toBeGreaterThan(10);
    }
  });

  it('renders a visual guide for every catalog movement', () => {
    const { container } = render(<MovementLibrary exercises={catalog} workouts={workouts} />);
    expect(container.querySelectorAll('.movement-card')).toHaveLength(81);
    expect(container.querySelectorAll('.movement-card svg[role="img"]')).toHaveLength(81);
    const gradientIds = Array.from(container.querySelectorAll('linearGradient')).map((gradient) => gradient.id);
    expect(new Set(gradientIds).size).toBe(81);
    expect(screen.getByText('81 hareket gösteriliyor')).toBeTruthy();
  });

  it('filters by category and opens the selected exercise steps', () => {
    const { container } = render(<MovementLibrary exercises={catalog} workouts={workouts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bacak & Kalça' }));
    expect(container.querySelectorAll('.movement-card')).toHaveLength(16);
    expect(screen.getByText('16 hareket gösteriliyor')).toBeTruthy();

    const card = screen.getByText('Romanian Deadlift (RDL)').closest('button');
    expect(card).not.toBeNull();
    fireEvent.click(card!);
    expect(screen.getByRole('heading', { name: 'Romanian Deadlift (RDL)' })).toBeTruthy();
    expect(screen.getAllByText('Kalça menteşesi').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/barı bacaklara yakın tut/)).toBeTruthy();
    expect(screen.getByText('Harekete özel rehber')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sık hata / dikkat' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Kolaylaştır' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'İlerlet' })).toBeTruthy();
  });

  it('uses the specific guides for common special-case movements', () => {
    const { container } = render(<MovementLibrary exercises={catalog} workouts={workouts} />);
    const footerFor = (name: string) => {
      const card = screen.getByText(name).closest('button');
      return card?.querySelector('.movement-card__footer')?.textContent;
    };
    expect(footerFor('Barbell / Dumbbell Shrug')).toContain('Omuz silkme');
    expect(footerFor('Upright Row (Çeneye Çekiş)')).toContain('Omuz kaldırış');
    expect(footerFor('Cossack Squat (Yanal Mobilite)')).toContain('Çömelme');
    expect(footerFor('Med Ball Rotational Slam (Top Fırlatma)')).toContain('Dönüş / anti-dönüş');
    expect(container.querySelectorAll('.movement-card')).toHaveLength(81);
  });

  it('labels user-added movements as a generic template until authored guidance exists', () => {
    const custom: ExerciseDefinition = { id: 'user-custom-1', name: 'Özel saha hareketi', category: 'Özel' };
    render(<MovementLibrary exercises={[custom]} workouts={workouts} />);
    fireEvent.click(screen.getByText('Özel saha hareketi').closest('button')!);
    expect(screen.getByText('Genel hareket şablonu')).toBeTruthy();
    expect(screen.getByText(/ayrı bir kurulum notu henüz yok/)).toBeTruthy();
  });

  it('searches exercise names and clears a detail that no longer matches', () => {
    const { container } = render(<MovementLibrary exercises={catalog} workouts={workouts} />);
    const initialCard = screen.getByText('Barbell Back Squat').closest('button');
    expect(initialCard).not.toBeNull();
    fireEvent.click(initialCard!);
    expect(screen.getByRole('heading', { name: 'Barbell Back Squat' })).toBeTruthy();
    expect(initialCard?.getAttribute('aria-expanded')).toBe('true');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Hareket ara' }), { target: { value: 'Pallof' } });
    expect(screen.queryByRole('heading', { name: 'Barbell Back Squat' })).toBeNull();
    expect(container.querySelectorAll('.movement-card')).toHaveLength(1);
    expect(screen.getByText('Pallof Press (Anti-Rotasyon)')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Hareket ara' }), { target: { value: 'bulunmayan hareket' } });
    expect(screen.getByText('Hareket bulunamadı')).toBeTruthy();
  });
});
