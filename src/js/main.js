/**
 * ============================================================================
 * TeamForge M-C — amorçage de l'application
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT (voir LICENSE)
 * ============================================================================
 */
'use strict';

(function bootstrap() {
  const start = () => {
    try {
      if (!window.MC_DATA) throw new Error('Base de données du Règlement M-C manquante.');
      App.bindTeams();
      App.bindSettings();
      App.init();
      // API de débogage / intégration (console, tests, extensions)
      window.TeamForge = {
        version: DEX.version,
        DEX, Store, App, Toast,
        createSet, computeStats, exportSet, exportTeam, parseShowdown, validateTeam, analyzeTeam,
        // Aides d’affichage en français (l’export Showdown reste en anglais)
        frMon, frItem, frMove, frAbility, frMoveText, frItemText, displayName, resolveAbilityName, findMoveByName,
        licence: 'MIT — Copyright (c) 2026 M. Mehdi TANNOUBI',
      };
      console.log(
        '%cTeamForge M-C%c v' + DEX.version + ' — ' + DEX.meta.speciesCount + ' espèces, ' +
        DEX.meta.itemCount + ' objets, ' + DEX.meta.moveCount + ' attaques.\n' +
        'Licence MIT — Copyright (c) 2026 M. Mehdi TANNOUBI. Données 100 % locales. Charte graphique : orange signature #ef6e33.',
        'color:#ffcb05;font-weight:bold', 'color:#94a3b8',
      );
    } catch (error) {
      console.error(error);
      const box = document.createElement('div');
      box.className = 'm-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200';
      box.innerHTML = '<strong>Erreur au démarrage :</strong> ' + (error && error.message ? error.message : error);
      document.body.prepend(box);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
