import type { NotificationPreferences } from './types';

export function NotificationSettings({ preferences, permission, onEnable, onTestNotification, onUpdate, pushState, pushError, onEnablePush, onDisablePush }: {
  preferences: NotificationPreferences;
  permission: NotificationPermission | 'unsupported';
  onEnable: () => void;
  onTestNotification: () => void;
  onUpdate: (value: NotificationPreferences) => void;
  pushState: 'unconfigured' | 'off' | 'on';
  pushError: string;
  onEnablePush: () => void;
  onDisablePush: () => void;
}) {
  return <section className="card notification-settings"><div className="section-head compact"><div><p className="eyebrow">HATIRLATICILAR</p><h2>Bildirim tercihleri</h2></div><span>🔔</span></div><p className="empty-copy">Bildirimler isteğe bağlıdır; yalnızca seçtiğin plan ve zamanlarda oluşturulur.</p>
    {!preferences.enabled ? <div className="notification-permission"><button type="button" className="primary-button full-button" onClick={onEnable} disabled={permission === 'denied' || permission === 'unsupported'}>{permission === 'granted' ? 'Hatırlatıcıları etkinleştir' : 'Sistem bildirimlerine izin ver'}</button>{permission === 'denied' && <small>İzin tarayıcı ayarlarından reddedilmiş. Site izinlerinde bildirimleri açıp yeniden dene.</small>}{permission === 'unsupported' && <small>Bu tarayıcı bildirim izni sunmuyor.</small>}</div> : <>
      <div className="notification-state"><i />Bildirimler açık <button type="button" className="text-button" onClick={onTestNotification} disabled={permission !== 'granted'}>Deneme gönder</button><button type="button" className="text-button" onClick={() => onUpdate({ ...preferences, enabled: false })}>Kapat</button></div>
      <label className="notification-option"><input type="checkbox" checked={preferences.planReminders} onChange={(event) => onUpdate({ ...preferences, planReminders: event.target.checked })} /><span><b>Planlı çalışmadan önce</b><small>Takvimdeki saatten önce hatırlat</small></span></label>
      {preferences.planReminders && <label className="field-label">Ne kadar önce?<select value={preferences.leadMinutes} onChange={(event) => onUpdate({ ...preferences, leadMinutes: Number(event.target.value) as NotificationPreferences['leadMinutes'] })}><option value={0}>Başlangıç saatinde</option><option value={15}>15 dakika önce</option><option value={30}>30 dakika önce</option><option value={60}>1 saat önce</option></select></label>}
      <label className="notification-option"><input type="checkbox" checked={preferences.dailyReminder} onChange={(event) => onUpdate({ ...preferences, dailyReminder: event.target.checked })} /><span><b>Günlük nazik hatırlatma</b><small>Yalnızca bugün için kayıt yoksa gönder</small></span></label>
      {(preferences.dailyReminder || preferences.weeklySummary) && <label className="field-label">Hatırlatma / haftalık özet saati<input type="time" value={preferences.dailyTime} onChange={(event) => onUpdate({ ...preferences, dailyTime: event.target.value })} /></label>}
      <label className="notification-option"><input type="checkbox" checked={preferences.weeklySummary} onChange={(event) => onUpdate({ ...preferences, weeklySummary: event.target.checked })} /><span><b>Pazar haftalık özeti</b><small>Kaydedilmiş çalışma sayılarını özetle</small></span></label>
      <section className="push-settings"><div className="push-settings__head"><b>Uygulama kapalıyken push</b></div>{pushState === 'on' ? <><span className="push-settings__status"><i />Push sunucusuna bağlı</span><button type="button" className="secondary-button full-button" onClick={onDisablePush}>Push aboneliğini kaldır</button></> : <button type="button" className="primary-button full-button" onClick={onEnablePush} disabled={pushState === 'unconfigured' || permission !== 'granted'}>{pushState === 'unconfigured' ? 'Push sunucusu yapılandırılmamış' : 'Kapalı uygulama push’unu etkinleştir'}</button>}<p>Push etkinleştirilince seçili gelecek hatırlatmalar ve plan başlıkları sunucuya gönderilir; antrenman geçmişi ve medya gönderilmez. Push Worker kurulumu ve VAPID anahtarları gerekir.</p>{permission === 'denied' && <small>Push için bildirim izni tarayıcı ayarlarından açılmalı.</small>}{permission === 'unsupported' && <small>Bu tarayıcı kapalı uygulama push’unu desteklemiyor.</small>}{pushError && <small className="push-settings__error" role="alert">{pushError}</small>}</section>
      <p className="notification-note">“Deneme gönder” bu cihazda hemen bir yerel bildirim gösterir; push altyapısını sınamaz. Yerel hatırlatmalar uygulama açıkken çalışır. Kapalı uygulama push’u yalnızca sunucu yapılandırılmış ve etkinleştirilmişse teslim edilir; tarayıcı/işletim sistemi geciktirebilir.</p>
    </>}
  </section>;
}
