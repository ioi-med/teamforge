/**
 * ============================================================================
 * TeamForge M-C — captures d’écran de référence (charte Coup Critique)
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT
 * ============================================================================
 * Usage : npm run shots   (nécessite Chromium : npx playwright install chromium)
 * Sortie : screenshots/cc-*.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const FILE = 'file://' + path.join(ROOT, 'index.html');

const TEAM = `Annihilape @ Leftovers
Ability: Defiant
Level: 50
Tera Type: Fire
EVs: 252 HP / 4 Atk / 252 Spe
Jolly Nature
- Rage Fist
- Drain Punch
- Bulk Up
- Protect

Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
Tera Type: Steel
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Protect
- Rock Slide

Absol @ Absolite Z
Ability: Sharpness
Level: 50
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Night Slash
- Sucker Punch
- Protect
- Knock Off

Raichu-Alola @ Light Clay
Ability: Surge Surfer
Level: 50
Tera Type: Electric
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
- Thunderbolt
- Psychic
- Fake Out
- Protect

Baxcalibur @ Focus Sash
Ability: Thermal Exchange
Level: 50
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Glaive Rush
- Icicle Crash
- Ice Shard
- Protect

Rillaboom @ Grassy Seed
Ability: Grassy Surge
Level: 50
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Grassy Glide
- Fake Out
- Wood Hammer
- Knock Off`;

const importTeam = (p, text) => p.evaluate((txt) => {
  const { App, parseShowdown } = window.TeamForge;
  const { sets } = parseShowdown(txt);
  const team = App.currentTeam();
  team.name = 'Équipe Ranked M-C';
  team.sets = [null, null, null, null, null, null];
  sets.slice(0, 6).forEach((s, i) => { team.sets[i] = s; });
  const nameInput = document.querySelector('#team-name');
  if (nameInput) nameInput.value = team.name;
  App.renderTeam();
}, text);

const browser = await chromium.launch();
const errors = [];

/* ---------------- Bureau ---------------- */
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/sprites|ERR_/.test(m.text())) errors.push(m.text()); });
await page.goto(FILE);
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'cc-0-consent.png') });
await page.click('#consent-accept');
await page.waitForTimeout(300);

await importTeam(page, TEAM);
await page.waitForTimeout(2600);
await page.screenshot({ path: path.join(OUT, 'cc-1-team.png') });

await page.click('#slots .slot-card');
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(OUT, 'cc-2-editor.png') });
await page.click('#btn-editor-close');

await page.evaluate(() => window.TeamForge.App.setView('dex'));
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(OUT, 'cc-3-dex.png') });
await page.evaluate(() => {
  const app = window.TeamForge.App;
  document.querySelector('#dex-search').value = 'carchacrok';
  app.renderDex();
});
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'cc-3b-dex-search.png') });

await page.evaluate(() => window.TeamForge.App.setView('rules'));
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'cc-4-rules.png') });

await page.evaluate(() => window.TeamForge.App.openTeams());
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'cc-5-teams.png') });
await page.click('#modal-teams .modal-x');

await page.evaluate(() => window.TeamForge.App.openIO());
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'cc-6-io.png') });
await page.click('#modal-io .modal-x');

await page.evaluate(() => window.TeamForge.App.openSettings());
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'cc-7-settings.png') });
await page.click('#modal-settings .modal-x');

await page.click('#btn-auth');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'cc-10-auth.png') });
await page.click('#modal-auth .modal-x');

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'cc-11-footer.png') });
await page.close();

/* ---------------- Mobile ---------------- */
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
mobile.on('pageerror', (e) => errors.push(String(e)));
await mobile.goto(FILE);
await mobile.waitForTimeout(600);
await mobile.click('#consent-accept');
await importTeam(mobile, TEAM);
await mobile.waitForTimeout(2600);
await mobile.screenshot({ path: path.join(OUT, 'cc-8-mobile-team.png') });
await mobile.evaluate(() => window.TeamForge.App.setView('dex'));
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: path.join(OUT, 'cc-9-mobile-dex.png') });
await mobile.close();

await browser.close();
console.log('Captures écrites dans screenshots/ — erreurs JS : ' + errors.length + (errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''));
