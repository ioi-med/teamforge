/**
 * ============================================================================
 * TeamForge M-C — tests du noyau (données, calculs, règlement, import/export)
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT
 * ============================================================================
 * Usage : node tools/test_core.js     (aucun navigateur requis)
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log('✔ ' + label); }
  else { fail++; console.log('✘ ' + label); }
};
const section = (t) => console.log('\n--- ' + t + ' ---');

/* ---------- Chargement du noyau dans un contexte isolé ---------- */
const window = { MC_DATA: undefined };
// eslint-disable-next-line no-new-func
new Function('window', fs.readFileSync(path.join(ROOT, 'data/data.js'), 'utf8'))(window);
const core = new Function('window', fs.readFileSync(path.join(ROOT, 'src/js/core.js'), 'utf8') + `
  return { DEX, computeStats, createSet, exportSet, exportTeam, parseShowdown, validateTeam, validateSet,
           analyzeTeam, frMon, frItem, frMove, frAbility, frMoveText, displayName, normalizeId, resolveAbilityName,
           learnsetOf, clampEvs };`)(window);
const { DEX, computeStats, createSet, exportSet, parseShowdown, validateTeam, frMon, frItem, frMove, frAbility, displayName } = core;

/* ---------- 1. Base de données du règlement M-C ---------- */
section('1. Base de données du Règlement M-C');
ok(DEX.meta.speciesCount === 238, '238 espèces officielles');
ok(DEX.variants.length === 351, '351 variantes jouables (' + DEX.variants.length + ')');
ok(DEX.variants.filter((v) => v.isMega).length === 82, '82 Méga-Évolutions');
ok(DEX.items.length === 166, '166 objets légaux');
ok(DEX.moves.length === 677, '677 attaques référencées');
ok(DEX.abilities.length === 216, '216 talents');
ok(DEX.learnsets && Object.keys(DEX.learnsets).length > 300, 'movepools par forme présents');

/* ---------- 2. Noms français ---------- */
section('2. Noms français (l’exception étant l’export Showdown)');
ok(frMon(DEX.byKey.get('charizard')) === 'Dracaufeu', 'Dracaufeu (et non Charizard)');
ok(displayName(DEX.byKey.get('charizardmegax')) === 'Méga-Dracaufeu X', 'Méga-Dracaufeu X');
ok(frMon(DEX.byKey.get('raichualola')) === 'Raichu d’Alola', 'Raichu d’Alola');
ok(frMon(DEX.byKey.get('garchomp')) === 'Carchacrok', 'Carchacrok');
ok(frItem(DEX.itemsByKey.get('leftovers')) === 'Restes', 'objet : Restes');
ok(frMove(DEX.movesByKey.get('earthquake')) === 'Séisme', 'attaque : Séisme');
ok(frAbility('Defiant') === 'Acharné', 'talent : Acharné');
const noFr = DEX.variants.filter((v) => !v.frName).length + DEX.items.filter((i) => !i.frName).length + DEX.moves.filter((m) => !m.frName).length;
ok(noFr === 0, 'toutes les espèces, objets et attaques ont un nom français (' + noFr + ' manquant)');
ok(DEX.moves.filter((m) => m.frText).length >= 600, 'descriptions d’attaques en français (' + DEX.moves.filter((m) => m.frText).length + ')');

/* ---------- 3. Statistiques niveau 50 ---------- */
section('3. Calcul des statistiques niveau 50');
const ann = { key: 'annihilape', nickname: '', item: 'leftovers', ability: 'Defiant', nature: 'jolly', level: 50, tera: 'Fire',
  evs: { hp: 252, atk: 4, def: 0, spa: 0, spd: 0, spe: 252 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  moves: ['ragefist', 'drainpunch', 'bulkup', 'protect'] };
const st = computeStats(ann);
ok(JSON.stringify(st) === JSON.stringify({ hp: 217, atk: 136, def: 100, spa: 63, spd: 110, spe: 156 }),
  'Annihilape Jovial 252 PV / 4 Atk / 252 Vit → ' + JSON.stringify(st));
const bold = computeStats(Object.assign({}, ann, { nature: 'adamant' }));
ok(bold.atk > st.atk && bold.spe < st.spe, 'la nature Adamant augmente l’Attaque et baisse la Vitesse');
const zero = computeStats(Object.assign({}, ann, { evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } }));
ok(zero.hp < st.hp && zero.spe < st.spe, 'EVs/IVs à 0 : statistiques plus basses');

/* ---------- 4. Export Pokémon Showdown (anglais, format exact) ---------- */
section('4. Export Pokémon Showdown');
const txt = exportSet(ann, { alwaysIvs: true });
const expected = [
  'Annihilape @ Leftovers',
  'Ability: Defiant',
  'Level: 50',
  'Tera Type: Fire',
  'EVs: 252 HP / 4 Atk / 252 Spe',
  'Jolly Nature',
  'IVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe',
  '- Rage Fist',
  '- Drain Punch',
  '- Bulk Up',
  '- Protect',
].join('\n');
ok(txt === expected, 'export identique à l’exemple de référence (anglais)');
ok(!/Séisme|Restes|Acharné/.test(txt), 'l’export ne contient jamais de noms français');
const nick = exportSet(Object.assign({}, ann, { nickname: 'Ragequit' }), { alwaysIvs: false });
ok(nick.split('\n')[0] === 'Ragequit (Annihilape) @ Leftovers', 'surnom exporté « Surnom (Espèce) »');
ok(!/^IVs:/m.test(nick), 'IVs masqués quand tous les IVs valent 31 (option « Toujours afficher » désactivée)');

/* ---------- 5. Import : anglais ET français ---------- */
section('5. Import Pokémon Showdown (anglais et français)');
const en = parseShowdown(txt);
ok(en.sets.length === 1 && en.sets[0].key === 'annihilape', 'import anglais : Annihilape');
ok(en.sets[0].item === 'leftovers' && en.sets[0].moves[0] === 'ragefist', 'objet et attaques résolus');
const fr = parseShowdown(`Dracaufeu @ Restes
Talent : Brasier
Niveau : 50
Type Téra : Feu
EVs: 252 Atk / 252 Spe / 4 HP
Nature Jovial
- Lance-Flammes
- Séisme
- Abri
- Draco-Griffe`);
ok(fr.sets.length === 1 && fr.sets[0].key === 'charizard', 'import français : Dracaufeu reconnu');
ok(fr.sets[0].item === 'leftovers', 'objet français « Restes » résolu');
ok(fr.sets[0].moves.includes('flamethrower') && fr.sets[0].moves.includes('earthquake'), 'attaques françaises résolues');
ok(fr.sets[0].nature === 'jolly', 'nature française « Jovial » résolue');
const megaFr = parseShowdown('Méga-Absol Z @ Absolite Z\nAbility: Sharpness\nLevel: 50\n- Night Slash');
ok(megaFr.sets[0].key === 'absolmegaz', 'Méga-Absol Z reconnu depuis son nom français');
const ko = parseShowdown('Mewtwo @ Life Orb\nAbility: Pressure\n- Psystrike');
ok(ko.sets.length === 0 && ko.errors.length === 1, 'Mewtwo (hors règlement) refusé : ' + ko.errors[0]);
const multiple = parseShowdown([txt, txt, txt, txt, txt, txt, txt].join('\n\n'));
ok(multiple.sets.length === 7, '7 blocs collés → 7 sets analysés (le cap à 6 est appliqué par l’interface)');
ok(parseShowdown(txt + '\n\n' + txt).sets.length === 2 && validateTeam(parseShowdown(txt + '\n\n' + txt).sets).errors.length > 0,
  'deux exemplaires de la même espèce → violation de la clause Espèce');

/* ---------- 6. Règlement M-C ---------- */
section('6. Contrôles du Règlement M-C');
const teamTwice = [ann, Object.assign({}, ann)].map((s) => Object.assign({}, s));
const rep = validateTeam(teamTwice);
ok(rep.errors.some((e) => /Clause Espèce/.test(e)) && rep.errors.some((e) => /Clause Objet/.test(e)),
  'clauses Espèce et Objet signalées : ' + rep.errors[0]);
ok(rep.errors.some((e) => /Restes/.test(e)), 'message de la clause Objet en français (Restes)');
const megaNoStone = createSet('garchompmega');
const repMega = validateTeam([megaNoStone]);
ok(repMega.errors.some((e) => /pierre Méga|Pierre Méga|Méga-Évoluer/.test(e)), 'Méga sans pierre → erreur : ' + repMega.errors[0]);
const withStone = Object.assign({}, megaNoStone, { item: 'garchompite' });
ok(validateTeam([withStone]).errors.filter((e) => /Méga/.test(e)).length === 0, 'Méga + Garchompite → conforme');
const overEv = Object.assign({}, ann, { evs: { hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 252 } });
ok(core.validateSet(overEv).some((i) => i.level === 'error' && /510/.test(i.text)),
  'plus de 510 EVs → erreur de conformité signalée : ' + (core.validateSet(overEv)[0] || {}).text);
ok(core.clampEvs(overEv) && Object.values(overEv.evs).reduce((a, b) => a + b, 0) === 510, 'clampEvs ramène le total à 510');
const importFr = parseShowdown('Dracaufeu @ Restes\nTalent : Brasier\nNiveau : 50\nType Téra : Feu\nEVs: 252 PV / 4 Att. / 252 Vit.\nNature Jovial\n- Séisme');
ok(importFr.sets[0].evs.hp === 252 && importFr.sets[0].evs.spe === 252 && importFr.sets[0].evs.atk === 4,
  'EVs abrégés en français (PV / Att. / Vit.) reconnus');

console.log('\nNoyau : ' + pass + ' ✔ / ' + fail + ' ✘');
process.exit(fail ? 1 : 0);
