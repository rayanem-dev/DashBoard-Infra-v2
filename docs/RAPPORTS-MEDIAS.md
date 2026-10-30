# Photos et vidéos des rapports journaliers

- **Où** : Google Drive du compte qui déploie la passerelle, dossier « Rapports journaliers – médias », un sous-dossier par jour. Aucun lien public : les fichiers ne s'ouvrent que par la passerelle (`rapport_media_lire`), pour les personnes qui peuvent lire le rapport.
- **Autorisation requise** : « Drive ». Elle est ajoutée aux autorisations de la passerelle par la variable GitHub `GATEWAY_SCOPES_PEC` = `1` (voir `PRISE-EN-CHARGE-PASSERELLE.md`), puis le propriétaire du script autorise une fois (lancer une fonction depuis l'éditeur). Tant que ce n'est pas fait, l'envoi d'un média répond « le stockage … n'est pas encore autorisé » et le rapport texte reste enregistrable sans média.
- **Limites** : 6 médias par rapport ; photos réduites par la page à 1 600 px (JPEG) ; vidéos de 20 Mo au plus (une trentaine de secondes), envoyées par morceaux de 1,5 Mo ; seulement le jour même (comme le rapport).
- **Non repris** : consolidé, e-mails et impressions n'incluent pas les médias.
- **Retrait** : en retirant un média (✕) puis en enregistrant le rapport, le fichier part à la corbeille Drive.
