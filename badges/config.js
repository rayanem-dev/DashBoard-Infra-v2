/* Réglages des badges prestataires — le seul fichier à modifier pour adapter l'application à un autre site.
 * Tout ce qui n'est pas écrit ici prend la valeur par défaut de badges.js. Les réglages faits dans l'onglet « Réglages »
 * sont mémorisés dans le navigateur et passent avant ce fichier ; le bouton « Télécharger config.js » les remet ici. */
window.BADGES_CONFIG = {
  base: 'SH RNS BASE DE VIE CENTRALE',      // nom de la base de vie, imprimé en bas du badge (change selon l'hébergement)
  structure: 'INFRA/RNS',                    // structure par défaut (modifiable badge par badge)
  titre: 'BADGE PRESTATAIRE',
  formatNumero: '{base}-BADGE N° {nn}/{annee}',
  couleur: '#E18500',
  logo: 'logo-sonatrach.png',
  qr: { actif: true, face: 'verso' },
  photo: { actif: true },
  arabe: { actif: false },
  police: { famille: 'Berlin Sans FB', taille: 11 }
  // Autres réglages possibles : carte {largeur, hauteur}, grille {colonnes, lignes, pasX, pasY}, decalage {x, y},
  // verso {miroir: 'colonnes' | 'lignes' | 'aucun', decalage {x, y}}, chiffres, numeroDepart, libelles {…} — voir README.md
};
