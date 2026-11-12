/**
 * Renomi — règle intégrée pour les PRISES EN CHARGE (en plus de ce que l'outil apprend) : « PEC_<ENTREPRISE>_<AAAA-MM-JJ> ».
 * Reconnaît deux présentations : le document de prise en charge produit par le portail (entreprise en tête de la colonne « Code »,
 * date « Rhourde Nouss, le : … ») et la lettre de l'entreprise (« Employeur : ETS … », « Objet : prise en charge », « Le : … »).
 * Pur, sans DOM : testé en Node (apps-script/gateway/test/renomipec.test.js). Nécessite Renomi (js/renomi-moteur.js) pour la date de repli.
 */
(function (racine) {
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  var FORMES = /^(ETS|ETB|ETBE|SARL|EURL|SPA|SNC|EPE|EPIC|STE|SOCIETE|ENTREPRISE|GROUPEMENT)\b/i;
  function coupe(s) { var m = s.trim().split(/\s+/), out = []; for (var i = 0; i < m.length; i += 1) { if (/\d/.test(m[i]) || /^(activite|adresse|adressa|objet|code|n°|base|centrale|ancienne|remplacement|maint|infra|infrastructures?|observations?|hebergement|restauration)$/i.test(norm(m[i]).replace(/[^a-z°]/g, ''))) break; out.push(m[i]); } return out.join(' ').replace(/^[\s:.\-–—]+|[\s:.,;\-–—]+$/g, '').toUpperCase(); }
  /** Titre « PRISE EN CHARGE » (ou ces mots avec un des repères du tableau, même mal lus par l'OCR : colonnes éclatées, en-têtes déformés). */
  function estPrise(t) { var n = norm(t); return /prise\s+en\s+charge/.test(n) && /(imputation|analytique|observations|hebergement|restauration|liste\s+nominative|employeur|nom\s+et\s+prenom|personnes|arriv|depart)/.test(n); }
  /** Nouveau modèle de la Division Moyens Généraux (11/11/2026) : en-têtes « Entreprise S/traitant · SH », « Base d'hébergement (Case réservée à la Division MG) », « Centre de coût ». */
  function nouveauModele(t) { var n = norm(t); return /s\s*\/\s*traitant|sous.?traitant/.test(n) && /centre\s+de\s+cout/.test(n) && /(division\s+mg|moyens\s+generaux|nbr\s+de\s+personnes)/.test(n); }
  /** Jetons en MAJUSCULES (sans chiffre) qui terminent la chaîne ; 'debut' = ceux qui la commencent. Un mot en casse mixte (« Technicien ») est une fonction : on s'arrête. */
  function majuscules(s, fin) {
    var m = s.trim().split(/\s+/).filter(Boolean), out = [], i;
    var maj = function (x) { return /^[A-ZÀ-Ý][A-ZÀ-Ý'’\-]*$/.test(x) && x.length >= 2; };
    if (fin) { for (i = m.length - 1; i >= 0 && maj(m[i]); i -= 1) out.unshift(m[i]); }
    else { for (i = 0; i < m.length && maj(m[i]); i += 1) out.push(m[i]); }
    return out;
  }
  /**
   * Entreprise du nouveau modèle : la cellule S/traitant s'écrit « NOM (n° du contrat) », souvent coupée sur deux lignes et mêlée aux fonctions par la lecture :
   * fin du nom = MAJUSCULES juste avant « (43.INFRA.25) » ; début = MAJUSCULES qui suivent la dernière date ou le dernier nombre de la ligne précédente. '' si le doute subsiste
   * (l'entreprise est alors retrouvée par le n° de contrat dans le Suivi CPM).
   */
  function entrepriseNouveau(texte) {
    var lignes = String(texte || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    for (var i = 0; i < lignes.length; i += 1) {
      var m = /^(.*?)\(\s*\d{1,3}\s*[.\-]\s*INFRA\s*[.\-]\s*\d{2,4}\s*\)/i.exec(lignes[i]); if (!m) continue;
      var queue = majuscules(m[1], true); if (!queue.length) continue;
      var tete = [];
      if (i > 0 && majuscules(lignes[i - 1], false).length === lignes[i - 1].split(/\s+/).length) tete = majuscules(lignes[i - 1], false);   // la ligne précédente n'est que le début du nom
      else if (i > 0) { var prec = lignes[i - 1], k = prec.search(/(?:\d{1,2}[\/.]\d{1,2}[\/.]\d{4}|\b\d+)\s+(?=[A-ZÀ-Ý][A-ZÀ-Ý'’\-]+(?:\s|$))(?!.*\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/); if (k >= 0) tete = majuscules(prec.slice(k).replace(/^\S+\s+/, ''), false); }
      var nom = tete.concat(queue).join(' ');
      if (tete.length && nom.split(' ').length >= 2) return nom;
      return queue.length >= 2 && FORMES.test(queue.join(' ')) ? queue.join(' ') : '';
    }
    return '';
  }
  function entreprise(texte) {
    if (nouveauModele(texte)) return entrepriseNouveau(texte);   // nouveau modèle MG : jamais les règles de l'ancien (elles prenaient la fonction pour la fin du nom)
    var lignes = String(texte || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, ' ').replace(/^[^A-Za-z0-9À-ÿ]+/, '').trim(); }).filter(Boolean), m, i;
    for (i = 0; i < lignes.length; i += 1) if ((m = /^employeur\s*:?\s*(.+)$/i.exec(lignes[i]))) { var e = coupe(m[1]); if (e.length >= 3) return e; }
    for (i = 0; i < lignes.length; i += 1) if (FORMES.test(lignes[i]) && !/sonatrach|division|direction/i.test(lignes[i])) { var e2 = coupe(lignes[i]); if (e2.length >= 3 && e2.split(' ').length >= 2) return e2; }
    // la forme juridique peut ne pas être en début de ligne (colonnes mêlées par l'OCR) : on la cherche dans la ligne
    for (i = 0; i < lignes.length; i += 1) if (!/sonatrach|division|direction|regionale/i.test(lignes[i]) && (m = /\b(ETS|ETB|ETBE|SARL|EURL|SPA|SNC|EPE|EPIC)\b\s+\S.*$/.exec(lignes[i]))) { var e3 = coupe(m[0]); if (e3.length >= 3 && e3.split(' ').length >= 2) return e3; }
    return '';
  }
  function dateDe(texte) {
    var m = /\ble\s*:?\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/i.exec(String(texte || '').replace(/\s+/g, ' '));
    if (m) { var j = +m[1], mo = +m[2], a = +m[3], d = new Date(Date.UTC(a, mo - 1, j)); if (d.getUTCMonth() === mo - 1) return a + '-' + ('0' + mo).slice(-2) + '-' + ('0' + j).slice(-2); }
    return racine.Renomi && racine.Renomi.premiereDate ? racine.Renomi.premiereDate(texte) : '';
  }
  /** Clé comparable du n° de contrat cité dans le texte (« 73.INFRA.25 » ou « I/73/RNS/INFRA/2025 » → « 73-25 »), '' si absent. */
  function cleContrat(c) { var g = String(c || '').match(/\d+/g); if (!g || g.length < 2) return ''; var an = g[g.length - 1]; if (an.length === 4) an = an.slice(2); return String(Number(g[0])) + '-' + an; }
  function contratDe(texte) { var m = /\b(\d{1,3})\s*[.\-]\s*INFRA\s*[.\-]\s*(\d{2,4})\b/i.exec(String(texte || '')) || /\bI\s*\/\s*(\d{1,3})\s*\/\s*[A-Z]+\s*\/\s*INFRA\s*\/\s*(\d{4})/i.exec(String(texte || '')); return m ? cleContrat(m[1] + '.' + m[2]) : ''; }
  /** Entreprise d'un contrat dans le Suivi CPM (lignes déjà découpées : colonne M = entreprise, N = n° de contrat), '' si introuvable. */
  function entrepriseDuContrat(lignes, cle) { if (!cle) return ''; for (var i = 0; i < lignes.length; i += 1) { var r = lignes[i]; if (r && cleContrat(r[13]) === cle && String(r[12] || '').trim()) return String(r[12]).replace(/\s+/g, ' ').trim().toUpperCase(); } return ''; }
  /** { entreprise, date, nom } si le texte est une prise en charge, sinon null. `nom` sans extension. */
  function reconnaitre(texte) {
    if (!estPrise(texte)) return null;
    var e = entreprise(texte), d = dateDe(texte);
    return { entreprise: e, date: d, contrat: contratDe(texte), nom: ['PEC', e, d].filter(Boolean).join('_') };
  }
  function nomAvec(pec, entreprise) { return ['PEC', entreprise, pec.date].filter(Boolean).join('_'); }
  var API = { nouveauModele: nouveauModele, reconnaitre: reconnaitre, estPrise: estPrise, contratDe: contratDe, entrepriseDuContrat: entrepriseDuContrat, nomAvec: nomAvec };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.RenomiPec = API;
})(typeof window !== 'undefined' ? window : this);
