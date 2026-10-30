/**
 * Photos et vidéos des rapports journaliers : classées dans Google Drive (dossier « Rapports journaliers – médias », un sous-dossier par jour), jamais en lien public :
 * elles ne s'ouvrent que par la passerelle, pour les personnes qui peuvent lire le rapport. Les photos sont réduites par la page avant l'envoi ;
 * les vidéos partent par morceaux (la passerelle limite la taille d'une requête). Les médias ne sont pas repris dans le consolidé ni dans les e-mails.
 * Partie PURE (testée en Node : test/rapportmedias.test.js) puis les actions de la passerelle. Demande l'autorisation Google « Drive » (voir docs/PRISE-EN-CHARGE-PASSERELLE.md).
 */
var RapportMedias = (function () {
  var MAX_PAR_RAPPORT = 6, MAX_PHOTO = 2 * 1024 * 1024, MAX_VIDEO = 20 * 1024 * 1024, MAX_MORCEAU_B64 = 3 * 1024 * 1024, MAX_MORCEAUX = 20;
  var TYPES = { 'image/jpeg': ['photo', 'jpg'], 'image/png': ['photo', 'png'], 'image/webp': ['photo', 'webp'], 'video/mp4': ['video', 'mp4'], 'video/quicktime': ['video', 'mov'], 'video/webm': ['video', 'webm'], 'video/3gpp': ['video', '3gp'] };
  function typeDe(mime) { var t = TYPES[String(mime || '').toLowerCase()]; return t ? { type: t[0], ext: t[1] } : null; }
  function texte(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
  var ID = /^[A-Za-z0-9_-]{10,80}$/;
  /** Liste enregistrée dans le rapport : [{ id, type, nom, taille }] ; ce qui n'a pas la bonne forme est écarté. */
  function nettoyerListe(l) {
    var out = [], vus = {};
    (Array.isArray(l) ? l : []).forEach(function (m) {
      if (!m || !ID.test(String(m.id || '')) || vus[m.id] || out.length >= MAX_PAR_RAPPORT) return;
      vus[m.id] = 1; out.push({ id: String(m.id), type: m.type === 'video' ? 'video' : 'photo', nom: texte(m.nom, 80), taille: Math.max(0, Math.round(Number(m.taille) || 0)) });
    });
    return out;
  }
  function listeDe(valeur) { if (Array.isArray(valeur)) return nettoyerListe(valeur); try { return nettoyerListe(JSON.parse(String(valeur || '[]'))); } catch (e) { return []; } }
  /** Identifiants demandés par la page : texte sûr, 6 au plus. */
  function idsDemandes(l) { return (Array.isArray(l) ? l : []).map(function (x) { return String(x || ''); }).filter(function (x) { return ID.test(x); }).filter(function (x, i, t) { return t.indexOf(x) === i; }).slice(0, MAX_PAR_RAPPORT); }
  /** Contrôle d'un morceau reçu ; retourne { erreur } ou { ok, type, ext, premier, dernier }. */
  function controleMorceau(req) {
    var t = typeDe(req.mime); if (!t) return { erreur: 'Format non accepté (photo JPEG, PNG, WebP ; vidéo MP4, MOV, WebM, 3GP)' };
    var n = Math.floor(Number(req.partie)), total = Math.floor(Number(req.total)), taille = Math.floor(Number(req.taille)), b64 = String(req.data || '');
    if (!(total >= 1 && total <= MAX_MORCEAUX) || !(n >= 0 && n < total)) return { erreur: 'Envoi incomplet : recommencez' };
    if (t.type === 'photo' && total !== 1) return { erreur: 'Photo trop lourde : la page la réduit normalement, réessayez' };
    if (!(taille > 0) || taille > (t.type === 'photo' ? MAX_PHOTO : MAX_VIDEO)) return { erreur: t.type === 'photo' ? 'Photo trop lourde (2 Mo au plus après réduction)' : 'Vidéo trop lourde (20 Mo au plus, soit une trentaine de secondes)' };
    if (!b64 || b64.length > MAX_MORCEAU_B64 || /[^A-Za-z0-9+\/=]/.test(b64)) return { erreur: 'Morceau illisible : recommencez' };
    return { ok: true, type: t.type, ext: t.ext, premier: n === 0, dernier: n === total - 1 };
  }
  function nomFichier(date, chantier, type, n, ext) {
    return date + '_' + String(chantier || 'chantier').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) + '_' + (type === 'video' ? 'video' : 'photo') + '-' + (1000 + n).toString().slice(1) + '.' + ext;
  }
  /** Les identifiants du rapport après enregistrement : anciens médias encore demandés + nouveaux déjà vérifiés (ok(id) → description) ; retourne { gardes, retires }. */
  function fusion(existants, demandes, verifie) {
    var ex = {}; listeDe(existants).forEach(function (m) { ex[m.id] = m; });
    var gardes = [], retires = [];
    idsDemandes(demandes).forEach(function (id) { if (ex[id]) { gardes.push(ex[id]); return; } var v = verifie(id); if (v) gardes.push(v); });
    Object.keys(ex).forEach(function (id) { if (!gardes.some(function (g) { return g.id === id; })) retires.push(id); });
    return { gardes: nettoyerListe(gardes), retires: retires };
  }
  return { MAX_PAR_RAPPORT: MAX_PAR_RAPPORT, MAX_PHOTO: MAX_PHOTO, MAX_VIDEO: MAX_VIDEO, typeDe: typeDe, nettoyerListe: nettoyerListe, listeDe: listeDe, idsDemandes: idsDemandes, controleMorceau: controleMorceau, nomFichier: nomFichier, fusion: fusion };
})();
if (typeof module !== 'undefined') module.exports = RapportMedias;

// ---------- passerelle ----------
var MEDIAS_RACINE_ = 'Rapports journaliers – médias';
function mediasDossier_(nom, parent) {
  var it = parent.getFoldersByName(nom); return it.hasNext() ? it.next() : parent.createFolder(nom);
}
function mediasDossierJour_(date) { return mediasDossier_(date, mediasDossier_(MEDIAS_RACINE_, DriveApp.getRootFolder())); }
/** Reçoit un morceau (une photo = 1 morceau) ; au dernier morceau, assemble et classe le fichier. Réponse : { partie } ou { media: { id, type, nom, taille } }. */
function rapportMediaEnvoyer_(req) {
  var u = Auth.userFromToken(req.token), niv = niveauRapports_(u, 2);
  assurerColonnes_('Utilisateurs', ['chantiers_sup']); u = Auth.userFromToken(req.token);
  var date = String(req.date || ''), chantier = String(req.chantier || '').toLowerCase();
  if (date !== Dates.today()) throw new Error('Les photos et vidéos se joignent au rapport du jour');
  if (Rapports.chantiersVisibles(chantiersActifs_(), u, niv).map(function (c) { return c.id; }).indexOf(chantier) < 0) throw new Error('Chantier inconnu');
  var c = RapportMedias.controleMorceau(req); if (c.erreur) throw new Error(c.erreur);
  var envoi = String(req.envoi || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24); if (envoi.length < 8) throw new Error('Envoi illisible : recommencez');
  var octets = Utilities.base64Decode(String(req.data)), dossier;
  try { dossier = mediasDossierJour_(date); } catch (e) { throw new Error('Le stockage des photos et vidéos n\'est pas encore autorisé sur le serveur (autorisation Google « Drive » à activer) : ' + e.message); }
  var cle = 'MED_' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, u.email + '|' + envoi)).replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  var tmp = mediasDossier_('_en cours', dossier);
  if (!c.dernier) { tmp.createFile(Utilities.newBlob(octets, 'application/octet-stream', cle + '_' + ('000' + Number(req.partie)).slice(-3))); return { partie: Number(req.partie) }; }
  var morceaux = [], it = tmp.getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf(cle + '_') === 0) morceaux.push(f); }
  morceaux.sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; });
  if (morceaux.length !== Number(req.total) - 1) throw new Error('Envoi incomplet : recommencez');
  var tout = []; morceaux.forEach(function (f) { tout = tout.concat(f.getBlob().getBytes()); }); tout = tout.concat(octets);
  if (tout.length !== Math.floor(Number(req.taille))) throw new Error('Envoi incomplet : recommencez');
  var n = 1, existants = dossier.getFiles(), pref = date + '_' + chantier.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) + '_' + c.type;
  while (existants.hasNext()) { if (existants.next().getName().indexOf(pref) === 0) n += 1; }
  var nom = RapportMedias.nomFichier(date, chantier, c.type, n, c.ext), fichier = dossier.createFile(Utilities.newBlob(tout, String(req.mime).toLowerCase(), nom));
  fichier.setDescription(JSON.stringify({ auteur: String(u.email).toLowerCase(), date: date, chantier: chantier, type: c.type, nom: nom, taille: tout.length }));
  morceaux.forEach(function (f) { f.setTrashed(true); });
  Store.journal('rapport_media_ajout', u.email, nom + ' (' + Math.round(tout.length / 1024) + ' Ko)');
  return { media: { id: fichier.getId(), type: c.type, nom: nom, taille: tout.length } };
}
/** Vérifie qu'un fichier envoyé par cette personne pour ce chantier et ce jour peut être joint au rapport ; retourne { id, type, nom, taille } ou null. */
function mediaVerifie_(id, email, date, chantier) {
  try {
    var f = DriveApp.getFileById(id), d = JSON.parse(f.getDescription() || '{}');
    if (String(d.auteur) !== String(email).toLowerCase() || d.date !== date || String(d.chantier) !== String(chantier).toLowerCase()) return null;
    return { id: id, type: d.type === 'video' ? 'video' : 'photo', nom: d.nom, taille: d.taille };
  } catch (e) { return null; }
}
/** Médias du rapport enregistré : garde les anciens encore demandés, joint les nouveaux vérifiés, met les autres à la corbeille. */
function mediasDuRapport_(existants, demandes, email, date, chantier) {
  var f = RapportMedias.fusion(existants, demandes, function (id) { return mediaVerifie_(id, email, date, chantier); });
  f.retires.forEach(function (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* déjà supprimé */ } });
  return f.gardes;
}
/** Ouvre un média : réservé à qui peut lire le rapport qui le contient. Réponse : { type, mime, nom, base64 }. */
function rapportMediaLire_(req) {
  var u = Auth.userFromToken(req.token), niv = niveauRapports_(u, 1), id = String(req.id || '');
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) throw new Error('Média inconnu');
  var voitTout = Rapports.peutCorriger(u, Droits.roleCanon(u.role));
  var r = Rapports.filtrer(rapportsLus_(), u, voitTout ? 3 : niv, {}).filter(function (x) { return (x.medias || []).some(function (m) { return m.id === id; }); })[0];
  if (!r) throw Object.assign(new Error('Média introuvable ou hors de votre périmètre'), { code: 'DROITS' });
  var m = r.medias.filter(function (x) { return x.id === id; })[0], f = DriveApp.getFileById(id), b = f.getBlob();
  return { type: m.type, mime: b.getContentType(), nom: m.nom, base64: Utilities.base64Encode(b.getBytes()) };
}
