import { Telegraf, Markup } from 'telegraf';
const token = process.env.TELEGRAM_TOKEN;
const webAppUrl = process.env.WEBAPP_URL;
if(!token || !webAppUrl){ console.error('Missing TELEGRAM_TOKEN or WEBAPP_URL'); process.exit(1); }
const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Здравствуйте! Это Алёшка — бабушкин помощник. Откройте приложение:',
  Markup.keyboard([Markup.button.webApp('Открыть Алёшку', webAppUrl)]).resize()
));
bot.hears(/алёшка|алешка|alyoshka/i, (ctx) =>
  ctx.reply('Нажмите кнопку, чтобы открыть приложение:',
    Markup.inlineKeyboard([Markup.button.webApp('Открыть Алёшку', webAppUrl)])
  )
);
bot.launch().then(() => console.log('Bot started'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
