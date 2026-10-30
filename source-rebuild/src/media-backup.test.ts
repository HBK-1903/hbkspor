import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { exportLocalMediaBackup, getMatchMedia, getVoiceNote, restoreLocalMediaBackup, saveMatchMedia, saveVoiceNote } from './audio-notes';
import { createMediaBackup, parseMediaBackup, verifyMediaBackup, type MediaBackupSourceItem } from './media-backup';

const DB_NAME = 'hbk_spor_media_v1';
const fixedDate = '2026-10-30T12:00:00.000Z';
const audio = (content: string) => new Blob([content], { type: 'audio/webm' });
const image = (content: string) => new Blob([content], { type: 'image/jpeg' });

async function clearDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database remained open.'));
  });
}

afterEach(async () => { await clearDatabase(); });

describe('portable local media backups', () => {
  it('round-trips voice notes and match photos with SHA-256 checksums, types, counts, and bytes intact', async () => {
    const blob = await createMediaBackup([
      { store: 'voiceNotes', id: 'voice-1', blob: audio('voice data') },
      { store: 'matchMedia', id: 'photo-1', blob: image('image data') },
    ], fixedDate);
    const parsed = await verifyMediaBackup(parseMediaBackup(await blob.arrayBuffer()));
    expect(parsed.voiceNotes).toBe(1);
    expect(parsed.matchMedia).toBe(1);
    expect(parsed.items.map(({ id, type }) => [id, type])).toEqual([['voice-1', 'audio/webm'], ['photo-1', 'image/jpeg']]);
    expect(parsed.items.every((item) => /^[a-f0-9]{64}$/.test(item.sha256))).toBe(true);
    for (const item of parsed.items) {
      const start = parsed.payloadOffset + item.offset;
      const actual = new TextDecoder().decode(parsed.payload.slice(start, start + item.size));
      expect(actual).toBe(item.store === 'voiceNotes' ? 'voice data' : 'image data');
    }
  });

  it('rejects foreign files, duplicate IDs, wrong MIME types, and altered offsets', async () => {
    expect(() => parseMediaBackup(new TextEncoder().encode('not a media backup').buffer)).toThrow('biçiminde değil');
    const duplicate: MediaBackupSourceItem[] = [
      { store: 'voiceNotes', id: 'same-id', blob: audio('a') },
      { store: 'voiceNotes', id: 'same-id', blob: audio('b') },
    ];
    await expect(createMediaBackup(duplicate, fixedDate)).rejects.toThrow('yinelenen');
    await expect(createMediaBackup([{ store: 'voiceNotes', id: 'bad', blob: image('not audio') }], fixedDate)).rejects.toThrow('desteklenmeyen');
    await expect(createMediaBackup([{ store: 'voiceNotes', id: 'codec-audio', blob: new Blob(['voice'], { type: 'audio/webm;codecs=opus' }) }], fixedDate)).resolves.toBeInstanceOf(Blob);

    const archive = await (await createMediaBackup([{ store: 'voiceNotes', id: 'voice-1', blob: audio('voice') }], fixedDate)).arrayBuffer();
    const bytes = new Uint8Array(archive);
    const manifestLength = new DataView(archive).getUint32(8, false);
    const manifest = new TextDecoder().decode(bytes.slice(12, 12 + manifestLength)).replace('"offset":0', '"offset":1');
    const manifestBytes = new TextEncoder().encode(manifest);
    const damaged = new Uint8Array(12 + manifestBytes.length + archive.byteLength - 12 - manifestLength);
    damaged.set(bytes.slice(0, 12), 0);
    damaged.set(manifestBytes, 12);
    damaged.set(bytes.slice(12 + manifestLength), 12 + manifestBytes.length);
    new DataView(damaged.buffer).setUint32(8, manifestBytes.length, false);
    expect(() => parseMediaBackup(damaged.buffer)).toThrow('bozuk dosya bilgisi');
  });

  it('detects changed media bytes before any IndexedDB write', async () => {
    await saveVoiceNote('existing', audio('keep me'));
    const original = await (await createMediaBackup([{ store: 'voiceNotes', id: 'voice-1', blob: audio('voice') }], fixedDate)).arrayBuffer();
    const damaged = new Uint8Array(original.slice(0));
    damaged[12 + new DataView(original).getUint32(8, false)] ^= 1;
    await expect(verifyMediaBackup(parseMediaBackup(damaged.buffer))).rejects.toThrow('bozuk veya değişmiş');
    await expect(restoreLocalMediaBackup(damaged.buffer)).rejects.toThrow('bozuk veya değişmiş');
    expect(await (await getVoiceNote('existing'))?.text()).toBe('keep me');
    expect(await getVoiceNote('voice-1')).toBeNull();
  });

  it('exports local IndexedDB media and restores by ID without deleting unrelated files', async () => {
    await saveVoiceNote('voice-1', audio('old voice'));
    await saveVoiceNote('keep-voice', audio('keep voice'));
    await saveMatchMedia('photo-1', image('old photo'));
    const archive = await createMediaBackup([
      { store: 'voiceNotes', id: 'voice-1', blob: audio('new voice') },
      { store: 'voiceNotes', id: 'new-voice', blob: audio('added voice') },
      { store: 'matchMedia', id: 'photo-1', blob: image('new photo') },
    ], fixedDate);

    const result = await restoreLocalMediaBackup(await archive.arrayBuffer());
    expect(result).toMatchObject({ voiceNotes: 2, matchMedia: 1 });
    expect(await (await getVoiceNote('voice-1'))?.text()).toBe('new voice');
    expect(await (await getVoiceNote('new-voice'))?.text()).toBe('added voice');
    expect(await (await getVoiceNote('keep-voice'))?.text()).toBe('keep voice');
    expect(await (await getMatchMedia('photo-1'))?.text()).toBe('new photo');

    const exported = parseMediaBackup(await exportLocalMediaBackup().then((media) => media.arrayBuffer()));
    await verifyMediaBackup(exported);
    expect(exported.voiceNotes).toBe(3);
    expect(exported.matchMedia).toBe(1);
  });
});
