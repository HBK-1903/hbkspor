import { expect, test, devices, type BrowserContext } from '@playwright/test';

const TODAY = new Date().toISOString().slice(0, 10);
const SESSION_ID = 'mobile-restore-session';
const VOICE_ID = 'mobile-restore-voice';
const PHOTO_ID = 'mobile-restore-photo';
const APP_DATA = {
  profile: { name: 'Yedek Oyuncusu', position: 'Orta saha', dominantFoot: 'Sağ', createdAt: TODAY },
  demoMode: false,
  sessions: [{ id: SESSION_ID, kind: 'match', title: 'Mobil yedek seansı', minutes: 90, xp: 50, date: TODAY, voiceNoteId: VOICE_ID, matchMediaIds: [PHOTO_ID] }],
  completedGoals: [], goalCompletions: {}, workoutTemplates: [], skillTests: [], skillTestTargets: {},
  gpsActivities: [], weeklyPlan: [], customGoals: [], customDrills: [],
};
declare global {
  interface Window { __hbkE2eMediaSeeded?: boolean; }
}

function deviceForProject(projectName: string) {
  return projectName.startsWith('Mobile Chrome') ? devices['Pixel 7'] : devices['iPhone 13'];
}

async function openSettings(page: import('@playwright/test').Page) {
  await page.locator('nav.bottom-nav button').filter({ hasText: 'Ayarlar' }).click();
  await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();
}

test('restores JSON records and their media on a clean mobile browser profile', async ({ browser }, testInfo) => {
  const device = deviceForProject(testInfo.project.name);
  const contexts: BrowserContext[] = [];
  try {
    const sourceContext = await browser.newContext({ ...device, acceptDownloads: true });
    contexts.push(sourceContext);
    const sourcePage = await sourceContext.newPage();
    await sourcePage.addInitScript((appData) => {
      localStorage.setItem('hbk_spor_rebuild_v1', JSON.stringify(appData));
      const request = indexedDB.open('hbk_spor_media_v1', 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('voiceNotes')) request.result.createObjectStore('voiceNotes');
        if (!request.result.objectStoreNames.contains('matchMedia')) request.result.createObjectStore('matchMedia');
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['voiceNotes', 'matchMedia'], 'readwrite');
        transaction.objectStore('voiceNotes').put(new Blob(['mobile voice-note payload'], { type: 'audio/webm;codecs=opus' }), 'mobile-restore-voice');
        const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p7sAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));
        transaction.objectStore('matchMedia').put(new Blob([bytes], { type: 'image/png' }), 'mobile-restore-photo');
        transaction.oncomplete = () => { database.close(); window.__hbkE2eMediaSeeded = true; };
        transaction.onerror = () => { database.close(); window.__hbkE2eMediaSeeded = false; };
      };
      request.onerror = () => { window.__hbkE2eMediaSeeded = false; };
    }, APP_DATA);
    await sourcePage.goto('/');
    await sourcePage.waitForFunction(() => window.__hbkE2eMediaSeeded === true);
    await openSettings(sourcePage);

    const jsonPath = testInfo.outputPath('hbk-records.json');
    const jsonDownloadPromise = sourcePage.waitForEvent('download');
    await sourcePage.getByRole('button', { name: 'JSON yedeği al' }).click();
    await (await jsonDownloadPromise).saveAs(jsonPath);

    const mediaPath = testInfo.outputPath('hbk-media.hbm');
    const mediaDownloadPromise = sourcePage.waitForEvent('download');
    await sourcePage.getByRole('button', { name: 'Medya yedeğini indir' }).click();
    await (await mediaDownloadPromise).saveAs(mediaPath);
    await sourceContext.close();
    contexts.splice(contexts.indexOf(sourceContext), 1);

    // A brand-new browser context has empty localStorage and IndexedDB, like a fresh device/browser profile.
    const restoreContext = await browser.newContext({ ...device, acceptDownloads: true });
    contexts.push(restoreContext);
    const page = await restoreContext.newPage();
    page.on('dialog', (dialog) => void dialog.accept());
    await page.goto('/');
    await page.getByRole('button', { name: 'Profilimi oluştur' }).click();
    await page.getByLabel('Ad soyad').fill('Temiz cihaz');
    await page.getByRole('button', { name: /Profilimi kaydet/ }).click();
    await openSettings(page);

    await page.locator('.backup-restore input[type="file"]').setInputFiles(jsonPath);
    await expect(page.locator('.backup-restore .backup-preview')).toBeVisible();
    await page.locator('.backup-restore').getByRole('button', { name: 'Yedekle değiştir' }).click();
    await expect(page.getByRole('heading', { name: 'Yedek ve depolama' })).toBeVisible();

    await page.locator('.media-backup input[type="file"]').setInputFiles(mediaPath);
    await expect(page.locator('.media-backup .backup-preview')).toContainText('1 ses notu');
    await expect(page.locator('.media-backup .backup-preview')).toContainText('1 maç medya dosyası');
    await page.locator('.media-backup').getByRole('button', { name: 'Medya dosyalarını geri yükle' }).click();

    await page.locator('nav.bottom-nav button').filter({ hasText: 'Ana sayfa' }).click();
    await expect(page.locator('.session-row')).toContainText('Mobil yedek seansı');
    await expect(page.locator('audio.voice-audio-playback')).toBeVisible();
    await expect(page.locator('img[alt="Maç anı 1"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const image = document.querySelector<HTMLImageElement>('img[alt="Maç anı 1"]');
      return image?.complete && image.naturalWidth > 0;
    })).toBe(true);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
