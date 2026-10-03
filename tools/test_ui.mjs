/**
 * ============================================================================
 * TeamForge M-C — tests de bout en bout dans Chromium (Playwright)
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT
 * ============================================================================
 * Parcours complet dans un vrai navigateur : consentement RGPD, interface
 * 100 % française, éditeur, calculs, export anglais, import FR/EN, comptes
 * locaux (PBKDF2 réel) et suppression totale des données.
 *
 * Prérequis : npx playwright install chromium
 * Usage     : node tools/test_ui.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';

const FILE = 'file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), '../index.html');
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('✔ ' + label); } else { fail++; console.log('✘ ' + label); } };
const section = (t) => console.log('\n--- ' + t + ' ---');

const TEAM_EN = `Annihilape @ Leftovers
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

const browser = await chromium.launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/sprites|ERR_/.test(m.text())) errors.push(m.text()); });
page.on('dialog', (d) => d.accept());
await page.goto(FILE);
await page.waitForTimeout(500);

/* ==================== 1. Consentement ==================== */
section('1. Consentement RGPD');
ok(await page.isVisible('#consent-banner'), 'bannière affichée à la première visite');
await page.click('#consent-accept');
await page.waitForTimeout(250);
ok(!(await page.isVisible('#consent-banner')), 'bannière fermée après acceptation');
ok((await page.evaluate(() => localStorage.getItem('mcb.consent'))) !== null, 'consentement enregistré localement');
ok((await page.evaluate(() => localStorage.getItem('mcb.consent'))) !== '', 'contenu du consentement présent');

/* ==================== 2. Interface 100 % française ==================== */
section('2. Interface 100 % française');
const body = await page.textContent('body');
ok(/TeamForge/.test(body) && /Pokédex/.test(body) && /Règlement M-C/.test(body), 'en-tête et navigation en français');
ok(/238 espèces/.test(body) && /Méga-Évolutions/.test(body), 'compteurs du bandeau en français');
await page.click('[data-view="dex"]');
await page.waitForTimeout(500);
const dex = await page.textContent('#dex-grid');
ok(/Dracaufeu/.test(dex) && /Carchacrok/.test(dex), 'Pokédex : noms français (Dracaufeu, Carchacrok)');
ok(!/Charizard|Garchomp|Blastoise/.test(dex), 'Pokédex : aucun nom anglais affiché');
await page.fill('#dex-search', 'mistigrix');
await page.waitForTimeout(300);
const searchFr = await page.textContent('#dex-grid');
ok(/Mistigrix/.test(searchFr), 'recherche par nom français (Mistigrix) fonctionnelle');
await page.fill('#dex-search', 'meowstic');
await page.waitForTimeout(300);
ok(/Mistigrix/.test(await page.textContent('#dex-grid')), 'recherche en anglais également acceptée');
await page.fill('#dex-search', '');
await page.click('[data-view="rules"]');
await page.waitForTimeout(400);
const itemsText = await page.textContent('#rules-items');
ok(/Restes/.test(itemsText) && /Orbe Vie/.test(itemsText), 'vue Règlement : objets en français (Restes, Orbe Vie)');
const rulesText = await page.textContent('#view-rules');
ok(/Méga-Dracaufeu X/.test(rulesText), 'vue Règlement : Méga-Évolutions en français');
ok(!/Leftovers|Life Orb|Mega Charizard/.test(itemsText + rulesText), 'vue Règlement : aucun nom anglais');

/* ==================== 3. Import d’une équipe (anglais puis français) ==================== */
section('3. Import Pokémon Showdown');
await page.click('#btn-quick-io');
await page.waitForTimeout(300);
await page.fill('#io-in', TEAM_EN);
await page.click('#btn-import');
await page.waitForTimeout(500);
const cards = await page.textContent('#slots');
ok(/Courrousinge/.test(cards) && /Carchacrok/.test(cards) && /Méga-Absol Z/.test(cards), 'équipe importée affichée en français (Courrousinge, Carchacrok, Méga-Absol Z)');
ok(/Restes/.test(cards) && /Orbe Vie/.test(cards), 'objets affichés en français (Restes, Orbe Vie)');
ok(/Poing de Colère/.test(cards) && /Séisme/.test(cards), 'attaques affichées en français (Poing de Colère, Séisme)');
ok(await page.evaluate(() => window.TeamForge.App.currentTeam().sets.filter(Boolean).length === 6), '6 Pokémon dans l’équipe');
await page.fill('#io-in', TEAM_EN + '\n\n' + TEAM_EN.split('\n\n')[0]);
await page.click('#btn-import');
await page.waitForTimeout(400);
const report = await page.textContent('#io-report');
ok(/7 Pokémon importé/.test(report) || /importé/.test(report), 'import : rapport affiché en français');
ok(await page.evaluate(() => window.TeamForge.App.currentTeam().sets.filter(Boolean).length === 6), 'au-delà de 6 Pokémon, seuls 6 sont conservés');
await page.fill('#io-in', 'Mewtwo @ Life Orb\nAbility: Pressure\n- Psystrike');
await page.click('#btn-import');
await page.waitForTimeout(300);
ok(/Mewtwo.*pas autorisé/.test(await page.textContent('#io-report')), 'Pokémon interdit (Mewtwo) refusé avec message français');
await page.click('#modal-io .modal-x');
await page.click('[data-view="team"]');
await page.waitForTimeout(300);

/* ==================== 4. Éditeur : français, EV/IV, statistiques ==================== */
section('4. Éditeur détaillé');
await page.click('#slots .slot-card');
await page.waitForTimeout(600);
ok((await page.inputValue('#ed-item')) === 'Restes', 'champ objet en français');
ok((await page.inputValue('#ed-ability')) === 'Acharné', 'champ talent en français');
ok((await page.inputValue('#ed-move-0')) === 'Poing de Colère', 'champ attaque en français');
ok((await page.inputValue('#ed-species')) === 'Courrousinge', 'champ espèce en français');
const statValues = await page.$$eval('#stat-body [data-stat]', (rows) => rows.map((r) => r.querySelector('.computed').textContent));
ok(statValues.join(',') === '217,136,100,63,110,156', 'statistiques niveau 50 : ' + statValues.join(' '));
ok(/EVs restants : 2 \(508\/510\)/.test(await page.textContent('#ev-counter')), 'compteur d’EVs restants (508/510)');
const before = await page.$$eval('#stat-body [data-stat]', (rows) => rows.find((r) => r.dataset.stat === 'spe').querySelector('.computed').textContent);
await page.$eval('#stat-body [data-stat="spe"] [data-ev-num]', (el) => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(250);
const after = await page.$$eval('#stat-body [data-stat]', (rows) => rows.find((r) => r.dataset.stat === 'spe').querySelector('.computed').textContent);
ok(Number(after) < Number(before), 'les statistiques se recalculent en direct (' + before + ' → ' + after + ')');
await page.$eval('#stat-body [data-stat="spe"] [data-ev-num]', (el) => { el.value = '252'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(200);

/* ==================== 5. Export : anglais uniquement ==================== */
section('5. Export Pokémon Showdown (anglais)');
const preview = await page.textContent('#ed-export');
ok(/^Annihilape @ Leftovers$/m.test(preview), 'aperçu : « Annihilape @ Leftovers »');
ok(/^Ability: Defiant$/m.test(preview) && /^Jolly Nature$/m.test(preview), 'aperçu : mots-clés anglais');
ok(/^- Rage Fist$/m.test(preview), 'aperçu : attaque en anglais (Rage Fist)');
ok(!/Courrousinge|Restes|Acharné|Séisme/.test(preview), 'aperçu : aucune trace de français');
await page.click('#btn-editor-copy');
await page.waitForTimeout(300);
const clip = await page.evaluate(() => navigator.clipboard.readText());
ok(/^Annihilape @ Leftovers$/m.test(clip) && /- Rage Fist/.test(clip), 'copie dans le presse-papier au format Showdown');
ok(await page.evaluate(() => window.TeamForge.App.currentTeam().sets.filter(Boolean).length === 6), 'équipe toujours complète après édition');

/* Autocomplétion : clause Objet + Échap */
await page.click('#ed-item');
await page.fill('#ed-item', 'orbe');
await page.waitForTimeout(350);
const acText = await page.textContent('body');
ok(/clause Objet/.test(acText), 'clause Objet signalée dans l’autocomplétion des objets');
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
ok(await page.isVisible('#editor-panel, #ed-species'), 'Échap ferme la liste sans quitter l’éditeur');
await page.click('#btn-editor-close');
await page.waitForTimeout(200);

/* ==================== 6. Comptes locaux et RGPD ==================== */
section('6. Comptes locaux, PBKDF2 et suppression');
await page.click('#btn-auth');
await page.waitForTimeout(250);
await page.click('#tab-signup');
await page.fill('#auth-pseudo', 'Mehdi');
await page.fill('#auth-login', 'mehdi');
await page.fill('#auth-password', 'motdepasse1');
await page.fill('#auth-confirm', 'motdepasse1');
await page.click('#auth-submit');
await page.waitForTimeout(900);
ok(await page.evaluate(() => !!window.TeamForge.Store.session.user()), 'compte local créé');
const accounts = await page.evaluate(() => localStorage.getItem('mcb.accounts') || '');
ok(/pbkdf2\$150000\$/.test(accounts), 'PBKDF2-SHA256 150 000 itérations (navigateur réel)');
ok(!/motdepasse1/.test(accounts), 'mot de passe jamais stocké en clair');
ok(await page.evaluate(() => window.TeamForge.Store.teams.list().length >= 2), 'équipe invitée transférée dans le compte');
await page.click('#btn-user');
await page.waitForTimeout(200);
await page.click('[data-user-action="logout"]');
await page.waitForTimeout(300);
ok(/invité/.test(await page.textContent('#session-chip')), 'déconnexion → retour en mode invité');
await page.click('#btn-auth');
await page.waitForTimeout(250);
await page.fill('#auth-login', 'mehdi');
await page.fill('#auth-password', 'motdepasse1');
await page.click('#auth-submit');
await page.waitForTimeout(900);
ok(await page.evaluate(() => !!window.TeamForge.Store.session.user()), 'reconnexion réussie (mot de passe vérifié)');
if (await page.isVisible('#modal-auth')) await page.click('#modal-auth .modal-x');
await page.click('#btn-settings');
await page.waitForTimeout(250);
await page.click('#btn-wipe-all');
await page.waitForTimeout(600);
ok((await page.evaluate(() => localStorage.length)) === 0, 'suppression totale : 0 clé restante');
ok(await page.isVisible('#consent-banner'), 'consentement de nouveau demandé après effacement');

section('7. Erreurs JavaScript');
ok(errors.length === 0, 'aucune erreur JavaScript sur tout le parcours' + (errors.length ? ' → ' + errors.slice(0, 2).join(' | ') : ''));

console.log('\nInterface : ' + pass + ' ✔ / ' + fail + ' ✘');
await browser.close();
process.exit(fail ? 1 : 0);
