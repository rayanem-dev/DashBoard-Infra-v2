/**
 * Raccourcis entre les pages liées, par famille — Planning (Planning, Simulation, Demandes, Organigramme, Vis-à-vis, Affectations) et Chantiers (Avancement, Suivi Chantier, Rapports journaliers, Affectation chantier) : une barre sous l'en-tête, pour passer de l'une à l'autre
 * sans repasser par le portail. Chaque raccourci n'apparaît que si la page est dans le menu de l'utilisateur (droits). Nécessite js/api.js.
 * Dans la page : <script src="js/raccourcis.js"></script> (après api.js).
 */
(function () {
  var CHANTIERS = [
    { f: 'avancement_des_chantiers.html', href: 'Avancement_des_Chantiers.html', t: '📊 Avancement' },
    { f: 'suivi_chantier.html', href: 'Suivi_Chantier.html', t: '🗂️ Suivi Chantier' },
    { f: 'rapports.html', href: 'rapports.html', t: '📝 Rapports journaliers' },
    { f: 'affectation-chantier.html', href: 'affectation-chantier.html', t: '🔀 Affectation chantier' }
  ];
  var ENQUETES = [
    { f: 'habilitations.html', href: 'habilitations.html', t: '🗃️ Fichier des habilitations' },
    { f: 'stats-soustraitants.html', href: 'stats-soustraitants.html', t: '📊 Statistique sous-traitants' }
  ];
  var PLANNING = [
    { f: 'planning.html', href: 'planning.html', t: '🗓️ Planning' },
    { f: 'simulation.html', href: 'simulation.html', t: '🔮 Simulation', sans: '#demandes' },
    { f: 'simulation.html', href: 'simulation.html#demandes', t: '📋 Demandes', hash: '#demandes', badge: true },
    { f: 'organigramme.html', href: 'Organigramme.html', t: '🏛️ Organigramme' },
    { f: 'organigramme.html', href: 'Organigramme.html#vis', t: '👥 Vis-à-vis', hash: '#vis' },
    { f: 'affectation.html', href: 'affectation.html', t: '🔀 Affectations' }
  ];
  var page = (location.pathname.split('/').pop() || '').toLowerCase(), CLE = 'gm_pages';
  var LIENS = [CHANTIERS, PLANNING, ENQUETES].filter(function (g) { return g.some(function (l) { return l.f === page; }); })[0] || [];   // la famille de la page courante
  function fichier(u) { return String(u || '').split(/[?#]/)[0].split('/').pop().toLowerCase(); }
  function pagesDe(r) { var f = []; (r.menu || []).forEach(function (m) { (m.apps || []).forEach(function (a) { f.push(fichier(a.url)); }); }); return f; }
  function connu() { try { var o = JSON.parse(sessionStorage.getItem(CLE) || 'null'); return o && Date.now() - o.t < 600000 ? o.f : null; } catch (e) { return null; } }
  var derniers = null, nbAttente = 0;   // demandes de modification de planning qui attendent la décision de l'utilisateur
  window.addEventListener('hashchange', function () { var n = document.getElementById('raccourcis'); if (n && derniers) { n.remove(); dessiner(derniers); } });
  function dessiner(fichiers) {
    var entete = document.querySelector('header'); if (!entete || document.getElementById('raccourcis')) return;
    var vis = LIENS.filter(function (l) { return fichiers.indexOf(l.f) !== -1; });
    if (vis.length < 2) return;                      // un seul lien (la page elle-même) : rien à raccourcir
    if (!document.getElementById('raccourcis-css')) { var st = document.createElement('style'); st.id = 'raccourcis-css';
      st.textContent = '#raccourcis{display:flex;gap:8px;flex-wrap:wrap;align-items:center;max-width:1400px;margin:10px auto 0;padding:0 16px}#raccourcis a{padding:6px 13px;border:1.5px solid var(--border,#E5E7EB);border-radius:999px;background:var(--surface,#fff);color:var(--text,#1F2937);font:700 12.5px Inter,Arial,sans-serif;text-decoration:none;white-space:nowrap}#raccourcis a:hover{border-color:var(--orange-main,#E85D04);color:var(--orange-main,#E85D04)}#raccourcis a.ici{background:var(--orange-main,#E85D04);border-color:var(--orange-main,#E85D04);color:#fff;pointer-events:none}@media print{#raccourcis{display:none}}';
      document.head.appendChild(st); }
    var nav = document.createElement('nav'); nav.id = 'raccourcis'; nav.setAttribute('aria-label', 'Pages liées');
    vis.forEach(function (l) {
      var a = document.createElement('a'); a.href = l.href; a.textContent = l.t + (l.badge && nbAttente ? ' (' + nbAttente + ')' : ''); if (l.badge) a.id = 'rac-dem';
      var ici = l.f === page && (l.hash ? location.hash === l.hash : !(page === 'organigramme.html' && location.hash === '#vis') && !(l.sans && location.hash === l.sans));
      if (ici) a.className = 'ici'; nav.appendChild(a);
    });
    // la bascule d'onglet de l'Organigramme (même page) : le lien « Vis-à-vis » ouvre l'onglet sans recharger
    derniers = fichiers;
    entete.parentNode.insertBefore(nav, entete.nextSibling);
  }
  /** Nombre de demandes à valider par l'utilisateur, affiché « Demandes (n) » ; mis à jour aussi quand la page de simulation décide / supprime (événement « demandes-maj »). */
  function compter() {
    if (!derniers || derniers.indexOf('simulation.html') === -1) return;
    Api.call('simu_liste').then(function (r) { nbAttente = (r.demandes || []).filter(function (d) { return d.peut_decider; }).length; var a = document.getElementById('rac-dem'); if (a) a.textContent = '📋 Demandes' + (nbAttente ? ' (' + nbAttente + ')' : ''); }).catch(function () { /* pas de droit : pas de compteur */ });
  }
  window.addEventListener('demandes-maj', compter);
  var f0 = connu(); if (f0) { dessiner(f0); compter(); }
  if (!window.Api) return;
  Api.call('menu').then(function (r) { var f = pagesDe(r); try { sessionStorage.setItem(CLE, JSON.stringify({ t: Date.now(), f: f })); } catch (e) { /* rien */ } if (!f0) { dessiner(f); compter(); } }).catch(function () { /* pas de session : pas de raccourcis */ });
})();
