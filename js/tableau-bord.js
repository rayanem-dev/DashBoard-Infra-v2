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

  function monter(zone, d) {
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
    '.tb-legende{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;margin-top:2px}.tb-legende i,.tb-pt i{display:inline-block;width:9px;height:9px;border-radius:2px}.tb-pt{font-size:12px;margin:2px 0}';
  function charger(zone) {
    if (!document.getElementById('tb-css')) { var st = el('style'); st.id = 'tb-css'; st.textContent = CSS; document.head.appendChild(st); }
    return Api.call('tableau_bord').then(function (d) { monter(zone, d); }).catch(function () { zone.hidden = true; });
  }
  var API = { charger: charger, monter: monter };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.TableauBord = API;
})(typeof window !== 'undefined' ? window : this);
