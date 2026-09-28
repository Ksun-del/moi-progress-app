// Переносит меню, покупки, заготовки, продукты и блюда рациона из ../index.html (версия-сайт)
// в src/data/*.js — чтобы сайт и приложение пользовались одними данными.
// Запуск: node scripts/extract-data.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const js = src.slice(src.lastIndexOf('<script>') + 8, src.lastIndexOf('</script>'));
function grab(start, end) {
  const i = js.indexOf(start), j = js.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error('не нашла ' + start);
  return js.slice(i, j).trimEnd() + '\n';
}
const HDR = '// Создано автоматически из index.html командой `node scripts/extract-data.js`.\n\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'menus.js'), HDR +
  grab('function generateWeekMenuA', 'let defaultSettings') + '\n' +
  grab('const WEEKLY_SHOPPING_LIST_BY_MENU', 'const DAY_NAMES_FULL') + '\n' +
  'export const MENUS = [generateWeekMenuA(), generateWeekMenuB(), generateWeekMenuC()];\n' +
  'export const SHOPPING = WEEKLY_SHOPPING_LIST_BY_MENU;\n' +
  'export const PREP = PREP_LIST_BY_MENU;\n');
fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'foods.js'), HDR +
  grab('const PRODUCTS = [', 'function norm(') + '\n' +
  grab('const RATION_DISHES = [', 'const DAY_SHORT') + '\n' +
  'export { PRODUCTS, RATION_DISHES };\n');
console.log('Готово: src/data/menus.js, src/data/foods.js');
