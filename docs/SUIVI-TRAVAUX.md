# Suivi des travaux (à relire à chaque reprise)

Mis à jour : 2026-10-18. Légende : ✅ fait · 🔄 en cours · ⏳ à faire · ⛔ bloqué (en attente de toi)

## Étape 1 — Dotation Vivres & Eau (EN COURS)
- ⛔ Il me faut le **code** de l'application Dotation. Je peux lire tes Docs, Sheets et fichiers texte dans le dossier Drive « Suivi » (sec.infra.rns), mais **pas** les projets Apps Script eux-mêmes.
  - Ce que j'ai trouvé : seulement d'anciennes versions texte du script « Autorisation / Macaron » (`Code source/5.5 à 5.8.txt`), pas la dotation.
  - À faire par toi : ouvrir https://script.google.com/home → trouver le projet de la dotation → *Paramètres du projet* ▸ **ID de script** → me l'envoyer (ou coller le code). Voir `docs/ORGANISATION.md`.
- ⏳ Cause probable de la panne : nouveau format de l'onglet `BDDORGA` (colonne « NOM ET PRENOM » unique, E-Mail en colonne A). À confirmer avec le code.

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
