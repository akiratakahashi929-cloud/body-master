/* ============================================================
   BODY MASTER v2 — app.js
   体系管理 & 筋トレ DX ツール
   ============================================================ */

// ==================== STATE ====================
const APP = {
  gasUrl: localStorage.getItem('gasUrl') || 'https://script.google.com/macros/s/AKfycbz6RkpFaz0Wm5qP2etNdYafG3lD89gkp8s0YilYa_NgY0-4PlHiNd_xJYQThM3lKSTU/exec',
  profile: JSON.parse(localStorage.getItem('profile') || 'null') || {
    height: 168, weight: 82.7, age: 32, gender: 'male',
    activity: 1.375, deficit: 500, targetLoss: 10, waist: 0
  },
  dailyLogs: JSON.parse(localStorage.getItem('dailyLogs') || '[]'),
  trainingLogs: JSON.parse(localStorage.getItem('trainingLogs') || '[]'),
  todayExercises: [],
  customExercises: JSON.parse(localStorage.getItem('customExercises') || '[]'),
  settings: JSON.parse(localStorage.getItem('appSettings') || 'null') || {
    maxWeight: 150, maxReps: 30
  },
  exerciseWeightSettings: JSON.parse(localStorage.getItem('exerciseWeightSettings') || 'null') || {},
  calendarDate: new Date(),
  selectedDate: null,
  restPresets: JSON.parse(localStorage.getItem('restPresets') || '[60, 90, 120, 180]'),
};

// ==================== EXERCISE DATABASE ====================
const DEFAULT_EXERCISES = [
  { name: 'バックスクワット', category: '脚', icon: '🦵', freq: 36, muscles: ['大腿四頭筋','ハムストリング','臀筋','脊柱起立筋'] },
  { name: 'レッグプレス', category: '脚', icon: '🦵', freq: 47, muscles: ['大腿四頭筋','臀筋'] },
  { name: 'レッグエクステンション', category: '脚', icon: '🦵', freq: 41, muscles: ['大腿四頭筋'] },
  { name: 'シーテッドレッグカール', category: '脚', icon: '🦵', freq: 63, muscles: ['ハムストリング'] },
  { name: 'ヒップアブダクションマシン', category: '脚', icon: '🦵', freq: 42, muscles: ['臀筋','内転筋'] },
  { name: 'ダンベルブルガリアンスプリットスクワット', category: '脚', icon: '🦵', freq: 33, muscles: ['大腿四頭筋','臀筋','ハムストリング'] },
  { name: 'インクラインダンベルベンチプレス', category: '胸', icon: '🏋️', freq: 54, muscles: ['大胸筋上部','三角筋前部','上腕三頭筋'] },
  { name: 'ディップチンアシスト', category: '胸', icon: '🏋️', freq: 67, muscles: ['大胸筋下部','上腕三頭筋','三角筋前部'] },
  { name: 'スミスマシンインクラインベンチプレス', category: '胸', icon: '🏋️', freq: 31, muscles: ['大胸筋上部','三角筋前部','上腕三頭筋'] },
  { name: 'ラットプルダウン', category: '背筋', icon: '🔙', freq: 53, muscles: ['広背筋','僧帽筋','上腕二頭筋'] },
  { name: 'シーテッドケーブルロウ', category: '背筋', icon: '🔙', freq: 63, muscles: ['広背筋','僧帽筋','脊柱起立筋','上腕二頭筋'] },
  { name: 'パラレルグリップラットプルダウン', category: '背筋', icon: '🔙', freq: 56, muscles: ['広背筋','僧帽筋','上腕二頭筋'] },
  { name: 'ストレートアームプルダウン', category: '背筋', icon: '🔙', freq: 40, muscles: ['広背筋','腹直筋下部'] },
  { name: 'アシストプルアップマシン', category: '背筋', icon: '🔙', freq: 34, muscles: ['広背筋','上腕二頭筋','僧帽筋'] },
  { name: 'ダンベルサイドレイズ', category: '肩', icon: '🤾', freq: 81, muscles: ['三角筋側部'] },
  { name: 'シーテッドダンベルショルダープレス', category: '肩', icon: '🤾', freq: 50, muscles: ['三角筋前部','三角筋側部','上腕三頭筋'] },
  { name: 'リアデルトフライマシン', category: '肩', icon: '🤾', freq: 56, muscles: ['三角筋後部','僧帽筋'] },
  { name: 'ダンベルアップライトロウ', category: '肩', icon: '🤾', freq: 32, muscles: ['三角筋側部','僧帽筋'] },
  { name: 'ケーブルプレスダウン', category: '腕', icon: '💪', freq: 41, muscles: ['上腕三頭筋'] },
  { name: 'ハンギングレッグレイズ', category: '腹筋', icon: '🎯', freq: 45, muscles: ['腹直筋下部','腸腰筋','腹斜筋'] },
  { name: 'トレッドミル', category: 'カーディオ', icon: '🏃', freq: 49, muscles: ['大腿四頭筋','ハムストリング','腓腹筋'] },
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
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  loadProfile();
  renderCalendar();
  updateHomeStats();
  updateGasConfigBanner();
  updateAnalysis();
  updateRecoveryView();
  initDailyListeners();
  initEmojiPicker();
  renderRestPresets();
  setupRippleEffect();
  // Set daily date
  const dailyDate = document.getElementById('daily-date');
  if (dailyDate) dailyDate.value = new Date().toISOString().split('T')[0];
});

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
  // Refresh views
  if (sectionId === 'sec-home') renderCalendar();
  if (sectionId === 'sec-recovery') updateRecoveryView();
  if (sectionId === 'sec-analysis') updateAnalysis();
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
    const logs = APP.trainingLogs.filter(l => l.date === dateStr);
    if (logs.length > 0) {
      const categories = [...new Set(logs.flatMap(l => l.exercises.map(e => e.category)))];
      const totalSets = logs.reduce((s, l) => s + (l.totalSets || 0), 0);
      const catDots = categories.slice(0, 3).map(cat =>
        `<span class="calendar__dot calendar__dot--${getCategoryClass(cat)}"></span>`
      ).join('');

      el.innerHTML = `
        <span class="cal-day-num">${day}</span>
        <div class="cal-day-info">${catDots}</div>
        <span class="cal-day-sets">${totalSets}s</span>
      `;
    } else {
      el.innerHTML = `<span class="cal-day-num">${day}</span>`;
    }

    el.onclick = () => {
      APP.selectedDate = dateStr;
      APP.todayExercises = [];
      const existingLog = APP.trainingLogs.find(l => l.date === dateStr);
      if (existingLog) APP.todayExercises = [...existingLog.exercises];
      renderTodayMenu();
      switchSection('sec-training');
      showSubPage('training-home');
    };
  } else {
    el.innerHTML = `<span class="cal-day-num">${day}</span>`;
  }

  return el;
}

function getCategoryClass(cat) {
  const map = { '胸': 'chest', '背筋': 'back', '脚': 'legs', '肩': 'shoulders', '腕': 'arms', '腹筋': 'abs', 'カーディオ': 'cardio' };
  return map[cat] || 'chest';
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
    <p>📌 <strong>BMI ${bmi.toFixed(1)}</strong>（${bmiCat}）</p>
    <p>🔥 安静時でも1日に <strong>${bmr.toFixed(0)} kcal</strong> を消費します。</p>
    <p>⚡ 活動量を考慮した1日の消費カロリーは <strong>${maintenance.toFixed(0)} kcal</strong> です。</p>
    <p>🎯 ${targetLoss}kg 減量のために、1日 <strong>${targetKcal.toFixed(0)} kcal</strong> 以内に抑える必要があります。</p>
    <p>📅 1日 ${deficit} kcal の赤字で、目標達成まで約 <strong>${daysToGoal}日</strong>（${Math.ceil(daysToGoal / 30)}ヶ月）かかります。</p>
    ${waist ? `<p>📏 腹囲/身長比: ${(waist / height).toFixed(2)}（${waist / height < 0.5 ? '✅ 理想的' : waist / height < 0.6 ? '⚠️ 注意' : '🔴 高リスク'}）</p>` : ''}
  `;

  document.getElementById('body-results').style.display = 'block';
  document.getElementById('body-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast('計算完了！', 'success');
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
function initDailyListeners() {
  ['daily-app-kcal', 'daily-extra-kcal', 'daily-weight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateDailyCalc);
  });
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
  APP.dailyLogs.push(logEntry);
  localStorage.setItem('dailyLogs', JSON.stringify(APP.dailyLogs));
  sendToGas('daily', logEntry);
  updateHomeStats(); updateAnalysis();
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
        <div class="exercise-item__checkbox">${isSelected ? '✓' : ''}</div>
        <div class="exercise-item__icon">${ex.icon}</div>
        <span class="exercise-item__name">${ex.name}</span>
        <span style="font-size: 9px; color: #555;">${maxW}kg</span>
        <span style="font-size: 10px; color: #666;">${ex.category}</span>
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
      name: ex.name, category: ex.category, icon: ex.icon,
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
      html += `<div style="font-size: 10px; font-weight: 700; color: var(--bulls-red-light); text-transform: uppercase; letter-spacing: 1px; padding: 8px 0 2px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.08);">${ex.icon} ${currentCat}</div>`;
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
      <span class="today-menu-item__icon">${ex.icon}</span>
      <div class="today-menu-item__info">
        <div class="today-menu-item__name">${ex.name}</div>
        <div class="today-menu-item__meta">${ex.category} ${ex.recorded ? (ex.cardioData ? `| ${ex.cardioData.minutes}分 / ${ex.cardioData.incline}° / ${ex.cardioData.speed}km/h` : `| ${ex.totalSets}set / ${ex.totalVolume.toLocaleString()}kg`) : '| 未記録'}</div>
      </div>
      <button class="today-menu-item__remove" onclick="event.stopPropagation(); removeMenuExercise(${idx})">✕</button>
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

  document.getElementById('set-exercise-icon').textContent = ex.icon;
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
      <span class="set-card__number">🏃 トレッドミル設定</span>
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

  const card = document.createElement('div');
  card.className = 'set-card';
  card.innerHTML = `
    <div class="set-card__header">
      <span class="set-card__number">Set ${num}</span>
      <button class="set-card__delete" onclick="deleteSetCard(this)">✕</button>
    </div>
    <div class="slider-group">
      <div class="slider-header">
        <span class="slider-label">重量</span>
        <span class="slider-value"><span class="sv-weight">${initWeight}</span><span class="slider-unit"> kg</span></span>
      </div>
      <input type="range" min="0" max="${maxW}" step="2.5" value="${initWeight}" oninput="this.closest('.set-card').querySelector('.sv-weight').textContent=this.value">
    </div>
    <div class="slider-group">
      <div class="slider-header">
        <span class="slider-label">回数</span>
        <span class="slider-value"><span class="sv-reps">${initReps}</span><span class="slider-unit"> 回</span></span>
      </div>
      <input type="range" min="0" max="${maxR}" step="1" value="${initReps}" oninput="this.closest('.set-card').querySelector('.sv-reps').textContent=this.value">
    </div>
  `;
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
      if (weight > 0 || reps > 0) sets.push({ weight, reps });
    });

    if (sets.length === 0) { showToast('セットデータを入力してください', 'error'); return; }

    const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
    ex.sets = sets;
    ex.totalSets = sets.length;
    ex.totalVolume = totalVolume;
    ex.notes = notes;
    ex.recorded = true;

    showToast(`${ex.name} を記録しました！`, 'success');
  }

  renderTodayMenu();
  showSubPage('training-home');
}

// --- Custom Exercise ---
function initEmojiPicker() {
  const emojis = ['🦵','🏋️','🔙','🤾','💪','🎯','🏃','🚴','🧘','🤸','⛹️','🏊','🤼','🥊','🏄','🧗','🪂','💥','⚡','🔥','❄️','🌊','🎯','🏆','🥇','💎','🫀','🧠'];
  const picker = document.getElementById('emoji-picker');
  picker.innerHTML = emojis.map(e => `<div class="emoji-picker__item" onclick="selectEmoji(this, '${e}')">${e}</div>`).join('');
}

let selectedEmoji = '💪';
function selectEmoji(el, emoji) {
  document.querySelectorAll('.emoji-picker__item').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedEmoji = emoji;
}

function addCustomExercise() {
  const name = document.getElementById('new-exercise-name').value.trim();
  const category = document.getElementById('new-exercise-category').value;
  if (!name) { showToast('種目名を入力してください', 'error'); return; }

  APP.customExercises.push({ name, category, icon: selectedEmoji, freq: 0 });
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
    btn.textContent = '▶';
    btn.className = 'training-timer-bar__btn training-timer-bar__btn--start';
  } else {
    // Start
    trainingTimerStartTime = Date.now();
    trainingTimerRunning = true;
    btn.textContent = '⏸';
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
  btn.textContent = '▶';
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
    btn.textContent = '▶';
  } else {
    // Start
    if (restTimerRemaining <= 0) restTimerRemaining = restTimerDuration;
    restTimerStartTime = Date.now();
    restTimerRunning = true;
    btn.textContent = '⏸';
    restTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - restTimerStartTime) / 1000;
      restTimerRemaining = restTimerDuration - elapsed;
      if (restTimerRemaining <= 0) {
        restTimerRemaining = 0;
        clearInterval(restTimerInterval);
        restTimerRunning = false;
        btn.textContent = '▶';
        // Alert
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgkKeslmk2LWaYtLqWZT06bqS6u5diQUJ3qby6lV5ESXmtu7mTW0hLe668uJNbSE5+sLy3kVpIT3+wvLeRWkhPf7C8t5Fa').play(); } catch(e) {}
        showToast('⏱ レスト終了！', 'success');
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
  document.getElementById('rest-start-btn').textContent = '▶';
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
  const now = Date.now();
  const listContainer = document.getElementById('recovery-list');

  const detailedMuscles = Object.keys(RECOVERY_BASE);
  let html = '';
  let currentGroup = '';

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

    // Update SVG body model colors
    updateMuscleColor(muscle, color);

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
}

// Detailed muscle → SVG element ID mapping
function updateMuscleColor(muscle, color) {
  const mappings = {
    '大胸筋上部':   ['m-chest-upper-l','m-chest-upper-r'],
    '大胸筋下部':   ['m-chest-lower-l','m-chest-lower-r'],
    '三角筋前部':   ['m-delt-front-l','m-delt-front-r'],
    '三角筋側部':   ['m-delt-side-l','m-delt-side-r'],
    '三角筋後部':   ['m-delt-rear-l','m-delt-rear-r'],
    '僧帽筋':       ['m-traps'],
    '広背筋':       ['m-lat-l','m-lat-r'],
    '脊柱起立筋':   ['m-erector','m-lower-back'],
    '上腕二頭筋':   ['m-bicep-l','m-bicep-r'],
    '上腕三頭筋':   ['m-tricep-l','m-tricep-r'],
    '前腕':         ['m-forearm-l','m-forearm-r','m-forearm-back-l','m-forearm-back-r'],
    '腹直筋上部':   ['m-abs-upper'],
    '腹直筋下部':   ['m-abs-lower'],
    '腹斜筋':       ['m-oblique-l','m-oblique-r'],
    '腸腰筋':       ['m-hipflex-l','m-hipflex-r'],
    '大腿四頭筋':   ['m-quad-l','m-quad-r'],
    '内転筋':       ['m-adduct-l','m-adduct-r'],
    'ハムストリング': ['m-ham-l','m-ham-r','m-ham-inner-l','m-ham-inner-r'],
    '臀筋':         ['m-glute-l','m-glute-r'],
    '腓腹筋':       ['m-calf-front-l','m-calf-front-r','m-calf-back-l','m-calf-back-r'],
  };

  const ids = mappings[muscle] || [];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.fill = color;
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
    document.getElementById('sw-start').textContent = '▶';
  } else {
    swStartTime = Date.now(); swRunning = true;
    document.getElementById('sw-start').textContent = '⏸';
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
  document.getElementById('sw-start').textContent = '▶';
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
  document.getElementById('tm-start').textContent = '▶';
  updateTimerDisplay();
}

function toggleTimer() {
  if (tmRunning) {
    clearInterval(tmInterval); tmRunning = false;
    document.getElementById('tm-start').textContent = '▶';
  } else {
    if (tmRemaining <= 0) tmRemaining = tmTotal || 60;
    tmRunning = true;
    document.getElementById('tm-start').textContent = '⏸';
    document.getElementById('tm-start').classList.add('pulse');
    const startTime = Date.now();
    const startRemaining = tmRemaining;
    tmInterval = setInterval(() => {
      tmRemaining = startRemaining - (Date.now() - startTime) / 1000;
      if (tmRemaining <= 0) {
        tmRemaining = 0; clearInterval(tmInterval); tmRunning = false;
        document.getElementById('tm-start').textContent = '▶';
        document.getElementById('tm-start').classList.remove('pulse');
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        showToast('⏱ タイマー終了！', 'success');
      }
      updateTimerDisplay();
    }, 100);
  }
}

function resetTimer() {
  clearInterval(tmInterval); tmRemaining = tmTotal; tmRunning = false;
  document.getElementById('tm-start').textContent = '▶';
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

function updateAnalysis() {
  const logs = APP.dailyLogs;
  if (logs.length === 0) return;

  // Weight chart
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

  // Stats
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
  document.getElementById(id).classList.add('active');
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
