# Organisation : tout sous la main

Règle : **tout ce qui est du code vit dans ce dépôt**, tout ce qui est donnée vit dans le dossier Drive « DashBoard-Infra v2 ». Chaque application a un dossier, et la liste de ce qui dépend de quoi est tenue ici.

## Dans le dépôt
| Dossier | Contenu |
|---|---|
| `*.html`, `js/`, `css/`, `badges/` | le site (GitHub Pages) |
| `apps-script/gateway/` | la passerelle du portail (déployée automatiquement) |
| `apps-script/<application>/` | une application Apps Script par dossier : `prise-en-charge`, `dotation`, `commande-pieces`, `requete-transport`, `autorisation-macaron`… (importées par « Actions ▸ Importer des scripts ») |
| `docs/` | guides, inventaire, **ce fichier** |

Le dépôt est **public** : jamais de mot de passe, clé ou jeton dans le code. Ils vont dans les *propriétés de script* (Paramètres du projet ▸ Propriétés du script). L'import analyse le code et refuse d'enregistrer s'il en trouve.

## Importer le code d'une application (une fois par application)
1. Dans l'éditeur Apps Script de l'application : *Paramètres du projet* ▸ copier l'**ID de script**. (Pour une application liée à une feuille : *Extensions ▸ Apps Script*.)
2. S'assurer que le compte du secrétariat (celui du secret `CLASPRC_JSON`) a accès au script : *Partager* le projet avec lui si le propriétaire est un autre compte.
3. GitHub ▸ Actions ▸ **Importer des scripts** ▸ Run workflow ▸ une ligne par application : `dotation=<ID de script>`.
4. Le code arrive dans `apps-script/<nom>/`. Les modifications se font ensuite dans le dépôt.

## Dépendances (à compléter à chaque import)
| Application | Lit / écrit | Lien |
|---|---|---|
| Passerelle | Gateway_DB, Gateway_Secrets, BDDORGA (`1Thk_-DUr1q9fetPX7W8qg2_SVNRhF_7LtD3xTZfn-OA`), Suivi CPM (`1QFoEEsoosl3vGdwyAlzmQbHt3Vv76llfWfrO-prmAuY`), Forage, Terrassement, Électricité | `apps-script/gateway/Donnees.gs`, `Synchro.gs` |
| Prises en charge + Autorisation d'accès | à relever après import | — |
| Dotation Vivres & Eau | lit BDDORGA (personnel présent) : à relever après import | — |
| Commande de pièces / Requête transport | à relever après import | — |

Règle pour que les changements de fichier ne cassent plus rien : une application **lit une feuille par le nom des en-têtes** (pas par numéro de colonne) et **par identifiant tenu dans une seule constante en haut du script**.
