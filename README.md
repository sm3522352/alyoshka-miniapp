# Алёшка — Telegram Mini App (Starter)

Простой стартовый шаблон Telegram Mini App для проекта **«Алёшка»** — помощник для бабушек: лунный календарь, советы по огороду и важные напоминания.

## Стек
- **Фронт**: статическая страница (HTML + Tailwind CDN) с Telegram WebApp SDK
- **API**: Netlify Functions (`/netlify/functions/*`), доступ по маршрутам `/api/*`
- **Данные (моки)**: JSON в папке `data/`
- **(Опционально) Бот**: Node + Telegraf в папке `bot/` для напоминаний

## Быстрый старт (Netlify + GitHub)
1. Создайте новый репозиторий на GitHub и загрузите этот проект.
2. Подключите репозиторий к Netlify (New site from Git → ваш репозиторий).
3. В Netlify ничего не билдим (сборка не нужна), `netlify.toml` уже настроен.
4. Получите адрес сайта вида `https://<your-site>.netlify.app` — это URL Mini App.
5. Создайте бота в @BotFather:
   - `/newbot` → получите **TOKEN**
   - `/setdomain` (если нужен вебхук) и `/setmenu` при желании
   - `/setinline` не требуется
   - `/setjoingroups` → off (рекомендуется)
6. Установите **WebApp URL**: в @BotFather → `/setdomain` или добавьте кнопку в меню, которая открывает `https://<your-site>.netlify.app`.
7. Запустите Mini App из Telegram: откройте бота → кнопку/меню → откроется веб-приложение.

### Локальный старт (без Netlify)
Можно открыть `index.html` локально, но API-запросы `/api/*` не будут работать. Для локального теста API поднимите любой сервер функции (например, netlify-cli) или измените `API_BASE` в `assets/app.js` на `""` и временно читайте данные прямо из `data/*`.

## Структура
```
.
├── index.html              # Главная страница Mini App
├── assets/
│   ├── app.js              # Логика UI
│   ├── styles.css          # Доп. стили (минимум)
│   └── icons/              # Иконки (SVG)
├── data/
│   ├── lunar_2025_10.json  # Мок лунного календаря (октябрь 2025)
│   ├── garden_tips.json    # Советы по культурам
│   └── important.json      # Карточки «Важно»
├── netlify.toml
└── netlify/
    └── functions/
        ├── home.js         # GET /api/home?date=YYYY-MM-DD&region=RU-XX
        ├── lunar.js        # GET /api/lunar?month=YYYY-MM
        ├── garden.js       # GET /api/garden?culture=томаты
        └── journal.js      # POST /api/journal  (отметки «сделано»)
```
(Опционально) `bot/` — минимальный бот Telegraf с командой `/start` и кнопкой «Открыть Алёшку».

## Переменные окружения (при необходимости)
- `APP_NAME` (по умолчанию «Алёшка»)
- `TZ_DEFAULT` (например, `Europe/Moscow`)

## Безопасность и ответственность
- Информация справочная и не является мед. рекомендацией.
- Проверяйте дозировки и инструкции на упаковке садовых средств.
- На экране «Важно» показываются только проверенные номера/ссылки.

## Дальше по плану
- Подключить TTS (озвучка) через Web Speech API (в браузерах, где поддерживается).
- Настроить Telegram Notifications через отдельный бэкенд/бот.
- Добавить редакторский импорт контента (Google Sheets → JSON/CSV).