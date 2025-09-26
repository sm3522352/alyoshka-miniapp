const fs = require('fs');
const path = require('path');

const YEAR = 2025;
const dataDir = path.join(__dirname, '..', 'data');

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createLunarPlaceholder(isoMonth) {
  const [yearStr, monthStr] = isoMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, index) => {
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

function createGuidesPlaceholder(isoMonth) {
  return {
    month: isoMonth,
    planting: { vegetables: [], flowers: [] },
    works: [],
    unfavorable: [],
  };
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function main() {
  ensureDir(dataDir);
  for (let month = 1; month <= 11; month += 1) {
    const monthStr = String(month).padStart(2, '0');
    const isoMonth = `${YEAR}-${monthStr}`;
    if (month === 12) continue;

    const lunarFile = path.join(dataDir, `lunar_${YEAR}_${monthStr}.json`);
    const guidesFile = path.join(dataDir, `guides_${YEAR}_${monthStr}.json`);

    const lunarPlaceholder = createLunarPlaceholder(isoMonth);
    const guidesPlaceholder = createGuidesPlaceholder(isoMonth);

    writeJson(lunarFile, lunarPlaceholder);
    writeJson(guidesFile, guidesPlaceholder);

    console.log(`Generated placeholders for ${isoMonth}`);
  }
}

if (require.main === module) {
  main();
}
