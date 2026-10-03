/**
 * ============================================================================
 * TeamForge M-C — stockage local, comptes et conformité RGPD
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT (voir LICENSE)
 * ============================================================================
 * Toute la persistance passe par localStorage (jamais de réseau).
 *  - Aucun mot de passe en clair : dérivation PBKDF2-SHA256 (150 000 itérations + sel).
 *  - Si l'utilisateur refuse le consentement, l'application bascule en mémoire
 *    volatile : rien n'est écrit sur le disque.
 */
'use strict';

const Store = (() => {
  const PREFIX = 'mcb.';
  const K = {
    consent: PREFIX + 'consent',
    accounts: PREFIX + 'accounts',
    session: PREFIX + 'session',
    prefs: PREFIX + 'prefs',
    guest: PREFIX + 'guest',
    data: (userId) => PREFIX + 'data.' + userId,
  };
  const PBKDF2_ITERATIONS = 150000;

  // Mode volatil : tant que le consentement n'est pas donné (ou s'il est refusé),
  // aucune écriture n'est effectuée dans localStorage — tout reste en mémoire.
  const memory = new Map();

  const available = (() => {
    try {
      const k = PREFIX + 'test';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch { return false; }
  })();

  const rawGet = (key) => {
    try { return available ? localStorage.getItem(key) : null; } catch { return null; }
  };
  /** Consentement déjà enregistré (lecture directe, avant l'établissement du mode de stockage). */
  const savedConsent = (() => {
    try { const raw = rawGet(K.consent); return raw ? JSON.parse(raw) : null; } catch { return null; }
  })();
  let persistent = savedConsent ? savedConsent.choice === 'accept' : false;

  function read(key, fallback) {
    try {
      const raw = rawGet(key);
      const value = raw != null ? raw : memory.get(key);
      return value ? JSON.parse(value) : fallback;
    } catch { return fallback; }
  }
  function write(key, value) {
    const raw = JSON.stringify(value);
    if (persistent && available) {
      try { localStorage.setItem(key, raw); return; } catch (e) { console.warn('Stockage local indisponible', e); }
    }
    memory.set(key, raw);
  }
  /** Verse en une fois les données accumulées en mémoire dans localStorage (à l'acceptation). */
  function flushMemory() {
    if (!available) return;
    for (const [key, raw] of Array.from(memory.entries())) {
      try { localStorage.setItem(key, raw); memory.delete(key); } catch {}
    }
  }
  function remove(key) {
    if (available) { try { localStorage.removeItem(key); } catch {} }
    memory.delete(key);
  }
  function keys() {
    const out = [];
    if (available) { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out.push(k); } } catch {} }
    for (const k of memory.keys()) if (!out.includes(k)) out.push(k);
    return out;
  }

  /* ---------------- Cryptographie : dérivation du mot de passe ---------------- */
  const hex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const unhex = (str) => new Uint8Array((str.match(/.{2}/g) || []).map((h) => parseInt(h, 16)));
  const randomSalt = () => {
    const b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256)));
    return hex(b);
  };
  /** PBKDF2-SHA256 ; repli dégradé (FNV-1a itéré) si WebCrypto absent. */
  async function derivePassword(password, salt, iterations = PBKDF2_ITERATIONS) {
    const subtle = window.crypto && window.crypto.subtle;
    if (subtle) {
      const enc = new TextEncoder();
      const key = await subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
      const bits = await subtle.deriveBits({ name: 'PBKDF2', salt: unhex(salt), iterations, hash: 'SHA-256' }, key, 256);
      return 'pbkdf2$' + iterations + '$' + hex(new Uint8Array(bits));
    }
    let h = 0x811c9dc5;
    const input = salt + password;
    for (let round = 0; round < 20000; round++) {
      for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i) + round; h = Math.imul(h, 16777619) >>> 0; }
    }
    return 'fallback$' + h.toString(16);
  }
  async function verifyPassword(password, account) {
    const attempt = await derivePassword(password, account.salt, account.iterations);
    return attempt === account.hash;
  }

  /* ---------------- Consentement RGPD ---------------- */
  const consent = {
    get() { return read(K.consent, null); },
    /**
     * Enregistre le choix de l'utilisateur.
     *  • « accept »  → stockage local activé, et les données déjà saisies sont versées sur le disque.
     *  • « decline » → tout reste en mémoire volatile, rien n'est écrit.
     */
    set(choice) {
      const value = { version: 1, choice, date: new Date().toISOString() };
      persistent = choice === 'accept';
      if (persistent) { write(K.consent, value); flushMemory(); }
      else memory.set(K.consent, JSON.stringify(value));
      return value;
    },
    get decided() { return !!read(K.consent, null); },
    /** Révoque (ou redonne) le consentement depuis les paramètres. */
    clear() { remove(K.consent); memory.delete(K.consent); persistent = false; },
  };

  /* ---------------- Comptes (100 % locaux) ---------------- */
  const accounts = {
    list() { return read(K.accounts, []); },
    findByLogin(login) {
      const id = normalizeId(login);
      return accounts.list().find((a) => a.loginId === id);
    },
    async create({ login, password, pseudo }) {
      const list = accounts.list();
      const loginId = normalizeId(login);
      if (!loginId) throw new Error('Identifiant requis.');
      if (accounts.findByLogin(login)) throw new Error('Un compte local utilise déjà cet identifiant.');
      if (!password || password.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
      const salt = randomSalt();
      const hash = await derivePassword(password, salt);
      const account = {
        id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        login, loginId, pseudo: (pseudo || login).slice(0, 20), salt, hash,
        iterations: PBKDF2_ITERATIONS, createdAt: new Date().toISOString(),
      };
      list.push(account);
      write(K.accounts, list);
      return account;
    },
    async authenticate(login, password) {
      const account = accounts.findByLogin(login);
      if (!account) throw new Error('Aucun compte local ne correspond à cet identifiant.');
      if (!(await verifyPassword(password, account))) throw new Error('Mot de passe incorrect.');
      return account;
    },
    update(account) {
      const list = accounts.list().map((a) => (a.id === account.id ? account : a));
      write(K.accounts, list);
    },
    remove(id) {
      write(K.accounts, accounts.list().filter((a) => a.id !== id));
      remove(K.data(id));
      if (session.get() === id) remove(K.session);
    },
  };

  /* ---------------- Session ---------------- */
  const session = {
    get() { return read(K.session, null); },
    set(userId) { write(K.session, userId); },
    clear() { remove(K.session); },
    user() {
      const id = session.get();
      return id ? accounts.list().find((a) => a.id === id) || null : null;
    },
  };

  /* ---------------- Équipes ---------------- */
  const emptySetSlots = () => [null, null, null, null, null, null];
  function newTeam(name) {
    return {
      id: 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || 'Nouvelle équipe',
      format: 'M-C',
      sets: emptySetSlots(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  const sanitizeTeam = (t) => (t && t.sets ? t : newTeam());

  const teams = {
    /** Équipes de l'utilisateur connecté, ou l'unique équipe invitée. */
    list() {
      const user = session.user();
      if (!user) {
        const guest = sanitizeTeam(read(K.guest, newTeam('Équipe invité')));
        return [guest];
      }
      const data = read(K.data(user.id), { teams: [] });
      if (!data.teams || !data.teams.length) {
        data.teams = [newTeam('Mon équipe M-C')];
        write(K.data(user.id), data);   // l'équipe par défaut est immédiatement persistée
      }
      return data.teams;
    },
    save(team) {
      team.updatedAt = new Date().toISOString();
      const user = session.user();
      if (!user) { write(K.guest, team); return team; }
      const data = read(K.data(user.id), { teams: [] });
      const idx = data.teams.findIndex((t) => t.id === team.id);
      if (idx >= 0) data.teams[idx] = team; else data.teams.push(team);
      write(K.data(user.id), data);
      return team;
    },
    remove(teamId) {
      const user = session.user();
      if (!user) { write(K.guest, newTeam('Équipe invité')); return; }
      const data = read(K.data(user.id), { teams: [] });
      data.teams = data.teams.filter((t) => t.id !== teamId);
      write(K.data(user.id), data);
    },
    get(teamId) {
      return teams.list().find((t) => t.id === teamId) || null;
    },
  };

  /* ---------------- Préférences ---------------- */
  const prefs = {
    get() { return read(K.prefs, { view: 'team', lastTeam: null, alwaysIvs: true, showLegacy: false }); },
    set(patch) { const p = Object.assign(prefs.get(), patch); write(K.prefs, p); return p; },
  };

  /* ---------------- RGPD : portabilité & effacement ---------------- */
  function exportAll() {
    const user = session.user();
    return {
      application: 'TeamForge M-C',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      rgpd: 'Export de portabilité — données stockées uniquement dans ce navigateur.',
      consent: consent.get(),
      account: user ? {
        login: user.login, pseudo: user.pseudo, createdAt: user.createdAt,
        passwordHash: user.hash, salt: user.salt, iterations: user.iterations,
      } : null,
      teams: teams.list(),
      prefs: prefs.get(),
    };
  }
  /** Efface l'intégralité des données de l'application (compte, équipes, préférences). */
  async function wipeAll() {
    const removed = keys();
    for (const key of removed) remove(key);
    memory.clear();
    try {
      const dbs = (indexedDB && indexedDB.databases) ? await indexedDB.databases() : [];
      for (const db of dbs) if (db.name && db.name.startsWith('teamforge')) indexedDB.deleteDatabase(db.name);
    } catch { /* IndexedDB non utilisé par l'application */ }
    persistent = true;
    session.clear();
    return removed;
  }
  function usage() {
    const rows = keys().map((k) => {
      let size = 0;
      try { size = (localStorage.getItem(k) || memory.get(k) || '').length; } catch {}
      return { key: k, size };
    });
    return { rows, total: rows.reduce((s, r) => s + r.size, 0), persistent, available };
  }

  return {
    K, read, write, remove, keys,
    get persistent() { return persistent; },
    set persistent(v) { persistent = !!v; },
    consent, accounts, session, teams, prefs,
    derivePassword, verifyPassword,
    newTeam, exportAll, wipeAll, usage, available,
    PBKDF2_ITERATIONS,
  };
})();
