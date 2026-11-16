/**
 * Lecture d'un fichier de puits (.kmz, .kml ou .csv) : liste { uwi, lat, lon, x, y, td, famille }.
 *  - .kmz = zip (lu ici sans bibliothèque : DecompressionStream) contenant doc.kml ;
 *  - .kml : un Placemark par puits, nom = UWI, coordonnées lon,lat ; les colonnes X, Y (UTM) et TD_final sont lues dans la description (tableau HTML) ou les ExtendedData ;
 *  - .csv / texte : colonnes uwi (ou nom), lat, lon (ou latitude, longitude), x, y, td.
 * Fonctions pures, testées en Node (apps-script/gateway/test/puits.test.js). Rien n'est envoyé : la page montre le résultat avant l'import.
 */
(function (racine) {
  function famille(nom) { var m = /^[A-Za-z]+/.exec(String(nom || '').trim()); return m ? m[0].toUpperCase() : '?'; }
  function nombre(v) { var t = String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'); if (!t) return null; var n = Number(t); return isNaN(n) ? null : n; }
  function propre(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); }
  function normaliser(p) {
    var uwi = String(p.uwi == null ? '' : p.uwi).trim(), lat = nombre(p.lat), lon = nombre(p.lon);
    if (!uwi || lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { uwi: uwi, famille: famille(uwi), lat: Math.round(lat * 1e7) / 1e7, lon: Math.round(lon * 1e7) / 1e7, x: nombre(p.x), y: nombre(p.y), td: nombre(p.td) || 0 };
  }
  function lireKml(texte) {
    var out = [], re = /<Placemark[\s\S]*?<\/Placemark>/g, m;
    while ((m = re.exec(texte))) {
      var b = m[0], nom = (/<name>([\s\S]*?)<\/name>/.exec(b) || [])[1], co = /<coordinates>\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/.exec(b);
      if (!co) continue;
      var attrs = {}, cells = (b.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(propre);
      for (var i = 0; i + 1 < cells.length; i += 1) { var cle = cells[i].toLowerCase(); if (cle && attrs[cle] === undefined) attrs[cle] = cells[i + 1]; }   // « libellé, valeur » en tableau HTML (une cellule vide peut précéder)
      var ext = /<Data name="([^"]+)">\s*<value>([\s\S]*?)<\/value>/g, e;
      while ((e = ext.exec(b))) attrs[e[1].toLowerCase()] = propre(e[2]);
      var p = normaliser({ uwi: propre(nom) || attrs.uwi, lon: co[1], lat: co[2], x: attrs.x, y: attrs.y, td: attrs.td_final || attrs.td });
      if (p) out.push(p);
    }
    return out;
  }
  function lireCsv(texte) {
    var lignes = String(texte).split(/\r?\n/).filter(function (l) { return l.trim(); }); if (lignes.length < 2) return [];
    var sep = lignes[0].indexOf(';') >= 0 ? ';' : lignes[0].indexOf('\t') >= 0 ? '\t' : ',';
    var h = lignes[0].split(sep).map(function (c) { return c.trim().toLowerCase().replace(/^"|"$/g, ''); });
    function i(noms) { for (var k = 0; k < noms.length; k += 1) { var j = h.indexOf(noms[k]); if (j >= 0) return j; } return -1; }
    var iu = i(['uwi', 'nom', 'puits', 'name']), ia = i(['lat', 'latitude']), io = i(['lon', 'lng', 'longitude']), ix = i(['x']), iy = i(['y']), it = i(['td', 'td_final', 'profondeur']);
    if (iu < 0 || ia < 0 || io < 0) return [];
    return lignes.slice(1).map(function (l) { var c = l.split(sep).map(function (x) { return x.trim().replace(/^"|"$/g, ''); }); return normaliser({ uwi: c[iu], lat: c[ia], lon: c[io], x: ix >= 0 ? c[ix] : null, y: iy >= 0 ? c[iy] : null, td: it >= 0 ? c[it] : null }); }).filter(Boolean);
  }
  /** Premier fichier .kml d'un zip (méthodes « stocké » et « deflate »). */
  function lireZip(buf) {
    var d = new DataView(buf), u8 = new Uint8Array(buf), fin = -1, i;
    for (i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i -= 1) if (d.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    if (fin < 0) throw new Error('Fichier zip illisible');
    var nb = d.getUint16(fin + 10, true), p = d.getUint32(fin + 16, true), cible = null;
    for (i = 0; i < nb; i += 1) {
      if (d.getUint32(p, true) !== 0x02014b50) break;
      var methode = d.getUint16(p + 10, true), taille = d.getUint32(p + 20, true), ln = d.getUint16(p + 28, true), le = d.getUint16(p + 30, true), lc = d.getUint16(p + 32, true), off = d.getUint32(p + 42, true);
      var nom = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + ln));
      if (/\.kml$/i.test(nom) && !cible) cible = { methode: methode, taille: taille, off: off };
      p += 46 + ln + le + lc;
    }
    if (!cible) throw new Error('Aucun fichier .kml dans ce .kmz');
    var lnL = d.getUint16(cible.off + 26, true), leL = d.getUint16(cible.off + 28, true), debut = cible.off + 30 + lnL + leL, donnees = u8.subarray(debut, debut + cible.taille);
    if (cible.methode === 0) return Promise.resolve(new TextDecoder().decode(donnees));
    if (cible.methode !== 8) throw new Error('Compression du .kmz non prise en charge');
    var flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(flux).arrayBuffer().then(function (b) { return new TextDecoder().decode(b); });
  }
  /** fichier (nom + ArrayBuffer) → Promise de la liste de puits */
  function lire(nomFichier, buf) {
    var n = String(nomFichier || '').toLowerCase();
    if (/\.kmz$/.test(n)) return Promise.resolve(lireZip(buf)).then(lireKml);
    var t = new TextDecoder().decode(buf);
    return Promise.resolve(/\.kml$/.test(n) || /<kml/i.test(t.slice(0, 500)) ? lireKml(t) : lireCsv(t));
  }
  var API = { famille: famille, normaliser: normaliser, lireKml: lireKml, lireCsv: lireCsv, lireZip: lireZip, lire: lire };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.PuitsKml = API;
})(typeof window !== 'undefined' ? window : this);
