const fs = require('fs');
const path = require('path');

const WHITELIST = [
  '7dach.ru',
  'ogorod.ru',
  'botanichka.ru',
  'fermer.ru',
  'greeninfo.ru',
];

const DEMO_FILE = path.join(__dirname, '..', '..', 'data', 'feed_demo.json');

function loadDemoFeed() {
  if (!fs.existsSync(DEMO_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DEMO_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.filter((item) => WHITELIST.some((host) => item.source?.includes(host)));
  } catch (err) {
    console.error('Failed to parse demo feed', err);
    return [];
  }
}

exports.handler = async () => {
  const articles = loadDemoFeed().map((article) => ({
    ...article,
    summary: article.summary?.trim?.() || '',
    cta: article.cta?.trim?.() || '',
  }));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
    body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      articles,
    }),
  };
};