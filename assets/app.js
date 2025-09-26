const tg = window.Telegram?.WebApp;
const API_BASE = '/api';

const $ = (selector, ctx = document) => ctx.querySelector(selector);
const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

const Toast = {
  el: document.getElementById('toast'),
  show(message, ok = true) {
    if (!this.el) return;
    this.el.textContent = message;
    this.el.style.background = ok ? 'var(--primary)' : 'var(--danger)';
    this.el.classList.add('show');
    clearTimeout(this.t);
    this.t = setTimeout(() => this.el.classList.remove('show'), 2200);
  },
};

const monthsRu = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const cache = (window.__aly_cache = window.__aly_cache || { lunar: {} });

const state = {

  activeTab: 'home',
  today: new Date().toISOString().slice(0, 10),
  region: localStorage.getItem('region') || 'RU-MOW',
  climate: localStorage.getItem('climate') || 'temperate',
  cultures: JSON.parse(localStorage.getItem('cultures') || '[]'),
  home: null,
  garden: [],
  important: [],
  lunarMonth: null,
  currentMonth: '2025-12',
  calendarData: null,
  demo: false,

};

const speak = (text) => {
  if (!('speechSynthesis' in window)) {
    Toast.show('Озвучка недоступна', false);
    return;
  }
  if (!text?.trim()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

const speakElement = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return;
  const text = el.innerText || el.textContent;
  speak(text);
};

const speakHome = () => {
  if (!state.home) return;
  const { lunar = {}, garden = {}, important = {} } = state.home;
  const lines = [
    'Лунный календарь.',
    `День ${lunar?.moon_day || '—'}, ${phaseSpeech(lunar?.phase)}.`,
    `Хорошо: ${(lunar?.is_good_for || []).join(', ') || '—'}.`,
    `Не рекомендуется: ${(lunar?.is_bad_for || []).join(', ') || '—'}.`,
    'Совет по огороду.',
    `${garden?.title || ''}.`,
    (garden?.steps || []).join('. '),
    'Важно сегодня.',
    `${important?.title || ''}.`,
    important?.summary || '',
  ];
  speak(lines.join(' '));
};

function applyPrefs() {
  document.body.classList.toggle('big-text', localStorage.getItem('bigText') === '1');
  document.body.classList.toggle('high-contrast', localStorage.getItem('hiContrast') === '1');
  document.body.classList.toggle('night', localStorage.getItem('night') === '1');
}

const isDemoMode = () => {
  const search = new URLSearchParams(location.search);
  return search.get('demo') === '1';
};

const safeJsonFetch = async (url, fallback) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Bad response');
    return await res.json();
  } catch (err) {
    console.warn('Fallback for', url, err);
    return fallback;
  }
};

async function getHomeFromApi(date, region) {
  const url = `${API_BASE}/home?date=${encodeURIComponent(date)}&region=${encodeURIComponent(region)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

async function getHomeFromLocal(date) {
  const monthKey = date.slice(0, 7).replace('-', '_');
  const [lunar, tips, important] = await Promise.all([
    safeJsonFetch(`/data/lunar_${monthKey}.json`, null),
    safeJsonFetch('/data/garden_tips.json', []),
    safeJsonFetch('/data/important.json', []),
  ]);

  const day = lunar?.days?.find((item) => item.date === date) || lunar?.days?.[0] || {
    moon_day: 1,
    phase: 'waxing',
    is_good_for: ['листовые'],
    is_bad_for: [],
    notes: 'Нет данных о лунном дне. Работайте в спокойном режиме.',
  };

  const index = new Date(date).getDate();
  const tip = tips.length ? tips[index % tips.length] : {
    culture: 'сад',
    title: 'Пройдитесь по грядкам',
    steps: ['Осмотрите растения на наличие вредителей', 'Полейте при необходимости'],
    difficulty: 'easy',
  };
  const imp = important.length ? important[index % important.length] : {
    topic: 'напоминание',
    title: 'Отдохните и выпейте воды',
    summary: 'Небольшой перерыв пойдёт на пользу.',
    cta: { type: 'done' },
  };

  return { lunar: day, garden: tip, important: imp };
}

function formatPhase(phase) {
  if (!phase || phase === 'unknown') return '—';
  const map = {
    waxing: 'растущая',
    waning: 'убывающая',
    full: 'полнолуние',
    new: 'новолуние',
  };
  return map[phase] || phase;
}

function phaseSpeech(phase) {
  if (!phase || phase === 'unknown') return 'фаза не указана';
  const label = formatPhase(phase);
  if (label === '—') return 'фаза не указана';
  return `фаза ${label}`;
}

function prevMonth(iso) {
  let [year, month] = iso.split('-').map(Number);
  if (month === 1) {
    year -= 1;
    month = 12;
  } else {
    month -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function nextMonth(iso) {
  let [year, month] = iso.split('-').map(Number);
  if (month === 12) {
    year += 1;
    month = 1;
  } else {
    month += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

async function fetchMonthPayload(iso) {
  if (cache.lunar[iso]) return cache.lunar[iso];
  try {
    const res = await fetch(`/api/lunar?month=${iso}`);
    if (res.ok) {
      const payload = await res.json();
      cache.lunar[iso] = payload;
      return payload;
    }
  } catch (err) {
    console.warn('API lunar fetch fallback', iso, err);
  }

  const file = iso.replace('-', '_');
  try {
    const [lunar, guides] = await Promise.all([
      fetch(`/data/lunar_${file}.json`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/data/guides_${file}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    if (lunar) {
      const payload = { ...lunar, guides: guides || { month: iso, planting: { vegetables: [], flowers: [] }, works: [], unfavorable: [] } };
      cache.lunar[iso] = payload;
      return payload;
    }
  } catch (err) {
    console.warn('Local lunar fallback failed', iso, err);
  }
  return null;
}

async function warmCache(iso) {
  if (!iso || cache.lunar[iso]) return;
  try {
    await fetchMonthPayload(iso);
  } catch (err) {
    console.warn('warm cache fail', iso, err);
  }
}

function renderHome() {
  const containerLunar = $('#card-lunar-content');
  const containerGarden = $('#card-garden-content');
  const containerImportant = $('#card-important-content');

  if (!state.home) return;
  const { lunar, garden, important } = state.home;

  containerLunar.innerHTML = `
    <p class="text-lg text-strong text-wrap">${lunar.notes || 'Лунный день'}</p>
    <p>День <span class="text-strong">${lunar.moon_day || '—'}</span>, фаза: <span class="text-strong text-wrap">${formatPhase(lunar.phase)}</span></p>
    <p>Хорошо: <span class="text-strong text-wrap">${(lunar.is_good_for || []).join(', ') || '—'}</span></p>
    <p>Не рекомендуется: <span class="text-strong text-wrap">${(lunar.is_bad_for || []).join(', ') || '—'}</span></p>
  `;

  const gardenSteps = garden?.steps || [];
  containerGarden.innerHTML = `
    <p class="text-lg text-strong text-wrap">${garden?.title || 'Совет для огорода'}</p>
    <div class="text-xs text-muted text-wrap">${garden?.culture || ''}</div>
    ${gardenSteps.length ? `<ul class="list">${gardenSteps.map((step) => `<li class="text-wrap">${step}</li>`).join('')}</ul>` : ''}
    <button type="button" class="btn-secondary card__cta" data-open-garden="${garden?.culture || ''}">Посмотреть подробнее</button>
  `;

  const cta = renderCTA(important.cta);
  containerImportant.innerHTML = `
    <p class="text-lg text-strong text-wrap">${important.title || 'Важно'}</p>
    <p class="text-wrap">${important.summary || ''}</p>
    ${cta}
  `;

  hideSkeleton('#card-lunar-skeleton', containerLunar);
  hideSkeleton('#card-garden-skeleton', containerGarden);
  hideSkeleton('#card-important-skeleton', containerImportant);
}

function renderCTA(cta) {
  if (!cta) {
    return '<button type="button" class="btn card__cta" data-action="done">Отметить «сделано»</button>';
  }
  if (cta.type === 'call') {
    return `<a class="btn card__cta" href="tel:${cta.value}">Позвонить ${cta.value}</a>`;
  }
  if (cta.type === 'link') {
    return `<a class="btn card__cta" href="${cta.value}" target="_blank" rel="noopener">Открыть ссылку</a>`;
  }
  if (cta.type === 'done') {
    return '<button type="button" class="btn card__cta" data-action="done">Отметить «сделано»</button>';
  }
  return '';
}

function hideSkeleton(skeletonSelector, contentEl) {
  const skeleton = $(skeletonSelector);
  skeleton?.classList.add('hidden');
  contentEl?.classList.remove('hidden');
}

// ...existing code...

function getDayCategory(day, meta = {}) {
  if (!meta) return null;
  if (meta.most_favorable?.includes(day)) return 'best';
  if (meta.favorable?.includes(day)) return 'good';
  if (meta.neutral?.includes(day)) return 'neutral';
  if (meta.most_unfavorable?.includes(day)) return 'bad';
  return null;
}

function collectDayGuides(day, guides = {}) {
  const planting = guides.planting || {};
  const plantingItems = [];
  const types = [
    { key: 'vegetables', label: 'Овощи' },
    { key: 'flowers', label: 'Цветы' },
  ];
  types.forEach(({ key, label }) => {
    (planting[key] || []).forEach((item) => {
      if (item.dates?.includes(day)) {
        plantingItems.push(`${label}: ${item.name}`);
      }
    });
  });

  const works = (guides.works || [])
    .filter((work) => work.dates?.includes(day))
    .map((work) => work.name);

  return { plantingItems, works };
}

const FlipCalendar = (() => {
  const stackEl = $('#calendar-stack');
  const containerEl = $('#calendar-flip');
  const skeletonEl = $('#calendar-skeleton');
  const legendEl = $('#calendar-legend');
  const titleEl = $('#calendar-title');
  const dayLabelEl = $('#calendar-day-label');
  const btnPrevMonth = $('#calendar-month-prev');
  const btnNextMonth = $('#calendar-month-next');
  const btnToday = $('#calendar-today');
  const btnPrevDay = $('#calendar-day-prev');
  const btnNextDay = $('#calendar-day-next');

  const badgeMap = {
    best: { className: 'badge-best', label: 'Самые благоприятные' },
    good: { className: 'badge-good', label: 'Благоприятные' },
    neutral: { className: 'badge-neutral', label: 'Нейтральные' },
    bad: { className: 'badge-bad', label: 'Самые неблагоприятные' },
  };

  const moduleState = {
    month: state.currentMonth,
    index: 0,
    data: null,
    loadingToken: 0,
    loadingStartedAt: 0,
  };

  function fmtMonthTitle(iso) {
    const [yearStr, monthStr] = iso.split('-');
    const monthIndex = Number(monthStr) - 1;
    const monthLabel = monthsRu[monthIndex] || '';
    if (!monthLabel) return iso;
    return `${monthLabel} ${yearStr}`;
  }

  function formatWeekday(dateStr) {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    const label = date.toLocaleDateString('ru-RU', { weekday: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function fmtDayLabel(dateStr) {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateStr;
    const label = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function setLoading(flag) {
    if (flag) {
      moduleState.loadingStartedAt = Date.now();
      skeletonEl?.classList.remove('hidden');
      containerEl?.classList.add('hidden');
      btnPrevMonth?.setAttribute('data-loading', '1');
      btnNextMonth?.setAttribute('data-loading', '1');
      legendEl?.classList.add('hidden');
    } else {
      skeletonEl?.classList.add('hidden');
      if (moduleState.data?.days?.length) {
        containerEl?.classList.remove('hidden');
        legendEl?.classList.remove('hidden');
      } else {
        containerEl?.classList.add('hidden');
        legendEl?.classList.add('hidden');
      }
      btnPrevMonth?.removeAttribute('data-loading');
      btnNextMonth?.removeAttribute('data-loading');
    }
  }

  function getBadge(dayNumber, dayInfo) {
    const meta = moduleState.data?.meta || {};
    let category = getDayCategory(dayNumber, meta);
    if (!category && dayInfo?.phase === 'unknown') {
      category = 'neutral';
    }
    return category ? badgeMap[category] : null;
  }

  function buildCard(day, idx) {
    const dayNumber = Number(day.date.slice(-2));
    const badge = getBadge(dayNumber, day);
    const tags = [];
    if (badge) tags.push(`<span class="badge ${badge.className}">${badge.label}</span>`);
    if (day.date === state.today) tags.push('<span class="badge badge-good">Сегодня</span>');
    const notes = day.notes || moduleState.data?.meta?.notes || '';
    const guides = collectDayGuides(dayNumber, moduleState.data?.guides || {});
    const guidesMarkup = [];
    if (guides.plantingItems.length) {
      guidesMarkup.push(`Посевы: ${guides.plantingItems.join(', ')}`);
    }
    if (guides.works.length) {
      guidesMarkup.push(`Работы: ${guides.works.join(', ')}`);
    }
    const helperMarkup = guidesMarkup.length
      ? `<div class="sheet-helper">${guidesMarkup.map((line) => `<span class="text-wrap">${line}</span>`).join('<br />')}</div>`
      : '';
    const infoParts = [
      day.moon_day ? `Лунный день ${day.moon_day}` : 'Лунный день —',
      `Фаза: ${formatPhase(day.phase)}`,
      day.zodiac ? `Знак: ${day.zodiac}` : '',
    ].filter(Boolean);
    const infoMarkup = `<div class="sheet-info">${infoParts.map((part) => `<span class="text-wrap">${part}</span>`).join('<br />')}</div>`;
    const noteMarkup = notes ? `<p class="text-sm text-wrap text-muted">${notes}</p>` : '';

    return `
      <div class="calendar-sheet">
        <span class="paper-texture" aria-hidden="true"></span>
        <div class="sheet-head">
          <div class="sheet-head-group">
            <div class="sheet-daynum">${dayNumber}</div>
            <div class="sheet-weekday">${formatWeekday(day.date)}</div>
          </div>
          ${tags.length ? `<div class="sheet-badges">${tags.join('')}</div>` : ''}
        </div>
        <div class="sheet-body">
          ${infoMarkup}
          ${helperMarkup}
          ${noteMarkup}
        </div>
        <div class="sheet-foot">
          <button type="button" class="btn-ghost" data-open-day="${idx}">Подробнее</button>
          <button type="button" class="btn-ghost" data-voice-day="${idx}" aria-label="Озвучить день">🔊</button>
        </div>
      </div>
    `;
  }

  function buildStack() {
    if (!stackEl) return;
    stackEl.innerHTML = '';
    if (!moduleState.data?.days?.length) {
      containerEl?.classList.add('hidden');
      legendEl?.classList.add('hidden');
      return;
    }

    const fragment = document.createDocumentFragment();
    moduleState.data.days.forEach((day, idx) => {
      const page = document.createElement('article');
      page.className = 'page';
      page.dataset.index = String(idx);
      page.innerHTML = buildCard(day, idx);
      fragment.appendChild(page);
    });
    stackEl.appendChild(fragment);
    updateStack(true);
  }

  function updateStack(silent = false) {
    if (!stackEl || !moduleState.data?.days?.length) return;
    const cards = stackEl.querySelectorAll('.page');
    cards.forEach((card) => {
      const cardIndex = Number(card.dataset.index);
      const offset = cardIndex - moduleState.index;
      card.style.setProperty('--offset', offset);
      card.classList.toggle('is-active', offset === 0);
      card.classList.toggle('is-past', offset < 0);
    });
    const currentDay = moduleState.data.days[moduleState.index];
    if (currentDay && dayLabelEl) {
      dayLabelEl.textContent = fmtDayLabel(currentDay.date);
    }
    if (btnPrevDay) btnPrevDay.disabled = moduleState.index <= 0;
    if (btnNextDay) btnNextDay.disabled = moduleState.index >= moduleState.data.days.length - 1;
    if (!silent) {
      tg?.HapticFeedback?.selectionChanged?.();
    }
  }

  function selectIndex(idx, silent = false) {
    if (!moduleState.data?.days?.length) return;
    const clamped = Math.max(0, Math.min(idx, moduleState.data.days.length - 1));
    moduleState.index = clamped;
    updateStack(silent);
  }

  function speakDay(idx) {
    const day = moduleState.data?.days?.[idx];
    if (!day) return;
    const dayNumber = Number(day.date.slice(-2));
    const badge = getBadge(dayNumber, day);
    const voiceParts = [
      fmtDayLabel(day.date),
      day.moon_day ? `Лунный день ${day.moon_day}` : 'Лунный день не указан',
      phaseSpeech(day.phase),
    ];
    if (day.zodiac) voiceParts.push(`Знак ${day.zodiac}`);
    if (badge) voiceParts.push(badge.label);
    const guides = collectDayGuides(dayNumber, moduleState.data?.guides || {});
    if (guides.plantingItems.length) voiceParts.push(`Посевы: ${guides.plantingItems.join(', ')}`);
    if (guides.works.length) voiceParts.push(`Работы: ${guides.works.join(', ')}`);
    if (day.notes) voiceParts.push(day.notes);
    speak(voiceParts.join('. '));
  }

  function handleCardClick(event) {
    const voiceBtn = event.target.closest('[data-voice-day]');
    if (voiceBtn) {
      const idx = Number(voiceBtn.getAttribute('data-voice-day'));
      if (Number.isFinite(idx)) speakDay(idx);
      return;
    }
    const openBtn = event.target.closest('[data-open-day]');
    if (openBtn) {
      const idx = Number(openBtn.getAttribute('data-open-day'));
      if (Number.isFinite(idx) && moduleState.data?.days?.[idx]) {
        selectIndex(idx, true);
        const dayNum = Number(moduleState.data.days[idx].date.slice(-2));
        openDaySheet(dayNum, moduleState.data);
      }
    }
  }

  async function loadMonth(iso) {
    moduleState.loadingToken += 1;
    const token = moduleState.loadingToken;
    setLoading(true);
    if (titleEl) titleEl.textContent = fmtMonthTitle(iso);
    const payload = await fetchMonthPayload(iso);
    if (token !== moduleState.loadingToken) return payload;
    if (!payload) {
      setLoading(false);
      Toast.show('Нет данных календаря', true);
      return null;
    }
    moduleState.month = iso;
    moduleState.data = payload;
    state.currentMonth = iso;
    state.calendarData = payload;
    buildStack();
    const todayIso = state.today.slice(0, 7);
    const gotoIdx = todayIso === iso ? Math.max(0, Math.min(payload.days.length - 1, Number(state.today.slice(-2)) - 1)) : 0;
    selectIndex(gotoIdx, true);
    const elapsed = Date.now() - moduleState.loadingStartedAt;
    if (elapsed < 220) {
      await new Promise((resolve) => setTimeout(resolve, 220 - elapsed));
    }
    setLoading(false);
    warmCache(prevMonth(iso));
    warmCache(nextMonth(iso));
    renderPlantingList(payload.guides?.planting || null, iso);
    return payload;
  }

  function handlePrevMonth() {
    const target = prevMonth(moduleState.month);
    if (!target.startsWith('2025')) {
      Toast.show('Доступен только 2025 год', true);
      return;
    }
    loadMonth(target);
  }

  function handleNextMonth() {
    const target = nextMonth(moduleState.month);
    if (!target.startsWith('2025')) {
      Toast.show('Доступен только 2025 год', true);
      return;
    }
    loadMonth(target);
  }

  function handleToday() {
    const iso = state.today.slice(0, 7);
    if (!iso.startsWith('2025')) {
      Toast.show('Доступен только 2025 год', true);
      return;
    }
    const targetIdx = Math.max(0, Number(state.today.slice(-2)) - 1);
    if (moduleState.month !== iso) {
      loadMonth(iso)?.then(() => {
        selectIndex(targetIdx);
      });
    } else {
      selectIndex(targetIdx);
    }
  }

  function handlePrevDay() {
    if (moduleState.index <= 0) return;
    selectIndex(moduleState.index - 1);
  }

  function handleNextDay() {
    if (!moduleState.data?.days?.length) return;
    if (moduleState.index >= moduleState.data.days.length - 1) return;
    selectIndex(moduleState.index + 1);
  }

  async function init() {
    if (!stackEl || !titleEl) return;
    stackEl.addEventListener('click', handleCardClick);
    btnPrevMonth?.addEventListener('click', handlePrevMonth);
    btnNextMonth?.addEventListener('click', handleNextMonth);
    btnToday?.addEventListener('click', handleToday);
    btnPrevDay?.addEventListener('click', handlePrevDay);
    btnNextDay?.addEventListener('click', handleNextDay);

    const todayIso = state.today.slice(0, 7);
    const initial = todayIso.startsWith('2025') ? todayIso : state.currentMonth;
    await loadMonth(initial);
  }

  return {
    init,
    loadMonth,
    selectIndex,
    get month() {
      return moduleState.month;
    },
    get data() {
      return moduleState.data;
    },
  };
})();

function openDaySheet(day, data) {
  const sheet = $('#day-sheet');
  const overlay = $('#sheet-overlay');
  if (!sheet || !overlay || !data) return;

  const month = data.month || '2025-12';
  const dayInfo = data.days?.find((item) => Number(item.date.slice(-2)) === day) || null;
  const dateObj = new Date(`${month}-${String(day).padStart(2, '0')}`);
  const title = Number.isNaN(dateObj.getTime())
    ? `${day} декабря`
    : dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  $('#day-sheet-title').textContent = title;

  const details = [];
  if (dayInfo?.moon_day) details.push(`Лунный день ${dayInfo.moon_day}`);
  if (dayInfo?.phase) details.push(`Фаза: ${formatPhase(dayInfo.phase)}`);
  if (dayInfo?.zodiac) details.push(`Знак: ${dayInfo.zodiac}`);
  $('#day-sheet-sub').textContent = details.join(' • ') || 'Нет данных о лунном дне';

  const body = $('#day-sheet-body');
  if (!body) return;
  body.innerHTML = '';

  let category = getDayCategory(day, data.meta || {});
  if (!category && dayInfo?.phase === 'unknown') {
    category = 'neutral';
  }
  const badgeMap = {
    best: 'badge-best',
    good: 'badge-good',
    neutral: 'badge-neutral',
    bad: 'badge-bad',
  };
  const labelMap = {
    best: 'Самые благоприятные',
    good: 'Благоприятные',
    neutral: 'Нейтральные',
    bad: 'Самые неблагоприятные',
  };
  if (category) {
    const status = document.createElement('div');
    status.className = 'badge-wrap';
    status.innerHTML = `<span class="badge ${badgeMap[category]}">${labelMap[category]}</span>`;
    body.appendChild(status);
  }

  if (dayInfo?.notes) {
    const note = document.createElement('div');
    note.className = 'note-box text-sm text-wrap';
    note.textContent = dayInfo.notes;
    body.appendChild(note);
  }

  const { plantingItems, works } = collectDayGuides(day, data.guides || {});

  if (plantingItems.length) {
    const plantingBlock = document.createElement('div');
    plantingBlock.innerHTML = `
      <h4 class="text-lg text-strong">Посевы</h4>
      <ul class="list">${plantingItems.map((item) => `<li class="text-wrap">${item}</li>`).join('')}</ul>
    `;
    body.appendChild(plantingBlock);
  }

  if (works.length) {
    const worksBlock = document.createElement('div');
    worksBlock.innerHTML = `
      <h4 class="text-lg text-strong">Работы</h4>
      <ul class="list">${works.map((item) => `<li class="text-wrap">${item}</li>`).join('')}</ul>
    `;
    body.appendChild(worksBlock);
  }

  if (!plantingItems.length && !works.length && !dayInfo?.notes) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-muted';
    empty.textContent = 'Нет специальных рекомендаций на этот день.';
    body.appendChild(empty);
  }

  sheet.dataset.day = String(day);
  sheet.dataset.month = month;
  sheet.classList.remove('hidden');
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('active');
  });
  tg?.HapticFeedback?.impactOccurred?.('light');
}

function closeDaySheet() {
  const sheet = $('#day-sheet');
  const overlay = $('#sheet-overlay');
  if (!sheet || !overlay) return;
  sheet.classList.remove('active');
  overlay.classList.remove('visible');
  setTimeout(() => {
    sheet.classList.add('hidden');
    overlay.classList.add('hidden');
  }, 250);
}

function renderPlantingList(planting, monthIso = state.currentMonth) {
  const list = $('#planting-list');
  const skeleton = $('#planting-skeleton');
  if (!list) return;

  const monthDate = monthIso ? new Date(`${monthIso}-01T00:00:00`) : null;
  const monthLabelRaw = monthDate && !Number.isNaN(monthDate.getTime())
    ? monthDate.toLocaleDateString('ru-RU', { month: 'long' })
    : 'месяц';
  const plantingTitle = $('#planting-title');
  if (plantingTitle) {
    const displayLabel = monthLabelRaw === 'месяц' ? 'месяца' : monthLabelRaw;
    plantingTitle.textContent = `Посевы ${displayLabel}`;
  }

  const items = [
    ...((planting?.vegetables || []).map((item) => ({ ...item, category: 'Овощи' }))),
    ...((planting?.flowers || []).map((item) => ({ ...item, category: 'Цветы' }))),
  ];

  if (!items.length) {
    skeleton?.classList.add('hidden');
    list.classList.remove('hidden');
    const emptyLabel = monthLabelRaw === 'месяц' ? 'этот месяц' : monthLabelRaw;
    list.innerHTML = `<p class="text-sm text-muted">Нет данных о посевах на ${emptyLabel}.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'planting-item';
    const datesLabel = (item.dates || []).map((date) => String(date)).join(', ');
    button.setAttribute('data-planting', item.name);
    button.setAttribute('data-dates', datesLabel);
    button.innerHTML = `
      <span class="planting-item__category">${item.category}</span>
      <span class="planting-item__title text-wrap">${item.name}</span>
      <div class="planting-item__dates">
        ${(item.dates || []).map((date) => `<span class="badge badge-good">${String(date).padStart(2, '0')}</span>`).join('')}
      </div>
    `;
    fragment.appendChild(button);
  });

  list.innerHTML = '';
  list.appendChild(fragment);
  skeleton?.classList.add('hidden');
  list.classList.remove('hidden');
}


function setActiveTab(tab) {
  if (state.activeTab === tab) return;
  state.activeTab = tab;
  $$('[data-tab]').forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
  $$('[data-screen]').forEach((screen) => {
    screen.classList.toggle('hidden', screen.dataset.screen !== tab);
  });
  const fab = $('#fab-voice');
  fab?.classList.toggle('hidden', tab !== 'home');
  $('#page')?.focus();
  if (tab !== 'home') {
    window.speechSynthesis?.cancel?.();
  }
}

function openModal({ title, steps }) {
  const modal = $('#modal');
  if (!modal) return;
  $('#modal-title').textContent = title;
  const body = $('#modal-body');
  body.innerHTML = `<ul class="list">${(steps || []).map((step) => `<li class="text-wrap">${step}</li>`).join('')}</ul>`;
  modal.classList.remove('hidden');
  $('.modal__close')?.focus();
}

function closeModal() {
  $('#modal')?.classList.add('hidden');
}

async function markDone() {
  try {
    const payload = {
      date: state.today,
      actions: ['garden', 'important'],
    };
    const res = await fetch(`${API_BASE}/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Request failed');
    Toast.show('Отмечено! Отличная работа');
    tg?.HapticFeedback?.impactOccurred('light');
  } catch (err) {
    console.warn('Mark done offline?', err);
    Toast.show('Отмечено. Сохраним при подключении', true);
  }
}

function bindProfile() {
  const region = $('#region');
  const climate = $('#climate');
  const bigText = $('#pref-big-text');
  const highContrast = $('#pref-high-contrast');
  const night = $('#pref-night');
  const cultures = $$('input[name="cultures"]');

  if (region) region.value = state.region;
  if (climate) climate.value = state.climate;
  if (bigText) bigText.checked = localStorage.getItem('bigText') === '1';
  if (highContrast) highContrast.checked = localStorage.getItem('hiContrast') === '1';
  if (night) night.checked = localStorage.getItem('night') === '1';
  cultures.forEach((checkbox) => {
    checkbox.checked = state.cultures.includes(checkbox.value);
  });

  region?.addEventListener('change', (e) => {
    state.region = e.target.value;
    localStorage.setItem('region', state.region);
  });
  climate?.addEventListener('change', (e) => {
    state.climate = e.target.value;
    localStorage.setItem('climate', state.climate);
  });
  bigText?.addEventListener('change', (e) => {
    localStorage.setItem('bigText', e.target.checked ? '1' : '0');
    applyPrefs();
  });
  highContrast?.addEventListener('change', (e) => {
    localStorage.setItem('hiContrast', e.target.checked ? '1' : '0');
    applyPrefs();
  });
  night?.addEventListener('change', (e) => {
    localStorage.setItem('night', e.target.checked ? '1' : '0');
    applyPrefs();
  });
  cultures.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const selected = cultures.filter((box) => box.checked).map((box) => box.value);
      state.cultures = selected;
      localStorage.setItem('cultures', JSON.stringify(selected));
    });
  });
}

async function loadData() {
  $('#card-lunar-content')?.classList.add('hidden');
  $('#card-garden-content')?.classList.add('hidden');
  $('#card-important-content')?.classList.add('hidden');

  const demoRequested = state.demo;

  try {
    const home = demoRequested ? await getHomeFromLocal(state.today) : await getHomeFromApi(state.today, state.region);
    state.home = home;
  } catch (err) {
    console.warn('Falling back to demo home data', err);
    state.demo = true;
    state.home = await getHomeFromLocal(state.today);
    Toast.show('Демо-режим: локальные данные', true);
  }

  const monthKey = state.today.slice(0, 7).replace('-', '_');
  const [garden, important, lunar] = await Promise.all([
    safeJsonFetch('/data/garden_tips.json', []),
    safeJsonFetch('/data/important.json', []),
    safeJsonFetch(`/data/lunar_${monthKey}.json`, { days: [] }),
  ]);
  state.garden = garden;
  state.important = important;
  state.lunarMonth = lunar;

  renderHome();
  renderGarden();
  renderImportant();

  if (state.demo && !demoRequested) {
    Toast.show('Демо-режим: локальные данные', true);
  }
}

function handleGlobalClicks(event) {
  const sayButton = event.target.closest('[data-say]');
  if (sayButton) {
    event.preventDefault();
    speakElement(sayButton.getAttribute('data-say'));
    return;
  }

  const tabButton = event.target.closest('[data-tab]');
  if (tabButton) {
    event.preventDefault();
    setActiveTab(tabButton.dataset.tab);
    return;
  }

  const closeTarget = event.target.closest('[data-close="modal"]');
  if (closeTarget) {
    event.preventDefault();
    closeModal();
    return;
  }

  const closeSheetBtn = event.target.closest('[data-close-sheet]');
  if (closeSheetBtn) {
    event.preventDefault();
    closeDaySheet();
    return;
  }

  const doneButton = event.target.closest('[data-action="done"]');
  if (doneButton) {
    event.preventDefault();
    markDone();
    return;
  }

  const plantingItem = event.target.closest('[data-planting]');
  if (plantingItem) {
    event.preventDefault();
    const dates = plantingItem.getAttribute('data-dates');
    if (dates) {
      Toast.show(`Лучшие даты: ${dates}`, true);
      tg?.HapticFeedback?.impactOccurred?.('light');
    }
    return;
  }

  const openGarden = event.target.closest('[data-open-garden]');
  if (openGarden) {
    event.preventDefault();
    const culture = openGarden.getAttribute('data-open-garden');
    const tip = state.garden.find((item) => item.culture === culture) || state.home?.garden;
    if (tip) {
      openModal({ title: tip.title, steps: tip.steps });
      if (Array.isArray(tip.steps) && tip.steps.length) {
        speak(tip.steps.join('. '));
      }
    }
  }
}

function handleGardenCardClick(event) {
  const card = event.target.closest('.garden-card');
  if (!card) return;
  const culture = card.getAttribute('data-culture');
  const tip = state.garden.find((item) => item.culture === culture);
  if (!tip) return;
  openModal({ title: tip.title, steps: tip.steps });
}

function init() {
  tg?.expand();
  tg?.MainButton?.hide();
  applyPrefs();
  state.demo = isDemoMode();
  bindProfile();

  document.addEventListener('click', handleGlobalClicks);
  $('#garden-list')?.addEventListener('click', handleGardenCardClick);
  $('#fab-voice')?.addEventListener('click', speakHome);
  $('#btn-check-voice')?.addEventListener('click', () => speak('Проверка озвучки. Всё работает.'));
  $('#btn-demo')?.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('demo', '1');
    location.href = url.toString();
  });

  if (state.demo) {
    Toast.show('Демо-режим: локальные данные', true);
  }

  FlipCalendar.init();
  loadData();
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
    closeDaySheet();
  }
});

init();
