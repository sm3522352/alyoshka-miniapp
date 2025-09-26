const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const params = new URLSearchParams(event.rawQuery || '');
  const date = params.get('date') || new Date().toISOString().slice(0,10);
  const month = date.slice(0,7);

  const safeReadJson = (filePath, fallback) => {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.warn('home fallback', err);
      return fallback;
    }
  };

  const lunarPath = path.join(__dirname, '..', '..', 'data', `lunar_${month.replace('-','_')}.json`);
  const lunar = safeReadJson(lunarPath, { days: [] });
  let lunarDay = lunar.days.find?.((d) => d.date === date) || lunar.days?.[0] || {
    moon_day: 8,
    phase: 'waxing',
    is_good_for: [],
    is_bad_for: [],
    notes: 'Нет данных о лунном дне, действуйте по самочувствию.',
  };

  const tips = safeReadJson(path.join(__dirname, '..', '..', 'data', 'garden_tips.json'), []);
  const tipIndex = tips.length ? (new Date(date).getDate()) % tips.length : 0;
  const tip = tips[tipIndex] || {
    culture: 'сад',
    title: 'Осмотр растений',
    steps: ['Проверьте листья и почву', 'Полейте при необходимости'],
    difficulty: 'easy',
  };

  const importantList = safeReadJson(path.join(__dirname, '..', '..', 'data', 'important.json'), []);
  const impIndex = importantList.length ? (new Date(date).getDate()) % importantList.length : 0;
  const imp = importantList[impIndex] || {
    topic: 'напоминание',
    title: 'Сделайте короткую зарядку',
    summary: 'Потянитесь и сделайте несколько лёгких упражнений.',
    cta: { type: 'done' },
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ lunar: lunarDay, garden: tip, important: imp })
  };
};
