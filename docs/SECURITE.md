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

## Faire passer le dépôt en privé (propriétaire du dépôt seulement)
1. GitHub › dépôt › *Settings* › *General* › *Danger Zone* › **Change repository visibility** › *Make private*.
2. **GitHub Pages sur un dépôt privé exige une offre payante** (GitHub Pro / Team). Même privé, le **site publié reste accessible par son adresse** (seules les offres Enterprise Cloud permettent d'y ajouter une authentification) : c'est pourquoi aucune donnée sensible ne doit rester dans les fichiers du site (fait ci-dessus pour l'annuaire).
3. Sans offre payante, même schéma que `da3m` / `da3m-site` : **dépôt de code privé** + **dépôt public réduit au site** (`dashboard-infra-v2-site`) alimenté par le workflow à chaque publication (nécessite un jeton d'accès personnel limité à ce seul dépôt, ajouté en secret).
4. Après le passage en privé : vérifier que les workflows `deploy-*` tournent toujours (Actions › secrets) et que l'adresse du site n'a pas changé.

## À surveiller
- **Page de connexion** : l'action `liste` (avant connexion) renvoie nom, service et identifiant de 8 personnes au plus pour une saisie de 3 lettres ou plus : confort de connexion, mais permet de recenser le personnel. À durcir (saisie complète du nom ou de l'e-mail) si cela préoccupe.
- Liens d'applications Apps Script (`/exec`) : chacun contrôle l'accès dans son propre script ; garder « Qui a accès : tous les utilisateurs de l'organisation » quand c'est possible.
- Rotation du jeton `CLASPRC_JSON` si une personne ayant accès au dépôt part.
