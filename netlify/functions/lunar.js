const fs = require('fs');
const path = require('path');
exports.handler = async (event) => {
  const params = new URLSearchParams(event.rawQuery || '');
  const month = (params.get('month') || new Date().toISOString().slice(0,7)).replace('-','_');

  const lunarFile = path.join(__dirname, '..', '..', 'data', `lunar_${month}.json`);
  if(!fs.existsSync(lunarFile)){
    return { statusCode: 404, body: JSON.stringify({ error: 'Нет данных за месяц' }) };
  }
  const lunar = JSON.parse(fs.readFileSync(lunarFile, 'utf-8'));

  const guidesFile = path.join(__dirname, '..', '..', 'data', `guides_${month}.json`);
  let guides = null;
  if(fs.existsSync(guidesFile)){
    guides = JSON.parse(fs.readFileSync(guidesFile, 'utf-8'));
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ ...lunar, guides })
  };
};
