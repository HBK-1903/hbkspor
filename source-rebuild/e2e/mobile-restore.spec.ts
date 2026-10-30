import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test, devices } from '@playwright/test';
import { createMediaBackup } from '../src/media-backup';

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
const PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p7sAAAAASUVORK5CYII=';

function deviceForProject(projectName: string) {
  return projectName.startsWith('Mobile Chrome') ? devices['Pixel 7'] : devices['iPhone 13'];
}

async function openSettings(page: import('@playwright/test').Page) {
  await page.locator('nav.bottom-nav button').filter({ hasText: 'Ayarlar' }).click();
  await expect(page.getByRole('heading', { name: 'Ayarlar' })).toBeVisible();
}

test('restores JSON records and their media on a clean mobile browser profile', async ({ browser }, testInfo) => {
  test.setTimeout(75_000);
  const jsonPath = testInfo.outputPath('hbk-records.json');
  const mediaPath = testInfo.outputPath('hbk-media.hbm');
  await mkdir(testInfo.outputDir, { recursive: true });
  await writeFile(jsonPath, JSON.stringify({
    app: 'hbk-spor-source-rebuild', schemaVersion: 1, exportedAt: new Date().toISOString(),
    counts: { sessions: APP_DATA.sessions.length, gpsActivities: 0, skillTests: 0 }, data: APP_DATA,
  }));
  const pngBytes = Buffer.from(PIXEL_PNG_BASE64, 'base64');
  const archive = await createMediaBackup([
    { store: 'voiceNotes', id: VOICE_ID, blob: new Blob(['mobile voice-note payload'], { type: 'audio/webm;codecs=opus' }) },
    { store: 'matchMedia', id: PHOTO_ID, blob: new Blob([pngBytes], { type: 'image/png' }) },
  ]);
  await writeFile(mediaPath, Buffer.from(await archive.arrayBuffer()));

  const context = await browser.newContext({ ...deviceForProject(testInfo.project.name), acceptDownloads: true });
  try {
    const page = await context.newPage();
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
    await context.close();
  }
});
