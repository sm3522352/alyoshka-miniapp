const tg = window.Telegram?.WebApp;
const API_BASE = '/api';

function $(sel){ return document.querySelector(sel); }

async function fetchHome(){
  try{
    const today = new Date().toISOString().slice(0,10);
    const region = 'RU-MOW';
    const res = await fetch(`${API_BASE}/home?date=${today}&region=${region}`);
    const data = await res.json();
    renderHome(data);
  }catch(e){
    $('#lunar-content').textContent = 'Не удалось загрузить данные.';
    $('#garden-content').textContent = '';
    $('#important-content').textContent = '';
    console.error(e);
  }
}
function renderHome({ lunar, garden, important }){
  $('#lunar-content').innerHTML = `
    <div>День: <b>${lunar.moon_day}</b>, фаза: <b>${lunar.phase}</b></div>
    <div>Хорошо: ${lunar.is_good_for?.join(', ') || '—'}</div>
    <div>Не рекомендуется: ${lunar.is_bad_for?.join(', ') || '—'}</div>
    <div class="text-sm text-slate-600">${lunar.notes || ''}</div>
  `;
  $('#garden-content').innerHTML = `
    <div><b>${garden.title}</b></div>
    <ul class="list-disc pl-6">
      ${garden.steps.map(s => `<li>${s}</li>`).join('')}
    </ul>
  `;
  $('#important-content').innerHTML = `
    <div><b>${important.title}</b></div>
    <div>${important.summary}</div>
    ${important.cta ? renderCTA(important.cta) : ''}
  `;
}
function renderCTA(cta){
  if(cta.type === 'call'){
    return `<a class="text-emerald-700 underline" href="tel:${cta.value}">Позвонить: ${cta.value}</a>`;
  }
  if(cta.type === 'link'){
    return `<a class="text-emerald-700 underline" href="${cta.value}" target="_blank" rel="noopener">Открыть ссылку</a>`;
  }
  return '';
}

function speak(selector){
  const el = document.querySelector(selector);
  if(!el) return;
  const text = el.innerText;
  if('speechSynthesis' in window){
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    window.speechSynthesis.speak(u);
  } else {
    alert('Озвучка недоступна в этом браузере.');
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
    alert('Озвучка недоступна.');
  }
}

async function markDone(){
  const today = new Date().toISOString().slice(0,10);
  await fetch(`${API_BASE}/journal`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ date: today, actions: ['garden','read_important'] })
  });
  tg?.HapticFeedback?.impactOccurred('light');
  alert('Отмечено на сегодня. Молодец!');
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-say]');
  if(btn){
    const sel = btn.getAttribute('data-say');
    speak(sel);
  }
});
$('#btn-voice-all').addEventListener('click', speakAll);
$('#btn-done').addEventListener('click', markDone);

fetchHome();
tg?.expand(); tg?.MainButton?.hide();
