/**
 * Prises en charge ↔ « Enquêtes administratives » (un onglet par prestataire).
 *  - recherche d'une personne pendant la saisie (nom, prénom, fonction proposés) : rechercherPersonnes(texte) ;
 *  - à la validation, si la case « Injecter dans les Enquêtes » est cochée : seules les personnes ABSENTES de toutes les Enquêtes sont ajoutées,
 *    dans l'onglet de leur prestataire (jamais de doublon, jamais d'écrasement) ;
 *  - journal de chaque demande dans l'onglet « Journal_PEC » du classeur des prises en charge.
 * Le moteur de lecture (Badges.analyserEnquetes) est partagé avec l'application Badges : badges/badges.js, copié en BadgesMoteur.gs au déploiement.
 * Fichier source : Google Sheets (pas .xlsx) ; propriété de script ENQUETES_ID pour en changer.
 */
var ENQUETES_ID_DEFAUT_ = '1EQMsT8IeOF9ky9eOx7S3jXoq7jmcikjyVVuwryf0Npo';
var ENQ_MOTS_VIDES_ = { sarl: 1, eurl: 1, spa: 1, sas: 1, snc: 1, ets: 1, etb: 1, etbe: 1, unite: 1, groupe: 1, cie: 1, de: 1, du: 1, des: 1, et: 1, la: 1, le: 1, location: 1, entreprise: 1, societe: 1, corp: 1 };

// ---------- logique pure (testée en Node) ----------
function enqJetons_(s) { return Badges.norm(s).split(' ').filter(Boolean); }
function enqProche_(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  var c = a.length > b.length ? a : b, d = a.length > b.length ? b : a;
  return c.slice(i + 1) === d.slice(i);
}
/** Même personne : mêmes mots du nom et du prénom, dans n'importe quel ordre (une lettre de différence tolérée sur les mots de 5 lettres et plus). */
function enqMemePersonne_(a, b) {
  var x = enqJetons_(a), y = enqJetons_(b);
  if (!x.length || x.length !== y.length) return false;
  var pris = {};
  return x.every(function (t) {
    for (var i = 0; i < y.length; i += 1) { if (!pris[i] && enqProche_(t, y[i])) { pris[i] = 1; return true; } }
    return false;
  });
}
/** Personnes dont le nom commence par ce qui est tapé (chaque mot saisi est le début d'un mot du nom) ; les plus proches d'abord. */
function enqChercher_(index, texte, max) {
  var q = enqJetons_(texte);
  if (q.join('').length < 3) return [];
  var res = [];
  index.forEach(function (p) {
    var mots = enqJetons_(p.nom + ' ' + p.prenom);
    var ok = q.every(function (t) { return mots.some(function (m) { return m.indexOf(t) === 0; }); });
    if (ok) res.push({ p: p, long: mots.join('').length });
  });
  res.sort(function (a, b) { return a.long - b.long; });
  return res.slice(0, max || 8).map(function (r) { return r.p; });
}
function enqTrouver_(index, nom, prenom) {
  var voulu = nom + ' ' + prenom;
  for (var i = 0; i < index.length; i += 1) if (enqMemePersonne_(voulu, index[i].nom + ' ' + index[i].prenom)) return index[i];
  return null;
}
/** Onglet du prestataire : le plus proche du nom d'entreprise (titre de l'onglet ou nom de l'onglet). Pas de correspondance sûre = '' (rien n'est écrit au hasard). */
function enqOngletPour_(onglets, entreprise) {
  var a = enqJetons_(entreprise).filter(function (t) { return !ENQ_MOTS_VIDES_[t]; }), meilleur = '', score = 0;
  if (!a.length) return '';
  onglets.forEach(function (o) {
    [o.entreprise, o.onglet].forEach(function (nom) {
      var b = enqJetons_(nom).filter(function (t) { return !ENQ_MOTS_VIDES_[t]; });
      if (!b.length) return;
      var commun = a.filter(function (t) { return b.some(function (u) { return enqProche_(t, u); }); }).length;
      var s = commun / Math.max(a.length, b.length);
      if (commun >= Math.min(a.length, b.length) && s > score) { score = s; meilleur = o.onglet; }
    });
  });
  return meilleur;
}
/** « 12.3.INFRA.25 - ENCC SPA - Génie civil » → « ENCC SPA » ; « Visite sur site… » → '' (pas un prestataire). */
function enqEntrepriseDe_(prestataire) {
  var t = String(prestataire || '').trim();
  if (!t || /^visite sur site/i.test(t)) return '';
  var p = t.split(' - ');
  return (p.length > 1 ? p[1] : p[0]).trim();
}
/** Ligne où écrire dans un onglet : la première ligne sans nom (les lignes numérotées vides du modèle), sinon la suivante après la dernière. */
function enqLigneLibre_(lignes, col) {
  for (var i = col.h + 1; i < lignes.length; i += 1) { if (Badges.vide((lignes[i] || [])[col.fr])) continue; return i; }
  return lignes.length;
}
function enqNomComplet_(nom, prenom) { return (Badges.vide(nom).toLocaleUpperCase('fr') + ' ' + Badges.vide(prenom)).trim(); }

/** Résultat à afficher à l'utilisateur. */
function enqResume_(r) {
  var t = [];
  if (r.ajoutes.length) t.push('Enquêtes : ' + r.ajoutes.length + ' personne(s) ajoutée(s) (' + r.ajoutes.join(', ') + ')');
  if (r.existants.length) t.push(r.existants.length + ' déjà présente(s), non modifiée(s)');
  if (r.sansOnglet.length) t.push('Aucun onglet trouvé pour « ' + r.entreprise + ' » : ' + r.sansOnglet.join(', ') + ' non ajouté(s) — créez l\'onglet du prestataire dans les Enquêtes');
  if (r.erreur) t.push('Enquêtes : ' + r.erreur);
  return t.join(' · ');
}

// ---------- accès aux feuilles ----------
function enqClasseur_() {
  var id = PropertiesService.getScriptProperties().getProperty('ENQUETES_ID') || ENQUETES_ID_DEFAUT_;
  try { return SpreadsheetApp.openById(id); }
  catch (e) { throw new Error('Le fichier « Enquêtes administratives » n\'est pas lisible (il doit être un Google Sheets partagé avec le compte de l\'application).'); }
}
function enqLireTout_(ss) {
  return ss.getSheets().map(function (sh) { return Badges.analyserEnquetes(sh.getDataRange().getDisplayValues(), sh.getName()); });
}
function enqIndex_(onglets) {
  var idx = [];
  onglets.forEach(function (o) { o.personnes.forEach(function (p) { idx.push({ nom: p.nom, prenom: p.prenom, fonction: p.fonction, entreprise: o.entreprise, onglet: o.onglet }); }); });
  return idx;
}
function enqIndexCache_() {
  var c = CacheService.getScriptCache(), v = c.get('ENQ_IDX');
  if (v) { try { return JSON.parse(v); } catch (e) { /* relire */ } }
  var idx = enqIndex_(enqLireTout_(enqClasseur_()));
  try { var t = JSON.stringify(idx); if (t.length < 95000) c.put('ENQ_IDX', t, 300); } catch (e) { /* trop gros : pas de cache */ }
  return idx;
}

/** Appelée par le formulaire pendant la frappe : personnes des Enquêtes dont le nom commence par le texte. */
function rechercherPersonnes(texte) {
  try {
    return { ok: true, personnes: enqChercher_(enqIndexCache_(), texte, 8).map(function (p) { return { nom: p.nom, prenom: p.prenom, fonction: p.fonction, entreprise: p.entreprise }; }) };
  } catch (e) { return { ok: false, message: e.message, personnes: [] }; }
}

/** Ajoute aux Enquêtes les personnes de la demande qui n'y figurent pas encore. Ne lève jamais d'erreur : le résultat dit ce qui a été fait. */
function injecterEnquetes_(formData) {
  var r = { ajoutes: [], existants: [], sansOnglet: [], entreprise: enqEntrepriseDe_(formData.prestataire), erreur: '' };
  try {
    var gens = (formData.personnes || []).filter(function (p) { return Badges.vide(p.nom) && (Badges.vide(p.prenom) || /\s/.test(Badges.vide(p.nom))); });
    if (!gens.length) return r;
    if (!r.entreprise) { r.erreur = 'visite sur site : rien à ajouter'; return r; }
    var lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      var ss = enqClasseur_(), onglets = enqLireTout_(ss), idx = enqIndex_(onglets), cible = enqOngletPour_(onglets, r.entreprise);
      gens.forEach(function (p) {
        var nom = Badges.vide(p.nom), prenom = Badges.vide(p.prenom), nomComplet = enqNomComplet_(nom, prenom);
        if (enqTrouver_(idx, nom, prenom)) { r.existants.push(nomComplet); return; }
        if (!cible) { r.sansOnglet.push(nomComplet); return; }
        var sh = ss.getSheetByName(cible), lignes = sh.getDataRange().getDisplayValues(), col = Badges.colonnesEnquetes(lignes);
        if (!col || col.fr < 0) { r.sansOnglet.push(nomComplet); return; }
        var i = enqLigneLibre_(lignes, col), ligne = i + 1;
        if (i >= lignes.length && lignes.length > 1) sh.getRange(lignes.length, 1, 1, sh.getLastColumn()).copyTo(sh.getRange(ligne, 1, 1, sh.getLastColumn()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        sh.getRange(ligne, col.fr + 1).setValue(nomComplet);
        if (col.fonction >= 0 && Badges.vide(p.fonction)) sh.getRange(ligne, col.fonction + 1).setValue(Badges.vide(p.fonction));
        idx.push({ nom: nom, prenom: prenom, fonction: p.fonction, entreprise: r.entreprise, onglet: cible });
        r.ajoutes.push(nomComplet);
      });
    } finally { lock.releaseLock(); }
    if (r.ajoutes.length) CacheService.getScriptCache().remove('ENQ_IDX');
  } catch (e) { r.erreur = e.message; }
  return r;
}

/** Une ligne par personne et par demande, dans l'onglet « Journal_PEC » (créé au premier passage). */
function journaliserPEC_(ss, formData, enq) {
  try {
    var sh = ss.getSheetByName('Journal_PEC');
    if (!sh) { sh = ss.insertSheet('Journal_PEC'); sh.appendRow(['date', 'prestataire', 'base', 'documents', 'nom', 'prenom', 'fonction', 'vehicule', 'immatriculation', 'enquetes']); sh.setFrozenRows(1); }
    var date = Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy-MM-dd HH:mm');
    var docs = [formData.genererPEC ? 'PEC' : '', formData.genererAuto ? 'Autorisation' : ''].filter(Boolean).join('+');
    var lignes = (formData.personnes || []).map(function (p) {
      var nc = enqNomComplet_(p.nom, p.prenom), etat = enq ? (enq.ajoutes.indexOf(nc) >= 0 ? 'ajoutée' : enq.existants.indexOf(nc) >= 0 ? 'déjà présente' : enq.sansOnglet.indexOf(nc) >= 0 ? 'sans onglet' : '') : '';
      return [date, formData.prestataire || '', formData.base || '', docs, p.nom || '', p.prenom || '', p.fonction || '', p.typeVehicule || '', p.immatriculation || '', formData.injecterEnquetes ? etat : 'non demandé'];
    });
    if (lignes.length) sh.getRange(sh.getLastRow() + 1, 1, lignes.length, 10).setValues(lignes);
  } catch (e) { /* le journal ne doit jamais bloquer une génération */ }
}
