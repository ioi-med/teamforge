/**
 * ============================================================================
 * TeamForge M-C — interface utilisateur (rendu, éditeur, modales, RGPD)
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT (voir LICENSE)
 * ============================================================================
 * Aucune dépendance externe : DOM natif + template literals.
 */
'use strict';

/* ------------------------------------------------------------------ */
/* 0. Petits utilitaires DOM                                          */
/* ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const frType = (t) => DEX.types[t] || t;
const spriteHTML = (variant, cls = 'sprite h-16 w-16') => {
  const src = spriteUrl(variant);
  const fallback = `https://play.pokemonshowdown.com/sprites/gen5/${variant.spriteBase}.png`;
  const initials = frMon(variant).replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase();
  const colour = TYPE_COLORS[variant.types[0]] || '#4b5563';
  return `<img src="${esc(src)}" alt="${esc(variant.name)}" loading="lazy" class="${cls}"
    data-fallback="${esc(fallback)}" data-initials="${esc(initials)}" data-colour="${esc(colour)}"
    onerror="window.spriteFallback && window.spriteFallback(this)" />`;
};
function typeChips(types, small) {
  return types.map((t) => `<span class="pill ${small ? 'pill-xs' : ''}"
    style="background:${TYPE_COLORS[t]}22;border-color:${TYPE_COLORS[t]}66;color:${TYPE_COLORS[t]}">${esc(frType(t))}</span>`).join('');
}
function statBadge(move) {
  const cat = CATEGORY_FR[move.c] || move.c;
  const bp = move.dm ? `${move.b}+` : (move.b || '—');
  return `<span class="pill pill-xs">${esc(cat)} ${bp}</span>`;
}

/* ------------------------------------------------------------------ */
/* 0 bis. Icônes SVG inline (indépendantes des polices système)        */
/* ------------------------------------------------------------------ */
const ICON = {
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-7 w-7 text-brand-400" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="inline h-3 w-3 align-[-1px]" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a1 1 0 00-1 1v9"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5" aria-hidden="true"><path d="M4 20h4L20 8l-4-4L4 16v4z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" class="inline h-3 w-3 align-[-1px]" aria-hidden="true"><path d="M8 5l12 7-12 7V5z"/></svg>',
};

/* ------------------------------------------------------------------ */
/* 1. Notifications et modales                                        */
/* ------------------------------------------------------------------ */
const Toast = {
  show(message, kind = 'info', timeout = 3600) {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.innerHTML = esc(message);
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, timeout);
  },
  ok(m) { Toast.show(m, 'ok'); },
  err(m) { Toast.show(m, 'err', 5200); },
  info(m) { Toast.show(m, 'info'); },
};

const Modals = {
  open(id) { const m = $('#' + id); if (m) { m.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } },
  close(id) { const m = $('#' + id); if (m) { m.classList.add('hidden'); if (!$('.modal:not(.hidden)') && $('#editor').classList.contains('hidden')) document.body.style.overflow = ''; } },
  closeAll() { $$('.modal').forEach((m) => m.classList.add('hidden')); Modals.toggleBodyScroll(); },
  toggleBodyScroll() { document.body.style.overflow = ($('.modal:not(.hidden)') || !$('#editor').classList.contains('hidden')) ? 'hidden' : ''; },
};

/** Repli visuel lorsque le sprite n'est pas disponible (navigation hors ligne). */
window.spriteFallback = function (img) {
  if (img.dataset.step === 'fallback') {
    const span = document.createElement('span');
    span.className = img.className + ' grid place-items-center rounded-lg text-sm font-black';
    span.style.background = img.dataset.colour + '33';
    span.style.color = '#fff';
    span.textContent = img.dataset.initials || '?';
    span.title = 'Sprite indisponible hors ligne';
    img.replaceWith(span);
    return;
  }
  img.dataset.step = 'fallback';
  img.src = img.dataset.fallback;
};

/* ------------------------------------------------------------------ */
/* 2. Autocomplétion réutilisable                                     */
/* ------------------------------------------------------------------ */
function attachAutocomplete(input, options) {
  let list = null;
  let active = -1;
  let current = [];

  const close = () => { if (list) { list.remove(); list = null; active = -1; } };
  const render = (query) => {
    current = options.items(query) || [];
    if (!current.length) { close(); if (options.emptyText && query) options.onEmpty && options.onEmpty(query); return; }
    if (!list) {
      list = document.createElement('div');
      list.className = 'ac-list';
      list.addEventListener('mousedown', onClick);
      list.addEventListener('click', onClick);
      document.body.appendChild(list);
    }
    const rect = input.getBoundingClientRect();
    list.style.position = 'fixed';
    list.style.left = rect.left + 'px';
    list.style.width = Math.max(rect.width, 280) + 'px';
    list.style.top = Math.min(rect.bottom + 4, window.innerHeight - 260) + 'px';
    list.innerHTML = current.map((item, i) => {
      const head = item.group && (i === 0 || current[i - 1].group !== item.group)
        ? `<div class="ac-head">${esc(item.group)}</div>` : '';
      return head + `<button type="button" data-i="${i}" class="ac-item ${item.disabled ? 'ac-item-disabled' : ''} ${i === active ? 'ac-item-active' : ''}" ${item.disabled ? 'disabled' : ''}>
        ${item.sprite ? `<img src="${esc(item.sprite)}" class="sprite h-7 w-7" data-fallback="${esc(item.spriteBase || item.sprite)}" data-initials="${esc((item.label || '?').slice(0, 2))}" data-colour="${esc(TYPE_COLORS[(item.types || [])[0]] || '#4b5563')}" onerror="window.spriteFallback && window.spriteFallback(this)" />` : ''}
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5"><span class="truncate">${item.html || esc(item.label)}</span>${item.badge || ''}</span>
          ${item.sub ? `<span class="block truncate text-[11px] text-slate-500">${item.sub}</span>` : ''}
        </span>
        ${item.note ? `<span class="shrink-0 text-[10px] text-slate-500">${esc(item.note)}</span>` : ''}
      </button>`;
    }).join('');
  };

  const commit = (index) => {
    const item = current[index];
    if (!item || item.disabled) return;
    options.onSelect(item, input);
    close();
  };
  // Sélection à la souris (mousedown évite la fermeture par le blur de l'input)
  const onClick = (e) => {
    if (!list) return;
    const btn = e.target.closest('[data-i]');
    if (!btn || btn.disabled) return;
    e.preventDefault();
    commit(parseInt(btn.dataset.i, 10));
  };

  input.addEventListener('input', () => { active = -1; render(input.value); });
  input.addEventListener('focus', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (!list) { if (e.key === 'Enter' && options.onEnter) options.onEnter(input); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, current.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(active >= 0 ? active : 0); return; }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); return; }   // ne ferme que la liste, pas le panneau d'édition
    else if (e.key === 'Tab') { close(); return; }
    else return;
    render(input.value);
    const activeEl = list && list.querySelector('.ac-item-active');
    if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ block: 'nearest' });
  });
  input.addEventListener('blur', () => setTimeout(close, 160));
  return { close, open: () => render(input.value) };
}

/* ------------------------------------------------------------------ */
/* 3. Application                                                     */
/* ------------------------------------------------------------------ */
const App = {
  state: {
    view: 'team',
    team: null,
    editSlot: null,
    prefs: { alwaysIvs: true, showLegacy: false },
  },

  /* ---------------- Démarrage ---------------- */
  init() {
    this.state.prefs = Store.prefs.get();
    $('#chk-ivs').checked = this.state.prefs.alwaysIvs !== false;
    $('#chk-legacy').checked = !!this.state.prefs.showLegacy;
    const teams = Store.teams.list();
    const wanted = this.state.prefs.lastTeam ? teams.find((t) => t.id === this.state.prefs.lastTeam) : null;
    this.loadTeam(wanted || teams[0] || Store.newTeam(), true);
    this.bindGlobal();
    this.bindEditor();
    this.bindAuth();
    this.bindIO();
    this.renderHero();
    this.renderDex();
    this.renderRules();
    this.refreshSession();
    this.setView(this.state.prefs.view || 'team');
    if (!Store.consent.decided) $('#consent-banner').classList.remove('hidden');
  },

  /* ---------------- Équipe courante ---------------- */
  loadTeam(team, silent) {
    this.state.team = team;
    Store.prefs.set({ lastTeam: team.id });
    this.renderTeam();
    if (!silent) Toast.info(`Équipe « ${team.name} » chargée.`);
  },
  currentTeam() {
    if (!this.state.team) this.state.team = Store.newTeam();
    return this.state.team;
  },
  persist(quiet) {
    const team = this.currentTeam();
    Store.teams.save(team);
    if (!quiet) Toast.ok('Équipe enregistrée dans ce navigateur.');
  },

  /** Contenu du bandeau d’accueil : chiffres clés du règlement + sprite mis en avant. */
  renderHero() {
    const m = DEX.meta;
    $('#hero-stats').innerHTML = [
      [m.speciesCount, 'espèces autorisées'],
      [DEX.variants.filter((v) => v.isMega).length, 'Méga-Évolutions'],
      [m.itemCount, 'objets légaux'],
      [m.moveCount, 'attaques'],
    ].map(([value, label]) => `<div class="rounded-md bg-black/25 px-3 py-2 backdrop-blur-sm">
        <p class="font-display text-xl font-extrabold leading-none text-white">${value}</p>
        <p class="mt-1 text-[11px] font-medium text-white/85">${esc(label)}</p>
      </div>`).join('');
  },

  /** Affiche dans le bandeau le sprite du premier Pokémon de l'équipe (sinon Garchomp). */
  renderHeroSprite() {
    const img = $('#hero-sprite');
    const first = this.currentTeam().sets.find(Boolean);
    const variant = first ? DEX.byKey.get(first.key) : DEX.byKey.get('garchomp');
    if (!variant) return;
    img.style.display = '';
    img.src = spriteUrl(variant);
    img.dataset.fallback = `https://play.pokemonshowdown.com/sprites/gen5/${variant.spriteBase}.png`;
    img.onerror = () => { img.style.display = 'none'; };
    img.alt = displayName(variant);
  },

  renderTeam() {
    const team = this.currentTeam();
    $('#team-name').value = team.name;
    this.renderHeroSprite();
    this.renderSlots();
    this.renderLegality();
    this.renderAnalysis();
    const filled = team.sets.filter(Boolean).length;
    $('#team-meta').textContent = `${filled}/6 Pokémon · Règlement M-C (Pokémon Champions) · statistiques calculées au niveau 50 · ` +
      `sauvegarde ${Store.persistent ? 'locale (localStorage)' : 'en mémoire (consentement refusé)'}`;
    $('#guest-banner').classList.toggle('hidden', !!Store.session.user());
  },

  renderSlots() {
    const team = this.currentTeam();
    const container = $('#slots');
    container.innerHTML = team.sets.map((set, i) => {
      if (!set) {
        return `<button type="button" class="slot-empty" data-slot="${i}" data-action="add">
          <span class="grid h-11 w-11 place-items-center rounded-full border border-ink-700 text-xl text-brand-500">＋</span>
          <span class="font-display text-sm font-bold text-slate-300">Emplacement ${i + 1}</span>
          <span class="text-xs">Ajouter un Pokémon</span>
        </button>`;
      }
      const v = DEX.byKey.get(set.key);
      if (!v) return '';
      const stats = computeStats(set);
      const ev = evSummary(set);
      const moves = set.moves.filter(Boolean).map((m) => frMove(DEX.movesByKey.get(m))).filter(Boolean);
      const item = set.item ? DEX.itemsByKey.get(set.item) : null;
      const tier = v.tier ? `<span class="pill pill-tag pill-xs">${esc(v.tier)}</span>` : '';
      const mega = v.isMega ? `<span class="pill pill-brand pill-xs">MÉGA</span>` : '';
      return `<article class="slot-card" data-slot="${i}">
        <div class="flex items-start gap-3">
          <div class="relative shrink-0">
            ${spriteHTML(v, 'sprite h-20 w-20')}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <h3 class="mon-name">${esc(set.nickname || displayName(v))}</h3>
              ${mega}${tier}
            </div>
            <p class="truncate text-[11px] text-slate-500">${esc(displayName(v))} · ${esc(frAbility(set.ability) || '—')}</p>
            <div class="mt-2 flex flex-wrap gap-1">${typeChips(v.types, true)}</div>
            <div class="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
              <span class="pill pill-xs" title="${esc(item ? item.fr || item.d : 'Aucun objet')}">${item ? ICON.bag + ' ' + esc(frItem(item)) : '— sans objet —'}</span>
              ${set.tera ? `<span class="pill pill-xs" style="color:${TYPE_COLORS[set.tera] || ''}">Téra ${esc(frType(set.tera))}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
          ${['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((k) => `<span class="tile flex items-center justify-between">
            <span class="text-slate-500">${STAT_FR_SHORT[k]}</span><strong class="text-white">${stats[k]}</strong></span>`).join('')}
        </div>
        <ul class="mt-2.5 space-y-0.5 text-[11px] text-slate-400">
          ${moves.length ? moves.map((m) => `<li class="truncate">• ${esc(m)}</li>`).join('') : '<li class="text-slate-600">Aucune attaque</li>'}
        </ul>
        <div class="mt-4 flex items-center justify-between gap-2">
          <span class="text-[10px] text-slate-500">EVs ${ev.total}/510 · Nature ${esc((DEX.naturesByKey.get(set.nature) || {}).fr || '—')}</span>
          <span class="flex gap-1.5">
            <button type="button" class="btn btn-primary btn-xs" data-slot="${i}" data-action="edit">Éditer</button>
            <button type="button" class="btn btn-xs btn-ghost" data-slot="${i}" data-action="duplicate" title="Dupliquer">${ICON.copy}</button>
            <button type="button" class="btn btn-xs btn-ghost text-rose-300" data-slot="${i}" data-action="remove" title="Retirer">✕</button>
          </span>
        </div>
      </article>`;
    }).join('');
  },

  renderLegality() {
    const report = validateTeam(this.currentTeam().sets);
    const row = (texte, cls, icon) => `<p class="pill ${cls} w-full justify-start !rounded-md !px-3 !py-2 text-xs">${icon} ${esc(texte)}</p>`;
    $('#legality-list').innerHTML = [
      report.errors.length ? row(report.errors.join(' · '), 'pill-bad', '⛔') : '',
      report.warnings.length ? row(report.warnings.join(' · '), 'pill-warn', '⚠️') : '',
      !report.errors.length && !report.warnings.length ? row('Équipe conforme au Règlement M-C — clauses Espèce et Objet respectées.', 'pill-ok', '✔') : '',
      report.infos.length ? row(report.infos.join(' · '), '', 'ℹ️') : '',
    ].join('');
  },

  renderAnalysis() {
    const analysis = analyzeTeam(this.currentTeam().sets);
    $('#team-stats').innerHTML = [
      ['Pokémon', `${analysis.count}/6`],
      ['Vitesse moyenne', analysis.avgSpeed || '—'],
      ['Attaquants physiques', `${analysis.physical}/${analysis.count || 0}`],
      ['Méga-Évolutions', analysis.megas],
      ['Total EVs', this.currentTeam().sets.filter(Boolean).reduce((s, x) => s + evSummary(x).total, 0)],
      ['Espèces distinctes', new Set(this.currentTeam().sets.filter(Boolean).map((s) => DEX.byKey.get(s.key)?.dex)).size],
    ].map(([k, v]) => `<div class="rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2.5">
        <dt class="text-[10px] font-bold uppercase tracking-wide text-slate-500">${k}</dt>
        <dd class="font-display text-lg font-extrabold text-white">${esc(v)}</dd></div>`).join('');

    const order = Object.keys(DEX.types);
    const rows = order.map((t) => ({ t, ...analysis.perType[t] }))
      .filter((r) => r.weak || r.resist || r.immune)
      .sort((a, b) => b.weak - a.weak || a.t.localeCompare(b.t));
    $('#team-weak').innerHTML = rows.length ? rows.map((r) => `<div class="flex items-center gap-2 text-[11px]">
        <span class="w-16 shrink-0 text-xs font-semibold" style="color:${TYPE_COLORS[r.t]}">${esc(frType(r.t))}</span>
        <span class="tier-bar flex-1">
          <i style="width:${Math.min(100, r.weak * 16)}%;background:#e03e2d"></i>
          <i style="width:${Math.min(100, r.resist * 16)}%;background:#34d399"></i>
          <i style="width:${Math.min(100, r.immune * 16)}%;background:#ef6e33"></i>
        </span>
        <span class="w-20 shrink-0 text-right text-slate-500">${r.weak ? `<b class="text-rose-300">${r.weak}×2</b>` : ''} ${r.resist ? `<b class="text-emerald-300">${r.resist}½</b>` : ''} ${r.immune ? `<b class="text-sky-300">${r.immune}×0</b>` : ''}</span>
      </div>`).join('') : '<p class="text-[11px] text-slate-500">Ajoutez des Pokémon pour voir la synergie défensive.</p>';
  },

  /* ---------------- Navigation ---------------- */
  setView(view) {
    this.state.view = view;
    $$('.view').forEach((s) => s.classList.add('hidden'));
    $('#view-' + view)?.classList.remove('hidden');
    $$('[data-view]').forEach((b) => b.classList.toggle('nav-item-active', b.dataset.view === view));
    Store.prefs.set({ view });
    if (view === 'dex') this.renderDex();
  },

  bindGlobal() {
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => this.setView(b.dataset.view)));

    // Recherche disponible depuis l'en-tête et le bandeau d'accueil
    const goSearch = (value) => {
      this.setView('dex');
      $('#dex-search').value = value || '';
      this.renderDex();
      const el = $('#dex-search');
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
      el.focus();
    };
    $('#top-search').addEventListener('input', (e) => goSearch(e.target.value));
    $('#hero-search-form').addEventListener('submit', (e) => { e.preventDefault(); goSearch($('#hero-search').value); });
    $('#hero-search').addEventListener('input', (e) => { if (e.target.value.length >= 2) goSearch(e.target.value); });

    // Raccourcis : ajouter un Pokémon / importer-exporter
    $('#btn-quick-add').addEventListener('click', () => {
      const slot = this.currentTeam().sets.findIndex((s) => !s);
      if (slot < 0) { Toast.err('Les 6 emplacements sont déjà occupés.'); return; }
      this.setView('team');
      this.openEditor(slot);
    });
    $('#btn-quick-io').addEventListener('click', () => this.openIO());
    $('#btn-teams-mobile').addEventListener('click', () => this.openTeams());
    $('#team-name').addEventListener('input', (e) => { this.currentTeam().name = e.target.value; Store.teams.save(this.currentTeam()); });
    $('#btn-save-team').addEventListener('click', () => this.persist());
    $('#btn-clear-team').addEventListener('click', () => {
      if (!confirm('Vider l’équipe ? Les Pokémon ne seront pas supprimés de vos autres équipes.')) return;
      this.currentTeam().sets = [null, null, null, null, null, null];
      this.renderTeam(); this.persist(true); Toast.info('Équipe vidée.');
    });
    $('#btn-io').addEventListener('click', () => this.openIO());
    $('#btn-teams').addEventListener('click', () => this.openTeams());
    $('#btn-settings').addEventListener('click', () => this.openSettings());
    // La modale d'authentification s'ouvre toujours sur « Connexion »
    const openAuth = () => { this.authSwitchMode('login'); Modals.open('modal-auth'); };
    $('#btn-auth').addEventListener('click', openAuth);
    $('#guest-banner-cta').addEventListener('click', openAuth);
    $('#brand').addEventListener('click', (e) => { e.preventDefault(); this.setView('team'); });
    $$('[data-open-privacy]').forEach((b) => b.addEventListener('click', () => Modals.open('modal-privacy')));
    $$('[data-open-license]').forEach((b) => b.addEventListener('click', () => this.openLicense()));
    $$('[data-open-settings]').forEach((b) => b.addEventListener('click', () => this.openSettings()));
    $('#btn-user').addEventListener('click', () => $('#user-menu').classList.toggle('hidden'));
    $$('#user-menu [data-user-action]').forEach((b) => b.addEventListener('click', () => {
      $('#user-menu').classList.add('hidden');
      const a = b.dataset.userAction;
      if (a === 'teams') this.openTeams();
      else if (a === 'settings') this.openSettings();
      else if (a === 'privacy') Modals.open('modal-privacy');
      else if (a === 'logout') this.logout();
    }));

    // Slots : délégation d'événements
    $('#slots').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      const slot = parseInt((btn || e.target.closest('[data-slot]'))?.dataset.slot, 10);
      const action = btn ? btn.dataset.action : null;
      if (Number.isNaN(slot)) return;
      if (action === 'remove') this.removeSlot(slot);
      else if (action === 'duplicate') this.duplicateSlot(slot);
      else this.openEditor(slot);
    });

    // Fermeture des modales
    $$('[data-close-modal]').forEach((b) => b.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) Modals.close(modal.id);
    }));
    $$('[data-close-editor]').forEach((b) => b.addEventListener('click', () => this.closeEditor()));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#editor').classList.contains('hidden')) this.closeEditor();
      else { const open = $('.modal:not(.hidden)'); if (open && open.id !== 'consent-banner') Modals.close(open.id); }
    });

    // Bannière RGPD
    $('#consent-accept').addEventListener('click', () => {
      Store.consent.set('accept');
      $('#consent-banner').classList.add('hidden');
      Toast.ok('Consentement enregistré — vos équipes seront sauvées dans ce navigateur.');
    });
    $('#consent-decline').addEventListener('click', () => {
      Store.consent.set('decline');
      $('#consent-banner').classList.remove('border-t');
      $('#consent-banner').classList.add('hidden');
      Toast.info('Refus enregistré : l’application fonctionne sans rien écrire sur votre appareil.');
      this.refreshSession();
    });

    // Pokédex
    $('#dex-search').addEventListener('input', () => this.renderDex());
    $('#dex-type').addEventListener('change', () => this.renderDex());
    $('#dex-sort').addEventListener('change', () => this.renderDex());
    $('#dex-mega').addEventListener('change', () => this.renderDex());
    $('#dex-type').innerHTML = '<option value="">Tous les types</option>' +
      Object.keys(DEX.types).map((t) => `<option value="${t}">${esc(frType(t))}</option>`).join('');
    $('#dex-grid').addEventListener('click', (e) => {
      const card = e.target.closest('[data-mon]');
      if (card) this.openMonDetail(card.dataset.mon);
    });
  },

  removeSlot(slot) {
    const team = this.currentTeam();
    const v = DEX.byKey.get(team.sets[slot]?.key);
    team.sets[slot] = null;
    this.renderTeam(); this.persist(true);
    if (v) Toast.info(`${displayName(v)} retiré de l’équipe.`);
  },
  duplicateSlot(slot) {
    const team = this.currentTeam();
    const set = team.sets[slot];
    if (!set) return;
    const target = team.sets.findIndex((s) => !s);
    if (target < 0) return Toast.err('Les 6 emplacements sont occupés.');
    team.sets[target] = JSON.parse(JSON.stringify(set));
    this.renderTeam(); this.persist(true);
    Toast.info('Pokémon dupliqué — pensez à la clause Objet.');
  },

  /* ================================================================ */
  /* 4. Éditeur détaillé                                              */
  /* ================================================================ */
  openEditor(slot) {
    const team = this.currentTeam();
    if (!team.sets[slot]) team.sets[slot] = null;
    this.state.editSlot = slot;
    $('#editor').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.renderEditor();
    if (!team.sets[slot]) $('#ed-species').focus();
  },
  closeEditor() {
    $('#editor').classList.add('hidden');
    Modals.toggleBodyScroll();
    this.state.editSlot = null;
    this.renderTeam();
  },
  set() { return this.currentTeam().sets[this.state.editSlot]; },

  renderEditor() {
    const set = this.set();
    const slot = this.state.editSlot;
    if (!set) {
      // Emplacement vide : invite à choisir une espèce
      $('#ed-title').textContent = 'Emplacement ' + (slot + 1);
      $('#ed-subtitle').textContent = 'Recherchez un Pokémon autorisé par le Règlement M-C';
      $('#ed-sprite').classList.add('hidden');
      $('#ed-species').value = '';
      $('#ed-form').innerHTML = '';
      $('#ed-nickname').value = '';
      $('#ed-item').value = '';
      $('#ed-item-hint').textContent = '';
      $('#ed-ability').innerHTML = '';
      $('#ed-nature').innerHTML = '';
      $('#ed-tera').innerHTML = '';
      $('#ed-level').value = 50;
      $('#stat-body').innerHTML = '';
      $('#moves-fields').innerHTML = '';
      $('#moves-detail').innerHTML = '';
      $('#ed-export').textContent = '';
      $('#ed-legality').innerHTML = '<span class="text-slate-500">Aucun Pokémon sélectionné.</span>';
      $('#btn-editor-remove').classList.add('hidden');
      return;
    }
    const v = DEX.byKey.get(set.key);
    $('#btn-editor-remove').classList.remove('hidden');
    $('#ed-sprite').classList.remove('hidden');
    const spriteImg = $('#ed-sprite');
    spriteImg.src = spriteUrl(v);
    spriteImg.dataset.fallback = `https://play.pokemonshowdown.com/sprites/gen5/${v.spriteBase}.png`;
    spriteImg.onerror = () => window.spriteFallback(spriteImg);
    $('#ed-title').textContent = set.nickname || displayName(v);
    $('#ed-subtitle').innerHTML = `${esc(frMon(v))} · ${esc(v.types.map(frType).join('/'))} · n° ${v.dex}${v.tier ? ' · ' + esc(v.tier) : ''}`;
    $('#ed-species').value = displayName(v);
    $('#ed-nickname').value = set.nickname || '';
    $('#ed-level').value = set.level || 50;

    // Formes de la famille (régionales + Méga-Évolutions)
    const family = DEX.byDex.get(v.dex) || [v];
    $('#ed-form').innerHTML = family.map((f) => `<option value="${f.key}" ${f.key === set.key ? 'selected' : ''}>
      ${esc(displayName(f))}${f.requiredItem ? ' — ' + esc(frItem(DEX.itemsByKey.get(f.requiredItem))) : ''}</option>`).join('');

    // Objet, talent, nature, type Téra
    const item = set.item ? DEX.itemsByKey.get(set.item) : null;
    $('#ed-item').value = item ? frItem(item) : '';
    const usedElsewhere = this.currentTeam().sets.some((s, i) => s && i !== slot && s.item === set.item);
    $('#ed-item-hint').innerHTML = item
      ? `${esc(frItemText(item))}${usedElsewhere ? ' <span class="text-rose-300">— déjà tenu par un autre Pokémon (clause Objet)</span>' : ''}`
      : '<span class="text-slate-500">Aucun objet — 166 objets autorisés.</span>';
    $('#ed-ability').value = frAbility(set.ability);
    const abilityInfo = DEX.abilitiesByName.get(normalizeId(set.ability));
    $('#ed-ability-hint').innerHTML = abilityInfo
      ? esc(abilityInfo.fr || abilityInfo.d || '')
      : '<span class="text-slate-500">Sélectionnez un talent autorisé pour cette forme.</span>';
    $('#ed-nature').innerHTML = DEX.natures.map((n) => `<option value="${n.k}" ${n.k === set.nature ? 'selected' : ''}>
      ${esc(n.fr)}${n.plus ? ` +${STAT_FR_SHORT[n.plus]} / −${STAT_FR_SHORT[n.minus]}` : ' neutre'}</option>`).join('');
    $('#ed-tera').innerHTML = '<option value="">— Type Téra —</option>' + Object.keys(DEX.types)
      .map((t) => `<option value="${t}" ${t === set.tera ? 'selected' : ''}>Téra ${esc(frType(t))}</option>`).join('');

    this.renderStatTable();
    this.renderMoveFields();
    this.renderEditorLegality();
  },

  renderStatTable() {
    const set = this.set();
    if (!set) return;
    const v = DEX.byKey.get(set.key);
    const stats = computeStats(set);
    const max = 230;
    $('#stat-body').innerHTML = STAT_KEYS.map((k) => {
      const nature = DEX.naturesByKey.get(set.nature) || {};
      const mod = nature.plus === k ? ' +' : nature.minus === k ? ' −' : '';
      const colour = 'linear-gradient(90deg, #f7a83c, #ef6e33)'; // charte Coup Critique
      return `<div class="stat-row flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-ink-800/80 px-3 py-2" data-stat="${k}">
        <span class="w-[4.75rem] shrink-0 text-xs font-semibold text-slate-300">${STAT_FR[k]}<span class="nature-tag text-slate-500">${mod}</span></span>
        <span class="hidden w-8 shrink-0 text-xs text-slate-500 sm:block">${v.bs[k]}</span>

        <div class="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-none sm:ml-0">
          <span class="text-right"><span class="computed font-mono text-sm font-bold text-white">${stats[k]}</span>
            <span class="stat-bar mt-1 block w-[4.5rem]"><i class="bar-fill" style="width:${Math.min(100, (stats[k] / max) * 100)}%;background:${colour}"></i></span>
          </span>
        </div>

        <div class="order-3 flex w-full items-center gap-2 sm:order-none sm:w-auto sm:flex-1">
          <span class="w-8 shrink-0 text-[10px] uppercase text-slate-500 sm:hidden">EVs</span>
          <input type="range" min="0" max="252" step="4" value="${set.evs[k]}" data-ev="${k}" class="min-w-0 flex-1" aria-label="EV ${STAT_FR[k]}" />
          <input type="number" min="0" max="252" value="${set.evs[k]}" data-ev-num="${k}" class="input w-14 px-1 py-1 text-center text-xs" />
          <span class="ml-1 w-8 shrink-0 text-[10px] uppercase text-slate-500 sm:hidden">IVs</span>
          <input type="range" min="0" max="31" step="1" value="${set.ivs[k]}" data-iv-range="${k}" class="w-14 min-w-0 sm:w-16" aria-label="IV ${STAT_FR[k]}" />
          <input type="number" min="0" max="31" value="${set.ivs[k]}" data-iv="${k}" class="input w-12 px-0.5 py-1 text-center text-xs" />
        </div>
      </div>`;
    }).join('');
    const ev = evSummary(set);
    const counter = $('#ev-counter');
    counter.textContent = `EVs restants : ${Math.max(0, 510 - ev.total)} (${ev.total}/510)`;
    counter.className = 'pill ' + (ev.total > 510 ? 'pill-bad' : ev.remaining <= 10 ? 'pill-warn' : 'pill-ok');
  },

  renderMoveFields() {
    const set = this.set();
    if (!set) return;
    const v = DEX.byKey.get(set.key);
    const learn = new Set(learnsetOf(v, true).map((m) => m.k));
    $('#moves-fields').innerHTML = set.moves.map((m, i) => {
      const move = m ? DEX.movesByKey.get(m) : null;
      return `<div class="move-field">
        <label class="label" for="ed-move-${i}">Attaque ${i + 1}</label>
        <input id="ed-move-${i}" class="input w-full" data-move="${i}" value="${esc(frMove(move))}" placeholder="Rechercher une attaque" autocomplete="off" />
        <p class="mt-1 text-[11px] text-slate-500">${move ? `${esc(frType(move.t))} · ${esc(CATEGORY_FR[move.c])} · ${move.b || '—'} BP · ${move.a === 0 ? '—' : move.a + '%'} · ${move.p} PP${move.r ? ' · priorité ' + (move.r > 0 ? '+' : '') + move.r : ''}` : '—'}</p>
      </div>`;
    }).join('');
    $('#moves-detail').innerHTML = set.moves.filter(Boolean).map((m) => {
      const move = DEX.movesByKey.get(m);
      return `<details class="rounded-lg border border-ink-800 bg-ink-850/50 px-3 py-2 text-xs">
        <summary class="cursor-pointer font-semibold text-slate-200">${esc(frMove(move))}
          <span class="ml-1 font-normal text-slate-500">${esc(frType(move.t))} · ${esc(CATEGORY_FR[move.c])} · ${move.b || '—'} BP${learn.has(m) ? '' : ' · hors movepool'}</span></summary>
        <p class="mt-1.5 text-slate-400">${esc(frMoveText(move) || 'Aucune description disponible.')}</p>
      </details>`;
    }).join('');
  },

  /** Met à jour le rapport de conformité, les valeurs calculées et l'aperçu d'export
   *  SANS recréer les champs de saisie (préserve le focus et la saisie en cours). */
  renderEditorLegality() {
    const set = this.set();
    if (!set) return;
    const issues = validateSet(set);
    $('#ed-legality').innerHTML = issues.length
      ? issues.map((i) => `<span class="${i.level === 'error' ? 'text-rose-300' : 'text-amber-300'}">${i.level === 'error' ? '⛔' : '⚠️'} ${esc(i.text)}</span>`).join('<br>')
      : '<span class="text-emerald-300">✔ Pokémon conforme au Règlement M-C</span>';
    this.updateStatValues();
    this.updateMovesDetail();
    $('#ed-export').textContent = exportSet(set, { alwaysIvs: this.state.prefs.alwaysIvs !== false });
  },

  /** Recalcule les statistiques de niveau 50 et rafraîchit la colonne de droite. */
  updateStatValues() {
    const set = this.set();
    if (!set) return;
    const stats = computeStats(set);
    const max = 230;
    const nature = DEX.naturesByKey.get(set.nature) || {};
    $$('#stat-body [data-stat]').forEach((tr) => {
      const k = tr.dataset.stat;
      const cell = tr.querySelector('.computed');
      if (cell) cell.textContent = stats[k];
      const fill = tr.querySelector('.bar-fill');
      if (fill) fill.style.width = Math.min(100, (stats[k] / max) * 100) + '%';
      const tag = tr.querySelector('.nature-tag');
      if (tag) tag.textContent = nature.plus === k ? ' +' : nature.minus === k ? ' −' : '';
      const num = tr.querySelector('[data-ev-num]');
      if (num && document.activeElement !== num) num.value = set.evs[k];
      const range = tr.querySelector('[data-ev]');
      if (range) range.value = set.evs[k];
      const iv = tr.querySelector('[data-iv]');
      if (iv && document.activeElement !== iv) iv.value = set.ivs[k];
      const ivRange = tr.querySelector('[data-iv-range]');
      if (ivRange && document.activeElement !== ivRange) ivRange.value = set.ivs[k];
    });
    const ev = evSummary(set);
    const counter = $('#ev-counter');
    counter.textContent = `EVs restants : ${Math.max(0, 510 - ev.total)} (${ev.total}/510)`;
    counter.className = 'pill ' + (ev.total > 510 ? 'pill-bad' : ev.remaining <= 10 ? 'pill-warn' : 'pill-ok');
  },

  /** Descriptions des attaques sélectionnées (aucun champ de saisie concerné). */
  updateMovesDetail() {
    const set = this.set();
    if (!set) return;
    const v = DEX.byKey.get(set.key);
    const learn = new Set(learnsetOf(v, true).map((m) => m.k));
    $('#moves-detail').innerHTML = set.moves.filter(Boolean).map((m) => {
      const move = DEX.movesByKey.get(m);
      if (!move) return '';
      return `<details class="rounded-lg border border-ink-800 bg-ink-850/50 px-3 py-2 text-xs">
        <summary class="cursor-pointer font-semibold text-slate-200">${esc(frMove(move))}
          <span class="ml-1 font-normal text-slate-500">${esc(frType(move.t))} · ${esc(CATEGORY_FR[move.c])} · ${move.b || '—'} BP${learn.has(m) ? '' : ' · hors movepool'}</span></summary>
        <p class="mt-1.5 text-slate-400">${esc(frMoveText(move) || 'Aucune description disponible.')}</p>
      </details>`;
    }).join('');
  },

  bindEditor() {
    $('#btn-editor-close').addEventListener('click', () => this.closeEditor());
    $('#btn-editor-remove').addEventListener('click', () => { const s = this.state.editSlot; this.closeEditor(); this.removeSlot(s); });
    $('#btn-editor-copy').addEventListener('click', async () => {
      const set = this.set();
      if (!set) return;
      await copyText(exportSet(set, { alwaysIvs: true }));
      Toast.ok('Pokémon copié au format Showdown.');
    });

    // Espèce
    const speciesAC = attachAutocomplete($('#ed-species'), {
      items: (q) => this.speciesItems(q),
      onSelect: (item) => {
        const set = this.set();
        const family = DEX.byDex.get(DEX.byKey.get(item.value).dex) || [];
        const keep = family.find((f) => f.key === set?.key);
        const variant = keep || DEX.byKey.get(item.value);
        if (!set) {
          this.currentTeam().sets[this.state.editSlot] = createSet(variant.key);
        } else if (set.key !== variant.key) {
          const fresh = createSet(variant.key);
          fresh.nickname = set.nickname;
          fresh.moves = set.moves.filter((m) => m && learnsetOf(variant, true).some((x) => x.k === m)).concat(['', '', '', '']).slice(0, 4);
          Object.assign(set, fresh);
        }
        this.persist(true);
        this.renderEditor();
      },
    });
    $('#ed-species').addEventListener('blur', () => setTimeout(() => { if (this.set()) this.renderEditor(); }, 200));

    $('#ed-form').addEventListener('change', (e) => {
      const set = this.set();
      if (!set) return;
      const target = DEX.byKey.get(e.target.value);
      const fresh = createSet(target.key);
      fresh.nickname = set.nickname;
      fresh.moves = set.moves.filter((m) => m && learnsetOf(target, true).some((x) => x.k === m)).concat(['', '', '', '']).slice(0, 4);
      Object.assign(set, fresh);
      this.persist(true);
      this.renderEditor();
    });
    $('#ed-nickname').addEventListener('input', (e) => { const s = this.set(); if (s) { s.nickname = e.target.value; $('#ed-title').textContent = s.nickname || displayName(DEX.byKey.get(s.key)); this.persist(true); this.renderEditorLegality(); } });

    // Objet
    attachAutocomplete($('#ed-item'), {
      items: (q) => this.itemItems(q),
      onSelect: (item) => {
        const set = this.set();
        if (!set) { Toast.info('Choisissez d’abord un Pokémon, puis son objet.'); return; }   // aucun emplacement actif
        set.item = item.value;
        const it = DEX.itemsByKey.get(item.value);
        // Une pierre Méga fait basculer automatiquement vers la forme Méga
        if (it.stone) {
          const current = DEX.byKey.get(set.key);
          const ids = [current.key, normalizeId(current.base || ''), current.speciesKey];
          const stone = it.megas.find((mg) => ids.includes(mg.from));
          if (stone && DEX.byKey.has(stone.to)) set.key = stone.to;
        } else if (DEX.byKey.get(set.key)?.isMega) {
          // Retirer la pierre annule la Méga-Évolution
          const base = DEX.byKey.get(set.key);
          const baseVariant = (DEX.byDex.get(base.dex) || []).find((f) => !f.isMega && normalizeId(f.name.split('-')[0]) === normalizeId(base.base || ''));
          if (baseVariant) set.key = baseVariant.key;
        }
        this.persist(true);
        this.renderEditor();
      },
    });
    $('#ed-item').addEventListener('blur', () => setTimeout(() => {
      const set = this.set();
      if (set && (!set.item || !DEX.itemsByKey.has(set.item))) { set.item = null; this.renderEditor(); }
    }, 200));

    // Talent : autocomplétion limitée aux talents légaux de la forme
    attachAutocomplete($('#ed-ability'), {
      items: (q) => this.abilityItems(q),
      onSelect: (item) => {
        const set = this.set();
        if (!set) { Toast.info('Choisissez d’abord un Pokémon, puis son talent.'); return; }
        set.ability = item.value;
        this.persist(true);
        this.renderEditor();
      },
    });
    $('#ed-ability').addEventListener('blur', () => setTimeout(() => {
      const set = this.set();
      if (!set) return;
      const variant = DEX.byKey.get(set.key);
      const resolved = resolveAbilityName(variant, set.ability);
      if (!resolved) {
        set.ability = variant.abilities[0] || '';
        Toast.info(`Talent non valide — « ${frAbility(set.ability) || 'aucun'} » appliqué.`);
      } else set.ability = resolved;
      this.persist(true);
      this.renderEditor();
    }, 220));
    $('#ed-nature').addEventListener('change', (e) => { const s = this.set(); if (!s) return; s.nature = e.target.value; this.persist(true); this.renderEditor(); });
    $('#ed-tera').addEventListener('change', (e) => { const s = this.set(); if (!s) return; s.tera = e.target.value || null; this.persist(true); this.renderEditorLegality(); });
    $('#ed-level').addEventListener('change', (e) => { const s = this.set(); if (!s) return; s.level = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 50)); this.persist(true); this.renderEditor(); });

    // EVs / IVs
    $('#stat-body').addEventListener('input', (e) => {
      const set = this.set();
      if (!set) return;
      const evKey = e.target.dataset.ev || e.target.dataset.evNum;
      const ivKey = e.target.dataset.iv || e.target.dataset.ivRange;
      if (evKey) {
        let value = Math.max(0, Math.min(252, parseInt(e.target.value, 10) || 0));
        set.evs[evKey] = value;
        if (evSummary(set).overTotal) { clampEvs(set); Toast.info('Total d’EVs limité à 510 — répartition ajustée.'); }
      } else if (ivKey) {
        set.ivs[ivKey] = Math.max(0, Math.min(31, parseInt(e.target.value, 10) || 0));
      } else return;
      this.persist(true);
      $$('[data-ev]').forEach((input) => { if (!evKey || input.dataset.ev !== evKey) input.value = set.evs[input.dataset.ev]; });
      $$('[data-ev-num]').forEach((input) => { if ((!evKey || input.dataset.evNum !== evKey) && document.activeElement !== input) input.value = set.evs[input.dataset.evNum]; });
      $$('[data-iv]').forEach((input) => { if ((!ivKey || input.dataset.iv !== ivKey) && document.activeElement !== input) input.value = set.ivs[input.dataset.iv]; });
      $$('[data-iv-range]').forEach((input) => { if (!ivKey || input.dataset.ivRange !== ivKey) input.value = set.ivs[input.dataset.ivRange]; });
      this.updateStatValues();
      this.renderEditorLegality();
    });
    $('#chk-legacy').addEventListener('change', (e) => {
      this.state.prefs = Store.prefs.set({ showLegacy: e.target.checked });
      Toast.info(e.target.checked ? 'Affichage de toutes les attaques historiques activé.' : 'Seules les attaques des jeux actuels sont proposées.');
      if (this.state.editSlot != null) this.renderEditor();
    });
    $('#btn-ev-max').addEventListener('click', () => {
      const set = this.set(); if (!set) return;
      applySuggestedSpread(set); this.persist(true); this.renderEditor();
      Toast.info('Répartition offensive conseillée appliquée.');
    });
    $('#btn-ev-reset').addEventListener('click', () => {
      const set = this.set(); if (!set) return;
      set.evs = Object.assign({}, DEFAULT_EVS); this.persist(true); this.renderEditor();
    });

    // Attaques
    const moveInputs = () => $$('[data-move]');
    this.attachMoveAutocomplete = (input) => attachAutocomplete(input, {
      items: (q) => this.moveItems(q),
      onSelect: (item) => {
        const set = this.set();
        const index = parseInt(input.dataset.move, 10);
        if (set.moves.includes(item.value) && set.moves[index] !== item.value) return Toast.info('Cette attaque est déjà sélectionnée.');
        set.moves[index] = item.value;
        this.persist(true);
        this.renderEditorLegality();
      },
    });
    // Les champs d'attaque sont recréés à chaque rendu : on rebranche via délégation
    $('#moves-fields').addEventListener('focusin', (e) => {
      const input = e.target.closest('[data-move]');
      if (input && !input.dataset.bound) { input.dataset.bound = '1'; this.attachMoveAutocomplete(input); input.dispatchEvent(new Event('input')); }
    });
    $('#moves-fields').addEventListener('input', (e) => {
      const input = e.target.closest('[data-move]');
      if (!input || !this.set()) return;
      if (input.value === '') { this.set().moves[parseInt(input.dataset.move, 10)] = ''; this.persist(true); this.renderEditorLegality(); }
    });
    $('#moves-fields').addEventListener('blur', (e) => {
      const input = e.target.closest('[data-move]');
      if (input) setTimeout(() => { const set = this.set(); if (set && !set.moves.filter(Boolean).length) return; this.renderEditorLegality(); }, 220);
    }, true);
  },

  /* ---------------- Sources d'autocomplétion ---------------- */
  speciesItems(query) {
    const families = new Map();
    for (const v of DEX.variants) {
      if (!families.has(v.dex)) families.set(v.dex, []);
      families.get(v.dex).push(v);
    }
    const rows = [];
    for (const [, list] of families) {
      const primary = list.find((v) => !v.isMega && !v.forme) || list[0];
      const score = Math.max(...list.map((v) => fuzzyScore(displayName(v) + ' ' + v.name, query)));
      if (score < 0) continue;
      const hasMega = list.some((v) => v.isMega);
      rows.push({
        value: primary.key, score, label: displayName(primary),
        sprite: spriteUrl(primary), spriteBase: primary.spriteBase, types: primary.types,
        sub: `${primary.types.map(frType).join('/')} · ${primary.bst} BST${primary.tier ? ' · ' + primary.tier : ''}${list.length > 1 ? ` · ${list.length} formes` : ''}`,
        badge: primary.isNew ? '<span class="pill pill-brand pill-xs">NOUVEAU</span>' : '',
        note2: primary.tier || '',
        note: hasMega ? 'Méga' : '',
      });
    }
    return rows.sort((a, b) => b.score - a.score).slice(0, 40);
  },

  abilityItems(query) {
    const set = this.set();
    if (!set) return [];
    const variant = DEX.byKey.get(set.key);
    return variant.abilities
      .filter((a) => !query || Math.max(fuzzyScore(frAbility(a), query), fuzzyScore(a, query)) >= 0)
      .map((a) => {
        const ab = DEX.abilitiesByName.get(normalizeId(a));
        const row = { value: a, label: frAbility(a), sub: (ab ? frItemText(ab) : '').slice(0, 110) };
        return Object.assign(row, {
          badge: a === variant.abilities[0] ? '<span class="pill pill-xs">1er talent</span>' : '',
        });
      });
  },

  itemItems(query) {
    const currentTeam = this.currentTeam();
    const usedByOthers = new Set(currentTeam.sets.filter((s, i) => s && i !== this.state.editSlot && s.item).map((s) => s.item));
    return DEX.items.map((it) => ({ it, score: Math.max(fuzzyScore(frItem(it), query), fuzzyScore(it.n, query)) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map(({ it }) => ({
        value: it.k,
        label: frItem(it),
        sub: frItemText(it).slice(0, 90),
        group: it.stone ? 'Pierres Méga' : it.berry ? 'Baies' : 'Objets tenus',
        badge: it.isNew ? '<span class="pill pill-brand pill-xs">NOUVEAU</span>' : '',
        disabled: usedByOthers.has(it.k),
        note: usedByOthers.has(it.k) ? 'clause Objet' : '',
      }));
  },

  moveItems(query) {
    const set = this.set();
    if (!set) return [];
    const v = DEX.byKey.get(set.key);
    const includeLegacy = this.state.prefs.showLegacy;
    return learnsetOf(v, true)
      .filter((m) => includeLegacy || learnsetOf(v, false).some((x) => x.k === m.k))
      .map((m) => ({ m, score: Math.max(fuzzyScore(frMove(m), query), fuzzyScore(m.n, query)) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
      .map(({ m }) => ({
        value: m.k,
        label: frMove(m),
        sub: `${frType(m.t)} · ${CATEGORY_FR[m.c]} · ${m.b || '—'} BP · ${m.a === 0 ? '—' : m.a + '%'}`,
        badge: statBadge(m),
      }));
  },

  /* ================================================================ */
  /* 5. Authentification                                              */
  /* ================================================================ */
  bindAuth() {
    let mode = 'login';
    const switchMode = (target) => {
      mode = target;
      $('#tab-login').classList.toggle('tab-active', mode === 'login');
      $('#tab-signup').classList.toggle('tab-active', mode === 'signup');
      $('#auth-title').textContent = mode === 'login' ? 'Connexion' : 'Créer un compte local';
      $('#auth-signup-fields').classList.toggle('hidden', mode !== 'signup');
      $('#auth-confirm-wrap').classList.toggle('hidden', mode !== 'signup');
      $('#auth-submit').textContent = mode === 'login' ? 'Se connecter' : 'Créer mon compte';
      $('#auth-msg').textContent = '';
    };
    this.authSwitchMode = switchMode;
    $('#tab-login').addEventListener('click', () => switchMode('login'));
    $('#tab-signup').addEventListener('click', () => switchMode('signup'));
    $('#auth-open-settings').addEventListener('click', () => { Modals.close('modal-auth'); this.openSettings(); });
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const login = $('#auth-login').value.trim();
      const password = $('#auth-password').value;
      const msg = $('#auth-msg');
      try {
        if (mode === 'signup') {
          if (password !== $('#auth-confirm').value) throw new Error('Les deux mots de passe ne correspondent pas.');
          // Équipe éventuellement créée en mode invité : elle sera conservée dans le nouveau compte
          const guestTeam = Store.session.user() ? null : JSON.parse(JSON.stringify(this.currentTeam()));
          const account = await Store.accounts.create({ login, password, pseudo: $('#auth-pseudo').value.trim() || login });
          Store.session.set(account.id);
          Store.prefs.set({ lastTeam: null });
          let teams = Store.teams.list();
          let recovered = null;
          if (guestTeam && guestTeam.sets.filter(Boolean).length) {
            guestTeam.id = 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            Store.teams.save(guestTeam);
            teams = Store.teams.list();
            recovered = teams.find((t) => t.id === guestTeam.id);
          }
          this.loadTeam(recovered || teams[0], true);
          msg.innerHTML = '';
          Modals.close('modal-auth');
          Toast.ok(`Bienvenue ${esc(account.pseudo)} ! Compte local créé.` +
            (recovered ? ` Votre équipe invité (${recovered.sets.filter(Boolean).length} Pokémon) a été transférée.` : ''));
        } else {
          const account = await Store.accounts.authenticate(login, password);
          Store.session.set(account.id);
          const teams = Store.teams.list();
          this.loadTeam(teams[0], true);
          Modals.close('modal-auth');
          Toast.ok(`Content de vous revoir, ${esc(account.pseudo)} !`);
        }
        $('#auth-form').reset();
        this.refreshSession();
        this.renderTeam();
      } catch (err) {
        msg.innerHTML = `<span class="text-rose-300">${esc(err.message)}</span>`;
      }
    });
  },

  async logout() {
    Store.session.clear();
    this.refreshSession();
    const teams = Store.teams.list();
    this.loadTeam(teams[0], true);
    this.renderTeam();
    Toast.info('Déconnecté — vous êtes en mode invité (une seule équipe temporaire).');
  },

  refreshSession() {
    const user = Store.session.user();
    $('#btn-auth').classList.toggle('hidden', !!user);
    $('#btn-user').classList.toggle('hidden', !user);
    $('#user-name').textContent = user ? user.pseudo : '';
    $('#session-chip').textContent = user ? (Store.consent.get()?.choice === 'decline' ? 'Session éphémère' : 'Stockage local actif') : 'Mode invité';
    $('#guest-banner').classList.toggle('hidden', !!user);
  },

  /* ================================================================ */
  /* 6. Import / Export                                               */
  /* ================================================================ */
  openIO() {
    $('#io-out').value = exportTeam(this.currentTeam().sets, { alwaysIvs: $('#chk-ivs').checked });
    $('#io-report').innerHTML = '';
    Modals.open('modal-io');
  },
  bindIO() {
    $('#chk-ivs').addEventListener('change', (e) => {
      this.state.prefs = Store.prefs.set({ alwaysIvs: e.target.checked });
      $('#io-out').value = exportTeam(this.currentTeam().sets, { alwaysIvs: e.target.checked });
      if (this.state.editSlot != null) this.renderEditorLegality();
    });
    $('#btn-copy').addEventListener('click', async () => {
      const text = $('#io-out').value;
      if (!text.trim()) return Toast.err('Aucun Pokémon à exporter.');
      await copyText(text);
      Toast.ok('Équipe copiée dans le presse-papier (format Showdown).');
    });
    $('#btn-download').addEventListener('click', () => {
      const text = $('#io-out').value;
      if (!text.trim()) return Toast.err('Aucun Pokémon à exporter.');
      downloadFile(`${this.currentTeam().name.replace(/[^\w-]+/g, '_')}_RegM-C.txt`, text);
    });
    $('#btn-import').addEventListener('click', () => this.doImport($('#io-in').value));
    $('#btn-io-clear').addEventListener('click', () => { $('#io-in').value = ''; $('#io-report').innerHTML = ''; });
    $('#io-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { $('#io-in').value = reader.result; this.doImport(reader.result); };
      reader.readAsText(file);
    });
  },
  doImport(text) {
    const { sets, errors, warnings } = parseShowdown(text);
    const report = [];
    if (!sets.length && !errors.length) report.push('<p class="text-slate-400">Aucun Pokémon détecté dans le texte fourni.</p>');
    errors.forEach((e) => report.push(`<p class="text-rose-300">⛔ ${esc(e)}</p>`));
    warnings.forEach((w) => report.push(`<p class="text-amber-300">⚠️ ${esc(w)}</p>`));
    if (sets.length) {
      const team = this.currentTeam();
      const target = [null, null, null, null, null, null];
      sets.slice(0, 6).forEach((s, i) => { target[i] = s; });
      team.sets = target;
      const dupes = sets.length - new Set(sets.map((s) => DEX.byKey.get(s.key)?.dex)).size;
      if (dupes > 0) report.push(`<p class="text-amber-300">⚠️ ${dupes} doublon(s) d’espèce détecté(s) — clause Espèce.</p>`);
      this.persist(true);
      this.renderTeam();
      report.unshift(`<p class="text-emerald-300">✔ ${sets.length} Pokémon importé(s) — équipe remplacée.</p>`);
      Toast.ok(`${sets.length} Pokémon importé(s) avec succès.`);
      if (this.state.editSlot != null) this.renderEditor();
    }
    $('#io-report').innerHTML = report.join('');
  },

  /* ================================================================ */
  /* 7. Mes équipes                                                   */
  /* ================================================================ */
  openTeams() {
    const list = Store.teams.list();
    const user = Store.session.user();
    $('#teams-list').innerHTML = list.map((t) => {
      const filled = t.sets.filter(Boolean).length;
      const sprites = t.sets.filter(Boolean).map((s) => spriteHTML(DEX.byKey.get(s.key), 'sprite h-8 w-8')).join('');
      return `<div class="flex items-center gap-3 rounded-lg border ${t.id === this.currentTeam().id ? 'border-brand-500 bg-brand-500/10' : 'border-ink-700 bg-ink-850'} p-3">
        <div class="flex min-w-0 flex-1 items-center gap-1">${sprites || '<span class="text-xs text-slate-500">Équipe vide</span>'}</div>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-white">${esc(t.name)}</p>
          <p class="text-[11px] text-slate-500">${filled}/6 Pokémon · modifiée le ${new Date(t.updatedAt).toLocaleDateString('fr-FR')}</p>
        </div>
        <div class="flex gap-1">
          <button type="button" class="btn btn-primary btn-xs" data-team-load="${t.id}">Charger</button>
          <button type="button" class="btn btn-xs btn-ghost" data-team-rename="${t.id}" title="Renommer">${ICON.pencil}</button>
          ${user && list.length > 1 ? `<button type="button" class="btn btn-xs btn-ghost text-rose-300" data-team-del="${t.id}" title="Supprimer">${ICON.trash}</button>` : ''}
        </div>
      </div>`;
    }).join('') + (user ? '' : '<p class="mt-3 text-xs text-slate-500">En mode invité, une seule équipe temporaire est disponible. Créez un compte local gratuit pour en sauvegarder plusieurs.</p>');
    Modals.open('modal-teams');
  },
  bindTeams() {
    $('#btn-team-create').addEventListener('click', () => {
      const team = Store.newTeam(`Équipe ${Store.teams.list().length + 1}`);
      Store.teams.save(team);
      this.loadTeam(team, true);
      this.renderTeam();
      this.openTeams();
      Toast.ok('Nouvelle équipe créée.');
    });
    $('#teams-list').addEventListener('click', (e) => {
      const load = e.target.closest('[data-team-load]');
      const del = e.target.closest('[data-team-del]');
      const ren = e.target.closest('[data-team-rename]');
      if (load) { this.loadTeam(Store.teams.get(load.dataset.teamLoad), false); this.renderTeam(); Modals.close('modal-teams'); }
      else if (del) {
        Store.teams.remove(del.dataset.teamDel);
        const teams = Store.teams.list();
        if (!teams.some((t) => t.id === this.currentTeam().id)) this.loadTeam(teams[0], true);
        this.openTeams(); this.renderTeam();
        Toast.info('Équipe supprimée.');
      } else if (ren) {
        const team = Store.teams.get(ren.dataset.teamRename);
        const name = prompt('Nouveau nom de l’équipe :', team.name);
        if (name) { team.name = name.slice(0, 30); Store.teams.save(team); if (team.id === this.currentTeam().id) this.renderTeam(); this.openTeams(); }
      }
    });
  },

  /* ================================================================ */
  /* 8. Paramètres, données & RGPD                                    */
  /* ================================================================ */
  openSettings() {
    const user = Store.session.user();
    const usage = Store.usage();
    $('#settings-account').innerHTML = user
      ? `<p><strong class="text-white">${esc(user.pseudo)}</strong> — identifiant local <code>${esc(user.login)}</code></p>
         <p class="mt-1 text-xs text-slate-500">Compte créé le ${new Date(user.createdAt).toLocaleString('fr-FR')} · empreinte PBKDF2-SHA256 (${Store.PBKDF2_ITERATIONS.toLocaleString('fr-FR')} itérations) · mot de passe jamais stocké en clair.</p>
         <p class="mt-1 text-xs text-slate-500">${Store.teams.list().length} équipe(s) enregistrée(s).</p>`
      : '<p>Mode invité : une seule équipe temporaire, conservée dans ce navigateur.</p>';
    const consent = Store.consent.get();
    // Possibilité de revenir sur son choix à tout moment (RGPD : consentement réversible)
    $('#btn-consent-toggle').textContent = Store.persistent ? 'Désactiver le stockage local' : 'Activer le stockage local';
    $('#storage-info').textContent =
      `Stockage : ${usage.persistent ? 'localStorage (persistant)' : 'mémoire volatile (session uniquement — consentement refusé)'}\n` +
      `Consentement : ${consent ? consent.choice + ' le ' + new Date(consent.date).toLocaleString('fr-FR') : 'non renseigné'}\n` +
      `Clés utilisées :\n` + (usage.rows.map((r) => ` • ${r.key} (${(r.size / 1024).toFixed(1)} Ko)`).join('\n') || ' • aucune');
    Modals.open('modal-settings');
  },
  bindSettings() {
    $('#btn-consent-toggle').addEventListener('click', () => {
      if (Store.persistent) {
        Store.consent.clear();
        Toast.info('Stockage local désactivé : vos futures modifications restent en mémoire (session uniquement).');
      } else {
        Store.consent.set('accept');
        Toast.ok('Stockage local activé : vos équipes sont désormais conservées dans ce navigateur.');
      }
      this.openSettings();
      this.renderTeam();
    });
    $('#btn-export-data').addEventListener('click', () => {
      downloadFile('teamforge-mc-donnees.json', JSON.stringify(Store.exportAll(), null, 2));
      Toast.ok('Export de vos données généré (JSON).');
    });
    $('#btn-wipe-all').addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement votre compte local, vos équipes et toutes vos données ? Cette action est immédiate et irréversible.')) return;
      const removed = await Store.wipeAll();
      Store.persistent = false;                 // rien n'est réécrit tant que le consentement n'est pas redonné
      this.state.team = null;
      this.loadTeam(Store.newTeam('Nouvelle équipe'), true);
      this.renderTeam();
      this.refreshSession();
      Modals.close('modal-settings');
      $('#consent-banner').classList.remove('hidden');   // le consentement ayant été effacé, on le redemande
      Toast.ok(`Données effacées (${removed.length} entrées supprimées). Rien ne subsiste dans ce navigateur.`);
    });
  },

  openLicense() {
    $('#license-text').textContent = [
      'MIT License',
      '',
      'Copyright (c) 2026 M. Mehdi TANNOUBI',
      '',
      'Permission is hereby granted, free of charge, to any person obtaining a copy',
      'of this software and associated documentation files (the "Software"), to deal',
      'in the Software without restriction, including without limitation the rights',
      'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
      'copies of the Software, and to permit persons to whom the Software is',
      'furnished to do so, subject to the following conditions:',
      '',
      'The above copyright notice and this permission notice shall be included in all',
      'copies or substantial portions of the Software.',
      '',
      'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
      'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
      'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
      'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
      'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
      'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
      'SOFTWARE.',
    ].join('\n');
    Modals.open('modal-license');
  },

  /* ================================================================ */
  /* 9. Pokédex & vue Règlement                                       */
  /* ================================================================ */
  renderDex() {
    const query = $('#dex-search').value.trim();
    const type = $('#dex-type').value;
    const sort = $('#dex-sort').value;
    const withMega = $('#dex-mega').checked;
    let rows = DEX.variants.filter((v) => withMega || !v.isMega);
    if (type) rows = rows.filter((v) => v.types.includes(type));
    if (query) {
      rows = rows
        .map((v) => ({ v, score: Math.max(
          fuzzyScore(displayName(v), query), fuzzyScore(v.name, query),
          fuzzyScore(v.abilities.map(frAbility).join(' '), query), fuzzyScore(v.abilities.join(' '), query),
          fuzzyScore(v.types.map((t) => DEX.types[t]).join(' '), query), fuzzyScore(v.types.join(' '), query),
        ) }))
        .filter((x) => x.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.v);
    }
    const sorters = {
      dex: (a, b) => a.dex - b.dex || (a.isMega ? 1 : 0) - (b.isMega ? 1 : 0),
      name: (a, b) => displayName(a).localeCompare(displayName(b), 'fr'),
      bst: (a, b) => b.bst - a.bst,
      speed: (a, b) => b.bs.spe - a.bs.spe,
      new: (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || a.dex - b.dex,
    };
    rows = query ? rows : rows.slice().sort(sorters[sort] || sorters.dex);
    $('#dex-count').textContent = `${DEX.meta.speciesCount} espèces officielles · ${DEX.variants.filter((v) => !v.isMega).length} formes de base/régionales · ${DEX.variants.filter((v) => v.isMega).length} Méga-Évolutions jouables · ${DEX.moves.length} attaques référencées.`;
    $('#dex-grid').innerHTML = rows.map((v) => `<button type="button" data-mon="${v.key}" class="slot-card text-left">
      <div class="flex items-center gap-3">
        ${spriteHTML(v, 'sprite h-14 w-14')}
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="mon-name">${esc(displayName(v))}</span>
            ${v.isMega ? '<span class="pill pill-brand pill-xs">MÉGA</span>' : ''}
            ${v.isNew ? '<span class="pill pill-tag pill-xs">NOUVEAU</span>' : ''}
          </div>
          <div class="mt-1 flex flex-wrap gap-1">${typeChips(v.types, true)}</div>
          <p class="mt-1 text-[11px] text-slate-500">n° ${v.dex} · BST ${v.bst} · VIT ${v.bs.spe}${v.tier ? ' · ' + esc(v.tier) : ''}</p>
        </div>
      </div>
    </button>`).join('') || '<p class="text-sm text-slate-500">Aucun Pokémon ne correspond à cette recherche.</p>';
  },

  openMonDetail(key) {
    const v = DEX.byKey.get(key);
    if (!v) return;
    $('#mon-sprite').src = spriteUrl(v);
    $('#mon-name').textContent = displayName(v);
    $('#mon-sub').textContent = `${frMon(v)} · n° ${v.dex} · ${v.types.map(frType).join(' / ')}${v.tier ? ' · ' + v.tier : ''}${v.weight ? ' · ' + v.weight + ' kg' : ''}`;
    const moves = learnsetOf(v, false);
    const highlights = moves.filter((m) => ['protect', 'fakeout', 'followme', 'helpinghand', 'tailwind', 'trickroom', 'icywind', 'snarl'].includes(m.k)).slice(0, 6);
    $('#mon-body').innerHTML = `
      <div class="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 class="panel-title text-sm">Statistiques de base</h3>
          <div class="mt-2 space-y-1">${STAT_KEYS.map((k) => `<div class="flex items-center gap-2 text-xs">
            <span class="w-16 text-slate-400">${STAT_FR[k]}</span>
            <span class="stat-bar flex-1"><i style="width:${Math.min(100, (v.bs[k] / 180) * 100)}%;background:#ef6e33"></i></span>
            <span class="w-10 text-right font-mono text-slate-200">${v.bs[k]}</span></div>`).join('')}</div>
          <h3 class="panel-title mt-5 text-sm">Talents</h3>
          <div class="mt-2 space-y-1 text-xs text-slate-400">${v.abilities.map((a) => {
            const ab = DEX.abilitiesByName.get(normalizeId(a));
            return `<p><strong class="text-slate-200">${esc(frAbility(a))}</strong>${ab ? ' — ' + esc(frItemText(ab)) : ''}</p>`;
          }).join('')}</div>
          ${v.requiredItem ? `<p class="pill pill-brand mt-3">Nécessite ${esc(frItem(DEX.itemsByKey.get(v.requiredItem)) || v.requiredItem)}</p>` : ''}
        </div>
        <div>
          <h3 class="panel-title text-sm">Attaques notables (${moves.length} disponibles)</h3>
          <div class="mt-2 flex flex-wrap gap-1">${(highlights.length ? highlights : moves.slice(0, 10)).map((m) => `<span class="pill" style="background:${TYPE_COLORS[m.t]}22;border-color:${TYPE_COLORS[m.t]}55;color:${TYPE_COLORS[m.t]}">${esc(frMove(m))}</span>`).join('')}</div>
          <h3 class="panel-title mt-5 text-sm">Faiblesses</h3>
          <p class="mt-2 text-xs text-slate-400">${Object.keys(DEX.types).map((t) => ({ t, m: defensiveMultiplier(v.types, t) }))
            .filter((x) => x.m > 1).map((x) => `<span class="pill pill-xs mr-1" style="color:${TYPE_COLORS[x.t]}">${esc(frType(x.t))} ×${x.m}</span>`).join('') || '—'}</p>
          <h3 class="panel-title mt-5 text-sm">Résistances & immunités</h3>
          <p class="mt-2 text-xs text-slate-400">${Object.keys(DEX.types).map((t) => ({ t, m: defensiveMultiplier(v.types, t) }))
            .filter((x) => x.m < 1).map((x) => `<span class="pill pill-xs mr-1" style="color:${TYPE_COLORS[x.t]}">${esc(frType(x.t))} ${x.m === 0 ? '×0' : '×½'}</span>`).join('') || '—'}</p>
          <div class="mt-4 flex gap-2">
            <button type="button" class="btn btn-primary btn-xs" data-add-mon="${v.key}">Ajouter à l’équipe</button>
            <button type="button" class="btn btn-outline btn-xs" data-import-mon="${v.key}">Ouvrir dans l’éditeur</button>
          </div>
        </div>
      </div>`;
    Modals.open('modal-mon');
    $$('#mon-body [data-add-mon], #mon-body [data-import-mon]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.addMon || b.dataset.importMon;
      const slot = this.currentTeam().sets.findIndex((s) => !s);
      if (slot < 0) { Toast.err('Les 6 emplacements sont déjà occupés.'); return; }
      this.currentTeam().sets[slot] = createSet(key);
      this.persist(true);
      this.renderTeam();
      Modals.close('modal-mon');
      this.setView('team');
      this.openEditor(slot);
      Toast.ok(`${displayName(DEX.byKey.get(key))} ajouté à l’emplacement ${slot + 1}.`);
    }));
  },

  renderRules() {
    const meta = DEX.meta;
    const rules = [
      ['Format', 'Double Combat (4v4) — 6 Pokémon enregistrés, 4 choisis à chaque combat.'],
      ['Niveau', 'Tous les Pokémon sont ramenés au niveau 50 (Flat Rules).'],
      ['Clause Espèce', 'Un seul Pokémon par numéro de Pokédex national (les formes régionales comptent comme la même espèce) — « Species Clause ».'],
      ['Clause Objet', 'Aucun objet en double dans l’équipe (166 objets autorisés) — « Item Clause ».'],
      ['Méga-Évolution', 'Autorisée, mais une seule Méga-Évolution par combat : un Pokémon doit tenir la pierre correspondante.'],
      ['Chronomètre', 'Total 20 min · 7 min par joueur · 45 s par tour · 90 s de prévisualisation.'],
      ['Feuille d’équipe', 'Team lists ouvertes : espèce (forme incluse), talent, objet, attaques et nature sont communiqués.'],
      ['Validité', '8 Pokémon interdits : Mythiques et Légendaires restreints sont bannis du règlement.'],
    ];
    $('#rules-list').innerHTML = rules.map(([k, v]) => `<li><strong class="text-white">${esc(k)}</strong> — ${esc(v)}</li>`).join('');
    $('#rules-counts').innerHTML = [
      ['Pokémon légaux', meta.speciesCount],
      ['Formes jouables', DEX.variants.length],
      ['Méga-Évolutions', DEX.variants.filter((v) => v.isMega).length],
      ['Objets', meta.itemCount],
      ['Attaques', meta.moveCount],
      ['Talents', meta.abilityCount],
    ].map(([k, v]) => `<div class="rounded-md border border-ink-800 bg-ink-900/60 px-3 py-2.5">
      <p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">${k}</p><p class="font-display text-xl font-extrabold text-white">${v}</p></div>`).join('');
    $('#rules-megas').innerHTML = DEX.variants.filter((v) => v.isMega)
      .map((v) => `<span class="pill" title="${esc(frItem(DEX.itemsByKey.get(v.requiredItem)))}">${esc(displayName(v))}</span>`).join('');
    $('#rules-items').innerHTML = DEX.items.map((i) => `<span class="pill ${i.isNew ? 'pill-brand' : ''}" title="${esc(frItemText(i))}">${esc(frItem(i))}</span>`).join('');
    $('#rules-sources').innerHTML = `Période : du ${new Date(meta.startDate).toLocaleDateString('fr-FR')} au ${new Date(meta.endDate).toLocaleDateString('fr-FR')} ·
      données générées le ${meta.generated} depuis ${esc(meta.sources.join(' · '))}`;
  },
};

/* ------------------------------------------------------------------ */
/* 10. Aides navigateur : presse-papier et téléchargement             */
/* ------------------------------------------------------------------ */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { Toast.err('Copie impossible — sélectionnez le texte manuellement.'); }
    ta.remove();
    return true;
  }
}
function downloadFile(filename, content) {
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    triggerDownload(filename, URL.createObjectURL(blob));
  } catch {
    triggerDownload(filename, 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
  }
}
function triggerDownload(filename, url) {
  const blob = url;
  const a = document.createElement('a');
  a.href = blob;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(blob); } catch {} }, 1000);
}
