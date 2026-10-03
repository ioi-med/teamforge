/**
 * ============================================================================
 * TeamForge M-C — noyau de l'application (données, calculs, règlement, formats)
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT (voir LICENSE)
 * ============================================================================
 * Ce module ne touche pas au DOM : il expose des utilitaires purs, testables,
 * utilisés par les modules `store.js`, `ui.js` et `main.js`.
 */
'use strict';

/* --------------------------------------------------------------------------
 * 1. Index du Pokédex M-C (construit une seule fois au chargement)
 * -------------------------------------------------------------------------- */
const DEX = (() => {
  const d = window.MC_DATA;
  if (!d) throw new Error('Données du règlement M-C absentes (build/data.js).');

  const byKey = new Map();
  const byDex = new Map();
  for (const v of d.buildables) {
    byKey.set(v.key, v);
    if (!byDex.has(v.dex)) byDex.set(v.dex, []);
    byDex.get(v.dex).push(v);
  }
  // Les variantes de base d'abord, les Méga-Évolutions ensuite
  for (const list of byDex.values()) list.sort((a, b) => (a.isMega ? 1 : 0) - (b.isMega ? 1 : 0) || a.name.localeCompare(b.name));

  const itemsByKey = new Map(d.items.map((i) => [i.k, i]));
  const itemsByName = new Map(d.items.map((i) => [normalizeId(i.n), i]));
  const movesByKey = new Map(d.moves.map((m, idx) => [m.k, Object.assign({ idx }, m)]));
  const movesByName = new Map(d.moves.map((m) => [normalizeId(m.n), m]));
  const abilitiesByKey = new Map(d.abilities.map((a) => [a.k, a]));
  const abilitiesByName = new Map(d.abilities.map((a) => [normalizeId(a.n), a]));

  // Séries de statistiques de base, indexées comme les EV/IV
  for (const v of d.buildables) {
    v.bs = { hp: v.stats[0], atk: v.stats[1], def: v.stats[2], spa: v.stats[3], spd: v.stats[4], spe: v.stats[5] };
    v.bst = v.stats.reduce((a, b) => a + b, 0);
  }

  return {
    raw: d,
    meta: d.meta,
    types: d.types,
    typeChart: d.typeChart,
    natures: d.natures,
    naturesByKey: new Map(d.natures.map((n) => [n.k, n])),
    variants: d.buildables,
    byKey,
    byDex,
    items: d.items,
    itemsByKey,
    itemsByName,
    moves: d.moves,
    movesByKey,
    movesByName,
    abilities: d.abilities,
    abilitiesByKey,
    abilitiesByName,
    learnsets: d.learnsets,
    version: '1.0',
  };
})();

/** Identifiant « Showdown-like » : minuscules, sans accent ni ponctuation. */
function normalizeId(str) {
  return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

/* --------------------------------------------------------------------------
 * 1 bis. Français d’abord : l’interface n’affiche que des noms français,
 * sauf l’export Pokémon Showdown, qui exige les noms anglais officiels
 * (les données conservent donc `name`/`n` en anglais et `frName` en français).
 * -------------------------------------------------------------------------- */
/** Nom d’une variante en français (« Méga-Dracaufeu X », « Raichu d’Alola »…). */
const frMon = (v) => (v && (v.frName || v.frSpeciesFull || v.frSpecies || v.name)) || '—';
/** Nom d’un objet en français (« Restes », « Orbe Vie »…). */
const frItem = (i) => (i && (i.frName || i.n)) || '';
/** Nom d’une attaque en français (« Séisme », « Poing de Colère »…). */
const frMove = (m) => (m && (m.frName || m.n)) || '';
/** Nom d’un talent (objet PokéAPI ou nom anglais stocké dans un set). */
const frAbility = (a) => {
  if (!a) return '';
  if (typeof a === 'string') {
    const ab = DEX.abilitiesByName.get(normalizeId(a));
    return (ab && (ab.frName || ab.n)) || a;
  }
  return a.frName || a.n || '';
};
/** Description française d’une attaque (repli sur l’anglais). */
const frMoveText = (m) => (m && (m.frText || m.d)) || '';
/** Description française d’un objet / talent. */
const frItemText = (o) => (o && (o.fr || o.frText || o.d)) || '';
/** Nom français d’un type (les clés internes restent en anglais). */
const frTypeName = (t) => (DEX.types && DEX.types[t]) || t;

/** Détecte un identifiant à partir d'un texte saisi par l'utilisateur (français ou anglais). */
function resolveType(value) {
  if (!value) return null;
  const id = normalizeId(value);
  for (const en of Object.keys(DEX.types)) if (normalizeId(en) === id || normalizeId(DEX.types[en]) === id) return en;
  return null;
}

/* Index inverses : retrouver une entité depuis son nom français (import, saisie). */
const FR = (() => {
  const items = new Map();
  for (const it of DEX.items) items.set(normalizeId(it.frName || it.n), it);
  const moves = new Map();
  for (const m of DEX.moves) moves.set(normalizeId(m.frName || m.n), m);
  const abilities = new Map();
  for (const a of DEX.abilities) abilities.set(normalizeId(a.frName || a.n), a);
  const variants = new Map();
  for (const v of DEX.variants) {
    if (v.frName) variants.set(normalizeId(v.frName), v);
    if (v.frSpecies && !variants.has(normalizeId(v.frSpecies))) variants.set(normalizeId(v.frSpecies), v);
  }
  return { items, moves, abilities, variants };
})();

const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const STAT_ABBR = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const STAT_FR = { hp: 'PV', atk: 'Attaque', def: 'Défense', spa: 'Att. Spé.', spd: 'Déf. Spé.', spe: 'Vitesse' };
/** Abréviations françaises pour l’affichage compact (l’export Showdown utilise STAT_ABBR, en anglais). */
const STAT_FR_SHORT = { hp: 'PV', atk: 'Att', def: 'Déf', spa: 'Att.Sp', spd: 'Déf.Sp', spe: 'Vit' };
const STAT_ALIASES = {
  hp: 'hp', pv: 'hp',
  atk: 'atk', att: 'atk', attaque: 'atk', attack: 'atk', attaque_: 'atk',
  def: 'def', defense: 'def', defense: 'def', defense_: 'def', defense: 'def',
  spa: 'spa', spatk: 'spa', attspe: 'spa', specialattack: 'spa', attaquespeciale: 'spa', atkspe: 'spa',
  spd: 'spd', spdef: 'spd', defspe: 'spd', specialdefense: 'spd', defensespeciale: 'spd', defspe_: 'spd',
  spe: 'spe', speed: 'spe', vit: 'spe', vitesse: 'spe',
};
const TYPE_COLORS = {
  Normal: '#a8a77a', Fire: '#ee8130', Water: '#6390f0', Electric: '#f7d02c', Grass: '#7ac74c', Ice: '#96d9d6',
  Fighting: '#c22e28', Poison: '#a33ea1', Ground: '#e2bf65', Flying: '#a98ff3', Psychic: '#f95587', Bug: '#a6b91a',
  Rock: '#b6a136', Ghost: '#735797', Dragon: '#6f35fc', Dark: '#705746', Steel: '#b7b7ce', Fairy: '#d685ad',
  Stellar: '#5ad1c8',
};
const CATEGORY_FR = { Physical: 'Physique', Special: 'Spéciale', Status: 'Statut' };
const CATEGORY_COLOR = { Physical: '#f97362', Special: '#5fa8f5', Status: '#9aa4b2' };

/* --------------------------------------------------------------------------
 * 2. Aides d'affichage (noms, sprites, efficacités)
 * -------------------------------------------------------------------------- */

/** Nom complet lisible en français : « Méga-Dracaufeu X », « Raichu d’Alola ».
 *  Le nom anglais reste accessible via `variant.name` (export Showdown). */
function displayName(variant) {
  return frMon(variant);
}

/** Variante « de base » d'une famille (pour l'affichage et les sprites). */
function baseVariantOf(variant) {
  const family = DEX.byDex.get(variant.dex) || [variant];
  return family.find((v) => !v.isMega && !v.forme) || family[0] || variant;
}

/** URL du sprite (dossier gen5, repli sur l'animé puis sur la forme de base). */
function spriteUrl(variant, back) {
  if (!variant) return '';
  const dir = back ? 'gen5-back' : 'gen5';
  const name = variant.spk === 'ani' ? variant.sprite + '.gif' : variant.sprite + '.png';
  const folder = variant.spk === 'ani' ? 'ani' : dir;
  if (variant.spk === 'base') return `https://play.pokemonshowdown.com/sprites/${dir}/${variant.spriteBase}.png`;
  return `https://play.pokemonshowdown.com/sprites/${folder}/${name}`;
}

/**
 * Multiplicateur défensif d'une liste de types face à un type attaquant.
 * Ex. types ['Fire','Flying'] face à 'Rock' -> 4 (x4)
 */
function defensiveMultiplier(types, attackType) {
  let mult = 1;
  for (const t of types) {
    const row = DEX.typeChart[attackType] || {};
    if (row[t] !== undefined) mult *= row[t];
  }
  return mult;
}

/* --------------------------------------------------------------------------
 * 3. Statistiques : calcul officiel niveau 50 (et niveaux 1-100)
 * -------------------------------------------------------------------------- */
/**
 * PV : floor((2·Base + IV + floor(EV/4)) · Niveau / 100) + Niveau + 10
 * Autres : floor((floor((2·Base + IV + floor(EV/4)) · Niveau / 100) + 5) · Nature)
 * Aucun EV > 252, total ≤ 510 (contrôlé par validateSet).
 */
function computeStat(statKey, base, iv = 31, ev = 0, natureKey = 'hardy', level = 50) {
  const seed = 2 * base + iv + Math.floor(ev / 4);
  if (statKey === 'hp') return Math.floor((seed * level) / 100) + level + 10;
  const nature = DEX.naturesByKey.get(natureKey) || DEX.naturesByKey.get('hardy');
  let mod = 1;
  if (nature && nature.plus === statKey) mod = 1.1;
  else if (nature && nature.minus === statKey) mod = 0.9;
  const raw = Math.floor((seed * level) / 100) + 5;
  return Math.floor(raw * mod);
}

/** Statistiques finales d'un set (Pokémon) : {hp,atk,...} au niveau voulu. */
function computeStats(set) {
  const variant = DEX.byKey.get(set.key);
  if (!variant) return null;
  const out = {};
  for (const k of STAT_KEYS) out[k] = computeStat(k, variant.bs[k], set.ivs[k], set.evs[k], set.nature, set.level || 50);
  return out;
}

/** Total d'EVs investis + contrôle des limites réglementaires. */
function evSummary(set) {
  const total = STAT_KEYS.reduce((sum, k) => sum + (set.evs[k] || 0), 0);
  const overStat = STAT_KEYS.filter((k) => (set.evs[k] || 0) > 252);
  return { total, remaining: 510 - total, overStat, overTotal: total > 510 };
}

/* --------------------------------------------------------------------------
 * 4. Sets et équipes : usine + validation « Règlement M-C »
 * -------------------------------------------------------------------------- */
const DEFAULT_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
const DEFAULT_IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

/** Crée un set vierge pour une espèce donnée (nature et EVs par défaut pertinents). */
function createSet(variantKey, preset) {
  const variant = DEX.byKey.get(variantKey);
  if (!variant) return null;
  const set = {
    key: variantKey,
    nickname: '',
    item: null,
    ability: variant.abilities[0] || '',
    nature: 'hardy',
    level: 50,
    tera: null,
    evs: Object.assign({}, DEFAULT_EVS),
    ivs: Object.assign({}, DEFAULT_IVS),
    moves: ['', '', '', ''],
  };
  if (preset !== false) applySuggestedSpread(set);
  return set;
}

/** Répartition EV/nature proposée selon le profil offensif de l'espèce. */
function applySuggestedSpread(set) {
  const v = DEX.byKey.get(set.key);
  if (!v) return;
  const physical = v.bs.atk >= v.bs.spa;
  const fast = v.bs.spe >= 80;
  set.nature = physical ? (fast ? 'jolly' : 'adamant') : (fast ? 'timid' : 'modest');
  set.evs = Object.assign({}, DEFAULT_EVS);
  if (fast) {
    set.evs.spe = 252;
    set.evs[physical ? 'atk' : 'spa'] = 252;
    set.evs.hp = 4;
  } else {
    set.evs.hp = 252;
    set.evs[physical ? 'atk' : 'spa'] = 252;
    set.evs.spe = 4;
  }
}

/** Vérifie un Pokémon isolé : EVs, IVs, attaques, objet, talent. */
function validateSet(set) {
  const issues = [];
  const v = DEX.byKey.get(set.key);
  if (!v) {
    issues.push({ level: 'error', text: 'Espèce absente du règlement M-C.' });
    return issues;
  }
  const ev = evSummary(set);
  if (ev.overTotal) issues.push({ level: 'error', text: `Total d’EVs dépassé (${ev.total}/510).` });
  if (ev.overStat.length) issues.push({ level: 'error', text: `Plus de 252 EVs sur : ${ev.overStat.map((k) => STAT_FR[k]).join(', ')}.` });
  for (const k of STAT_KEYS) {
    if (set.ivs[k] < 0 || set.ivs[k] > 31) issues.push({ level: 'error', text: `IV ${STAT_ABBR[k]} hors limites (0-31).` });
    if (set.evs[k] < 0) issues.push({ level: 'error', text: `EV ${STAT_ABBR[k]} négatif.` });
  }
  if (set.item && !DEX.itemsByKey.has(set.item)) issues.push({ level: 'error', text: 'Objet non autorisé par le règlement M-C.' });
  if (set.ability && !v.abilities.some((a) => normalizeId(a) === normalizeId(set.ability))) {
    issues.push({ level: 'error', text: `${set.ability} n’est pas un talent possible pour cette forme.` });
  }
  const moves = set.moves.filter(Boolean);
  if (moves.length > 4) issues.push({ level: 'error', text: 'Plus de 4 attaques.' });
  const learn = new Set(learnsetOf(v, true).map((m) => m.k));
  for (const m of moves) {
    if (!DEX.movesByKey.has(m)) issues.push({ level: 'error', text: 'Attaque inconnue.' });
    else if (!learn.has(m)) issues.push({ level: 'warning', text: `${frMove(DEX.movesByKey.get(m))} n’est pas apprise par cette forme.` });
  }
  if (!moves.length) issues.push({ level: 'warning', text: 'Aucune attaque sélectionnée.' });
  if (set.level !== 50) issues.push({ level: 'warning', text: 'En VGC, le niveau est ramené à 50.' });
  if (v.requiredItem && set.item !== v.requiredItem) {
    issues.push({ level: 'error', text: `${frMon(v)} doit tenir ${frItem(DEX.itemsByKey.get(v.requiredItem)) || v.requiredItem} pour Méga-Évoluer.` });
  }
  return issues;
}

/** Vérifie l'équipe entière et renvoie un rapport lisible (clauses Espèce/Objet, Méga…). */
function validateTeam(sets) {
  const report = { errors: [], warnings: [], infos: [], ok: true };
  const filled = sets.filter(Boolean);
  if (!filled.length) {
    report.warnings.push('Équipe vide : ajoutez au moins un Pokémon.');
    report.ok = false;
    return report;
  }
  if (filled.length > 6) report.errors.push('Une équipe compte 6 Pokémon au maximum.');

  // Species Clause : un seul Pokémon par numéro de Pokédex national
  const seenDex = new Map();
  for (const s of filled) {
    const v = DEX.byKey.get(s.key);
    if (!v) continue;
    if (seenDex.has(v.dex)) {
      report.errors.push(`Clause Espèce (Species Clause) : ${frMon(v)} et ${frMon(DEX.byKey.get(seenDex.get(v.dex)))} partagent le n° ${v.dex}.`);
    } else seenDex.set(v.dex, s.key);
  }
  // Item Clause
  const seenItem = new Map();
  for (const s of filled) {
    if (!s.item) continue;
    if (seenItem.has(s.item)) {
      report.errors.push(`Clause Objet (Item Clause) : ${frItem(DEX.itemsByKey.get(s.item))} est tenu par deux Pokémon.`);
    } else seenItem.set(s.item, s.key);
  }
  // Une seule Méga-Évolution par combat
  const megas = filled.filter((s) => DEX.byKey.get(s.key)?.isMega);
  if (megas.length > 1) {
    report.warnings.push(`Une seule Méga-Évolution est possible par combat (${megas.length} pierres équipées).`);
  }
  // Contrôles individuels
  filled.forEach((s, i) => {
    for (const iss of validateSet(s)) {
      const target = iss.level === 'error' ? report.errors : report.warnings;
      target.push(`${displayName(DEX.byKey.get(s.key))} — ${iss.text}`);
    }
  });
  report.ok = report.errors.length === 0;
  report.infos.push(`${filled.length}/6 Pokémon · ${new Set(filled.map((s) => DEX.byKey.get(s.key)?.dex)).size} espèces distinctes`);
  const evTotal = filled.reduce((sum, s) => sum + evSummary(s).total, 0);
  report.infos.push(`EVs investis : ${evTotal}`);
  return report;
}

/* --------------------------------------------------------------------------
 * 5. Attaques disponibles par Pokémon
 * -------------------------------------------------------------------------- */
/** Liste des attaques d'une variante (les variantes Méga héritent de l'espèce de base). */
function learnsetOf(variant, includeLegacy = false) {
  const raw = DEX.learnsets[variant.ls] || '';
  const out = [];
  for (const token of raw.split(',')) {
    if (!token) continue;
    const n = parseInt(token, 10);
    if (Number.isNaN(n)) continue;
    const legacy = n < 0;                       // valeur négative = attaque héritée (hors jeux actuels)
    if (legacy && !includeLegacy) continue;
    const move = DEX.moves[legacy ? -n - 1 : n];
    if (move) out.push(move);
  }
  // Tri : puissance décroissante puis nom
  return out.sort((a, b) => b.b - a.b || a.n.localeCompare(b.n));
}

/** Recherche floue simple pour les autocomplétions. */
function fuzzyScore(haystack, needle) {
  const h = normalizeId(haystack);
  const n = normalizeId(needle);
  if (!n) return 1;
  if (h === n) return 1000;
  if (h.startsWith(n)) return 500 - h.length;
  const idx = h.indexOf(n);
  if (idx >= 0) return 250 - idx - h.length * 0.1;
  // sous-séquence
  let i = 0;
  for (const ch of h) if (ch === n[i]) i++;
  return i === n.length ? 40 - h.length * 0.1 : -1;
}

/* --------------------------------------------------------------------------
 * 6. Format Pokémon Showdown : export
 * -------------------------------------------------------------------------- */
/** Convertit un talent saisi en français ou en anglais vers le nom anglais du set. */
function resolveAbilityName(variant, value) {
  if (!variant || !value) return '';
  const id = normalizeId(value);
  const pool = variant.abilities || [];
  const direct = pool.find((a) => normalizeId(a) === id);
  if (direct) return direct;
  const ab = FR.abilities.get(id) || DEX.abilities.find((a) => normalizeId(a.n) === id);
  if (ab) {
    const hit = pool.find((a) => normalizeId(a) === normalizeId(ab.n));
    if (hit) return hit;
  }
  return '';
}

const NATURE_EN = (key) => (DEX.naturesByKey.get(key) || { n: 'Hardy' }).n;

/** Sérialise un set au format texte standard Pokémon Showdown. */
function exportSet(set, opts = {}) {
  const v = DEX.byKey.get(set.key);
  if (!v) return '';
  const alwaysIvs = opts.alwaysIvs !== false;
  const lines = [];
  const item = set.item ? DEX.itemsByKey.get(set.item) : null;
  const head = set.nickname && normalizeId(set.nickname) !== normalizeId(v.name) ? `${set.nickname} (${v.name})` : v.name;
  lines.push(item ? `${head} @ ${item.n}` : head);
  if (set.ability) lines.push(`Ability: ${set.ability}`);
  lines.push(`Level: ${set.level || 50}`);
  if (set.tera) lines.push(`Tera Type: ${set.tera}`);
  const evs = STAT_KEYS.filter((k) => set.evs[k] > 0).map((k) => `${set.evs[k]} ${STAT_ABBR[k]}`);
  if (evs.length) lines.push(`EVs: ${evs.join(' / ')}`);
  lines.push(`${NATURE_EN(set.nature)} Nature`);
  const ivsToShow = alwaysIvs ? STAT_KEYS : STAT_KEYS.filter((k) => set.ivs[k] !== 31);
  if (ivsToShow.length) lines.push(`IVs: ${ivsToShow.map((k) => `${set.ivs[k]} ${STAT_ABBR[k]}`).join(' / ')}`);
  const moves = set.moves.filter(Boolean);
  if (moves.length) lines.push(moves.map((m) => `- ${DEX.movesByKey.get(m)?.n || m}`).join('\n'));
  return lines.join('\n');
}

/** Export complet de l'équipe (blocs séparés par une ligne vide). */
function exportTeam(sets, opts) {
  return sets.filter(Boolean).map((s) => exportSet(s, opts)).filter(Boolean).join('\n\n');
}

/* --------------------------------------------------------------------------
 * 7. Format Pokémon Showdown : import (tolérant)
 * -------------------------------------------------------------------------- */
/** Trouve une variante par nom : gère anglais, français, formes et Méga-Évolutions. */
function findVariantByName(name) {
  const id = normalizeId(name);
  if (!id) return null;
  // 1. noms anglais exacts (export/import Pokémon Showdown)
  let found = DEX.variants.find((v) => normalizeId(v.name) === id);
  if (found) return found;
  // 2. noms français (« Dracaufeu », « Méga-Dracaufeu X », « Raichu d’Alola »…)
  found = FR.variants.get(id);
  if (found) return found;
  // « Absol-Mega » sans préciser X/Y/Z -> première Méga disponible
  found = DEX.variants.find((v) => normalizeId(v.name).startsWith(id) && v.isMega);
  if (found) return found;
  found = DEX.variants.find((v) => normalizeId(v.base || v.name) === id && !v.isMega);
  if (found) return found;
  found = DEX.variants.find((v) => normalizeId(v.name).startsWith(id));
  return found || null;
}

function findItemByName(name) {
  const id = normalizeId(name);
  return DEX.itemsByName.get(id) || FR.items.get(id) || null;
}

/** Retrouve une attaque par son nom anglais ou français. */
function findMoveByName(name) {
  const id = normalizeId(name);
  return DEX.movesByName.get(id) || FR.moves.get(id) || null;
}

/**
 * Analyse un texte au format Showdown et renvoie des sets exploitables.
 * → { sets, errors, warnings }
 */
function parseShowdown(text) {
  const sets = [];
  const errors = [];
  const warnings = [];
  const blocks = String(text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n+/);

  for (const rawBlock of blocks) {
    const lines = rawBlock.split('\n').map((l) => l.trim()).filter((l) => l.length);
    if (!lines.length) continue;
    // Ignore les commentaires Showdown commençant par //
    const filtered = lines.filter((l) => !l.startsWith('//'));
    if (!filtered.length) continue;

    let header = filtered[0];
    let itemName = null;
    const at = header.lastIndexOf(' @ ');
    if (at > -1) { itemName = header.slice(at + 3).trim(); header = header.slice(0, at).trim(); }

    const set = {
      key: null, nickname: '', item: null, ability: '', nature: 'hardy', level: 50, tera: null,
      evs: Object.assign({}, DEFAULT_EVS), ivs: Object.assign({}, DEFAULT_IVS), moves: ['', '', '', ''],
    };

    // « Surnom (Espèce) » — mais attention aux suffixes de genre (M)/(F)
    let speciesName = header;
    const nick = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(header);
    if (nick && !/^[MF]$/i.test(nick[2].trim()) && !/^\d+$/.test(nick[2].trim())) {
      set.nickname = nick[1].trim();
      speciesName = nick[2].trim();
    }
    const variant = findVariantByName(speciesName);
    if (!variant) {
      errors.push(`« ${speciesName} » n’est pas autorisé par le règlement M-C.`);
      continue;
    }
    set.key = variant.key;

    for (const line of filtered.slice(1)) {
      let m;
      // Les mots-clés anglais (format Showdown) et français (exports traduits) sont acceptés
      if ((m = /^(?:Ability|Talent|Capacité spéciale)\s*[:：]\s*(.+)$/i.exec(line))) set.ability = m[1].trim();
      else if ((m = /^(?:Level|Niveau)\s*[:：]?\s*(\d+)/i.exec(line))) set.level = Math.max(1, Math.min(100, parseInt(m[1], 10)));
      else if ((m = /^(?:Tera Type|Teratype|Type Téra|Type Tera|Téra|Tera)\s*[:：]?\s*(.+)$/i.exec(line))) set.tera = resolveType(m[1]);
      else if ((m = /^(?:EVs?|Points? d[’']entra[iî]nement)\s*[:：]\s*(.+)$/i.exec(line))) parseStatLine(m[1], set.evs, true, errors);
      else if ((m = /^(?:IVs?|Valeurs? individuelles?)\s*[:：]\s*(.+)$/i.exec(line))) parseStatLine(m[1], set.ivs, false, errors);
      else if ((m = /^(Shiny|Happiness|Hidden Power|Gigantamax|Dynamax Level|Pokeball|Ball|Chromatique|Bonheur|Ball):/i.exec(line))) { /* ignoré */ }
      else if ((m = /^Nature\s*[:：]?\s*(.+)$/i.exec(line)) || (m = /^([A-Za-z\u00c0-\u017f' -]+)\s+Nature$/i.exec(line))) {
        const nat = DEX.natures.find((n) => normalizeId(n.n) === normalizeId(m[1]) || normalizeId(n.fr) === normalizeId(m[1]));
        if (nat) set.nature = nat.k;
        else warnings.push(`Nature inconnue « ${m[1]} » — Hardy appliquée.`);
      } else if ((m = /^[-+*•]\s*(.+)$/.exec(line))) {
        const move = findMoveByName(m[1]);
        if (!move) warnings.push(`Attaque inconnue « ${m[1]} » ignorée.`);
        else if (set.moves.filter(Boolean).length < 4) set.moves[set.moves.filter(Boolean).length] = move.k;
        else warnings.push(`Plus de 4 attaques pour ${speciesName} — « ${m[1]} » ignorée.`);
      }
    }

    // Objet (et bascule automatique vers la Méga-Évolution correspondante)
    if (itemName) {
      const item = findItemByName(itemName);
      if (!item) warnings.push(`Objet « ${itemName} » non autorisé — ignoré.`);
      else {
        set.item = item.k;
        if (item.stone && item.megas && item.megas.length) {
          // Une pierre Méga implique la forme Méga correspondante
          const familyIds = [variant.key, normalizeId(variant.base || ''), variant.speciesKey];
          const stone = item.megas.find((mg) => familyIds.includes(mg.from)) || item.megas[0];
          if (DEX.byKey.has(stone.to)) set.key = stone.to;
        }
      }
    } else if (set.key && DEX.byKey.get(set.key).requiredItem) {
      set.item = DEX.byKey.get(set.key).requiredItem;
    }

    // Talents : accepte le français ou l’anglais, sinon repli sur le premier talent légal
    const finalVariant = DEX.byKey.get(set.key);
    const abilityEn = resolveAbilityName(finalVariant, set.ability);
    if (!abilityEn) {
      if (set.ability) warnings.push(`Talent « ${set.ability} » non valide pour ${frMon(finalVariant)} — remplacé.`);
      set.ability = finalVariant.abilities[0] || '';
    } else set.ability = abilityEn;
    // Vérification des attaques vs learnset (les attaques hors pool SV sont acceptées avec avertissement)
    const legal = new Set(learnsetOf(finalVariant, false).map((mv) => mv.k));
    const legacy = new Set(learnsetOf(finalVariant, true).map((mv) => mv.k));
    for (const mv of set.moves.filter(Boolean)) {
      if (!legal.has(mv) && legacy.has(mv)) warnings.push(`${frMove(DEX.movesByKey.get(mv))} n’est pas disponible dans les jeux actuels (héritage).`);
      else if (!legacy.has(mv)) warnings.push(`${frMove(DEX.movesByKey.get(mv))} n’est pas apprise par ${frMon(finalVariant)}.`);
    }
    const ev = evSummary(set);
    if (ev.overTotal) warnings.push(`${frMon(finalVariant)} : total d’EVs ramené de ${ev.total} à 510.`);
    if (ev.overTotal || ev.overStat.length) clampEvs(set);
    sets.push(set);
  }
  return { sets, errors, warnings };
}

/** Analyse « 252 HP / 4 Atk / 252 Spe » ou « 252 PV / 4 Att. / 252 Vit. ». */
function parseStatLine(str, target, isEv, errors) {
  for (const chunk of str.split('/')) {
    const m = /(\d+)\s*([^\d]+)/.exec(chunk.trim());
    if (!m) continue;
    const key = STAT_ALIASES[normalizeId(m[2])] || null;
    if (!key) { errors.push(`Statistique « ${m[2]} » inconnue.`); continue; }
    const value = parseInt(m[1], 10);
    target[key] = isEv ? Math.max(0, Math.min(252, value)) : Math.max(0, Math.min(31, value));
  }
}

/** Ramène les EVs dans les limites (510 au total, 252 par stat) en préservant les priorités. */
function clampEvs(set) {
  const order = ['hp', 'spe', 'atk', 'spa', 'def', 'spd'];
  for (const k of STAT_KEYS) set.evs[k] = Math.max(0, Math.min(252, set.evs[k] | 0));
  let total = STAT_KEYS.reduce((s, k) => s + set.evs[k], 0);
  while (total > 510) {
    const k = order.find((x) => set.evs[x] > 0);
    if (!k) break;
    const remove = Math.min(set.evs[k], total - 510);
    set.evs[k] -= remove;
    total -= remove;
  }
  return set;
}

/* --------------------------------------------------------------------------
 * 8. Analyse d'équipe (synergie défensive, vitesse, rôles)
 * -------------------------------------------------------------------------- */
function analyzeTeam(sets) {
  const filled = sets.filter(Boolean);
  const perType = {};
  for (const t of Object.keys(DEX.types)) perType[t] = { weak: 0, resist: 0, immune: 0 };
  let speedTotal = 0;
  const speeds = [];
  for (const s of filled) {
    const v = DEX.byKey.get(s.key);
    if (!v) continue;
    const st = computeStats(s);
    speeds.push({ name: displayName(v), spe: st.spe, sprite: spriteUrl(v) });
    speedTotal += st.spe;
    for (const t of Object.keys(DEX.types)) {
      const mult = defensiveMultiplier(v.types, t);
      if (mult === 0) perType[t].immune++;
      else if (mult > 1) perType[t].weak++;
      else if (mult < 1) perType[t].resist++;
    }
  }
  speeds.sort((a, b) => b.spe - a.spe);
  return {
    count: filled.length,
    perType,
    speeds,
    avgSpeed: filled.length ? Math.round(speedTotal / filled.length) : 0,
    megas: filled.filter((s) => DEX.byKey.get(s.key)?.isMega).length,
    physical: filled.filter((s) => {
      const v = DEX.byKey.get(s.key); return v && v.bs.atk > v.bs.spa;
    }).length,
  };
}
