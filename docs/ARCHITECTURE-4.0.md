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
- **Connexion par recherche** : la page de connexion **ne charge aucune liste**. La personne tape son nom ou son prénom (3 lettres minimum) ; le serveur renvoie au plus 8 correspondances (**nom et service seulement**, jamais d'e-mail, de matricule ni de numéro ; identifiant opaque `uid`). Elle se sélectionne, puis saisit son mot de passe. Limite connue : en tapant des suites de 3 lettres, on peut quand même découvrir des noms un par un ; c'est lent et bien moins exposé qu'une liste complète.
- **Première connexion / mot de passe oublié** : même chemin, comme dans Sijil. Un **code à usage unique de 30 min** part par e-mail (adresse de `BDDORGA`, affichée masquée) ; l'utilisateur définit alors son mot de passe. On n'envoie jamais un mot de passe. Le secrétariat garde un code de secours (48 h) pour les comptes sans e-mail.
- **Mot de passe applicatif propre** : sel + poivre + SHA-256 itéré, dans un classeur séparé (`Gateway_Secrets`). 4 caractères minimum (choix du propriétaire). 5 tentatives / 15 min, 3 codes / heure. Session 6 h ; case **« Rester connecté »** : jeton aléatoire de 30 jours (seule son empreinte est stockée côté serveur), renouvelé à chaque reprise, supprimé à la déconnexion.
- **Modules et privilèges** : un module = un ensemble de logiciels. Niveaux : 1 lecture, 2 saisie, 3 administration. Droits par rôle (`DroitsRole`) + exceptions individuelles (`Exceptions`, niveau 0 = retrait explicite). Le menu du tableau de bord est construit à partir de ce que l'utilisateur peut ouvrir.
- **Rôles modifiables** (onglet `Roles` de `Gateway_DB`, ou page Privilèges › Rôles) : créer, renommer, supprimer. Rôles d'origine : `agent`, `conducteur`, `dessinateur`, `chef_atelier`, `chef_service`, `interim_chef_service`, `cadre_sup`, `chef_division`, `ordonnateur`, `cpm`, `secretariat`, `prestataire`, `guest`. Chaque rôle a un **niveau maximum** (plafond absolu) et des **modules interdits** : `guest` = lecture seule, jamais `securite/rh/admin/planning/badges` ; `prestataire` = saisie au plus, jamais `securite/rh/admin`. Un rôle utilisé par des personnes ne peut pas être supprimé ; `secretariat` est indélébile (anti-verrouillage). Les variantes d'écriture (`Cadre_Sup`, `secretaire`, `ordonateur`…) sont reconnues.
- **Applications** : chacune a un niveau minimal dans son module et, en option, une liste de rôles autorisés (onglet Applications de la page Privilèges).
- `prestataire` et `guest` n'ont **aucun droit par défaut** : on ouvre module par module. Prochaine étape pour les prestataires : limiter aux données de leur propre société.

## Sijil (pointage-app, v3.33) — ce qu'on réutilise
Sijil est déjà une application Apps Script + Sheets avec : authentification (hash + sel), rôles agent / responsable d'équipe / admin, multi-entreprises, **moteur de rotation `Cycle.gs`** (T/R, 28/28, 14/14, 4/4, prévisions, `dayInfo` = statut du jour + jours restants + date du changement), pointage, demandes, documents, e-mails.
- **Planning global** : la Division Infra devient une « entreprise » Sijil ; le tableau de planning de tous les utilisateurs vient de ses données de pointage.
- **Message d'accueil** « Bonjour M. X, vous êtes au travail depuis … il vous reste … jours » : la passerelle interroge Sijil (`dayInfo`) avec l'e-mail de l'utilisateur. À la première connexion, 3-4 questions (où êtes-vous, quelle rotation, dernier jour de relève) créent le premier pointage → le moteur calcule la suite tout seul.
- **À faire côté Sijil** (dépôt `pointage-app`, accès en lecture seule pour l'instant) : un petit point d'entrée serveur-à-serveur protégé par un secret partagé, renvoyant `dayInfo` / planning par e-mail. Aucune modification tant que vous ne l'avez pas validée.

## Planning & rotations (module `planning`)
- Vues **Mois / 3 mois / 6 mois / 1 an** (navigation ‹ ›, « Aujourd'hui »), une frise par personne : travail / repos / absence, trait noir = aujourd'hui, survol = dates et durée. Calcul par le moteur de Sijil (copié à l'identique : `Cycle.gs`, `Dates.gs`).
- Niveaux : **1** voit **son** planning · **2** voit tout le monde, avec **sélecteur de services** (cases à cocher, mémorisé) · **3** modifie aussi la rotation de chacun. Par défaut : chef de service et intérim = 2 ; chef de division et secrétariat = 3 ; tous les autres = 1 (`appliquerDroitsPlanning`).
- Portail : la fiche de l'utilisateur (matricule, fonction, service, employeur, rôle, e-mail, téléphone) et sa situation du jour. Colonnes optionnelles `telephone` et `civilite` (« Monsieur », « Madame ») de l'onglet `Utilisateurs`.
- Pied de page « Propulsé par Sijil » (lien réglable : `SIJIL_URL` dans `js/config.js`).

## Synchronisation avec BDDORGA
`Utilisateurs` (dans `Gateway_DB`) est une **copie** de l'onglet BDDORGA : elle ne se met pas à jour toute seule tant que la synchro n'est pas activée. `previsualiserSynchro()` montre les changements sans rien écrire ; `synchroniserDepuisBDDORGA()` les applique ; `activerSynchroQuotidienne()` la programme chaque jour vers 6 h. Seules les colonnes d'identité sont lues (nom, e-mail, matricule, service, poste, employeur, téléphone) — jamais les mots de passe ni identifiants du fichier. Les nouveaux arrivent **sans rôle** (donc sans accès) ; personne n'est supprimé ni désactivé automatiquement ; `role`, `actif`, `uid`, `civilite` ne sont jamais modifiés.

## Fiche de l'agent (portail)
Avatar (initiales, teinté à la couleur de l'employeur), nom, poste, service, employeur, rôle ; tuiles : matricule, **identifiant SONA**, fonction, service, e-mail, téléphone, **date d'intégration et ancienneté**. À droite, une **jauge de rotation** : anneau (jour en cours sur la durée de la période, vert = travail, orange = repos, palette Sijil), jours restants, date du prochain changement. Les colonnes `sona` et `date_integration` viennent de BDDORGA ; les mots de passe, identifiants Wi-Fi et numéros d'identité n'en sont jamais lus.

## Employeurs (ACOSCO, GTP…)
La colonne « dépendance » de BDDORGA donne l'employeur. Dans le planning, les privilèges et le portail, chaque personne porte une pastille et une teinte à la couleur de son employeur (ACOSCO violet clair `#D9D2E9`, GTP vert clair `#D9EAD3`, comme dans le fichier Organigramme). Réglable dans `js/config.js` (`window.EMPLOYEURS`). Le planning a un filtre par employeur.

## Mot de passe provisoire (saisie des rotations)
`definirMotDePasseParDefaut()` donne « 0000 » aux comptes qui n'ont pas encore de mot de passe, **sans expiration : il reste valable jusqu'à ce que la personne le change** (option : `definirMotDePasseParDefaut(7)` pour l'arrêter après 7 jours). Les comptes à large visibilité (secrétariat, chef de division, chefs de service et intérims, accès sécurité) sont exclus par défaut. Une bannière invite à le changer ; « 0000 » ne peut pas être gardé. `retirerMotsDePasseParDefaut()` = coupe-circuit immédiat.

## Rapports journaliers (module `rapports`)
- Onglets `Chantiers` (liste des chantiers saisissables, modifiable) et `Rapports` (un rapport par **jour + chantier + auteur** ; ressaisir le même jour modifie le rapport). Cellules en texte brut : aucune formule ni date convertie.
- Niveaux : **1** voit ses rapports · **2** saisit, voit et vise ceux de son service (pas les siens) · **3** voit et vise tout, **synthèse du jour** par chantier (avec les chantiers sans rapport), saisie jusqu'à 60 jours en arrière.
- Saisie : chantier, date (7 jours en arrière au plus), effectif, travaux réalisés, difficultés, commentaire, avancement estimé (facultatif).
- **Pas encore fait** : écriture directe dans les fiches suiveuses Google Sheets et affichage des commentaires sur la page d'avancement (leurs structures diffèrent : puits, items BPU, électrique) — à cadrer ensemble ; la page d'avancement lit encore des exports publics, elle passera par la passerelle à la bascule.

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
