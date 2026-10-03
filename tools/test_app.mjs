/**
 * ============================================================================
 * TeamForge M-C — tests d’intégration dans un DOM simulé (jsdom)
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT
 * ============================================================================
 * Vérifie l’application réellement générée (index.html) : RGPD, interface en
 * français, calcul des statistiques, export Showdown en anglais, comptes locaux.
 *
 * Usage : node tools/test_app.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('✔ ' + label); } else { fail++; console.log('✘ ' + label); } };
const section = (t) => console.log('\n--- ' + t + ' ---');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot() {
  const dom = new JSDOM(html, {
    url: 'https://teamforge.local/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  await wait(450); // amorçage de l’application
  const { window } = dom;
  const $ = (s) => window.document.querySelector(s);
  const click = (s) => { const el = $(s); if (!el) throw new Error('élément introuvable : ' + s); el.click(); };
  const type = (s, v) => { const el = $(s); el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
  return { dom, window, $, click, type };
}

/* ==================== 1. Consentement RGPD ==================== */
section('1. Consentement RGPD');
{
  const { window, $, click, type } = await boot();
  ok(!$('#consent-banner').classList.contains('hidden'), 'bannière de consentement affichée à la première visite');
  ok(/Tout accepter/.test($('#consent-accept').textContent), 'bouton « Tout accepter » présent');
  ok(/Tout refuser/.test($('#consent-decline').textContent), 'bouton « Tout refuser » présent');
  ok(/100 % en local/.test($('#consent-banner').textContent), 'mention « aucune donnée chez un tiers »');
  click('#consent-decline');
  await wait(120);
  ok($('#consent-banner').classList.contains('hidden'), 'bannière fermée après refus');
  ok(window.localStorage.length === 0, 'refus → aucune écriture sur l’appareil (' + window.localStorage.length + ' clé)');
  // L’application reste pleinement utilisable en mémoire
  type('#top-search', 'dracaufeu');
  await wait(120);
  ok(window.document.querySelector('#dex-grid').children.length > 0, 'utilisation possible sans stockage (repli mémoire)');
  window.close();
}

/* ==================== 2. Interface en français ==================== */
section('2. Interface et données en français');
{
  const { window, $, click, type } = await boot();
  click('#consent-accept');
  await wait(150);
  const TF = window.TeamForge;
  ok(!!TF && !!TF.DEX, 'API window.TeamForge exposée');
  ok(TF.frMon(TF.DEX.byKey.get('charizard')) === 'Dracaufeu', 'frMon() → Dracaufeu');
  ok(TF.frItem(TF.DEX.itemsByKey.get('leftovers')) === 'Restes', 'frItem() → Restes');
  ok(TF.frMove(TF.DEX.movesByKey.get('earthquake')) === 'Séisme', 'frMove() → Séisme');
  ok(TF.frAbility('Defiant') === 'Acharné', 'frAbility() → Acharné');
  ok(!/Charizard|Garchomp|Leftovers/.test($('#hero-stats').textContent), 'les compteurs du bandeau sont en français');

  // Pokédex : cartes en français
  click('[data-view="dex"]');
  await wait(400);
  const dex = $('#dex-grid').textContent;
  ok(/Dracaufeu/.test(dex), 'Pokédex : Dracaufeu affiché');
  ok(!/Charizard/.test(dex), 'Pokédex : aucun nom anglais affiché');
  type('#dex-search', 'carchacrok');
  await wait(200);
  ok($('#dex-grid').children.length > 0 && /Carchacrok/.test($('#dex-grid').textContent), 'recherche par nom français (Carchacrok)');
  type('#dex-search', 'garchomp');
  await wait(200);
  ok($('#dex-grid').children.length > 0, 'recherche aussi possible en anglais');
  type('#dex-search', '');
  await wait(150);

  // Vue Règlement : objets en français
  click('[data-view="rules"]');
  await wait(250);
  const rules = window.document.body.textContent;
  ok(/Restes/.test($('#rules-items').textContent), 'vue Règlement : objets en français (Restes)');
  ok(/Méga-Dracaufeu X/.test(rules), 'vue Règlement : Méga-Évolutions en français');
  window.close();
}

/* ==================== 3. Teambuilder : statistiques et export ==================== */
section('3. Teambuilder — éditeur, statistiques, export');
{
  const { window, $, click, type } = await boot();
  click('#consent-accept');
  await wait(150);
  const TF = window.TeamForge;
  const team = TF.App.currentTeam();
  team.sets[0] = TF.parseShowdown(`Annihilape @ Leftovers
Ability: Defiant
Level: 50
Tera Type: Fire
EVs: 252 HP / 4 Atk / 252 Spe
Jolly Nature
- Rage Fist
- Drain Punch
- Bulk Up
- Protect`).sets[0];
  TF.App.renderTeam();
  await wait(200);
  const card = $('#slots').textContent;
  ok(/Courrousinge/.test(card), 'carte : nom français du Pokémon (Courrousinge = Annihilape)');
  ok(/Restes/.test(card), 'carte : objet en français (Restes)');
  ok(/Acharné/.test(card), 'carte : talent en français (Acharné)');
  ok(/Poing de Colère/.test(card), 'carte : attaque en français (Poing de Colère)');
  ok(!/Leftovers|Defiant|Rage Fist|Annihilape/.test(card), 'carte : aucun nom anglais');
  ok(/Nature Jovial/.test(card), 'carte : nature en français (Jovial)');

  TF.App.openEditor(0);
  await wait(200);
  ok($('#ed-item').value === 'Restes', 'éditeur : champ objet en français');
  ok($('#ed-ability').value === 'Acharné', 'éditeur : champ talent en français');
  ok($('#ed-move-0').value === 'Poing de Colère', 'éditeur : champ attaque en français');
  const stats = [...window.document.querySelectorAll('#stat-body [data-stat]')].map((r) => [r.dataset.stat, r.querySelector('.computed').textContent]);
  ok(JSON.stringify(stats.map((s) => s[1])) === JSON.stringify(['217', '136', '100', '63', '110', '156']),
    'statistiques niveau 50 en direct : ' + stats.map((s) => s[0] + '=' + s[1]).join(' '));
  ok(/EVs restants : 2 \(508\/510\)/.test($('#ev-counter').textContent), 'compteur d’EVs restants (508/510)');
  const preview = $('#ed-export').textContent;
  ok(/^Annihilape @ Leftovers$/m.test(preview) && /^Ability: Defiant$/m.test(preview) && /^Jolly Nature$/m.test(preview),
    'aperçu d’export : format anglais Pokémon Showdown (seule exception)');
  ok(!/Restes|Acharné/.test(preview), 'l’aperçu d’export ne contient pas de noms français');
  window.close();
}

/* ==================== 4. Import (français accepté) ==================== */
section('4. Import Pokémon Showdown');
{
  const { window, click, type } = await boot();
  click('#consent-accept');
  await wait(150);
  window.TeamForge.App.openIO();
  await wait(120);
  type('#io-in', `Dracaufeu @ Restes\nTalent : Brasier\nNiveau : 50\nType Téra : Feu\nEVs: 252 Att. / 252 Vit. / 4 PV\nNature Jovial\n- Lance-Flammes\n- Séisme\n- Abri\n- Lance-Soleil`);
  click('#btn-import');
  await wait(250);
  const team = window.TeamForge.App.currentTeam();
  ok(team.sets.filter(Boolean).length === 1, 'import français : 1 Pokémon intégré');
  ok(team.sets[0].key === 'charizard' && team.sets[0].item === 'leftovers', 'espèce et objet français résolus');
  ok(team.sets[0].moves.includes('flamethrower') && team.sets[0].moves.includes('solarbeam'), 'attaques françaises résolues');
  ok(/Dracaufeu/.test(window.document.querySelector('#slots').textContent), 'la carte affiche le nom français');
  window.close();
}

/* ==================== 5. Comptes locaux (sans serveur) ==================== */
section('5. Comptes locaux et RGPD');
{
  const { window, $, click, type } = await boot();
  click('#consent-accept');
  await wait(150);
  click('#btn-auth');
  await wait(120);
  click('#tab-signup');
  type('#auth-pseudo', 'dresseur');
  type('#auth-login', 'dresseur');
  type('#auth-password', 'motdepasse');
  type('#auth-confirm', 'motdepasse');
  click('#auth-submit');
  await wait(700);
  ok(!!window.TeamForge.Store.session.user(), 'compte local créé et session ouverte');
  const stored = window.localStorage.getItem('mcb.accounts') || '';
  // jsdom n’implémente pas WebCrypto : le noyau bascule alors sur son repli documenté (« fallback$ »).
  // Dans un vrai navigateur, la dérivation est bien PBKDF2-SHA256 (150 000 itérations) — vérifié par tools/test_ui.mjs.
  ok(/(pbkdf2|fallback)\$/.test(stored) && !/motdepasse/.test(stored),
    'mot de passe dérivé (' + (stored.match(/(pbkdf2|fallback)\$/)[1]) + '), jamais stocké en clair');
  ok(/\bsalt\b/.test(stored) && stored.length > 60, 'sel aléatoire présent dans le compte');
  click('#btn-settings');
  await wait(150);
  window.confirm = () => true;
  click('#btn-wipe-all');
  await wait(300);
  ok(window.localStorage.length === 0, 'suppression totale : 0 clé restante (' + window.localStorage.length + ')');
  ok(!$('#consent-banner').classList.contains('hidden'), 'la bannière de consentement est de nouveau proposée');
  window.close();
}

console.log('\nApplication : ' + pass + ' ✔ / ' + fail + ' ✘');
process.exit(fail ? 1 : 0);
