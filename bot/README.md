# Бот «Алёшка» (опционально)

Минимальный бот на Telegraf. Делает кнопку для открытия Mini App.

## Запуск
```
cd bot
npm i
TELEGRAM_TOKEN=xxxx WEBAPP_URL=https://<your-site>.netlify.app node index.js
```
(или используйте `.env`)

## Вебхук/long polling
- Для MVP можно использовать long polling (как в примере).
- Для прод — настройте вебхук через `bot.telegram.setWebhook()` на ваш сервер.