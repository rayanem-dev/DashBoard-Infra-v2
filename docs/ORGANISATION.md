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

## Dépendances (ce que chaque application lit ou écrit)
| Application (dossier) | Lit / écrit | Secrets |
|---|---|---|
| Passerelle (`gateway/`) | Gateway_DB, Gateway_Secrets, BDDORGA `1Thk_-DUr1q9fetPX7W8qg2_SVNRhF_7LtD3xTZfn-OA`, Suivi CPM `1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I`, Forage, Terrassement, Électricité | propriétés de script |
| Prises en charge + Autorisation d'accès (`prise-en-charge/`) | **liée à la feuille** « Prises en Charges & Autorisation Acces » `1htHz2rgdyjtH3Ne5E8QNprX2LZKauui4hF25Xse5S18` ; lit Suivi CPM (`SUIVI_CPM_ID`, colonnes C3:N) ; modèles Docs : PEC `1V9e3k4eCCSzRPosjtTrAewCQrErDf2xDX1L0V9979xQ`, autorisation `1U0Xg-_QenJJtCHhJC5O-IyzXU683XMzqtLyykPkAQG4`, macaron `13OFJuvreqXJE0DRrM0TPUS9JO-X9YjYVLuNjjlyDdM4` ; service avancé Drive v3 | `GEMINI_API_KEY` (propriété de script, OK) |
| Dotation Vivres & Eau (`dotation/`) | BDDORGA (nom, service, dépendance **par en-têtes**) ; 4 modèles Docs (voir `dotation/MODELES.md`) | — |
| Commande de pièces (`commande-pieces/`) | **liée à une feuille** (`getActiveSpreadsheet`, colonnes A et C à partir de la ligne 5) | — |
| Requête transport (`requete-transport/`) | modèle Doc `1BCycQMNj0yo_yHElP65Pvd0CZ-STI4g7oLxJX5HSVMk` ; envoie des e-mails (portée `script.send_mail`) | — |

Les fichiers dont dépendent plusieurs applications : **BDDORGA** (passerelle, dotation, annuaire), **Suivi CPM** (passerelle, prises en charge, badges). Toute réorganisation de ces deux fichiers doit être suivie ici.

Règle pour que les changements de fichier ne cassent plus rien : une application **lit une feuille par le nom des en-têtes** (pas par numéro de colonne) et **par identifiant tenu dans une seule constante en haut du script**. À appliquer à `prise-en-charge` (colonnes C3:N du CPM lues par numéro) et `commande-pieces`.
