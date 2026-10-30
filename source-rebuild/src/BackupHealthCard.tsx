import { useEffect, useState } from 'react';
import type { AppData } from './types';
import { getSavedAppDataBytes } from './storage';

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value / (1024 * 1024))} MB`;
}

export function BackupHealthCard({ lastBackupAt, data, onExport }: { lastBackupAt: string | null; data: AppData; onExport: () => void }) {
  const [usage, setUsage] = useState<{ used?: number; quota?: number }>({});
  const [appBytes, setAppBytes] = useState(() => getSavedAppDataBytes());
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const storage = navigator.storage;
      if (!storage?.estimate) return;
      try {
        const estimate = await storage.estimate();
        if (active) setUsage({ used: estimate.usage, quota: estimate.quota });
      } catch { /* Browser estimate is an optional hint, never required for backups. */ }
    };
    const timer = window.setTimeout(() => setAppBytes(getSavedAppDataBytes()), 0);
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, [data]);

  const ageDays = lastBackupAt ? Math.max(0, Math.floor((Date.now() - Date.parse(lastBackupAt)) / 86_400_000)) : null;
  const due = ageDays === null || ageDays >= 30;
  const percent = usage.used !== undefined && usage.quota ? Math.min(100, usage.used / usage.quota * 100) : null;
  return <section className={`card backup-health ${due ? 'backup-health--due' : ''}`} aria-label="Yedek ve depolama durumu">
    <div className="section-head compact"><div><p className="eyebrow">VERİ GÜVENLİĞİ</p><h2>Yedek ve depolama</h2></div><span>🔐</span></div>
    <div className="backup-health__row"><span>Son JSON yedeği</span><b>{ageDays === null ? 'Henüz alınmadı' : ageDays === 0 ? 'Bugün hazırlandı' : `${ageDays} gün önce`}</b></div>
    {due && <p className="backup-health__warning" role="status">{ageDays === null ? 'Bir kopyayı başka bir yerde saklamak için yedek al.' : 'Son yedekten 30 gün geçti; güncel bir kopya alman iyi olur.'}</p>}
    <div className="backup-health__row"><span>HBK kayıtlarının yaklaşık boyutu</span><b>{formatBytes(appBytes)}</b></div>
    <div className="backup-health__row"><span>Tarayıcı alanı tahmini</span><b>{percent === null ? usage.used === undefined ? 'Desteklenmiyor' : formatBytes(usage.used) : `${formatBytes(usage.used ?? 0)} / ${formatBytes(usage.quota ?? 0)} · ${Math.round(percent)}%`}</b></div>
    {percent !== null && percent >= 80 && <p className="backup-health__warning" role="status">Bu tarayıcı alanı dolmaya yaklaşıyor. Verileri dışa aktar ve saklama alanını kontrol et.</p>}
    <button type="button" className="primary-button full-button" onClick={onExport}>JSON yedeği al</button>
    <p className="field-help">JSON yedeği; seans, plan, hedef, test ve GPS kayıtlarını içerir. Ses notları ile maç fotoğraf/video dosyaları bu JSON’a eklenmez; bunları ayrı medya yedeğiyle taşı. Depolama ölçümü tarayıcının yaklaşık tahminidir.</p>
  </section>;
}
