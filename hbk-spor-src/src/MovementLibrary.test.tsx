// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import catalogJson from './data/exercise-catalog.json';
import MovementLibrary from './MovementLibrary';
import { getExerciseCoaching, hasExerciseCoaching } from './exercise-coaching';
import { BUILTIN_SCENE_COUNT, BUILTIN_SCENE_IDS } from './MovementIllustration';
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
    expect(BUILTIN_SCENE_COUNT).toBe(81);
    expect([...BUILTIN_SCENE_IDS].sort()).toEqual(catalog.map((exercise) => exercise.id).sort());
    const sceneKeys = Array.from(container.querySelectorAll('.movement-card svg')).map((svg) => svg.getAttribute('data-scene-key'));
    expect(sceneKeys.every(Boolean)).toBe(true);
    const sceneFor = (name: string) => screen.getByText(name).closest('button')?.querySelector('svg')?.getAttribute('data-scene-key');
    expect(sceneFor('Romanian Deadlift (RDL)')).toBe('romanian-deadlift');
    expect(sceneFor('Trap Bar Deadlift')).toBe('trap-deadlift');
    expect(sceneFor('Pec Deck Machine Fly')).toBe('pec-deck');
    expect(sceneFor('Tek Kol Dumbbell Row')).toBe('single-arm-row');
    expect(sceneFor('T-Bar Row')).toBe('tbar-row');
    expect(sceneFor('Chest Supported Dumbbell Row')).toBe('chest-supported-row');
    expect(sceneFor('Cable Lateral Raise')).toBe('cable-lateral-raise');
    expect(sceneFor('Hanging Leg Raise (Barfiks Karın)')).toBe('hanging-leg-raise');
    const graphicIds = Array.from(container.querySelectorAll('.movement-card svg defs [id]')).map((element) => element.id);
    expect(graphicIds).toHaveLength(81 * 4);
    expect(new Set(graphicIds).size).toBe(graphicIds.length);
    expect(container.querySelectorAll('.movement-card svg title')).toHaveLength(81);
    expect(container.querySelectorAll('.movement-card svg desc')).toHaveLength(81);
    expect(screen.getByText('81 hareket gösteriliyor')).toBeTruthy();
  });

  it('adds a controllable full-size movement preview in the selected detail', () => {
    const { container } = render(<MovementLibrary exercises={catalog} workouts={workouts} />);
    fireEvent.click(screen.getByText('Romanian Deadlift (RDL)').closest('button')!);
    const detailSvg = container.querySelector('.movement-detail__visual svg');
    expect(detailSvg?.getAttribute('data-progress')).toBe('0.00');
    expect(container.querySelector('.movement-detail__visual .movement-playback')).not.toBeNull();
    const slider = screen.getByRole('slider', { name: 'Hareket aşaması' });
    fireEvent.change(slider, { target: { value: '0.63' } });
    expect(detailSvg?.getAttribute('data-progress')).toBe('0.63');
    expect(screen.getByText('63%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Başa al' }));
    expect(detailSvg?.getAttribute('data-progress')).toBe('0.00');
    expect(screen.getByText('Başlangıç')).toBeTruthy();
  });

  it('plays the selected movement in a single requestAnimationFrame loop', () => {
    const hadRequestAnimationFrame = 'requestAnimationFrame' in window;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const hadCancelAnimationFrame = 'cancelAnimationFrame' in window;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    let nextFrame: FrameRequestCallback | undefined;
    const cancelFrame = vi.fn();
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1; }) });
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: cancelFrame });
    try {
      render(<MovementLibrary exercises={catalog} workouts={workouts} />);
      fireEvent.click(screen.getByText('Barbell Back Squat').closest('button')!);
      const playButton = screen.getByRole('button', { name: 'Canlandırmayı oynat' });
      fireEvent.click(playButton);
      expect(screen.getByRole('button', { name: 'Canlandırmayı duraklat' }).getAttribute('aria-pressed')).toBe('true');
      act(() => nextFrame?.(0));
      act(() => nextFrame?.(900));
      expect(screen.getByText('50%')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Canlandırmayı duraklat' }));
      expect(screen.getByRole('button', { name: 'Canlandırmayı oynat' }).getAttribute('aria-pressed')).toBe('false');
      expect(cancelFrame).toHaveBeenCalled();
    } finally {
      if (hadRequestAnimationFrame) Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originalRequestAnimationFrame });
      else Reflect.deleteProperty(window, 'requestAnimationFrame');
      if (hadCancelAnimationFrame) Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: originalCancelAnimationFrame });
      else Reflect.deleteProperty(window, 'cancelAnimationFrame');
    }
  });

  it('keeps untouched exercise illustrations stable while opening a guide', () => {
    const { container } = render(<MovementLibrary exercises={catalog} workouts={workouts} />);
    const untouchedCard = screen.getByText('Romanian Deadlift (RDL)').closest('button');
    const untouchedSvg = untouchedCard?.querySelector('svg');
    fireEvent.click(screen.getByText('Barbell Back Squat').closest('button')!);
    expect(untouchedCard?.querySelector('svg')).toBe(untouchedSvg);
    expect(container.querySelectorAll('.movement-card')).toHaveLength(81);
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
