/**
 * Lecture des feuilles de suivi (CPM, chantiers) PAR LA PASSERELLE : le navigateur ne lit plus jamais la feuille directement,
 * elle peut donc être PRIVÉE (non partagée par lien). La passerelle s'exécute avec le compte du secrétariat, propriétaire des feuilles.
 * Action « donnees » : { source } → { csv, maj }. Le CSV est au même format que l'ancien export Google : les pages le lisent comme avant.
 * Droits : il faut avoir au moins le niveau 1 sur l'un des modules de la source.
 */
var SOURCES_ = {
  cpm:          { fichier: '1QFoEEsoosl3vGdwyAlzmQbHt3Vv76llfWfrO-prmAuY', gid: 1963142469, modules: ['cpm', 'pilotage'], libelle: 'Suivi CPM V5' },
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
  var feuille = ss.getSheets().filter(function (s) { return s.getSheetId() === src.gid; })[0];
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

/** À lancer une fois depuis l'éditeur : vérifie que la passerelle lit bien chaque feuille (journal d'exécution). */
function verifierSourcesDonnees() {
  Object.keys(SOURCES_).forEach(function (k) {
    var s = SOURCES_[k];
    try {
      var ss = SpreadsheetApp.openById(s.fichier);
      var f = ss.getSheets().filter(function (x) { return x.getSheetId() === s.gid; })[0];
      Logger.log((f ? 'OK      ' : 'ONGLET ? ') + k + ' — ' + s.libelle + (f ? ' (' + f.getLastRow() + ' lignes)' : ''));
    } catch (e) { Logger.log('ÉCHEC   ' + k + ' — ' + s.libelle + ' : ' + e.message); }
  });
}
