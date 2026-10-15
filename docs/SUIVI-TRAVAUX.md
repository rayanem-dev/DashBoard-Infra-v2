# Suivi des travaux (à relire à chaque reprise)

Mis à jour : 2026-10-18. Légende : ✅ fait · 🔄 en cours · ⏳ à faire · ⛔ bloqué (en attente de toi)

## Étape 1 — Dotation Vivres & Eau (CORRIGÉE, en attente de test)
- ✅ Code importé dans `apps-script/dotation/` (ID de script `1KwAr_pkeQnocXG5ksMX8engvF_6PyhzwEZpC_i_tpXdIycKw7mxqZFNu`).
- ✅ Cause : le script lisait `BDDORGA` par numéro de colonne (B = service, D = dépendance, E = nom) ; le fichier a maintenant E-Mail en A et « NOM ET PRENOM » en C. Corrigé : lecture par **nom d'en-tête**, ancien et nouveau format acceptés, message clair si une colonne manque. 3 tests.
- ✅ Déploiement automatique (`deploy-dotation.yml`) sur la même adresse /exec.
- ⏳ À toi : tester la dotation après le déploiement.
- ⚠️ À vérifier : `ENTRETIEN_TEMPLATE_ID` (`1waO8d_…`) est un fichier .docx, or `DocumentApp` ne sait ouvrir qu'un Google Doc : utiliser le Google Doc « DOTATION PRODUITS D'ENTRETIEN » (`11DHNDUKWdfv5l3DLGl51eJUPG3KF7pTQ7no4CXv9rPg`) si la dotation Entretien échoue.

## Étape 2 — Regrouper tous les scripts dans le dépôt
- ✅ Workflow « Importer des scripts » (Actions) + règle anti-secrets, dépôt public.
- ⏳ IDs de script à fournir : Dotation, Prises en charge + Autorisation, Commande de pièces, Requête transport.
- ⏳ Ranger le dossier Drive « DashBoard-Infra v2 » (lien non partagé avec mon accès : à partager).

## Étape 3 — Stabilité de la passerelle (erreur « Unexpected token '<' »)
- ✅ 5.0.1 : lectures rejouées + message clair.
- ⏳ À toi : après test de la 5.0.1, me donner le message affiché + regarder « Exécutions » dans Apps Script.

## Étape 4 — Badges prestataires
- ✅ Code complet et testé (moteur, application autonome, page portail, passerelle) — retiré provisoirement du déploiement (commit c7cb9e4, à remettre).
- ⏳ Remettre en ligne en 2 temps (site seul, puis passerelle) après l'étape 3.
- ⏳ Mise en route : convertir « Enquêtes administratives » en Google Sheets, propriété `BADGES_ENQUETES_ID`, `badgesVerifierSources`, `ajouterApplicationsManquantes`, droits du module « badges ».
- ⏳ Application « Prise en charge » : champ « fonction », détection de la personne, journal + injection dans Enquêtes (code de l'application nécessaire).

## Autres rappels
- ⏳ Révoquer la clé de déploiement `CLASPRC_JSON` avant la mise en production (je te guide pas à pas).
- ⏳ Droits de partage Drive : SUIVI VH, Ecarts INFRA à partager ; fichiers « anyone writer » à restreindre ; Suivi CPM V5 à remettre en « Restreint ».
- ⏳ Mots de passe en clair dans « Organigrame Div Infra » (onglets WiFi, Personnel Division Infra, Feuille 5) : à retirer ou restreindre.
- ⏳ Traduction arabe/anglais de la page Badges.
