/*!
 * basdepage — bibliothèque de pied de page (sans dépendance), extraite de Sijil.
 *  • ligne « Nom · version X (nouveautés) ✓/⚠ », copyright, liens (Confidentialité…), « ↻ Actualiser » ;
 *  • en bas à droite : sélecteur de langue (fr / ar / en…) et bascule thème clair / sombre ;
 *  • la langue règle <html lang> et <html dir> (arabe = droite à gauche) ; le thème règle <html data-theme="light|dark"> ;
 *  • les choix sont mémorisés (localStorage) ; le thème suit l'appareil tant qu'aucun choix n'est fait.
 * Fichier autonome (le style est inclus). Usage : voir INSTALLER.md et modele.html.   BasDePage.monter({ ... })
 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.BasDePage = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ICONE_MONDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>';
  var ICONE_SOLEIL = '<svg class="bdp-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var ICONE_LUNE = '<svg class="bdp-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  /* CSS-DEBUT */
  var CSS = "/* basdepage — pied de page + préférences (langue, thème clair/sombre). Aucune dépendance.\n * Couleurs : variables --bdp-* (valeurs par défaut = palette Sijil). Pour s'accorder à un autre site, redéfinir --bdp-* dans :root. */\n:root {\n  --bdp-accent: #16598D; --bdp-on-accent: #fff; --bdp-card: #fff; --bdp-ink: #1d2733; --bdp-muted: #6b7785; --bdp-line: #d9dfe5;\n}\n:root[data-theme=\"dark\"] {\n  --bdp-accent: #2FB5B4; --bdp-on-accent: #06222A; --bdp-card: #13283B; --bdp-ink: #E8EEF3; --bdp-muted: #9DB0C2; --bdp-line: #27415A;\n}\n/* pied de page : texte centré, liens soulignés */\n.bdp-foot { text-align: center; padding: 14px; font-size: .8rem; color: var(--bdp-muted); line-height: 1.6; }\n.bdp-foot a { color: inherit; }\n.bdp-foot .bdp-etat { text-decoration: none; }\n/* préférences discrètes en bas à droite */\n.bdp-prefs { position: fixed; right: 10px; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); z-index: 30; display: flex; gap: 6px; align-items: center; direction: ltr; }\n.bdp-prefs label.bdp-pf { margin: 0; }\n.bdp-prefs .bdp-pf { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 8px; border: 1px solid var(--bdp-accent); border-radius: 14px; background: var(--bdp-card); color: var(--bdp-accent); font: inherit; font-size: .78rem; opacity: .85; box-sizing: border-box; }\n.bdp-prefs .bdp-pf:hover, .bdp-prefs .bdp-pf:focus-within { opacity: 1; box-shadow: 0 2px 8px rgba(0,0,0,.18); }\n.bdp-prefs svg { width: 15px; height: 15px; flex: none; stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }\n.bdp-prefs select { width: auto; border: 0; background: transparent; color: inherit; padding: 0 2px; margin: 0; font: inherit; cursor: pointer; appearance: none; -webkit-appearance: none; }\n.bdp-prefs select option { color: var(--bdp-ink); background: var(--bdp-card); }\n.bdp-prefs button.bdp-pf { padding: 0 6px; cursor: pointer; width: 46px; justify-content: space-between; position: relative; }\n.bdp-prefs .bdp-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--bdp-accent); transition: transform .18s; }\n.bdp-prefs button[aria-pressed=\"true\"] .bdp-knob { transform: translateX(18px); }\n.bdp-prefs button.bdp-pf svg { position: relative; z-index: 1; width: 13px; height: 13px; }\n.bdp-prefs .bdp-sun { color: var(--bdp-on-accent); } .bdp-prefs .bdp-moon { color: var(--bdp-accent); }\n.bdp-prefs button[aria-pressed=\"true\"] .bdp-sun { color: var(--bdp-accent); } .bdp-prefs button[aria-pressed=\"true\"] .bdp-moon { color: var(--bdp-on-accent); }\nbody.bdp-avec-prefs { padding-bottom: 46px; } /* évite que les préférences masquent le bas de la page */\n@media print { .bdp-prefs { display: none; } }\n@media (prefers-reduced-motion: reduce) { .bdp-prefs .bdp-knob { transition: none; } }";
  /* CSS-FIN */
  var DEFAUT = {
    cible: null,                 // élément, sélecteur ou null = <body> (le pied de page est ajouté à la fin)
    nom: '',                     // ex. 'Sijil' (affiché avant la version)
    version: '',                 // ex. '3.31.1'
    versionLien: '',             // ex. '#/nouveautes' (lien de la version) ; vide = texte simple
    surVersion: null,            // function (ev) : à la place du lien (routeur d'une application monopage)
    comparer: null,              // { urlSite: 'version.json' } : compare avec la version publiée du site → ✓ à jour, ⚠ à déployer (réservé à l'éditeur : ne passer l'option que pour lui)
    copyright: '',               // ex. '© 2026 JawlaDev — Tous droits réservés'
    copyrightLien: null,         // { texte: 'JawlaDev', href: 'https://rayanem-dev.github.io/JawlaDev/' } : transforme ce mot du copyright en lien (nouvel onglet)
    liens: [],                   // [{ label, href, titre, surClic }]
    actualiser: null,            // function () : ajoute le lien « ↻ Actualiser » ; ou { label, titre, surClic }
    langues: [['fr', 'Français'], ['ar', 'العربية'], ['en', 'English']],
    langue: 'fr',                // langue par défaut
    rtl: ['ar'],                 // langues écrites de droite à gauche
    surLangue: null,             // function (code) : à appeler pour retraduire la page
    theme: 'auto',               // 'auto' (suit l'appareil), 'light' ou 'dark' tant qu'aucun choix n'est mémorisé
    surTheme: null,              // function ('light'|'dark')
    prefs: true,                 // false : pas de sélecteur de langue ni de bascule de thème
    css: true,                   // false : ne pas injecter le style (si basdepage.css est déjà chargé par <link>)
    cle: 'bdp',                  // préfixe du stockage local : <cle>-lang, <cle>-theme
    t: null,                     // function (texte) : traduction des libellés (facultatif)
    titres: { aJour: '✓ Tout est à jour', retardServeur: '⚠ Le serveur est en retard : à déployer', retardSite: '⚠ Le site est en retard : à publier (patienter 1 à 2 minutes)', inconnu: '? Version du site illisible (fichier version.json absent ou hors ligne)', actualiser: 'Relire les données depuis le serveur', langue: 'Langue', theme: 'Mode clair / sombre', sombre: 'Mode sombre' }
  };
  var opt = null; var elPied = null; var elPrefs = null;

  function fusion(base, plus) { var o = {}; Object.keys(base).forEach(function (k) { o[k] = base[k]; }); Object.keys(plus || {}).forEach(function (k) { o[k] = plus[k]; }); return o; }
  function tr(s) { return opt && typeof opt.t === 'function' ? opt.t(s) : s; }
  function stock(k) { try { return localStorage.getItem(opt.cle + '-' + k) || ''; } catch (e) { return ''; } }
  function garde(k, v) { try { localStorage.setItem(opt.cle + '-' + k, v); } catch (e) { /* ignore */ } }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'class') n.className = attrs[k]; else if (k === 'html') n.innerHTML = attrs[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i += 1) { var c = arguments[i]; if (c !== null && c !== undefined) n.append(c.nodeType ? c : document.createTextNode(c)); }
    return n;
  }
  function cmpVersion(a, b) { var x = String(a).split('.').map(Number); var y = String(b).split('.').map(Number); for (var i = 0; i < Math.max(x.length, y.length); i += 1) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; } return 0; }

  // ----- langue -----
  function langueActive() { var l = stock('lang') || opt.langue; return opt.langues.some(function (x) { return x[0] === l; }) ? l : opt.langues[0][0]; }
  function appliquerLangue(l) { var d = document.documentElement; d.lang = l; d.dir = opt.rtl.indexOf(l) >= 0 ? 'rtl' : 'ltr'; }
  // ----- thème -----
  function themeActif() { return stock('theme') || (opt.theme === 'light' || opt.theme === 'dark' ? opt.theme : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')); }
  function appliquerTheme() { var t = themeActif(); document.documentElement.setAttribute('data-theme', t); var b = document.getElementById('bdp-theme'); if (b) b.setAttribute('aria-pressed', String(t === 'dark')); return t; }

  function dessinerPied() {
    var pied = el('footer', { class: 'bdp-foot' });
    var ligne1 = []; var etat = null;
    if (opt.nom) ligne1.push(opt.nom + ' · ');
    if (opt.version) {
      var texte = tr('version') + ' ' + opt.version + (opt.versionLien || opt.surVersion ? ' (' + tr('nouveautés') + ')' : '');
      var a = opt.versionLien || opt.surVersion ? el('a', { href: opt.versionLien || '#', onclick: opt.surVersion ? function (ev) { ev.preventDefault(); opt.surVersion(ev); } : null }, texte) : el('span', null, texte);
      etat = a; ligne1.push(a);
    }
    if (ligne1.length) { pied.append.apply(pied, ligne1); pied.append(el('br')); }
    var cr = opt.copyright || ''; var cl = opt.copyrightLien; var ci = cl && cl.texte ? cr.indexOf(cl.texte) : -1;
    if (ci >= 0) pied.append(cr.slice(0, ci), el('a', { href: cl.href || '#', target: '_blank', rel: 'noopener', title: cl.titre || null }, cl.texte), cr.slice(ci + cl.texte.length)); else pied.append(cr);
    (opt.liens || []).forEach(function (l) {
      pied.append(' · ', el('a', { href: l.href || '#', title: l.titre ? tr(l.titre) : null, onclick: l.surClic ? function (ev) { ev.preventDefault(); l.surClic(ev); } : null }, tr(l.label)));
    });
    if (opt.actualiser) {
      var act = typeof opt.actualiser === 'function' ? { surClic: opt.actualiser } : opt.actualiser;
      pied.append(' · ', el('a', { href: '#', title: tr(act.titre || opt.titres.actualiser), onclick: function (ev) { ev.preventDefault(); act.surClic(ev); } }, '↻ ' + tr(act.label || 'Actualiser')));
    }
    if (elPied) elPied.replaceWith(pied); else cible().append(pied);
    elPied = pied;
    if (opt.comparer && opt.version && etat && etat.nodeType === 1) verifierVersion(etat);
  }
  // Style intégré : injecté une seule fois, sauf si basdepage.css est déjà présent dans la page (<link>) ou si css: false.
  function injecterStyle() {
    if (!opt.css || !CSS || document.getElementById('bdp-css')) return;
    var deja = Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) { return /basdepage[^/]*\.css/.test(l.getAttribute('href') || ''); });
    if (deja) return;
    var st = document.createElement('style'); st.id = 'bdp-css'; st.textContent = CSS; (document.head || document.documentElement).append(st);
  }
  function cible() { var c = opt.cible; if (typeof c === 'string') c = document.querySelector(c); return c || document.body; }
  /** Compare la version affichée à celle publiée sur le site : ✓ à jour, ⚠ à déployer (infobulle = détail). */
  function verifierVersion(lien) {
    var url = (opt.comparer.urlSite || 'version.json'); var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return fetch(url + sep + 't=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var site = String(j.version || ''); if (!site) return; var c = cmpVersion(opt.version, site);
      lien.textContent += c === 0 ? ' ✓' : ' ⚠';
      lien.title = c === 0 ? tr(opt.titres.aJour) : (c < 0 ? tr(opt.titres.retardServeur) + ' (v' + opt.version + ' → v' + site + ')' : tr(opt.titres.retardSite) + ' (v' + site + ' → v' + opt.version + ')');
      lien.className = 'bdp-etat';
    }).catch(function () { lien.textContent += ' ?'; lien.title = tr(opt.titres.inconnu); lien.className = 'bdp-etat'; /* hors ligne ou fichier absent : « ? » plutôt que rien */ });
  }
  function dessinerPrefs() {
    if (elPrefs) elPrefs.remove(); elPrefs = null;
    if (!opt.prefs) return;
    var sel = el('select', { 'aria-label': tr(opt.titres.langue), title: tr(opt.titres.langue) }); opt.langues.forEach(function (l) { sel.append(el('option', { value: l[0] }, l[1])); });
    sel.value = langueActive();
    sel.addEventListener('change', function () { garde('lang', sel.value); appliquerLangue(sel.value); if (typeof opt.surLangue === 'function') opt.surLangue(sel.value); dessinerPied(); dessinerPrefs(); });
    var lang = el('label', { class: 'bdp-pf', html: ICONE_MONDE }); lang.append(sel);
    var th = el('button', { type: 'button', id: 'bdp-theme', class: 'bdp-pf', role: 'switch', 'aria-label': tr(opt.titres.sombre), title: tr(opt.titres.theme), html: '<span class="bdp-knob"></span>' + ICONE_SOLEIL + ICONE_LUNE });
    th.addEventListener('click', function () { var n = themeActif() === 'dark' ? 'light' : 'dark'; garde('theme', n); appliquerTheme(); if (typeof opt.surTheme === 'function') opt.surTheme(n); });
    elPrefs = el('div', { class: 'bdp-prefs' }, lang, th); document.body.append(elPrefs); document.body.classList.add('bdp-avec-prefs');
    appliquerTheme();
  }

  var API = {
    /** Monte (ou remonte) le pied de page et les préférences. */
    monter: function (options) {
      opt = fusion(DEFAUT, options); opt.titres = fusion(DEFAUT.titres, (options || {}).titres);
      injecterStyle(); appliquerLangue(langueActive()); appliquerTheme(); dessinerPied(); dessinerPrefs(); return API;
    },
    /** Change une partie des options (ex. { version: '3.32.0' }) et redessine. */
    maj: function (plus) { if (!opt) return API.monter(plus); Object.keys(plus || {}).forEach(function (k) { opt[k] = plus[k]; }); dessinerPied(); dessinerPrefs(); return API; },
    langue: function (l) { if (l) { garde('lang', l); appliquerLangue(l); dessinerPied(); dessinerPrefs(); } return opt ? langueActive() : ''; },
    theme: function (t) { if (t) { garde('theme', t); appliquerTheme(); } return opt ? themeActif() : ''; },
    comparerVersions: cmpVersion,
    verifier: function () { if (opt && opt.comparer && elPied) { var a = elPied.querySelector('a'); if (a) return verifierVersion(a); } return Promise.resolve(); }
  };
  return API;
});
