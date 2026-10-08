# Tableau de bord — Division Infrastructure RNS

Portail statique (HTML/CSS/JS, sans build) installable en PWA. Les données viennent de Google Sheets publiés en CSV.

## Pages
- `index.html` — accueil : cartes d'applications, synthèse CPM, historique des modifications
- `Avancement_des_Chantiers.html` — avancement des chantiers (liste `CHANTIERS` en haut du script)
- `Dossiers_CPM.html` — suivi des dossiers CPM
- `Suivi_Chantier.html`, `Organigramme.html` — suivi et organigramme
- `Formulaire.html` — formulaire servi par Google Apps Script (`google.script.run`), `requete.html` y redirige

## Opérations courantes
- **Ajouter un chantier** : ajouter une entrée dans `CHANTIERS` (`Avancement_des_Chantiers.html`) avec son `csvUrl`.
- **Annoncer une modification** : ajouter une entrée en tête de `changelog.json` (`id`, `date`, `title`, `changes`).
- **Hors-ligne** : `sw.js` charge le réseau en priorité et garde la dernière version vue en cache. Incrémenter `CACHE` pour forcer un renouvellement.
