const fs = require('fs');
const path = require('path');

function daysInMonth(isoMonth) {
  const [year, month] = isoMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function placeholderLunar(isoMonth) {
  const total = daysInMonth(isoMonth);
  const days = Array.from({ length: total }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return {
      date: `${isoMonth}-${day}`,
      moon_day: null,
      phase: 'unknown',
      zodiac: null,
    };
  });

  return {
    month: isoMonth,
    meta: {
      most_favorable: [],
      favorable: [],
      neutral: [],
      most_unfavorable: [],
      notes: 'Заглушка: нет реальных лунных данных.',
    },
    days,
  };
}

function placeholderGuides(isoMonth) {
  return {
    month: isoMonth,
    planting: { vegetables: [], flowers: [] },
    works: [],
    unfavorable: [],
  };
}

exports.handler = async (event) => {
  const params = new URLSearchParams(event.rawQuery || '');
  const isoMonth = params.get('month') || new Date().toISOString().slice(0, 7);
  const fsMonth = isoMonth.replace('-', '_');

  const lunarFile = path.join(__dirname, '..', '..', 'data', `lunar_${fsMonth}.json`);
  let lunar;
  if (fs.existsSync(lunarFile)) {
    try {
      lunar = JSON.parse(fs.readFileSync(lunarFile, 'utf-8'));
    } catch (err) {
      console.warn('Ошибка чтения lunar файла', err);
      lunar = placeholderLunar(isoMonth);
    }
  } else {
    lunar = placeholderLunar(isoMonth);
  }

  const guidesFile = path.join(__dirname, '..', '..', 'data', `guides_${fsMonth}.json`);
  let guides = placeholderGuides(isoMonth);
  if (fs.existsSync(guidesFile)) {
    try {
      guides = JSON.parse(fs.readFileSync(guidesFile, 'utf-8'));
    } catch (err) {
      console.warn('Ошибка чтения guides файла', err);
    }
  }

  const calendarFile = path.join(__dirname, '..', '..', 'data', `calendar_${month}.json`);
  let calendar = null;
  if (fs.existsSync(calendarFile)) {
    calendar = JSON.parse(fs.readFileSync(calendarFile, 'utf-8'));
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },

    body: JSON.stringify({ ...lunar, guides }),

  };
};
