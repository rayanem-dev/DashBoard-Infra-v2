# Sécurité du portail — contrôle du 24/10/2026

## Ce qui est public aujourd'hui
Le dépôt `rayanem-dev/DashBoard-Infra-v2` est **public**, et son site (GitHub Pages) l'est aussi : tout fichier publié sur le site se lit sans connexion à l'adresse `https://rayanem-dev.github.io/DashBoard-Infra-v2/…`.

| Élément | Où | Risque | État |
|---|---|---|---|
| Fiches contact (≈ 450 téléphones / e-mails) | `js/annuaire-data.js` (publié sur le site) | lisible par tous | **corrigé** : source déplacée en `data/annuaire-data.js` (non publiée), servie par la passerelle seulement après connexion (action `annuaire_fiches`), garde-fou dans `deploy-site.yml` |
| Code serveur Apps Script, identifiants de classeurs et de déploiements | dépôt (`apps-script/`, `Setup.gs`, `Applications.gs`, `docs/`) | lisible si le dépôt est public (n'est **pas** publié sur le site : le site ne reprend que les pages, `css`, `js`, `img`, `badges`) | à résoudre en passant le dépôt en **privé** |
| Liens Google Sheets de `Suivi_Chantier.html` (≈ 20) | page publiée sur le site | si un classeur est partagé « toute personne disposant du lien », le lien dévoilé donne accès | **à vérifier dans Drive** : repasser en « Restreint » ou limiter à l'organisation |
| Indexation par les moteurs de recherche | toutes les pages | pages trouvables | **corrigé** : `noindex, nofollow` sur chaque page, `robots.txt` (Disallow: /), `referrer same-origin` |

## Ce qui est sain
- Aucun secret dans le code ni dans l'historique (recherche de clés API, jetons GitHub, clés privées, `client_secret`, `refresh_token` : rien). Le jeton `CLASPRC_JSON` des déploiements est dans les *secrets* GitHub.
- Jeton de session gardé dans l'onglet (`sessionStorage`) et envoyé dans le corps des requêtes, jamais dans l'adresse.
- Passerelle : chaque action (sauf connexion, code, mot de passe oublié, « liste » de la page de connexion) contrôle la session, puis le droit (module / niveau / rôle). Vérifié action par action.
- Rendu des données sans `innerHTML` brut dans les pages du portail (texte sûr).

## Dépôt de code privé + dépôt public réduit au site (marche à suivre)
GitHub Pages ne publie pas depuis un dépôt privé avec l'offre gratuite : le site passe donc par un **second dépôt public qui ne contient que le site**. Rien n'est à recoder : les applications Apps Script (déployées par leurs propres workflows) ne font que **pointer vers l'adresse du site**, et elle ne change pas puisque le dépôt public reprend le nom actuel.

Ordre à respecter :
1. **Renommer le dépôt actuel** (Settings › General › Repository name) : par exemple `dashboard-infra-v2-code`. Il est ensuite mis en **privé** (Settings › Danger Zone › Change visibility). Prévenir l'assistant : il met à jour l'adresse de dépôt de sa session (`git remote set-url origin …`).
2. **Créer un dépôt public vide nommé exactement `DashBoard-Infra-v2`** (même casse que l'adresse actuelle du site) ; Settings › Pages › *Deploy from a branch* › `main` › `/ (root)`.
3. **Créer un jeton** (Settings › Developer settings › Fine-grained tokens) limité au seul dépôt `DashBoard-Infra-v2`, droit *Contents : Read and write*, puis l'ajouter au dépôt **privé** : Settings › Secrets and variables › Actions › New secret › `SITE_DEPLOY_TOKEN`.
4. Lancer le workflow « Publier le site » (Actions › Run workflow). Il construit le site, refuse de publier un `.gs`, un `.md` ou un `.env`, et pousse le résultat dans le dépôt public. Le site revient à la même adresse.
5. Les workflows `deploy-*` des applications continuent de fonctionner (ils utilisent `CLASPRC_JSON`, dans les secrets du dépôt privé). Ne **jamais** pousser le code dans le dépôt public.

Le site publié reste lisible par son adresse : aucune donnée sensible ne doit s'y trouver (fait pour l'annuaire, voir plus haut).

## À surveiller
- **Page de connexion** : l'action `liste` (avant connexion) renvoie nom, service et identifiant de 8 personnes au plus pour une saisie de 3 lettres ou plus : confort de connexion, mais permet de recenser le personnel. À durcir (saisie complète du nom ou de l'e-mail) si cela préoccupe.
- Liens d'applications Apps Script (`/exec`) : chacun contrôle l'accès dans son propre script ; garder « Qui a accès : tous les utilisateurs de l'organisation » quand c'est possible.
- Rotation du jeton `CLASPRC_JSON` si une personne ayant accès au dépôt part.
