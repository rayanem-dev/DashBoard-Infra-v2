/**
 * Lecture des feuilles de suivi (CPM, chantiers) PAR LA PASSERELLE : le navigateur ne lit plus jamais la feuille directement,
 * elle peut donc être PRIVÉE (non partagée par lien). La passerelle s'exécute avec le compte du secrétariat, propriétaire des feuilles.
 * Action « donnees » : { source } → { csv, maj }. Le CSV est au même format que l'ancien export Google : les pages le lisent comme avant.
 * Droits : il faut avoir au moins le niveau 1 sur l'un des modules de la source.
 */
var SOURCES_ = {
  cpm:          { fichier: '1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I', gid: 1963142469, onglet: 'suivi', modules: ['cpm', 'pilotage'], libelle: 'Suivi CPM V5' },
  forage:       { fichier: '1gD_aQEw7YUU2DBGMrJchqUGvuFuEeyn8EG9XHf7gxkw', gid: 1809509458, modules: ['pilotage'], libelle: 'Forage RNS' },
  terrassement: { fichier: '1_bL3vv2dtYJWmvs0ZqZqq2agACVEZdAr14UP2unoUhM', gid: 2117456852, modules: ['pilotage'], libelle: 'Terrassement RNS' },
  electricite:  { fichier: '1Pk0n5UNT8yf5A7yZNe8rwHyevn7XHsB4', gid: 627222972, modules: ['pilotage'], libelle: 'Maintenance installations électriques' }
};

function csvDepuisLignes_(lignes) {
  return lignes.map(function (l) {
    return l.map(function (c) {
      var s = String(c == null ? '' : c);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }).join('\n');
}

/** Lignes (texte affiché) de l'onglet d'une source ; erreurs en clair. Sans contrôle de droits : réservé au code de la passerelle. */
function lignesSource_(cle) {
  var src = SOURCES_[String(cle || '')];
  if (!src) throw new Error('Source de données inconnue');
  var ss;
  try { ss = SpreadsheetApp.openById(src.fichier); }
  catch (e) { throw new Error('La feuille « ' + src.libelle + ' » n\'est pas lisible par la passerelle (fichier Office .xlsx à convertir en Google Sheets, ou accès non partagé avec le secrétariat).'); }
  var feuille = ss.getSheets().filter(function (s) { return s.getSheetId() === src.gid; })[0] || (src.onglet ? ss.getSheetByName(src.onglet) : null); // repli sur le nom de l'onglet si le fichier a été recopié (identifiants d'onglet différents)
  if (!feuille) throw new Error('Onglet introuvable dans « ' + src.libelle + ' »');
  return feuille.getDataRange().getDisplayValues();
}

function donneesCsv_(req) {
  var u = Auth.userFromToken(req.token);
  var src = SOURCES_[String(req.source || '')];
  if (!src) throw new Error('Source de données inconnue');
  var acces = acces_(u);
  if (!src.modules.some(function (m) { return (acces[m] || 0) >= 1; })) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var cle = 'CSV_' + req.source, cache = CacheService.getScriptCache();
  var vu = cache.get(cle);
  if (vu) { var o = JSON.parse(vu); return { csv: o.csv, maj: o.maj, cache: true }; }
  var csv = csvDepuisLignes_(lignesSource_(req.source));
  var maj = new Date().toISOString();
  if (csv.length < 90000) { try { cache.put(cle, JSON.stringify({ csv: csv, maj: maj }), 120); } catch (e) {} }
  return { csv: csv, maj: maj };
}

/** Plusieurs feuilles en une requête (accueil plus rapide) : { sources: [..] } → { csv: { source: texte } } ; les sources interdites ou illisibles sont simplement absentes. */
function donneesMulti_(req) {
  var u = Auth.userFromToken(req.token), acces = acces_(u), liste = Array.isArray(req.sources) ? req.sources.slice(0, 8) : [], res = {};
  liste.forEach(function (cle) {
    var src = SOURCES_[String(cle)]; if (!src) return;
    if (!src.modules.some(function (m) { return (acces[m] || 0) >= 1; })) return;
    try {
      var k = 'CSV_' + cle, cache = CacheService.getScriptCache(), vu = cache.get(k);
      if (vu) { res[cle] = JSON.parse(vu).csv; return; }
      var csv = csvDepuisLignes_(lignesSource_(cle));
      if (csv.length < 90000) { try { cache.put(k, JSON.stringify({ csv: csv, maj: new Date().toISOString() }), 120); } catch (e) {} }
      res[cle] = csv;
    } catch (e) { /* illisible : la page la redemandera seule et affichera l'erreur */ }
  });
  return { csv: res };
}

/** À lancer une fois depuis l'éditeur : vérifie que la passerelle lit bien chaque feuille (journal d'exécution). */
function verifierSourcesDonnees() {
  Object.keys(SOURCES_).forEach(function (k) {
    var s = SOURCES_[k];
    try {
      var ss = SpreadsheetApp.openById(s.fichier);
      var f = ss.getSheets().filter(function (x) { return x.getSheetId() === s.gid; })[0] || (s.onglet ? ss.getSheetByName(s.onglet) : null);
      Logger.log((f ? 'OK      ' : 'ONGLET ? ') + k + ' — ' + s.libelle + (f ? ' (' + f.getLastRow() + ' lignes)' : ''));
    } catch (e) { Logger.log('ÉCHEC   ' + k + ' — ' + s.libelle + ' : ' + e.message); }
  });
}
