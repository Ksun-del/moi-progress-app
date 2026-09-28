// Берёт index.html из корня репозитория (тот же, что на GitHub Pages)
// и упаковывает его внутрь приложения: картинки превращаются в data:-ссылки,
// результат пишется в app-html.js. Запуск: npm run build-html
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/(src|href)="([\w.-]+\.png)"/g, (m, attr, file) => {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return m;
  return `${attr}="data:image/png;base64,${fs.readFileSync(p).toString('base64')}"`;
});
// Манифест и service worker нужны только сайту
html = html.replace(/<link rel="manifest"[^>]*>\s*/, '');

const out = '// Файл создаётся автоматически командой `npm run build-html`. Не редактировать вручную.\n' +
  'export default ' + JSON.stringify(html) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'app-html.js'), out);
console.log('app-html.js обновлён, ' + Math.round(out.length / 1024) + ' КБ');
