# TeamForge M-C — Teambuilder VGC (Règlement M-C)

Application web **statique** (SPA HTML5 + Tailwind CSS + JavaScript ES6, **sans backend**) pour construire
et valider des équipes Pokémon du **Règlement M-C** de *Pokémon Champions* (format VGC Doubles 4v4, 9 septembre → 2 décembre 2026).

> **Interface intégralement en français** — espèces, formes, talents, objets, attaques, natures, types, clauses et
> messages. **Seule exception : l’export Pokémon Showdown**, qui utilise les noms anglais officiels du simulateur
> (`Annihilape @ Leftovers`), et l’import, qui accepte les deux langues.

> **Licence MIT — Copyright (c) 2026 M. Mehdi TANNOUBI** · pied de page du site : « © 2026 M. Mehdi TANNOUBI - Sous licence MIT ».

---

## 1. Livrables

| Fichier | Rôle |
|---|---|
| **`index.html`** | Application complète **en un seul fichier** (CSS compilé + données M-C + code JS inclus). Il suffit de l’ouvrir dans un navigateur. |
| `index-modular.html` | Même application en **fichiers séparés** (`assets/css/tailwind.css`, `data/data.js`, `src/js/*.js`) — pratique pour lire/faire évoluer le code. |
| `data/data.js` | Base de données **Règlement M-C** embarquée (`window.MC_DATA`) : Pokédex autorisé, formes, Méga-Évolutions, objets, talents, natures, types et **toutes les attaques par Pokémon**. Également disponible en JSON : `data/data.json`. |
| `src/` | Sources (gabarit HTML, feuille Tailwind, modules JS commentés). |
| `tools/` | Pipeline de génération des données (`build_data.mjs`, `fr_names.mjs`), assemblage, tests automatisés et captures. |
| `screenshots/` | Captures d’écran de référence de l’interface (`npm run shots`). |
| `srcdata/` | Sources brutes collectées (Pokémon Showdown, mod *champions*, **PokéAPI**) utilisées par le pipeline — régénérables. |
| `LICENSE` | Licence MIT (Copyright (c) 2026 M. Mehdi TANNOUBI). |

Aperçus : `screenshots/cc-1-team.png` (teambuilder), `cc-2-editor.png` (éditeur),
`cc-3-dex.png` (Pokédex), `cc-4-rules.png` (règlement), `cc-6-io.png` (import/export),
`cc-7-settings.png` (RGPD), `cc-0-consent.png` (bannière de consentement),
`cc-8-mobile-team.png` / `cc-9-mobile-dex.png` (mobile). Régénérer avec `npm run shots`.

## 2. Identité visuelle

L’interface reprend la charte de **[coupcritique.fr](https://www.coupcritique.fr/)** :

| Élément | Valeur |
|---|---|
| Fond / surfaces | `#000000` · `#141517` · `#1c1d1f` · `#232528` — bordures `#2f3136` / `#3d4147` |
| Orange signature | `#ef6e33` (survol `#f58549`, appui `#d9561f`) — boutons **pilules**, liens, accents |
| Rouge accent | `#e03e2d` (badges MÉGA, alertes, bouton de suppression) |
| Dégradé héro | `#f7a83c → #f0803a → #e8562a` (bandeau d’accueil, logo, barres de statistiques) |
| Typographie | titres *poppins*, texte *hind* — référencées **par nom uniquement** (repli système : aucun appel réseau, aucun tiers) |
| Formes | coins 8 px, cartes à liseré sombre, ombres douces, transitions 150 ms |

**Icône du site** : `assets/icons/favicon.svg` — Pokéball noire à hémisphère orange dégradé, éclair orange et
étincelle jaune `#f7b23c`. Elle sert de **favicon** (`<link rel="icon" type="image/svg+xml">`) et de **logo
inline** dans l’en-tête (`#brand`, dégradé `lg-brand`), donc sans requête réseau supplémentaire.

Éléments d’interface notables : barre de recherche balayant la largeur sous l’en-tête, raccourcis
« Ajouter un Pokémon » / « Import / Export », bandeau latéral dégradé (statistiques clés, recherche, sprite du
premier Pokémon de l’équipe, position collante au défilement), compteurs en pastilles, navigation mobile
défilante, barre de consentement RGPD à trois boutons.

## 3. Langue de l’application

* **100 % français** dans l’interface : « Dracaufeu », « Méga-Dracaufeu X », « Raichu d’Alola », « Restes »,
  « Orbe Vie », « Acharné », « Poing de Colère », « Séisme », « Jovial », « Combat/Spectre », « clause Espèce »,
  « clause Objet », statistiques abrégées « PV / Att / Déf / Att.Sp / Déf.Sp / Vit ».
* **Noms officiels** issus de **PokéAPI** (colonnes françaises) pour les 351 formes, 677 attaques, 216 talents et
  166 objets ; les descriptions d’attaques et d’objets sont également en français.
  * Cas particuliers : 3 capacités exclusives à *Pokémon Champions* (`Aura Guard`, `Eelevate`, `Fire Mane`) n’ont
    pas de traduction officielle — elles reçoivent un intitulé français signalé comme non officiel
    (« Garde Aura », « Élévation », « Crinière de Feu ») ; 7 formes sont recomposées
    (« Famignol Famille de Quatre », « Tauros de Paldéa (Combat) »…).
* **Recherche bilingue** : taper « garchomp » *ou* « carchacrok », « leftovers » *ou* « restes » donne le même résultat.
* **Import tolérant** : un export traduit (« Dracaufeu @ Restes / Talent : Brasier / Nature Jovial / EVs: 252 PV /
  4 Att. / 252 Vit. / - Séisme ») est reconnu aussi bien que le format anglais.
* **Exception assumée** : l’**export** reste en anglais, comme l’exige le simulateur Pokémon Showdown ; l’aperçu,
  la copie et le fichier `.txt` sont identiques à l’exemple de référence. L’interface le signale explicitement
  (« Format anglais Showdown ») dans l’éditeur et la modale d’import/export.

## 4. Fonctionnalités

### Teambuilder
* Équipe de **1 à 6 Pokémon**, 6 emplacements en cartes synthétiques (sprite, nom/forme, types, **objet**, **type Téra**, statistiques niveau 50, attaques).
* **Vérification du Règlement M-C** en direct : Species Clause (n° de Pokédex, formes régionales incluses),
  Item Clause, une seule Méga-Évolution par combat, Pokémon/objets/attaques autorisés.
* **Éditeur détaillé** (panneau latéral) par Pokémon : espèce, forme/Méga, surnom, objet, talent, nature,
  niveau, type Téra, EVs (0-252) et IVs (0-31) avec **compteur d’EVs restants sur 510**, jusqu’à 4 attaques.
* **Calcul des statistiques niveau 50** selon la formule officielle (arrondis + bonus/malus de nature), rafraîchi en temps réel.
* **Autocomplétion** (recherche floue, insensible aux accents) pour l’espèce, l’objet, le talent et les 4 attaques — le pool d’attaques est filtré sur le movepool réel de chaque forme.
* Analyses d’équipe : vitesses, faiblesses/résistances cumulées, total d’EVs, nombre d’attaquants physiques…
* **Pokédex M-C** (238 espèces officielles, 351 formes jouables, 82 Méga-Évolutions) et **vue Règlement** (objets, Méga, chronomètres).

### Import / Export Pokémon Showdown
Export au format exact du simulateur :

```
Annihilape @ Leftovers
Ability: Defiant
Level: 50
Tera Type: Fire
EVs: 252 HP / 4 Atk / 252 Spe
Jolly Nature
IVs: 31 HP / 31 Atk / 31 Def / 31 SpA / 31 SpD / 31 Spe
- Rage Fist
- Drain Punch
- Bulk Up
- Protect
```

* Bouton **« Copier dans le presse-papier »**, export **.txt**, copie Pokémon par Pokémon.
* **Import** tolérant : export Showdown complet, fichier `.txt`, ou simple liste de Pokémon ; les surnoms,
  natures françaises ou anglaises, EV/IV partiels et pierres Méga (bascule automatique vers la bonne forme) sont gérés ; un rapport signale les écarts.

### Compte local (sans serveur)
* **Création de compte / connexion / déconnexion** 100 % côté client (`localStorage`), mot de passe **jamais stocké en clair** (PBKDF2-SHA256, 150 000 itérations, sel aléatoire de 16 octets).
* **Plusieurs équipes** par compte (création, renommage, chargement, suppression).
* **Mode invité** : une seule équipe temporaire ; elle est proposée au transfert lors de la création d’un compte.

### RGPD
* **Bannière de consentement** à la première visite (accepter / refuser). En cas de refus, l’application fonctionne **en mémoire volatile** : rien n’est écrit sur l’appareil.
* Message explicite : **aucun serveur, aucune donnée personnelle ni équipe transmise** ; seule requête externe = les sprites officiels Pokémon Showdown.
* **Politique de confidentialité** complète (modale) : données traitées, finalité, base légale, durée, droits, sécurité, marques.
* Bouton **« Supprimer mon compte et mes données »** : efface immédiatement tout le stockage applicatif (compte, équipes, préférences).
* **« Exporter mes données (JSON) »** : droit à la portabilité.

## 5. Lancer le projet

```bash
# Aucune installation nécessaire : ouvrez simplement index.html
xdg-open index.html          # Linux
open index.html              # macOS

# ou servez le dossier (utile pour tester index-modular.html)
python3 -m http.server 8000
```

## 6. Régénérer les données et reconstruire l’application

```bash
npm install                  # tailwindcss (+ jsdom & playwright pour les tests)
npm run build:data           # base du règlement M-C + enrichissement français (PokéAPI)
npm run i18n                 # uniquement l’enrichissement des noms français
npm run build                # compilation Tailwind + index.html & index-modular.html
npm test                     # 81 tests : noyau (40) + intégration DOM jsdom (41)
npm run test:ui              # 44 tests de bout en bout dans Chromium (Playwright)
npm run shots                # captures de référence (screenshots/cc-*.png)
```

> Les tests Playwright nécessitent Chromium : `npx playwright install chromium` (et, sous Linux,
> les bibliothèques système listées par Playwright).

### Sources de données (tools/build_data.mjs)
| Élément | Source |
|---|---|
| Roster officiel **260 Pokémon** et **166 objets** du Règlement M-C | metavgc.com/regulations/regulationm-c (recoupé avec Bulbapedia) |
| Légalité, formes autorisées, **movepools**, tiers, objets | mod **`champions`** de Pokémon Showdown (`data/mods/champions/{formats-data,learnsets,items}.ts`) — données officielles du simulateur |
| Statistiques de base, types, talents, table des types, descriptions | Pokémon Showdown (`pokedex`, `moves`, `abilities`, `typechart`, `data/text/*`) |
| **Noms français officiels** (espèces, formes, Méga, attaques, talents, objets) et descriptions d’attaques | **PokéAPI** (`tools/fr_names.mjs` : `pokemon_species_names`, `pokemon_form_names`, `move_names`, `ability_names`, `item_names`, `move_flavor_text`) |
| Libellés français complémentaires (objets, baies, talents) | `tools/fr_text.mjs` + table de traductions manuelles pour les capacités propres à Pokémon Champions |

> Le règlement M-C liste 260 **entrées** (238 espèces/forms de base + 22 Méga-Évolutions) auxquelles s’ajoutent
> les formes régionales et les Méga-Évolutions héritées des règlements précédents : l’application expose donc
> **351 variantes jouables**, dont **82 Méga-Évolutions**.

## 7. Architecture du code

```
index.html               application autonome (générée)
index-modular.html       version multi-fichiers (générée)
assets/css/tailwind.css  Tailwind compilé
assets/icons/favicon.svg icône du site (favicon + logo d’en-tête)
data/data.js             données Règlement M-C (window.MC_DATA)
src/template.html        gabarit HTML commenté
src/css/app.css          composants de la charte Coup Critique (@layer components : panel, btn, pill, hero, slot-card…)
src/js/core.js           noyau : index du Pokédex, calculs de stats, validation M-C, import/export Showdown, analyse d’équipe
src/js/store.js          stockage local : consentement RGPD, comptes (PBKDF2), sessions, équipes, export/effacement
src/js/ui.js             interface : rendu des cartes, éditeur, autocomplétions, modales, Pokédex, règlement
src/js/main.js           amorçage + API publique window.TeamForge (console)
tailwind.config.js       palettes ink/brand/accent, polices, dégradés
screenshots/             captures d’écran de référence (charte Coup Critique)
tools/                   pipeline de données (build_data.mjs, fr_names.mjs), assemblage (assemble.mjs),
                         tests (test_core.js, test_app.mjs, test_ui.mjs) et captures (screenshot.mjs)
```

Le code est commenté en français et expose une API de débogage : `window.TeamForge` (`DEX`, `Store`, `App`,
`createSet`, `computeStats`, `exportSet`, `parseShowdown`, `validateTeam`, `analyzeTeam`…).

## 8. Notes techniques

* Statistiques : `PV = ⌊(2·Base + IV + ⌊EV/4⌋)·Nv/100⌋ + Nv + 10` ;
  autres `= ⌊(⌊(2·Base + IV + ⌊EV/4⌋)·Nv/100⌋ + 5)·Nature⌋` — bonus 1,1 / malus 0,9.
* Contrôles appliqués : 510 EVs maximum au total, 252 par statistique, IVs 0-31, 4 attaques maximum, items et talents légaux uniquement.
* Sprites : `https://play.pokemonshowdown.com/sprites/gen5/` (repli `ani/` puis forme de base, puis pastille colorée si hors ligne).
* Noms français : deux champs cohabitent dans les données — `name`/`n` (anglais, pour l’export Showdown) et
  `frName` (français, pour l’affichage). Aucune donnée n’est traduite à la volée par un service externe.
* Polices : `poppins` / `hind` demandées par leur nom ; aucun `<link>` externe (le rendu retombe sur les polices système si elles ne sont pas installées) — aucune requête tierce, aucun traceur.
* Aucune donnée personnelle n’est envoyée : les seules requêtes réseau sont le chargement des sprites.

## 9. Licence et mentions

MIT — **Copyright (c) 2026 M. Mehdi TANNOUBI**. Voir `LICENSE`.

Pokémon, Pokémon Champions et les noms des Pokémon sont des marques déposées de Nintendo, Creatures Inc. et
GAME FREAK inc. Projet non officiel, sans lien avec The Pokémon Company. Sprites fournis par Pokémon Showdown.
