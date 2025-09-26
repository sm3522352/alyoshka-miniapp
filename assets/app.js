const tg = window.Telegram?.WebApp;
const API_BASE = '/api';

const $ = (selector, ctx = document) => ctx.querySelector(selector);
const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

const Toast = {
  el: $('#toast'),
  timeout: null,
  show(message, tone = 'success') {
    if (!this.el) return;
    const colors = {
      success: getComputedStyle(document.body).getPropertyValue('--ok') || '#10B981',
      error: getComputedStyle(document.body).getPropertyValue('--err') || '#DC2626',
      info: getComputedStyle(document.body).getPropertyValue('--info') || '#0284C7',
    };
    this.el.textContent = message;
    this.el.style.background = colors[tone] || colors.success;
    this.el.classList.add('toast--visible');
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.el.classList.remove('toast--visible');
    }, 2600);
  },
};

const state = {
  calendarCategory: 'phenology',
  feedArticles: [],
  feedUpdatedAt: null,
  feedFilter: 'all',
  pamphlets: [],
  clubs: [],
  clubPosts: {},
  activeClub: null
};

const speak = (text) => {
  if (!('speechSynthesis' in window)) {
    Toast.show('Озвучка недоступна', 'error');
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
    `День ${lunar?.moon_day || '—'}, фаза ${formatPhase(lunar?.phase)}.`,
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

const applyPrefs = () => {
  document.body.classList.toggle('big-text', localStorage.getItem('bigText') === '1');
  document.body.classList.toggle('high-contrast', localStorage.getItem('hiContrast') === '1');
};

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

async function loadMonth(month) {
  const url = `${API_BASE}/lunar?month=${month}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Bad response');
    return await res.json();
  } catch (err) {
    console.warn('Falling back to local month data', err);
    const monthKey = month.replace('-', '_');
    const [lunarFallback, guidesFallback] = await Promise.all([
      safeJsonFetch(`/data/lunar_${monthKey}.json`, null),
      safeJsonFetch(`/data/guides_${monthKey}.json`, null),
    ]);
    if (!lunarFallback) {
      throw err;
    }
    return { ...lunarFallback, guides: guidesFallback };
  }
}

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
  if (!phase) return '—';
  const map = {
    waxing: 'растущая',
    waning: 'убывающая',
    full: 'полнолуние',
    new: 'новолуние',
  };
  return map[phase] || phase;
}

function renderHome() {
  const containerLunar = $('#card-lunar-content');
  const containerGarden = $('#card-garden-content');
  const containerImportant = $('#card-important-content');

  if (!state.home) return;
  const { lunar, garden, important } = state.home;

  containerLunar.innerHTML = `
    <p class="font-semibold text-lg">${lunar.notes || 'Лунный день'}</p>
    <p>День <span class="font-semibold">${lunar.moon_day || '—'}</span>, фаза: <span class="font-semibold">${formatPhase(lunar.phase)}</span></p>
    <p>Хорошо: <span class="font-medium">${(lunar.is_good_for || []).join(', ') || '—'}</span></p>
    <p>Не рекомендуется: <span class="font-medium">${(lunar.is_bad_for || []).join(', ') || '—'}</span></p>
  `;

  const gardenSteps = garden?.steps || [];
  containerGarden.innerHTML = `
    <p class="font-semibold text-lg">${garden?.title || 'Совет для огорода'}</p>
    <div class="text-sm uppercase tracking-wide text-emerald-600">${garden?.culture || ''}</div>
    <ul class="list-disc pl-5 space-y-1">
      ${gardenSteps.map((step) => `<li>${step}</li>`).join('')}
    </ul>
    <button type="button" class="btn-secondary card__cta" data-open-garden="${garden?.culture || ''}">Посмотреть подробнее</button>
  `;

  const cta = renderCTA(important.cta);
  containerImportant.innerHTML = `
    <p class="font-semibold text-lg">${important.title || 'Важно'}</p>
    <p>${important.summary || ''}</p>
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

function renderCalendarGrid(data) {
  const grid = $('#calendar-grid');
  const skeleton = $('#calendar-skeleton');
  const legend = $('#calendar-legend');
  if (!grid) return;

  grid.innerHTML = '';

  if (!data?.days?.length) {
    skeleton?.classList.add('hidden');
    grid.classList.remove('hidden');
    legend?.classList.add('hidden');
    grid.innerHTML = '<p class="col-span-7 text-center text-slate-500">Нет данных за декабрь 2025.</p>';
    return;
  }

  const totalDays = 31;
  const meta = data.meta || {};
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
  const dayLookup = new Map();
  data.days.forEach((item) => {
    const dayNum = Number(item.date.slice(-2));
    dayLookup.set(dayNum, item);
  });

  const fragment = document.createDocumentFragment();

  for (let day = 1; day <= totalDays; day += 1) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-cell';
    cell.setAttribute('data-day', String(day));
    cell.dataset.label = labelMap[getDayCategory(day, meta)] || '';
    const dayInfo = dayLookup.get(day);
    const category = getDayCategory(day, meta);
    const badgeClass = category ? badgeMap[category] : '';
    const badgeLabel = category ? labelMap[category] : '';
    const moonInfo = dayInfo?.moon_day ? `Лунный день ${dayInfo.moon_day}` : 'Нет данных';
    const phaseInfo = dayInfo?.phase ? `Фаза: ${formatPhase(dayInfo.phase)}` : '';
    cell.innerHTML = `
      <div class="num">${day}</div>
      <div class="text-xs text-slate-500">${moonInfo}</div>
      ${phaseInfo ? `<div class="text-xs text-slate-400">${phaseInfo}</div>` : ''}
      ${badgeClass ? `<span class="${badgeClass}">${badgeLabel}</span>` : ''}
    `;
    fragment.appendChild(cell);
  }

  grid.dataset.month = data.month || '2025-12';
  grid.appendChild(fragment);
  skeleton?.classList.add('hidden');
  grid.classList.remove('hidden');
  legend?.classList.remove('hidden');
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

  const category = getDayCategory(day, data.meta || {});
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
    status.innerHTML = `<span class="${badgeMap[category]}">${labelMap[category]}</span>`;
    body.appendChild(status);
  }

  if (dayInfo?.notes) {
    const note = document.createElement('div');
    note.className = 'text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3';
    note.textContent = dayInfo.notes;
    body.appendChild(note);
  }

  const { plantingItems, works } = collectDayGuides(day, data.guides || {});

  if (plantingItems.length) {
    const plantingBlock = document.createElement('div');
    plantingBlock.innerHTML = `
      <h4 class="font-semibold text-lg">Посевы</h4>
      <ul class="list-disc pl-5 space-y-1">${plantingItems.map((item) => `<li>${item}</li>`).join('')}</ul>
    `;
    body.appendChild(plantingBlock);
  }

  if (works.length) {
    const worksBlock = document.createElement('div');
    worksBlock.innerHTML = `
      <h4 class="font-semibold text-lg">Работы</h4>
      <ul class="list-disc pl-5 space-y-1">${works.map((item) => `<li>${item}</li>`).join('')}</ul>
    `;
    body.appendChild(worksBlock);
  }

  if (!plantingItems.length && !works.length && !dayInfo?.notes) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-slate-500';
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

// ...existing code...

function setActiveTab(tab) {
  if (state.activeTab === tab) return;
  state.activeTab = tab;
  $$('[data-tab]').forEach((btn) => {
    btn.classList.toggle('tabbar__item--active', btn.dataset.tab === tab);
    btn.setAttribute('aria-current', btn.dataset.tab === tab ? 'page' : 'false');
  });
  $$('[data-screen]').forEach((screen) => {
    screen.classList.toggle('hidden', screen.dataset.screen !== tab);
  });
  const fab = $('#fab-voice');
  fab?.classList.toggle('hidden', tab !== 'home');
  $('#main')?.focus();
  if (tab !== 'home') {
    window.speechSynthesis?.cancel?.();
  }
}

function openModal({ title, steps }) {
  const modal = $('#modal');
  if (!modal) return;
  $('#modal-title').textContent = title;
  const body = $('#modal-body');
  body.innerHTML = `<ul class="list-disc pl-5 space-y-2">${(steps || []).map((step) => `<li>${step}</li>`).join('')}</ul>`;
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
    Toast.show('Отмечено. Сохраним при подключении', 'info');
  }
}

function bindProfile() {
  const region = $('#region');
  const climate = $('#climate');
  const bigText = $('#pref-big-text');
  const highContrast = $('#pref-high-contrast');
  const cultures = $$('input[name="cultures"]');

  if (region) region.value = state.region;
  if (climate) climate.value = state.climate;
  if (bigText) bigText.checked = localStorage.getItem('bigText') === '1';
  if (highContrast) highContrast.checked = localStorage.getItem('hiContrast') === '1';
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
    Toast.show('Демо-режим: локальные данные', 'info');
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

  try {
    state.calendarData = await loadMonth('2025-12');
  } catch (err) {
    console.warn('Не удалось загрузить календарь на декабрь 2025', err);
    state.calendarData = null;
    Toast.show('Нет данных календаря за декабрь 2025', 'info');
  }

  renderHome();
  renderGarden();
  renderImportant();
  renderCalendarGrid(state.calendarData);
  renderPlantingList(state.calendarData?.guides?.planting || null);

  if (state.demo && !demoRequested) {
    Toast.show('Демо-режим: локальные данные', 'info');
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
      Toast.show(`Лучшие даты: ${dates}`, 'info');
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

function handleCalendarGridClick(event) {
  const cell = event.target.closest('[data-day]');
  if (!cell) return;
  const day = Number(cell.getAttribute('data-day'));
  if (!Number.isFinite(day) || !state.calendarData) return;
  openDaySheet(day, state.calendarData);
}

function init() {
  tg?.expand();
  tg?.MainButton?.hide();
  applyPrefs();
  state.demo = isDemoMode();
  bindProfile();

  document.addEventListener('click', handleGlobalClicks);
  $('#garden-list')?.addEventListener('click', handleGardenCardClick);
  $('#calendar-grid')?.addEventListener('click', handleCalendarGridClick);
  $('#fab-voice')?.addEventListener('click', speakHome);
  $('#btn-check-voice')?.addEventListener('click', () => speak('Проверка озвучки. Всё работает.'));
  $('#btn-demo')?.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('demo', '1');
    location.href = url.toString();
  });

  if (state.demo) {
    Toast.show('Демо-режим: локальные данные', 'info');
  }

  loadData();
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
    closeDaySheet();
  }
});

init();
