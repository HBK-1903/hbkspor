export const MAX_MATCH_MEDIA_ITEMS = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;
const MAX_IMAGE_DIMENSION = 1600;

export async function prepareMatchMedia(file: File): Promise<Blob> {
  if (file.type.startsWith('image/')) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Fotoğraf için JPG, PNG veya WebP kullan.');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Fotoğraf 8 MB sınırını aşıyor.');
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error('Fotoğraf açılamadı.')); element.src = url;
      });
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Fotoğraf işleme desteklenmiyor.');
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Fotoğraf optimize edilemedi.')), 'image/jpeg', .9));
    } finally { URL.revokeObjectURL(url); }
  }

  if (!['video/mp4', 'video/webm'].includes(file.type)) throw new Error('Kısa klip için MP4 veya WebM seç.');
  if (file.size > MAX_VIDEO_BYTES) throw new Error('Video klip 25 MB sınırını aşıyor.');
  const url = URL.createObjectURL(file);
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video'); video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error('Video bilgisi okunamadı.'));
      video.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_VIDEO_SECONDS) throw new Error('Klip 30 saniyeden kısa olmalı.');
    return file.slice(0, file.size, file.type);
  } finally { URL.revokeObjectURL(url); }
}
