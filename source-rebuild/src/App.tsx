import { useEffect, useMemo, useState } from 'react';
import { exportJson, exportSessionsCsv, loadAppData, saveAppData } from './storage';
import type { AppData, SessionKind, TrainingSession } from './types';

const GOALS = [
  { id: 'water', title: 'Günde en az 3 litre su iç', detail: 'Kramp önleme ve performans' },
  { id: 'mobility', title: '15 dk dinamik mobilite', detail: 'Saha veya gym öncesi / sonrası' },
  { id: 'sleep', title: 'En az 8 saat kaliteli uyku', detail: 'Kas toparlanması ve yenilenme' },
  { id: 'weak-foot', title: 'Zayıf ayakla 50 pas / şut', detail: 'Çift ayak gelişimi' },
];

const ACTIONS: Array<{ kind: SessionKind; label: string; icon: string; hint: string }> = [
  { kind: 'gym', label: '+ Gym', icon: '🏋️', hint: 'Kuvvet ve kondisyon' },
  { kind: 'pitch', label: '+ Saha', icon: '⚽', hint: 'Topla teknik çalışma' },
  { kind: 'match', label: '+ Maç', icon: '🏟️', hint: 'Maç kaydı ve skor' },
  { kind: 'gps', label: '+ GPS', icon: '🏃', hint: 'Koşu ve mesafe' },
  { kind: 'timer', label: 'Tempo', icon: '⏱️', hint: 'Aralıklı çalışma' },
  { kind: 'recovery', label: 'Toparlanma', icon: '🧘', hint: 'Esneme ve mobilite' },
  { kind: 'rest', label: 'Dinlenme', icon: '🌙', hint: 'Bugünü dinlenme günü kaydet' },
];

const LABELS: Record<SessionKind, string> = {
  gym: 'Gym', pitch: 'Saha', match: 'Maç', gps: 'GPS koşusu', timer: 'Tempo timer', recovery: 'Toparlanma', rest: 'Dinlenme',
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const shortDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));

function getStreak(sessions: TrainingSession[]): number {
  const dates = new Set(sessions.map((session) => session.date));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [tab, setTab] = useState<'home' | 'calendar' | 'stats' | 'settings'>('home');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<SessionKind | null>(null);
  const [profileName, setProfileName] = useState('');
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [position, setPosition] = useState('Orta saha');
  const [foot, setFoot] = useState<'Sağ' | 'Sol'>('Sağ');
  const [title, setTitle] = useState('Üst Vücut & Core');
  const [minutes, setMinutes] = useState('45');
  const [note, setNote] = useState('');
  const [score, setScore] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => saveAppData(data), [data]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totalXp = useMemo(() => data.sessions.reduce((sum, session) => sum + session.xp, 0), [data.sessions]);
  const level = Math.floor(totalXp / 150) + 1;
  const levelProgress = totalXp % 150;
  const todaySessions = data.sessions.filter((session) => session.date === todayKey());
  const streak = getStreak(data.sessions);
  const weekDays = useMemo(() => {
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      const key = day.toISOString().slice(0, 10);
      return { label: new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(day), key, active: data.sessions.some((session) => session.date === key) };
    });
  }, [data.sessions]);

  const createProfile = () => {
    const trimmed = profileName.trim();
    if (!trimmed) return;
    setData((current) => ({ ...current, profile: { name: trimmed, position, dominantFoot: foot, createdAt: todayKey() } }));
    setToast(`Hoş geldin, ${trimmed}!`);
  };

  const startDemo = () => {
    setData({
      profile: { name: 'Yıldız', position: 'Kanat', dominantFoot: 'Sağ', createdAt: todayKey() },
      sessions: [{ id: crypto.randomUUID(), kind: 'pitch', title: 'İlk saha çalışmam', minutes: 35, xp: 90, date: todayKey(), note: 'Demo antrenmanı' }],
      completedGoals: [],
    });
    setToast('Demo profili hazır. Veriler bu cihazda kalır.');
  };

  const openAction = (kind: SessionKind) => {
    setActiveKind(kind);
    setSheetOpen(false);
    setTitle(kind === 'gym' ? 'Üst Vücut & Core' : kind === 'pitch' ? 'Teknik çalışma' : kind === 'match' ? 'Haftalık maç' : LABELS[kind]);
    setMinutes(kind === 'rest' ? '0' : '45');
    setNote('');
    setScore('');
  };

  const saveSession = () => {
    if (!activeKind) return;
    const duration = Math.max(0, Number(minutes) || 0);
    const baseXp: Record<SessionKind, number> = { gym: 50, pitch: 45, match: 70, gps: 40, timer: 35, recovery: 20, rest: 10 };
    const session: TrainingSession = {
      id: crypto.randomUUID(), kind: activeKind, title: title.trim() || LABELS[activeKind], minutes: duration,
      xp: baseXp[activeKind] + Math.floor(duration / 10) * 5, date: todayKey(), note: note.trim(), ...(score ? { score } : {}),
    };
    setData((current) => ({ ...current, sessions: [session, ...current.sessions] }));
    setActiveKind(null);
    setToast(`${LABELS[session.kind]} kaydı eklendi · +${session.xp} XP`);
  };

  const toggleGoal = (goalId: string) => {
    setData((current) => ({ ...current, completedGoals: current.completedGoals.includes(goalId) ? current.completedGoals.filter((id) => id !== goalId) : [...current.completedGoals, goalId] }));
  };

  const resetProfile = () => {
    if (!window.confirm('Bu cihazdaki HBK Spor profilini ve kayıtlarını sıfırlamak istiyor musun?')) return;
    setData({ profile: null, sessions: [], completedGoals: [] });
    setToast('Profil sıfırlandı.');
  };

  const renderHome = () => (
    <>
      <header className="topbar">
        <div><p className="eyebrow">HBK SPOR · PERFORMANS GÜNLÜĞÜ</p><h1>Hoş geldin, {data.profile?.name}</h1></div>
        <button className="avatar" aria-label="Ayarlar" onClick={() => setTab('settings')}>{data.profile?.name.slice(0, 1).toUpperCase()}</button>
      </header>
      <section className="player-card">
        <div className="player-card__head"><div><span className="muted-label">OYUNCU KARTI</span><h2>{data.profile?.position}</h2></div><span className="level-badge">🥉 Lv.{level} Çaylak</span></div>
        <div className="rating-row"><span><b>55</b><small>HIZ</small></span><span><b>50</b><small>ŞUT</small></span><span><b>50</b><small>PAS</small></span><span className="xp-block"><b>{totalXp}</b><small>XP</small></span></div>
        <div className="xp-track"><span style={{ width: `${(levelProgress / 150) * 100}%` }} /></div>
        <p className="xp-caption">Lv.{level + 1} için {150 - levelProgress} XP kaldı</p>
      </section>
      <section className="section-head"><div><p className="eyebrow">BUGÜN · {new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(new Date())}</p><h2>Bugünün rotası</h2></div><span className="streak">🔥 {streak} gün</span></section>
      <button className="route-card" onClick={() => openAction('gym')}><span className="route-icon">🏋️</span><span className="route-copy"><b>Üst Vücut & Core</b><small>{todaySessions.length ? 'Kaydını ekle veya antrenmanını tamamla' : 'Planından bir çalışma seç ve başla'}</small></span><span className="route-arrow">›</span></button>
      <div className="quick-actions">{ACTIONS.slice(0, 4).map((action) => <button key={action.kind} onClick={() => openAction(action.kind)}><span>{action.icon}</span><small>{action.label.replace('+ ', '')}</small></button>)}</div>
      <section className="card momentum"><div className="section-head compact"><div><p className="eyebrow">BU HAFTAKİ MOMENTUM</p><h2>{new Set(data.sessions.filter((session) => weekDays.some((day) => day.key === session.date)).map((session) => session.date)).size}/5 seans</h2></div><span>⚡</span></div><div className="week-row">{weekDays.map((day) => <div key={day.key} className="week-day"><span>{day.label}</span><i className={day.active ? 'done' : ''}>{day.active ? '✓' : '·'}</i></div>)}</div></section>
      <section className="card goals"><div className="section-head compact"><div><p className="eyebrow">GÜNLÜK HEDEFLER</p><h2>{data.completedGoals.length}/{GOALS.length}</h2></div><span>🎯</span></div>{GOALS.map((goal) => <label key={goal.id} className="goal-row"><input type="checkbox" checked={data.completedGoals.includes(goal.id)} onChange={() => toggleGoal(goal.id)} /><span><b>{goal.title}</b><small>{goal.detail}</small></span></label>)}</section>
      <section className="card recent"><div className="section-head compact"><div><p className="eyebrow">SON KAYITLAR</p><h2>Gelişimin</h2></div><button className="text-button" onClick={() => setTab('calendar')}>Tümünü gör</button></div>{data.sessions.slice(0, 3).map((session) => <SessionRow key={session.id} session={session} />)}{!data.sessions.length && <p className="empty-copy">İlk antrenmanını kaydet, gelişimin burada görünsün.</p>}</section>
    </>
  );

  const renderCalendar = () => (
    <><header className="topbar"><div><p className="eyebrow">TAKVİM</p><h1>Antrenman günlüğü</h1></div><span className="streak">🔥 {streak} gün</span></header><section className="card momentum"><p className="eyebrow">BU HAFTA</p><h2>{weekDays.filter((day) => day.active).length} aktif gün</h2><div className="week-row">{weekDays.map((day) => <div key={day.key} className="week-day"><span>{day.label}</span><i className={day.active ? 'done' : ''}>{day.active ? '✓' : '·'}</i></div>)}</div></section><section className="card recent"><div className="section-head compact"><div><p className="eyebrow">KAYIT ARŞİVİ</p><h2>{data.sessions.length} çalışma</h2></div><button className="text-button" onClick={() => setSheetOpen(true)}>+ Ekle</button></div>{data.sessions.length ? data.sessions.map((session) => <SessionRow key={session.id} session={session} />) : <p className="empty-copy">Henüz kayıt yok. İlk çalışmanı ekle.</p>}</section></>
  );

  const renderStats = () => (
    <><header className="topbar"><div><p className="eyebrow">İSTATİSTİK</p><h1>Gelişim özeti</h1></div><span className="level-badge">Lv.{level}</span></header><div className="stats-grid"><StatCard icon="⚡" value={String(totalXp)} label="Toplam XP" /><StatCard icon="📅" value={String(data.sessions.length)} label="Toplam seans" /><StatCard icon="🔥" value={String(streak)} label="Seri günü" /><StatCard icon="⏱️" value={`${data.sessions.reduce((sum, session) => sum + session.minutes, 0)}′`} label="Toplam süre" /></div><section className="card"><p className="eyebrow">ÇALIŞMA DAĞILIMI</p><h2>Son kayıtların</h2>{ACTIONS.slice(0, 4).map((action) => { const count = data.sessions.filter((session) => session.kind === action.kind).length; return <div key={action.kind} className="bar-row"><span>{action.icon} {action.label.replace('+ ', '')}</span><div className="bar"><i style={{ width: `${Math.min(100, count * 18)}%` }} /></div><b>{count}</b></div>; })}</section><section className="card"><p className="eyebrow">OYUNCU GELİŞİMİ</p><h2>İstikrar, gelişimin temelidir</h2><p className="empty-copy">Her kayıtta XP kazan; haftalık ritmini koru ve antrenman geçmişini düzenli takip et.</p></section></>
  );

  const renderSettings = () => (
    <><header className="topbar"><div><p className="eyebrow">HESAP & VERİ</p><h1>Ayarlar</h1></div><span className="avatar">{data.profile?.name.slice(0, 1).toUpperCase()}</span></header><section className="card settings-card"><p className="eyebrow">PROFİL</p><h2>{data.profile?.name}</h2><p className="empty-copy">{data.profile?.position} · Baskın ayak {data.profile?.dominantFoot}</p><button className="secondary-button" onClick={() => { setProfileName(data.profile?.name ?? ''); setTab('home'); setToast('Profil düzenleme yakında.'); }}>Profili düzenle</button></section><section className="card settings-card"><p className="eyebrow">VERİLERİN SANA AİT</p><h2>Yedekle ve dışa aktar</h2><p className="empty-copy">Kayıtların yalnızca bu cihazda saklanır. İstediğinde yedeğini alabilirsin.</p><div className="settings-actions"><button className="primary-button" onClick={() => exportJson(data)}>JSON yedeği al</button><button className="secondary-button" onClick={() => exportSessionsCsv(data)}>Antrenman CSV indir</button></div></section><section className="card settings-card"><p className="eyebrow">GİZLİLİK</p><h2>Hesap gerekmez</h2><p className="empty-copy">Profilin ve antrenmanların bu tarayıcıda kalır; bir sunucuya gönderilmez.</p><button className="danger-button" onClick={resetProfile}>Profili ve verileri sil</button></section><p className="version-copy">HBK Spor · Kaynak yeniden oluşturma prototipi v0.1.0</p></>
  );

  if (!data.profile) {
    return (
      <main className="welcome-screen">
        <div className="brand-mark">HBK<span>SPOR</span></div><p className="eyebrow">FUTBOL PERFORMANS GÜNLÜĞÜ</p><h1>Hoş geldin,<br /><em>Sporcu!</em></h1><p className="welcome-copy">Antrenmanını kaydet. Gelişimini takip et. Kendi ritmini kur.</p>
        {!showProfileForm ? (
          <>
            <button className="primary-button welcome-cta" onClick={() => setShowProfileForm(true)}>Profilimi oluştur</button>
            <button className="demo-link" onClick={startDemo}>Önce demo ile keşfet →</button>
          </>
        ) : (
          <>
            <ProfileForm name={profileName} setName={setProfileName} position={position} setPosition={setPosition} foot={foot} setFoot={setFoot} onSave={createProfile} />
            <button className="demo-link" onClick={() => setShowProfileForm(false)}>← Geri dön</button>
          </>
        )}
        <p className="privacy-note">Verilerin yalnızca bu cihazda saklanır. Hesap gerekmez.</p>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <main className="page-content" id="main-content">
        {tab === 'home' && renderHome()}
        {tab === 'calendar' && renderCalendar()}
        {tab === 'stats' && renderStats()}
        {tab === 'settings' && renderSettings()}
      </main>
      <nav className="bottom-nav" aria-label="Ana gezinme">
        <button className={tab === 'home' ? 'selected' : ''} onClick={() => setTab('home')}><span>⌂</span><small>Ana sayfa</small></button>
        <button className={tab === 'calendar' ? 'selected' : ''} onClick={() => setTab('calendar')}><span>▦</span><small>Takvim</small></button>
        <button className="fab" aria-label="Yeni kayıt ekle" onClick={() => setSheetOpen(true)}>＋</button>
        <button className={tab === 'stats' ? 'selected' : ''} onClick={() => setTab('stats')}><span>▥</span><small>İstatistik</small></button>
        <button className={tab === 'settings' ? 'selected' : ''} onClick={() => setTab('settings')}><span>⚙</span><small>Ayarlar</small></button>
      </nav>
      {sheetOpen && <div className="scrim" onMouseDown={() => setSheetOpen(false)}><section className="action-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="section-head compact"><div><p className="eyebrow">YENİ KAYIT</p><h2 id="sheet-title">Bugün ne yaptın?</h2></div><button className="close-button" aria-label="Kapat" onClick={() => setSheetOpen(false)}>×</button></div><div className="action-list">{ACTIONS.map((action) => <button key={action.kind} onClick={() => openAction(action.kind)}><span className="action-icon">{action.icon}</span><span><b>{action.label}</b><small>{action.hint}</small></span><span className="route-arrow">›</span></button>)}</div></section></div>}
      {activeKind && <div className="scrim" onMouseDown={() => setActiveKind(null)}><section className="session-modal" role="dialog" aria-modal="true" aria-labelledby="session-title" onMouseDown={(event) => event.stopPropagation()}><div className="section-head compact"><div><p className="eyebrow">{LABELS[activeKind].toUpperCase()} KAYDI</p><h2 id="session-title">Çalışmanı kaydet</h2></div><button className="close-button" aria-label="Kapat" onClick={() => setActiveKind(null)}>×</button></div><label className="field-label">Çalışma adı<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} /></label>{activeKind === 'match' && <label className="field-label">Skor<input value={score} onChange={(event) => setScore(event.target.value)} placeholder="2-1" /></label>}<label className="field-label">Süre (dakika)<input type="number" min="0" max="600" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label><label className="field-label">Not<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Nasıl geçti?" /></label><button className="primary-button full-button" onClick={saveSession}>Kaydı tamamla</button></section></div>}
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

function ProfileForm(props: { name: string; setName: (value: string) => void; position: string; setPosition: (value: string) => void; foot: 'Sağ' | 'Sol'; setFoot: (value: 'Sağ' | 'Sol') => void; onSave: () => void }) {
  return <form className="profile-form" onSubmit={(event) => { event.preventDefault(); props.onSave(); }}><label className="field-label">Ad soyad<input required value={props.name} onChange={(event) => props.setName(event.target.value)} placeholder="Örn. Deniz Yılmaz" autoComplete="name" /></label><div className="form-grid"><label className="field-label">Mevki<select value={props.position} onChange={(event) => props.setPosition(event.target.value)}>{['Kaleci', 'Defans', 'Orta saha', 'Kanat', 'Forvet'].map((option) => <option key={option}>{option}</option>)}</select></label><label className="field-label">Baskın ayak<select value={props.foot} onChange={(event) => props.setFoot(event.target.value as 'Sağ' | 'Sol')}><option>Sağ</option><option>Sol</option></select></label></div><button className="primary-button full-button" type="submit" disabled={!props.name.trim()}>Profilimi kaydet →</button></form>;
}

function SessionRow({ session }: { session: TrainingSession }) {
  const icon: Record<SessionKind, string> = { gym: '🏋️', pitch: '⚽', match: '🏟️', gps: '🏃', timer: '⏱️', recovery: '🧘', rest: '🌙' };
  return <div className="session-row"><span className="session-icon">{icon[session.kind]}</span><span className="session-info"><b>{session.title}</b><small>{LABELS[session.kind]} · {shortDate(session.date)}{session.minutes ? ` · ${session.minutes} dk` : ''}{session.score ? ` · ${session.score}` : ''}</small></span><span className="session-xp">+{session.xp} XP</span></div>;
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return <article className="stat-card"><span>{icon}</span><b>{value}</b><small>{label}</small></article>;
}
