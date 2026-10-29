import { useEffect, useState } from 'react';
import { getVoiceNote } from './audio-notes';

export function VoiceNotePlayback({ id }: { id: string }) {
  const [url, setUrl] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    getVoiceNote(id).then((blob) => {
      if (cancelled) return;
      if (!blob) { setMissing(true); return; }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (!cancelled) setMissing(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  if (missing) return <small className="voice-note-missing">Ses bu cihazda bulunamadı.</small>;
  if (!url) return <small className="voice-note-loading">Sesli not yükleniyor…</small>;
  return <audio className="voice-audio-playback" controls preload="none" src={url}>Tarayıcın ses oynatmayı desteklemiyor.</audio>;
}
