# Architecture 4.0 — tableau de bord sécurisé

Principe : **on travaille sur une copie** (dossier « DashBoard-Infra v2 » du compte du secrétariat). Rien n'est modifié, déplacé ni supprimé dans l'organisation actuelle ; le site actuel (`DashBoard-Infra`) continue de tourner. On bascule quand le v2 est testé.

## Vue d'ensemble
```
Navigateur / PWA (GitHub Pages, site statique)
        │  POST JSON (token de session)
        ▼
Passerelle Apps Script  ── lit/écrit ──►  Classeurs privés (dossier v2)
 (apps-script/gateway)                     • Gateway_DB      : Utilisateurs, Modules, DroitsRole, Exceptions, Journal
        │                                  • Gateway_Secrets : empreintes des mots de passe (jamais partagé)
        │                                  • Fiches chantiers, Suivi CPM, rapports, plannings…
        └── appelle ──► Sijil (pointage-app) pour la situation du jour (T/R, jours restants)
```
Règle d'or : **les données ne sortent que par la passerelle, après contrôle du jeton et des droits.** Plus aucun lien public « export CSV » une fois la bascule faite.

## Identité et accès
- **Source des utilisateurs** : onglet `BDDORGA` de « Organigrame Div Infra » (division, service, fonction, dépendance, nom, matricule, e-mail). On en extrait **seulement** ces colonnes vers `Gateway_DB › Utilisateurs` ; **les colonnes de mots de passe (Windows, Wi-Fi) ne sont jamais copiées**.
- **Mot de passe applicatif propre** : chacun en choisit un à la première connexion avec un **code d'activation à usage unique** (48 h) remis par le secrétariat. Stockage : sel + poivre + SHA-256 itéré, dans un classeur séparé. 5 tentatives / 15 min par e-mail. Session 6 h.
- **Modules et privilèges** : un module = un ensemble de logiciels. Niveaux : 1 lecture, 2 saisie, 3 administration. Droits par rôle (`DroitsRole`) + exceptions individuelles (`Exceptions`, niveau 0 = retrait explicite). Le menu du tableau de bord est construit à partir de ce que l'utilisateur peut ouvrir.
- Rôles par défaut : `agent`, `conducteur`, `chef_service`, `chef_division`, `secretariat`, `cpm` (modifiables dans la feuille).

## Sijil (pointage-app, v3.33) — ce qu'on réutilise
Sijil est déjà une application Apps Script + Sheets avec : authentification (hash + sel), rôles agent / responsable d'équipe / admin, multi-entreprises, **moteur de rotation `Cycle.gs`** (T/R, 28/28, 14/14, 4/4, prévisions, `dayInfo` = statut du jour + jours restants + date du changement), pointage, demandes, documents, e-mails.
- **Planning global** : la Division Infra devient une « entreprise » Sijil ; le tableau de planning de tous les utilisateurs vient de ses données de pointage.
- **Message d'accueil** « Bonjour M. X, vous êtes au travail depuis … il vous reste … jours » : la passerelle interroge Sijil (`dayInfo`) avec l'e-mail de l'utilisateur. À la première connexion, 3-4 questions (où êtes-vous, quelle rotation, dernier jour de relève) créent le premier pointage → le moteur calcule la suite tout seul.
- **À faire côté Sijil** (dépôt `pointage-app`, accès en lecture seule pour l'instant) : un petit point d'entrée serveur-à-serveur protégé par un secret partagé, renvoyant `dayInfo` / planning par e-mail. Aucune modification tant que vous ne l'avez pas validée.

## Phases
1. Dossier v2 + copie des fichiers (`apps-script/migration/migrer.gs`) — **prêt**
2. Passerelle : connexion, activation, droits, menu (`apps-script/gateway/`) — **base écrite, 6 tests**
3. Page de connexion + menu dynamique sur le site v2
4. Page « Privilèges » (administration des rôles / exceptions / codes d'activation)
5. Planning global + message d'accueil (via Sijil)
6. Rapports journaliers (conducteur → fiche chantier → tableau de bord, commentaires)
7. Journal des changements du Suivi CPM (instantané quotidien → comparaison par n° de dossier → journal → rapport hebdomadaire)
8. Générateur de badges prestataires
9. Bascule des pages vers la passerelle, passage des Sheets en privé, nettoyage (dont le fichier Organigramme)

## Points de vigilance
- Apps Script : quotas (appels / jour, 6 min par exécution), cache 6 h max. Suffisant pour une division ; à surveiller si l'usage grandit.
- Le fichier Organigramme (mots de passe en clair, partagé par lien) est traité **en dernier**, comme décidé.
- Compte du secrétariat : validation en deux étapes obligatoire + adresse de récupération.
