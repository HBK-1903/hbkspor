import { useId, useMemo, useState } from 'react';
import type { ExerciseDefinition, LegacyWorkout, MuscleGroup } from './types';
import { mapExerciseMuscles, MUSCLE_LABELS } from './muscles';
import { getExerciseCoaching, hasExerciseCoaching } from './exercise-coaching';
import './movement-library.css';

type Pattern = 'squat' | 'hinge' | 'lunge' | 'bridge' | 'leg-machine' | 'push' | 'fly' | 'row' | 'pull' | 'press' | 'raise' | 'shrug' | 'curl' | 'triceps' | 'plank' | 'crunch' | 'leg-raise' | 'rotation' | 'jump' | 'mobility' | 'band' | 'calf' | 'tibialis';
type Pose = { hip: number; knee: number; lean?: number; arm: number; elbows?: number; stance?: number; lift?: number; shoulderLift?: number };
type Guide = { pattern: Pattern; label: string; start: Pose; finish: Pose; setup: string; steps: [string, string, string]; cue: string; watchOut: string; easier: string; harder: string; equipment: string; tailored: boolean };
type GuideTemplate = Pick<Guide, 'label' | 'start' | 'finish' | 'steps' | 'cue' | 'equipment'>;

const GUIDE: Record<Pattern, GuideTemplate> = {
  squat: { label: 'Çömelme', start: { hip: 61, knee: 82, arm: 0 }, finish: { hip: 78, knee: 79, lean: 8, arm: 0, stance: 5 }, steps: ['Ayaklarını rahat ve dengeli bir genişlikte yerleştir; gövdeni sabitle.', 'Kalçanı geriye ve aşağı indirirken dizlerini ayak yönünde takip ettir.', 'Ayağının tamamından kuvvet alıp kontrollü biçimde başlangıca dön.'], cue: 'Dizleri içeri düşürme; hareket açıklığını ağrısız ve kontrol edilebilir tut.', equipment: 'Bar, dambıl veya vücut ağırlığı' },
  hinge: { label: 'Kalça menteşesi', start: { hip: 61, knee: 76, arm: -40 }, finish: { hip: 70, knee: 72, lean: 27, arm: -45 }, steps: ['Yükü vücuduna yakın tut; sırtını nötr ve karnını kontrollü biçimde sıkı tut.', 'Dizlerde hafif bükümle kalçanı geriye gönder; gövdeni kalçadan öne eğ.', 'Kalçanı öne getirerek doğrul; beli geriye aşırı çukurlaştırma.'], cue: 'Belden yuvarlanma; hareketi kalçadan başlat ve yükü yakın taşı.', equipment: 'Bar, dambıl veya kettlebell' },
  lunge: { label: 'Tek bacak / lunge', start: { hip: 61, knee: 81, arm: -10, stance: 7 }, finish: { hip: 76, knee: 79, lean: 3, arm: -10, stance: 19 }, steps: ['Dengeli, kalça genişliğinde bir duruş al; gövdeni dik ve sabit tut.', 'Bir ayağınla adım alıp kalçanı kontrollü indir; ön dizini ayakla aynı hatta tut.', 'Ön ayağından kuvvet alarak başlangıca dön; tekrarları iki tarafa dengeli uygula.'], cue: 'Dengeyi kaybetmeden, adım uzunluğunu sana uygun aralıkta seç.', equipment: 'Vücut ağırlığı, dambıl veya bar' },
  bridge: { label: 'Kalça köprüsü', start: { hip: 79, knee: 75, arm: 8 }, finish: { hip: 52, knee: 74, arm: 8 }, steps: ['Sırt üstü yat; ayak tabanlarını yere basıp dizlerini bük.', 'Topuklarından kuvvet alarak kalçanı kaldır; gövde ve uylukları hizala.', 'Üstte kısa süre kontrollü kal, kalçanı yere yavaşça indir.'], cue: 'Yukarıda beli aşırı çukurlaştırmak yerine kalçayı sık.', equipment: 'Vücut ağırlığı, bench veya bant' },
  'leg-machine': { label: 'Diz bükme / açma', start: { hip: 61, knee: 80, arm: -10 }, finish: { hip: 61, knee: 62, arm: -10, lift: 8 }, steps: ['Makineyi eklem hizana göre ayarla; sırtını ve kalçanı destekten ayırma.', 'Seçilen harekete göre dizini kontrollü biçimde bük veya aç.', 'Son noktada savurmadan durakla ve yükü yavaşça başlangıca döndür.'], cue: 'Ağırlığı momentumla savurma; ağrısız hareket açıklığında çalış.', equipment: 'Diz makinesi' },
  push: { label: 'Yatay itiş', start: { hip: 61, knee: 80, arm: 0, elbows: 30 }, finish: { hip: 61, knee: 80, arm: 28, elbows: 12 }, steps: ['Omuzlarını sabitle; bileklerini dirseklerin üzerinde tut ve gövdeni dengede kur.', 'Yükü göğüs hizasına doğru kontrollü indir; dirsekleri rahat açıda tut.', 'Yükü yukarı iterek başlangıca dön; tepede eklemleri sertçe kilitleme.'], cue: 'Omuzda ağrı oluşursa hareket açıklığını azalt veya egzersizi bırak.', equipment: 'Bar, dambıl, makine veya zemin' },
  fly: { label: 'Göğüs açış', start: { hip: 61, knee: 80, arm: -10, elbows: 22 }, finish: { hip: 61, knee: 80, arm: 17, elbows: 22 }, steps: ['Dirseklerini hafif bükülü ve sabit tut; göğsünü kontrollü biçimde açık tut.', 'Kollarını yay çizerek iki yana aç; omuz konforunu koru.', 'Kollarını aynı yay üzerinde birleştir; yükü kontrol ederek tekrarla.'], cue: 'Aşırı derin esnemeye zorlama; dirsek açısını tekrar boyunca koru.', equipment: 'Dambıl, kablo veya pec-deck' },
  row: { label: 'Yatay çekiş', start: { hip: 61, knee: 75, lean: 15, arm: -40 }, finish: { hip: 61, knee: 75, lean: 15, arm: -15 }, steps: ['Gövdeni dengeli ve sırtını nötr tut; omuzlarını kulaklarından uzaklaştır.', 'Dirseklerini gövdene doğru çek; kürek kemiklerini kontrollü yaklaştır.', 'Kollarını yavaşça uzatıp başlangıca dön; gövdeni sallama.'], cue: 'Çekişi kolla savurmak yerine dirseği geriye götürerek yap.', equipment: 'Kablo, bar, dambıl veya makine' },
  pull: { label: 'Dikey çekiş', start: { hip: 61, knee: 80, arm: 30 }, finish: { hip: 61, knee: 80, arm: 0, elbows: 11 }, steps: ['Kollarını baş üstünde uzat; omuzlarını kontrollü ve boynunu rahat tut.', 'Dirseklerini aşağı, gövdenin yanlarına doğru çek.', 'Kollarını yavaşça uzatıp başlangıca dön; sallanmayı azalt.'], cue: 'Boynunu öne uzatma; çekişi omuz ve sırt kontrolüyle tamamla.', equipment: 'Barfiks barı veya lat pulldown' },
  press: { label: 'Baş üstü itiş', start: { hip: 61, knee: 80, arm: 0 }, finish: { hip: 61, knee: 80, arm: 28 }, steps: ['Yükü omuz hizasında başlat; karın ve kalçanı kontrollü biçimde sık.', 'Yükü başının üzerine, rahat bir hatta doğru it.', 'Kontrollü biçimde omuz hizasına indir; gövdeyi geriye yatırma.'], cue: 'Belini aşırı çukurlaştırmadan, ağrısız aralıkta itiş yap.', equipment: 'Dambıl, bar veya makine' },
  raise: { label: 'Omuz kaldırış', start: { hip: 61, knee: 80, arm: -18 }, finish: { hip: 61, knee: 80, arm: 15, elbows: 8 }, steps: ['Duruşunu sabitle; kollarını hafif bükülü ve omuzlarını rahat tut.', 'Kollarını seçilen yöne (yana, öne veya arkaya) kontrollü kaldır.', 'Yükü savurmadan başlangıç noktasına indir.'], cue: 'Ağır yük yerine kontrolü ve omuz konforunu önceliklendir.', equipment: 'Dambıl, kablo veya bant' },
  shrug: { label: 'Omuz silkme', start: { hip: 61, knee: 80, arm: -60 }, finish: { hip: 61, knee: 80, arm: -60, shoulderLift: 7 }, steps: ['Dik dur; yükü iki yanında tut ve kollarını rahat bırak.', 'Omuzlarını kulaklarına doğru kaldır; boynunu sıkıştırmadan kısa süre tut.', 'Omuzlarını kontrollü biçimde indir; öne veya geriye yuvarlama.'], cue: 'Hareketi omuzları yukarı kaldırarak yap; boyun ve gövdeyi savurma.', equipment: 'Bar veya dambıl' },
  curl: { label: 'Dirsek bükme', start: { hip: 61, knee: 80, arm: -40 }, finish: { hip: 61, knee: 80, arm: 0, elbows: 23 }, steps: ['Dirseklerini gövdene yakın ve omuzlarını rahat tut.', 'Dirseklerini bükerek yükü kontrollü biçimde kaldır.', 'Yükü yavaşça indir; gövdeni geriye savurma.'], cue: 'Dirsekleri sabit tut; tekrarın iki yönünü de kontrol et.', equipment: 'Dambıl, bar, kablo veya bant' },
  triceps: { label: 'Dirsek açma', start: { hip: 61, knee: 80, arm: 20, elbows: 22 }, finish: { hip: 61, knee: 80, arm: 28, elbows: 5 }, steps: ['Üst kollarını mümkün olduğunca sabit ve omuzlarını rahat tut.', 'Dirseklerini açarak yükü kontrollü biçimde it veya uzat.', 'Dirsekleri bükerek başlangıca dön; yükü bırakma.'], cue: 'Dirsek ekleminde rahatsızlık varsa yükü ve hareket açıklığını azalt.', equipment: 'Kablo, dambıl, bar veya bant' },
  plank: { label: 'Gövde sabitleme', start: { hip: 70, knee: 82, arm: 35, lean: 34 }, finish: { hip: 70, knee: 82, arm: 35, lean: 34, lift: 8 }, steps: ['Dirsek veya ellerini omuzlarının altına yerleştir; baştan topuğa hizalan.', 'Karnını ve kalçanı kontrollü sık; belinin çökmesine izin verme.', 'Nefesini tutmadan pozisyonu koru; form bozulmadan seti bitir.'], cue: 'Süreyi değil düzgün hizayı hedefle; belde rahatsızlık olursa bırak.', equipment: 'Zemin veya mat' },
  crunch: { label: 'Gövde bükme', start: { hip: 62, knee: 78, arm: 8 }, finish: { hip: 69, knee: 78, arm: 8, lean: 10 }, steps: ['Sırt üstü pozisyon al; boynunu zorlamadan çeneni rahat tut.', 'Nefes verirken göğüs kafesini kontrollü biçimde kalçaya yaklaştır.', 'Yavaşça başlangıca dön; hareketi ivmeyle yapma.'], cue: 'Boynundan çekme; küçük ve kontrollü hareket yeterlidir.', equipment: 'Mat veya kablo' },
  'leg-raise': { label: 'Bacak kaldırma', start: { hip: 62, knee: 75, arm: 35 }, finish: { hip: 62, knee: 75, arm: 35, lift: 30 }, steps: ['Gövdeni sabitle; bel boşluğunu kontrollü tut.', 'Bacaklarını veya dizlerini seçilen varyasyona göre kaldır.', 'Bel kontrolünü kaybetmeden yavaşça başlangıca dön.'], cue: 'Belin yerden ayrılıyorsa dizleri bük veya hareket açıklığını kısalt.', equipment: 'Zemin, barfiks barı veya sehpa' },
  rotation: { label: 'Dönüş / anti-dönüş', start: { hip: 61, knee: 78, arm: 17 }, finish: { hip: 61, knee: 78, arm: 17, lean: 12 }, steps: ['Dengeli duruş al; kablo veya ekipmanı göğüs hizasında tut.', 'Gövdeni kontrollü döndür ya da gövdenin dönmesine diren.', 'Başlangıca yavaş dön; kalça ve dizlerin kontrolünü koru.'], cue: 'Dönüşü belden zorlamadan, gövde ve kalça kontrolüyle uygula.', equipment: 'Kablo, bant veya sağlık topu' },
  jump: { label: 'Sıçrama / saha gücü', start: { hip: 74, knee: 69, arm: 23 }, finish: { hip: 45, knee: 77, arm: 41, lift: 20 }, steps: ['Dengeli atletik duruş al; kalça ve dizlerini hafifçe bük.', 'Kollarını kullanarak kontrollü ve niyetli biçimde itiş yap.', 'Yumuşak iniş yap; dizlerini ayaklarınla aynı yönde hizala.'], cue: 'İniş sessiz ve kontrollü olsun; yorgunlukta sıçrama kalitesini zorlamama.', equipment: 'Vücut ağırlığı veya sağlık topu' },
  mobility: { label: 'Mobilite / esneme', start: { hip: 61, knee: 78, arm: -10 }, finish: { hip: 69, knee: 76, arm: 10, stance: 12 }, steps: ['Rahat ve dengeli başlangıç pozisyonu al.', 'Hareketi yavaşça, nefesini tutmadan ve kontrollü aralıkta uygula.', 'Gerginlik hissedildiğinde zorlamadan geri dön; iki tarafı dengeli çalış.'], cue: 'Keskin ağrıya doğru esneme; bu görsel genel bilgilendirmedir.', equipment: 'Mat, bant veya vücut ağırlığı' },
  band: { label: 'Bantla aktivasyon', start: { hip: 61, knee: 78, arm: -10, stance: 4 }, finish: { hip: 64, knee: 78, arm: -10, stance: 19 }, steps: ['Bant gerginliğini koru; diz ve ayaklarını aynı hizada tut.', 'Kalçanı sabit tutarak adım veya dışa itiş yap.', 'Kontrollü biçimde geri dön; bandın seni çekmesine izin verme.'], cue: 'Küçük ama kontrollü adım; dizlerin içe kaçmasını önle.', equipment: 'Mini-band veya direnç bandı' },
  calf: { label: 'Baldır kaldırış', start: { hip: 61, knee: 80, arm: -10 }, finish: { hip: 61, knee: 80, arm: -10, lift: 9 }, steps: ['Denge için destek al; ayaklarını rahat ve paralel yerleştir.', 'Topuklarını kontrollü kaldırıp ayak ucuna yüksel.', 'Kısa durakla ve topuklarını yavaşça indir.'], cue: 'Yukarı-aşağı hareketi tam ve kontrollü yap; yaylanma kullanma.', equipment: 'Basamak, makine veya vücut ağırlığı' },
  tibialis: { label: 'Ön kaval kaldırış', start: { hip: 61, knee: 80, arm: -10 }, finish: { hip: 61, knee: 80, arm: -10, lift: -8 }, steps: ['Destekli ve dengeli pozisyon al; topuklarını yerde tut.', 'Ayak parmaklarını kaval kemiğine doğru kaldır.', 'Parmaklarını yavaşça indirip başlangıca dön.'], cue: 'Hareketi ayak bileğinden yap; sarsıntı ve ağrıya zorlamadan çalış.', equipment: 'Duvar, bant veya tibialis makinesi' },
};

function inferPattern(exercise: ExerciseDefinition): Pattern {
  const text = `${exercise.id} ${exercise.name} ${exercise.footballTag ?? ''}`.toLocaleLowerCase('tr-TR');
  const category = exercise.category.toLocaleLowerCase('tr-TR');
  if (/cossack/.test(text)) return 'squat';
  if (/foam|roller|90\/90|spiderman|mobil|esnet|stretch|kalça aç|ankle|ayak bileği/.test(text)) return 'mobility';
  if (/monster|band walk|yan adım|bant yürüy/.test(text)) return 'band';
  if (/pallof|wood.?chop|woodchopper|russian twist|rotat|anti.?rot|chop|sağlık topu.*dön/.test(text)) return 'rotation';
  if (/pogo|box jump|broad jump|lateral bound|single.?leg hop|sıçra|sıçrama|jump|hop|slam|sprint|saha gücü/.test(text)) return 'jump';
  if (/dead bug|bird dog|plank|copenhagen|hollow|carry|farmer|mountain climber|rollout|ab wheel/.test(text)) return 'plank';
  if (/crunch|sit.?up|mekik|bicycle/.test(text)) return 'crunch';
  if (/leg raise|knee raise|diz çek/.test(text)) return 'leg-raise';
  if (/tibialis|ön kaval/.test(text)) return 'tibialis';
  if (/calf|baldır|calf raise|topuk kaldır/.test(text)) return 'calf';
  if (/hip thrust|glute bridge|kalça köprü/.test(text)) return 'bridge';
  if (/leg extension|leg curl|nordic|hamstring curl|diz makine/.test(text)) return 'leg-machine';
  if (/deadlift|romanian|rdl|good morning|back extension|hip hinge|swing/.test(text)) return 'hinge';
  if (/bulgarian|split squat|lunge|tek bacak squat|step.?up|adım/.test(text)) return 'lunge';
  if (/squat|goblet|leg press|hack squat/.test(text)) return 'squat';
  if (/shrug|omuz silkme/.test(text)) return 'shrug';
  if (/upright row/.test(text)) return 'raise';
  if (/face pull/.test(text)) return 'row';
  if (/pull.?up|chin.?up|lat pulldown|pulldown|dikey çek/.test(text)) return 'pull';
  if (/row|yatay çek/.test(text)) return 'row';
  if (/fly|flye|crossover|pec.?deck|açış/.test(text)) return 'fly';
  if (/dip|bench press|chest press|push.?up|şınav|yatay itiş|close.?grip bench/.test(text)) return 'push';
  if (/overhead press|shoulder press|military press|arnold press|push press|baş üstü/.test(text)) return 'press';
  if (/lateral raise|front raise|rear delt|reverse fly|omuz kaldır/.test(text)) return 'raise';
  if (/biceps|biceps curl|hammer curl|curl|dirsek bük/.test(text) && !/leg curl|hamstring curl/.test(text)) return 'curl';
  if (/triceps|pushdown|skull.?crusher|dirsek aç/.test(text)) return 'triceps';
  if (/kol/.test(category)) return 'curl';
  if (/omuz/.test(category)) return 'raise';
  if (/göğüs/.test(category)) return 'push';
  if (/sırt/.test(category)) return 'row';
  if (/bacak/.test(category)) return 'squat';
  if (/core/.test(category)) return 'plank';
  return 'mobility';
}

function getGuide(exercise: ExerciseDefinition): Guide {
  const pattern = inferPattern(exercise);
  const template = GUIDE[pattern];
  const coaching = getExerciseCoaching(exercise);
  return {
    pattern,
    ...template,
    setup: coaching?.setup ?? 'Bu özel hareket için ayrı bir kurulum notu henüz yok; ekipmanı güvenli şekilde ayarla ve rahat başlangıç pozisyonu seç.',
    steps: coaching?.steps ?? template.steps,
    cue: coaching?.focus ?? template.cue,
    watchOut: coaching?.watchOut ?? 'Kontrol kaybolursa yükü ve hareket aralığını azalt; ağrıya rağmen tekrar etme.',
    easier: coaching?.easier ?? 'Daha hafif yük, destek veya kısaltılmış rahat hareket aralığı seç.',
    harder: coaching?.harder ?? 'Yalnızca form sabitken hareketi yavaşlat veya direnci kademeli artır.',
    tailored: Boolean(coaching),
  };
}

const HOTSPOT: Record<MuscleGroup, [number, number]> = {
  chest: [52, 42], back: [50, 46], shoulders: [39, 32], rearDelts: [62, 33], traps: [50, 29],
  biceps: [39, 43], triceps: [63, 42], forearms: [34, 55], core: [51, 50], obliques: [42, 51],
  hipFlexors: [57, 59], quadriceps: [43, 70], hamstrings: [59, 70], glutes: [58, 59],
  adductors: [50, 69], calves: [60, 88], tibialis: [42, 89],
};

function Figure({ pose, muscles, equipment, pattern, phase }: { pose: Pose; muscles: MuscleGroup[]; equipment: string; pattern: Pattern; phase: string }) {
  const lean = pose.lean ?? 0;
  const shoulderX = 50 + lean * 0.35;
  const hipX = 50;
  const shoulderY = 33 - (pose.shoulderLift ?? 0);
  const hipY = pose.hip;
  const kneeY = pose.knee;
  const wide = pose.stance ?? 0;
  const lift = pose.lift ?? 0;
  const armY = shoulderY - pose.arm;
  const elbowBend = pose.elbows ?? 12;
  const leftHandX = shoulderX - (pose.arm > 32 ? 12 : 19);
  const rightHandX = shoulderX + (pose.arm > 32 ? 12 : 19);
  const leftElbow = [shoulderX - 13 - elbowBend * 0.15, (shoulderY + armY) / 2 + (pose.arm > 30 ? 2 : 8)];
  const rightElbow = [shoulderX + 13 + elbowBend * 0.15, (shoulderY + armY) / 2 + (pose.arm > 30 ? 2 : 8)];
  const leftKnee = [hipX - 8 - wide * 0.45, kneeY];
  const rightKnee = [hipX + 8 + wide * 0.45, kneeY];
  const headX = shoulderX + lean * 0.18;
  const headY = shoulderY - 13 + lean * 0.09;
  const barY = pattern === 'squat' || pattern === 'lunge' ? 29
    : pattern === 'hinge' ? (pose.hip > 65 ? 88 : 67)
      : pattern === 'shrug' ? 100
        : pattern === 'row' ? 56
          : pattern === 'push' ? 43
            : pattern === 'press' ? (pose.arm > 20 ? 8 : 35)
              : pattern === 'curl' ? (pose.arm < -10 ? 76 : 35)
                : pose.arm > 32 ? shoulderY - 12 : 29;
  return <g aria-label={phase}>
    <line x1="7" y1="116" x2="93" y2="116" stroke="#314155" strokeWidth="1" />
    {(equipment.includes('Bar') || equipment.includes('bar')) && <g stroke="#9fb0c4" strokeWidth="2.5" fill="#314155"><line x1="15" y1={barY} x2="85" y2={barY} /><rect x="13" y={barY - 5} width="5" height="10" rx="1" /><rect x="82" y={barY - 5} width="5" height="10" rx="1" /></g>}
    {(equipment.includes('dambıl') || equipment.includes('Dambıl') || equipment.includes('Dumbbell')) && <g fill="#91a3b8"><circle cx={leftHandX} cy={armY} r="3.5" /><circle cx={rightHandX} cy={armY} r="3.5" /></g>}
    <path d={`M ${shoulderX - 7} ${shoulderY} Q ${shoulderX} ${shoulderY - 4} ${shoulderX + 7} ${shoulderY} L ${hipX + 7} ${hipY - 2} Q ${hipX} ${hipY + 3} ${hipX - 7} ${hipY - 2} Z`} fill="#a9bacd" stroke="#d1deea" strokeWidth="1.4" />
    {muscles.slice(0, 3).map((muscle) => { const [mx, my] = HOTSPOT[muscle]; return <circle key={muscle} cx={mx} cy={my + (hipY - 61) * (my > 55 ? 0.25 : 0)} r="6.3" fill="#54e69d" fillOpacity=".82" stroke="#bdffd9" strokeWidth=".9" />; })}
    <circle cx={headX} cy={headY} r="7" fill="#c5d2e0" stroke="#e4edf5" strokeWidth="1.2" />
    <g fill="none" stroke="#b5c5d5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M ${shoulderX - 4} ${shoulderY + 1} L ${leftElbow[0]} ${leftElbow[1]} L ${leftHandX} ${armY}`} />
      <path d={`M ${shoulderX + 4} ${shoulderY + 1} L ${rightElbow[0]} ${rightElbow[1]} L ${rightHandX} ${armY}`} />
      <path d={`M ${hipX - 4} ${hipY} L ${leftKnee[0]} ${kneeY} L ${leftKnee[0] - 4 - wide * .25} ${110 - lift}`} />
      <path d={`M ${hipX + 4} ${hipY} L ${rightKnee[0]} ${kneeY} L ${rightKnee[0] + 4 + wide * .25} ${110 - lift}`} />
    </g>
    <circle cx={leftKnee[0]} cy={kneeY} r="2.5" fill="#e4edf5" /><circle cx={rightKnee[0]} cy={kneeY} r="2.5" fill="#e4edf5" />
  </g>;
}

function MovementIllustration({ exercise, compact = false }: { exercise: ExerciseDefinition; compact?: boolean }) {
  const gradientId = `movement-glow-${useId().replace(/:/g, '')}`;
  const guide = getGuide(exercise);
  const mapping = mapExerciseMuscles(exercise);
  const primary = mapping?.primary ?? [];
  return <div className={`movement-illustration${compact ? ' movement-illustration--compact' : ''}`}>
    <svg viewBox="0 0 250 145" role="img" aria-label={`${exercise.name}: iki aşamalı hareket önizlemesi`}>
      <defs><linearGradient id={gradientId} x1="0" x2="1"><stop stopColor="#17382c" /><stop offset="1" stopColor="#17293b" /></linearGradient></defs>
      <rect x="3" y="3" width="244" height="139" rx="16" fill={`url(#${gradientId})`} />
      <g transform="translate(11 8) scale(.83)"><Figure pose={guide.start} muscles={primary} equipment={guide.equipment} pattern={guide.pattern} phase="Başlangıç pozu" /></g>
      <path d="M108 69h31m-7-7 7 7-7 7" fill="none" stroke="#69e5a1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(140 8) scale(.83)"><Figure pose={guide.finish} muscles={primary} equipment={guide.equipment} pattern={guide.pattern} phase="Hareket sonu pozu" /></g>
      <text x="50" y="134" textAnchor="middle" fill="#a9bbce" fontSize="9" fontWeight="700">BAŞLANGIÇ</text>
      <text x="190" y="134" textAnchor="middle" fill="#8deeb4" fontSize="9" fontWeight="700">HAREKET</text>
    </svg>
  </div>;
}

function ExerciseCard({ exercise, sets, selected, onSelect }: { exercise: ExerciseDefinition; sets: number; selected: boolean; onSelect: () => void }) {
  const guide = getGuide(exercise);
  const muscles = mapExerciseMuscles(exercise)?.primary ?? [];
  return <button type="button" className={`movement-card${selected ? ' is-selected' : ''}`} aria-label={`${exercise.name}: ${selected ? 'önizlemeyi kapat' : 'önizlemeyi aç'}`} aria-expanded={selected} aria-controls={selected ? 'movement-detail' : undefined} onClick={onSelect}>
    <MovementIllustration exercise={exercise} compact />
    <span className="movement-card__meta"><span>{exercise.category}</span>{sets > 0 && <span>{sets} set kaydı</span>}</span>
    <strong>{exercise.name}</strong>
    <span className="movement-card__footer"><span>{guide.label}</span><span>{muscles.length ? MUSCLE_LABELS[muscles[0]] : 'Hareket rehberi'}</span></span>
  </button>;
}

export default function MovementLibrary({ exercises, workouts }: { exercises: ExerciseDefinition[]; workouts: LegacyWorkout[] }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const [selectedId, setSelectedId] = useState('');
  const categories = useMemo(() => ['Tümü', ...Array.from(new Set(exercises.map((item) => item.category))).sort((a, b) => a.localeCompare(b, 'tr'))], [exercises]);
  const tailoredCount = useMemo(() => exercises.filter(hasExerciseCoaching).length, [exercises]);
  const setCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workout of workouts) for (const item of workout.gymExercises ?? []) counts.set(item.exerciseId, (counts.get(item.exerciseId) ?? 0) + item.sets.length);
    return counts;
  }, [workouts]);
  const filtered = useMemo(() => exercises.filter((exercise) => {
    const matchesCategory = activeCategory === 'Tümü' || exercise.category === activeCategory;
    const haystack = `${exercise.name} ${exercise.category} ${exercise.footballTag ?? ''}`.toLocaleLowerCase('tr-TR');
    return matchesCategory && haystack.includes(query.trim().toLocaleLowerCase('tr-TR'));
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr')), [exercises, activeCategory, query]);
  const selected = filtered.find((item) => item.id === selectedId);
  const selectedGuide = selected ? getGuide(selected) : null;
  const selectedMuscles = selected ? mapExerciseMuscles(selected) : undefined;

  return <section className="movement-library" aria-labelledby="movement-library-title">
    <header className="movement-heading"><div><p className="extended-kicker">HAREKET REHBERİ</p><h2 id="movement-library-title">Hareket önizlemeleri</h2><p>Arayıp filtrele; her katalog hareketi için kurulum, adım adım uygulama, teknik odağı ve kolaylaştırma/ilerletme seçeneklerini incele.</p><p className="movement-coverage">{tailoredCount} / {exercises.length} harekete özel içerik · diğer hareketlerde genel şablon</p></div><div className="movement-count"><strong>{exercises.length}</strong><span>hareket</span></div></header>
    <div className="movement-tools"><label className="movement-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(''); }} placeholder="Hareket ara…" aria-label="Hareket ara" /></label><span className="movement-results" aria-live="polite">{filtered.length} hareket gösteriliyor</span></div>
    <div className="movement-categories" role="group" aria-label="Hareket kategorisi">{categories.map((category) => <button type="button" key={category} className={activeCategory === category ? 'active' : ''} aria-pressed={activeCategory === category} onClick={() => { setActiveCategory(category); setSelectedId(''); }}>{category}</button>)}</div>
    {selected && selectedGuide && <article id="movement-detail" className="movement-detail" aria-labelledby="movement-detail-title">
      <div className="movement-detail__visual"><MovementIllustration exercise={selected} /></div>
      <div className="movement-detail__copy">
        <div className="movement-detail__top"><div><p className="extended-kicker">{selected.category} · {selectedGuide.label}</p><h3 id="movement-detail-title">{selected.name}</h3><span className={`movement-guide-badge${selectedGuide.tailored ? ' is-tailored' : ''}`}>{selectedGuide.tailored ? 'Harekete özel rehber' : 'Genel hareket şablonu'}</span></div><button type="button" className="movement-detail__close" onClick={() => setSelectedId('')} aria-label="Hareket önizlemesini kapat">×</button></div>
        <div className="movement-muscles">{selectedMuscles?.primary.map((muscle) => <span className="primary" key={muscle}>{MUSCLE_LABELS[muscle]}</span>)}{selectedMuscles?.secondary.map((muscle) => <span key={muscle}>{MUSCLE_LABELS[muscle]}</span>)}{!selectedMuscles?.primary.length && <span>Teknik / mobilite</span>}</div>
        <section className="movement-guide-section"><h4>Kurulum</h4><p>{selectedGuide.setup}</p></section>
        <section className="movement-guide-section"><h4>Uygulama adımları</h4><ol className="movement-steps">{selectedGuide.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol></section>
        <div className="movement-coaching-grid">
          <section className="movement-coaching-note is-focus"><h4>Teknik odağı</h4><p>{selectedGuide.cue}</p></section>
          <section className="movement-coaching-note is-caution"><h4>Sık hata / dikkat</h4><p>{selectedGuide.watchOut}</p></section>
          <section className="movement-coaching-note"><h4>Kolaylaştır</h4><p>{selectedGuide.easier}</p></section>
          <section className="movement-coaching-note"><h4>İlerlet</h4><p>{selectedGuide.harder}</p></section>
        </div>
        <p className="movement-equipment"><span>Ekipman</span>{selectedGuide.equipment}</p>
        {selected.footballTag && <p className="movement-football-tag">⚽ {selected.footballTag}</p>}
        {setCounts.get(selected.id) ? <p className="movement-history">Kişisel kayıtlarında {setCounts.get(selected.id)} set bulunuyor.</p> : <p className="movement-history">Bu hareket için henüz kişisel set kaydı yok.</p>}
      </div>
    </article>}
    {filtered.length ? <div className="movement-grid">{filtered.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} sets={setCounts.get(exercise.id) ?? 0} selected={selectedId === exercise.id} onSelect={() => setSelectedId(selectedId === exercise.id ? '' : exercise.id)} />)}</div> : <div className="movement-empty"><span>⌕</span><strong>Hareket bulunamadı</strong><p>Arama kelimesini veya kategori filtresini değiştir.</p></div>}
    <p className="movement-disclaimer">Harekete özel notlar genel teknik bilgilendirmedir; kişisel antrenör değerlendirmesi veya tıbbi tavsiye değildir. Görseller şematiktir, gerçek video değildir. Ağrı veya sağlık kaygısında hareketi bırakıp uygun bir uzmana danış.</p>
  </section>;
}
