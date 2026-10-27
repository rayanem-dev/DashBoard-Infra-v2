/**
 * Barre latérale rabattable (version 6) : toutes les applications du menu de l'utilisateur, rangées par catégories (Rubriques), sur toutes les pages du site.
 * Chargée par js/pied.js (jamais sur la connexion ni dans les applications Apps Script). Rien ici ne donne de droit : on ne fait que lister le menu déjà autorisé.
 *  - ordinateur : barre à gauche, ouverte (260 px) ou réduite en colonne d'icônes (60 px), état mémorisé ; réduite par défaut sur les pages larges (planning, simulation…) ;
 *  - téléphone / écran étroit : bouton ☰ en haut à gauche, la barre s'ouvre en tiroir par-dessus la page.
 */
(function () {
  if (window.MenuLateral || !window.Api || !Api.token || !Api.token()) return;
  var page = (location.pathname.split('/').pop() || '').toLowerCase();
  if (/^(connexion|index|app|requete)\.html$/.test(page)) return;
  var CLE_ETAT = 'ml_etat', CLE_MENU = 'ml_menu', TTL = 600000, LARGE = 1000, WO = 260, WR = 60;
  var LARGES = /^(portail|planning|simulation|organigramme|dossiers_cpm|pointage|habilitations|simulation-v1)\.html$/;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function fichier(u) { return String(u || '').split(/[?#]/)[0].split('/').pop().toLowerCase(); }
  function lienSur(u) { u = String(u || ''); return /^(https?:\/\/|[A-Za-z0-9_\-\/]+\.html)/.test(u) ? u : '#'; }
  function lienApp(a) { var u = lienSur(a.url); return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_\-]+\/exec$/.test(u) ? 'app.html?u=' + encodeURIComponent(u) + '&t=' + encodeURIComponent(a.titre || '') + '&e=' + encodeURIComponent(String(a.emoji || a.icone || '').slice(0, 8)) : u; }
  function etatSauve() { try { var v = localStorage.getItem(CLE_ETAT); return v === 'ouvert' || v === 'rail' ? v : null; } catch (e) { return null; } }
  function sauver(v) { try { localStorage.setItem(CLE_ETAT, v); } catch (e) { /* rien */ } }
  function etranger(href) { return /^https?:\/\//i.test(href) && href.indexOf(location.origin) !== 0; }

  var etat = etatSauve() || (LARGES.test(page) ? 'rail' : 'ouvert'), groupes = [], tiroir = false, racine, nav, champ;
  function etroit() { return window.innerWidth < LARGE; }

  var CSS = '#ml{position:fixed;top:0;bottom:0;inset-inline-start:0;width:' + WO + 'px;z-index:9990;display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--text-dark,#1A1A2E);border-inline-end:1px solid var(--border,#E5E7EB);box-shadow:0 0 24px rgba(0,0,0,.08);font-family:Inter,Arial,sans-serif;font-size:13.5px;transition:width .2s,transform .2s;overflow:hidden}' +
    '#ml *{box-sizing:border-box}#ml a,#ml button{font:inherit;color:inherit}' +
    '#ml .ml-tete{display:flex;align-items:center;gap:8px;padding:12px 12px 8px;min-height:56px}#ml .ml-logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#E85D04,#F48C06);color:#fff;display:grid;place-items:center;font-weight:800;font-size:13px;flex:none;text-decoration:none}' +
    '#ml .ml-titre{font-weight:800;font-size:14px;line-height:1.15;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none}' +
    '#ml .ml-bascule{border:1px solid var(--border,#E5E7EB);background:var(--surface-2,#F8F9FA);border-radius:9px;width:30px;height:30px;cursor:pointer;flex:none;font-size:14px;line-height:1}' +
    '#ml .ml-cherche{margin:2px 12px 8px}#ml .ml-cherche input{width:100%;padding:7px 10px;border:1.5px solid var(--border,#E5E7EB);border-radius:9px;background:var(--surface,#fff);color:inherit;font:inherit;font-size:13px}' +
    '#ml nav{flex:1;overflow-y:auto;padding:0 8px 12px}#ml .ml-cat{margin-bottom:2px}' +
    '#ml .ml-cat>button{display:flex;align-items:center;gap:9px;width:100%;text-align:start;border:0;background:none;cursor:pointer;padding:8px 8px;border-radius:9px;font-weight:700}#ml .ml-cat>button:hover{background:var(--surface-2,#F3F4F6)}' +
    '#ml .ml-ico{width:26px;text-align:center;font-size:17px;flex:none}#ml .ml-nom{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#ml .ml-fl{font-size:10px;opacity:.55;transition:transform .15s}#ml .ml-cat.ouvert>button .ml-fl{transform:rotate(90deg)}' +
    '#ml .ml-apps{display:none;padding:0 0 4px 8px}#ml .ml-cat.ouvert .ml-apps{display:block}' +
    '#ml .ml-apps a{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;text-decoration:none;font-weight:500}#ml .ml-apps a:hover{background:var(--surface-2,#F3F4F6)}#ml .ml-apps a.ici{background:var(--orange-pale,#FFF0E5);color:var(--orange-dark,#B94E00);font-weight:700}#ml .ml-apps .ml-ico{font-size:15px;width:22px}' +
    '#ml .ml-vide{padding:10px 12px;color:var(--text-muted,#6B7280);font-size:12.5px}' +
    'body.ml-rail #ml{width:' + WR + 'px}body.ml-rail #ml .ml-titre,body.ml-rail #ml .ml-cherche,body.ml-rail #ml .ml-nom,body.ml-rail #ml .ml-fl,body.ml-rail #ml .ml-apps{display:none!important}body.ml-rail #ml .ml-tete{flex-direction:column;padding:10px 0;gap:6px}body.ml-rail #ml .ml-cat>button{justify-content:center;padding:9px 0}' +
    '#ml-btn{display:none;position:fixed;top:12px;inset-inline-start:12px;z-index:9991;width:40px;height:40px;border-radius:12px;border:1.5px solid rgba(255,255,255,.35);background:rgba(26,26,46,.88);color:#fff;font-size:20px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25)}' +
    '#ml-voile{display:none;position:fixed;inset:0;z-index:9989;background:rgba(0,0,0,.4)}' +
    'body.ml-large{margin-inline-start:' + WO + 'px;transition:margin .2s}body.ml-large.ml-rail{margin-inline-start:' + WR + 'px}' +
    '@media (max-width:' + (LARGE - 1) + 'px){#ml{width:min(300px,86vw);transform:translateX(-105%)}[dir=rtl] #ml{transform:translateX(105%)}#ml.tiroir{transform:none;box-shadow:0 0 40px rgba(0,0,0,.4)}#ml-btn{display:block}#ml-btn[aria-expanded=true]{display:none}#ml-voile.tiroir{display:block}body header{padding-inline-start:54px}}' +
    'body.ml-large .aide-btn{left:' + (WO + 12) + 'px!important}body.ml-large.ml-rail .aide-btn{left:' + (WR + 12) + 'px!important}' +
    '@media print{#ml,#ml-btn,#ml-voile{display:none!important}body.ml-large{margin:0!important}}';

  function appliquer() {
    var large = !etroit();
    document.body.classList.toggle('ml-large', large); document.body.classList.toggle('ml-rail', large && etat === 'rail');
    racine.classList.toggle('tiroir', !large && tiroir); $('ml-voile').classList.toggle('tiroir', !large && tiroir);
    var b = racine.querySelector('.ml-bascule'); b.textContent = !large ? '✕' : etat === 'rail' ? '›' : '‹'; b.setAttribute('aria-expanded', large ? (etat === 'rail' ? 'false' : 'true') : 'true'); b.title = !large ? 'Fermer le menu' : etat === 'rail' ? 'Déplier la barre' : 'Replier la barre';
    $('ml-btn').setAttribute('aria-expanded', !large && tiroir ? 'true' : 'false');
    setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) { /* rien */ } }, 230);   // les aperçus A4 et les frises recalculent leur largeur
  }
  function $(id) { return document.getElementById(id); }
  function ici(a) { return fichier(a.url) === page && (String(a.url).indexOf('#') < 0 || location.hash === '#' + String(a.url).split('#')[1] || (page === 'documents.html' && !location.hash)); }
  function dessiner(filtre) {
    var q = norm(filtre).trim(); nav.textContent = ''; var n = 0;
    groupes.forEach(function (g) {
      var apps = g.apps.filter(function (a) { return !q || norm((a.titre || '') + ' ' + (a.mots || '') + ' ' + (a.description || '')).indexOf(q) !== -1; });
      if (!apps.length) return; n += apps.length;
      var cat = el('div', 'ml-cat'), actif = apps.some(ici);
      if (q || actif || g.ouvert) cat.classList.add('ouvert');
      var b = el('button'); b.type = 'button'; b.appendChild(el('span', 'ml-ico', g.icone || '📁')); b.appendChild(el('span', 'ml-nom', g.titre)); b.appendChild(el('span', 'ml-fl', '▶')); b.title = g.titre;
      b.addEventListener('click', function () {
        if (!etroit() && etat === 'rail') { etat = 'ouvert'; sauver(etat); g.ouvert = true; appliquer(); dessiner(champ.value); return; }   // colonne d'icônes : un clic déplie la barre sur cette catégorie
        g.ouvert = !cat.classList.contains('ouvert'); cat.classList.toggle('ouvert');
      });
      cat.appendChild(b);
      var l = el('div', 'ml-apps');
      apps.forEach(function (a) {
        var href = lienApp(a), x = el('a', ici(a) ? 'ici' : ''); x.href = href; x.appendChild(el('span', 'ml-ico', a.emoji || '📄')); x.appendChild(el('span', 'ml-nom', a.titre || '')); x.title = a.titre || '';
        if (ici(a)) x.setAttribute('aria-current', 'page');
        if (etranger(href)) { x.target = '_blank'; x.rel = 'noopener'; }
        l.appendChild(x);
      });
      cat.appendChild(l); nav.appendChild(cat);
    });
    if (!n) nav.appendChild(el('div', 'ml-vide', q ? 'Aucune application ne correspond.' : 'Aucune application disponible.'));
  }
  function monter(menu, rubriques, organiser) {
    groupes = window.Rubriques ? Rubriques.regrouper(menu, rubriques) : (menu || []).map(function (m) { return { id: m.id, titre: m.titre, icone: m.icone, apps: m.apps || [] }; });
    var st = el('style'); st.id = 'ml-css'; st.textContent = CSS; document.head.appendChild(st);
    racine = el('aside'); racine.id = 'ml'; racine.setAttribute('aria-label', 'Applications');
    var tete = el('div', 'ml-tete'), logo = el('a', 'ml-logo', 'SH'); logo.href = 'portail.html'; logo.title = 'Accueil du portail'; logo.setAttribute('aria-label', 'Accueil du portail');
    var tit = el('a', 'ml-titre', 'Portail Infra'); tit.href = 'portail.html';
    var bas = el('button', 'ml-bascule'); bas.type = 'button'; bas.addEventListener('click', function () { if (etroit()) { tiroir = false; appliquer(); return; } etat = etat === 'rail' ? 'ouvert' : 'rail'; sauver(etat); appliquer(); });
    tete.appendChild(logo); tete.appendChild(tit);
    if (organiser) { var org = el('button', 'ml-bascule ml-org', '✏️'); org.type = 'button'; org.title = 'Organiser les applications : glisser, renommer, ajouter des catégories'; org.setAttribute('aria-label', 'Organiser les applications'); org.addEventListener('click', ouvrirOrganisation); tete.appendChild(org); }
    tete.appendChild(bas); racine.appendChild(tete);
    var rc = el('div', 'ml-cherche'); champ = el('input'); champ.type = 'search'; champ.placeholder = 'Rechercher une application…'; champ.setAttribute('aria-label', 'Rechercher une application'); champ.autocomplete = 'off'; champ.addEventListener('input', function () { dessiner(champ.value); }); rc.appendChild(champ); racine.appendChild(rc);
    nav = el('nav'); nav.setAttribute('aria-label', 'Catégories'); racine.appendChild(nav);
    var voile = el('div'); voile.id = 'ml-voile'; voile.addEventListener('click', function () { tiroir = false; appliquer(); });
    var btn = el('button', null, '☰'); btn.id = 'ml-btn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Menu des applications'); btn.setAttribute('aria-controls', 'ml'); btn.addEventListener('click', function () { tiroir = !tiroir; appliquer(); if (tiroir) champ.focus(); });
    document.body.appendChild(voile); document.body.appendChild(racine); document.body.appendChild(btn);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tiroir) { tiroir = false; appliquer(); } });
    window.addEventListener('resize', function () { var large = !etroit(); if (document.body.classList.contains('ml-large') !== large) { tiroir = false; appliquer(); } });
    dessiner(''); appliquer();
  }
  function lireCache() { try { var o = JSON.parse(sessionStorage.getItem(CLE_MENU) || 'null'); return o && Date.now() - o.t < TTL ? o : null; } catch (e) { return null; } }
  /** Éditeur d'organisation (secrétariat) : chargé seulement au clic, puis le menu et l'accueil sont rechargés. */
  function ouvrirOrganisation() {
    var go = function () { window.MenuOrganiser.ouvrir(); };
    if (window.MenuOrganiser) return go();
    var sc = document.createElement('script'); sc.src = BASE + 'js/menu-organiser.js'; sc.onload = go; document.head.appendChild(sc);
  }
  var BASE = (function () { var s = document.currentScript; return s && s.src ? s.src.replace(/js\/menu-lateral\.js(\?.*)?$/, '') : ''; })();
  function avecRubriques(fin) {   // les catégories viennent de js/rubriques.js (chargé s'il ne l'est pas déjà sur la page)
    if (window.Rubriques) return fin();
    var r = document.createElement('script'); r.src = BASE + 'js/rubriques.js'; r.onload = r.onerror = fin; document.head.appendChild(r);
  }
  function charger() {
    var c = lireCache(); if (c) { avecRubriques(function () { monter(c.menu, c.rubriques, c.organiser); }); return; }
    Api.call('menu').then(function (r) { var m = r && r.menu || [], rb = r && r.rubriques || [], og = !!(r && r.organiser); try { sessionStorage.setItem(CLE_MENU, JSON.stringify({ t: Date.now(), menu: m, rubriques: rb, organiser: og })); } catch (e) { /* rien */ } avecRubriques(function () { monter(m, rb, og); }); }).catch(function () { /* sans menu : pas de barre */ });
  }
  window.MenuLateral = { charger: charger };
  if (document.body) charger(); else document.addEventListener('DOMContentLoaded', charger);
})();
