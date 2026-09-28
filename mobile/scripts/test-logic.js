// Проверка логики приложения без телефона: node scripts/test-logic.js
// (подключаем загрузчик, чтобы Node понимал импорты без «.js», как их пишет Expo)
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');

const hooks = `
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) { if (spec.startsWith('.') && !spec.endsWith('.js')) return next(spec + '.js', ctx); throw e; }
}
export async function load(url, ctx, next) {
  if (url.includes('/src/')) { const r = await next(url, { ...ctx, format: 'module' }); return { ...r, format: 'module' }; }
  return next(url, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(hooks), pathToFileURL(__filename));
import(pathToFileURL(require('path').join(__dirname, 'tests.mjs')).href).catch(e => { console.error(e); process.exit(1); });
