const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  const params = new URLSearchParams(event.rawQuery || '');
  const date = params.get('date') || new Date().toISOString().slice(0,10);
  const month = date.slice(0,7);

  // lunar
  const lunarPath = path.join(__dirname, '..', '..', 'data', `lunar_${month.replace('-','_')}.json`);
  let lunarDay = { moon_day: 8, phase: 'waxing', is_good_for: [], is_bad_for: [], notes: 'Нет данных.' };
  if(fs.existsSync(lunarPath)){
    const lunar = JSON.parse(fs.readFileSync(lunarPath, 'utf-8'));
    const found = lunar.days.find(d => d.date === date);
    if(found) lunarDay = found;
  }

  // garden (простая ротация по дате)
  const tips = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'garden_tips.json'), 'utf-8'));
  const tip = tips[(new Date(date).getDate()) % tips.length];

  // important (берём первую карточку на сегодня по циклу)
  const important = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'important.json'), 'utf-8'));
  const imp = important[(new Date(date).getDate()) % important.length];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ lunar: lunarDay, garden: tip, important: imp })
  };
};