import type { NotificationPreferences } from './types';

export function NotificationSettings({ preferences, permission, onEnable, onUpdate }: {
  preferences: NotificationPreferences;
  permission: NotificationPermission | 'unsupported';
  onEnable: () => void;
  onUpdate: (value: NotificationPreferences) => void;
}) {
  return <section className="card notification-settings"><div className="section-head compact"><div><p className="eyebrow">HATIRLATICILAR</p><h2>Bildirim tercihleri</h2></div><span>🔔</span></div><p className="empty-copy">Bildirimler isteğe bağlıdır; yalnızca seçtiğin plan ve zamanlarda oluşturulur.</p>
    {!preferences.enabled ? <div className="notification-permission"><button type="button" className="primary-button full-button" onClick={onEnable} disabled={permission === 'denied' || permission === 'unsupported'}>{permission === 'granted' ? 'Hatırlatıcıları etkinleştir' : 'Sistem bildirimlerine izin ver'}</button>{permission === 'denied' && <small>İzin tarayıcı ayarlarından reddedilmiş. Site izinlerinde bildirimleri açıp yeniden dene.</small>}{permission === 'unsupported' && <small>Bu tarayıcı bildirim izni sunmuyor.</small>}</div> : <>
      <div className="notification-state"><i />Bildirimler açık <button type="button" className="text-button" onClick={() => onUpdate({ ...preferences, enabled: false })}>Kapat</button></div>
      <label className="notification-option"><input type="checkbox" checked={preferences.planReminders} onChange={(event) => onUpdate({ ...preferences, planReminders: event.target.checked })} /><span><b>Planlı çalışmadan önce</b><small>Takvimdeki saatten önce hatırlat</small></span></label>
      {preferences.planReminders && <label className="field-label">Ne kadar önce?<select value={preferences.leadMinutes} onChange={(event) => onUpdate({ ...preferences, leadMinutes: Number(event.target.value) as NotificationPreferences['leadMinutes'] })}><option value={0}>Başlangıç saatinde</option><option value={15}>15 dakika önce</option><option value={30}>30 dakika önce</option><option value={60}>1 saat önce</option></select></label>}
      <label className="notification-option"><input type="checkbox" checked={preferences.dailyReminder} onChange={(event) => onUpdate({ ...preferences, dailyReminder: event.target.checked })} /><span><b>Günlük nazik hatırlatma</b><small>Yalnızca bugün için kayıt yoksa gönder</small></span></label>
      {(preferences.dailyReminder || preferences.weeklySummary) && <label className="field-label">Hatırlatma / haftalık özet saati<input type="time" value={preferences.dailyTime} onChange={(event) => onUpdate({ ...preferences, dailyTime: event.target.value })} /></label>}
      <label className="notification-option"><input type="checkbox" checked={preferences.weeklySummary} onChange={(event) => onUpdate({ ...preferences, weeklySummary: event.target.checked })} /><span><b>Pazar haftalık özeti</b><small>Kaydedilmiş çalışma sayılarını özetle</small></span></label>
      <p className="notification-note">Hatırlatmalar bu prototipte uygulama açıkken yerel olarak çalışır. Sekme kapalıyken anında bildirim için sunucu/push altyapısı gerekir. Tarayıcı arka plan zamanlayıcılarını geciktirebilir.</p>
    </>}
  </section>;
}
