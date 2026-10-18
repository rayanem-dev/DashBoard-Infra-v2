# Fiche d'évaluation mensuelle des travaux et/ou prestations

L'agent choisit un contrat en exécution (la **cartouche** se remplit depuis le Suivi CPM, en **lecture seule**), clique une case par critère (100 % … 10 %), le **taux de satisfaction globale** se calcule seul, et le PDF reprend la mise en page de la fiche Word. Chaque fiche est **archivée** : on peut l'ouvrir, la télécharger, la **modifier** (elle remplace l'ancienne) ou la **supprimer**.

## Règles
- **Taux** = moyenne des cases cochées (un critère non coché ne compte pas), tronquée à 2 décimales. Vérifié sur la fiche ETB ZATOUT ABDENACER : 11 × 70 % + 2 × 80 % = 71,53 %.
- **Cartouche** : Entrepreneur, Contrat (« 53.INFRA.25 » du CPM devient « I/53/RNS/INFRA/2025 »), Montant (« 162 300 000,00 DA HT »), Date ODS, Date d'entrée en vigueur et Date de mise en service (= date ODS par défaut), Délai (« 36 Mois », plus de 60 = jours), Projet (intitulé). Tout reste modifiable à la main ; Réf et date de la fiche se saisissent.
- **Archive** : un PDF par fiche dans le dossier Drive « Fiches d’évaluation » ; les réponses sont gardées dans la description du fichier (assez pour rouvrir la fiche).

## Mise en service (une fois)
1. Créer un projet Apps Script, y mettre `Code.js`, `Fiche.html` (nom du fichier : `Fiche`) et `appsscript.json`.
2. **Déployer › Application Web** (exécuter en tant que : moi ; accès : tout le monde) et autoriser Sheets (Suivi CPM) et Drive.
3. Ajouter l'adresse `/exec` dans le catalogue du portail (onglet Applications de BDDORGA, module `cpm`, titre « Fiche d'évaluation »).
4. Déploiement automatique : donner l'ID du script et l'ID du déploiement ; un workflow calqué sur `deploy-bon-sortie.yml` se branche sur ce dossier.

## Tests
`node --test apps-script/fiche-evaluation/test/*.test.js`
