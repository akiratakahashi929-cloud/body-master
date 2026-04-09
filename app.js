/* ============================================================
   BODY MASTER v2 — app.js
   体系管理 & 筋トレ DX ツール
   ============================================================ */

// ==================== STATE ====================
const APP = {
  gasUrl: localStorage.getItem('gasUrl') || 'https://script.google.com/macros/s/AKfycbz6RkpFaz0Wm5qP2etNdYafG3lD89gkp8s0YilYa_NgY0-4PlHiNd_xJYQThM3lKSTU/exec',
  kvUrl: localStorage.getItem('kvUrl') || '',
  kvToken: localStorage.getItem('kvToken') || '',
  schemaVersion: 2,
  profile: JSON.parse(localStorage.getItem('profile') || 'null') || {
    height: 168, weight: 82.7, age: 32, gender: 'male',
    activity: 1.375, deficit: 500, targetLoss: 10, waist: 0
  },
  dailyLogs: JSON.parse(localStorage.getItem('dailyLogs') || '[]'),
  trainingLogs: JSON.parse(localStorage.getItem('trainingLogs') || '[]'),
  mealPlans: JSON.parse(localStorage.getItem('mealPlans') || '{}'),
  todayExercises: [],
  customExercises: JSON.parse(localStorage.getItem('customExercises') || '[]'),
  settings: JSON.parse(localStorage.getItem('appSettings') || 'null') || {
    maxWeight: 150, maxReps: 30
  },
  exerciseWeightSettings: JSON.parse(localStorage.getItem('exerciseWeightSettings') || 'null') || {},
  calendarDate: new Date(),
  selectedDate: null,
  restPresets: JSON.parse(localStorage.getItem('restPresets') || '[60, 90, 120, 180]'),
  routines: JSON.parse(localStorage.getItem('routines') || '[]'),
  soundSettings: JSON.parse(localStorage.getItem('soundSettings') || 'null') || {
    volume: 0.7,
    soundType: 'sporty',
    countdownEnabled: true,
    restDefaultTime: 90
  },
};

// デバイス判定（スマホ = true）
const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);


const ICON_PLAY = '<i class="ph ph-play ph-inline"></i>';
const ICON_PAUSE = '<i class="ph ph-pause ph-inline"></i>';

const MUSCLE_CATEGORIES = ['脚', '胸', '背筋', '肩', '腕', '腹筋', 'カーディオ'];

function isSerializedSvgText(value) {
  const s = String(value || '');
  return /(?:<|&lt;)svg\b/i.test(s);
}

function stripSerializedSvgText(value) {
  return String(value || '')
    .replace(/&lt;svg[\s\S]*?&lt;\/svg&gt;/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeExerciseName(value) {
  const cleaned = stripSerializedSvgText(value).replace(/[<>]/g, '').trim();
  if (!cleaned) return '';
  return cleaned.slice(0, 80);
}

function sanitizeCategory(value) {
  const raw = stripSerializedSvgText(value);
  if (MUSCLE_CATEGORIES.includes(raw)) return raw;
  const inferred = MUSCLE_CATEGORIES.find(cat => raw.includes(cat));
  return inferred || '胸';
}

function sanitizePersistedData() {
  let changed = false;

  if (!Array.isArray(APP.customExercises)) APP.customExercises = [];
  const sanitizedCustom = APP.customExercises
    .map((item, idx) => {
      const name = sanitizeExerciseName(item?.name);
      if (!name) return null;
      return {
        id: item?.id || `custom_${Date.now()}_${idx}`,
        name,
        category: sanitizeCategory(item?.category),
        freq: Number.isFinite(Number(item?.freq)) ? Number(item.freq) : 0,
        isCustom: true,
      };
    })
    .filter(Boolean);

  if (JSON.stringify(sanitizedCustom) !== JSON.stringify(APP.customExercises)) {
    APP.customExercises = sanitizedCustom;
    localStorage.setItem('customExercises', JSON.stringify(APP.customExercises));
    changed = true;
  }

  if (!Array.isArray(APP.routines)) APP.routines = [];
  const sanitizedRoutines = APP.routines.map((r, idx) => ({
    id: r?.id || `r_${Date.now()}_${idx}`,
    name: sanitizeExerciseName(r?.name) || `ルーティーン${idx + 1}`,
    color: typeof r?.color === 'string' ? r.color : '#CE1141',
    label: typeof r?.label === 'string' ? r.label : 'A',
    exercises: Array.isArray(r?.exercises)
      ? r.exercises.map(sanitizeExerciseName).filter(Boolean)
      : [],
  }));

  if (JSON.stringify(sanitizedRoutines) !== JSON.stringify(APP.routines)) {
    APP.routines = sanitizedRoutines;
    localStorage.setItem('routines', JSON.stringify(APP.routines));
    changed = true;
  }

  if (changed) console.info('legacy data sanitized');
}

function normalizeCategorySelectOptions() {
  const optionsHtml = MUSCLE_CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('');
  ['new-exercise-category', 'em-category'].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const current = sanitizeCategory(select.value);
    select.innerHTML = optionsHtml;
    select.value = current;
  });
}

function cleanupLegacyIconFields(modalRoot) {
  if (!modalRoot) return;
  modalRoot.querySelectorAll('.form-group').forEach((group) => {
    const label = group.querySelector('.form-label');
    const labelText = (label?.textContent || '').trim();
    const hasLegacyLabel = /アイコン|絵文字|Phosphor/i.test(labelText);
    const hasLegacyInput = !!group.querySelector(
      '#em-icon, #new-exercise-icon, [id*="icon"][type="text"], [name*="icon"]'
    );
    if (hasLegacyLabel || hasLegacyInput) {
      group.remove();
    }
  });
}

function normalizeLegacyCorruptedUI() {
  normalizeCategorySelectOptions();
  ensureCalorieStreakDom();

  ['exercise-manage-modal', 'add-exercise-modal'].forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    cleanupLegacyIconFields(modal);

    modal.querySelectorAll('*').forEach((node) => {
      if (node.children.length > 0) return;
      const txt = (node.textContent || '').trim();
      if (!isSerializedSvgText(txt)) return;
      if (node.classList.contains('modal__title')) return;
      const cleaned = sanitizeExerciseName(txt);
      if (cleaned) node.textContent = cleaned;
    });
  });

  const emTitle = document.getElementById('exercise-manage-modal-title');
  if (emTitle && isSerializedSvgText(emTitle.textContent || '')) {
    emTitle.textContent = (emTitle.textContent || '').includes('編集') ? '種目を編集' : '種目を追加';
  }

  const streak = document.getElementById('ct-streak');
  if (streak && isSerializedSvgText(streak.textContent || '')) {
    streak.textContent = '0';
  }
}

// ==================== MEAL INGREDIENTS DATABASE ====================
const INGREDIENTS_DB = {
  'white_rice':     { name: '白米(炊飯)', p: 2.5, f: 0.3, c: 37.1, kcal: 156 },
  'brown_rice':     { name: '玄米(炊飯)', p: 3.0, f: 1.2, c: 35.6, kcal: 152 },
  'barley':         { name: '押麦(茹で)', p: 2.3, f: 0.3, c: 24.3, kcal: 105 },
  'mixed_rice':     { name: 'ミックスご飯', p: 2.6, f: 0.6, c: 34.1, kcal: 145 },
  'potato':         { name: 'じゃがいも', p: 1.5, f: 0.1, c: 14.8, kcal: 59 },
  'chicken_breast': { name: '鶏胸肉(皮無)', p: 24.4, f: 1.9, c: 0.1, kcal: 116 },
  'mackerel_can':   { name: 'サバ缶(190g)', p: 20.9, f: 10.7, c: 0.2, kcal: 190, fixedAmount: 190 }, // ※100gあたり
  'egg':            { name: '卵(全卵)', p: 12.3, f: 10.3, c: 0.9, kcal: 142 },
  'niboshi':        { name: 'カタクチイワシ煮干し', p: 64.5, f: 6.2, c: 0.3, kcal: 332 },
  'wakame':         { name: 'わかめ(乾燥)', p: 13.6, f: 1.6, c: 41.3, kcal: 117 },
  'daikon':         { name: '切り干し大根(乾燥)', p: 9.7, f: 0.8, c: 75.8, kcal: 277 },
  'walnut':         { name: 'くるみ(いり)', p: 14.6, f: 68.8, c: 11.7, kcal: 674 },
  'multi_v':        { name: 'マルチV&M', p: 0, f: 0, c: 0, kcal: 0 },
  'vit_d_ca':       { name: 'VitD&Ca', p: 0, f: 0, c: 0, kcal: 0 },
  'potassium':      { name: 'カリウム', p: 0, f: 0, c: 0, kcal: 0 }
};

let currentMealDraft = [];
let targetPFC = { p: 0, f: 0, c: 0, kcal: 0 };
let currentMealDate = '';

function calculateMealTargets(phase, weight, intensity = 'mid') {
  let targets = { p: 0, f: 0, c: 0, kcal: 0 };
  let pRatio, fRatio, cRatio;
  
  switch (phase) {
    case 'phase1': 
      pRatio = 2.2; fRatio = 0.9;
      if (intensity === 'high') cRatio = 2.5; else if (intensity === 'rest') cRatio = 1.5; else cRatio = 2.0;
      break;
    case 'phase2': 
      pRatio = 2.2; fRatio = 0.9;
      if (intensity === 'high') cRatio = 3.5; else if (intensity === 'rest') cRatio = 2.0; else cRatio = 2.8;
      break;
    case 'phase3': 
      pRatio = 2.0; fRatio = 1.0; 
      if (intensity === 'high') cRatio = 4.0; else if (intensity === 'rest') cRatio = 2.5; else cRatio = 3.5;
      break;
    case 'phase4': 
      pRatio = 2.5; fRatio = 0.8;
      if (intensity === 'high') cRatio = 3.5; else if (intensity === 'rest') cRatio = 1.5; else cRatio = 2.5;
      break;
    default:       
      pRatio = 2.0; fRatio = 0.9; cRatio = 2.5; break;
  }
  
  targets.p = Math.round(weight * pRatio);
  targets.f = Math.round(weight * fRatio);
  targets.c = Math.round(weight * cRatio);
  targets.kcal = targets.p * 4 + targets.f * 9 + targets.c * 4;
  return targets;
}

// ==================== EXERCISE DATABASE ====================
const DEFAULT_EXERCISES = [
  { name: 'バックスクワット', category: '脚', freq: 36, muscles: ['大腿四頭筋','ハムストリング','臀筋','脊柱起立筋'] },
  { name: 'レッグプレス', category: '脚', freq: 47, muscles: ['大腿四頭筋','臀筋'] },
  { name: 'レッグエクステンション', category: '脚', freq: 41, muscles: ['大腿四頭筋'] },
  { name: 'シーテッドレッグカール', category: '脚', freq: 63, muscles: ['ハムストリング'] },
  { name: 'ヒップアブダクションマシン', category: '脚', freq: 42, muscles: ['臀筋','内転筋'] },
  { name: 'ダンベルブルガリアンスプリットスクワット', category: '脚', freq: 33, muscles: ['大腿四頭筋','臀筋','ハムストリング'] },
  { name: 'インクラインダンベルベンチプレス', category: '胸', freq: 54, muscles: ['大胸筋上部','三角筋前部','上腕三頭筋'] },
  { name: 'ディップチンアシスト', category: '胸', freq: 67, muscles: ['大胸筋下部','上腕三頭筋','三角筋前部'] },
  { name: 'スミスマシンインクラインベンチプレス', category: '胸', freq: 31, muscles: ['大胸筋上部','三角筋前部','上腕三頭筋'] },
  { name: 'ラットプルダウン', category: '背筋', freq: 53, muscles: ['広背筋','僧帽筋','上腕二頭筋'] },
  { name: 'シーテッドケーブルロウ', category: '背筋', freq: 63, muscles: ['広背筋','僧帽筋','脊柱起立筋','上腕二頭筋'] },
  { name: 'パラレルグリップラットプルダウン', category: '背筋', freq: 56, muscles: ['広背筋','僧帽筋','上腕二頭筋'] },
  { name: 'ストレートアームプルダウン', category: '背筋', freq: 40, muscles: ['広背筋','腹直筋下部'] },
  { name: 'アシストプルアップマシン', category: '背筋', freq: 34, muscles: ['広背筋','上腕二頭筋','僧帽筋'] },
  { name: 'ダンベルサイドレイズ', category: '肩', freq: 81, muscles: ['三角筋側部'] },
  { name: 'シーテッドダンベルショルダープレス', category: '肩', freq: 50, muscles: ['三角筋前部','三角筋側部','上腕三頭筋'] },
  { name: 'リアデルトフライマシン', category: '肩', freq: 56, muscles: ['三角筋後部','僧帽筋'] },
  { name: 'ダンベルアップライトロウ', category: '肩', freq: 32, muscles: ['三角筋側部','僧帽筋'] },
  { name: 'ケーブルプレスダウン', category: '腕', freq: 41, muscles: ['上腕三頭筋'] },
  { name: 'ハンギングレッグレイズ', category: '腹筋', freq: 45, muscles: ['腹直筋下部','腸腰筋','腹斜筋'] },
  { name: 'トレッドミル', category: 'カーディオ', freq: 49, muscles: ['大腿四頭筋','ハムストリング','腓腹筋'] },
];

// Exercise name → detailed muscles (for recovery tracking)
// category → detailed muscles fallback (when exercise has no muscles array)
const CATEGORY_MUSCLES_MAP = {
  '胸': ['大胸筋上部','大胸筋下部'],
  '背筋': ['広背筋','僧帽筋','脊柱起立筋'],
  '肩': ['三角筋前部','三角筋側部','三角筋後部'],
  '腕': ['上腕二頭筋','上腕三頭筋','前腕'],
  '脚': ['大腿四頭筋','ハムストリング','臀筋','腓腹筋','内転筋'],
  '腹筋': ['腹直筋上部','腹直筋下部','腹斜筋'],
  'カーディオ': ['大腿四頭筋','ハムストリング','腓腹筋'],
};

function getExerciseMuscles(exercise) {
  if (exercise.muscles && exercise.muscles.length > 0) return exercise.muscles;
  return CATEGORY_MUSCLES_MAP[exercise.category] || [];
}

function getAllExercises() {
  return [...DEFAULT_EXERCISES, ...APP.customExercises];
}

/*
 * Evidence-Based Recovery Hours per Muscle Group
 * ================================================
 * Based on Muscle Protein Synthesis (MPS) research:
 *   - MPS peaks at ~24h post-exercise, returns to baseline at 36-48h
 *     for trained individuals (Phillips et al., J Physiol, 2005; PubMed NIH)
 *   - Larger muscles with higher eccentric load demand 48-72h
 *     (ACSM Guidelines; Zatsiorsky & Kraemer, 2006)
 *   - Small muscles (biceps, triceps, delts) recover in 36-48h
 *   - Abs/core: high oxidative fiber % → faster recovery (24-36h)
 *   - Lower body compound muscles (quads, hams, glutes): 48-72h
 *     (Häkkinen et al., Eur J Appl Physiol; NIH PubMed)
 *   - Erector spinae / posterior chain: 48-72h due to sustained
 *     isometric load in compound lifts (NIH PubMed)
 *
 * Sleep Efficiency Model:
 *   - Baseline: 7.5h (National Sleep Foundation recommended for adults)
 *   - <7h: cortisol ↑ 37%, GH release ↓ 60-70% → recovery延長 ~20-30%
 *   - >8h: marginally improved recovery (~5-10% faster)
 *   - Formula: efficiency = (sleep / 7.5) ^ 0.6 (diminishing returns curve)
 *     Applies as divisor to base hours → less sleep = longer recovery
 *   (Reilly & Edwards, J Sports Sci; Dáttilo et al., Sleep Med Rev, 2011)
 */
const RECOVERY_BASE = {
  // 胸 — MPS 36-48h; bench press recovery studied at 48h (Paulsen et al.)
  '大胸筋上部':   { hours: 48, displayName: '大胸筋 上部', group: '胸' },
  '大胸筋下部':   { hours: 48, displayName: '大胸筋 下部', group: '胸' },

  // 肩 — 三角筋 small-to-medium muscle; 36-48h (NSCA guidelines)
  '三角筋前部':   { hours: 40, displayName: '三角筋 前部', group: '肩' },
  '三角筋側部':   { hours: 36, displayName: '三角筋 側部', group: '肩' },
  '三角筋後部':   { hours: 36, displayName: '三角筋 後部', group: '肩' },

  // 背筋 — 僧帽筋: medium 40-48h; 広背筋: large 48-72h; 脊柱起立筋: sustained load 48-72h
  '僧帽筋':       { hours: 48, displayName: '僧帽筋', group: '背筋' },
  '広背筋':       { hours: 60, displayName: '広背筋', group: '背筋' },
  '脊柱起立筋':   { hours: 60, displayName: '脊柱起立筋', group: '背筋' },

  // 腕 — small muscles; MPS returns to baseline at 24-36h for trained (Phillips et al.)
  '上腕二頭筋':   { hours: 36, displayName: '上腕二頭筋', group: '腕' },
  '上腕三頭筋':   { hours: 36, displayName: '上腕三頭筋', group: '腕' },
  '前腕':         { hours: 30, displayName: '前腕', group: '腕' },

  // 腹筋 — high oxidative fiber content → rapid recovery (Häkkinen; NSCA)
  '腹直筋上部':   { hours: 24, displayName: '腹直筋 上部', group: '腹筋' },
  '腹直筋下部':   { hours: 24, displayName: '腹直筋 下部', group: '腹筋' },
  '腹斜筋':       { hours: 24, displayName: '腹斜筋', group: '腹筋' },

  // 脚 — large muscles with high eccentric demand; 48-72h (ACSM; NIH research)
  '腸腰筋':       { hours: 40, displayName: '腸腰筋', group: '脚' },
  '大腿四頭筋':   { hours: 60, displayName: '大腿四頭筋', group: '脚' },
  '内転筋':       { hours: 48, displayName: '内転筋', group: '脚' },
  'ハムストリング': { hours: 60, displayName: 'ハムストリング', group: '脚' },
  '臀筋':         { hours: 56, displayName: '臀筋', group: '脚' },
  '腓腹筋':       { hours: 40, displayName: '腓腹筋', group: '脚' },
};

/*
 * Sleep Efficiency: formula = (sleepHours / baseline) ^ 0.6
 * - At 5h sleep: efficiency = 0.76 → recovery takes ~32% longer
 * - At 7.5h: efficiency = 1.0 (baseline)
 * - At 9h: efficiency = 1.11 → recovery ~10% faster
 */
const SLEEP_BASELINE = 7.5;

// ==================== INITIALIZATION ====================
// ==================== AUDIO SYSTEM (Global) ====================
let _audioCtx = null;
let _restCountdownBeeped = new Set();
let _timerCountdownBeeped = new Set();

function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}

function unlockAudioCtx() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        // iOSアンロック: サイレントバッファを再生
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      });
    }
  } catch(e) {}
}

// 音量ヘルパー
function getSoundVolume() {
  return Math.max(0.05, APP.soundSettings?.volume ?? 0.7);
}

// カウントダウンBeep — 3種類のサウンドタイプ対応
function playCountdownBeep(count) {
  if (!APP.soundSettings?.countdownEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const vol = getSoundVolume();
    const type = APP.soundSettings?.soundType || 'sporty';

    if (type === 'sporty') {
      // スポーティー: square/sawtooth, 上升高難
      const freqMap = { 5: 440, 4: 494, 3: 587, 2: 659, 1: 880 };
      const freq = freqMap[count] || 440;
      const isOne = count === 1;
      const dur = isOne ? 0.22 : 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = isOne ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq, now);
      if (isOne) osc.frequency.linearRampToValueAtTime(freq * 1.15, now + dur);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * 0.85, now + 0.01);
      gain.gain.setValueAtTime(vol * 0.85, now + dur * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.05);
      osc.start(now); osc.stop(now + dur + 0.06);

    } else if (type === 'soft') {
      // 時報（NHK風）: 純粋な440Hz サイン波、count1のみ880Hzで長め
      // 実際のNHK方式: 全pip = 440Hz、最終合図 = 880Hz
      const freq = (count === 1) ? 880 : 440;
      const dur  = (count === 1) ? 0.18 : 0.07;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 5000;
      filt.Q.value = 0.5;
      osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      // 極細エンベロープ（NHK時報のような "コッ" 感）
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * 0.88, now + 0.005);
      gain.gain.setValueAtTime(vol * 0.88, now + dur * 0.70);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur + 0.04);
      osc.start(now); osc.stop(now + dur + 0.06);

    } else {  // RPG (8ビット JRPG風)
      // ディスコントックな2音ブリップ、スクエア波
      const f1Map = { 5: 262, 4: 330, 3: 392, 2: 523, 1: 784 };
      const f2Map = { 5: 330, 4: 392, 3: 523, 2: 659, 1: 1047 };
      const f1 = f1Map[count] || 262, f2 = f2Map[count] || 330;
      [[f1, 0], [f2, 0.1]].forEach(([freq, offset]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(vol * 0.45, now + offset);
        gain.gain.setValueAtTime(vol * 0.45, now + offset + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
        osc.start(now + offset); osc.stop(now + offset + 0.12);
      });
    }
  } catch(e) { console.warn('Beep error:', e); }
}

// 完了音 — 3種類対応ファンファーレ
function playTimerEndSound() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const vol = getSoundVolume();
    const type = APP.soundSettings?.soundType || 'sporty';

    if (type === 'sporty') {
      // スポーティー: C→E→G→high C メジャーディミニッシュングファンファーレ
      [
        { freq: 523,  start: 0,    dur: 0.12, wt: 'square',   v: 0.75 },
        { freq: 659,  start: 0.13, dur: 0.12, wt: 'square',   v: 0.75 },
        { freq: 784,  start: 0.26, dur: 0.12, wt: 'sawtooth', v: 0.75 },
        { freq: 1047, start: 0.38, dur: 0.50, wt: 'sine',     v: 0.85 },
      ].forEach(({ freq, start, dur, wt, v }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = wt;
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(vol * v, now + start + 0.02);
        gain.gain.setValueAtTime(vol * v, now + start + dur * 0.65);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur + 0.06);
        osc.start(now + start); osc.stop(now + start + dur + 0.08);
      });

    } else if (type === 'soft') {
      // NHK時報完全再現: 車載成功口調で送信
      // 実際のNHK時報パターン:
      // 短く高いpip x3 (440Hz, 0.07sずつ) + 長く低いpip x1 (880Hz弘, 0.6s)
      const pipHz      = 440;   // 高澎 (NHK標準: 440Hz)
      const finalHz    = 880;   // 満澎
      const pipDur     = 0.07;  // 短いpipの音的期間
      const pipSpacing = 0.3;   // pip間のゴー（金属道ギャップ）
      const finalDur   = 0.60;  // 満放音
      const finalStart = pipSpacing * 3; // 0.9s後

      // pip 1, 2, 3
      [0, pipSpacing, pipSpacing * 2].forEach(startOffset => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 5000; f.Q.value = 0.5;
        o.connect(f); f.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(pipHz, now + startOffset);
        g.gain.setValueAtTime(0, now + startOffset);
        g.gain.linearRampToValueAtTime(vol * 0.85, now + startOffset + 0.005);
        g.gain.setValueAtTime(vol * 0.85, now + startOffset + pipDur * 0.75);
        g.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + pipDur + 0.05);
        o.start(now + startOffset);
        o.stop(now + startOffset + pipDur + 0.07);
      });

      // 満放音 (最後の長いpip)
      const oF = ctx.createOscillator();
      const gF = ctx.createGain();
      const fF = ctx.createBiquadFilter();
      fF.type = 'lowpass'; fF.frequency.value = 5000; fF.Q.value = 0.5;
      oF.connect(fF); fF.connect(gF); gF.connect(ctx.destination);
      oF.type = 'sine';
      oF.frequency.setValueAtTime(finalHz, now + finalStart);
      // 満放音エンベロープ: 短く立ち上がり → 雙曲線減衰
      gF.gain.setValueAtTime(0, now + finalStart);
      gF.gain.linearRampToValueAtTime(vol * 0.90, now + finalStart + 0.008);
      gF.gain.setValueAtTime(vol * 0.90, now + finalStart + finalDur * 0.70);
      gF.gain.exponentialRampToValueAtTime(0.0001, now + finalStart + finalDur + 0.10);
      oF.start(now + finalStart);
      oF.stop(now + finalStart + finalDur + 0.15);

    } else { // RPG — JRPG風アスケールファンファーレ (ドラクエ風)
      [
        { freq: 523.25, start: 0,    dur: 0.09, wt: 'square', v: 0.6 },
        { freq: 659.25, start: 0.1,  dur: 0.09, wt: 'square', v: 0.6 },
        { freq: 783.99, start: 0.2,  dur: 0.09, wt: 'square', v: 0.6 },
        { freq: 1046.5, start: 0.3,  dur: 0.09, wt: 'square', v: 0.65 },
        { freq: 1318.5, start: 0.40, dur: 0.28, wt: 'square', v: 0.65 },
        { freq: 1046.5, start: 0.42, dur: 0.50, wt: 'sine',   v: 0.35 },
      ].forEach(({ freq, start, dur, wt, v }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = wt;
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(vol * v, now + start);
        gain.gain.setValueAtTime(vol * v, now + start + dur * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.start(now + start); osc.stop(now + start + dur + 0.05);
      });
    }
  } catch(e) { console.warn('Sound error:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
  sanitizePersistedData();
  normalizeLegacyCorruptedUI();

  initParticles();
  loadProfile();
  renderCalendar();
  updateHomeStats();
  updateCalorieTracker();
  renderMealTab();
  updateGasConfigBanner();
  updateAnalysis();
  updateRecoveryView();
  initDailyListeners();
  ensureCalorieStreakDom();
  repairExerciseManageModalChrome();
  normalizeLegacyCorruptedUI();
  renderRestPresets();
  setupRippleEffect();
  setupMobileScrollFix();

  // 日付フィールドを今日にセット
  const today = new Date().toISOString().split('T')[0];
  const dailyDate = document.getElementById('daily-date');
  if (dailyDate) dailyDate.value = today;
  const hDailyDate = document.getElementById('h-daily-date');
  if (hDailyDate) hDailyDate.value = today;

  // ==================== セッション復元 ====================
  restoreSession();

  // ==================== フォームドラフト復元 ====================
  restoreFormDraft();

  // ==================== 自動保存（5秒ごと） ====================
  setInterval(autoSaveSession, 5000);

  // ==================== 定期クラウド同期（3分ごと） ====================
  setInterval(() => pushSyncToGas(), 3 * 60 * 1000);

  // ==================== ページ離脱前に保存 ====================
  window.addEventListener('beforeunload', () => {
    autoSaveSession();
    saveFormDraft();
    pushSyncToGas(true); // 同期beacon送信
  });

  // ==================== フォーム入力の自動保存（リアルタイム） ====================
  setupFormAutoSave();

  // ==================== 起動時にGASから最新データを取得（クラウド同期） ====================
  setTimeout(() => pullSyncFromGas(), 1500);

  // 初期描画直後にも一度実行（古いキャッシュ由来DOMの再汚染対策）
  setTimeout(normalizeLegacyCorruptedUI, 0);
});

// ==================== クラウド同期エンジン ====================

/**
 * GAS / Upstash KVにデータをプッシュ（全データを1つのJSONで送信）
 * immediate=trueのときはnavigator.sendBeacon/keepaliveを使う（ページ離脱時用）
 */
function pushSyncToGas(immediate = false) {
  if (!APP.gasUrl && !APP.kvUrl) return;
  const payload = buildSyncPayload();
  const body = JSON.stringify({ type: 'sync', data: payload });

  // 1. Upstash KV Sync
  if (APP.kvUrl && APP.kvToken) {
    const kvEp = `${APP.kvUrl.replace(/\/$/, '')}/set/bm_sync_data`;
    if (immediate) {
      fetch(kvEp, {
        method: 'POST', keepalive: true,
        headers: { 'Authorization': `Bearer ${APP.kvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(()=>{});
    } else {
      fetch(kvEp, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${APP.kvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(()=>{});
    }
  }

  // 2. GAS Sync
  if (APP.gasUrl) {
    if (immediate && navigator.sendBeacon) {
      navigator.sendBeacon(APP.gasUrl, body);
    } else {
      fetch(APP.gasUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body
      }).catch(() => {});
    }
  }
}

/**
 * リモートから最新データを取得してマージ
 * スマホ側データを優先（タイムスタンプが新しい方を採用）
 */
async function pullSyncFromGas() {
  if (!APP.gasUrl && !APP.kvUrl) return;
  try {
    showSyncIndicator('syncing');
    let remote = null;

    // Upstash KVがあれば優先する
    if (APP.kvUrl && APP.kvToken) {
      try {
        const res = await fetch(`${APP.kvUrl.replace(/\/$/, '')}/get/bm_sync_data`, {
          headers: { 'Authorization': `Bearer ${APP.kvToken}` }, cache: 'no-cache'
        });
        if (res.ok) {
          const json = await res.json();
          if (json.result) {
            remote = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
          }
        }
      } catch(e) { console.warn('KV GET error', e); }
    }

    // KVで取得できなかったらGASにフォールバック
    if (!remote && APP.gasUrl) {
      const res = await fetch(`${APP.gasUrl}?action=sync`, { method: 'GET', cache: 'no-cache' });
      if (!res.ok) { showSyncIndicator('offline'); return; }
      const json = await res.json();
      if (json.status !== 'ok' || !json.data) { showSyncIndicator('offline'); return; }
      remote = json.data;
    }

    if (!remote) { showSyncIndicator('offline'); return; }

    const remoteAt = new Date(remote._syncedAt || 0).getTime();
    const localAt  = parseInt(localStorage.getItem('bm_last_push') || '0', 10);

    // リモートが新しければマージ
    if (remoteAt > localAt) {
      applyRemoteData(remote);
      showSyncIndicator('synced');
      showToast(`クラウドから最新データを取得しました`, 'success');
    } else {
      showSyncIndicator('local');
    }
  } catch (e) {
    showSyncIndicator('offline');
    console.warn('同期エラー:', e);
  }
}

/**
 * リモートデータをlocalStorageとAPP stateに適用（スキーマ移行対応）
 */
function applyRemoteData(remote) {
  // スキーマバージョンチェック — 古いフィールドも壊さずにマージ
  if (remote.profile && Object.keys(remote.profile).length > 0) {
    APP.profile = Object.assign({}, APP.profile, remote.profile);
    localStorage.setItem('profile', JSON.stringify(APP.profile));
  }
  if (Array.isArray(remote.dailyLogs) && remote.dailyLogs.length >= (APP.dailyLogs || []).length) {
    APP.dailyLogs = remote.dailyLogs;
    localStorage.setItem('dailyLogs', JSON.stringify(APP.dailyLogs));
  }
  if (Array.isArray(remote.trainingLogs) && remote.trainingLogs.length >= (APP.trainingLogs || []).length) {
    APP.trainingLogs = remote.trainingLogs;
    localStorage.setItem('trainingLogs', JSON.stringify(APP.trainingLogs));
  }
  if (remote.mealPlans && Object.keys(remote.mealPlans).length >= Object.keys(APP.mealPlans || {}).length) {
    APP.mealPlans = Object.assign({}, APP.mealPlans, remote.mealPlans);
    localStorage.setItem('mealPlans', JSON.stringify(APP.mealPlans));
  }
  if (Array.isArray(remote.routines)) {
    APP.routines = remote.routines;
    localStorage.setItem('routines', JSON.stringify(APP.routines));
  }
  if (Array.isArray(remote.customExercises)) {
    APP.customExercises = remote.customExercises;
    localStorage.setItem('customExercises', JSON.stringify(APP.customExercises));
  }
  if (remote.soundSettings) {
    APP.soundSettings = Object.assign({}, APP.soundSettings, remote.soundSettings);
    localStorage.setItem('soundSettings', JSON.stringify(APP.soundSettings));
  }
  if (remote.exerciseWeightSettings) {
    APP.exerciseWeightSettings = Object.assign({}, APP.exerciseWeightSettings, remote.exerciseWeightSettings);
    localStorage.setItem('exerciseWeightSettings', JSON.stringify(APP.exerciseWeightSettings));
  }
  // profileLocked状態を復元
  if (remote._profileLocked) {
    localStorage.setItem('profileLocked', '1');
  }
  localStorage.setItem('bm_last_push', String(new Date(remote._syncedAt || 0).getTime()));

  // 画面を再描画
  loadProfile();
  renderCalendar();
  updateHomeStats();
  updateCalorieTracker();
  updateAnalysis();
  updateRecoveryView();
}

/**
 * 同期用ペイロードを構築
 */
function buildSyncPayload() {
  return {
    _syncedAt: new Date().toISOString(),
    _schemaVersion: APP.schemaVersion || 2,
    _deviceType: IS_MOBILE ? 'mobile' : 'desktop',
    profile: APP.profile,
    dailyLogs: APP.dailyLogs,
    trainingLogs: APP.trainingLogs,
    mealPlans: APP.mealPlans,
    customExercises: APP.customExercises,
    routines: APP.routines,
    soundSettings: APP.soundSettings,
    exerciseWeightSettings: APP.exerciseWeightSettings,
    _profileLocked: !!localStorage.getItem('profileLocked'),
  };
}

/**
 * 手動同期（設定画面のボタンから呼ばれる）
 */
async function manualSync() {
  showToast('クラウドと同期中...', 'success');
  pushSyncToGas();
  await pullSyncFromGas();
  // push後に最新タイムスタンプを更新
  localStorage.setItem('bm_last_push', Date.now().toString());
}

/**
 * 同期インジケーターを表示
 */
function showSyncIndicator(state) {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  const states = {
    syncing: { text: '同期中...', color: '#888' },
    synced:  { text: 'クラウド同期済', color: '#00C853' },
    local:   { text: 'ローカル最新', color: '#FFB300' },
    offline: { text: 'オフライン', color: '#666' },
  };
  const s = states[state] || states.offline;
  el.textContent = s.text;
  el.style.color = s.color;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 4000);
}

// ==================== 自動保存 / 復元 システム ====================

const SESSION_KEY = 'bm_session_draft';
const FORM_KEY = 'bm_form_draft';

/**
 * トレーニングセッション（今日のメニュー + セットデータ）を保存
 */
function autoSaveSession() {
  if (!APP.todayExercises || APP.todayExercises.length === 0) return;
  const sessionData = {
    savedAt: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    todayExercises: JSON.parse(JSON.stringify(APP.todayExercises)),
    trainingElapsed: document.getElementById('training-elapsed')?.textContent || '00:00:00',
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    // バッジ表示
    showSessionSavedBadge();
  } catch(e) { console.warn('セッション保存エラー:', e); }
}

/**
 * 起動時にセッション復元を確認・実行
 */
function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data.todayExercises || data.todayExercises.length === 0) return;

    // 今日のセッションかどうか確認
    const today = new Date().toISOString().split('T')[0];
    if (data.date !== today) {
      // 昨日以前のデータは自動削除
      localStorage.removeItem(SESSION_KEY);
      return;
    }

    // セッションが既にある（提出済み）場合はスキップ
    const hasRecorded = data.todayExercises.some(e => e.recorded);
    const savedAt = new Date(data.savedAt);
    const minutesAgo = Math.round((Date.now() - savedAt.getTime()) / 60000);

    // 通知バナーを表示
    showSessionRestoreBanner(data.todayExercises.length, minutesAgo, () => {
      APP.todayExercises = data.todayExercises;
      renderTodayMenu();
      switchSection('sec-training');
      showToast(`${data.todayExercises.length}種目のセッションを復元しました！`, 'success');
    });
  } catch(e) { console.warn('セッション復元エラー:', e); }
}

function showSessionRestoreBanner(exerciseCount, minutesAgo, onRestore) {
  const banner = document.createElement('div');
  banner.id = 'session-restore-banner';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: linear-gradient(135deg, #1A1A1A, #2D2D2D);
    border-bottom: 2px solid var(--victory-gold);
    padding: 12px 16px;
    display: flex; align-items: center; gap: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    animation: slideDown 0.3s ease;
  `;
  banner.innerHTML = `
    <div style="font-size:24px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
    <div style="flex:1;">
      <div style="font-size:13px;font-weight:700;color:#fff;">前回のトレーニングセッションが見つかりました</div>
      <div style="font-size:11px;color:#888;">${exerciseCount}種目 · ${minutesAgo}分前に自動保存</div>
    </div>
    <button onclick="restoreSessionNow()" style="
      background:var(--victory-gold);color:#000;border:none;
      padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;">
      復元する
    </button>
    <button onclick="dismissSessionBanner()" style="
      background:rgba(255,255,255,0.1);color:#888;border:none;
      padding:8px 12px;border-radius:8px;font-size:12px;cursor:pointer;">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;display:inline-block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  document.body.appendChild(banner);

  // onRestoreをグローバルに登録
  window._sessionRestoreCallback = onRestore;

  // 10秒後に自動消去
  setTimeout(() => { if (banner.isConnected) banner.remove(); }, 12000);
}

function restoreSessionNow() {
  if (window._sessionRestoreCallback) window._sessionRestoreCallback();
  document.getElementById('session-restore-banner')?.remove();
}

function dismissSessionBanner() {
  document.getElementById('session-restore-banner')?.remove();
  localStorage.removeItem(SESSION_KEY);
}

function showSessionSavedBadge() {
  const badge = document.getElementById('session-saved-badge');
  if (!badge) return;
  badge.style.opacity = '1';
  clearTimeout(badge._timer);
  badge._timer = setTimeout(() => { badge.style.opacity = '0'; }, 2000);
}

/**
 * フォーム入力値をdraftとして保存
 */
function saveFormDraft() {
  const draft = {};
  const ids = ['h-daily-date', 'h-daily-weight', 'h-daily-waist', 'h-daily-app-kcal', 'h-daily-extra-kcal'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value) draft[id] = el.value;
  });
  if (Object.keys(draft).length > 0) {
    localStorage.setItem(FORM_KEY, JSON.stringify(draft));
  }
}

/**
 * フォームドラフトを復元
 */
function restoreFormDraft() {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    let restored = 0;
    Object.entries(draft).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && !el.value && val) {
        // 日付フィールドは今日の日付と一致する場合のみ復元
        if (id.includes('date')) {
          const today = new Date().toISOString().split('T')[0];
          if (val === today) { el.value = val; restored++; }
        } else {
          el.value = val;
          restored++;
        }
      }
    });
    if (restored > 0) updateHomeCalc();
  } catch(e) {}
}

/**
 * フォーム入力のリアルタイム自動保存（debounce）
 */
let _formDraftTimer = null;
function setupFormAutoSave() {
  const ids = ['h-daily-weight', 'h-daily-waist', 'h-daily-app-kcal', 'h-daily-extra-kcal'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      clearTimeout(_formDraftTimer);
      _formDraftTimer = setTimeout(saveFormDraft, 800);
    });
  });
}


// ==================== MOBILE SCROLL FIX ====================
function setupMobileScrollFix() {
  // タッチ操作で音声コンテキストをアンロック（iOS対応）
  document.addEventListener('touchstart', unlockAudioCtx, { passive: true, once: false });
  document.addEventListener('click', unlockAudioCtx, { passive: true, once: false });

  // スライダーのタッチ操作がスクロールに干渉しないよう制御
  document.addEventListener('touchstart', e => {
    const slider = e.target.closest('input[type="range"]');
    if (slider) {
      e.stopPropagation();
    }
  }, { passive: true });

  // モーダル内スクロールが背景に伝播しないよう防止
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('touchmove', e => {
      e.stopPropagation();
    }, { passive: true });
  });

  // ダブルタップズームを防止（300ms以内の2回タップ）
  let lastTouchTime = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchTime < 300) {
      // ダブルタップを検出 - input系以外ならpreventDefault
      const tag = e.target.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
      }
    }
    lastTouchTime = now;
  }, { passive: false });
}

// ==================== PARTICLE BACKGROUND ====================
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  const PARTICLE_COUNT = 35;

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 3 + 1;
      this.speedX = (Math.random() - 0.5) * 0.5;
      this.speedY = (Math.random() - 0.5) * 0.5;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.color = Math.random() > 0.85
        ? `rgba(255, 215, 0, ${this.opacity})`
        : `rgba(206, 17, 65, ${this.opacity})`;
    }
    update() {
      this.x += this.speedX; this.y += this.speedY;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill(); }
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(206, 17, 65, ${0.08 * (1 - dist / 150)})`; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    requestAnimationFrame(animate);
  }
  animate();
}

// ==================== RIPPLE ====================
function setupRippleEffect() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

// ==================== SECTION NAVIGATION ====================
function switchSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active');
    document.getElementById('section-title').textContent = target.dataset.title || '';
  }
  document.querySelectorAll('.tabbar__item').forEach(t => {
    t.classList.toggle('active', t.dataset.section === sectionId);
  });
  if (sectionId === 'sec-home') { renderCalendar(); updateCalorieTracker(); renderMealTab(); }
  if (sectionId === 'sec-recovery') updateRecoveryView();
  if (sectionId === 'sec-analysis') updateAnalysis();
  if (sectionId === 'sec-settings') loadSettingsUI();
}

// Sub-page navigation within training section
function showSubPage(pageId) {
  document.querySelectorAll('#sec-training .sub-page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  if (pageId === 'training-menu-select') renderExerciseList();
  if (pageId === 'training-home') renderTodayMenu();
}

// ==================== CALENDAR ====================
function renderCalendar() {
  const d = APP.calendarDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const today = new Date();

  document.getElementById('calendar-month').textContent = `${year}年 ${month + 1}月`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const container = document.getElementById('calendar-days');
  container.innerHTML = '';

  // Previous month's trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevDays - i;
    const el = createCalendarDay(day, true);
    container.appendChild(el);
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === i;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const el = createCalendarDay(i, false, isToday, dateStr);
    container.appendChild(el);
  }

  // Next month's leading days
  const totalCells = container.children.length;
  const remaining = 42 - totalCells; // 6 rows
  for (let i = 1; i <= remaining; i++) {
    const el = createCalendarDay(i, true);
    container.appendChild(el);
  }

  updateHomeStats();
}

function createCalendarDay(day, isOtherMonth, isToday = false, dateStr = '') {
  const el = document.createElement('div');
  el.className = 'calendar__day';
  if (isOtherMonth) el.classList.add('other-month');
  if (isToday) el.classList.add('today');

  if (dateStr && !isOtherMonth) {
    let mealHtml = '';
    // MEAL (Right Top)
    if (APP.mealPlans && APP.mealPlans[dateStr] && APP.mealPlans[dateStr].length > 0) {
      mealHtml = `<div class="cd-meal-badge" title="食事記録あり"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></div>`;
    }

    // TRAINING (Bottom Wide)
    let trainingHtml = '';
    const logs = APP.trainingLogs.filter(l => l.date === dateStr);
    if (logs.length > 0) {
      const catSets = {};
      logs.forEach(l => {
        l.exercises.forEach(e => {
          catSets[e.category] = (catSets[e.category] || 0) + (e.sets ? e.sets.length : 0);
        });
      });
      const sortedCats = Object.entries(catSets).sort((a, b) => b[1] - a[1]);
      
      sortedCats.slice(0, 2).forEach(([cat, sets]) => {
        const catClass = getCategoryClass(cat);
        const shortCat = cat === 'カーディオ' ? '有酸素' : cat;
        trainingHtml += `<div class="cd-train-bar bg-${catClass}">${shortCat} ${sets}s</div>`;
      });
    } else {
      const dailyLog = APP.dailyLogs.find(l => l.date === dateStr);
      if (dailyLog) {
        trainingHtml = `<div class="cd-train-bar bg-rest" style="text-align:center;">✓ Check</div>`;
      }
    }

    el.innerHTML = `
      <div class="cal-day-grid">
        <div class="cd-top-left"><span class="cal-day-num" style="font-size:12px;">${day}</span></div>
        <div class="cd-top-right">${mealHtml}</div>
        <div class="cd-bottom-wide">${trainingHtml}</div>
      </div>
    `;

    el.onclick = () => {
      APP.selectedDate = dateStr;
      openDayEditModal(dateStr);
    };
  } else {
    el.innerHTML = `<div class="cal-day-grid"><div class="cd-top-left"><span class="cal-day-num">${day}</span></div></div>`;
  }

  return el;
}

function getCategoryClass(cat) {
  const map = { '胸': 'chest', '背筋': 'back', '脚': 'legs', '肩': 'shoulders', '腕': 'arms', '腹筋': 'abs', 'カーディオ': 'cardio' };
  return map[cat] || 'chest';
}

/** カレンダー下ドットと同じ色の部位スウォッチ（種目表示用・絵文字・アイコンは使わない） */
function exerciseCategorySwatch(cat) {
  const cls = getCategoryClass(cat);
  const label = cat || '';
  return `<span class="exercise-cat-swatch calendar__dot calendar__dot--${cls}" title="${label}" role="img" aria-label="${label}"></span>`;
}

function changeMonth(delta) {
  if (delta === 0) {
    APP.calendarDate = new Date();
  } else {
    APP.calendarDate.setMonth(APP.calendarDate.getMonth() + delta);
  }
  renderCalendar();
}

// ==================== HOME STATS ====================
function updateHomeStats() {
  const now = APP.calendarDate;
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const monthLogs = APP.trainingLogs.filter(l => l.date.startsWith(monthStr));
  const trainDays = monthLogs.length;
  let totalSets = 0, totalVol = 0;
  monthLogs.forEach(l => { totalSets += l.totalSets || 0; totalVol += l.totalVolume || 0; });

  document.getElementById('home-train-days').textContent = trainDays;
  document.getElementById('home-total-sets').textContent = totalSets;
  document.getElementById('home-total-volume').textContent = totalVol.toLocaleString();
}

// ==================== BODY MANAGEMENT CALCULATION ====================
function calculateBody() {
  const height = parseFloat(document.getElementById('body-height').value);
  const weight = parseFloat(document.getElementById('body-weight').value);
  const age = parseInt(document.getElementById('body-age').value);
  const gender = document.getElementById('body-gender').value;
  const activity = parseFloat(document.getElementById('body-activity').value);
  const deficit = parseFloat(document.getElementById('body-deficit').value) || 500;
  const targetLoss = parseFloat(document.getElementById('body-target-loss').value) || 10;
  const waist = parseFloat(document.getElementById('body-waist').value) || 0;

  if (!height || !weight || !age) { showToast('身長・体重・年齢を入力してください', 'error'); return; }

  // Harris-Benedict Revised
  let bmr = gender === 'male'
    ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
    : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;

  const maintenance = bmr * activity;
  const targetKcal = maintenance - deficit;
  const bmi = weight / ((height / 100) ** 2);
  const daysToGoal = Math.ceil((targetLoss * 7700) / deficit);

  APP.profile = { height, weight, age, gender, activity, deficit, targetLoss, waist };
  localStorage.setItem('profile', JSON.stringify(APP.profile));

  document.getElementById('result-bmr').textContent = bmr.toFixed(1);
  document.getElementById('result-maintenance').textContent = maintenance.toFixed(1);
  document.getElementById('result-target').textContent = targetKcal.toFixed(1);
  document.getElementById('result-bmi').textContent = bmi.toFixed(1);
  document.getElementById('result-days').innerHTML = `${daysToGoal}<span class="result-banner__unit">日（約${Math.ceil(daysToGoal / 30)}ヶ月）</span>`;

  let bmiCat = bmi < 18.5 ? '低体重' : bmi < 25 ? '普通体重' : bmi < 30 ? '肥満（1度）' : '肥満（2度以上）';
  document.getElementById('body-analysis-text').innerHTML = `
    <p><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> <strong>BMI ${bmi.toFixed(1)}</strong>（${bmiCat}）</p>
    <p><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> 安静時でも1日に <strong>${bmr.toFixed(0)} kcal</strong> を消費します。</p>
    <p><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> 活動量を考慮した1日の消費カロリーは <strong>${maintenance.toFixed(0)} kcal</strong> です。</p>
    <p><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> ${targetLoss}kg 減量のために、1日 <strong>${targetKcal.toFixed(0)} kcal</strong> 以内に抑える必要があります。</p>
    <p><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> 1日 ${deficit} kcal の赤字で、目標達成まで約 <strong>${daysToGoal}日</strong>（${Math.ceil(daysToGoal / 30)}ヶ月）かかります。</p>
    ${waist ? `<p><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><path d="M3 3l18 18"/><path d="M3 9V3h6"/><path d="M21 15v6h-6"/></svg> 腹囲/身長比: ${(waist / height).toFixed(2)}（${waist / height < 0.5 ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00C853" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><polyline points="20 6 9 17 4 12"/></svg> 理想的' : waist / height < 0.6 ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> 注意' : '<svg width="10" height="10" viewBox="0 0 10 10" style="vertical-align:-1px"><circle cx="5" cy="5" r="5" fill="#CE1141"/></svg> 高リスク'}）</p>` : ''}
  `;

  document.getElementById('body-results').style.display = 'block';
  document.getElementById('body-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('計算完了！プロフィールを登録しました！', 'success');
  // 計算後に自動ロック
  setTimeout(() => lockProfile(), 1800);
}

function loadProfile() {
  const p = APP.profile;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  setVal('body-height', p.height);
  setVal('body-weight', p.weight);
  setVal('body-age', p.age);
  setVal('body-gender', p.gender);
  setVal('body-activity', p.activity);
  setVal('body-deficit', p.deficit);
  setVal('body-target-loss', p.targetLoss);
  setVal('body-waist', p.waist || '');
}

function submitBodyData() {
  sendToGas('profile', APP.profile);
  showToast('プロフィールを送信しました！', 'success');
}

// ==================== DAILY DATA ====================
function switchSettingsTab(tab) {
  ['profile','meal','timer','sound','exercises','routines','system'].forEach(t => {
    const btn = document.getElementById(`stab-${t}`);
    const panel = document.getElementById(`spanel-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'routines') renderRoutinesList();
  if (tab === 'sound') loadSoundSettingsUI();
  if (tab === 'exercises') renderExerciseManageList('all');
  if (tab === 'profile') renderProfileLockState();
  if (tab === 'meal') renderMealTab();
}

function loadSettingsUI() {
  const p = APP.profile;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('body-height', p.height);
  setVal('body-weight', p.weight);
  setVal('body-age', p.age);
  setVal('body-gender', p.gender);
  setVal('body-waist', p.waist || '');
  setVal('body-activity', p.activity);
  setVal('body-deficit', p.deficit);
  setVal('body-target-loss', p.targetLoss);
  const gasInput = document.getElementById('settings-gas-url');
  if (gasInput) gasInput.value = APP.gasUrl || '';
  renderProfileLockState();
}

// ==================== PROFILE LOCK ====================
function renderProfileLockState() {
  const p = APP.profile;
  const isLocked = !!localStorage.getItem('profileLocked');
  const banner = document.getElementById('profile-locked-banner');
  const formArea = document.getElementById('profile-form-area');
  if (!banner || !formArea) return;

  if (isLocked && p.height > 0) {
    banner.style.display = 'block';
    formArea.style.display = 'none';
    // サマリー表示
    const summary = document.getElementById('profile-locked-summary');
    if (summary) {
      const items = [
        ['身長', `${p.height} cm`],
        ['体重', `${p.weight} kg`],
        ['1日赤字目標', `${p.deficit} kcal`],
        ['減量目標', `${p.targetLoss} kg`],
        ['達成まで', `約 ${Math.ceil(p.targetLoss * 7200 / p.deficit)} 日`],
        ['活動量', p.activity],
      ];
      summary.innerHTML = items.map(([k,v]) =>
        `<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px 10px;">
          <div style="font-size:10px;color:#666;">${k}</div>
          <div style="font-size:13px;font-weight:700;color:#eee;margin-top:2px;">${v}</div>
        </div>`
      ).join('');
    }
  } else {
    banner.style.display = 'none';
    formArea.style.display = 'block';
  }
}

function lockProfile() {
  if (APP.profile.height <= 0) return;
  localStorage.setItem('profileLocked', '1');
  renderProfileLockState();
  updateCalorieTracker();
}

function unlockProfile() {
  if (!confirm('プロフィールを編集モードにしますか？\n計算後に再度固定されます。')) return;
  localStorage.removeItem('profileLocked');
  renderProfileLockState();
}

// ==================== EXERCISE MANAGEMENT ====================
let _exManageFilter = 'all';
let _editingExerciseId = null;

function getAllExercisesForManage() {
  // デフォルト種目 + カスタム種目をマージ
  const base = getAllExercises();
  const custom = APP.customExercises || [];
  // customはすでにAPP.customExercisesに入っているのでbaseに含まれているはず
  return base;
}

function renderExerciseManageList(filter) {
  _exManageFilter = filter;
  const list = document.getElementById('exercise-manage-list');
  if (!list) return;
  const allEx = getAllExercises();
  const filtered = filter === 'all' ? allEx : allEx.filter(e => e.category === filter);

  list.innerHTML = filtered.map(ex => `
    <div class="routine-card" onclick="openEditExerciseManageModal('${ex.id || ex.name}')" style="margin-bottom:6px;">
      <div class="exercise-manage-swatch">${exerciseCategorySwatch(ex.category)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:#eee;">${ex.name}</div>
        <div style="font-size:11px;color:#b0b0b0;">${ex.category}</div>
      </div>
      <span style="font-size:12px;color:${ex.isCustom ? 'var(--victory-gold)' : '#444'};">${ex.isCustom ? 'カスタム' : 'デフォルト'}</span>
    </div>
  `).join('');

  if (filtered.length === 0) list.innerHTML = '<p style="color:#555;text-align:center;font-size:13px;padding:16px;">種目がまだありません</p>';
}

function filterExerciseManage(cat, el) {
  document.querySelectorAll('#exercise-manage-filter .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderExerciseManageList(cat);
}

function openAddExerciseManageModal() {
  _editingExerciseId = null;
  repairExerciseManageModalChrome();
  document.getElementById('exercise-manage-modal-title').textContent = '種目を追加';
  document.getElementById('em-name').value = '';
  document.getElementById('em-category').value = '胸';
  document.getElementById('em-delete-btn').style.display = 'none';
  openModal('exercise-manage-modal');
}

function openEditExerciseManageModal(idOrName) {
  const allEx = getAllExercises();
  const ex = allEx.find(e => e.id === idOrName || e.name === idOrName);
  if (!ex) return;
  _editingExerciseId = ex.id || ex.name;
  repairExerciseManageModalChrome();
  document.getElementById('exercise-manage-modal-title').textContent = '種目を編集';
  document.getElementById('em-name').value = ex.name;
  document.getElementById('em-category').value = ex.category;
  document.getElementById('em-delete-btn').style.display = ex.isCustom ? '' : 'none';
  openModal('exercise-manage-modal');
}

function saveExerciseManage() {
  const name = document.getElementById('em-name').value.trim();
  const category = document.getElementById('em-category').value;
  if (!name) { showToast('種目名を入力してください', 'error'); return; }

  if (_editingExerciseId) {
    // 查定済み支 ID又は名前で編集
    const idx = APP.customExercises.findIndex(e => e.id === _editingExerciseId || e.name === _editingExerciseId);
    if (idx >= 0) {
      APP.customExercises[idx] = { ...APP.customExercises[idx], name, category };
    } else {
      // デフォルト種目は、カスタム層にオーバーライドとして登録
      APP.customExercises.push({ id: `custom_${Date.now()}`, name, category, isCustom: true });
    }
  } else {
    APP.customExercises.push({ id: `custom_${Date.now()}`, name, category, isCustom: true });
  }
  localStorage.setItem('customExercises', JSON.stringify(APP.customExercises));
  closeModal('exercise-manage-modal');
  renderExerciseManageList(_exManageFilter);
  showToast(`「${name}」を保存しました`, 'success');
}

function deleteExerciseManage() {
  if (!_editingExerciseId) return;
  if (!confirm('この種目を削除しますか？')) return;
  APP.customExercises = APP.customExercises.filter(e => e.id !== _editingExerciseId && e.name !== _editingExerciseId);
  localStorage.setItem('customExercises', JSON.stringify(APP.customExercises));
  closeModal('exercise-manage-modal');
  renderExerciseManageList(_exManageFilter);
  showToast('種目を削除しました', 'success');
}

// ==================== SOUND SETTINGS ====================
const ROUTINE_COLORS = [
  { hex: '#CE1141', label: 'A' },
  { hex: '#FF6B35', label: 'B' },
  { hex: '#FFD700', label: 'C' },
  { hex: '#00C853', label: 'D' },
  { hex: '#00BCD4', label: 'E' },
  { hex: '#2979FF', label: 'F' },
  { hex: '#AA00FF', label: 'G' },
  { hex: '#FF4081', label: 'H' },
];

function loadSoundSettingsUI() {
  const s = APP.soundSettings;
  const volEl = document.getElementById('sound-volume');
  const valEl = document.getElementById('volume-val');
  if (volEl) { volEl.value = Math.round(s.volume * 100); }
  if (valEl) valEl.textContent = Math.round(s.volume * 100) + '%';
  const cbEl = document.getElementById('countdown-enabled');
  if (cbEl) cbEl.checked = s.countdownEnabled;
  const rdEl = document.getElementById('rest-default-time');
  const rdVal = document.getElementById('rest-default-val');
  if (rdEl) rdEl.value = s.restDefaultTime || 90;
  if (rdVal) updateRestDefaultLabel();
  // Sound type chips
  document.querySelectorAll('#sound-type-group .chip').forEach(c => {
    c.classList.toggle('active', c.textContent.includes(soundTypeLabel(s.soundType)));
  });
}

function soundTypeLabel(type) {
  return { sporty: 'スポーティー', soft: 'ソフト', classic: 'クラシック' }[type] || '';
}

function updateSoundSettings() {
  const vol = parseInt(document.getElementById('sound-volume')?.value || 70) / 100;
  const countdown = document.getElementById('countdown-enabled')?.checked !== false;
  const restTime = parseInt(document.getElementById('rest-default-time')?.value || 90);
  document.getElementById('volume-val').textContent = Math.round(vol * 100) + '%';
  updateRestDefaultLabel();
  APP.soundSettings = { ...APP.soundSettings, volume: vol, countdownEnabled: countdown, restDefaultTime: restTime };
  localStorage.setItem('soundSettings', JSON.stringify(APP.soundSettings));
  // レストタイマーのデフォルト値も更新
  restTimerDuration = restTime;
  restTimerRemaining = restTime;
  updateRestTimerDisplay();
  const bar = document.getElementById('rest-timer-progress');
  if (bar) bar.style.width = '100%';
}

function updateRestDefaultLabel() {
  const v = parseInt(document.getElementById('rest-default-time')?.value || 90);
  const lbl = document.getElementById('rest-default-val');
  if (!lbl) return;
  lbl.textContent = v >= 60 ? `${Math.floor(v/60)}分${v%60 ? v%60+'秒' : ''}` : `${v}秒`;
}

function setSoundType(type, el) {
  APP.soundSettings.soundType = type;
  localStorage.setItem('soundSettings', JSON.stringify(APP.soundSettings));
  document.querySelectorAll('#sound-type-group .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

function testTimerSound() {
  unlockAudioCtx();
  playCountdownBeep(3);
  setTimeout(() => playCountdownBeep(2), 500);
  setTimeout(() => playCountdownBeep(1), 1000);
  setTimeout(() => playTimerEndSound(), 1300);
}

function saveGasUrlFromSettings() {
  const url = document.getElementById('settings-gas-url')?.value.trim();
  if (url) {
    APP.gasUrl = url;
    localStorage.setItem('gasUrl', url);
    updateGasConfigBanner();
    showToast('GAS URLを保存しました！', 'success');
  }
}

// ==================== ROUTINE MANAGEMENT ====================
let editingRoutineId = null;
let selectedRoutineColor = ROUTINE_COLORS[0].hex;

function renderRoutinesList() {
  const list = document.getElementById('routines-list');
  if (!list) return;
  if (APP.routines.length === 0) {
    list.innerHTML = '<p style="color:#555;text-align:center;font-size:13px;padding:16px 0;">まだルーティーンがありません！<br><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>ボタンから追加してください</p>';
    return;
  }
  list.innerHTML = APP.routines.map(r => {
    const exList = r.exercises.slice(0,3).join(', ') + (r.exercises.length > 3 ? ` 他${r.exercises.length-3}種` : '');
    return `
      <div class="routine-card" onclick="openEditRoutineModal('${r.id}')">
        <div class="routine-card__dot" style="background:${r.color};color:${getContrastColor(r.color)};">${r.label}</div>
        <div class="routine-card__info">
          <div class="routine-card__name">${r.name}</div>
          <div class="routine-card__exercises">${exList || '種目未登録'}</div>
        </div>
        <span class="routine-card__edit"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>️</span>
      </div>`;
  }).join('');
}

function getContrastColor(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (r*299 + g*587 + b*114) / 1000 > 128 ? '#000' : '#fff';
}
window.generatePhaseRoutines = function() {
  const phaseSelect = document.getElementById('meal-phase');
  const phase = phaseSelect ? phaseSelect.value : 'phase1';
  
  if (!confirm(`現在のフェーズ (${phase.toUpperCase()}) の推奨トレーニング・ルーティーンを自動生成して追加しますか？`)) return;

  const newRoutines = [];
  
  if (phase === 'phase1') {
    newRoutines.push({ id: 'rt_' + Date.now() + '_1', name: 'Upper A', color: '#1E88E5', exercises: ['ベンチプレス', 'ダンベルロウ', 'ラットプルダウン', 'ダンベルサイドレイズ'] });
    newRoutines.push({ id: 'rt_' + Date.now() + '_2', name: 'Lower A', color: '#CE1141', exercises: ['バックスクワット', 'レッグプレス', 'シーテッドレッグカール', 'ハンギングレッグレイズ'] });
    newRoutines.push({ id: 'rt_' + Date.now() + '_3', name: 'Upper B', color: '#1E88E5', exercises: ['インクラインダンベルベンチプレス', 'シーテッドケーブルロウ', 'ダンベルサイドレイズ', 'ケーブルプレスダウン'] });
    newRoutines.push({ id: 'rt_' + Date.now() + '_4', name: 'Lower B', color: '#CE1141', exercises: ['ダンベルブルガリアンスプリットスクワット', 'ヒップアブダクションマシン', 'レッグエクステンション', 'ハンギングレッグレイズ'] });
  } else {
    // Phase 2, 3, 4 uses Push/Pull/Legs
    newRoutines.push({ id: 'rt_' + Date.now() + '_p1', name: 'Push', color: '#CE1141', exercises: ['ベンチプレス', 'インクラインダンベルベンチプレス', 'シーテッドダンベルショルダープレス', 'ダンベルサイドレイズ', 'ケーブルプレスダウン'] });
    newRoutines.push({ id: 'rt_' + Date.now() + '_p2', name: 'Pull', color: '#1E88E5', exercises: ['ラットプルダウン', 'シーテッドケーブルロウ', 'ダンベルロウ', 'リアデルトフライマシン', 'アシストプルアップマシン'] });
    newRoutines.push({ id: 'rt_' + Date.now() + '_l1', name: 'Legs', color: '#43A047', exercises: ['バックスクワット', 'ダンベルブルガリアンスプリットスクワット', 'レッグプレス', 'シーテッドレッグカール', 'ハンギングレッグレイズ'] });
  }

  APP.routines = APP.routines.concat(newRoutines);
  localStorage.setItem('routines', JSON.stringify(APP.routines));
  pushSyncToGas();
  
  const rl = document.getElementById('routines-list');
  if (rl) renderRoutinesList();
  
  showToast(`${phase.toUpperCase()} の推奨ルーティーンを生成しました！`, 'success');
};


function openAddRoutineModal() {
  editingRoutineId = null;
  selectedRoutineColor = ROUTINE_COLORS[0].hex;
  document.getElementById('routine-modal-title').innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> ルーティーン追加';
  document.getElementById('routine-name-input').value = '';
  document.getElementById('routine-delete-btn').style.display = 'none';
  renderColorPicker(null);
  renderExercisePicker([]);
  openModal('routine-edit-modal');
}

function openEditRoutineModal(id) {
  const r = APP.routines.find(x => x.id === id);
  if (!r) return;
  editingRoutineId = id;
  selectedRoutineColor = r.color;
  document.getElementById('routine-modal-title').innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>️ ルーティーン編集';
  document.getElementById('routine-name-input').value = r.name;
  document.getElementById('routine-delete-btn').style.display = '';
  renderColorPicker(r.color);
  renderExercisePicker(r.exercises);
  openModal('routine-edit-modal');
}

function renderColorPicker(selectedColor) {
  const picker = document.getElementById('routine-color-picker');
  if (!picker) return;
  picker.innerHTML = ROUTINE_COLORS.map(c => `
    <div class="routine-color-swatch${(selectedColor || ROUTINE_COLORS[0].hex) === c.hex ? ' selected' : ''}"
      style="background:${c.hex};"
      onclick="selectRoutineColor('${c.hex}', this)">${c.label}</div>
  `).join('');
}

function selectRoutineColor(hex, el) {
  selectedRoutineColor = hex;
  document.querySelectorAll('.routine-color-swatch').forEach(s => s.classList.remove('selected'));
  if (el) el.classList.add('selected');
}

function renderExercisePicker(checkedNames) {
  const picker = document.getElementById('routine-exercise-picker');
  if (!picker) return;
  const allEx = getAllExercises();

  // カテゴリー別にグループ化
  const byCategory = {};
  allEx.forEach(ex => {
    if (!byCategory[ex.category]) byCategory[ex.category] = [];
    byCategory[ex.category].push(ex);
  });

  picker.innerHTML = Object.entries(byCategory).map(([cat, exercises]) => {
    const checkedInCat = exercises.filter(e => checkedNames.includes(e.name)).length;
    return `
      <div class="routine-cat-group">
        <div class="routine-cat-toggle" onclick="toggleRoutineCat('${cat}', this)">
          <span class="routine-cat-toggle__label">${exerciseCategorySwatch(cat)} ${cat}</span>
          <span class="routine-cat-count" id="rcc-${cat}">${checkedInCat > 0 ? `${checkedInCat}選択中` : ''}</span>
          <span class="routine-cat-arrow"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align:-1px;display:inline-block"><polygon points="5 3 19 12 5 21 5 3"/></svg></span>
        </div>
        <div class="routine-cat-exercises" id="rcex-${cat}" style="display:none;">
          ${exercises.map(ex => `
            <label class="routine-ex-item">
              <input type="checkbox" value="${ex.name}" ${checkedNames.includes(ex.name) ? 'checked' : ''} onchange="updateRoutineCatCount('${cat}')">
              <span class="routine-ex-item__name"><span class="routine-ex-item__swatch">${exerciseCategorySwatch(ex.category)}</span>${ex.name}</span>
            </label>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  // 選択済カテゴリを自動展開
  Object.keys(byCategory).forEach(cat => {
    const hasChecked = byCategory[cat].some(e => checkedNames.includes(e.name));
    if (hasChecked) {
      const group = document.getElementById(`rcex-${cat}`);
      const toggle = group?.previousElementSibling?.querySelector('.routine-cat-arrow');
      if (group) group.style.display = 'block';
      if (toggle) toggle.textContent = '▼';
    }
  });
}

function toggleRoutineCat(cat, el) {
  const exercises = document.getElementById(`rcex-${cat}`);
  const arrow = el.querySelector('.routine-cat-arrow');
  if (!exercises) return;
  const isOpen = exercises.style.display !== 'none';
  exercises.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.innerHTML = isOpen ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="vertical-align:-1px;display:inline-block"><polygon points="5 3 19 12 5 21 5 3"/></svg>' : '▼';
}

function updateRoutineCatCount(cat) {
  const container = document.getElementById(`rcex-${cat}`);
  if (!container) return;
  const checked = container.querySelectorAll('input:checked').length;
  const countEl = document.getElementById(`rcc-${cat}`);
  if (countEl) countEl.textContent = checked > 0 ? `${checked}選択中` : '';
}

function saveRoutine() {
  const name = document.getElementById('routine-name-input').value.trim();
  if (!name) { showToast('名前を入力してください', 'error'); return; }
  const exercises = Array.from(document.querySelectorAll('#routine-exercise-picker input:checked')).map(i => i.value);
  const colorObj = ROUTINE_COLORS.find(c => c.hex === selectedRoutineColor) || ROUTINE_COLORS[0];
  if (editingRoutineId) {
    const idx = APP.routines.findIndex(r => r.id === editingRoutineId);
    if (idx >= 0) APP.routines[idx] = { ...APP.routines[idx], name, color: colorObj.hex, label: colorObj.label, exercises };
  } else {
    APP.routines.push({ id: `r_${Date.now()}`, name, color: colorObj.hex, label: colorObj.label, exercises });
  }
  localStorage.setItem('routines', JSON.stringify(APP.routines));
  closeModal('routine-edit-modal');
  renderRoutinesList();
  showToast(`「${name}」を保存しました`, 'success');
}

function deleteRoutine() {
  if (!editingRoutineId) return;
  if (!confirm('このルーティーンを削除しますか？')) return;
  APP.routines = APP.routines.filter(r => r.id !== editingRoutineId);
  localStorage.setItem('routines', JSON.stringify(APP.routines));
  closeModal('routine-edit-modal');
  renderRoutinesList();
  showToast('ルーティーンを削除しました', 'success');
}

// トレーニング画面からルーティーンを呼び出す
function openRoutineSheet() {
  const list = document.getElementById('routine-sheet-list');
  if (!list) return;
  if (APP.routines.length === 0) {
    list.innerHTML = '<p style="color:#555;text-align:center;font-size:13px;padding:16px;">ルーティーンがありません。設定から追加してください。</p>';
  } else {
    list.innerHTML = APP.routines.map(r => {
      const exList = r.exercises.slice(0,4).join(' / ');
      return `
        <div class="routine-sheet-card" onclick="loadRoutineToMenu('${r.id}')">
          <div class="routine-sheet-dot" style="background:${r.color};color:${getContrastColor(r.color)};">${r.label}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:#eee;">${r.name}</div>
            <div style="font-size:11px;color:#666;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${exList || '種目未登録'}</div>
          </div>
        </div>`;
    }).join('');
  }
  openModal('routine-sheet');
}

function loadRoutineToMenu(routineId) {
  const r = APP.routines.find(x => x.id === routineId);
  if (!r) return;
  const allEx = getAllExercises();
  // ルーティーンの種目を今日のメニューにセット
  APP.todayExercises = r.exercises.map(name => {
    const found = allEx.find(e => e.name === name);
    return found ? { ...found, sets: [], totalSets: 0, totalVolume: 0, recorded: false } : null;
  }).filter(Boolean);
  renderTodayMenu();
  closeModal('routine-sheet');
  // 読み込みバッジ表示
  const badge = document.getElementById('active-routine-badge');
  const chip = document.getElementById('active-routine-chip');
  if (badge && chip) {
    badge.style.display = 'block';
    chip.textContent = `${r.label} ${r.name}`;
    chip.style.background = r.color;
    chip.style.color = getContrastColor(r.color);
  }
  showToast(`「${r.name}」を読み込みました！`, 'success');
}

// ==================== CALORIE DEFICIT TRACKER ====================
/**
 * 連続日数ブロックの DOM を正規化する。
 * 特に「新 index + キャッシュされた旧 app.js」だと、子 #ct-streak に SVG 文字列が textContent され、
 * 見た目は壊れたまま early-return してしまうため、テキストに < や svg を含む場合も必ず組み替える。
 */
function ensureCalorieStreakDom() {
  const labels = [...document.querySelectorAll('.stat-box__label')];
  const lab = labels.find(l => l.textContent.trim() === '連続日数');
  if (!lab) return;
  const box = lab.closest('.stat-box');
  if (!box) return;
  const host = box.querySelector('.stat-box__value');
  if (!host) return;

  const numEl = document.getElementById('ct-streak');
  const directChildNum = numEl && numEl.parentElement === host;
  const combinedText = (host.textContent || '').trim();
  const numText = numEl ? (numEl.textContent || '').trim() : '';
  const streakLooksCorrupt =
    /[<>]/.test(combinedText) ||
    /svg/i.test(combinedText) ||
    /[<>]/.test(numText) ||
    /svg/i.test(numText);
  const structureOk =
    host.classList.contains('ct-streak-row') &&
    directChildNum &&
    !streakLooksCorrupt;

  if (structureOk) return;

  let parsed = '0';
  const tail = combinedText.match(/-?\d+\s*$/);
  if (tail) parsed = tail[0].trim();
  else {
    const allNum = combinedText.match(/-?\d+/g);
    if (allNum) parsed = allNum[allNum.length - 1];
  }

  host.className = 'stat-box__value stat-box__value--gold ct-streak-row';
  host.style.fontSize = '14px';
  host.removeAttribute('id');
  host.innerHTML = `<span class="ct-streak-mark" aria-hidden="true"></span><span id="ct-streak">${parsed}</span>`;
}

/** 旧 HTML のアイコン（絵文字）欄削除 + モーダルタイトルに HTML が平文で入っている場合の修復 */
function repairExerciseManageModalChrome() {
  cleanupLegacyIconFields(document.getElementById('exercise-manage-modal'));
  cleanupLegacyIconFields(document.getElementById('add-exercise-modal'));
  const title = document.getElementById('exercise-manage-modal-title');
  if (title && isSerializedSvgText(title.textContent || '')) {
    const x = title.textContent || '';
    title.textContent = x.includes('編集') ? '種目を編集' : '種目を追加';
  }
  normalizeCategorySelectOptions();
}

function updateCalorieTracker() {
  const logs = getDeduplicatedDailyLogs();
  const profile = APP.profile;
  const targetLoss = profile.targetLoss || 10;
  const dailyDeficit = profile.deficit || 500;
  // 1kg脂肪 ≈ 7200 kcal
  const totalGoalKcal = targetLoss * 7200;
  const daysNeeded = Math.ceil(totalGoalKcal / dailyDeficit);

  // アンダーカロリー日のみ累積
  const accumulated = logs.reduce((sum, l) => {
    const g = l.gap || 0;
    return g < 0 ? sum + Math.abs(g) : sum;
  }, 0);
  const percent = Math.min(100, (accumulated / totalGoalKcal) * 100);
  const remaining = Math.max(0, totalGoalKcal - accumulated);

  // 連続赤字日数
  let streak = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    if ((logs[i].gap || 0) < 0) streak++;
    else break;
  }

  // 今日の差引
  const today = new Date().toISOString().split('T')[0];
  const todayLog = logs.find(l => l.date === today);
  const todayGap = todayLog ? (todayLog.gap || 0) : null;

  // === 表示更新 ===
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setEl('ct-target-weight', `-${targetLoss} kg`);
  setEl('ct-daily-deficit-info', `-${dailyDeficit.toLocaleString()} kcal`);
  setEl('ct-days-needed', `達成まで約 ${daysNeeded}日`);
  setEl('calorie-goal-label', `全体の ${percent.toFixed(1)}%`);
  setEl('calorie-accumulated', `${Math.round(accumulated).toLocaleString()} kcal 減少済`);
  setEl('calorie-remaining', `残り ${Math.round(remaining).toLocaleString()} kcal`);
  setEl('ct-percent', percent.toFixed(1) + '%');
  // 連続日数: 古い DOM のとき一度だけ組み替え → 数値は子 #ct-streak にのみ入れる
  ensureCalorieStreakDom();
  setEl('ct-streak', String(streak));

  const bar = document.getElementById('calorie-progress-bar');
  if (bar) bar.style.width = percent.toFixed(1) + '%';

  const tg = document.getElementById('ct-today-gap');
  if (tg) {
    if (todayGap === null) {
      tg.textContent = '--'; tg.style.color = '';
    } else {
      tg.textContent = (todayGap >= 0 ? '+' : '') + Math.round(todayGap).toLocaleString();
      tg.style.color = todayGap < 0 ? 'var(--success)' : 'var(--danger)';
    }
  }

  const empty = document.getElementById('calorie-tracker-empty');
  // プロファイルが設定されているまではエンプティメッセージ表示
  const hasProfile = profile.height > 0 && profile.weight > 0;
  if (empty) empty.style.display = (!hasProfile || logs.length === 0) ? '' : 'none';
}

// ==================== DAILY DATA ====================
function initDailyListeners() {
  ['daily-app-kcal', 'daily-extra-kcal', 'daily-weight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateDailyCalc);
  });
  // ホーム画面の日次フォーム
  ['h-daily-app-kcal', 'h-daily-extra-kcal', 'h-daily-weight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateHomeCalc);
  });
}

function updateHomeCalc() {
  const appKcal = parseFloat(document.getElementById('h-daily-app-kcal').value) || 0;
  const extraKcal = parseFloat(document.getElementById('h-daily-extra-kcal').value) || 0;
  const weight = parseFloat(document.getElementById('h-daily-weight').value) || APP.profile.weight;
  if (!appKcal && !extraKcal) {
    document.getElementById('h-daily-calc').style.display = 'none'; return;
  }
  const totalKcal = appKcal + extraKcal;
  const bmr = calcBMR(weight);
  const maintenance = bmr * APP.profile.activity;
  const gap = totalKcal - (maintenance - APP.profile.deficit);
  document.getElementById('h-daily-total').textContent = totalKcal;
  document.getElementById('h-daily-maint').textContent = maintenance.toFixed(0);
  const gapEl = document.getElementById('h-daily-gap');
  gapEl.textContent = (gap >= 0 ? '+' : '') + gap.toFixed(0);
  gapEl.style.color = gap >= 0 ? 'var(--danger)' : 'var(--success)';
  document.getElementById('h-daily-calc').style.display = 'block';
}

function submitHomeDaily() {
  const date = document.getElementById('h-daily-date').value || new Date().toISOString().split('T')[0];
  const weight = parseFloat(document.getElementById('h-daily-weight').value);
  const waist = parseFloat(document.getElementById('h-daily-waist').value) || 0;
  const appKcal = parseFloat(document.getElementById('h-daily-app-kcal').value) || 0;
  const extraKcal = parseFloat(document.getElementById('h-daily-extra-kcal').value) || 0;
  if (!weight) { showToast('体重を入力してください', 'error'); return; }

  const bmr = calcBMR(weight);
  const maintenance = bmr * APP.profile.activity;
  const targetKcal = maintenance - APP.profile.deficit;
  const totalKcal = appKcal + extraKcal;
  const gap = totalKcal > 0 ? totalKcal - targetKcal : 0;

  // プロフィール最新体重を更新
  APP.profile.weight = weight;
  if (waist) APP.profile.waist = waist;
  localStorage.setItem('profile', JSON.stringify(APP.profile));

  const intensityEl = document.querySelector('.home-intensity-chip.active');
  const intensity = intensityEl ? intensityEl.dataset.intensity : 'mid';

  const logEntry = { date, weight, waist, appKcal, totalKcal, gap, bmr, maintenance, targetKcal, intensity, timestamp: new Date().toISOString() };
  // 同日データをupsert（重複を防ぐ）
  const existingIdx = APP.dailyLogs.findIndex(l => l.date === date);
  if (existingIdx >= 0) {
    APP.dailyLogs[existingIdx] = logEntry;
  } else {
    APP.dailyLogs.push(logEntry);
  }
  localStorage.setItem('dailyLogs', JSON.stringify(APP.dailyLogs));
  sendToGas('daily', logEntry);
  updateHomeStats(); updateAnalysis(); renderCalendar();
  // フォームリセット
  document.getElementById('h-daily-weight').value = '';
  document.getElementById('h-daily-waist').value = '';
  document.getElementById('h-daily-app-kcal').value = '';
  document.getElementById('h-daily-extra-kcal').value = '';
  document.getElementById('h-daily-calc').style.display = 'none';
  // 日付を今日にリセット
  document.getElementById('h-daily-date').value = new Date().toISOString().split('T')[0];
  updateCalorieTracker();
  // フォームドラフトをクリア（送信完了）
  localStorage.removeItem(FORM_KEY);
  showToast(`${date} の日次データを記録しました！`, 'success');
}

function calcBMR(weight) {
  const p = APP.profile;
  return p.gender === 'male'
    ? 88.362 + 13.397 * weight + 4.799 * p.height - 5.677 * p.age
    : 447.593 + 9.247 * weight + 3.098 * p.height - 4.330 * p.age;
}

function updateDailyCalc() {
  const appKcal = parseFloat(document.getElementById('daily-app-kcal').value) || 0;
  const extraKcal = parseFloat(document.getElementById('daily-extra-kcal').value) || 0;
  const weight = parseFloat(document.getElementById('daily-weight').value) || APP.profile.weight;
  if (!appKcal && !extraKcal) return;

  const totalKcal = appKcal + extraKcal;
  const bmr = calcBMR(weight);
  const maintenance = bmr * APP.profile.activity;
  const targetKcal = maintenance - APP.profile.deficit;
  const gap = totalKcal - targetKcal;

  document.getElementById('daily-total-kcal').textContent = totalKcal;
  document.getElementById('daily-maintenance-display').textContent = maintenance.toFixed(0);
  const gapEl = document.getElementById('daily-gap');
  gapEl.textContent = (gap >= 0 ? '+' : '') + gap.toFixed(0);
  gapEl.className = `stat-box__value ${gap >= 0 ? 'gap-positive' : 'gap-negative'}`;
  document.getElementById('daily-calc-result').style.display = 'block';
}

function submitQuickInput() {
  const weight = parseFloat(document.getElementById('quick-weight').value);
  const calories = parseFloat(document.getElementById('quick-calories').value);
  if (!weight && !calories) { showToast('体重またはカロリーを入力してください', 'error'); return; }

  if (weight) { APP.profile.weight = weight; localStorage.setItem('profile', JSON.stringify(APP.profile)); }
  const w = weight || APP.profile.weight;
  const bmr = calcBMR(w);
  const maintenance = bmr * APP.profile.activity;
  const targetKcal = maintenance - APP.profile.deficit;
  const totalKcal = (calories || 0) + 200;
  const gap = totalKcal > 0 ? totalKcal - targetKcal : 0;
  const today = new Date().toISOString().split('T')[0];

  const logEntry = { date: today, weight: w, appKcal: calories || 0, totalKcal, gap, bmr, maintenance, targetKcal, timestamp: new Date().toISOString() };
  APP.dailyLogs.push(logEntry);
  localStorage.setItem('dailyLogs', JSON.stringify(APP.dailyLogs));
  sendToGas('daily', logEntry);
  updateHomeStats();
  updateAnalysis();
  document.getElementById('quick-weight').value = '';
  document.getElementById('quick-calories').value = '';
  showToast('データを記録しました！', 'success');
}

function submitDailyData() {
  const date = document.getElementById('daily-date').value;
  const weight = parseFloat(document.getElementById('daily-weight').value);
  const waist = parseFloat(document.getElementById('daily-waist').value) || 0;
  const appKcal = parseFloat(document.getElementById('daily-app-kcal').value) || 0;
  const extraKcal = parseFloat(document.getElementById('daily-extra-kcal').value) || 0;
  if (!weight) { showToast('体重を入力してください', 'error'); return; }

  const bmr = calcBMR(weight);
  const maintenance = bmr * APP.profile.activity;
  const targetKcal = maintenance - APP.profile.deficit;
  const totalKcal = appKcal + extraKcal;
  const gap = totalKcal > 0 ? totalKcal - targetKcal : 0;
  APP.profile.weight = weight;
  if (waist) APP.profile.waist = waist;
  localStorage.setItem('profile', JSON.stringify(APP.profile));

  const logEntry = { date, weight, waist, appKcal, totalKcal, gap, bmr, maintenance, targetKcal, timestamp: new Date().toISOString() };
  // 同日データをupsert（重複防止・最新値で上書き）
  const existingIdx = APP.dailyLogs.findIndex(l => l.date === date);
  if (existingIdx >= 0) {
    APP.dailyLogs[existingIdx] = logEntry;
  } else {
    APP.dailyLogs.push(logEntry);
  }
  localStorage.setItem('dailyLogs', JSON.stringify(APP.dailyLogs));
  sendToGas('daily', logEntry);
  updateHomeStats(); updateAnalysis(); renderCalendar(); updateCalorieTracker();
  showToast('日次データを記録しました！', 'success');
}

// ==================== TRAINING FLOW ====================

// --- Exercise List (Checkbox multi-select) ---
let currentFilter = 'all';
let selectedExercises = new Set(); // names of exercises selected via checkbox

function filterMuscleGroup(group, chipEl) {
  currentFilter = group;
  document.querySelectorAll('#muscle-chips .chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  renderExerciseList();
}

// Default max weight per category
const CATEGORY_DEFAULT_MAX_WEIGHT = {
  '胸': 120, '背筋': 120, '肩': 40, '腕': 40,
  '脚': 200, '腹筋': 50, 'カーディオ': 30
};

function getExerciseMaxWeight(exerciseName, category) {
  if (APP.exerciseWeightSettings[exerciseName]) return APP.exerciseWeightSettings[exerciseName];
  return CATEGORY_DEFAULT_MAX_WEIGHT[category] || APP.settings.maxWeight;
}

// アシスト系種目判定（補助重量でマイナス方向のスライダーを使う）
function isAssistExercise(name) {
  if (!name) return false;
  return name.includes('アシスト');
}

function renderExerciseList() {
  const all = getAllExercises();
  const filtered = currentFilter === 'all' ? all : all.filter(e => e.category === currentFilter);
  filtered.sort((a, b) => (b.freq || 0) - (a.freq || 0));
  const container = document.getElementById('exercise-list');
  const alreadyAdded = new Set(APP.todayExercises.map(e => e.name));

  container.innerHTML = filtered.map(ex => {
    const isSelected = selectedExercises.has(ex.name);
    const isAdded = alreadyAdded.has(ex.name);
    const maxW = getExerciseMaxWeight(ex.name, ex.category);
    const safeName = ex.name.replace(/'/g, "\\'");
    return `
      <div class="exercise-item ${isSelected ? 'checked' : ''}" onclick="toggleExerciseSelect('${safeName}')" ${isAdded ? 'style="opacity:0.4;pointer-events:none;"' : ''}>
        <div class="exercise-item__checkbox">${isSelected ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;display:inline-block"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
        <div class="exercise-item__icon">${exerciseCategorySwatch(ex.category)}</div>
        <span class="exercise-item__name">${ex.name}</span>
        <span style="font-size: 9px; color: #555;">${maxW}kg</span>
        <span style="font-size: 10px; color: #b0b0b0;">${ex.category}</span>
      </div>
    `;
  }).join('');

  updateBatchBar();
}

function toggleExerciseSelect(name) {
  if (selectedExercises.has(name)) {
    selectedExercises.delete(name);
  } else {
    selectedExercises.add(name);
  }
  renderExerciseList();
}

function updateBatchBar() {
  const bar = document.getElementById('batch-add-bar');
  const count = selectedExercises.size;
  if (count > 0) {
    bar.style.display = 'flex';
    document.getElementById('batch-count').textContent = `${count}種目選択中`;
  } else {
    bar.style.display = 'none';
  }
}

function batchAddExercises() {
  const all = getAllExercises();
  let added = 0;
  selectedExercises.forEach(name => {
    const ex = all.find(e => e.name === name);
    if (!ex) return;
    if (APP.todayExercises.find(e => e.name === name)) return;
    APP.todayExercises.push({
      name: ex.name, category: ex.category,
      sets: [], totalSets: 0, totalVolume: 0, notes: '', recorded: false
    });
    added++;
  });
  selectedExercises.clear();
  showToast(`${added}種目を追加しました`, 'success');
  renderTodayMenu();
  showSubPage('training-home');
}

function cancelExerciseSelect() {
  selectedExercises.clear();
  showSubPage('training-home');
}

// --- Weight Settings Modal ---
function renderWeightSettings() {
  const container = document.getElementById('weight-settings-list');
  const all = getAllExercises();
  let currentCat = '';
  let html = '';

  const sorted = [...all].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  sorted.forEach(ex => {
    if (ex.category !== currentCat) {
      currentCat = ex.category;
      html += `<div style="display:flex;align-items:center;gap:8px;font-size: 10px; font-weight: 700; color: var(--bulls-red-light); text-transform: uppercase; letter-spacing: 1px; padding: 8px 0 2px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.08);">${exerciseCategorySwatch(currentCat)} ${currentCat}</div>`;
    }
    const maxW = getExerciseMaxWeight(ex.name, ex.category);
    html += `
      <div class="weight-setting-item">
        <span class="weight-setting-item__name">${ex.name}</span>
        <input class="weight-setting-item__input" type="number" data-exercise="${ex.name}" value="${maxW}" step="5" min="5" max="500" inputmode="numeric">
        <span class="weight-setting-item__unit">kg</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

function saveWeightSettings() {
  const inputs = document.querySelectorAll('#weight-settings-list .weight-setting-item__input');
  inputs.forEach(input => {
    const name = input.dataset.exercise;
    const val = parseInt(input.value) || 100;
    APP.exerciseWeightSettings[name] = val;
  });
  localStorage.setItem('exerciseWeightSettings', JSON.stringify(APP.exerciseWeightSettings));
  closeModal('weight-settings-modal');
  showToast('重量設定を保存しました', 'success');
}

// --- Today's Menu ---
function renderTodayMenu() {
  const container = document.getElementById('today-menu-list');
  const countEl = document.getElementById('today-menu-count');
  countEl.textContent = `${APP.todayExercises.length}種目`;

  if (APP.todayExercises.length === 0) {
    container.innerHTML = '<p style="color: #555; text-align: center; padding: 16px 0; font-size: 13px;">メニューを追加してください</p>';
    document.getElementById('submit-training-btn').style.display = 'none';
    return;
  }

  container.innerHTML = APP.todayExercises.map((ex, idx) => `
    <div class="today-menu-item ${ex.recorded ? 'done' : ''}" onclick="openSetInput(${idx})">
      <span class="today-menu-item__icon">${exerciseCategorySwatch(ex.category)}</span>
      <div class="today-menu-item__info">
        <div class="today-menu-item__name">${ex.name}</div>
        <div class="today-menu-item__meta">${ex.category} ${ex.recorded ? (ex.cardioData ? `| ${ex.cardioData.minutes}分 / ${ex.cardioData.incline}° / ${ex.cardioData.speed}km/h` : `| ${ex.totalSets}set / ${ex.totalVolume.toLocaleString()}kg`) : '| 未記録'}</div>
      </div>
      <button class="today-menu-item__remove" onclick="event.stopPropagation(); removeMenuExercise(${idx})"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;display:inline-block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  `).join('');

  updateTrainingSummary();
  const hasRecorded = APP.todayExercises.some(e => e.recorded);
  document.getElementById('submit-training-btn').style.display = hasRecorded ? '' : 'none';
}

function removeMenuExercise(idx) {
  APP.todayExercises.splice(idx, 1);
  renderTodayMenu();
}

function updateTrainingSummary() {
  let totalSets = 0, totalVol = 0;
  APP.todayExercises.forEach(ex => { totalSets += ex.totalSets; totalVol += ex.totalVolume; });
  document.getElementById('train-total-sets').textContent = totalSets;
  document.getElementById('train-total-volume').textContent = totalVol.toLocaleString();

  // Previous session sets
  const prevLog = APP.trainingLogs.length > 0 ? APP.trainingLogs[APP.trainingLogs.length - 1] : null;
  document.getElementById('train-prev-sets').textContent = prevLog ? prevLog.totalSets : '--';
}

// --- Set Input (Slider) ---
let currentSetExerciseIdx = -1;
let isCardioMode = false;

function openSetInput(idx) {
  currentSetExerciseIdx = idx;
  const ex = APP.todayExercises[idx];
  isCardioMode = (ex.category === 'カーディオ');

  document.getElementById('set-exercise-icon').innerHTML = exerciseCategorySwatch(ex.category);
  document.getElementById('set-exercise-name').textContent = ex.name;
  document.getElementById('set-exercise-category').textContent = ex.category;
  document.getElementById('exercise-notes').value = ex.notes || '';

  // Show previous record
  showPrevRecord(ex.name);

  const container = document.getElementById('set-cards-container');
  container.innerHTML = '';

  if (isCardioMode) {
    // Cardio: single card with time/incline/speed
    addCardioCard(ex.sets && ex.sets[0] ? ex.sets[0] : {});
  } else {
    // Strength: weight/reps sets
    if (ex.sets && ex.sets.length > 0) {
      ex.sets.forEach((s, i) => addSetCard(s.weight, s.reps));
    } else {
      addSetCard();
    }
  }

  showSubPage('training-set-input');
}

function addCardioCard(init = {}) {
  const container = document.getElementById('set-cards-container');
  const card = document.createElement('div');
  card.className = 'set-card';
  card.dataset.cardio = 'true';
  const initMin = init.minutes || 0;
  const initIncline = init.incline || 0;
  const initSpeed = init.speed || 0;
  card.innerHTML = `
    <div class="set-card__header">
      <span class="set-card__number"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><circle cx="13" cy="4" r="2"/><path d="M7 22l2-5 3 3 2-7"/><path d="M7 15l2-4 4 2 4-3"/></svg> トレッドミル設定</span>
    </div>
    <div class="slider-group">
      <div class="slider-header">
        <span class="slider-label">時間</span>
        <span class="slider-value"><span class="sv-minutes">${initMin}</span><span class="slider-unit"> 分</span></span>
      </div>
      <input type="range" min="0" max="120" step="1" value="${initMin}" oninput="this.closest('.set-card').querySelector('.sv-minutes').textContent=this.value">
    </div>
    <div class="slider-group">
      <div class="slider-header">
        <span class="slider-label">傾斜</span>
        <span class="slider-value"><span class="sv-incline">${initIncline}</span><span class="slider-unit"> °</span></span>
      </div>
      <input type="range" min="0" max="20" step="0.5" value="${initIncline}" oninput="this.closest('.set-card').querySelector('.sv-incline').textContent=this.value">
    </div>
    <div class="slider-group">
      <div class="slider-header">
        <span class="slider-label">スピード</span>
        <span class="slider-value"><span class="sv-speed">${initSpeed}</span><span class="slider-unit"> km/h</span></span>
      </div>
      <input type="range" min="0" max="20" step="0.5" value="${initSpeed}" oninput="this.closest('.set-card').querySelector('.sv-speed').textContent=this.value">
    </div>
  `;
  container.appendChild(card);
}

function showPrevRecord(exerciseName) {
  const display = document.getElementById('prev-record-display');
  const prevText = document.getElementById('prev-record-text');
  const maxText = document.getElementById('prev-max-text');

  // Search through training logs for this exercise
  let prevRecord = null, maxWeight = 0;
  for (let i = APP.trainingLogs.length - 1; i >= 0; i--) {
    const log = APP.trainingLogs[i];
    const ex = log.exercises.find(e => e.name === exerciseName);
    if (ex) {
      if (!prevRecord) {
        prevRecord = ex;
      }
      ex.sets.forEach(s => { if (s.weight > maxWeight) maxWeight = s.weight; });
    }
  }

  if (prevRecord) {
    display.style.display = '';
    const lastSet = prevRecord.sets[prevRecord.sets.length - 1];
    prevText.textContent = `${prevRecord.totalSets}set / ${lastSet ? lastSet.weight + 'kg×' + lastSet.reps + '回' : '--'}`;
    maxText.textContent = `${maxWeight}kg`;
  } else {
    display.style.display = 'none';
  }
}

let setCardCount = 0;
function addSetCard(initWeight, initReps) {
  setCardCount++;
  const container = document.getElementById('set-cards-container');
  const num = container.children.length + 1;

  // Carry over values from last set card if no initial values given
  if (initWeight === undefined || initReps === undefined) {
    const existingCards = container.querySelectorAll('.set-card');
    if (existingCards.length > 0) {
      const lastCard = existingCards[existingCards.length - 1];
      const lastWeight = parseFloat(lastCard.querySelector('input[type="range"]')?.value) || 0;
      const lastReps = parseInt(lastCard.querySelectorAll('input[type="range"]')[1]?.value) || 0;
      if (initWeight === undefined) initWeight = lastWeight;
      if (initReps === undefined) initReps = lastReps;
    } else {
      if (initWeight === undefined) initWeight = 0;
      if (initReps === undefined) initReps = 0;
    }
  }

  // Get per-exercise maxWeight
  let maxW = APP.settings.maxWeight;
  if (currentSetExerciseIdx >= 0) {
    const ex = APP.todayExercises[currentSetExerciseIdx];
    maxW = getExerciseMaxWeight(ex.name, ex.category);
  }
  const maxR = APP.settings.maxReps;

  // アシスト種目判定（返し側で使うため取り出し）
  const isAssist = currentSetExerciseIdx >= 0
    ? isAssistExercise(APP.todayExercises[currentSetExerciseIdx].name)
    : false;
  // アシスト種目の初期値はマイナスに変換
  if (isAssist && initWeight > 0) initWeight = -initWeight;
  if (isAssist && initWeight === 0) initWeight = 0;

  const card = document.createElement('div');
  card.className = 'set-card';

  if (isAssist) {
    // アシスト種目: スライダーは -100～0kg（右に右を向くほど载が大きい = より载を援助）
    const sliderVal = Math.min(0, Math.max(-100, Math.round(initWeight)));
    card.innerHTML = `
      <div class="set-card__header">
        <span class="set-card__number">Set ${num}</span>
        <button class="set-card__delete" onclick="deleteSetCard(this)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;display:inline-block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">補助重量 <span style="font-size:10px;color:var(--victory-gold);">← 大きいほど軽くなる</span></span>
          <span class="slider-value"><span class="sv-weight">${sliderVal}</span><span class="slider-unit"> kg</span></span>
        </div>
        <input type="range" min="-100" max="0" step="1" value="${sliderVal}"
          data-assist="true"
          oninput="this.closest('.set-card').querySelector('.sv-weight').textContent=this.value">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#555;margin-top:3px;">
          <span>-100kg（最大補助）</span><span>0kg（補助なし）</span>
        </div>
      </div>
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">回数</span>
          <span class="slider-value"><span class="sv-reps">${initReps}</span><span class="slider-unit"> 回</span></span>
        </div>
        <input type="range" min="0" max="${maxR}" step="1" value="${initReps}" oninput="this.closest('.set-card').querySelector('.sv-reps').textContent=this.value">
      </div>
    `;
  } else {
    card.innerHTML = `
      <div class="set-card__header">
        <span class="set-card__number">Set ${num}</span>
        <button class="set-card__delete" onclick="deleteSetCard(this)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:-1px;display:inline-block"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">重量</span>
          <span class="slider-value"><span class="sv-weight">${initWeight}</span><span class="slider-unit"> kg</span></span>
        </div>
        <input type="range" min="0" max="${maxW}" step="1" value="${Math.round(initWeight)}" oninput="this.closest('.set-card').querySelector('.sv-weight').textContent=this.value">
      </div>
      <div class="slider-group">
        <div class="slider-header">
          <span class="slider-label">回数</span>
          <span class="slider-value"><span class="sv-reps">${initReps}</span><span class="slider-unit"> 回</span></span>
        </div>
        <input type="range" min="0" max="${maxR}" step="1" value="${initReps}" oninput="this.closest('.set-card').querySelector('.sv-reps').textContent=this.value">
      </div>
    `;
  }
  container.appendChild(card);
}

function deleteSetCard(btn) {
  btn.closest('.set-card').remove();
  // Renumber
  document.querySelectorAll('#set-cards-container .set-card').forEach((c, i) => {
    c.querySelector('.set-card__number').textContent = `Set ${i + 1}`;
  });
}

function saveExercise() {
  if (currentSetExerciseIdx < 0) return;
  const ex = APP.todayExercises[currentSetExerciseIdx];
  const notes = document.getElementById('exercise-notes').value;

  if (isCardioMode) {
    // Cardio: time/incline/speed
    const card = document.querySelector('#set-cards-container .set-card[data-cardio="true"]');
    if (!card) return;
    const sliders = card.querySelectorAll('input[type="range"]');
    const minutes = parseFloat(sliders[0]?.value) || 0;
    const incline = parseFloat(sliders[1]?.value) || 0;
    const speed = parseFloat(sliders[2]?.value) || 0;
    if (minutes === 0) { showToast('時間を入力してください', 'error'); return; }

    const sets = [{ minutes, incline, speed }];
    ex.sets = sets;
    ex.totalSets = 1;
    ex.totalVolume = 0; // cardio has no volume
    ex.cardioData = { minutes, incline, speed };
    ex.notes = notes;
    ex.recorded = true;

    showToast(`${ex.name}: ${minutes}分 / 傾斜${incline}° / ${speed}km/h`, 'success');
  } else {
    // Standard: weight/reps
    const cards = document.querySelectorAll('#set-cards-container .set-card');
    const sets = [];
    cards.forEach(card => {
      const weight = parseFloat(card.querySelector('input[type="range"]').value) || 0;
      const reps = parseInt(card.querySelectorAll('input[type="range"]')[1].value) || 0;
      if (weight !== 0 || reps > 0) sets.push({ weight, reps });
    });

    if (sets.length === 0) { showToast('セットデータを入力してください', 'error'); return; }

    // アシスト種目はabs値でvolume計算（記録はマイナスのまま）
    const isAssistEx = isAssistExercise(ex.name);
    const totalVolume = sets.reduce((sum, s) => sum + Math.abs(s.weight) * s.reps, 0);
    ex.sets = sets;
    ex.totalSets = sets.length;
    ex.totalVolume = isAssistEx ? 0 : totalVolume;
    ex.notes = notes;
    ex.recorded = true;

    showToast(`${ex.name} を記録しました！`, 'success');
  }

  renderTodayMenu();
  showSubPage('training-home');
}

// --- Custom Exercise ---
function addCustomExercise() {
  const name = document.getElementById('new-exercise-name').value.trim();
  const category = document.getElementById('new-exercise-category').value;
  if (!name) { showToast('種目名を入力してください', 'error'); return; }

  APP.customExercises.push({ name, category, freq: 0 });
  localStorage.setItem('customExercises', JSON.stringify(APP.customExercises));

  document.getElementById('new-exercise-name').value = '';
  closeModal('add-exercise-modal');
  renderExerciseList();
  showToast(`${name} を追加しました！`, 'success');
}

// --- Submit Training ---
function submitTrainingData() {
  const recorded = APP.todayExercises.filter(e => e.recorded);
  if (recorded.length === 0) { showToast('種目を記録してから送信してください', 'error'); return; }

  const date = APP.selectedDate || new Date().toISOString().split('T')[0];
  const sleepHours = parseFloat(document.getElementById('training-sleep-hours').value) || 5;
  const duration = trainingTimerElapsed > 0 ? Math.floor(trainingTimerElapsed / 60000) : 0;

  const data = {
    date, sleepHours, exercises: recorded, duration,
    totalVolume: recorded.reduce((s, e) => s + e.totalVolume, 0),
    totalSets: recorded.reduce((s, e) => s + e.totalSets, 0)
  };

  // Save/update training log
  const existingIdx = APP.trainingLogs.findIndex(l => l.date === date);
  if (existingIdx >= 0) {
    APP.trainingLogs[existingIdx] = data;
  } else {
    APP.trainingLogs.push(data);
  }
  localStorage.setItem('trainingLogs', JSON.stringify(APP.trainingLogs));

  sendToGas('training', data);
  updateRecoveryView();
  renderCalendar();
  // セッションドラフトをクリア（送信完了）
  localStorage.removeItem(SESSION_KEY);
  showToast('トレーニングデータを記録しました！', 'success');
}

// ==================== TRAINING TIMER (Start/Pause/Stop) ====================
let trainingTimerInterval = null;
let trainingTimerStartTime = null;
let trainingTimerElapsed = 0;
let trainingTimerRunning = false;

function toggleTrainingTimer() {
  const btn = document.getElementById('training-start-btn');
  if (trainingTimerRunning) {
    // Pause
    clearInterval(trainingTimerInterval);
    trainingTimerElapsed += Date.now() - trainingTimerStartTime;
    trainingTimerRunning = false;
    btn.innerHTML = ICON_PLAY;
    btn.className = 'training-timer-bar__btn training-timer-bar__btn--start';
  } else {
    // Start
    trainingTimerStartTime = Date.now();
    trainingTimerRunning = true;
    btn.innerHTML = ICON_PAUSE;
    btn.className = 'training-timer-bar__btn training-timer-bar__btn--pause';
    trainingTimerInterval = setInterval(updateTrainingTimerDisplay, 1000);
    updateTrainingTimerDisplay();
  }
}

function stopTrainingTimer() {
  if (trainingTimerRunning) {
    trainingTimerElapsed += Date.now() - trainingTimerStartTime;
    trainingTimerRunning = false;
  }
  clearInterval(trainingTimerInterval);
  const btn = document.getElementById('training-start-btn');
  btn.innerHTML = ICON_PLAY;
  btn.className = 'training-timer-bar__btn training-timer-bar__btn--start';
  // Keep elapsed shown
  updateTrainingTimerDisplay();
}

function updateTrainingTimerDisplay() {
  const total = trainingTimerElapsed + (trainingTimerRunning ? Date.now() - trainingTimerStartTime : 0);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  document.getElementById('training-elapsed').textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ==================== REST TIMER (FIFO 4 presets) ====================
let restTimerInterval = null;
let restTimerStartTime = null;
let restTimerDuration = 90; // seconds
let restTimerRemaining = 0;
let restTimerRunning = false;

function setRestPreset(seconds) {
  restTimerDuration = seconds;
  restTimerRemaining = seconds;
  updateRestTimerDisplay();
  document.getElementById('rest-timer-progress').style.width = '100%';

  // Update FIFO presets
  let presets = APP.restPresets;
  if (!presets.includes(seconds)) {
    presets.push(seconds);
    if (presets.length > 4) presets.shift();
    APP.restPresets = presets;
    localStorage.setItem('restPresets', JSON.stringify(presets));
    renderRestPresets();
  }
}

function renderRestPresets() {
  const container = document.getElementById('rest-presets');
  container.innerHTML = APP.restPresets.map(sec => {
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    const label = s > 0 ? `${min}:${String(s).padStart(2, '0')}` : `${min}:00`;
    return `<div class="rest-timer__preset" onclick="setRestPreset(${sec})">${label}</div>`;
  }).join('');
}

function toggleRestTimer() {
  const btn = document.getElementById('rest-start-btn');
  if (restTimerRunning) {
    // Pause
    clearInterval(restTimerInterval);
    restTimerRunning = false;
    btn.innerHTML = ICON_PLAY;
  } else {
    // Start
    if (restTimerRemaining <= 0) restTimerRemaining = restTimerDuration;
    restTimerStartTime = Date.now();
    restTimerRunning = true;
    btn.innerHTML = ICON_PAUSE;
    _restCountdownBeeped.clear();
    restTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - restTimerStartTime) / 1000;
      restTimerRemaining = restTimerDuration - elapsed;
      if (restTimerRemaining <= 0) {
        restTimerRemaining = 0;
        clearInterval(restTimerInterval);
        restTimerRunning = false;
        btn.innerHTML = ICON_PLAY;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        playTimerEndSound();
        showToast('レスト終了！', 'success');
      } else {
        // 3秒前カウントダウンBeep
        const s = Math.ceil(restTimerRemaining);
        if (s <= 3 && s > 0 && !_restCountdownBeeped.has(s)) {
          _restCountdownBeeped.add(s);
          playCountdownBeep(s);
        }
      }
      updateRestTimerDisplay();
      document.getElementById('rest-timer-progress').style.width = `${(restTimerRemaining / restTimerDuration) * 100}%`;
    }, 100);
  }
}

function resetRestTimer() {
  clearInterval(restTimerInterval);
  restTimerRunning = false;
  restTimerRemaining = restTimerDuration;
  document.getElementById('rest-start-btn').innerHTML = ICON_PLAY;
  updateRestTimerDisplay();
  document.getElementById('rest-timer-progress').style.width = '100%';
}

function updateRestTimerDisplay() {
  const total = Math.max(0, Math.ceil(restTimerRemaining));
  const m = Math.floor(total / 60);
  const s = total % 60;
  document.getElementById('rest-timer-display').textContent = `${m}:${String(s).padStart(2, '0')}`;
}

// ==================== RECOVERY / FATIGUE ====================
/*
 * Dynamic Recovery Model
 * ======================
 * Formula: adjustedHours = baseHours × volumeMultiplier / sleepEfficiency
 *
 * Volume Multiplier:
 *   Based on dose-response research (Pareja-Blanco et al., 2017; NIH):
 *   - High volume (8×10) → MVIC impaired at 72h
 *   - Low volume (8×3) → MVIC recovered by 48h
 *   - CK markers scale non-linearly with volume (log relationship)
 *   Formula: 0.6 + 0.4 × ln(1 + totalVolume / referenceVolume)
 *   - At 0 volume: multiplier = 0.6 (minimum - passive fatigue)
 *   - At reference volume (typical session): multiplier ≈ 1.08
 *   - At 2× reference: multiplier ≈ 1.28
 *   - At 3× reference: multiplier ≈ 1.44
 *
 * Reference Volume (kg per session per muscle group):
 *   Based on NSCA Essentials of Strength Training, typical intermediate
 *   trainee performing 3-4 sets of 8-12 reps at moderate % 1RM.
 *   These represent a "standard" training session volume load.
 */
const REFERENCE_VOLUME = {
  // 胸 — 4 sets × 10 reps × 60kg ≈ 2400kg
  '胸': 2400,
  // 肩 — 4 sets × 10 reps × 20kg ≈ 800kg
  '肩': 800,
  // 背筋 — 4 sets × 10 reps × 50kg ≈ 2000kg
  '背筋': 2000,
  // 腕 — 4 sets × 10 reps × 15kg ≈ 600kg
  '腕': 600,
  // 腹筋 — bodyweight-based, use arbitrary low ref
  '腹筋': 300,
  // 脚 — 4 sets × 10 reps × 80kg ≈ 3200kg
  '脚': 3200,
  // カーディオ — no volume-based recovery
  'カーディオ': 1,
};

/**
 * Calculate volume multiplier for recovery time.
 * Uses logarithmic curve (backed by CK marker research showing
 * non-linear dose-response between volume and muscle damage).
 *
 * @param {number} sessionVolume - Total volume load (sets × reps × weight) for this muscle group
 * @param {string} group - Muscle group category (胸, 肩, etc.)
 * @returns {number} Multiplier (0.6 to ~1.6)
 */
function getVolumeMultiplier(sessionVolume, group) {
  const ref = REFERENCE_VOLUME[group] || 1500;
  if (sessionVolume <= 0) return 0.6; // No volume recorded = minimum fatigue
  // Logarithmic curve: gentle slope, diminishing returns
  return 0.6 + 0.4 * Math.log(1 + sessionVolume / ref);
}

function updateRecoveryView() {
  const sleepHours = parseFloat(document.getElementById('recovery-sleep-hours')?.value) || 7;
  
  const sleepWarningEl = document.getElementById('recovery-sleep-warning');
  if (sleepWarningEl) {
    if (sleepHours < 6) {
      sleepWarningEl.style.display = 'block';
    } else {
      sleepWarningEl.style.display = 'none';
    }
  }
  const now = Date.now();
  const listContainer = document.getElementById('recovery-list');

  // Reset all muscle SVG opacities
  document.querySelectorAll('.real-muscle-path').forEach(el => {
    el.style.fillOpacity = '0';
  });

  const detailedMuscles = Object.keys(RECOVERY_BASE);
  let html = '';
  let currentGroup = '';

  // Priorities: Red(4) > Orange(3) > Yellow(2) > Green(1)
  const priorityMap = {
    'var(--recovery-red)': 4,
    'var(--recovery-orange)': 3,
    'var(--recovery-yellow)': 2,
    'var(--recovery-green)': 1
  };
  const muscleStatuses = {}; // slug -> color

  detailedMuscles.forEach(muscle => {
    const base = RECOVERY_BASE[muscle];
    const sleepEfficiency = Math.pow(sleepHours / SLEEP_BASELINE, 0.6);

    // Find last training log that worked this muscle + its volume
    let lastTrained = null;
    for (let i = APP.trainingLogs.length - 1; i >= 0; i--) {
      const log = APP.trainingLogs[i];
      let muscleVolume = 0;

      log.exercises.forEach(ex => {
        const allEx = getAllExercises();
        const found = allEx.find(e => e.name === ex.name);
        const muscles = found ? getExerciseMuscles(found) : (CATEGORY_MUSCLES_MAP[ex.category] || []);
        if (muscles.includes(muscle)) {
          // Sum volume from this exercise's sets
          if (ex.sets) {
            ex.sets.forEach(s => {
              if (s.weight && s.reps) {
                muscleVolume += s.weight * s.reps;
              }
            });
          }
        }
      });

      if (muscleVolume > 0 || log.exercises.some(ex => {
        const allEx = getAllExercises();
        const found = allEx.find(e => e.name === ex.name);
        const muscles = found ? getExerciseMuscles(found) : (CATEGORY_MUSCLES_MAP[ex.category] || []);
        return muscles.includes(muscle);
      })) {
        const sessionSleep = log.sleepHours || sleepHours;
        const eff = Math.pow(sessionSleep / SLEEP_BASELINE, 0.6);
        const volMult = getVolumeMultiplier(muscleVolume, base.group);
        const adjH = (base.hours * volMult) / eff;
        lastTrained = {
          date: new Date(log.date),
          adjustedHours: adjH,
          sessionSleep,
          volume: muscleVolume,
          volumeMultiplier: volMult
        };
        break;
      }
    }

    let recoveryPercent = 100;
    let hoursElapsed = 0;
    let color = 'var(--recovery-green)';

    if (lastTrained) {
      hoursElapsed = (now - lastTrained.date.getTime()) / (1000 * 60 * 60);
      recoveryPercent = Math.min(100, (hoursElapsed / lastTrained.adjustedHours) * 100);

      if (recoveryPercent < 25) color = 'var(--recovery-red)';
      else if (recoveryPercent < 50) color = 'var(--recovery-orange)';
      else if (recoveryPercent < 75) color = 'var(--recovery-yellow)';
      else color = 'var(--recovery-green)';
    }

    // Record SVG body model colors into dictionary
    updateMuscleColor(muscle, color, recoveryPercent, muscleStatuses, priorityMap);

    // Group header
    if (base.group !== currentGroup) {
      currentGroup = base.group;
      html += `<div style="font-size: 10px; font-weight: 700; color: var(--bulls-red-light); text-transform: uppercase; letter-spacing: 1px; padding: 8px 0 4px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05);">${currentGroup}</div>`;
    }

    // Show volume info in detail string
    const detailStr = lastTrained
      ? `${Math.floor(hoursElapsed)}h前 | Vol:${lastTrained.volume.toLocaleString()}kg | ×${lastTrained.volumeMultiplier.toFixed(2)} | 回復:${lastTrained.adjustedHours.toFixed(0)}h`
      : `基準: ${base.hours}h`;

    html += `
      <div class="recovery-item">
        <div class="recovery-item__dot" style="background: ${color};"></div>
        <div class="recovery-item__info">
          <div class="recovery-item__name">${base.displayName}</div>
          <div class="recovery-item__detail">${detailStr}</div>
          <div class="recovery-item__bar"><div class="recovery-item__bar-fill" style="width: ${recoveryPercent}%; background: ${color};"></div></div>
        </div>
        <div class="recovery-item__status" style="color: ${color};">${Math.round(recoveryPercent)}%</div>
      </div>
    `;
  });

  listContainer.innerHTML = html;

  // Finalize all SVGs: apply colors based on priorities collected
  const slugToName = {
    'chest': '大胸筋', 'deltoids': '三角筋', 'trapezius': '僧帽筋', 'upper-back': '背部（広背筋・小円筋）',
    'lower-back': '背部下部（脊柱起立筋）', 'biceps': '上腕二頭筋', 'triceps': '上腕三頭筋',
    'forearm': '前腕', 'abs': '腹筋', 'obliques': '腹斜筋', 'adductors': '内転筋',
    'quadriceps': '大腿四頭筋', 'hamstring': 'ハムストリングス', 'gluteal': '大臀筋',
    'calves': 'ふくらはぎ', 'neck': '首'
  };

  for (const [slug, statusObj] of Object.entries(muscleStatuses)) {
    document.querySelectorAll(`.real-muscle-path[data-muscle-id="${slug}"]`).forEach(el => {
      el.style.fill = statusObj.color;
      el.style.fillOpacity = '0.85';
      el.dataset.tooltipName = slugToName[slug] || slug;
      el.dataset.tooltipPercent = Math.round(statusObj.percent);
      el.dataset.tooltipColor = statusObj.color;
      el.dataset.tooltipDetails = JSON.stringify(statusObj.details);
    });
  }
}

// ==================== MUSCLE TOOLTIP EVENTS ====================
document.addEventListener('mouseover', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('real-muscle-path')) {
    const tooltip = document.getElementById('muscle-tooltip');
    if (!tooltip) return;
    const name = e.target.dataset.tooltipName;
    const percent = e.target.dataset.tooltipPercent;
    const color = e.target.dataset.tooltipColor;
    
    if (name) {
      let detailsHtml = '';
      try {
        const detailsStr = e.target.dataset.tooltipDetails || '[]';
        const details = JSON.parse(detailsStr);
        // Only show list if there are multiple details or it differs from the main name
        if (details.length > 0) {
          detailsHtml = '<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-size:10px; font-weight:400;">';
          details.sort((a, b) => a.percent - b.percent).forEach(d => {
            detailsHtml += `
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <span style="display:flex; align-items:center; gap:4px;">
                  <div style="width:6px;height:6px;border-radius:50%;background:${d.color};"></div>
                  <span style="color:#aaa;">${d.name}</span>
                </span>
                <span style="color:${d.color}; margin-left:12px;">${Math.round(d.percent)}%</span>
              </div>
            `;
          });
          detailsHtml += '</div>';
        }
      } catch (err) {}

      tooltip.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
          <span style="font-size:12px;">${name}</span>
          <span style="color:${color}; margin-left:auto;">${percent}%</span>
        </div>
        ${detailsHtml}
      `;
      tooltip.style.opacity = '1';
    }
  }
});

document.addEventListener('mousemove', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('real-muscle-path')) {
    const tooltip = document.getElementById('muscle-tooltip');
    if (tooltip) {
      tooltip.style.left = e.pageX + 'px';
      tooltip.style.top = e.pageY + 'px';
    }
  }
});

document.addEventListener('mouseout', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('real-muscle-path')) {
    const tooltip = document.getElementById('muscle-tooltip');
    if (tooltip) {
      tooltip.style.opacity = '0';
    }
  }
});

// Detailed muscle → SVG element ID mapping
function updateMuscleColor(muscle, color, percent, muscleStatuses, priorityMap) {
  const mappings = {
    '大胸筋上部':   ['chest'],
    '大胸筋下部':   ['chest'],
    '三角筋前部':   ['deltoids'],    // SVG only has one large 'deltoids'
    '三角筋側部':   ['deltoids'],
    '三角筋後部':   ['deltoids'],
    '僧帽筋':       ['trapezius', 'neck'],
    '広背筋':       ['upper-back', 'lower-back'], // Lats maps to valid SVG slugs
    '脊柱起立筋':   ['lower-back'],
    '上腕二頭筋':   ['biceps'],
    '上腕三頭筋':   ['triceps'],
    '前腕':         ['forearm'],
    '腹直筋上部':   ['abs'],
    '腹直筋下部':   ['abs'],
    '腹斜筋':       ['obliques'],
    '腸腰筋':       ['abs', 'adductors'], 
    '大腿四頭筋':   ['quadriceps'],
    '内転筋':       ['adductors'],
    'ハムストリング': ['hamstring'],
    '臀筋':         ['gluteal'],
    '腓腹筋':       ['calves'],
  };

  const slugs = mappings[muscle] || [];
  slugs.forEach(slug => {
    if (!muscleStatuses[slug]) {
      muscleStatuses[slug] = { color: 'var(--recovery-green)', percent: 100, details: [] };
    }
    
    // Add specific detailed muscle info
    muscleStatuses[slug].details.push({
      name: muscle,
      percent: percent,
      color: color
    });

    // Update the worst-case color/percent for the parent SVG path
    const existing = muscleStatuses[slug];
    if (priorityMap[color] > priorityMap[existing.color]) {
      existing.color = color;
      existing.percent = percent;
    } else if (priorityMap[color] === priorityMap[existing.color]) {
      if (percent < existing.percent) {
        existing.percent = percent;
      }
    }
  });
}

function showMuscleDetail(muscle) {
  showToast(`${muscle}: 詳細は回復リストを確認`, 'info');
}

// ==================== STOPWATCH ====================
let swInterval = null, swStartTime = null, swElapsed = 0, swRunning = false, laps = [];

function toggleStopwatch() {
  if (swRunning) {
    clearInterval(swInterval); swElapsed += Date.now() - swStartTime; swRunning = false;
    document.getElementById('sw-start').innerHTML = ICON_PLAY;
    document.getElementById('sw-start').classList.remove('pulse');
  } else {
    swStartTime = Date.now(); swRunning = true;
    document.getElementById('sw-start').innerHTML = ICON_PAUSE;
    document.getElementById('sw-start').classList.add('pulse');
    swInterval = setInterval(() => {
      document.getElementById('stopwatch-display').textContent = formatMs(swElapsed + Date.now() - swStartTime);
    }, 10);
  }
}

function formatMs(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const cent = Math.floor((ms % 1000) / 10);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cent).padStart(2, '0')}`;
}

function stopwatchLap() {
  if (!swRunning) return;
  const total = swElapsed + Date.now() - swStartTime;
  laps.push(total);
  document.getElementById('lap-card').style.display = '';
  document.getElementById('lap-list').innerHTML = laps.map((t, i) => {
    const split = i > 0 ? t - laps[i - 1] : t;
    return `<li class="lap-list__item"><span class="lap-list__number">LAP ${i + 1}</span><span class="lap-list__time">${formatMs(split)}</span><span style="color: #666; font-size: 12px;">${formatMs(t)}</span></li>`;
  }).reverse().join('');
}

function resetStopwatch() {
  clearInterval(swInterval); swElapsed = 0; swRunning = false; laps = [];
  document.getElementById('stopwatch-display').textContent = '00:00.00';
  document.getElementById('sw-start').innerHTML = ICON_PLAY;
  document.getElementById('sw-start').classList.remove('pulse');
  document.getElementById('lap-card').style.display = 'none';
}

// ==================== COUNTDOWN TIMER ====================
let tmInterval = null, tmRemaining = 0, tmTotal = 0, tmRunning = false;

function switchTimerTab(tab) {
  document.getElementById('stopwatch-panel').style.display = tab === 'stopwatch' ? '' : 'none';
  document.getElementById('timer-panel').style.display = tab === 'timer' ? '' : 'none';
  document.getElementById('sw-tab').classList.toggle('active', tab === 'stopwatch');
  document.getElementById('tm-tab').classList.toggle('active', tab === 'timer');
}

function setTimerPreset(sec) {
  tmTotal = sec; tmRemaining = sec; tmRunning = false;
  clearInterval(tmInterval);
  document.getElementById('tm-start').innerHTML = ICON_PLAY;
  updateTimerDisplay();
}

function toggleTimer() {
  if (tmRunning) {
    clearInterval(tmInterval); tmRunning = false;
    document.getElementById('tm-start').innerHTML = ICON_PLAY;
    document.getElementById('tm-start').classList.remove('pulse');
  } else {
    if (tmRemaining <= 0) tmRemaining = tmTotal || 60;
    tmRunning = true;
    document.getElementById('tm-start').innerHTML = ICON_PAUSE;
    document.getElementById('tm-start').classList.add('pulse');
    _timerCountdownBeeped.clear();
    const startTime = Date.now();
    const startRemaining = tmRemaining;
    tmInterval = setInterval(() => {
      tmRemaining = startRemaining - (Date.now() - startTime) / 1000;
      if (tmRemaining <= 0) {
        tmRemaining = 0; clearInterval(tmInterval); tmRunning = false;
        document.getElementById('tm-start').innerHTML = ICON_PLAY;
        document.getElementById('tm-start').classList.remove('pulse');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        playTimerEndSound();
        showToast('タイマー終了！', 'success');
      } else {
        // 3秒前カウントダウンBeep
        const s = Math.ceil(tmRemaining);
        if (s <= 3 && s > 0 && !_timerCountdownBeeped.has(s)) {
          _timerCountdownBeeped.add(s);
          playCountdownBeep(s);
        }
      }
      updateTimerDisplay();
    }, 100);
  }
}

function resetTimer() {
  clearInterval(tmInterval); tmRemaining = tmTotal; tmRunning = false;
  document.getElementById('tm-start').innerHTML = ICON_PLAY;
  document.getElementById('tm-start').classList.remove('pulse');
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const total = Math.max(0, Math.ceil(tmRemaining));
  const m = Math.floor(total / 60);
  const s = total % 60;
  document.getElementById('timer-display').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ==================== ANALYSIS ====================
let chartWeight = null, chartGap = null;

// 同日に複数入力がある場合、最も完全な（重量+カロリー両方ある）最新エントリを採用
function getDeduplicatedDailyLogs() {
  const byDate = {};
  APP.dailyLogs.forEach(log => {
    const existing = byDate[log.date];
    if (!existing) {
      byDate[log.date] = log;
    } else {
      // 完全度スコア: 体重あり(2点) + カロリーあり(1点)
      const score = l => (l.weight > 0 ? 2 : 0) + (l.totalKcal > 0 ? 1 : 0);
      if (score(log) > score(existing)) {
        byDate[log.date] = log;
      } else if (score(log) === score(existing)) {
        // 同スコアなら最新タイムスタンプを採用
        if ((log.timestamp || '') > (existing.timestamp || '')) byDate[log.date] = log;
      }
    }
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function updateAnalysis() {
  const logs = getDeduplicatedDailyLogs(); // 重複排除済みログを使用
  if (logs.length === 0) return;

  const ctx1 = document.getElementById('chart-weight');
  const ctx2 = document.getElementById('chart-gap');
  if (!ctx1 || !ctx2) return;

  if (chartWeight) chartWeight.destroy();
  if (chartGap) chartGap.destroy();

  const labels = logs.slice(-30).map(l => l.date);
  const weights = logs.slice(-30).map(l => l.weight);
  const gaps = logs.slice(-30).map(l => l.gap || 0);

  chartWeight = new Chart(ctx1, {
    type: 'line',
    data: { labels, datasets: [{ label: '体重 (kg)', data: weights, borderColor: '#CE1141', backgroundColor: 'rgba(206,17,65,0.1)', fill: true, tension: 0.4 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#666', font: { size: 9 } } }, y: { ticks: { color: '#888' } } } }
  });

  chartGap = new Chart(ctx2, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'ギャップ (kcal)', data: gaps, backgroundColor: gaps.map(g => g >= 0 ? 'rgba(255,23,68,0.6)' : 'rgba(0,200,83,0.6)') }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#666', font: { size: 9 } } }, y: { ticks: { color: '#888' } } } }
  });

  const avgW = weights.reduce((a, b) => a + b, 0) / weights.length;
  const intakes = logs.filter(l => l.totalKcal > 0);
  const avgIntake = intakes.length > 0 ? intakes.reduce((a, b) => a + b.totalKcal, 0) / intakes.length : 0;

  document.getElementById('analysis-avg-weight').textContent = avgW.toFixed(1);
  document.getElementById('analysis-avg-intake').textContent = avgIntake.toFixed(0);
  document.getElementById('analysis-train-days').textContent = APP.trainingLogs.length;
  document.getElementById('analysis-deficit-days').textContent = logs.filter(l => (l.gap || 0) < 0).length;
}

// ==================== GAS COMMUNICATION ====================
function sendToGas(type, data) {
  if (!APP.gasUrl) return;
  fetch(APP.gasUrl, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, data })
  }).catch(err => console.warn('GAS送信エラー:', err));
}

function updateGasConfigBanner() {
  const banner = document.getElementById('gas-config-banner');
  banner.style.display = APP.gasUrl ? 'none' : '';
}

function saveGasUrl() {
  const url = document.getElementById('gas-url-input').value.trim();
  if (url) {
    APP.gasUrl = url;
    localStorage.setItem('gasUrl', url);
    closeModal('gas-modal');
    updateGasConfigBanner();
    showToast('GAS URLを保存しました！', 'success');
  }
}

// ==================== MODAL ====================
function openModal(id) {
  if (id === 'weight-settings-modal') renderWeightSettings();
  if (id === 'exercise-manage-modal' || id === 'add-exercise-modal') {
    normalizeLegacyCorruptedUI();
  }
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('active');
  normalizeLegacyCorruptedUI();
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ==================== TOAST ====================
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast--${type} show`;
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ==================== DATA MANAGEMENT ====================
function exportData() {
  const data = {
    profile: APP.profile, dailyLogs: APP.dailyLogs,
    trainingLogs: APP.trainingLogs, customExercises: APP.customExercises
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `bodymaster_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('データをエクスポートしました', 'success');
}

function clearAllData() {
  if (!confirm('全てのデータを削除しますか？この操作は元に戻せません。')) return;
  localStorage.removeItem('profile'); localStorage.removeItem('dailyLogs');
  localStorage.removeItem('trainingLogs'); localStorage.removeItem('customExercises');
  localStorage.removeItem('appSettings'); localStorage.removeItem('restPresets');
  APP.dailyLogs = []; APP.trainingLogs = []; APP.customExercises = [];
  APP.todayExercises = [];
  renderCalendar(); updateRecoveryView(); updateAnalysis();
  showToast('全データを削除しました', 'success');
}

// playTimerEndSound と playCountdownBeep はファイル先頭のAUDIO SYSTEMセクションで定義済み

// ==================== DAY EDIT MODAL ====================
let editingDate = null;
let editDailyListeners = false;

function openDayEditModal(dateStr) {
  editingDate = dateStr;
  // タイトル設定
  const [y, m, d] = dateStr.split('-');
  document.getElementById('day-edit-title').innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;display:inline-block"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${y}年${m}月${d}日`;

  // 既存の日次データを読み込む
  const daily = APP.dailyLogs.find(l => l.date === dateStr);
  document.getElementById('edit-weight').value = daily ? (daily.weight || '') : '';
  document.getElementById('edit-waist').value = daily ? (daily.waist || '') : '';
  document.getElementById('edit-app-kcal').value = daily ? (daily.appKcal || '') : '';
  document.getElementById('edit-extra-kcal').value = daily ? (Math.round((daily.totalKcal || 0) - (daily.appKcal || 0)) || '') : '';
  
  const intensity = daily ? (daily.intensity || 'mid') : 'mid';
  if (window.setDayIntensity) window.setDayIntensity('edit', intensity);

  // 削除ボタンの表示制御
  document.getElementById('edit-delete-daily-btn').style.display = daily ? '' : 'none';

  // カロリー計算リスナー（重複防止）
  if (!editDailyListeners) {
    ['edit-weight', 'edit-app-kcal', 'edit-extra-kcal'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateEditCalcDisplay);
    });
    editDailyListeners = true;
  }

  // トレーニングデータを表示
  renderEditTrainingSummary(dateStr);

  // 食事データを表示
  renderEditMealSummary(dateStr);

  // 最初は日次タブを表示
  switchDayTab('daily');
  openModal('day-edit-modal');
  updateEditCalcDisplay();
}

function updateEditCalcDisplay() {
  const appKcal = parseFloat(document.getElementById('edit-app-kcal').value) || 0;
  const extraKcal = parseFloat(document.getElementById('edit-extra-kcal').value) || 0;
  const weight = parseFloat(document.getElementById('edit-weight').value) || APP.profile.weight;
  if (!appKcal && !extraKcal) {
    document.getElementById('edit-daily-calc').style.display = 'none';
    return;
  }
  const totalKcal = appKcal + extraKcal;
  const bmr = calcBMR(weight);
  const maintenance = bmr * APP.profile.activity;
  const targetKcal = maintenance - APP.profile.deficit;
  const gap = totalKcal - targetKcal;

  document.getElementById('edit-total-kcal').textContent = totalKcal;
  document.getElementById('edit-maintenance').textContent = maintenance.toFixed(0);
  const gapEl = document.getElementById('edit-gap');
  gapEl.textContent = (gap >= 0 ? '+' : '') + gap.toFixed(0);
  gapEl.style.color = gap >= 0 ? 'var(--danger)' : 'var(--success)';
  document.getElementById('edit-daily-calc').style.display = 'block';
}

function renderEditTrainingSummary(dateStr) {
  const log = APP.trainingLogs.find(l => l.date === dateStr);
  const summaryEl = document.getElementById('edit-training-summary');
  const listEl = document.getElementById('edit-exercise-list');
  const deleteBtn = document.getElementById('edit-delete-training-btn');

  if (log) {
    deleteBtn.style.display = '';
    summaryEl.innerHTML = `
      <div class="stat-grid stat-grid--3" style="margin-bottom:8px;">
        <div class="stat-box"><div class="stat-box__value stat-box__value--red">${log.totalSets || 0}</div><div class="stat-box__label">セット</div></div>
        <div class="stat-box"><div class="stat-box__value stat-box__value--gold">${(log.totalVolume || 0).toLocaleString()}</div><div class="stat-box__label">ボリューム kg</div></div>
        <div class="stat-box"><div class="stat-box__value stat-box__value--green">${log.duration || 0}</div><div class="stat-box__label">時間 (分)</div></div>
      </div>`;
    listEl.innerHTML = log.exercises.map(ex => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:4px;">
        ${exerciseCategorySwatch(ex.category)}
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${ex.name}</div>
          <div style="font-size:10px;color:#888;">${ex.category} | ${ex.totalSets}set / ${ex.totalVolume.toLocaleString()}kg</div>
        </div>
      </div>`).join('');
  } else {
    deleteBtn.style.display = 'none';
    summaryEl.innerHTML = '<p style="color:#555;text-align:center;padding:16px 0;font-size:13px;">トレーニング記録なし</p>';
    listEl.innerHTML = '';
  }
}

function switchDayTab(tab) {
  document.getElementById('day-panel-daily').style.display = tab === 'daily' ? '' : 'none';
  document.getElementById('day-panel-training').style.display = tab === 'training' ? '' : 'none';
  document.getElementById('day-panel-meal').style.display = tab === 'meal' ? '' : 'none';
  document.getElementById('day-tab-daily').classList.toggle('active', tab === 'daily');
  document.getElementById('day-tab-training').classList.toggle('active', tab === 'training');
  document.getElementById('day-tab-meal').classList.toggle('active', tab === 'meal');
}

function saveDayEdit() {
  if (!editingDate) return;
  const weight = parseFloat(document.getElementById('edit-weight').value);
  const waist = parseFloat(document.getElementById('edit-waist').value) || 0;
  const appKcal = parseFloat(document.getElementById('edit-app-kcal').value) || 0;
  const extraKcal = parseFloat(document.getElementById('edit-extra-kcal').value) || 0;

  if (!weight) { showToast('体重を入力してください', 'error'); return; }

  const bmr = calcBMR(weight);
  const maintenance = bmr * APP.profile.activity;
  const targetKcal = maintenance - APP.profile.deficit;
  const totalKcal = appKcal + extraKcal;
  const gap = totalKcal > 0 ? totalKcal - targetKcal : 0;

  const intensityEl = document.querySelector('.edit-intensity-chip.active');
  const intensity = intensityEl ? intensityEl.dataset.intensity : 'mid';

  const newEntry = {
    date: editingDate, weight, waist, appKcal, totalKcal, gap,
    bmr, maintenance, targetKcal, intensity, timestamp: new Date().toISOString()
  };

  // 既存の同日データを上書き or 追加
  const existingIdx = APP.dailyLogs.findIndex(l => l.date === editingDate);
  if (existingIdx >= 0) {
    APP.dailyLogs[existingIdx] = newEntry;
  } else {
    APP.dailyLogs.push(newEntry);
    APP.dailyLogs.sort((a, b) => a.date.localeCompare(b.date));
  }
  localStorage.setItem('dailyLogs', JSON.stringify(APP.dailyLogs));
  sendToGas('daily', newEntry);

  // プロフィールの最新体重を更新
  if (editingDate === new Date().toISOString().split('T')[0]) {
    APP.profile.weight = weight;
    if (waist) APP.profile.waist = waist;
    localStorage.setItem('profile', JSON.stringify(APP.profile));
  }

  renderCalendar();
  updateAnalysis();
  closeModal('day-edit-modal');
  showToast(`${editingDate} のデータを保存しました！`, 'success');
}

function deleteDayLog() {
  if (!editingDate) return;
  if (!confirm(`${editingDate} の日次データを削除しますか？`)) return;
  APP.dailyLogs = APP.dailyLogs.filter(l => l.date !== editingDate);
  localStorage.setItem('dailyLogs', JSON.stringify(APP.dailyLogs));
  renderCalendar();
  updateAnalysis();
  closeModal('day-edit-modal');
  showToast('日次データを削除しました', 'success');
}

function deleteTrainingLog() {
  if (!editingDate) return;
  if (!confirm(`${editingDate} のトレーニングデータを削除しますか？`)) return;
  APP.trainingLogs = APP.trainingLogs.filter(l => l.date !== editingDate);
  localStorage.setItem('trainingLogs', JSON.stringify(APP.trainingLogs));
  renderCalendar();
  updateRecoveryView();
  closeModal('day-edit-modal');
  showToast('トレーニングデータを削除しました', 'success');
}

function gotoTrainingEdit() {
  // モーダルを閉じてトレーニングセクションへ遷移
  closeModal('day-edit-modal');
  APP.todayExercises = [];
  const existingLog = APP.trainingLogs.find(l => l.date === editingDate);
  if (existingLog) APP.todayExercises = [...existingLog.exercises];
  renderTodayMenu();
  switchSection('sec-training');
  showSubPage('training-home');
  showToast(`${editingDate} のトレーニングを編集中`, 'success');
}

// ==================== MEAL PLANNING ====================
function renderMealTab() {
  const phaseSelect = document.getElementById('meal-phase');
  if (!phaseSelect) return;
  updateMealTargets();
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('today-plan-date').textContent = today;
  renderMealPlannedList(today, 'meal-planned-list');
}

window.updateMealTargets = function() {
  const phaseSelect = document.getElementById('meal-phase');
  const phase = phaseSelect ? phaseSelect.value : 'phase1';
  let intensity = 'mid';
  
  const intensitySelect = document.querySelector('.meal-intensity-chip.active');
  if (intensitySelect) {
    intensity = intensitySelect.getAttribute('data-intensity');
  }

  const weight = APP.profile.weight || 80;
  targetPFC = calculateMealTargets(phase, weight, intensity);
  
  const pfcelP = document.getElementById('mt-p');
  if (pfcelP) pfcelP.textContent = targetPFC.p + 'g';
  const pfcelF = document.getElementById('mt-f');
  if (pfcelF) pfcelF.textContent = targetPFC.f + 'g';
  const pfcelC = document.getElementById('mt-c');
  if (pfcelC) pfcelC.textContent = targetPFC.c + 'g';
  const pfcelKcal = document.getElementById('meal-target-kcal');
  if (pfcelKcal) pfcelKcal.textContent = targetPFC.kcal + ' kcal';
  const pfcelView = document.getElementById('meal-targets-view');
  if (pfcelView) pfcelView.style.display = 'block';

  if (typeof renderMpDraftList === 'function' && document.getElementById('meal-planner-modal') && document.getElementById('meal-planner-modal').classList.contains('active')) {
    renderMpDraftList();
  }
};

window.setDayIntensity = function(prefix, intensity) {
  const chips = document.querySelectorAll(`.${prefix}-intensity-chip`);
  chips.forEach(c => c.classList.remove('active'));
  const target = document.querySelector(`.${prefix}-intensity-chip[data-intensity="${intensity}"]`);
  if (target) target.classList.add('active');
};

window.setMealIntensity = function(intensity, btnEl) {
  const chips = document.querySelectorAll('.meal-intensity-chip');
  chips.forEach(c => c.classList.remove('active'));
  
  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    const targets = document.querySelectorAll('.meal-intensity-chip[data-intensity="' + intensity + '"]');
    targets.forEach(t => t.classList.add('active'));
  }
  
  updateMealTargets();
};

function renderMealPlannedList(dateStr, containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const plan = APP.mealPlans[dateStr];
  if (!plan || plan.length === 0) {
    c.innerHTML = '<p style="color:#666;font-size:12px;text-align:center;">プランが作成されていません</p>';
    // also update day summary
    const dp = document.getElementById('dm-p');
    if (dp) {
      dp.textContent = '0g';
      document.getElementById('dm-f').textContent = '0g';
      document.getElementById('dm-c').textContent = '0g';
    }
    return;
  }
  let totalP=0, totalF=0, totalC=0, totalKcal=0;
  let html = '';
  plan.forEach(item => {
    totalP += item.p; totalF += item.f; totalC += item.c; totalKcal += item.kcal;
    html += `
      <div class="meal-item">
        <span class="meal-item__timing">${formatTiming(item.timing)}</span>
        <div class="meal-item__name">${item.name} <span class="meal-item__amount">${item.amount}g</span></div>
        <div class="meal-item__macros">
          <span class="meal-item__p">P:${item.p.toFixed(1)}</span>
          <span class="meal-item__f">F:${item.f.toFixed(1)}</span>
          <span class="meal-item__c">C:${item.c.toFixed(1)}</span>
        </div>
      </div>
    `;
  });
  c.innerHTML = html;
  
  // also update day summary
  const dp = document.getElementById('dm-p');
  if (dp) {
    dp.textContent = totalP.toFixed(1) + 'g';
    document.getElementById('dm-f').textContent = totalF.toFixed(1) + 'g';
    document.getElementById('dm-c').textContent = totalC.toFixed(1) + 'g';
  }
}

function renderEditMealSummary(dateStr) {
  renderMealPlannedList(dateStr, 'edit-meal-list');
}

function formatTiming(timing) {
  const map = { 'morning': '☀ 朝', 'lunch': '🕛 昼', 'pre_workout': '⚡ プレWO', 'night': '🌙 夜' };
  return map[timing] || timing;
}

window.openMealPlannerModalForDay = function() {
  if (!editingDate) return;
  closeModal('day-edit-modal');
  openMealPlannerModal(editingDate);
};

window.openMealPlannerModal = function(dateStr) {
  const inputDate = (typeof dateStr === 'string') ? dateStr : '';
  currentMealDate = inputDate || new Date().toISOString().split('T')[0];
  const title = document.getElementById('meal-planner-title');
  if (title) title.textContent = `食事プラン構築 (${currentMealDate})`;
  
  let targetIntensity = 'mid';
  const daily = APP.dailyLogs.find(l => l.date === currentMealDate);
  if (daily && daily.intensity) targetIntensity = daily.intensity;
  else {
    const editC = document.querySelector('.edit-intensity-chip.active');
    const homeC = document.querySelector('.home-intensity-chip.active');
    if (document.getElementById('day-edit-modal').classList.contains('active') && editC) targetIntensity = editC.dataset.intensity;
    else if (homeC) targetIntensity = homeC.dataset.intensity;
  }
  
  const phaseSelect = document.getElementById('meal-phase');
  const phase = phaseSelect ? phaseSelect.value : 'phase1';
  targetPFC = calculateMealTargets(phase, APP.profile.weight || 80, targetIntensity);
  
  // Load existing plan
  currentMealDraft = APP.mealPlans[currentMealDate] ? JSON.parse(JSON.stringify(APP.mealPlans[currentMealDate])) : [];
  
  updateMpTimingHint();
  renderMpDraftList();
  openModal('meal-planner-modal');
};

window.updateMpTimingHint = function() {
  const val = document.getElementById('mp-ingredient-select').value;
  const amtInput = document.getElementById('mp-amount');
  const dbItem = INGREDIENTS_DB[val];
  if (dbItem && dbItem.fixedAmount) {
    amtInput.value = dbItem.fixedAmount;
    amtInput.disabled = true;
  } else {
    amtInput.disabled = false;
  }
  
  const hint = document.getElementById('mp-timing-hint');
  let hintText = '';
  if (val === 'potato') hintText = "💡 食物繊維・難消化性デンプンが多く腹持ちが良いので「夜」への配置がおすすめです。";
  else if (val === 'white_rice') hintText = "💡 速やかなグリコーゲン補充に向くため「プレWO」や「朝」への配置がおすすめです。";
  else if (val === 'mackerel_can') hintText = "💡 サバ缶は1缶約28gの脂質を含むため、1日の脂質ターゲットに大きく影響します。Phaseに応じて調整。";
  
  if (hintText) {
    hint.textContent = hintText;
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }
};

let activeMpTiming = 'morning';
window.setMpTiming = function(timing, btnEl) {
  activeMpTiming = timing;
  document.querySelectorAll('#mp-timing-group .chip').forEach(c => c.classList.remove('active'));
  btnEl.classList.add('active');
};

window.addMpIngredient = function() {
  const val = document.getElementById('mp-ingredient-select').value;
  let amount = parseFloat(document.getElementById('mp-amount').value) || 0;
  const dbItem = INGREDIENTS_DB[val];
  if (!dbItem) return;
  
  if (dbItem.fixedAmount) amount = dbItem.fixedAmount;
  if (amount <= 0 && dbItem.name.indexOf('サプリ') === -1) { showToast('グラム数を入力してください'); return; }
  
  const ratio = amount / 100;
  const itemP = dbItem.p * ratio;
  const itemF = dbItem.f * ratio;
  const itemC = dbItem.c * ratio;
  const itemKcal = dbItem.kcal * ratio;
  
  currentMealDraft.push({
    id: 'mp_' + Date.now(),
    ingredientId: val,
    name: dbItem.name,
    amount: amount,
    timing: activeMpTiming,
    p: itemP,
    f: itemF,
    c: itemC,
    kcal: itemKcal
  });
  
  // Sort by timing
  const tOrder = { 'morning':1, 'lunch':2, 'pre_workout':3, 'night':4 };
  currentMealDraft.sort((a,b) => tOrder[a.timing] - tOrder[b.timing]);
  
  renderMpDraftList();
};

window.autoGenerateOptimalMealPlan = function() {
  if (!targetPFC.p || !targetPFC.kcal) {
    showToast('先にフェーズと強度を選択してターゲットを算出してください', 'error');
    return;
  }
  if (!confirm('現在のスケジュールに合わせて（トレ後を夜に統合）、自動生成しますか？\n(※現在のプランは上書きされます)')) return;

  const plan = [];
  // EAAや調味料分としてざっくり150kcal(P:-15g, F:-2g, C:-20g)をアンダーにする
  let remainingP = targetPFC.p - 15;
  let remainingF = Math.max(0, targetPFC.f - 2);
  let remainingC = Math.max(0, targetPFC.c - 20);

  const add = (ingId, timing, amount) => {
    if (amount <= 0) return;
    const dbItem = INGREDIENTS_DB[ingId];
    if (!dbItem) return;
    const ratio = amount / 100;
    const p = dbItem.p * ratio;
    const f = dbItem.f * ratio;
    const c = dbItem.c * ratio;
    plan.push({
      id: 'mp_' + Math.random().toString(36).substr(2, 9),
      ingredientId: ingId, name: dbItem.name, amount: Math.round(amount),
      timing, p, f, c, kcal: Math.round(dbItem.kcal * ratio)
    });
    remainingP -= p; remainingF -= f; remainingC -= c;
  };

  // サプリと乾物の固定配置
  add('multi_v', 'morning', 1);
  add('vit_d_ca', 'morning', 1);
  add('potassium', 'night', 1);
  add('wakame', 'lunch', 5);
  add('daikon', 'night', 10);

  // 1. Fat充当: 朝〜昼。サバ缶(190g=54.15F) と 卵(10.3F)
  if (remainingF >= 40) {
    add('mackerel_can', 'morning', 190); 
  }
  if (remainingF > 5) {
    const eggNeedGrams = (remainingF / INGREDIENTS_DB['egg'].f) * 100;
    const eggAmount = Math.min(250, eggNeedGrams); // 最大5個まで
    add('egg', 'lunch', eggAmount);
  }

  // 2. Protein充当
  add('niboshi', 'lunch', 15);

  // 残りのPを鶏胸肉で分配 (朝はサバ缶があるので、昼、プレ、夜の3分割)
  if (remainingP > 0) {
    const chickenNeedGrams = (remainingP / INGREDIENTS_DB['chicken_breast'].p) * 100;
    const ckcPerMeal = chickenNeedGrams / 3;
    add('chicken_breast', 'lunch', ckcPerMeal);
    add('chicken_breast', 'pre_workout', ckcPerMeal);
    add('chicken_breast', 'night', ckcPerMeal);
  }

  // 3. Carb充当 (残りの全てを分配)
  if (remainingC > 0) {
    // プレWO: 20% (白米)
    const woC = remainingC * 0.20;
    add('white_rice', 'pre_workout', (woC / INGREDIENTS_DB['white_rice'].c) * 100);
    remainingC -= woC;

    // 朝・昼: 残りのうち40%ずつをミックスご飯 (大体全体から20%, 20%)
    const dayC = remainingC * 0.50;
    add('mixed_rice', 'morning', (dayC * 0.5 / INGREDIENTS_DB['mixed_rice'].c) * 100);
    add('mixed_rice', 'lunch', (dayC * 0.5 / INGREDIENTS_DB['mixed_rice'].c) * 100);
    remainingC -= dayC;

    // 夜(トレ後兼用): 残りのすべてのCarb (全体から約40%)
    // じゃがいもはMax200g (C約35g) として残りは白米で吸収を早める
    const potatoGrams = Math.min(200, (remainingC / INGREDIENTS_DB['potato'].c) * 100);
    const actualPotatoC = (potatoGrams / 100) * INGREDIENTS_DB['potato'].c;
    add('potato', 'night', potatoGrams);
    remainingC -= actualPotatoC;
    
    if (remainingC > 0) {
       add('white_rice', 'night', (remainingC / INGREDIENTS_DB['white_rice'].c) * 100);
    }
  }

  const tOrder = { 'morning':1, 'lunch':2, 'pre_workout':3, 'night':4 };
  plan.sort((a,b) => tOrder[a.timing] - tOrder[b.timing]);
  
  currentMealDraft = plan;
  renderMpDraftList();
  showToast('食事プランをスケジュールに合わせて再構築しました！', 'success');
};

window.removeMpIngredient = function(id) {
  currentMealDraft = currentMealDraft.filter(i => i.id !== id);
  renderMpDraftList();
};

function renderMpDraftList() {
  let totalP=0, totalF=0, totalC=0, totalKcal=0;
  let html = '';
  
  currentMealDraft.forEach(item => {
    totalP += item.p; totalF += item.f; totalC += item.c; totalKcal += item.kcal;
    html += `
      <div class="meal-item" style="position:relative; padding-right: 32px;">
        <span class="meal-item__timing">${formatTiming(item.timing)}</span>
        <div class="meal-item__name">${item.name} <span class="meal-item__amount">${item.amount}g</span></div>
        <div class="meal-item__macros">
          <span class="meal-item__p">P:${item.p.toFixed(1)}</span>
          <span class="meal-item__f">F:${item.f.toFixed(1)}</span>
          <span class="meal-item__c">C:${item.c.toFixed(1)}</span>
        </div>
        <button onclick="removeMpIngredient('${item.id}')" style="position:absolute;right:4px;background:none;border:none;color:#999;font-size:18px;cursor:pointer;">&times;</button>
      </div>
    `;
  });
  
  if (currentMealDraft.length === 0) {
    html = '<p style="color:#666;font-size:12px;text-align:center;">追加された食材はありません</p>';
  }
  
  document.getElementById('mp-added-list').innerHTML = html;
  
  document.getElementById('mp-total-kcal').textContent = `${totalKcal.toFixed(0)} kcal / ${targetPFC.kcal} kcal`;
  
  const pPerc = targetPFC.p > 0 ? Math.min(100, (totalP / targetPFC.p) * 100) : 0;
  const fPerc = targetPFC.f > 0 ? Math.min(100, (totalF / targetPFC.f) * 100) : 0;
  const cPerc = targetPFC.c > 0 ? Math.min(100, (totalC / targetPFC.c) * 100) : 0;
  
  const pb = document.getElementById('mp-p-bar'); if(pb) pb.style.width = pPerc + '%';
  const fb = document.getElementById('mp-f-bar'); if(fb) fb.style.width = fPerc + '%';
  const cb = document.getElementById('mp-c-bar'); if(cb) cb.style.width = cPerc + '%';
  
  const pt = document.getElementById('mp-p-text'); if(pt) pt.textContent = `${totalP.toFixed(0)}/${targetPFC.p}g`;
  const ft = document.getElementById('mp-f-text'); if(ft) ft.textContent = `${totalF.toFixed(0)}/${targetPFC.f}g`;
  const ct = document.getElementById('mp-c-text'); if(ct) ct.textContent = `${totalC.toFixed(0)}/${targetPFC.c}g`;
}

window.saveMealPlan = function() {
  APP.mealPlans[currentMealDate] = JSON.parse(JSON.stringify(currentMealDraft));
  localStorage.setItem('mealPlans', JSON.stringify(APP.mealPlans));
  
  pushSyncToGas();
  closeModal('meal-planner-modal');
  showToast(`${currentMealDate}の食事プランを保存しました`, 'success');
  
  const spanelMeal = document.getElementById('spanel-meal');
  if (spanelMeal && spanelMeal.style.display !== 'none') {
    renderMealTab();
  }
  
  renderCalendar();
};

window.saveKVSettings = function() {
  const url = document.getElementById('settings-kv-url').value.trim();
  const token = document.getElementById('settings-kv-token').value.trim();
  APP.kvUrl = url;
  APP.kvToken = token;
  localStorage.setItem('kvUrl', url);
  localStorage.setItem('kvToken', token);
  showToast('Upstash KV設定を保存しました', 'success');
  if (url && token) pullSyncFromGas();
};


window.toggleHomeCalendar = function() {
  const container = document.getElementById('home-calendar-container');
  if (!container) return;
  if (container.style.display === 'none') {
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
};
