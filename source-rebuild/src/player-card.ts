import type { PlayerCardAppearance, PlayerProfile, PlayerCardTheme } from './types';

export const DEFAULT_CARD_APPEARANCE: PlayerCardAppearance = {
  theme: 'field', zoom: 1, positionY: 42, saturation: 1.14, brightness: 1.04,
};
export const MAX_PLAYER_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1600;

export async function preparePlayerPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('JPG, PNG veya WebP görseli seç.');
  }
  if (file.size > MAX_PLAYER_PHOTO_BYTES) throw new Error('Fotoğraf 8 MB sınırını aşıyor.');
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imageElement = new Image();
      imageElement.onload = () => resolve(imageElement);
      imageElement.onerror = () => reject(new Error('Fotoğraf açılamadı.'));
      imageElement.src = imageUrl;
    });
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Fotoğraf işleme desteklenmiyor.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export function drawPlayerCard(
  profile: PlayerProfile,
  appearance: PlayerCardAppearance,
  stats: { sessions: number; xp: number; level: number },
): void {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Kart görseli oluşturulamadı.');
  const palette: Record<PlayerCardTheme, { base: string; accent: string; glow: string }> = {
    field: { base: '#101c14', accent: '#b8f34b', glow: '#29472d' },
    gold: { base: '#211a0d', accent: '#f0d27a', glow: '#765a23' },
    night: { base: '#11111e', accent: '#b4a3ff', glow: '#43357c' },
  };
  const colors = palette[appearance.theme];
  const background = context.createLinearGradient(0, 0, 1080, 1440);
  background.addColorStop(0, colors.glow);
  background.addColorStop(.56, colors.base);
  background.addColorStop(1, '#0b100d');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.globalAlpha = .1;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  for (let x = -1000; x < 1600; x += 64) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 900, 1440); context.stroke();
  }
  context.restore();

  const photo = appearance.photoDataUrl;
  if (photo) {
    const image = new Image();
    image.onload = () => {
      const x = 388; const y = 150; const width = 620; const height = 1045;
      const zoom = Math.min(1.7, Math.max(1, appearance.zoom));
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const drawX = x + (width - drawWidth) / 2;
      const overflowY = drawHeight - height;
      const drawY = y - overflowY * Math.min(1, Math.max(0, appearance.positionY / 100));
      context.save();
      context.beginPath(); context.roundRect(x, y, width, height, 36); context.clip();
      context.filter = `saturate(${appearance.saturation}) brightness(${appearance.brightness}) contrast(1.04)`;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      context.filter = 'none';
      const fade = context.createLinearGradient(x - 25, 0, x + 390, 0);
      fade.addColorStop(0, colors.base);
      fade.addColorStop(.48, `${colors.base}d9`);
      fade.addColorStop(1, `${colors.base}00`);
      context.fillStyle = fade; context.fillRect(x - 25, y, width + 25, height);
      const bottomFade = context.createLinearGradient(0, y + 830, 0, y + height);
      bottomFade.addColorStop(0, '#00000000'); bottomFade.addColorStop(1, '#09100dee');
      context.fillStyle = bottomFade; context.fillRect(x, y + 800, width, height - 800);
      context.restore();
      finishCard(context, canvas, profile, stats, colors.accent, colors.base);
    };
    image.onerror = () => { finishCard(context, canvas, profile, stats, colors.accent, colors.base); };
    image.src = photo;
  } else {
    finishCard(context, canvas, profile, stats, colors.accent, colors.base);
  }
}

function finishCard(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  profile: PlayerProfile,
  stats: { sessions: number; xp: number; level: number },
  accent: string,
  base: string,
): void {
  context.strokeStyle = `${accent}cc`; context.lineWidth = 4;
  context.beginPath(); context.roundRect(24, 24, 1032, 1392, 40); context.stroke();
  context.fillStyle = accent; context.font = '800 25px system-ui, sans-serif'; context.letterSpacing = '5px';
  context.fillText('HBK  ·  PLAYER CARD', 74, 92);
  context.fillStyle = '#ffffff'; context.font = '900 76px system-ui, sans-serif'; context.letterSpacing = '-2px';
  const name = profile.name.trim().slice(0, 22);
  context.fillText(name, 76, 500, 820);
  context.fillStyle = accent; context.font = '800 31px system-ui, sans-serif'; context.letterSpacing = '4px';
  context.fillText(profile.position.toLocaleUpperCase('tr-TR'), 80, 555, 560);
  context.fillStyle = '#ffffff'; context.font = '700 26px system-ui, sans-serif'; context.letterSpacing = '0px';
  context.fillText(`BASKIN AYAK  ${profile.dominantFoot}`, 80, 610);
  context.fillStyle = base; context.globalAlpha = .78; context.beginPath(); context.roundRect(72, 1100, 934, 207, 26); context.fill(); context.globalAlpha = 1;
  const metrics = [{ label: 'KAYITLI SEANS', value: String(stats.sessions) }, { label: 'TOPLAM XP', value: String(stats.xp) }, { label: 'SEVİYE', value: String(stats.level) }];
  metrics.forEach((metric, index) => {
    const x = 111 + index * 300;
    context.fillStyle = '#a7b1a8'; context.font = '700 16px system-ui, sans-serif'; context.letterSpacing = '2px'; context.fillText(metric.label, x, 1162);
    context.fillStyle = accent; context.font = '900 52px system-ui, sans-serif'; context.letterSpacing = '0px'; context.fillText(metric.value, x, 1230);
  });
  context.fillStyle = '#b7c1b8'; context.font = '500 16px system-ui, sans-serif'; context.letterSpacing = '1px';
  context.fillText('Bu kart kayıtlı antrenman verilerinden oluşturuldu.', 76, 1360, 930);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hbk-oyuncu-karti-${profile.name.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '-')}.png`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
