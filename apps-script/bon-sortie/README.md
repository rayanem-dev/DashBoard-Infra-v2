# Bon de sortie matériel

Formulaire → PDF (mise en page du « Bon de sortie matériels Vierge ») → e-mail. Les personnes (nom, fonction, matricule, service) viennent de **BDDORGA** ; la fonction et le matricule se remplissent seuls et restent modifiables ; le preneur peut aussi être saisi librement.

## Mise en service (une fois)
1. Créer un projet Apps Script (compte qui déploie : celui des autres applications), y coller `Code.js`, `BonSortie.html` (nom du fichier : `BonSortie`) et `appsscript.json` (Paramètres du projet › afficher le manifeste).
2. **Déployer › Nouveau déploiement › Application Web** (exécuter en tant que : moi ; accès : tout le monde) ; autoriser les accès demandés (Sheets, Drive, e-mail).
3. Ajouter l'adresse `/exec` dans le catalogue du portail (onglet Applications de BDDORGA : module `logistique`, titre « Bon de sortie matériel »).
4. Les PDF sont rangés dans le dossier Drive « Bons de sortie matériel » (créé au premier bon). Adresses utiles en haut de `Code.js` : `EMAIL_SECRETARIAT`, `PRINTBYXEROX_EMAIL`, `SHEET_ID` (fichier Organigramme).

## Déploiement automatique
Branché : `.github/workflows/deploy-bon-sortie.yml` lance les tests, envoie le code avec clasp et publie une nouvelle version **sur la même adresse `/exec`** à chaque modification de ce dossier. Le compte du secret `CLASPRC_JSON` doit avoir accès en modification au projet Apps Script.

## Tests
`node --test apps-script/bon-sortie/test/*.test.js` : lecture de BDDORGA, mise en page du bon (échappement, pointillés du modèle), adresses e-mail.
