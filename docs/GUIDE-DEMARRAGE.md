# Guide de démarrage (à faire de votre côté)

## A. Voir le site tout de suite (mode démo, 2 minutes, rien à installer côté Google)
1. Sur GitHub, ouvrez le dépôt `DashBoard-Infra-v2`, branche `claude/exciting-ritchie-u1o1dl` → bouton vert **Code → Download ZIP**.
2. Décompressez, puis double-cliquez sur **`connexion.html`**.
3. Comme `js/config.js` est vide, le site est en **mode démo** (bandeau orange, données fictives) :
   - choisissez un nom dans la liste ; mot de passe **`Demo2026!`** ;
   - ou « Première connexion… » avec le code **`123456`**.
   - 3 profils : chef de division (tout), conducteur (rapports + pilotage), CPM.

## B. Mettre en place la vraie passerelle (compte `sec.infra.rns@gmail.com`)
1. **Sécuriser le compte** : validation en deux étapes + adresse de récupération (myaccount.google.com › Sécurité).
2. **Copier les fichiers** : script.google.com › *Nouveau projet* › nommer « Migration v2 » › coller `apps-script/migration/migrer.gs` › exécuter `migrer` › autoriser. Ouvrir ensuite `DashBoard-Infra v2/98_Systeme_Donnees/Registre_Migration` et me dire les lignes en ERREUR.
3. **Installer la passerelle** : nouveau projet « Passerelle v2 » › créer un fichier par `.gs` de `apps-script/gateway/` (Auth, Applications, Config, Droits, Mail, Main, Setup, Store) + le manifeste `appsscript.json` (Paramètres › « Afficher appsscript.json ») › exécuter `installer` › autoriser. Deux classeurs sont créés (`Gateway_DB`, `Gateway_Secrets`) : **ne partagez jamais `Gateway_Secrets`**.
4. **Utilisateurs** : dans `Gateway_DB › Utilisateurs`, collez depuis `BDDORGA` uniquement : `email, matricule, nom, service, fonction, dependance` et ajoutez `role` (`agent`, `conducteur`, `chef_service`, `chef_division`, `secretariat`, `cpm`) et `actif` = 1. **Jamais** les colonnes de mots de passe. Puis exécutez `genererUids`.
5. **Liens vers les copies** : exécutez `pointerVersCopies` (remplace les liens des originaux par ceux des copies).
6. **Déployer** : Déployer › Nouveau déploiement › *Application Web* › Exécuter en tant que **moi** › Accès **Tout le monde** › copier l'URL `/exec`.
7. **Brancher le site** : dans `js/config.js`, mettre `window.GATEWAY_URL = 'URL /exec'` (ou me l'envoyer, je le fais). Le mode démo disparaît.

## C. Ce qui reste volontairement inchangé
Le site actuel, tous les fichiers d'origine et le fichier Organigramme (traité à la fin, comme décidé).

## Simulation de planning et demandes de modification (module « simulation »)

1. Après le déploiement, lancer **`mettreAJourStructure`** (crée l'onglet `Modifications`, le module « Simulation de planning », la carte et les droits par défaut :
   chef de service / intérim = niveau 2 (leur service), chef de division / secrétariat = niveau 3 (tous)). Les droits se règlent ensuite dans Privilèges comme les autres modules.
2. Page `simulation.html` : choisir l'agent, éventuellement un collègue « en vis-à-vis », saisir les périodes (travail / repos, nombre de jours) ; la rotation habituelle reprend
   automatiquement ensuite. Le bouton « Proposer une combinaison » cherche une transition qui met les deux agents en relève (tolérances de chevauchement / trou réglables).
   **Rien n'est enregistré** tant qu'on ne clique pas sur « Valider ».
3. « Valider » crée une demande numérotée (`MOD-AAAA-NNNN`, statut *en attente*), envoie un e-mail à l'intéressé, à l'émetteur, au chef de division et au secrétariat, et ouvre
   `demande.html` : le document au format papier (Planning actuel / Planning modifié, cadres Décision et Avis du chef de division PE) à imprimer et signer.
4. Onglet « Demandes » : les ayants droit (même portée) **approuvent** ou **refusent**. Approuvée → le planning officiel est recalculé avec la modification (planning global, situation du jour, jauge) ;
   refusée → archivée sans effet.
5. Le moteur est `js/simulation.js` (source unique) : le workflow de la passerelle le copie en `Simulation.gs` avant le déploiement ; il est testé contre le moteur de Sijil (parité).
   Le lien envoyé par e-mail utilise la propriété de script `SITE_URL` (par défaut l'adresse GitHub Pages du portail).

## Affectation du personnel (module « affectation »)

- Page `affectation.html` (carte « Affectation du personnel », module « Affectation (Organigramme) »). Droits par défaut : chef de division et secrétariat = niveau 3 (tout le personnel) ; le niveau 2 (les personnes de **son** service) s'accorde dans Privilèges.
- Changer le service d'une personne : écrit **d'abord dans BDDORGA** (cellule « Service » de sa ligne, repérée par l'e-mail), puis dans la passerelle ; si BDDORGA refuse l'écriture, rien n'est modifié (sinon la synchronisation quotidienne remettrait l'ancien service). Historique dans l'onglet `Affectations` ; e-mail à l'intéressé, à l'auteur, au chef de division et au secrétariat.
- Un service qui n'existe pas encore demande une confirmation de création. Le module se prépare tout seul au premier passage (onglet, module, droits, carte).
- Limite : la page `Organigramme.html` (arbre dépliable) est écrite à la main et ne suit pas encore BDDORGA.

## Reliquat initial et impression PDF

- **Reliquat initial** (jours de congé dus : +, pris en avance : −) : champ « 4. Reliquat initial » dans le formulaire de rotation (valeur par défaut **0**) ; les agents déjà inscrits le voient une seule fois, au premier passage sur le portail (fenêtre « Votre reliquat de congé », 0 par défaut). Il est stocké dans l'onglet `Rotations` (colonne `reliquat`, ajoutée toute seule).
- **Solde** d'un agent = reliquat initial + reliquat laissé (net) par ses demandes de modification **approuvées** (colonnes `reliquat` et `reliquat_net` de l'onglet `Modifications`). Les propositions de la simulation sont classées sur le solde **après** modification.
- **Impression / PDF** : bouton « 🖨 Imprimer / PDF » sur la page Planning (tableau de la période affichée) et sur la page Simulation (périodes + frise + reliquats) ; dans la fenêtre d'impression choisir « Enregistrer au format PDF », format A4 paysage.

## Accueil du portail (lot 1 du remplacement de l'ancien site)

- **Recherche** d'applications et **filtres par module** (onglets), **date du jour**, **synthèses CPM et chantiers** (affichées seulement à qui a accès aux pages « Dossiers CPM » / « Avancement des chantiers »). Pour l'instant les chiffres sont lus comme dans l'ancien accueil (feuille « Suivi CPM V5 » exportée en CSV, page d'avancement) ; ils passeront par la passerelle avec le lot 3 (feuilles privées).
- **Pied de page** = brique `basdepage` de la bibliothèque `lib` (`js/basdepage.js`, appelée par `js/pied.js`) : ligne « Portail Infra · version X (nouveautés) ✓ / ⚠ / ? » + copyright + « ↻ Actualiser ». Le lien « nouveautés » ouvre `changelog.json` ; **pour publier une nouveauté, ajouter une entrée en tête de `changelog.json` et augmenter `window.PORTAIL_VERSION` dans `js/version.js`** (la publication du site génère `version.json` à partir de ce nombre : ⚠ s'affiche tant qu'une page en cache est plus ancienne).
- **Bouton « Installer »** = brique `boutoninstaller` de `lib` (page d'accueil du portail, `manifest.json`, `sw.js` sans cache : plus de mise en cache hors connexion, volontairement, pour ne jamais afficher une ancienne version ni des données d'une session précédente).

## Règle pour les « Nouveautés »
À chaque changement visible, on monte `PORTAIL_VERSION` (`js/version.js`) et on ajoute une entrée en tête de `changelog.json` : un titre « Version X — … » et 2 à 4 phrases courtes, sans détail technique, écrites pour le chef de division (ce qui change pour lui). Les traductions anglaise et arabe de ces phrases vont dans `js/i18n-dico.js`.
