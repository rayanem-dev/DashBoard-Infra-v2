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

  // ---------- journal des changements : semaines du samedi au vendredi ----------
  /** Samedi qui ouvre la semaine contenant la date ISO (yyyy-mm-dd). */
  function debutSemaine(iso) {
    var p = String(iso).slice(0, 10).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7)); return d.toISOString().slice(0, 10);
  }
  function plusJours(iso, n) { var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function frIso(iso) { var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  /** evenements (du plus récent au plus ancien) → [{ debut, fin, evenements }], semaine la plus récente d'abord. */
  function semaines(evenements) {
    var par = {}, ordre = [];
    evenements.forEach(function (e) { var d = debutSemaine(e.date); if (!par[d]) { par[d] = { debut: d, fin: plusJours(d, 6), evenements: [] }; ordre.push(d); } par[d].evenements.push(e); });
    return ordre.sort().reverse().map(function (d) { return par[d]; });
  }
  /** Une phrase simple par changement. */
  function phrase(e) {
    var v = function (x) { return x === '' || x == null ? '(vide)' : x; };
    if (e.type === 'nouveau') return 'Nouveau dossier : ' + e.dossier + (e.apres ? ' (' + e.apres + ')' : '');
    if (e.type === 'retire') return 'Dossier retiré du suivi : ' + e.dossier;
    if (e.champ === 'statut') return e.dossier + ' : passe de « ' + v(e.avant) + ' » à « ' + v(e.apres) + ' »';
    return e.dossier + ' — ' + e.libelle + ' : ' + v(e.avant) + ' → ' + v(e.apres);
  }

  // ---------- texte pour le rapport hebdomadaire (colonne O.B.S des trois derniers tableaux du PowerPoint) ----------
  var GROUPES_RAPPORT = [
    { cle: 'daocf', titre: 'DAO et CF' }, { cle: 'application', titre: 'Les contrats d\'application' },
    { cle: 'cadre', titre: 'Contrats d\'application convention cadre' }, { cle: 'autres', titre: 'Autres types (non repris dans le rapport)' }
  ];
  /** Tableau du rapport où classer un dossier d'après son Type (colonne B de la feuille Suivi CPM). */
  function groupeRapport(categorie) {
    var n = norm(categorie);
    if (n.indexOf('convention') !== -1) return 'cadre';
    if (n.indexOf('application') !== -1) return 'application';
    if (/\bdao\b|appel d.?offre|consultation fournisseur|\bcf\b/.test(n)) return 'daocf';
    return 'autres';
  }
  /** Ce qui est écrit dans la colonne O.B.S pour un changement. */
  function ligneRapport(e) {
    var v = function (x) { return x === '' || x == null ? '(vide)' : x; };
    if (e.type === 'nouveau') return 'Nouveau dossier' + (e.apres ? ' — ' + e.apres : '');
    if (e.type === 'retire') return 'Dossier retiré du suivi';
    if (e.champ === 'statut') return 'Statut : ' + v(e.avant) + ' → ' + v(e.apres);
    if (e.champ === 'commentaire' || e.champ === 'etape') return (e.champ === 'etape' ? 'Étape : ' : '') + v(e.apres);
    return e.libelle + ' : ' + v(e.avant) + ' → ' + v(e.apres);
  }
  /** Changements de la semaine (samedi `debut` → vendredi) classés par tableau du rapport puis par dossier. */
  function rapportSemaine(evenements, debut) {
    var fin = plusJours(debut, 6), groupes = GROUPES_RAPPORT.map(function (g) { return { cle: g.cle, titre: g.titre, dossiers: [], index: {} }; });
    evenements.filter(function (e) { return e.date >= debut && e.date <= fin; }).slice().reverse().forEach(function (e) { // du plus ancien au plus récent
      var g = groupes.filter(function (x) { return x.cle === groupeRapport(e.categorie); })[0];
      var d = g.index[e.cle]; if (!d) { d = g.index[e.cle] = { numero: e.n_dossier || '', intitule: e.dossier, lignes: [] }; g.dossiers.push(d); }
      d.lignes.push(ligneRapport(e));
    });
    return { debut: debut, fin: fin, groupes: groupes.map(function (g) { return { cle: g.cle, titre: g.titre, dossiers: g.dossiers }; }) };
  }
  function echapper(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  /** Texte gras d'un dossier, prêt à coller dans le PowerPoint : une ligne par changement. */
  function htmlObs(dossier) { return dossier.lignes.map(function (l) { return '<b>' + echapper(l) + '</b>'; }).join('<br>'); }
  function texteObs(dossier) { return dossier.lignes.join('\n'); }

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

  /** Remplit `zone` (ul par semaine) ; limite = nombre de semaines affichées. */
  function listeSemaines(zone, evenements, limite) {
    semaines(evenements).slice(0, limite || 99).forEach(function (w) {
      zone.appendChild(el('h4', 'syn-semaine', 'Semaine du ' + frIso(w.debut) + ' au ' + frIso(w.fin)));
      var ul = el('ul', 'syn-puces'); w.evenements.forEach(function (e) { ul.appendChild(el('li', null, phrase(e))); }); zone.appendChild(ul);
    });
  }
  function monterJournal(zone) {
    var sub = panneau(zone, '🕘', 'Le journal des changements du CPM', null, [['Tout voir', 'Dossiers_CPM.html#journal']]);
    return Api.call('cpm_journal').then(function (r) {
      sub.textContent = 'Semaines du samedi au vendredi';
      var corps = el('div', 'syn-journal');
      if (!r.evenements.length) corps.appendChild(el('p', 'syn-sous', 'Aucun changement enregistré pour le moment.')); else listeSemaines(corps, r.evenements, 4);
      zone.appendChild(corps);
    }).catch(function () { sub.textContent = 'Données indisponibles pour l\'instant'; });
  }

  return { groupeRapport: groupeRapport, ligneRapport: ligneRapport, rapportSemaine: rapportSemaine, htmlObs: htmlObs, texteObs: texteObs, debutSemaine: debutSemaine, semaines: semaines, phrase: phrase, listeSemaines: listeSemaines, monterJournal: monterJournal, parseCSV: parseCSV, cpm: cpm, chantiers: chantiers, cleStatut: cleStatut, monterCpm: monterCpm, monterChantiers: monterChantiers };
})();
if (typeof module !== 'undefined') module.exports = Synthese;
