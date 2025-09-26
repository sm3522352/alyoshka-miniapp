# Алёшка — Telegram Mini App (Starter)

Мини-приложение для бабушек: лунный календарь, советы по огороду, блок «Важно».

## Стек
- Telegram WebApp (HTML + Tailwind CDN + Telegram WebApp SDK)
- API: Netlify Functions (`/api/*`)
- Данные: JSON в `data/`
- Бот: Telegraf (опционально)
- Devcontainer + CI

## Быстрый старт
```bash
npm run dev         # UI + API (netlify dev)
# в другом терминале:
npm run bot         # запуск бота (нужны TELEGRAM_TOKEN и WEBAPP_URL)
```

## Переменные окружения

* `TELEGRAM_TOKEN` — токен бота
* `WEBAPP_URL` — URL Mini App (локальный netlify dev или Netlify сайт)
* (позже) `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Деплой

Подключите репозиторий к Netlify (New site from Git). Сборка не требуется, `netlify.toml` уже настроен.

## Безопасность

Информация справочная, не мед. рекомендации. В разделе «Важно» используйте только проверенные номера/ссылки.

