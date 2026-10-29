import { useEffect, useRef, useState } from 'react';

const MAX_RECORD_SECONDS = 60;
const MAX_AUDIO_BYTES = 1_500_000;

export function VoiceNoteRecorder({ onReady, onRecordingChange }: { onReady: (blob: Blob | null) => void; onRecordingChange: (recording: boolean) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const stopRef = useRef<() => void>(() => {});

  const stop = () => {
    if (recorder.current?.state === 'recording') {
      recorder.current.stop();
      return;
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setRecording(false);
    onRecordingChange(false);
  };
  stopRef.current = stop;

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((previous) => {
      if (previous + 1 >= MAX_RECORD_SECONDS) {
        window.setTimeout(() => stopRef.current(), 0);
        return MAX_RECORD_SECONDS;
      }
      return previous + 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Bu tarayıcı ses kaydını desteklemiyor.');
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl('');
    onReady(null);
    setSeconds(0);
    chunks.current = [];
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mediaStream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const mediaRecorder = mimeType ? new MediaRecorder(mediaStream, { mimeType }) : new MediaRecorder(mediaStream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onerror = () => setError('Kayıt sırasında ses alınamadı.');
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
        setRecording(false);
        onRecordingChange(false);
        if (!blob.size) { setError('Ses kaydı boş çıktı; mikrofon iznini kontrol et.'); return; }
        if (blob.size > MAX_AUDIO_BYTES) { setError('Ses notu çok büyük; 60 saniyeden kısa kayıt dene.'); return; }
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onReady(blob);
      };
      mediaRecorder.start(500);
      setRecording(true);
      onRecordingChange(true);
    } catch (reason) {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setError(reason instanceof Error && reason.name === 'NotAllowedError' ? 'Mikrofon izni verilmedi.' : 'Mikrofon başlatılamadı.');
    }
  };

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(''); setSeconds(0); setError(''); onReady(null);
  };
  return <section className="voice-note-recorder" aria-label="Antrenman için sesli not">
    <div className="voice-note-recorder__head"><div><b>Sesli not</b><small>İstersen çalışmanın sonuna kısa not ekle</small></div><span className={recording ? 'voice-live' : ''}>{recording ? `● ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : audioUrl ? '✓ Hazır' : 'Maks. 60 sn'}</span></div>
    <div className="voice-note-recorder__actions">{recording ? <button type="button" className="voice-stop" onClick={stop}>■ Kaydı bitir</button> : <button type="button" className="secondary-button" onClick={start}>🎙 {audioUrl ? 'Yeniden kaydet' : 'Kayda başla'}</button>}{audioUrl && <button type="button" className="text-button" onClick={discard}>Sil</button>}</div>
    {audioUrl && <audio className="voice-audio-preview" controls preload="metadata" src={audioUrl}>Tarayıcın ses oynatmayı desteklemiyor.</audio>}
    {error && <p className="voice-note-error" role="alert">{error}</p>}
    <p className="voice-note-privacy">Ses cihazında saklanır ve JSON yedeğine dahil edilmez. Mikrofon yalnızca kayda basınca açılır.</p>
  </section>;
}
