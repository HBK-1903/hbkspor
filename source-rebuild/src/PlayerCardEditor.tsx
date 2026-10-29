import { useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import { DEFAULT_CARD_APPEARANCE, drawPlayerCard, MAX_PLAYER_PHOTO_BYTES, preparePlayerPhoto } from './player-card';
import type { PlayerCardAppearance, PlayerProfile } from './types';

const THEMES = [
  { id: 'field', label: 'Saha yeşili' },
  { id: 'gold', label: 'Şampiyon altın' },
  { id: 'night', label: 'Gece moru' },
] as const;

export function PlayerCardEditor({
  profile, appearance, stats, onSave,
}: {
  profile: PlayerProfile;
  appearance?: PlayerCardAppearance;
  stats: { sessions: number; xp: number; level: number };
  onSave: (appearance: PlayerCardAppearance) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PlayerCardAppearance>(() => ({ ...DEFAULT_CARD_APPEARANCE, ...appearance }));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const update = <K extends keyof PlayerCardAppearance>(key: K, value: PlayerCardAppearance[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const loadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const photoDataUrl = await preparePlayerPhoto(file);
      setDraft((current) => ({ ...current, photoDataUrl }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Fotoğraf işlenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const appearanceStyle = {
    '--card-saturation': draft.saturation,
    '--card-brightness': draft.brightness,
    '--card-zoom': draft.zoom,
    '--card-position-y': `${draft.positionY}%`,
  } as CSSProperties;

  return <section className="card card-editor">
    <div className="section-head compact"><div><p className="eyebrow">KART ATÖLYESİ</p><h2>Oyuncu kartını düzenle</h2></div><span>🎨</span></div>
    <p className="field-help">Fotoğraf bu cihazda işlenir. Kırpma ve renk ayarları kaydedilen görseli bozmaz; istediğin zaman değiştirebilirsin.</p>
    <div className={`player-card-preview player-card-preview--${draft.theme}`} style={appearanceStyle}>
      {draft.photoDataUrl ? <img src={draft.photoDataUrl} alt={`${profile.name} kart fotoğrafı önizlemesi`} /> : <div className="player-card-preview__initial" aria-hidden="true">{profile.name.slice(0, 1).toUpperCase()}</div>}
      <div className="player-card-preview__fade" />
      <div className="player-card-preview__content"><span>HBK · PLAYER CARD</span><strong>{profile.name}</strong><b>{profile.position}</b><small>{stats.sessions} SEANS · {stats.xp} XP · LV.{stats.level}</small></div>
      <div className="player-card-preview__glint" />
    </div>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={loadPhoto} />
    <div className="settings-actions card-photo-actions"><button type="button" className="secondary-button" onClick={() => input.current?.click()} disabled={loading}>{loading ? 'Fotoğraf işleniyor…' : draft.photoDataUrl ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}</button>{draft.photoDataUrl && <button type="button" className="text-button" onClick={() => update('photoDataUrl', undefined)}>Fotoğrafı kaldır</button>}</div>
    {error && <p className="gps-import-error" role="alert">{error}</p>}
    <label className="field-label">Kart teması<select value={draft.theme} onChange={(event) => update('theme', event.target.value as PlayerCardAppearance['theme'])}>{THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}</select></label>
    <RangeControl label="Yakınlaştır" value={draft.zoom} min={1} max={1.7} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update('zoom', value)} />
    <RangeControl label="Dikey kadraj" value={draft.positionY} min={0} max={100} step={1} format={(value) => `${Math.round(value)}%`} onChange={(value) => update('positionY', value)} />
    <RangeControl label="Canlılık" value={draft.saturation} min={0.85} max={1.4} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update('saturation', value)} />
    <RangeControl label="Parlaklık" value={draft.brightness} min={0.85} max={1.2} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update('brightness', value)} />
    <div className="card-editor-actions"><button className="primary-button" type="button" onClick={() => onSave(draft)}>Kart görünümünü kaydet</button><button className="secondary-button" type="button" onClick={() => drawPlayerCard(profile, draft, stats)}>1080×1440 PNG indir</button></div>
    <p className="analysis-disclaimer">JPG / PNG / WebP, en fazla {Math.round(MAX_PLAYER_PHOTO_BYTES / 1024 / 1024)} MB. Önizleme için 1600 px’e kadar yüksek kaliteli kopya hazırlanır. Kart puanı uydurulmaz; yalnızca gerçek seans, XP ve seviye gösterilir.</p>
  </section>;
}

function RangeControl({ label, value, min, max, step, format, onChange }: { label: string; value: number; min: number; max: number; step: number; format: (value: number) => string; onChange: (value: number) => void }) {
  return <label className="range-control"><span><b>{label}</b><small>{format(value)}</small></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
