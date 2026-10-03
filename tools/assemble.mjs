/**
 * ============================================================================
 * TeamForge M-C — assemblage des livrables
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT
 * ============================================================================
 * 1. compile Tailwind (assets/css/tailwind.css)
 * 2. injecte dans src/template.html : CSS + données (data/data.js) + JS
 *    → index.html         : application complète dans un seul fichier
 *    → index-modular.html : version multi-fichiers (styles/scripts/données liés)
 *
 * Usage : node tools/assemble.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- 1. Tailwind ---------- */
console.log('• compilation de Tailwind…');
execFileSync(
  path.join(ROOT, 'node_modules/.bin/tailwindcss'),
  ['-c', 'tailwind.config.js', '-i', 'src/css/app.css', '-o', 'assets/css/tailwind.css', '--minify'],
  { cwd: ROOT, stdio: 'inherit' },
);

const css = read('assets/css/tailwind.css');
const template = read('src/template.html');

/* ---------- 2. Version fichier unique ---------- */
const dataInline = read('data/data.js').replace(/<\/script/gi, '<\\/script');
let single = template
  .replace('/*INJECT_CSS*/', () => css)
  .replace('/*INJECT_DATA*/', () => dataInline)
  .replace('/*INJECT_CORE*/', () => read('src/js/core.js'))
  .replace('/*INJECT_STORE*/', () => read('src/js/store.js'))
  .replace('/*INJECT_UI*/', () => read('src/js/ui.js'))
  .replace('/*INJECT_MAIN*/', () => read('src/js/main.js'));

// Favicon : la version mono-fichier embarque l’icône en data URI (index.html reste
// autonome : déplaçable seul, utilisable hors ligne et dans un aperçu sans réseau).
const favicon = read('assets/icons/favicon.svg');
single = single.replace('href="assets/icons/favicon.svg"',
  'href="data:image/svg+xml;base64,' + Buffer.from(favicon, 'utf8').toString('base64') + '"');

if (/\*INJECT_[A-Z]+\*\//.test(single)) throw new Error('Placeholder non remplacé dans index.html.');
if (/src="assets\/icons\/favicon.svg"/.test(single)) throw new Error('Favicon non embarqué dans index.html.');
fs.writeFileSync(path.join(ROOT, 'index.html'), single);

/* ---------- 3. Version modulaire ---------- */
// Même gabarit, mais les ressources deviennent des liens externes.
const modular = template
  .replace('<style>/*INJECT_CSS*/</style>', '<link rel="stylesheet" href="assets/css/tailwind.css" />')
  .replace('<script>/*INJECT_DATA*/</script>', '<script src="data/data.js"></script>')
  .replace('<script>/*INJECT_CORE*/</script>', '<script src="src/js/core.js"></script>')
  .replace('<script>/*INJECT_STORE*/</script>', '<script src="src/js/store.js"></script>')
  .replace('<script>/*INJECT_UI*/</script>', '<script src="src/js/ui.js"></script>')
  .replace('<script>/*INJECT_MAIN*/</script>', '<script src="src/js/main.js"></script>');
if (/\*INJECT_[A-Z]+\*\//.test(modular)) throw new Error('Placeholder non remplacé dans index-modular.html.');
if (!modular.includes('src/js/ui.js')) throw new Error('Scripts externes absents de index-modular.html.');
fs.writeFileSync(path.join(ROOT, 'index-modular.html'), modular);

const ko = (n) => Math.round(n / 1024) + ' Ko';
console.log(`✔ index.html         : ${ko(single.length)} (CSS ${ko(css.length)} · données ${ko(dataInline.length)})`);
console.log(`✔ index-modular.html : ${ko(modular.length)} + assets/css/tailwind.css, data/data.js, src/js/*.js`);
