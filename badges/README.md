# Badges prestataires

Prépare et imprime les badges des prestataires (A4 paysage, 9 par feuille, **recto-verso**), selon la charte du modèle `BADGE_ENCC.pptx` :
logo Sonatrach, traits orange, NOM / PRENOM / FONCTION / ENTREPRISE / STRUCTURE, pied « BASE-BADGE N° 01/2026 », verso « CONTRAT N° … », « Visa prestataire », « Visa structure » + QR code.

Deux façons de s'en servir, **le même moteur** (`badges.js`) :

| | Où | Données |
|---|---|---|
| **Dans le portail** | `badges.html` (module « Badges prestataires », niveau 1 = voir, 2 = modifier et imprimer) | entreprises + n° de contrat : suivi CPM ; noms + fonctions : Enquêtes administratives ; corrections et historique : onglets `BadgesPersonnes`, `BadgesEntreprises`, `BadgesHistorique` de `Gateway_DB` |
| **Application autonome** | `badges/index.html` (aucun serveur, aucun compte) | dans le navigateur de l'utilisateur ; import CSV / collage depuis Excel ; sauvegarde et restauration en un fichier |

## Numérotation et historique
- Un numéro **continu pour toute la base**, remis à 01 chaque année : `SH RNS BASE DE VIE CENTRALE-BADGE N° 01/2026`.
- Même personne (nom + prénom + entreprise) = **même numéro** toute l'année, y compris après une perte (pas de duplicata).
- Chaque impression est notée dans l'historique (date, numéro, personne, entreprise, contrat, imprimé par), exportable en Excel / CSV ; on peut réimprimer depuis l'historique.

## Réglages (`config.js`)
Le seul fichier à modifier pour un autre site. Valeurs par défaut dans `badges.js`.

```js
window.BADGES_CONFIG = {
  base: 'SH RNS BASE DE VIE CENTRALE',  // change selon l'hébergement
  structure: 'INFRA/RNS',                // valeur par défaut, modifiable badge par badge (ex. DSP)
  titre: 'BADGE PRESTATAIRE', formatNumero: '{base}-BADGE N° {nn}/{annee}',
  couleur: '#E18500', logo: 'logo-sonatrach.png',
  qr: { actif: true, face: 'verso' }, photo: { actif: true }, arabe: { actif: false }
};
```
Autres réglages : `carte {largeur, hauteur}` (mm), `grille {colonnes, lignes, pasX, pasY}`, `decalage {x, y}` (calage recto), `verso {miroir, decalage}`, `chiffres`, `numeroDepart`, `libelles`.
L'onglet **Réglages** modifie tout cela sans toucher au fichier (mémorisé dans le navigateur) et propose « Télécharger config.js ».

## Impression recto-verso sans tâtonner
1. Onglet **Réglages ▸ Page de calage** : imprimer en **recto-verso, 100 %** (surtout pas « ajuster à la page »).
2. Tenir la feuille à la lumière : les cadres du recto et du verso doivent se superposer ; sinon corriger les décalages (mm).
3. Si le verso est inversé : changer le mode de retournement (bord court = colonnes inversées, bord long = lignes inversées).
Ces réglages se font une seule fois par imprimante. « Première case libre » permet de réutiliser une feuille entamée.

## Version autonome pour un autre site (ex. Rhourde Nouss)
Copier le dossier `badges/` sur n'importe quel hébergement statique (ou ouvrir `index.html` à partir d'un dossier partagé), modifier `config.js` (nom de la base, structure, logo), c'est prêt : l'application est **vierge** (aucune donnée du portail). Importer les personnes (Nom, Prénom, Fonction, Entreprise, Contrat) depuis Excel/CSV ou les saisir à la main. Penser à « Sauvegarder tout » régulièrement : les données restent dans le navigateur.

## Mise en route dans le portail (une fois)
1. **Enquêtes administratives** doit être un vrai Google Sheets (un `.xlsx` n'est pas lisible par la passerelle) : *Fichier ▸ Enregistrer en Google Sheets*, puis propriété de script `BADGES_ENQUETES_ID` = identifiant du nouveau fichier ; le fichier doit appartenir au compte du secrétariat ou lui être partagé.
2. Lancer `badgesVerifierSources` (éditeur Apps Script) : le journal indique le nombre d'entreprises et de personnes lues.
3. Lancer `ajouterApplicationsManquantes` pour que la carte apparaisse, et donner le niveau 1 ou 2 du module « badges » aux rôles voulus (page Privilèges).

Lecture des Enquêtes : un onglet par prestataire, en-têtes repérés par leur texte (colonnes « الوظيفة المقترحة » = fonction, « الاسم و اللقب بالفرنسية » = nom + prénom, « الإسم »/« اللقب » = arabe) ; les onglets décalés d'une colonne sont gérés. Le nom est coupé en NOM / Prénom d'après les majuscules (et le nombre de mots du nom arabe) ; les cas douteux sont marqués ⚠.
La source n'est jamais modifiée : les corrections se font dans l'application.
