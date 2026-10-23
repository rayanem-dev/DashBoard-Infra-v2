/**
 * Lecture des feuilles de suivi par la passerelle (action « donnees »). Retourne le texte CSV, comme l'ancien export. Nécessite js/api.js.
 * Pour que le site reste rapide : une même feuille n'est demandée qu'une fois à la fois, sa lecture est gardée 2 minutes (comme le cache du serveur)
 * dans l'onglet du navigateur, et prefetch() lit plusieurs feuilles en UNE seule requête.
 */
var Donnees = (function () {
  var TTL = 120000, PREFIXE = 'dc_', enCours = {};
  function lire(source) {
    try { var o = JSON.parse(sessionStorage.getItem(PREFIXE + source) || 'null'); if (o && Date.now() - o.t < TTL) return o.csv; } catch (e) { /* stockage indisponible */ }
    return null;
  }
  function garder(source, csv) { try { if (csv.length < 400000) sessionStorage.setItem(PREFIXE + source, JSON.stringify({ t: Date.now(), csv: csv })); } catch (e) { /* plein ou indisponible */ } }
  function csv(source, force) {
    if (!force) { var vu = lire(source); if (vu != null) return Promise.resolve(vu); if (enCours[source]) return enCours[source]; }
    var p = Api.call('donnees', { source: source }).then(function (r) { garder(source, r.csv); return r.csv; });
    enCours[source] = p; var fin = function () { if (enCours[source] === p) delete enCours[source]; }; p.then(fin, fin);
    return p;
  }
  /** Lit plusieurs feuilles en une requête ; celles auxquelles on n'a pas droit sont ignorées en silence. Ne bloque jamais : les appels csv() suivants se servent dans le cache. */
  function prefetch(sources) {
    var manquantes = sources.filter(function (s) { return lire(s) == null && !enCours[s]; });
    if (!manquantes.length) return Promise.resolve();
    var p = Api.call('donnees_multi', { sources: manquantes }).then(function (r) { Object.keys(r.csv || {}).forEach(function (s) { garder(s, r.csv[s]); }); }).catch(function () { /* chaque page relit ce qu'il lui manque */ });
    manquantes.forEach(function (s) { enCours[s] = p.then(function () { var v = lire(s); if (v == null) return csv(s, true); return v; }); var fin = function () { delete enCours[s]; }; enCours[s].then(fin, fin); });
    return p;
  }
  function vider() { try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf(PREFIXE) === 0) sessionStorage.removeItem(k); }); } catch (e) { /* rien */ } enCours = {}; try { sessionStorage.removeItem('gm_pages'); } catch (e) { /* rien */ } }
  return { csv: csv, prefetch: prefetch, vider: vider };
})();
