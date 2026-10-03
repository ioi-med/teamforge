/**
 * Configuration Tailwind CSS de TeamForge M-C.
 * Charte graphique inspirée de Coup Critique : noir profond, surfaces grises,
 * orange signature en couleur d'action, boutons pilules, angles discrets.
 * Copyright (c) 2026 M. Mehdi TANNOUBI — Licence MIT
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/template.html', './src/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // Surfaces : noir de page + gris neutres (aucune teinte bleutée)
        ink: {
          950: '#000000',   // fond de page
          900: '#141517',   // surface haute (modales, panneaux)
          850: '#1c1d1f',   // cartes
          800: '#232528',   // cartes survolées / en-têtes
          700: '#2f3136',   // champs, bordures
          600: '#3d4147',   // bordures appuyées
        },
        // Orange signature Coup Critique
        brand: {
          200: '#ffd9bd',
          300: '#ffb27a',
          400: '#f58549',   // survol clair
          500: '#ef6e33',   // couleur d'action principale
          600: '#d9561f',
        },
        // Rouge des badges / alertes
        accent: {
          400: '#ef5a4a',
          500: '#e03e2d',
          600: '#b93122',
        },
      },
      fontFamily: {
        sans: ['hind', 'Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['poppins', 'hind', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        // Dégradé du bandeau d’accueil (identique à l’esprit Coup Critique)
        hero: 'linear-gradient(135deg, #f7a83c 0%, #f0803a 45%, #e8562a 100%)',
        action: 'linear-gradient(180deg, #f58549 0%, #e8562a 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.5)',
        lift: '0 10px 30px rgba(0,0,0,.55)',
      },
    },
  },
  plugins: [],
};
