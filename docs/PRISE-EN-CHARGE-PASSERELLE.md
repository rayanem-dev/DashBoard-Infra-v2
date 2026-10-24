# Prise en charge et autorisation d'accès dans le portail

La page `prise-en-charge.html` remplace l'ancienne application Apps Script ouverte à toute personne ayant le lien. Elle passe par la passerelle, donc par la connexion du portail.

## Ce qui change
- Le moteur (génération des PDF, Suivi CPM, Enquêtes, journal) est **le même code** : `apps-script/prise-en-charge/Code.js`, repris tel quel par un script (`outils/generer-pec-gateway.js`) dans la passerelle. Une seule source ; ne rien modifier dans `PecMoteur.gs` (généré).
- Un compte **prestataire** ne voit que les contrats de ses entreprises (champ « Entreprises » dans Privilèges), ne génère que pour elles, et ne voit que les documents qu'il a générés (6 h). Les actions d'administration (liste, effacement, organismes hors CPM) lui sont refusées par le serveur.
- Une génération à la fois (verrou) : le moteur écrit dans la feuille « PEC ».
- L'ancienne application reste disponible, pour le secrétariat seulement, sous « Prises en Charge (ancienne version) », le temps de vérifier.

## Activation (une seule fois, à un moment calme, par exemple vendredi soir)
La passerelle doit être autorisée à créer des documents Google (Docs) et à écrire dans le Drive. Cela change ses autorisations : le compte propriétaire doit les accepter, **pendant quelques minutes le portail peut afficher une demande d'autorisation**.
1. GitHub > Settings > Secrets and variables > Actions > Variables : créer `GATEWAY_SCOPES_PEC` = `1`.
2. Relancer « Déployer la passerelle » (Actions > Run workflow).
3. Ouvrir le projet Apps Script de la passerelle (compte propriétaire), choisir la fonction `autoriserPriseEnCharge` et cliquer sur Exécuter ; accepter les autorisations (Docs, Drive). **C'est cette exécution qui fait basculer la carte du catalogue vers la nouvelle page** : tant qu'elle n'a pas eu lieu, tout le monde continue d'utiliser l'ancienne application, sans changement.
4. Dans Propriétés du script, ajouter `GEMINI_API_KEY` (la même que l'ancienne application) pour la lecture des demandes PDF ; sans elle, la lecture se fait par l'OCR de Drive.
5. Vérifier : créer une prise en charge de test, puis la supprimer dans la liste des fichiers.
Si besoin de revenir en arrière : mettre `GATEWAY_SCOPES_PEC` à `0` et relancer le déploiement (les autorisations de la passerelle redeviennent celles d'avant).

## À savoir
- La mémoire « base habituelle de chaque entreprise » repart de zéro dans la passerelle et se reconstitue à l'usage.
- Les noms d'entreprises d'un prestataire se choisissent dans la liste de Privilèges (celle de Badges plus celle de la feuille « Config » de la prise en charge).
