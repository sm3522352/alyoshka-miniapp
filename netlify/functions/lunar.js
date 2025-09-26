const fs = require('fs');
const path = require('path');
exports.handler = async (event) => {
  const params = new URLSearchParams(event.rawQuery || '');
  const month = params.get('month') || new Date().toISOString().slice(0,7);
  const file = path.join(__dirname, '..', '..', 'data', `lunar_${month.replace('-','_')}.json`);
  if(!fs.existsSync(file)) return { statusCode: 404, body: JSON.stringify({ error: 'Нет данных за месяц' }) };
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(json) };
};
