// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import MuscleAnalyticsLauncher from './MuscleAnalyticsLauncher';

function installLegacyAppShell() {
  document.body.innerHTML = `
    <div id="root">
      <nav aria-label="Ana gezinme">
        <button aria-current="page"><span>Ana</span></button>
        <button><span>Analiz</span></button>
        <button><span>Daha</span></button>
      </nav>
      <main id="legacy-page">
        <header><div><h1>Ana</h1></div></header>
      </main>
    </div>
    <div id="muscle-extension-root"></div>
  `;
  return {
    page: document.querySelector<HTMLElement>('#legacy-page')!,
    navButtons: document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Ana gezinme"] button'),
    mount: document.querySelector<HTMLElement>('#muscle-extension-root')!,
  };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('kas analizi entry placement', () => {
  it('shows the entry only within the active Analiz page, never on Ana', async () => {
    const { page, navButtons, mount } = installLegacyAppShell();
    render(<MuscleAnalyticsLauncher />, { container: mount });

    expect(screen.queryByRole('button', { name: 'Kas analizi raporunu aç' })).toBeNull();

    await act(async () => {
      navButtons[0].removeAttribute('aria-current');
      navButtons[1].setAttribute('aria-current', 'page');
      page.innerHTML = '<header id="analysis-header"><div><h1>Analiz</h1><p>Neyi geliştiriyorum?</p></div><button>Tüm Kayıtlar</button></header><div id="analysis-content">Analiz içeriği</div>';
    });

    const entry = await screen.findByRole('button', { name: 'Kas analizi raporunu aç' });
    expect(entry.getAttribute('aria-haspopup')).toBe('dialog');
    expect(entry.parentElement?.previousElementSibling?.id).toBe('analysis-header');

    await act(async () => {
      navButtons[1].removeAttribute('aria-current');
      navButtons[0].setAttribute('aria-current', 'page');
      page.innerHTML = '<header><div><h1>Ana</h1></div></header><div>Ana sayfa</div>';
    });

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Kas analizi raporunu aç' })).toBeNull());
  });
});
