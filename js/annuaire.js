/**
 * Annuaire téléphonique (fiches contact) : recherche dans l'accueil + liste complète par groupe.
 * Données : lues auprès de la passerelle après connexion (action « annuaire_fiches »), jamais publiées dans les fichiers du site. Rendu sans innerHTML (texte sûr).
 */
var Annuaire = (function () {
  var D = { groupes: [], rows: [] };
  function norme(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  var index = [];
  function reindexer() { index = D.rows.map(function (r) { return norme(r[1] + ' ' + r[2] + ' ' + r[3] + ' ' + r[4] + ' ' + D.groupes[r[0]]); }); }
  reindexer();
  var DONNEES_STATIQUES = [], GROUPES_STATIQUES = [], charge = null;
  function groupeIndex(libelle) { var i = D.groupes.indexOf(libelle); if (i === -1) { D.groupes.push(libelle); i = D.groupes.length - 1; } return i; }
  /**
   * Remplace les fiches du personnel (Sonatrach, ACOSCO, GTP) par celles construites depuis BDDORGA (action « annuaire_personnes »), complétées par les fiches du site ;
   * les prestataires, les postes et les fiches sans personne dans BDDORGA restent tels quels. En cas d'échec (hors connexion, démo) : fiches du site seules.
   */
  function charger() {
    if (charge) return charge;
    charge = (window.Api ? Api.call('annuaire_fiches') : Promise.reject()).then(function (f) {
      DONNEES_STATIQUES = f.rows.slice(); GROUPES_STATIQUES = f.groupes.slice(); D.groupes = f.groupes.slice(); D.rows = f.rows.slice(); reindexer();
      return Api.call('annuaire_personnes').catch(function () { return null; });
    }).then(function (r) {
      if (!r) return true;                      // fiches du site seules (BDDORGA indisponible)
      var remplace = {}; (r.remplace || []).forEach(function (n) { remplace[n] = 1; });
      var gardees = DONNEES_STATIQUES.filter(function (x) { return !(x[4] && x[4] !== 'PRESTATAIRE' && remplace[x[1]]); });
      D.groupes = GROUPES_STATIQUES.slice(); var rows = gardees.slice();
      r.personnes.forEach(function (p) {
        var det = [];
        var tels = [p.tel].concat(p.tels_alt || []).filter(Boolean); if (tels.length) det.push('📞 ' + tels.join(' / '));
        var mails = [p.email, p.email2].filter(Boolean); if (mails.length) det.push('✉️ ' + mails.join(' / '));
        if (p.sona) det.push('ID Sonatrach : ' + p.sona); if (p.matricule) det.push('Matricule : ' + p.matricule);
        var grp = p.section ? 'Équipe Division Infrastructure — Collaborateurs & Bureaux › ' + p.section : 'Équipe Division Infrastructure — Collaborateurs & Bureaux › ' + (p.service || 'Autres');
        var g = D.groupes.filter(function (x) { return x.indexOf('Équipe Division Infrastructure — Collaborateurs & Bureaux › ') === 0 && norme(x).indexOf(norme(p.section || p.service)) !== -1; })[0];
        rows.push([groupeIndex(g || grp), p.nom, det.join(' | '), p.fonction || p.section || p.service || '', p.employeur]);
      });
      rows.sort(function (a, b) { return a[0] - b[0]; });
      D.rows = rows; reindexer(); return true;
    }).catch(function () { return false; });
    return charge;
  }
  /** Code couleur des fiches : ACOSCO mauve, GTP vert, Sonatrach (SH) orange clair, autres gris. */
  function cleEmployeur(e) { var n = String(e || '').trim().toUpperCase(); if (n === 'ACOSCO') return 'acosco'; if (n === 'GTP') return 'gtp'; if (n === 'SONATRACH' || n === 'SH') return 'sh'; return n ? 'autre' : ''; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function lien(texte, href) { var a = el('a', null, texte); a.href = href; return a; }
  /** Texte avec numéros (0XXXXXXXXX) et e-mails cliquables. */
  function enrichi(parent, txt) {
    var re = /([\w.\-]+@[\w.\-]+\.\w+)|(0\d{9})/g, i = 0, m;
    while ((m = re.exec(txt))) {
      if (m.index > i) parent.appendChild(document.createTextNode(txt.slice(i, m.index)));
      parent.appendChild(m[1] ? lien(m[1], 'mailto:' + m[1]) : lien(m[2], 'tel:' + m[2]));
      i = re.lastIndex;
    }
    if (i < txt.length) parent.appendChild(document.createTextNode(txt.slice(i)));
  }
  function fiche(r) {
    var c = el('div', 'contact'); var ce = cleEmployeur(r[4]); if (ce) c.setAttribute('data-emp', ce);
    var t = el('div', 'contact-nom', r[1]); if (r[4]) t.appendChild(el('span', 'contact-badge', r[4])); c.appendChild(t);
    if (r[3]) c.appendChild(el('div', 'contact-poste', r[3]));
    String(r[2] || '').split(' | ').forEach(function (seg) { if (seg && !/^Réf\. —$/.test(seg)) { var l = el('div', 'contact-ligne'); enrichi(l, seg); c.appendChild(l); } });
    var g = D.groupes[r[0]].split(' › '); c.appendChild(el('div', 'contact-groupe', g[g.length - 1]));
    return c;
  }
  /** Résultats de recherche (max `limite`) ; renvoie le nombre total de correspondances. */
  function rechercher(zone, q, limite) {
    zone.textContent = ''; q = norme(q).trim(); if (q.length < 2) return 0;
    var mots = q.split(/\s+/), trouves = [];
    index.forEach(function (s, i) { if (mots.every(function (m) { return s.indexOf(m) !== -1; })) trouves.push(i); });
    trouves.slice(0, limite || 24).forEach(function (i) { zone.appendChild(fiche(D.rows[i])); });
    return trouves.length;
  }
  /** Liste complète : un bloc repliable par groupe, filtrable par `q`. */
  function lister(zone, q) {
    zone.textContent = ''; q = norme(q).trim(); var mots = q ? q.split(/\s+/) : [], par = {}, total = 0;
    D.rows.forEach(function (r, i) { if (mots.every(function (m) { return index[i].indexOf(m) !== -1; })) { (par[r[0]] = par[r[0]] || []).push(r); total += 1; } });
    D.groupes.forEach(function (g, gi) {
      if (!par[gi]) return;
      var d = el('details', 'annuaire-groupe'); if (q) d.open = true;
      d.appendChild(el('summary', null, g.replace(' — ', ' · ').replace(' › ', ' › ') + ' (' + par[gi].length + ')'));
      var grille = el('div', 'contacts'); par[gi].forEach(function (r) { grille.appendChild(fiche(r)); }); d.appendChild(grille); zone.appendChild(d);
    });
    return total;
  }
  return { rechercher: rechercher, lister: lister, cleEmployeur: cleEmployeur, charger: charger, total: function () { return D.rows.length; } };
})();
