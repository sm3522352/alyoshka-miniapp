const tg = window.Telegram?.WebApp;
const API_BASE = '/api';

const $ = (sel) => document.querySelector(sel);
const show = (sel) => $(sel)?.classList.remove('hidden');
const hide = (sel) => $(sel)?.classList.add('hidden');

const Toast = {
  el: $('#toast'),
  show(msg, ok=true){
    this.el.textContent = msg;
    this.el.style.background = ok ? '#10b981' : '#ef4444';
    this.el.classList.remove('hidden');
    clearTimeout(this._t);
    this._t = setTimeout(()=> this.el.classList.add('hidden'), 2200);
  }
};

function speak(selector){
  const el = document.querySelector(selector);
  if(!el) return;
  const text = el.innerText || el.textContent || '';
  if('speechSynthesis' in window){
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    window.speechSynthesis.speak(u);
  } else {
    Toast.show('Озвучка недоступна в этом браузере', false);
  }
}

function speakAll(){
  const text = [
    'Лунный календарь.',
    $('#lunar-content').innerText,
    'Совет по огороду.',
    $('#garden-content').innerText,
    'Важно сегодня.',
    $('#important-content').innerText,
  ].join('\n');
  if('speechSynthesis' in window){
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    window.speechSynthesis.speak(u);
  } else {
    Toast.show('Озвучка недоступна', false);
  }
}

async function markDone(){
  try{
    const today = new Date().toISOString().slice(0,10);
    const res = await fetch(`${API_BASE}/journal`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ date: today, actions: ['garden','read_important'] })
    });
    if(!res.ok) throw new Error('journal failed');
    tg?.HapticFeedback?.impactOccurred('light');
    Toast.show('Отлично! Отмечено на сегодня');
  }catch(e){
    console.error(e);
    Toast.show('Не удалось отметить. Попробуйте позже', false);
  }
}

/* ---------- DEMO DATA FALLBACK ---------- */
async function getHomeFromApi(date, region){
  const url = `${API_BASE}/home?date=${date}&region=${region}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('API error');
  return await res.json();
}

async function getHomeFromLocal(date){
  // compose from /data
  const month = date.slice(0,7).replace('-','_');
  const [lunar, tips, imps] = await Promise.all([
    fetch(`/data/lunar_${month}.json`).then(r=>r.json()).catch(()=>null),
    fetch(`/data/garden_tips.json`).then(r=>r.json()).catch(()=>[]),
    fetch(`/data/important.json`).then(r=>r.json()).catch(()=>[])
  ]);

  // pick lunar by date or first
  let lunarDay = lunar?.days?.find(d => d.date === date) || lunar?.days?.[0] || {
    moon_day: 8, phase: 'waxing', is_good_for: [], is_bad_for: [], notes: 'Хороший день ухаживать за грядками.'
  };
  const gi = (new Date(date).getDate()) % Math.max(1, tips.length);
  const ii = (new Date(date).getDate()) % Math.max(1, imps.length);

  return {
    lunar: lunarDay,
    garden: tips[gi] || { title: 'Мульчирование', steps: ['Разложите солому тонким слоем','Поливайте реже, но обильнее'] },
    important: imps[ii] || { title: 'Осторожно: мошенники', summary: 'Никому не сообщайте коды из СМС.', cta: { type:'call', value:'900' } }
  };
}

function isDemo(){
  const sp = new URLSearchParams(location.search);
  return sp.get('demo') === '1';
}

/* ---------- RENDER ---------- */
function renderHome({ lunar, garden, important }){
  $('#lunar-content').innerHTML = `
    <div>День: <b>${lunar.moon_day}</b>, фаза: <b>${lunar.phase}</b></div>
    <div>Хорошо: ${lunar.is_good_for?.join(', ') || '—'}</div>
    <div>Не рекомендуется: ${lunar.is_bad_for?.join(', ') || '—'}</div>
    <div class="text-sm text-slate-600">${lunar.notes || ''}</div>
  `;
  hide('#lunar-skel'); show('#lunar-content');

  $('#garden-content').innerHTML = `
    <div class="font-semibold">${garden.title}</div>
    <ul class="list-disc pl-6">
      ${(garden.steps || []).map(s => `<li>${s}</li>`).join('')}
    </ul>
  `;
  hide('#garden-skel'); show('#garden-content');

  $('#important-content').innerHTML = `
    <div class="font-semibold">${important.title}</div>
    <div>${important.summary || ''}</div>
    ${important.cta ? renderCTA(important.cta) : ''}
  `;
  hide('#important-skel'); show('#important-content');
}

function renderCTA(cta){
  if(cta.type === 'call'){
    return `<a class="text-emerald-700 underline font-medium" href="tel:${cta.value}">Позвонить: ${cta.value}</a>`;
  }
  if(cta.type === 'link'){
    return `<a class="text-emerald-700 underline font-medium" href="${cta.value}" target="_blank" rel="noopener">Открыть ссылку</a>`;
  }
  return '';
}

/* ---------- INIT ---------- */
async function init(){
  tg?.expand(); tg?.MainButton?.hide();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-say]');
    if(btn){ speak(btn.getAttribute('data-say')); }
  });
  $('#btn-voice-all').addEventListener('click', speakAll);
  $('#btn-done').addEventListener('click', markDone);
  $('#btn-demo').addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('demo','1');
    location.href = url.toString();
  });

  const today = new Date().toISOString().slice(0,10);
  const region = 'RU-MOW';

  try{
    const demoMode = isDemo();
    const data = demoMode ? await getHomeFromLocal(today) : await getHomeFromApi(today, region);
    renderHome(data);
    if(demoMode){
      Toast.show('Демо-режим: локальные данные');
    }
  }catch(e){
    console.warn('API недоступно, переключаюсь на локальные данные', e);
    try{
      const data = await getHomeFromLocal(today);
      renderHome(data);
      Toast.show('Демо-режим: локальные данные');
    }catch(err){
      console.error(err);
      $('#lunar-content').textContent = 'Не удалось загрузить данные.';
      $('#garden-content').textContent = 'Нет данных.';
      $('#important-content').textContent = 'Нет данных.';
      hide('#lunar-skel'); hide('#garden-skel'); hide('#important-skel');
      show('#lunar-content'); show('#garden-content'); show('#important-content');
      Toast.show('Ошибка загрузки данных', false);
    }
  }
}
init();
