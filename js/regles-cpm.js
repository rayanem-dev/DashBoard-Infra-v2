/**
 * Règles du fichier « Suivi CPM » (V5/V6) : copie fidèle de apps-script/cpm-sheet/SuiviCPM-complet.gs (rafraichirEnBloc, analyserContrat…).
 * Servent à la page « Suivi CPM V6 » (aperçu en direct) ET à la passerelle (écriture dans la feuille) : une seule logique.
 * Ce fichier est recopié À L'IDENTIQUE dans apps-script/gateway/ReglesCpm.gs (un test vérifie qu'ils ne divergent pas) ;
 * un autre test compare son résultat à celui du script de la feuille. Si le script de la feuille change, mettre à jour ici puis relancer les tests.
 * Les dates sont des objets Date (minuit local).
 */
(function (racine) {
  // <<regles
  var SEUIL_PASSATION_BON = 60, SEUIL_PASSATION_MOYEN = 120, STATUT_ECHU_LABEL = 'Contrat échu';
  var TYPE_CONFIG = { 'Consultation Fournisseur CF': 0, 'Dossier Appel Offre DAO': 1, 'Bon De Commande': 2, 'Gré à Gré Convention Cadre': 3, 'Gré à Gré Contrat Application': 4 };
  var STATUTS = ['Bloqué', 'Non démarré', 'Dossier en cours', 'Attribué', 'Contrat en exécution', 'Contrat échu', 'Infructueux'];

  function normalize(str) {
    if (str === null || str === undefined) return '';
    return str.toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function estDate(x) { return Object.prototype.toString.call(x) === '[object Date]' && !isNaN(x.getTime()); }
  function uniteDuree(duree, uniteBrute) {
    var u = normalize(uniteBrute);
    if (u.indexOf('j') === 0) return 'jours';
    if (u.indexOf('m') === 0) return 'mois';
    return Number(duree) > 60 ? 'jours' : 'mois';
  }
  function calculerEcheance(ods, duree, uniteBrute) {
    var n = Number(duree), d = new Date(ods);
    d.setHours(0, 0, 0, 0);
    if (uniteDuree(duree, uniteBrute) === 'jours') { d.setDate(d.getDate() + n - 1); return d; }
    var an = d.getFullYear(), mois = d.getMonth() + Math.round(n), jour = d.getDate();
    var dernierDuMois = new Date(an, mois + 1, 0).getDate();
    if (jour > dernierDuMois) return new Date(an, mois, dernierDuMois);
    var fin = new Date(an, mois, jour);
    fin.setDate(fin.getDate() - 1);
    return fin;
  }
  function joursDeProlongation(v) {
    if (typeof v === 'number') return v > 0 ? Math.round(v) : 0;
    var t = normalize(v).replace(',', '.');
    var m = /(\d+(?:\.\d+)?)\s*([a-z]*)/.exec(t);
    if (!m) return 0;
    var n = Number(m[1]);
    return Math.round(m[2].indexOf('m') === 0 ? n * 30 : n);
  }
  function jjmmaaaa(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }
  function joursEntreDates(a, b) { var x = new Date(a), y = new Date(b); x.setHours(0, 0, 0, 0); y.setHours(0, 0, 0, 0); return Math.round((y - x) / 86400000); }
  function analyserContrat(p) {
    if (!estDate(p.ods) || !p.duree) return null;
    var base = calculerEcheance(p.ods, p.duree, p.unite), evts = [], joursArret = 0, arretEnCours = null, prolonge = false;
    (p.arrets || []).forEach(function (a) {
      var ar = a[0], re = a[1];
      if (!estDate(ar)) return;
      if (estDate(re)) {
        var n = Math.max(0, joursEntreDates(ar, re));
        joursArret += n; prolonge = true;
        evts.push('arrêt de chantier le ' + jjmmaaaa(ar) + ', reprise le ' + jjmmaaaa(re) + ' (' + n + ' j d\'arrêt)');
      } else { arretEnCours = ar; evts.push('ARRÊT DE CHANTIER depuis le ' + jjmmaaaa(ar) + ' (reprise à venir)'); }
    });
    var jp = 0;
    (p.prolongs || []).forEach(function (v) { jp += joursDeProlongation(v); });
    if (jp > 0) { prolonge = true; evts.push('prolongation de ' + jp + ' j'); }
    var fin = new Date(base);
    fin.setDate(fin.getDate() + joursArret + jp);
    if (p.dateFin && p.dateFin > fin) { fin = new Date(p.dateFin); evts.push('nouvelle fin fixée au ' + jjmmaaaa(fin)); }
    if (p.dateFin) prolonge = true;
    var texte;
    if (!evts.length) texte = 'En cours d\'exécution — ODS le ' + jjmmaaaa(p.ods) + ', durée ' + p.duree + ' ' + uniteDuree(p.duree, p.unite) + ', fin prévue le ' + jjmmaaaa(fin) + '.';
    else texte = 'En exécution — ODS le ' + jjmmaaaa(p.ods) + ', fin initiale le ' + jjmmaaaa(base) + '. ' + evts.join(' ; ') + '. ' + (arretEnCours ? 'Nouvelle fin à calculer à la reprise des travaux.' : 'Nouvelle fin prévue le ' + jjmmaaaa(fin) + '.');
    return { base: base, fin: fin, arretEnCours: arretEnCours, prolonge: prolonge, texte: texte };
  }
  function echeanceProlongee(base, jours, dateFin) {
    var e = new Date(base);
    if (jours > 0) e.setDate(e.getDate() + jours);
    return dateFin && dateFin > e ? new Date(dateFin) : e;
  }
  function rangStatut(statut) {
    var s = normalize(statut);
    if (!s) return 99;
    if (s.includes('bloque')) return 1;
    if (s.includes('non demarre')) return 2;
    if (s.includes('execution')) return 5;
    if (s.includes('attribue')) return 4;
    if (s.includes('echu') || s.includes('termine')) return 6;
    if (s.includes('infructueux')) return 7;
    if (s.includes('en cours')) return 3;
    return 99;
  }
  function couleurStatut(st) {
    if (st.includes('infructueux')) return '#3d3d3d';
    if (st.includes('bloque')) return '#b10202';
    if (st.includes('attribue')) return '#7cd5b0';
    if (st.includes('execution')) return '#bfe1f6';
    if (st.includes('en cours')) return '#d4edbc';
    if (st.includes('echu') || st.includes('termine')) return '#8b8d91';
    if (st.includes('non demarre')) return '#fff6e8';
    return '#ffffff';
  }
  /**
   * Traite UNE ligne comme rafraichirEnBloc : v = valeurs de la ligne (Date pour les dates), idx = indices (0 = première colonne, -1 = absente) :
   * { debut, statut, pct, lim, attr, ech, unite, p1, p2, j1, j2, a1, r1, a2, r2, com, af, ods, dur, pass } ; auj = Date du jour à minuit.
   * Retourne null si la « Date Début Cahier des Charges » est vide (rien ne change), sinon { v (copie mise à jour), fonds, polices } (couleurs de chaque colonne).
   */
  function traiterLigne(vIn, idx, nbCol, auj) {
    var v = vIn.slice(), JOUR = 1000 * 60 * 60 * 24;
    if (!estDate(v[idx.debut])) return null;
    function minuit(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    function cellule(c) { return c >= 0 ? v[c] : ''; }
    var cDead = idx.lim + 1, B = [], F = [], c;
    for (c = 0; c < nbCol; c++) { B.push(null); F.push(null); }
    var pct = v[idx.pct];
    var cent = (typeof pct === 'number') ? (pct === 1 || pct === 100) : normalize(pct).replace(/[\s%]/g, '') === '100';
    var st = normalize(v[idx.statut]);
    if (cent && (st.includes('attribue') || st.includes('en cours'))) { v[idx.statut] = 'Contrat en exécution'; st = normalize(v[idx.statut]); }
    var dateFin = null;
    [idx.p1, idx.p2].forEach(function (cp) { if (cp >= 0 && estDate(v[cp]) && (!dateFin || v[cp] > dateFin)) dateFin = v[cp]; });
    var an = analyserContrat({ ods: v[idx.ods], duree: v[idx.dur], unite: idx.unite >= 0 ? v[idx.unite] : '', prolongs: [cellule(idx.j1), cellule(idx.j2)], dateFin: dateFin,
                               arrets: [[cellule(idx.a1), cellule(idx.r1)], [cellule(idx.a2), cellule(idx.r2)]], aujourdhui: auj });
    var enExec = st.includes('execution'), echu = st.includes('echu');
    if (enExec || echu) {
      var ech0, arret = false;
      if (an) { ech0 = an.fin; arret = !!an.arretEnCours; }
      else { ech0 = estDate(v[idx.ech]) ? echeanceProlongee(v[idx.ech], 0, dateFin) : dateFin; }
      if (ech0) {
        if (enExec && !arret && minuit(ech0) < auj) { v[idx.statut] = STATUT_ECHU_LABEL; st = normalize(v[idx.statut]); }
        else if (echu && (arret || minuit(ech0) >= auj)) { v[idx.statut] = 'Contrat en exécution'; st = normalize(v[idx.statut]); }
      }
    }
    var coul = couleurStatut(st);
    for (c = 0; c < nbCol; c++) B[c] = coul;
    if (estDate(v[idx.lim])) {
      var diff = Math.ceil((minuit(v[idx.lim]) - auj) / JOUR);
      if (diff <= 0) { v[cDead] = 0; B[cDead] = '#000000'; F[cDead] = '#ffffff'; }
      else { v[cDead] = diff; B[cDead] = diff <= 7 ? '#ea4335' : (diff <= 15 ? '#fbbc04' : '#34a853'); F[cDead] = '#000000'; }
    } else { v[cDead] = ''; B[cDead] = '#ffffff'; F[cDead] = '#000000'; }
    if (st.includes('attribue') || st.includes('execution') || st.includes('echu') || st.includes('termine')) {
      for (var k = idx.attr; k <= idx.ech; k++) B[k] = v[k] ? coul : '#ff0000';
      B[idx.af] = v[idx.af] ? coul : '#ff0000';
      if (!v[idx.ods] || !v[idx.dur]) { v[idx.ech] = ''; B[idx.ech] = '#ff0000'; }
      else {
        var ech = an.fin;
        v[idx.ech] = ech;
        var restant = Math.round((minuit(ech) - auj) / JOUR);
        B[idx.ech] = restant > 365 ? '#7cd5b0' : (restant >= 182 ? '#fbbc04' : '#ea4335');
      }
    }
    if (estDate(v[idx.af])) {
      var dj = Math.round((v[idx.af] - v[idx.debut]) / JOUR);
      v[idx.pass] = dj;
      B[idx.pass] = dj <= SEUIL_PASSATION_BON ? '#7cd5b0' : (dj <= SEUIL_PASSATION_MOYEN ? '#fbbc04' : '#f28b82');
    } else { v[idx.pass] = ''; B[idx.pass] = '#ffffff'; }
    if (idx.com >= 0 && an && st.includes('execution')) v[idx.com] = an.texte;
    return { v: v, fonds: B, polices: F };
  }
  var API = { normalize: normalize, estDate: estDate, calculerEcheance: calculerEcheance, joursDeProlongation: joursDeProlongation, analyserContrat: analyserContrat, rangStatut: rangStatut,
              couleurStatut: couleurStatut, traiterLigne: traiterLigne, TYPE_CONFIG: TYPE_CONFIG, STATUTS: STATUTS };
  // regles>>
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.ReglesCpm = API;
})(typeof window !== 'undefined' ? window : this);
