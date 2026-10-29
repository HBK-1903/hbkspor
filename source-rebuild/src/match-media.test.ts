import { describe, expect, it } from 'vitest';
import { MAX_MATCH_MEDIA_ITEMS, prepareMatchMedia } from './match-media';

describe('match album media limits', () => {
  it('caps attachments per match at six', () => expect(MAX_MATCH_MEDIA_ITEMS).toBe(6));
  it('rejects unsupported files before browser decoding', async () => {
    const file = { type: 'image/gif', size: 12 } as File;
    await expect(prepareMatchMedia(file)).rejects.toThrow('JPG, PNG veya WebP');
  });
  it('rejects oversized video clips before metadata parsing', async () => {
    const file = { type: 'video/mp4', size: 26 * 1024 * 1024 } as File;
    await expect(prepareMatchMedia(file)).rejects.toThrow('25 MB sınırını');
  });
});
