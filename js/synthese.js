/**
 * Synthèses de l'accueil : « Suivi CPM » (dossiers par statut, échéances proches) et « Avancement chantiers » — mêmes calculs que l'ancien accueil.
 * Les données passent par la passerelle (action « donnees », js/donnees.js) : les feuilles peuvent être privées. La partie CALCUL est pure (testée en Node : test/synthese.test.js), l'affichage construit le DOM sans innerHTML.
 */
var Synthese = (function () {
  var STATUTS = {
    attribue: { label: 'Attribué', bg: '#7CD5B0', text: '#0B4A34' }, encours: { label: 'Dossier en cours', bg: '#D4EDBC', text: '#3F6B2E' },
    execution: { label: 'Contrat en exécution', bg: '#BFE1F6', text: '#155479' }, echu: { label: 'Contrat échu', bg: '#8B8D91', text: '#FFFFFF' },
    bloque: { label: 'Bloqué', bg: '#B10202', text: '#FFFFFF' }, infructueux: { label: 'Infructueux', bg: '#3D3D3D', text: '#FFFFFF' },
    nondemarre: { label: 'Non démarré', bg: '#FFF6E8', text: '#8a6a2f' }, autre: { label: 'Autre', bg: '#F1F1F1', text: '#6B7280' }
  };
  var ORDRE = ['attribue', 'encours', 'execution', 'echu', 'bloque', 'infructueux', 'nondemarre', 'autre'];

  function parseCSV(text) {
    var rows = [], row = [], field = '', q = false;
    for (var i = 0; i < text.length; i += 1) {
      var c = text[i], n = text[i + 1];
      if (q) { if (c === '"' && n === '"') { field += '"'; i += 1; } else if (c === '"') q = false; else field += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; } if (c === '\r' && n === '\n') i += 1; }
      else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (f) { return f.trim() !== ''; }); });
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function dateFr(s) {
    if (!s) return null; var p = String(s).trim().split('/'); if (p.length !== 3) return null;
    var d = parseInt(p[0], 10), m = parseInt(p[1], 10), y = parseInt(p[2], 10); if (!d || !m || !y || y < 1990) return null;
    var dt = new Date(y, m - 1, d); return isNaN(dt.getTime()) ? null : dt;
  }
  function cleStatut(brut) {
    var s = norm(brut);
    if (s.indexOf('attribue') !== -1) return 'attribue'; if (s.indexOf('execution') !== -1) return 'execution';
    if (s.indexOf('echu') !== -1 || s.indexOf('termine') !== -1) return 'echu'; if (s.indexOf('en cours') !== -1) return 'encours';
    if (s.indexOf('bloque') !== -1) return 'bloque'; if (s.indexOf('infructueux') !== -1) return 'infructueux';
    if (s.indexOf('non demarre') !== -1) return 'nondemarre'; return 'autre';
  }

  /** rows : lignes du CSV de « Suivi CPM » ; aujourdhui : Date. Retourne { total, comptes, echeanceProche }. */
  function cpm(rows, aujourdhui) {
    var h = rows.findIndex(function (r) { return r.some(function (c) { return norm(c) === 'statut'; }); }); if (h === -1) h = 1;
    var data = rows.slice(h + 1).filter(function (r) { return (r[3] && r[3].trim() !== '') || (r[8] && r[8].trim() !== ''); });
    var comptes = {}; ORDRE.forEach(function (k) { comptes[k] = 0; }); var proche = 0;
    var auj = new Date(aujourdhui); auj.setHours(0, 0, 0, 0);
    data.forEach(function (r) {
      var k = cleStatut(r[8]); comptes[k] += 1;
      if (k !== 'execution') return;
      var ods = dateFr(r[16]), duree = parseFloat(String(r[17] || '').replace(',', '.')) || null, ech = dateFr(r[18]);
      if (!ech && ods && duree) { ech = new Date(ods); ech.setMonth(ech.getMonth() + Math.round(duree)); }
      if (ech && ods) {
        var total = Math.round((ech - ods) / 864e5), restants = Math.round((ech - auj) / 864e5);
        if (total > 0 && Math.max(0, Math.min(100, Math.round(((total - restants) / total) * 100))) >= 60) proche += 1;
      }
    });
    return { total: data.length, comptes: comptes, echeanceProche: proche };
  }
  /** globalResults : [{ pct }] des chantiers suivis. */
  function chantiers(globalResults) {
    var t = globalResults.length;
    return { total: t, bien: globalResults.filter(function (r) { return r.pct >= 70; }).length, encours: globalResults.filter(function (r) { return r.pct >= 20 && r.pct < 70; }).length, demarrage: globalResults.filter(function (r) { return r.pct < 20; }).length };
  }

  // ---------- affichage (navigateur) ----------
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function pct(n, t) { return t > 0 ? Math.round((n / t) * 100) + '% du total' : '—'; }
  function tuile(num, lib, sous, bg, couleur) {
    var d = el('div', 'syn-tuile'); if (bg) d.style.background = bg;
    var a = el('div', 'syn-num', String(num)), b = el('div', 'syn-lib', lib); if (couleur) { a.style.color = couleur; b.style.color = couleur; }
    d.appendChild(a); d.appendChild(b); if (sous) { var c = el('div', 'syn-pct', sous); if (couleur) c.style.color = couleur; d.appendChild(c); } return d;
  }
  function panneau(zone, icone, titre, sousId, liens) {
    zone.textContent = ''; zone.hidden = false;
    var h = el('div', 'syn-entete'), g = el('div'); var t = el('div', 'syn-titre'); t.appendChild(el('span', 'em', icone)); t.appendChild(document.createTextNode(' ' + titre)); g.appendChild(t);
    var sub = el('div', 'syn-sous', 'Chargement des données…'); g.appendChild(sub); h.appendChild(g);
    var l = el('div', 'syn-liens'); liens.forEach(function (x) { var a = el('a', null, x[0] + ' →'); a.href = x[1]; l.appendChild(a); }); h.appendChild(l); zone.appendChild(h);
    return sub;
  }
  function monterCpm(zone, url) {
    var sub = panneau(zone, '📋', 'Suivi CPM', null, [['Détail', 'Dossiers_CPM.html']]);
    return (url ? fetch(url).then(function (r) { if (!r.ok) throw new Error('lecture impossible'); return r.text(); }) : Donnees.csv('cpm')).then(function (txt) {
      var s = cpm(parseCSV(txt), new Date()), grille = el('div', 'syn-grille'), barre = el('div', 'syn-barre');
      grille.appendChild(tuile(s.total, 'Total dossiers', '', 'linear-gradient(135deg,#1A1A2E,#16213E)', '#fff'));
      ORDRE.forEach(function (k) { if (!s.comptes[k]) return; var st = STATUTS[k]; grille.appendChild(tuile(s.comptes[k], st.label, pct(s.comptes[k], s.total), st.bg, st.text));
        var seg = el('div', 'syn-seg'); seg.style.width = (s.total ? s.comptes[k] / s.total * 100 : 0) + '%'; seg.style.background = st.bg; barre.appendChild(seg); });
      if (s.echeanceProche > 0) { var a = el('a', 'syn-tuile syn-echeance'); a.href = 'Dossiers_CPM.html?echeance=1'; a.style.background = '#FFF3E0'; a.appendChild(el('div', 'syn-num', '⏳ ' + s.echeanceProche)); a.appendChild(el('div', 'syn-lib', 'Arrive à échéance')); grille.appendChild(a); }
      sub.textContent = s.total + ' dossier' + (s.total > 1 ? 's' : '') + ' suivi' + (s.total > 1 ? 's' : '') + ' · données en direct'; zone.appendChild(grille); zone.appendChild(barre);
    }).catch(function () { sub.textContent = 'Données indisponibles pour l\'instant'; });
  }
  function monterChantiers(zone) {
    var sub = panneau(zone, '🏗️', 'Avancement chantiers', null, [['Détail', 'Avancement_des_Chantiers.html']]);
    // Mêmes chiffres que la page d'avancement : on charge son script et on appelle sa fonction computeStats() (rien à maintenir à deux endroits).
    return fetch('Avancement_des_Chantiers.html').then(function (r) { if (!r.ok) throw new Error('page introuvable'); return r.text(); }).then(function (html) {
      var m = html.match(/<script>([\s\S]*?)<\/script>/); if (!m) throw new Error('script introuvable');
      var code = m[1].replace(/\ninit\(\);\s*$/, ''); return new Function(code + '\nreturn computeStats;')()();
    }).then(function (res) {
      var s = chantiers(res.globalResults), grille = el('div', 'syn-grille syn-quatre'), barre = el('div', 'syn-barre');
      grille.appendChild(tuile(s.total, 'Chantiers suivis', '', 'linear-gradient(135deg,#1A1A2E,#16213E)', '#fff'));
      [['Bien avancé', s.bien, '#DCFCE7', '#15803D'], ['En cours', s.encours, '#DBEAFE', '#1E40AF'], ['Démarrage', s.demarrage, '#FFF3E0', '#9A5B0F']].forEach(function (x) {
        grille.appendChild(tuile(x[1], x[0], pct(x[1], s.total), x[2], x[3])); var seg = el('div', 'syn-seg'); seg.style.width = (s.total ? x[1] / s.total * 100 : 0) + '%'; seg.style.background = x[3]; barre.appendChild(seg); });
      sub.textContent = s.total + ' prestation' + (s.total > 1 ? 's' : '') + ' suivie' + (s.total > 1 ? 's' : '') + ' — Travaux Entretien + Électromécanique'; zone.appendChild(grille); zone.appendChild(barre);
    }).catch(function () { sub.textContent = 'Données indisponibles pour l\'instant'; });
  }

  return { parseCSV: parseCSV, cpm: cpm, chantiers: chantiers, cleStatut: cleStatut, monterCpm: monterCpm, monterChantiers: monterChantiers };
})();
if (typeof module !== 'undefined') module.exports = Synthese;
