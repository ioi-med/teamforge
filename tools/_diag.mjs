import { chromium } from 'playwright';
const b = await chromium.launch();

/* ---------- 1. Contexte hors ligne (aperçu sans réseau) ---------- */
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, offline: true, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [], warns = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + String(e).split('\n')[0]));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); if (m.type() === 'warning') warns.push(m.text().slice(0, 120)); });
const t0 = Date.now();
await p.goto('file:///home/user/index.html');
await p.waitForTimeout(2500);
console.log('— hors ligne / mobile —');
console.log('  chargement + 1re peinture :', Date.now() - t0, 'ms');
console.log('  erreurs :', errs.length, errs.slice(0, 4));
console.log('  bannière consentement visible :', await p.isVisible('#consent-banner'));
await p.click('#consent-accept');
await p.waitForTimeout(300);
console.log('  après acceptation, erreurs :', errs.length);
const perf = await p.evaluate(() => {
  const t = performance.now();
  window.TeamForge.App.setView('dex');
  const t1 = performance.now();
  return {
    cartes: document.querySelectorAll('#dex-grid > *').length,
    noeuds: document.getElementsByTagName('*').length,
    msRenduDex: Math.round(t1 - t),
    heaps: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' Mo' : 'n/a',
  };
});
await p.waitForTimeout(2000);
console.log('  Pokédex :', JSON.stringify(perf));
const t2 = Date.now();
await p.fill('#dex-search', 'dra');
await p.waitForTimeout(400);
console.log('  recherche « dra » :', Date.now() - t2, 'ms');
await p.evaluate(() => { const el = document.querySelector('#top-search'); el.value = 'a'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await p.waitForTimeout(1200);
console.log('  recherche en-tête (fréquence réelle) :', Date.now() - t2, 'ms, erreurs :', errs.length);
await ctx.close();

/* ---------- 2. Aperçu sandboxé (origine opaque, « sandbox=allow-scripts ») ---------- */
const ctx2 = await b.newContext({ viewport: { width: 1200, height: 800 } });
const p2 = await ctx2.newPage();
const errs2 = [];
p2.on('pageerror', (e) => errs2.push('pageerror: ' + String(e).split('\n')[0]));
p2.on('console', (m) => { if (m.type() === 'error') errs2.push('console: ' + m.text().slice(0, 200)); });
await p2.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe id="f" sandbox="allow-scripts" src="file:///home/user/index.html" style="width:1200px;height:800px;border:0"></iframe>
</body>`, { waitUntil: 'load' });
await p2.waitForTimeout(4000);
const frame = p2.frames().find((f) => f.url().includes('index.html'));
console.log('\n— aperçu sandboxé (allow-scripts, origine opaque) —');
console.log('  iframe chargée :', !!frame);
if (frame) {
  console.log('  erreurs :', errs2.length, errs2.slice(0, 5));
  const state = await frame.evaluate(() => ({
    hasAPI: !!window.TeamForge,
    banner: !!document.querySelector('#consent-banner') && !document.querySelector('#consent-banner').classList.contains('hidden'),
    cartes: document.querySelectorAll('#dex-grid > *').length,
    slots: document.querySelectorAll('#slots > *').length,
    stockage: (() => { try { localStorage.setItem('t', '1'); return 'accessibile'; } catch (e) { return 'bloqué (normal en sandbox)'; } })(),
    titre: document.title,
  })).catch((e) => 'evaluate impossible : ' + String(e).split('\n')[0]);
  console.log('  état :', JSON.stringify(state));
  if (typeof state === 'object') {
    const click = await frame.evaluate(() => { try { document.querySelector('#consent-accept').click(); return 'clic OK'; } catch (e) { return 'erreur clic : ' + e.message; } });
    console.log('  clic « Tout accepter » :', click);
    await p2.waitForTimeout(1200);
    const after = await frame.evaluate(() => ({ erreurs: window.__err || null, slots: document.querySelectorAll('#slots > *').length, toast: document.querySelector('#toasts')?.textContent?.slice(0, 80) }));
    console.log('  après clic :', JSON.stringify(after), '| nouvelles erreurs :', errs2.slice(0, 3));
  }
}
await b.close();
