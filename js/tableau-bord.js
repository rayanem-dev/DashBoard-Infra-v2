/**
 * Tableau de bord de l'accueil : cartes de chiffres et de graphiques dessinés en SVG (aucune bibliothèque), alimentées par l'action « tableau_bord ».
 * Chaque carte n'apparaît que si le serveur fournit son bloc (selon les droits). Un clic sur une carte ouvre l'application correspondante.
 */
(function (racine) {
  var NS = 'http://www.w3.org/2000/svg';
  var COUL = { construction: '#E85D04', electromecanique: '#2563EB', entretien: '#16A34A', autre: '#94A3B8' };
  var COUL_STATUT = { execution: '#16A34A', attribue: '#2563EB', encours: '#F59E0B', nondemarre: '#94A3B8', bloque: '#DC2626', echu: '#64748B', infructueux: '#334155', autre: '#CBD5E1' };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a, enfants) { var e = document.createElementNS(NS, t); Object.keys(a || {}).forEach(function (k) { e.setAttribute(k, a[k]); }); (enfants || []).forEach(function (c) { e.appendChild(c); }); return e; }
  function txt(x, y, s, a) { var t = sv('text', Object.assign({ x: x, y: y, 'font-size': 10, fill: 'currentColor' }, a || {})); t.textContent = s; return t; }
  function jourCourt(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function carte(titre, icone, lien) {
    var c = el(lien ? 'a' : 'div', 'tb-carte'); if (lien) c.href = lien;
    var h = el('div', 'tb-titre'); h.appendChild(el('span', null, icone + ' ' + titre)); c.appendChild(h); return c;
  }
  function gros(valeur, libelle, couleur) { var d = el('div', 'tb-gros'); var b = el('b', null, String(valeur)); if (couleur) b.style.color = couleur; d.appendChild(b); d.appendChild(el('span', null, libelle)); return d; }

  /** Courbe en aire : serie = [{ date, total }]. */
  function aire(serie, couleur) {
    var W = 320, H = 90, p = 16, max = Math.max.apply(null, serie.map(function (s) { return s.total; }).concat([1])), n = serie.length;
    var x = function (i) { return p + (n < 2 ? 0 : i * (W - 2 * p) / (n - 1)); }, y = function (v) { return H - 18 - (v / max) * (H - 30); };
    var pts = serie.map(function (s, i) { return x(i) + ',' + y(s.total); }).join(' ');
    var g = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Évolution sur ' + n + ' jours' });
    g.appendChild(sv('polygon', { points: p + ',' + (H - 18) + ' ' + pts + ' ' + x(n - 1) + ',' + (H - 18), fill: couleur, opacity: .18 }));
    g.appendChild(sv('polyline', { points: pts, fill: 'none', stroke: couleur, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    g.appendChild(sv('circle', { cx: x(n - 1), cy: y(serie[n - 1].total), r: 3.5, fill: couleur }));
    g.appendChild(txt(p, H - 4, jourCourt(serie[0].date))); g.appendChild(txt(W - p, H - 4, jourCourt(serie[n - 1].date), { 'text-anchor': 'end' })); g.appendChild(txt(W - p, 11, 'max ' + max, { 'text-anchor': 'end', opacity: .7 }));
    return g;
  }
  /** Barres empilées par jour (effectif par service). */
  function barresEmpilees(d) {
    var W = 320, H = 130, p = 14, n = d.jours.length, max = Math.max.apply(null, d.jours.map(function (j) { return j.total; }).concat([1])), bw = (W - 2 * p) / n;
    var g = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Effectif par jour et par service' });
    d.jours.forEach(function (j, i) {
      var y0 = H - 20, x = p + i * bw;
      d.services.forEach(function (s) {
        var h = (j.par[s.id] || 0) / max * (H - 36); if (!h) return; y0 -= h;
        var r = sv('rect', { x: x + 1, y: y0, width: Math.max(1, bw - 2), height: h, fill: COUL[s.id], rx: 1.5 }); var t = sv('title'); t.textContent = jourCourt(j.date) + ' · ' + s.nom + ' : ' + j.par[s.id]; r.appendChild(t); g.appendChild(r);
      });
      if ((i % 4 === 0 && i < n - 2) || i === n - 1) g.appendChild(txt(x + bw / 2, H - 6, jourCourt(j.date), { 'text-anchor': 'middle', 'font-size': 8.5 }));
    });
    g.appendChild(txt(W - p, 11, 'max ' + max, { 'text-anchor': 'end', opacity: .7 }));
    return g;
  }
  function fr1(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }
  function tendance(a, b, unite) {   // flèche de variation entre deux valeurs
    if (!(b > 0) && !(a > 0)) return null; var d = Math.round((a - b) * 10) / 10, c = el('span', 'tb-var ' + (d > 0 ? 'hausse' : d < 0 ? 'baisse' : 'stable'), (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '＝ ') + fr1(d) + (unite || ''));
    return c;
  }
  /** Barres des rapports reçus par jour sur 4 semaines : une teinte par semaine (la semaine en cours en plein), séparateurs de semaine. */
  function barresJours(d) {
    var W = 320, H = 118, p = 12, n = d.jours.length, max = Math.max.apply(null, d.jours.map(function (j) { return j.n; }).concat([1])), bw = (W - 2 * p) / (7 * d.semaines.length);
    var g = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Rapports reçus par jour, quatre semaines' }), nbSem = d.semaines.length;
    d.jours.forEach(function (j, i) {
      var pos = j.semaine * 7 + Math.round((Date.parse(j.date) - Date.parse(d.semaines[j.semaine].debut)) / 86400000), x = p + pos * bw, h = j.n / max * (H - 44), op = 0.3 + 0.7 * (j.semaine + 1) / nbSem;
      var r = sv('rect', { x: x + 1, y: H - 22 - h, width: Math.max(1, bw - 2), height: Math.max(h, j.n ? 2 : 0), rx: 2, fill: '#E85D04', opacity: op });
      var t = sv('title'); t.textContent = jourCourt(j.date) + ' : ' + j.n + ' rapport' + (j.n > 1 ? 's' : ''); r.appendChild(t); g.appendChild(r);
      if (!j.n) g.appendChild(sv('rect', { x: x + 1, y: H - 24, width: Math.max(1, bw - 2), height: 2, rx: 1, fill: 'currentColor', opacity: .18 }));
    });
    d.semaines.forEach(function (w, i) {
      var x0 = p + i * 7 * bw;
      if (i) g.appendChild(sv('line', { x1: x0, x2: x0, y1: 14, y2: H - 16, stroke: 'currentColor', 'stroke-dasharray': '2 3', opacity: .25 }));
      g.appendChild(txt(x0 + 2, H - 6, jourCourt(w.debut), { 'font-size': 8.5, opacity: .75 }));
    });
    g.appendChild(txt(W - p, 10, 'max ' + max + '/jour', { 'text-anchor': 'end', opacity: .7 }));
    return g;
  }
  /** Mini histogramme d'un chantier (une barre par semaine, la dernière en couleur pleine). */
  function miniBarres(valeurs, max) {
    var W = 64, H = 24, bw = W / valeurs.length, g = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, width: 64, height: 24, role: 'img', 'aria-label': 'Effectif par semaine' });
    valeurs.forEach(function (v, i) { var h = v / max * (H - 3); g.appendChild(sv('rect', { x: i * bw + 2, y: H - h - 1, width: bw - 4, height: Math.max(h, v ? 2 : 0), rx: 2, fill: i === valeurs.length - 1 ? '#2563EB' : '#93C5FD' })); g.appendChild(sv('rect', { x: i * bw + 2, y: H - 2, width: bw - 4, height: 1, fill: 'currentColor', opacity: .15 })); });
    return g;
  }
  /** Anneau : parts = [{ n, couleur }] ; centre = texte. */
  function anneau(parts, centre, sousTitre) {
    var tot = parts.reduce(function (s, p) { return s + p.n; }, 0) || 1, R = 38, C = 2 * Math.PI * R, off = 0;
    var g = sv('svg', { viewBox: '0 0 100 100', width: 104, height: 104, role: 'img', 'aria-label': sousTitre || 'Répartition' });
    g.appendChild(sv('circle', { cx: 50, cy: 50, r: R, fill: 'none', stroke: 'rgba(148,163,184,.25)', 'stroke-width': 14 }));
    parts.forEach(function (p) {
      var l = p.n / tot * C; if (!p.n) return;
      var c = sv('circle', { cx: 50, cy: 50, r: R, fill: 'none', stroke: p.couleur, 'stroke-width': 14, 'stroke-dasharray': l + ' ' + (C - l), 'stroke-dashoffset': -off, transform: 'rotate(-90 50 50)' });
      off += l; g.appendChild(c);
    });
    g.appendChild(txt(50, 54, centre, { 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800 }));
    return g;
  }
  function barresH(items, max, couleur, fmt) {
    var l = el('div', 'tb-barres');
    items.forEach(function (it) {
      var r = el('div', 'tb-lig'); r.appendChild(el('span', 'tb-nom', it.nom)); var b = el('div', 'tb-bar'), i = el('i'); i.style.width = Math.max(2, it.n / max * 100) + '%'; i.style.background = couleur; b.appendChild(i); r.appendChild(b); r.appendChild(el('b', null, fmt ? fmt(it) : String(it.n))); l.appendChild(r);
    });
    return l;
  }

  function monter(zone, d, extras) {
    zone.textContent = ''; var b = d.blocs || {}, n = 0, grille = el('div', 'tb-grille');
    function ajout(c) { grille.appendChild(c); n += 1; }
    if (b.presents) {
      var c = carte('Présence sur site', '🏕', null); c.appendChild(gros(b.presents.total, 'prestataires hébergés aujourd\'hui', '#E85D04')); c.appendChild(aire(b.presents.serie, '#E85D04'));
      if (b.presents.entreprises.length) c.appendChild(barresH(b.presents.entreprises, b.presents.entreprises[0].n, '#E85D04')); ajout(c);
    }
    if (b.rapports_jour) {
      var r = b.rapports_jour, pc = r.total ? Math.round(r.recus / r.total * 100) : 0, c2 = carte('Rapports du jour', '📝', 'rapports.html'), ligne = el('div', 'tb-ligne');
      ligne.appendChild(anneau([{ n: r.recus, couleur: '#16A34A' }, { n: r.total - r.recus, couleur: '#F59E0B' }], pc + '%', r.recus + ' rapports reçus sur ' + r.total));
      var t = el('div', 'tb-col'); t.appendChild(gros(r.recus + ' / ' + r.total, 'chantiers avec rapport', pc >= 80 ? '#16A34A' : '#D97706'));
      if (r.manquants.length) { t.appendChild(el('small', null, 'Sans rapport :')); var u = el('ul', 'tb-liste'); r.manquants.slice(0, 5).forEach(function (m) { u.appendChild(el('li', null, m.nom)); }); if (r.manquants.length > 5) u.appendChild(el('li', null, '… +' + (r.manquants.length - 5))); t.appendChild(u); }
      else t.appendChild(el('small', null, '✅ Tous les chantiers ont leur rapport.'));
      ligne.appendChild(t); c2.appendChild(ligne); ajout(c2);
    }
    if (b.effectif) {
      var c3 = carte('Effectif des chantiers (14 jours)', '👷', 'rapports.html'), auj = b.effectif.jours[b.effectif.jours.length - 1];
      c3.appendChild(gros(auj.total, 'personnes au rapport aujourd\'hui')); c3.appendChild(barresEmpilees(b.effectif));
      var lg = el('div', 'tb-legende'); b.effectif.services.forEach(function (s) { var x = el('span'); var p = el('i'); p.style.background = COUL[s.id]; x.appendChild(p); x.appendChild(document.createTextNode(' ' + s.nom)); lg.appendChild(x); }); c3.appendChild(lg); ajout(c3);
    }
    if (b.rapports_semaines) {
      var rs = b.rapports_semaines, W = rs.semaines, cur = W[W.length - 1], prec = W[W.length - 2], c6 = carte('Rapports par jour et par semaine', '🗓', 'rapports.html');
      var g6 = gros(cur.rapports, cur.joursActifs ? 'rapports cette semaine · ' + cur.joursActifs + ' jour' + (cur.joursActifs > 1 ? 's' : '') + ' avec rapport' : 'rapport cette semaine (début de semaine)');
      c6.appendChild(g6);
      // sans jour d'activité cette semaine (début de semaine, week-end) : pas de comparaison trompeuse
      if (prec && cur.joursActifs > 0) { var v6 = tendance(cur.parJourActif, prec.parJourActif, ' /jour'); if (v6) { var l6 = el('div', 'tb-comp'); l6.appendChild(v6); l6.appendChild(document.createTextNode(' ' + fr1(cur.parJourActif) + ' rapports par jour d\'activité, contre ' + fr1(prec.parJourActif) + ' la semaine précédente')); c6.appendChild(l6); } }
      c6.appendChild(barresJours(rs));
      var ch6 = el('div', 'tb-sem');
      W.forEach(function (w) { var x = el('div', 'tb-sem-i' + (w.enCours ? ' cours' : '')); x.appendChild(el('b', null, String(w.rapports))); x.appendChild(el('span', null, jourCourt(w.debut) + (w.enCours ? ' · en cours' : ''))); x.title = 'Semaine du ' + jourCourt(w.debut) + ' au ' + jourCourt(w.fin) + ' : ' + w.rapports + ' rapports, effectif moyen ' + fr1(w.effectifMoyen) + ' par jour, ' + w.difficultes + ' difficulté(s)'; ch6.appendChild(x); });
      c6.appendChild(ch6); c6.appendChild(el('small', null, 'Semaine = samedi → vendredi · une barre par jour, une teinte par semaine')); ajout(c6);
    }
    if (b.effectif_chantiers && b.effectif_chantiers.chantiers.length) {
      var ec = b.effectif_chantiers, c7 = carte('Ouvriers par chantier et par semaine', '👷', 'rapports.html'), lst7 = el('div', 'tb-ouv');
      ec.chantiers.forEach(function (ch) {
        var r7 = el('div', 'tb-ouv-l'), nm = el('span', 'tb-nom', ch.nom); nm.title = ch.nom + (ch.service ? ' · ' + ch.service : ''); r7.appendChild(nm); r7.appendChild(miniBarres(ch.valeurs, ec.max));
        var der = ch.valeurs[ch.valeurs.length - 1], av = ch.valeurs[ch.valeurs.length - 2], b7 = el('b', null, fr1(der)); r7.appendChild(b7);
        var tv = der > 0 || av > 0 ? tendance(der, av, '') : null; r7.appendChild(tv || el('span', 'tb-var stable', '—'));
        r7.title = ec.semaines.map(function (w, i) { return jourCourt(w.debut) + ' : ' + fr1(ch.valeurs[i]); }).join('  ·  '); lst7.appendChild(r7);
      });
      c7.appendChild(lst7); c7.appendChild(el('small', null, 'Effectif moyen déclaré par jour de rapport · 4 semaines (la dernière en bleu foncé) · flèche = variation sur la semaine précédente')); ajout(c7);
    }
    if (b.classement && b.classement.rapporteurs.length) {
      var cl = b.classement, c8 = carte('Classement des rapporteurs (30 jours)', '🏆', 'rapports.html'), max8 = cl.rapporteurs[0].rapports, med = ['🥇', '🥈', '🥉'], l8 = el('div', 'tb-barres');
      cl.rapporteurs.forEach(function (rp, i) {
        var r8 = el('div', 'tb-lig tb-rang'), nm8 = el('span', 'tb-nom', (med[i] || (i + 1) + '.') + ' ' + rp.nom); nm8.title = rp.nom + ' · ' + rp.jours + ' jour' + (rp.jours > 1 ? 's' : '') + ' · ' + rp.chantiers + ' chantier' + (rp.chantiers > 1 ? 's' : '') + ' · dernier rapport le ' + jourCourt(rp.dernier);
        r8.appendChild(nm8); var bar8 = el('div', 'tb-bar'), i8 = el('i'); i8.style.width = Math.max(3, rp.rapports / max8 * 100) + '%'; i8.style.background = i === 0 ? '#F59E0B' : '#E85D04'; bar8.appendChild(i8); r8.appendChild(bar8); r8.appendChild(el('b', null, rp.rapports + ' · ' + rp.jours + ' j')); l8.appendChild(r8);
      });
      c8.appendChild(l8); c8.appendChild(el('small', null, cl.total + ' rapporteur' + (cl.total > 1 ? 's' : '') + ' sur 30 jours · rapports (nombre) · jours distincts avec rapport')); ajout(c8);
    }
    if (b.suivi_saisie && (b.suivi_saisie.nbSilencieux || b.suivi_saisie.nbDifficultes)) {
      var ss = b.suivi_saisie, c9 = carte('Suivi de la saisie', '🔔', 'rapports.html'), l9 = el('div', 'tb-ligne');
      var a1 = el('div', 'tb-col'); a1.appendChild(gros(ss.nbSilencieux, 'chantier' + (ss.nbSilencieux > 1 ? 's' : '') + ' sans rapport depuis 3 jours ou plus', ss.nbSilencieux ? '#DC2626' : '#16A34A')); l9.appendChild(a1);
      var a2 = el('div', 'tb-col'); a2.appendChild(gros(ss.nbDifficultes, 'difficulté' + (ss.nbDifficultes > 1 ? 's' : '') + ' signalée' + (ss.nbDifficultes > 1 ? 's' : '') + ' (14 jours)', ss.nbDifficultes ? '#D97706' : '#16A34A')); l9.appendChild(a2); c9.appendChild(l9);
      if (ss.silencieux.length) { var u9 = el('ul', 'tb-liste'); ss.silencieux.slice(0, 5).forEach(function (x) { u9.appendChild(el('li', null, x.nom + ' — ' + (x.jours === null ? 'aucun rapport récent' : x.jours + ' j sans rapport'))); }); c9.appendChild(u9); }
      if (ss.difficultes.length) { c9.appendChild(el('small', null, 'Difficultés signalées :')); var d9 = el('ul', 'tb-liste'); ss.difficultes.slice(0, 3).forEach(function (x) { var li = el('li', null, x.nom + (x.n > 1 ? ' (' + x.n + ')' : '') + ' : ' + x.texte); li.title = x.texte; d9.appendChild(li); }); c9.appendChild(d9); }
      ajout(c9);
    }
    if (b.avancement && b.avancement.chantiers.length) {
      var a = b.avancement, c4 = carte('Avancement contre délai', '📈', 'Avancement_des_Chantiers.html');
      c4.appendChild(gros(a.en_retard, 'chantier' + (a.en_retard > 1 ? 's' : '') + ' en retard (> 15 points) sur ' + a.suivis + ' suivis', a.en_retard ? '#DC2626' : '#16A34A'));
      var lst = el('div', 'tb-barres');
      a.chantiers.slice(0, 7).forEach(function (ch) {
        var r2 = el('div', 'tb-lig tb-av'); r2.appendChild(el('span', 'tb-nom', ch.nom)); var bar = el('div', 'tb-bar'), i = el('i'); i.style.width = Math.max(2, ch.avancement) + '%'; i.style.background = ch.retard > 15 ? '#DC2626' : ch.retard > 5 ? '#F59E0B' : '#16A34A'; bar.appendChild(i);
        var m = el('u'); m.style.left = Math.min(100, ch.delai) + '%'; m.title = 'Délai écoulé : ' + ch.delai + ' %'; bar.appendChild(m); r2.appendChild(bar); r2.appendChild(el('b', null, ch.avancement + ' %')); lst.appendChild(r2);
      });
      c4.appendChild(lst); c4.appendChild(el('small', null, 'Barre = avancement déclaré · trait = part du délai écoulée')); ajout(c4);
    }
    if (b.contrats && b.contrats.length) {
      var c5 = carte('État des contrats', '📑', 'Dossiers_CPM.html'), tot = b.contrats.reduce(function (s, x) { return s + x.n; }, 0), l5 = el('div', 'tb-ligne');
      l5.appendChild(anneau(b.contrats.map(function (x) { return { n: x.n, couleur: COUL_STATUT[x.id] || '#CBD5E1' }; }), String(tot), 'Dossiers du Suivi CPM par statut'));
      var lg2 = el('div', 'tb-col'); b.contrats.forEach(function (x) { var s = el('div', 'tb-pt'); var p = el('i'); p.style.background = COUL_STATUT[x.id] || '#CBD5E1'; s.appendChild(p); s.appendChild(document.createTextNode(' ' + x.nom + ' : ')); s.appendChild(el('b', null, String(x.n))); lg2.appendChild(s); }); l5.appendChild(lg2); c5.appendChild(l5);
      if (b.echeances && b.echeances.length) { c5.appendChild(el('small', null, 'Échéances à moins de 60 jours :')); var u2 = el('ul', 'tb-liste'); b.echeances.slice(0, 4).forEach(function (e) { u2.appendChild(el('li', null, e.nom + ' — ' + e.jours + ' j')); }); c5.appendChild(u2); }
      ajout(c5);
    }
    (extras || []).forEach(function (x) { x.classList.add('tb-carte'); grille.appendChild(x); n += 1; });   // cartes ajoutées par la page (ex. journal des changements du CPM)
    if (!n) { zone.hidden = true; return; }
    var h = el('h3', 'tb-h', '📊 Tableau de bord'); h.appendChild(el('span', null, 'mis à jour à l\'ouverture de la page'));
    zone.appendChild(h); zone.appendChild(grille); zone.hidden = false;
  }
  var CSS = '.tb{margin:18px 0}.tb-h{display:flex;align-items:baseline;gap:10px;margin:0 0 10px;font-size:16px}.tb-h span{font-size:11.5px;font-weight:500;color:var(--text-muted,#6B7280)}' +
    '.tb-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.tb-carte{display:block;background:var(--surface,#fff);border:1px solid var(--border,#E5E7EB);border-radius:14px;padding:12px 14px;color:inherit;text-decoration:none;box-shadow:var(--shadow-card,0 1px 3px rgba(0,0,0,.06));min-width:0}' +
    'a.tb-carte:hover{border-color:#E85D04}.tb-titre{font-weight:800;font-size:13px;margin-bottom:6px}.tb-gros{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:4px}.tb-gros b{font-size:28px;line-height:1;letter-spacing:-1px}.tb-gros span{font-size:12px;color:var(--text-muted,#6B7280)}' +
    '.tb-carte small{display:block;color:var(--text-muted,#6B7280);font-size:11.5px;margin-top:6px}.tb-ligne{display:flex;gap:12px;align-items:center}.tb-col{min-width:0;flex:1}.tb-liste{margin:2px 0 0 16px;padding:0;font-size:12px}.tb-liste li{margin:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.tb-barres{display:flex;flex-direction:column;gap:5px;margin-top:6px}.tb-lig{display:grid;grid-template-columns:minmax(70px,38%) 1fr auto;gap:8px;align-items:center;font-size:12px}.tb-nom{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.tb-bar{position:relative;height:9px;border-radius:5px;background:rgba(148,163,184,.25)}.tb-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.tb-bar u{position:absolute;top:-3px;bottom:-3px;width:2px;background:#0F172A;text-decoration:none}' +
    '.tb-journal .syn-titre,.tb-journal h3{font-size:13px;margin:0 0 4px}.tb-journal .syn-sous{margin:0 0 4px}.tb-journal .syn-puces{font-size:12px}.tb-journal{overflow:auto;max-height:330px}' +
    '.tb-var{font-size:11.5px;font-weight:700;white-space:nowrap}.tb-var.hausse{color:#16A34A}.tb-var.baisse{color:#DC2626}.tb-var.stable{color:var(--text-muted,#6B7280)}.tb-comp{font-size:12px;margin:0 0 2px;color:var(--text-muted,#6B7280)}' +
    '.tb-sem{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:4px}.tb-sem-i{text-align:center;border:1px solid var(--border,#E5E7EB);border-radius:9px;padding:4px 2px}.tb-sem-i.cours{border-color:#E85D04;background:rgba(232,93,4,.08)}.tb-sem-i b{display:block;font-size:16px}.tb-sem-i span{font-size:10.5px;color:var(--text-muted,#6B7280)}' +
    '.tb-ouv{display:flex;flex-direction:column;gap:6px;margin-top:6px}.tb-ouv-l{display:grid;grid-template-columns:minmax(70px,1fr) 64px 38px 64px;gap:8px;align-items:center;font-size:12px}.tb-ouv-l b{text-align:right}.tb-rang{grid-template-columns:minmax(90px,42%) 1fr auto}' +
    '.tb-legende{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;margin-top:2px}.tb-legende i,.tb-pt i{display:inline-block;width:9px;height:9px;border-radius:2px}.tb-pt{font-size:12px;margin:2px 0}';
  function charger(zone, extras) {
    if (!document.getElementById('tb-css')) { var st = el('style'); st.id = 'tb-css'; st.textContent = CSS; document.head.appendChild(st); }
    return Api.call('tableau_bord').then(function (d) { monter(zone, d, extras); }).catch(function () { monter(zone, { blocs: {} }, extras); });   // sans graphiques (droits ou réseau), les cartes ajoutées restent
  }
  var API = { charger: charger, monter: monter };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.TableauBord = API;
})(typeof window !== 'undefined' ? window : this);
