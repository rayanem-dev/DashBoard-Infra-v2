/**
 * Traduction de l'interface (français ↔ العربية ↔ English) pour le portail.
 * Le français est la langue source : chaque texte français affiché est remplacé par sa traduction si elle existe dans js/i18n-dico.js
 * (texte exact, ou motif pour les phrases avec des valeurs) ; sinon il reste en français. Les noms, dates et données restent tels quels.
 * Fonctionne sur les textes déjà présents ET sur ceux que les pages ajoutent plus tard (MutationObserver).
 * La langue est choisie dans le pied de page (brique basdepage) qui appelle I18n.appliquer(code).
 */
var I18n = (function () {
  var DICO = { en: {}, ar: {} }, MOTIFS = { en: [], ar: [] }, langue = 'fr', obs = null, attentes = false;
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  var IGNORER = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1 };

  function cle(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  /** Traduction d'un texte français ; renvoie le texte tel quel s'il n'y a rien à traduire. */
  function t(s) {
    if (langue === 'fr' || s == null) return s;
    var k = cle(s); if (!k) return s;
    var d = DICO[langue]; if (d && Object.prototype.hasOwnProperty.call(d, k)) return d[k];
    var m = MOTIFS[langue] || [];
    for (var i = 0; i < m.length; i += 1) { var r = m[i][0].exec(k); if (r) return m[i][1].apply(null, r.slice(1)); }
    return s;
  }
  function ignore(node) { for (var e = node.parentNode; e && e.nodeType === 1; e = e.parentNode) { if (IGNORER[e.tagName] || e.hasAttribute && e.hasAttribute('data-i18n-non')) return true; } return false; }

  function traduireTexte(node) {
    var v = node.nodeValue;
    if (node.__trad !== undefined && v !== node.__trad) { node.__fr = undefined; node.__trad = undefined; } // la page a réécrit ce texte : nouvelle source
    var src = node.__fr !== undefined ? node.__fr : v;
    if (!cle(src)) return;
    var res = src;
    if (langue !== 'fr') { var k = cle(src), tr = t(k); if (tr !== k) res = src.match(/^\s*/)[0] + tr + src.match(/\s*$/)[0]; }
    if (res !== v) node.nodeValue = res;
    if (res === src) { node.__fr = undefined; node.__trad = undefined; } else { node.__fr = src; node.__trad = res; }
  }
  function traduireAttrs(el) {
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var v = el.getAttribute(a); el.__frAttr = el.__frAttr || {}; el.__tradAttr = el.__tradAttr || {};
      if (el.__tradAttr[a] !== undefined && v !== el.__tradAttr[a]) { delete el.__frAttr[a]; delete el.__tradAttr[a]; }
      var src = el.__frAttr[a] !== undefined ? el.__frAttr[a] : v;
      var res = langue === 'fr' ? src : t(src);
      if (res !== v) { el.__frAttr[a] = src; el.__tradAttr[a] = res; el.setAttribute(a, res); }
      if (langue === 'fr') { delete el.__frAttr[a]; delete el.__tradAttr[a]; }
    });
  }
  function parcourir(racine) {
    if (!racine) return;
    if (racine.nodeType === 3) { if (!ignore(racine)) traduireTexte(racine); return; }
    if (racine.nodeType !== 1 || IGNORER[racine.tagName]) return;
    if (racine.hasAttribute && racine.hasAttribute('data-i18n-non')) return;
    traduireAttrs(racine);
    var w = document.createTreeWalker(racine, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (!ignore(n)) traduireTexte(n); } else if (!IGNORER[n.tagName]) traduireAttrs(n);
    }
  }
  function toutTraduire() {
    if (obs) obs.disconnect();
    if (document.__titreFr === undefined) document.__titreFr = document.title;
    parcourir(document.body); document.title = langue === 'fr' ? document.__titreFr : t(document.__titreFr); // titre de l'onglet
    observer();
  }
  function observer() {
    if (!window.MutationObserver) return;
    if (!obs) obs = new MutationObserver(function (lst) {
      if (langue === 'fr') return;
      obs.disconnect();
      lst.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(function (n) { parcourir(n); });
        else if (m.type === 'characterData') { if (m.target.nodeType === 3 && !ignore(m.target)) traduireTexte(m.target); }
        else if (m.type === 'attributes') traduireAttrs(m.target);
      });
      obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function appliquer(code) {
    langue = (code === 'ar' || code === 'en') ? code : 'fr';
    if (!document.body) { if (!attentes) { attentes = true; document.addEventListener('DOMContentLoaded', function () { toutTraduire(); }); } return; }
    toutTraduire();
  }
  /** Enrichit le dictionnaire : I18n.dico({ en: { 'Texte français': 'English text' }, ar: { … } }, { en: [[/^motif (\d+)$/, function (n) { … }]], ar: […] }) */
  function dico(d, motifs) {
    ['en', 'ar'].forEach(function (l) { if (d && d[l]) Object.keys(d[l]).forEach(function (k) { DICO[l][cle(k)] = d[l][k]; }); if (motifs && motifs[l]) MOTIFS[l] = MOTIFS[l].concat(motifs[l]); });
  }
  /** Pour la mise au point : tous les textes français actuellement affichés qui n'ont pas de traduction (en ET ar). */
  function manquants() {
    var vus = {}, out = [], save = langue;
    function noter(s) { var k = cle(s); if (!k || vus[k] || /^[\d\s.,:;()\/%+\-–—·→←✓✔✖⚠…•|#@×÷=<>°€$&*'"«»!?]+$/.test(k)) return; vus[k] = 1; out.push(k); }
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (ignore(n)) continue; noter(n.__fr !== undefined ? n.__fr : n.nodeValue); }
      else { if (IGNORER[n.tagName]) continue; ATTRS.forEach(function (a) { if (n.hasAttribute(a)) noter(n.__frAttr && n.__frAttr[a] !== undefined ? n.__frAttr[a] : n.getAttribute(a)); }); }
    }
    var res = out.filter(function (k) { langue = 'en'; var a = t(k) === k; langue = 'ar'; var b = t(k) === k; return a || b; }); langue = save; return res;   // sans traduction en anglais OU en arabe
  }
  return { t: t, appliquer: appliquer, dico: dico, manquants: manquants, langue: function () { return langue; } };
})();
