/**
 * Profil personnel : photo, champs que l'agent peut corriger lui-même, accès (accordés / non accordés) et demandes d'accès.
 *  - onglet « Profils » (email, nom_affiche, civilite, telephone, date_integration, wifi_user, photo_mini, photo, maj_le) : les corrections de l'agent sont gardées À PART,
 *    la synchronisation avec BDDORGA ne les écrase donc jamais ; le nom officiel (BDDORGA) reste celui des plannings, vis-à-vis et documents (« nom_affiche » ne sert qu'aux salutations et au profil) ;
 *  - onglet « DemandesAcces » (numero, email, titre, motif, statut, cree_le, traite_par, traite_le) : « Demander l'accès » écrit au secrétariat, au clic seulement.
 * Matricule SAP et NIN : voir profilEnregistrer_ (renseignés une fois, corrigés ensuite par le secrétariat). Fonction, service, employeur, rôle, matricule, SONA, e-mail du compte : fixes.
 */
var PROFIL_PHOTO_MINI_MAX_ = 14000, PROFIL_PHOTO_MAX_ = 45000;   // caractères d'une image encodée ; une cellule Google Sheets tient 50 000 caractères

function profilsPrets_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('PROFILS_PRET') === '1') return;
  try {
    var db = SpreadsheetApp.openById(prop_('DB_ID'));
    ['Profils', 'DemandesAcces'].forEach(function (n) {
      if (!db.getSheetByName(n)) { var sh = db.insertSheet(n); sh.appendRow(SCHEMA_[n]); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
    });
    props.setProperty('PROFILS_PRET', '1');
    ['TBL_Profils', 'TBL_DemandesAcces'].forEach(function (k) { try { CacheService.getScriptCache().remove(k); } catch (e) {} });
  } catch (e) { /* on réessaiera à la requête suivante */ }
}

/** Validation PURE (testée en Node) : { champs } des seules valeurs fournies, ou { erreur }. */
function profilValider_(req) {
  var champs = {}, t = function (s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }, v;
  if (req.nom_affiche !== undefined) { v = t(req.nom_affiche); if (v.length > 60) return { erreur: 'Nom : 60 caractères au plus.' }; champs.nom_affiche = v; }
  if (req.civilite !== undefined) { v = t(req.civilite); if (v.length > 12) return { erreur: 'Civilité : 12 caractères au plus.' }; champs.civilite = v; }
  if (req.telephone !== undefined) { v = t(req.telephone); if (v && !/^[0-9+ ().\-]{6,20}$/.test(v)) return { erreur: 'Téléphone : chiffres, espaces, + ( ) . - (6 à 20 caractères).' }; champs.telephone = v; }
  if (req.date_integration !== undefined) {
    v = t(req.date_integration);
    if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v + 'T00:00:00Z')) || v > Dates.today())) return { erreur: 'Date d\'intégration : une date passée (jj/mm/aaaa).' };
    champs.date_integration = v;
  }
  if (req.wifi_user !== undefined) { v = t(req.wifi_user); if (v.length > 40 || /\s/.test(v)) return { erreur: 'Identifiant Wi-Fi : 40 caractères au plus, sans espace.' }; champs.wifi_user = v; }
  return { champs: champs };
}
/** Fiche publique de l'agent complétée par ses corrections (les corrections non vides l'emportent ; le nom officiel reste dans `nom`). */
function profilFusion_(pub, o) {
  var p = {}; Object.keys(pub).forEach(function (k) { p[k] = pub[k]; });
  o = o || {};
  ['civilite', 'telephone', 'wifi_user'].forEach(function (k) { if (String(o[k] || '').trim()) p[k] = String(o[k]).trim(); });
  if (String(o.date_integration || '').trim()) p.date_integration = String(o.date_integration).trim();
  p.nom_affiche = String(o.nom_affiche || '').trim() || p.nom;
  p.photo = !!String(o.photo_mini || '').trim();
  return p;
}
function profilsParEmail_() {
  var m = {}; try { Store.table('Profils').forEach(function (r) { if (r.email) m[String(r.email).toLowerCase()] = r; }); } catch (e) { /* onglet pas encore créé */ }
  return m;
}
function profilDe_(email) { return profilsParEmail_()[String(email || '').toLowerCase()] || null; }

/** Applications du catalogue, accordées ou non à l'utilisateur d'après son menu. */
function profilAcces_(u) {
  var menu = Droits.menu(acces_(u), Store.table('Modules'), Store.table('Applications'), u.role), ok = {}, accessibles = [];
  menu.forEach(function (m) { (m.apps || []).forEach(function (a) { ok[String(a.url)] = true; accessibles.push({ titre: a.titre, emoji: a.emoji || '', url: a.url, module: m.titre }); }); });
  var vus = {}, non = [];
  Store.table('Applications').forEach(function (a) {
    var cle = String(a.url || a.titre); if (ok[cle] || vus[cle] || !a.titre) return; vus[cle] = true;
    non.push({ titre: a.titre, emoji: a.emoji || '', url: String(a.url || ''), description: String(a.description || '').slice(0, 200), module: a.module });
  });
  return { accessibles: accessibles, non_accessibles: non };
}

function profilMoi_(req) {
  var u = Auth.userFromToken(req.token); profilsPrets_();
  var dem = []; try { dem = Store.table('DemandesAcces').filter(function (r) { return String(r.email).toLowerCase() === String(u.email).toLowerCase(); }).sort(function (a, b) { return String(a.cree_le) < String(b.cree_le) ? 1 : -1; }).slice(0, 30)
    .map(function (r) { return { numero: String(r.numero), titre: String(r.titre), statut: String(r.statut), cree_le: String(r.cree_le) }; }); } catch (e) { dem = []; }
  var o = profilDe_(u.email);
  return { user: pubUser_(u), photo: o && o.photo ? String(o.photo) : '', acces: profilAcces_(u), demandes: dem };
}
function profilMaj_(req) {
  var u = Auth.userFromToken(req.token); profilsPrets_();
  var r = profilValider_(req); if (r.erreur) throw new Error(r.erreur);
  if (!Object.keys(r.champs).length) throw new Error('Rien à enregistrer.');
  r.champs.maj_le = new Date().toISOString();
  Store.maj('Profils', { email: String(u.email).toLowerCase() }, r.champs);
  Store.journal('profil_maj', u.email, Object.keys(r.champs).filter(function (k) { return k !== 'maj_le'; }).join(', '));
  return { user: pubUser_(u) };
}
function profilPhoto_(req) {
  var u = Auth.userFromToken(req.token); profilsPrets_();
  var mini = String(req.mini || ''), grand = String(req.grand || '');
  if (mini || grand) {
    var ok = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
    if (!ok.test(mini) || !ok.test(grand)) throw new Error('Image non valable (JPEG attendu).');
    if (mini.length > PROFIL_PHOTO_MINI_MAX_ || grand.length > PROFIL_PHOTO_MAX_) throw new Error('Image trop lourde : choisissez-en une plus petite.');
  }
  Store.maj('Profils', { email: String(u.email).toLowerCase() }, { photo_mini: mini, photo: grand, maj_le: new Date().toISOString() });
  Store.journal('profil_photo', u.email, mini ? 'photo mise à jour' : 'photo retirée');
  return { photo: grand };
}
/** Photos miniatures de tous les agents : { uid: image } (connexion requise). */
function photosMini_(req) {
  Auth.userFromToken(req.token); profilsPrets_();
  var par = profilsParEmail_(), out = {};
  Store.table('Utilisateurs').forEach(function (x) { var o = par[String(x.email || '').toLowerCase()]; if (o && o.photo_mini && x.uid) out[String(x.uid)] = String(o.photo_mini); });
  return { photos: out };
}

/** « Demander l'accès » : enregistre la demande et écrit au secrétariat (cette action n'est lancée que par le clic de l'agent). */
function accesDemander_(req) {
  var u = Auth.userFromToken(req.token); profilsPrets_();
  var titre = String(req.titre || '').trim(), motif = String(req.motif || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  var acc = profilAcces_(u);
  if (!acc.non_accessibles.some(function (a) { return a.titre === titre; })) throw new Error('Cette application est déjà accessible ou n\'existe pas.');
  var deja = Store.table('DemandesAcces').some(function (r) { return String(r.email).toLowerCase() === String(u.email).toLowerCase() && r.titre === titre && String(r.statut) === 'en_attente'; });
  if (deja) throw new Error('Vous avez déjà une demande en attente pour cette application.');
  var numero = 'ACC-' + Dates.today().slice(0, 4) + '-' + ('000' + (Store.table('DemandesAcces').length + 1)).slice(-4);
  Store.maj('DemandesAcces', { numero: numero }, { email: String(u.email).toLowerCase(), titre: titre, motif: motif, statut: 'en_attente', cree_le: new Date().toISOString(), traite_par: '', traite_le: '' });
  var dest = []; Store.table('Utilisateurs').forEach(function (x) { if (String(x.actif) !== '0' && Droits.roleCanon(x.role) === 'secretariat' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x.email || ''))) dest.push(String(x.email).toLowerCase()); });
  var envoye = 0;
  if (dest.length) { try { Mail.envoyerDemandeAcces(dest, { numero: numero, agent: Annuaire.nomAffichable(u.nom, u.email), service: u.service || '', role: u.role || '', titre: titre, motif: motif }); envoye = dest.length; } catch (e) { Store.journal('acces_demande_mail_echec', u.email, String(e.message || e)); } }
  Store.journal('acces_demande', u.email, numero + ' ' + titre);
  return { numero: numero, emails: envoye };
}
function accesDemandes_(req) {
  var u = Auth.userFromToken(req.token); profilsPrets_();
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var noms = {}; Store.table('Utilisateurs').forEach(function (x) { noms[String(x.email).toLowerCase()] = { nom: Annuaire.nomAffichable(x.nom, x.email), service: x.service || '', role: x.role || '' }; });
  var l = Store.table('DemandesAcces').sort(function (a, b) { return String(a.cree_le) < String(b.cree_le) ? 1 : -1; }).slice(0, 100).map(function (r) {
    var n = noms[String(r.email).toLowerCase()] || {};
    return { numero: String(r.numero), email: String(r.email), agent: n.nom || String(r.email), service: n.service || '', role: n.role || '', titre: String(r.titre), motif: String(r.motif || ''), statut: String(r.statut), cree_le: String(r.cree_le), traite_par: String(r.traite_par || '') };
  });
  return { demandes: l };
}
/** Marque la demande traitée (accordée ou refusée) ; l'accès lui-même s'accorde dans « Qui a accès à quoi » ou les exceptions individuelles. */
function accesTraiter_(req) {
  var u = Auth.userFromToken(req.token); profilsPrets_();
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var statut = String(req.statut) === 'refusee' ? 'refusee' : 'accordee';
  var r = Store.table('DemandesAcces').filter(function (x) { return String(x.numero) === String(req.numero); })[0];
  if (!r) throw new Error('Demande introuvable');
  Store.maj('DemandesAcces', { numero: String(r.numero) }, { statut: statut, traite_par: u.email, traite_le: new Date().toISOString() });
  Store.journal('acces_traite', u.email, String(r.numero) + ' ' + statut);
  return { numero: String(r.numero), statut: statut };
}
/**
 * Photos de profil pour les badges : pour chaque personne demandée { nom, prenom }, la photo (grand format) de l'agent du portail qui porte le même nom, sinon ''.
 * PURE : `meme(a, b)` compare deux noms (enqMemePersonne_ côté passerelle), `utilisateurs` = [{ email, nom }], `profils` = { email: { photo } }.
 */
function profilPhotosPour_(personnes, utilisateurs, profils, meme) {
  var avec = utilisateurs.filter(function (x) { return profils[String(x.email || '').toLowerCase()] && String(profils[String(x.email).toLowerCase()].photo || '').trim(); });
  return personnes.map(function (p) {
    var voulu = String(p.nom || '') + ' ' + String(p.prenom || '');
    if (!String(voulu).trim()) return '';
    var trouves = avec.filter(function (x) { return meme(voulu, x.nom); });
    return trouves.length === 1 ? String(profils[String(trouves[0].email).toLowerCase()].photo) : '';   // un homonyme douteux : aucune photo plutôt qu'une mauvaise
  });
}
/** « Badges » : photos de profil des personnes à imprimer (droit Badges, lecture) ; 80 personnes au plus par appel. */
function badgesPhotosProfils_(req) {
  badgesDroit_(req, 1); profilsPrets_();
  var l = (Array.isArray(req.personnes) ? req.personnes : []).slice(0, 80);
  var us = Store.table('Utilisateurs').filter(function (x) { return String(x.actif) !== '0' && x.email; }).map(function (x) { return { email: x.email, nom: Annuaire.nomAffichable(x.nom, x.email) }; });
  return { photos: profilPhotosPour_(l, us, profilsParEmail_(), enqMemePersonne_) };
}
if (typeof module !== 'undefined') module.exports = { profilValider_: profilValider_, profilFusion_: profilFusion_, profilPhotosPour_: profilPhotosPour_ };
