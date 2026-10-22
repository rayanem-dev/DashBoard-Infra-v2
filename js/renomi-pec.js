/**
 * Renomi — règle intégrée pour les PRISES EN CHARGE (en plus de ce que l'outil apprend) : « PEC_<ENTREPRISE>_<AAAA-MM-JJ> ».
 * Reconnaît deux présentations : le document de prise en charge produit par le portail (entreprise en tête de la colonne « Code »,
 * date « Rhourde Nouss, le : … ») et la lettre de l'entreprise (« Employeur : ETS … », « Objet : prise en charge », « Le : … »).
 * Pur, sans DOM : testé en Node (apps-script/gateway/test/renomipec.test.js). Nécessite Renomi (js/renomi-moteur.js) pour la date de repli.
 */
(function (racine) {
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var FORMES = /^(ETS|ETB|ETBE|SARL|EURL|SPA|SNC|EPE|EPIC|STE|SOCIETE|ENTREPRISE|GROUPEMENT)\b/i;
  function coupe(s) { var m = s.trim().split(/\s+/), out = []; for (var i = 0; i < m.length; i += 1) { if (/\d/.test(m[i]) || /^(activite|adresse|adressa|objet|code|n°)/i.test(norm(m[i]))) break; out.push(m[i]); } return out.join(' ').replace(/^[\s:.\-–—]+|[\s:.,;\-–—]+$/g, '').toUpperCase(); }
  /** Titre « PRISE EN CHARGE » (ou ces mots avec un des repères du tableau, même mal lus par l'OCR : colonnes éclatées, en-têtes déformés). */
  function estPrise(t) { var n = norm(t); return /prise\s+en\s+charge/.test(n) && /(imputation|analytique|observations|hebergement|restauration|liste\s+nominative|employeur|nom\s+et\s+prenom|personnes|arriv|depart)/.test(n); }
  function entreprise(texte) {
    var lignes = String(texte || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, ' ').replace(/^[^A-Za-z0-9À-ÿ]+/, '').trim(); }).filter(Boolean), m, i;
    for (i = 0; i < lignes.length; i += 1) if ((m = /^employeur\s*:?\s*(.+)$/i.exec(lignes[i]))) { var e = coupe(m[1]); if (e.length >= 3) return e; }
    for (i = 0; i < lignes.length; i += 1) if (FORMES.test(lignes[i]) && !/sonatrach|division|direction/i.test(lignes[i])) { var e2 = coupe(lignes[i]); if (e2.length >= 3 && e2.split(' ').length >= 2) return e2; }
    return '';
  }
  function dateDe(texte) {
    var m = /\ble\s*:?\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/i.exec(String(texte || '').replace(/\s+/g, ' '));
    if (m) { var j = +m[1], mo = +m[2], a = +m[3], d = new Date(Date.UTC(a, mo - 1, j)); if (d.getUTCMonth() === mo - 1) return a + '-' + ('0' + mo).slice(-2) + '-' + ('0' + j).slice(-2); }
    return racine.Renomi && racine.Renomi.premiereDate ? racine.Renomi.premiereDate(texte) : '';
  }
  /** { entreprise, date, nom } si le texte est une prise en charge, sinon null. `nom` sans extension. */
  function reconnaitre(texte) {
    if (!estPrise(texte)) return null;
    var e = entreprise(texte), d = dateDe(texte);
    return { entreprise: e, date: d, nom: ['PEC', e, d].filter(Boolean).join('_') };
  }
  var API = { reconnaitre: reconnaitre, estPrise: estPrise };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.RenomiPec = API;
})(typeof window !== 'undefined' ? window : this);
