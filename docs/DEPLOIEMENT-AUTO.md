# Déploiement automatique (environnement de test)

À chaque `git push` :
- **Passerelle** (`apps-script/gateway/**`) : tests → `clasp push` → nouvelle version du déploiement existant → **l'URL `/exec` ne change pas**. Workflow : `.github/workflows/deploy-gateway.yml`.
- **Site** (pages HTML, `css/`, `js/`, `sw.js`…) : publication GitHub Pages. Workflow : `.github/workflows/deploy-site.yml`.

## À faire une seule fois (compte `sec.infra.rns@gmail.com`, sur votre PC)
1. Activer l'API Apps Script : https://script.google.com/home/usersettings → « API Google Apps Script » = activée.
2. Installer Node.js, puis dans un terminal : `npm install -g @google/clasp@2` puis `clasp login` → **se connecter avec le compte du secrétariat**.
3. Ouvrir le fichier créé : `~/.clasprc.json` (Windows : `C:\Users\<vous>\.clasprc.json`) et copier tout son contenu.
4. GitHub › dépôt `DashBoard-Infra-v2` › Settings › Secrets and variables › Actions :
   - onglet **Secrets** › New repository secret : nom `CLASPRC_JSON`, valeur = le contenu copié ;
   - onglet **Variables** › New repository variable : `GATEWAY_SCRIPT_ID` = ID du script (projet « Passerelle » › ⚙ Paramètres du projet › ID de script) ;
   - onglet **Variables** : `GATEWAY_DEPLOYMENT_ID` = ID du déploiement (Déployer › Gérer les déploiements › « ID de déploiement » de l'application Web existante, celle dont l'URL est dans `js/config.js`).
5. Site : Settings › Pages › Source = **GitHub Actions** (si GitHub refuse sur dépôt privé, le workflow du site échouera sans gravité : la passerelle, elle, fonctionne).

## Sécurité — à savoir
- `CLASPRC_JSON` donne à GitHub l'accès à l'Apps Script **et à Drive** du compte du secrétariat. Acceptable pour un environnement de test sur un dépôt **privé** ; à **révoquer avant la mise en production** (myaccount.google.com › Sécurité › Accès tiers) puis remplacer par un compte dédié au déploiement.
- Le déploiement n'écrase jamais les données (classeurs) : seul le code est remplacé.
- Une 1re exécution des fonctions `installer`, `genererUids`, etc. reste manuelle (autorisations Google).
