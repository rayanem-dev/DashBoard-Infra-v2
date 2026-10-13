// Adresse de la passerelle (URL « /exec » du déploiement Apps Script).
// Laisser vide tant que la passerelle n'est pas déployée : les pages passent en MODE DÉMO (données fictives).
window.GATEWAY_URL = 'https://script.google.com/macros/s/AKfycbzrXkomfA6HRzetFiOkLXT_lGr8Sl2BBfG4quM4-UFerramO3hgGM0iR4UH4p5TM2je/exec';

// Adresse publique de Sijil (lien « Propulsé par Sijil » du module Planning).
window.SIJIL_URL = 'https://rayanem-dev.github.io/pointage-app/';

// Couleur de chaque employeur (colonne « dépendance » de BDDORGA) : fond et texte. Mêmes teintes que dans le fichier Organigramme.
// Un employeur absent de cette liste (ex. SONATRACH) s'affiche sans couleur. Ajouter une ligne pour en colorer un autre.
window.EMPLOYEURS = {
  'ACOSCO': { fond: '#D9D2E9', texte: '#4A3B6B' },
  'GTP': { fond: '#D9EAD3', texte: '#2F5D2A' }
};
