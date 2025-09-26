const fs = require('fs');
const path = require('path');
exports.handler = async (event) => {
  const params = new URLSearchParams(event.rawQuery || '');
  const culture = params.get('culture') || '';
  const tips = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'garden_tips.json'), 'utf-8'));
  const filtered = culture ? tips.filter(t => t.culture === culture) : tips;
  return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(filtered) };
};
