/* Réglages des badges prestataires — le seul fichier à modifier pour adapter l'application à un autre site.
 * Tout ce qui n'est pas écrit ici prend la valeur par défaut de badges.js. Les réglages faits dans l'onglet « Réglages »
 * sont mémorisés dans le navigateur et passent avant ce fichier ; le bouton « Télécharger config.js » les remet ici.
 * Valeurs par défaut validées par le propriétaire (onglet Réglages du 02/11/2026) : calage recto horizontal -0,5 mm, les autres réglages sont ceux d'origine. */
window.BADGES_CONFIG = {
  base: 'SH RNS BASE DE VIE CENTRALE',      // nom de la base de vie, imprimé en bas du badge (change selon l'hébergement)
  structure: 'INFRA/RNS',                    // structure par défaut (modifiable badge par badge)
  titre: 'BADGE PRESTATAIRE',
  formatNumero: '{base}-BADGE N° {nn}/{annee}',
  chiffres: 2,                               // 2 chiffres : 01, 02…
  numeroDepart: 1,                           // premier numéro de l'année
  couleur: '#E18500',
  logo: 'logo-sonatrach.png',
  carte: { largeur: 97.6, hauteur: 58.7 },   // dimensions du badge dans le modèle (mm)
  grille: { pasX: 99.6, pasY: 62 },          // pas horizontal et vertical (mm)
  echelle: 0.877,                            // échelle d'impression (0,877 = A4 ajusté)
  decalage: { x: -0.5, y: 0 },               // calage recto (mm)
  verso: { miroir: 'colonnes', decalage: { x: 0, y: 0 } },   // retournement par le bord court ; calage verso (mm)
  qr: { actif: true, face: 'verso' },
  photo: { actif: true },
  arabe: { actif: false },
  police: { famille: 'Berlin Sans FB', taille: 11 }
  // Autres réglages possibles : grille {colonnes, lignes}, libelles {…} — voir README.md
};
