/**
 * enrichissement FR — TeamForge M-C
 * Ajoute les noms français officiels (PokéAPI) aux données du Règlement M-C :
 *   buildables[].frName / frLabel / frSpecies · items[].frName · abilities[].frName
 *   moves[].frName / frText (texte de description)
 * Les noms anglais (`name`, `n`) sont CONSERVÉS : ils restent nécessaires à l’export Pokémon Showdown.
 *
 * Usage : node tools/fr_names.mjs   (écrit data/data.js)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/user';
const CSV = path.join(ROOT, 'srcdata/pokeapi');
const FR = '5', EN = '9';

const rows = (file) => {
  const txt = fs.readFileSync(path.join(CSV, file), 'utf8').split('\n');
  const head = txt.shift().split(',');
  return txt.filter(Boolean).map((l) => {
    // les CSV PokéAPI contiennent des virgules échappées entre guillemets
    const out = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, out[i]]));
  });
};
// Normalisation : entités HTML, accents, casse et ponctuation (« Farfetch&#x27;d » → « farfetchd »)
const decode = (s) => String(s || '').replace(/&#x27;|&apos;|&#39;/g, "'").replace(/&amp;/g, '&');
const norm = (s) => decode(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

// Renommages entre générations (identifiant Pokémon Showdown → identifiant PokéAPI)
const ALIAS = {
  moves: { visegrip: 'vice-grip' },
  items: { leek: 'stick' },
  abilities: {},
  forms: { f: 'female', m: 'male', four: 'family-of-four' }, // suffixes de forme
};

// Traductions manuelles : capacités propres à Pokémon Champions, absentes des jeux
// traduits officiellement (donc absentes de PokéAPI). `unofficial: true` les signale.
const MANUAL = {
  // Formes dont PokéAPI n’a pas de nom composé en français : nom officiel reconstitué.
  forms: {
    mausholdfour: 'Famignol Famille de Quatre',
    squawkabillyblue: 'Tapatoès Plumage Bleu',
    squawkabillyyellow: 'Tapatoès Plumage Jaune',
    squawkabillywhite: 'Tapatoès Plumage Blanc',
    taurospaldeacombat: 'Tauros de Paldéa (Combat)',
    taurospaldeablaze: 'Tauros de Paldéa (Flamme)',
    taurospaldeaaqua: 'Tauros de Paldéa (Aqua)',
  },
  abilities: {
    auraguard: { frName: 'Garde Aura', unofficial: true },
    eelevate: { frName: 'Élévation', unofficial: true },
    firemane: { frName: 'Crinière de Feu', unofficial: true },
  },
};

/* ---------- 1. Tables PokéAPI ---------- */
const frByName = (idFile, nameFile, idKey, nameKey, aliases = {}) => {
  const ids = new Map(); // identifiant normalisé → liste d’ids PokéAPI (doublons fréquents)
  for (const r of rows(idFile)) {
    const k = norm(r.identifier);
    if (!ids.has(k)) ids.set(k, []);
    ids.get(k).push(r[idKey]);
  }
  const fr = new Map(), en = new Map();
  for (const r of rows(nameFile)) {
    const id = r[nameKey];
    if (r.local_language_id === FR) fr.set(id, r.name);
    if (r.local_language_id === EN) en.set(id, r.name);
  }
  const out = { fr: new Map(), en: new Map() };
  for (const [k, list] of ids) {
    // le premier id disposant d’une traduction française gagne (les entrées obsolètes n’en ont pas)
    const frName = list.map((id) => fr.get(id)).find(Boolean);
    const enName = list.map((id) => en.get(id)).find(Boolean);
    if (frName) out.fr.set(k, frName);
    if (enName) out.en.set(k, enName);
  }
  // Alias : on recopie la traduction de la cible sur l’identifiant d’origine
  for (const [from, to] of Object.entries(aliases)) {
    const t = norm(to);
    if (out.fr.has(t)) out.fr.set(norm(from), out.fr.get(t));
    if (out.en.has(t)) out.en.set(norm(from), out.en.get(t));
  }
  return out;
};

const movesNames = frByName('moves.csv', 'move_names.csv', 'id', 'move_id', ALIAS.moves);
const abilityNames = frByName('abilities.csv', 'ability_names.csv', 'id', 'ability_id', ALIAS.abilities);
const itemNames = frByName('items.csv', 'item_names.csv', 'id', 'item_id', ALIAS.items);

// Espèces : identifiant → nom FR/EN
const speciesFr = new Map(), speciesEn = new Map();
const speciesIdByKey = new Map();
for (const r of rows('pokemon_species.csv')) { speciesIdByKey.set(norm(r.identifier), r.id); speciesFr.set(norm(r.identifier), r.id); speciesEn.set(norm(r.identifier), r.id); }
for (const r of rows('pokemon_species_names.csv')) {
  const n = r.pokemon_species_id;
  if (r.local_language_id === FR) for (const [k, id] of speciesFr) if (id === n) speciesFr.set(k, r.name);
  if (r.local_language_id === EN) for (const [k, id] of speciesEn) if (id === n) speciesEn.set(k, r.name);
}

// Formes : « espèce|forme » → nom FR officiel (« Méga-Dracaufeu X », « Raichu d’Alola »…)
const pokemonById = new Map();
for (const r of rows('pokemon.csv')) pokemonById.set(r.id, r);
const speciesIdentById = new Map();
for (const r of rows('pokemon_species.csv')) speciesIdentById.set(r.id, r.identifier);
const formNames = new Map();
for (const r of rows('pokemon_form_names.csv')) {
  if (!formNames.has(r.pokemon_form_id)) formNames.set(r.pokemon_form_id, {});
  formNames.get(r.pokemon_form_id)[r.local_language_id] = r;
}
const formFr = new Map(), formLabel = new Map();
for (const f of rows('pokemon_forms.csv')) {
  const pk = pokemonById.get(f.pokemon_id);
  if (!pk) continue;
  const nm = formNames.get(f.id) || {};
  const frFull = nm[FR]?.pokemon_name, frLabel = nm[FR]?.form_name;
  const spIdent = speciesIdentById.get(pk.species_id);
  const idents = new Set([norm(pk.identifier), norm(spIdent + '-' + (f.form_identifier || ''))]);
  for (const k of idents) {
    if (!k) continue;
    if (frFull && !formFr.has(k)) formFr.set(k, frFull);
    if (frLabel && !formLabel.has(k)) formLabel.set(k, frLabel);
  }
}

/* ---------- 2. Données de l’application ---------- */
const source = fs.readFileSync(path.join(ROOT, 'data/data.js'), 'utf8');
const header = source.slice(0, source.indexOf('window.MC_DATA')).replace(/\/\*\*[\s\S]*?\*\/\s*/, '');
global.window = {};
// eslint-disable-next-line no-eval
eval(source);
const D = global.window.MC_DATA;

const stats = { moves: [0, 0], abilities: [0, 0], items: [0, 0], species: [0, 0], forms: [0, 0] };
const missing = { moves: [], abilities: [], items: [], species: [], forms: [] };

// Attaques : nom FR + description FR (dernier groupe de versions disponible)
const flavor = new Map();
for (const r of rows('move_flavor_text.csv')) {
  if (r.language_id !== FR) continue;
  const cur = flavor.get(r.move_id);
  if (!cur || Number(r.version_group_id) >= cur.vg) flavor.set(r.move_id, { vg: Number(r.version_group_id), text: r.flavor_text });
}
const moveIdByKey = new Map();
for (const r of rows('moves.csv')) moveIdByKey.set(norm(r.identifier), r.id);
for (const m of D.moves) {
  const key = norm(m.k);
  stats.moves[1]++;
  if (movesNames.fr.has(key)) { m.frName = movesNames.fr.get(key); stats.moves[0]++; } else missing.moves.push(m.n);
  const alias = (ALIAS.moves && ALIAS.moves[key]) || key;
  const f = flavor.get(moveIdByKey.get(key)) || flavor.get(moveIdByKey.get(norm(alias)));
  if (f) m.frText = f.text.replace(/[\n\f\r]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Talents
for (const a of D.abilities) {
  const key = norm(a.k);
  stats.abilities[1]++;
  if (abilityNames.fr.has(key)) { a.frName = abilityNames.fr.get(key); stats.abilities[0]++; }
  else if (MANUAL.abilities[key]) { a.frName = MANUAL.abilities[key].frName; a.frNameUnofficial = true; stats.abilities[0]++; }
  else missing.abilities.push(a.n);
}

// Objets
for (const it of D.items) {
  const key = norm(it.k);
  stats.items[1]++;
  if (itemNames.fr.has(key)) { it.frName = itemNames.fr.get(key); stats.items[0]++; } else missing.items.push(it.n);
}

// Pokémon : nom FR de l’espèce + nom FR de la forme
for (const v of D.buildables) {
  stats.species[1]++;
  // Clés candidates : nom anglais de base, slug d’espèce, nom complet de la variante
  const candidates = [norm(v.base), norm(v.speciesSlug), norm(v.name)].filter(Boolean);
  const found = candidates.map((k) => speciesFr.get(k)).find((x) => x && typeof x === 'string');
  if (found) { v.frSpecies = found; stats.species[0]++; }
  else { v.frSpecies = v.base || v.name; missing.species.push(v.name); }

  if (v.forme) {
    stats.forms[1]++;
    // Clés candidates : nom anglais complet (« charizardmegax »), espèce + forme (avec alias F → female…)
    const formSlug = String(v.forme).toLowerCase();
    const aliased = ALIAS.forms[formSlug] || formSlug;
    const keys = [
      norm(v.name),
      norm(v.base) + formSlug.replace(/[^a-z0-9]/g, ''),
      norm(v.base) + aliased,
      norm(v.speciesSlug) + aliased,
    ].filter(Boolean);
    const key = keys.find((k) => formFr.has(k));
    const manualForm = MANUAL.forms[v.key];
    if (manualForm) { v.frName = manualForm; v.frLabel = v.formeFr; stats.forms[0]++; }
    else if (key) { v.frName = formFr.get(key); v.frLabel = formLabel.get(key) || v.formeFr; stats.forms[0]++; }
    else if (/mega/i.test(v.forme)) {
      // Méga-Évolutions propres à Pokémon Champions : « Méga-X » composé en français
      let suffix = v.forme.replace(/^mega-?/i, '').replace(/-mega/i, '');
      suffix = { x: 'X', y: 'Y', z: 'Z', f: 'Femelle', m: 'Mâle' }[suffix.toLowerCase()] || suffix;
      v.frName = 'Méga-' + v.frSpecies + (suffix ? ' ' + suffix : '');
      v.frLabel = 'Méga-Évolution' + (suffix ? ' ' + suffix : '');
      stats.forms[0]++;
    } else {
      v.frName = `${v.frSpecies} (${v.formeFr})`;
      v.frLabel = v.formeFr;
      missing.forms.push(v.name);
    }
    v.frSpeciesFull = v.frName;
  } else {
    v.frName = v.frSpecies;
  }
}
// Formes femelles (« F ») encore sans libellé officiel
for (const v of D.buildables) if (v.forme === 'F' && !v.frLabel) v.frName = `${v.frSpecies} (femelle)`;

/* ---------- 3. Écriture ---------- */
const banner = `/**
 * TeamForge M-C — base de données du Règlement M-C (Pokémon Champions).
 * Générée par tools/build_data.mjs, enrichie par tools/fr_names.mjs
 * (noms français officiels issue de PokéAPI : https://pokeapi.co).
 * Les noms anglais (name / n) sont conservés pour l’export Pokémon Showdown.
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT.
 */
`;
const json = JSON.stringify(D);
fs.writeFileSync(path.join(ROOT, 'data/data.js'), banner + 'window.MC_DATA=' + json + ';\n');
// Copie JSON (lecture programmatique / réutilisation hors navigateur)
fs.writeFileSync(path.join(ROOT, 'data/data.json'), JSON.stringify(D, null, 0));
console.log('data/data.js et data/data.json régénérés (' + Math.round(json.length / 1024) + ' Ko)');

for (const [k, [ok, total]] of Object.entries(stats)) {
  const miss = missing[k];
  console.log(`${k.padEnd(10)} : ${ok}/${total} noms français${miss.length ? ' — sans traduction : ' + miss.slice(0, 8).join(', ') + (miss.length > 8 ? ` (+${miss.length - 8})` : '') : ''}`);
}
