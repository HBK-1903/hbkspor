import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { getMatchMedia } from './audio-notes';
import { MAX_MATCH_MEDIA_ITEMS, prepareMatchMedia } from './match-media';

export interface PendingMatchMedia { id: string; fileName: string; blob: Blob; }

export function MatchMediaPicker({ items, onChange }: { items: PendingMatchMedia[]; onChange: (items: PendingMatchMedia[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length) return;
    setError('');
    if (items.length + files.length > MAX_MATCH_MEDIA_ITEMS) { setError(`Bir maç kaydına en fazla ${MAX_MATCH_MEDIA_ITEMS} fotoğraf / kısa klip ekle.`); return; }
    setBusy(true);
    const additions: PendingMatchMedia[] = [];
    try {
      for (const file of files) additions.push({ id: crypto.randomUUID(), fileName: file.name.slice(0, 100), blob: await prepareMatchMedia(file) });
      onChange([...items, ...additions]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Medya dosyası işlenemedi.');
    } finally { setBusy(false); }
  };
  return <section className="match-media-picker"><div className="match-media-picker__head"><div><b>Maç albümü</b><small>En fazla 6 fotoğraf veya 30 sn’lik klip</small></div><button type="button" className="secondary-button" onClick={() => input.current?.click()} disabled={busy || items.length >= MAX_MATCH_MEDIA_ITEMS}>{busy ? 'İşleniyor…' : '＋ Ekle'}</button></div>
    <input ref={input} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={load} />
    {items.length > 0 && <div className="match-media-grid">{items.map((item) => <article className="match-media-item" key={item.id}><MediaPreview blob={item.blob} label={item.fileName} /><button type="button" className="match-media-remove" aria-label={`${item.fileName} dosyasını çıkar`} onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}>×</button><small>{item.fileName}</small></article>)}</div>}
    {error && <p className="gps-import-error" role="alert">{error}</p>}
    <p className="media-local-note">Dosyalar bu cihazda kalır; JSON/CSV yedeğine eklenmez.</p>
  </section>;
}

export function MatchMediaGallery({ ids }: { ids: string[] }) {
  const [items, setItems] = useState<Array<{ id: string; blob: Blob }>>([]);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(ids.map(async (id) => ({ id, blob: await getMatchMedia(id) }))).then((results) => {
      if (cancelled) return;
      setItems(results.filter((item): item is { id: string; blob: Blob } => item.blob !== null));
      setMissing(results.some((item) => item.blob === null));
    }).catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; };
  }, [ids]);
  if (!items.length) return missing ? <small className="media-missing">Medya dosyaları bu cihazda bulunamadı.</small> : <small className="media-loading">Maç albümü yükleniyor…</small>;
  return <div className="match-media-grid match-media-grid--saved">{items.map((item, index) => <MediaPreview key={item.id} blob={item.blob} label={`Maç anı ${index + 1}`} />)}</div>;
}

function MediaPreview({ blob, label }: { blob: Blob; label: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  if (!url) return <div className="match-media-preview match-media-preview--loading">Yükleniyor</div>;
  return blob.type.startsWith('video/')
    ? <video className="match-media-preview" src={url} controls preload="metadata" aria-label={label} />
    : <img className="match-media-preview" src={url} alt={label} loading="lazy" />;
}
