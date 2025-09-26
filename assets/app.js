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
  activeTab: 'home',
  today: new Date().toISOString().slice(0, 10),
  region: localStorage.getItem('region') || 'RU-MOW',
  climate: localStorage.getItem('climate') || 'temperate',
  cultures: JSON.parse(localStorage.getItem('cultures') || '[]'),
  home: null,
  garden: [],
  important: [],
  lunarMonth: null,
  demo: false,
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

function renderGarden() {
  const list = $('#garden-list');
  if (!list) return;
  if (!state.garden.length) {
    list.innerHTML = '<p class="text-center text-slate-500">Нет советов для отображения.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.garden.forEach((tip) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'card text-left transition-all garden-card';
    item.setAttribute('data-culture', tip.culture || 'сад');
    const diff = tip.difficulty || 'easy';
    const diffLabel = diff === 'hard' ? 'Опыт' : diff === 'medium' ? 'Вдумчиво' : 'Легко';
    const diffClass = diff === 'hard' ? 'badge badge--bad' : diff === 'medium' ? 'badge badge--info' : 'badge badge--good';

    item.innerHTML = `
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
          <div class="icon-chip">
            <img src="/assets/icons/plant.svg" alt="${tip.culture || 'Культура'}" class="w-6 h-6" />
          </div>
          <div>
            <p class="font-semibold text-lg">${tip.title}</p>
            <p class="text-sm text-slate-500">${tip.culture || 'сад'}</p>
          </div>
        </div>
        <span class="${diffClass}">${diffLabel}</span>
      </div>
      <p class="text-sm text-slate-600">${(tip.steps || []).slice(0, 2).join('. ')}</p>
    `;
    fragment.appendChild(item);
  });
  list.innerHTML = '';
  list.appendChild(fragment);
}

function renderImportant() {
  const list = $('#important-list');
  if (!list) return;
  if (!state.important.length) {
    list.innerHTML = '<p class="text-center text-slate-500">Пока нет важных дел.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.important.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'card space-y-3';
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="icon-chip">
          <img src="/assets/icons/important.svg" alt="${item.topic || 'важно'}" class="w-6 h-6" />
        </div>
        <div>
          <p class="font-semibold text-lg">${item.title}</p>
          <p class="text-sm text-slate-500">${item.topic || 'важно'}</p>
        </div>
      </div>
      <p>${item.summary || ''}</p>
      ${renderCTA(item.cta || (index % 3 === 0 ? { type: 'done' } : null))}
    `;
    fragment.appendChild(card);
  });
  list.innerHTML = '';
  list.appendChild(fragment);
}

function renderCalendar() {
  const grid = $('#calendar-grid');
  const skeleton = $('#calendar-skeleton');
  if (!grid) return;
  const lunar = state.lunarMonth?.days || [];

  if (!lunar.length) {
    skeleton?.classList.add('hidden');
    grid.classList.remove('hidden');
    grid.innerHTML = '<p class="col-span-7 text-center text-slate-500">Нет данных календаря.</p>';
    return;
  }

  const firstDate = new Date(state.today);
  const year = firstDate.getFullYear();
  const month = firstDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first

  const map = new Map(lunar.map((day) => [day.date, day]));

  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const fragment = document.createDocumentFragment();

  weekdays.forEach((w) => {
    const cell = document.createElement('div');
    cell.className = 'text-center font-semibold text-slate-500';
    cell.textContent = w;
    fragment.appendChild(cell);
  });

  for (let i = 0; i < startDay; i += 1) {
    const empty = document.createElement('div');
    empty.className = 'calendar__day opacity-0 pointer-events-none';
    fragment.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const lunarDay = map.get(dateStr);
    const cell = document.createElement('div');
    const good = lunarDay?.is_good_for?.length;
    const bad = lunarDay?.is_bad_for?.length;
    const classes = ['calendar__day'];
    if (good && !bad) classes.push('calendar__day--good');
    if (bad && !good) classes.push('calendar__day--bad');
    cell.className = classes.join(' ');
    cell.innerHTML = `
      <div class="text-lg font-semibold">${day}</div>
      <div class="text-sm text-slate-500">${lunarDay ? `Луна: ${lunarDay.moon_day}` : '—'}</div>
      ${good ? `<span class="badge badge--good">Можно: ${(lunarDay.is_good_for || []).slice(0, 2).join(', ')}</span>` : ''}
      ${bad ? `<span class="badge badge--bad">Не стоит: ${(lunarDay.is_bad_for || []).slice(0, 2).join(', ')}</span>` : ''}
    `;
    fragment.appendChild(cell);
  }

  grid.innerHTML = '';
  grid.appendChild(fragment);
  skeleton?.classList.add('hidden');
  grid.classList.remove('hidden');
}

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

  renderHome();
  renderGarden();
  renderImportant();
  renderCalendar();

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

  const doneButton = event.target.closest('[data-action="done"]');
  if (doneButton) {
    event.preventDefault();
    markDone();
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
    Toast.show('Демо-режим: локальные данные', 'info');
  }

  loadData();
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
  }
});

init();
