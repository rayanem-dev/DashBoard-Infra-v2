/**
 * Prise en charge et autorisation d'accès, hébergée par la passerelle (derrière la connexion du portail).
 * Le moteur (génération des PDF, lecture du Suivi CPM, Enquêtes…) est celui de apps-script/prise-en-charge/Code.js, repris à l'identique dans
 * PecMoteur.gs (généré, fonctions pecw_*) ; ce fichier n'ajoute que : l'identité de la personne, ses droits, la limite « prestataire = ses contrats »,
 * un verrou (une génération à la fois, car le moteur écrit dans la feuille « PEC ») et le journal.
 * Droits : module « logistique » (comme la carte du catalogue) ; niveau 2 pour les actions d'administration.
 * Un prestataire ne voit et ne génère que pour ses entreprises (colonne « portee » de son compte) ; les fichiers qu'il génère sont les seuls qu'il voit.
 */
// fonction appelée par la page → { moteur: nom dans PecMoteur.gs ou null si définie dans Enquetes.gs / ici, niveau, admin: réservé (niveau 2, jamais un prestataire) }
var PEC_APPELS_ = {
  obtenirOptionsFormulaire: { moteur: 'pecw_obtenirOptionsFormulaire', niveau: 1 },
  soumettreFormulairePEC: { moteur: 'pecw_soumettreFormulairePEC', niveau: 1, verrou: true },
  traiterPDFUploadPECWeb: { moteur: 'pecw_traiterPDFUploadPECWeb', niveau: 1 },
  rechercherPersonnes: { global: 'rechercherPersonnes', niveau: 1 },
  verifierEnquetes: { global: 'verifierEnquetes', niveau: 1 },
  historiquePEC: { global: 'historiquePEC', niveau: 1 },
  listerFichiersGeneres: { moteur: 'pecw_listerFichiersGeneres', niveau: 1 },
  lireFichierPourImpression: { moteur: 'pecw_lireFichierPourImpression', niveau: 1, fichier: true },
  envoyerFichierParMail: { moteur: 'pecw_envoyerFichierParMail', niveau: 1, fichier: true },
  supprimerFichierGenere: { moteur: 'pecw_supprimerFichierGenere', niveau: 1, fichier: true },
  ajouterOrganisme: { moteur: 'pecw_ajouterOrganisme', niveau: 2, admin: true },
  actualiserPrestatairesWeb: { moteur: 'pecw_actualiserPrestatairesWeb', niveau: 2, admin: true, verrou: true },
  effacerToutWeb: { moteur: 'pecw_effacerToutWeb', niveau: 2, admin: true },
  ouvrirDossierPDFWeb: { moteur: 'pecw_ouvrirDossierPDFWeb', niveau: 2, admin: true }
};
var PEC_MODULE_ = 'logistique';

/** Pur : entreprise d'une option « N° contrat - Entreprise - Intitulé » (les organismes hors CPM n'ont pas ce format et ne correspondent à aucun prestataire). */
function pecEntrepriseOption_(option) {
  var p = String(option == null ? '' : option).split(' - ');
  return p.length >= 2 ? p[1].trim() : '';
}
/** Pur : l'option appartient-elle aux entreprises autorisées ? portee = null (aucune limite) ou liste normalisée. */
function pecOptionAutorisee_(portee, option) { return portee === null || (typeof badgesDansPortee_ === 'function' ? badgesDansPortee_(portee, pecEntrepriseOption_(option)) : false); }
/** Pur : options du formulaire limitées aux entreprises autorisées. */
function pecOptionsPourPortee_(options, portee) {
  if (portee === null || !options) return options;
  var ok = function (o) { return pecOptionAutorisee_(portee, o); }, filtre = function (m) { var r = {}; Object.keys(m || {}).forEach(function (k) { if (ok(k)) r[k] = m[k]; }); return r; };
  var r = {}; Object.keys(options).forEach(function (k) { r[k] = options[k]; });
  r.prestataires = (options.prestataires || []).filter(ok);
  r.servicesParPrestataire = filtre(options.servicesParPrestataire); r.basesParPrestataire = filtre(options.basesParPrestataire);
  return r;
}
/** Pur : identifiants Drive contenus dans des liens « …/d/ID/… » ou « …?id=ID ». */
function pecIdsDeLiens_(liens) {
  var ids = [];
  (liens || []).forEach(function (l) { var m = /\/d\/([A-Za-z0-9_\-]{10,})/.exec(String(l && l.url)) || /[?&]id=([A-Za-z0-9_\-]{10,})/.exec(String(l && l.url)); if (m && ids.indexOf(m[1]) === -1) ids.push(m[1]); });
  return ids;
}
function pecMesFichiers_(u) { try { return JSON.parse(CacheService.getScriptCache().get('PEC_MES_' + String(u.uid || u.email)) || '[]'); } catch (e) { return []; } }
function pecRetenirFichiers_(u, ids) {
  if (!ids.length) return;
  var l = pecMesFichiers_(u).concat(ids).filter(function (x, i, t) { return t.indexOf(x) === i; }).slice(-60);
  try { CacheService.getScriptCache().put('PEC_MES_' + String(u.uid || u.email), JSON.stringify(l), 21600); } catch (e) { /* tant pis : il ne verra pas la liste, mais les liens restent affichés */ }
}
function pecGlobale_(nom) { var g = (typeof globalThis !== 'undefined') ? globalThis : this; return g[nom]; }

/** Point d'entrée unique : { fn, args: [...] } → résultat de la fonction d'origine (même forme que dans l'ancienne application). */
function pecAppeler_(req) {
  var u = Auth.userFromToken(req.token), niveauModule = acces_(u)[PEC_MODULE_] || 0, def = PEC_APPELS_[String(req.fn)];
  if (!def) throw new Error('Action inconnue');
  if (niveauModule < def.niveau) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var portee = badgesPortee_(u), args = Array.isArray(req.args) ? req.args : [];
  if (portee !== null && def.admin) throw Object.assign(new Error('Réservé au personnel de la division'), { code: 'DROITS' });
  var f = def.moteur ? pecGlobale_(def.moteur) : pecGlobale_(def.global);
  if (typeof f !== 'function') throw new Error('Moteur de prise en charge indisponible');
  // limite « prestataire = ses contrats »
  if (portee !== null) {
    if (req.fn === 'soumettreFormulairePEC' || req.fn === 'verifierEnquetes') { if (!pecOptionAutorisee_(portee, args[0] && args[0].prestataire)) throw Object.assign(new Error('Ce contrat ne fait pas partie de vos contrats'), { code: 'DROITS' }); }
    if (def.fichier && pecMesFichiers_(u).indexOf(String(args[0] || '')) === -1) throw Object.assign(new Error('Ce document ne fait pas partie de vos documents'), { code: 'DROITS' });
    if (req.fn === 'historiquePEC') return { ok: true, demandes: [] };
  }
  var lock = def.verrou ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(100000);
  var r;
  try { r = f.apply(null, args); }
  catch (e) {
    if (/permission|authori[sz]ation|autoris/i.test(String(e && e.message))) throw new Error('La prise en charge n\'a pas encore l\'autorisation de créer des documents : l\'administrateur doit activer les autorisations de la passerelle (docs/PRISE-EN-CHARGE-PASSERELLE.md).');
    throw e;
  } finally { if (lock) lock.releaseLock(); }
  // filtres de sortie pour un prestataire
  if (portee !== null && r) {
    if (req.fn === 'obtenirOptionsFormulaire') r = pecOptionsPourPortee_(r, portee);
    else if (req.fn === 'rechercherPersonnes' && r.personnes) r.personnes = r.personnes.filter(function (p) { return badgesDansPortee_(portee, p.entreprise); });
    else if (req.fn === 'listerFichiersGeneres' && r.fichiers) { var mes = pecMesFichiers_(u); r.fichiers = r.fichiers.filter(function (x) { return mes.indexOf(x.id) !== -1; }); }
    else if (req.fn === 'soumettreFormulairePEC' && r.liens) pecRetenirFichiers_(u, pecIdsDeLiens_(r.liens));
  }
  if (req.fn === 'soumettreFormulairePEC') Store.journal('pec', u.email, String(args[0] && args[0].prestataire || '').slice(0, 150) + (r && r.success ? '' : ' (échec)'));
  else if (def.admin) Store.journal('pec_admin', u.email, req.fn);
  return r;
}
/** Entreprises présentes dans l'onglet « Config » du classeur PEC (liste telle que le moteur la voit) : pour choisir les entreprises d'un prestataire. */
function pecEntreprisesConfig_() {
  try {
    var sh = SpreadsheetApp.openById(PEC_SS_ID).getSheetByName('Config'), noms = {};
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { var n = String(r[0] || '').trim(); if (n) noms[n] = 1; });
    return Object.keys(noms);
  } catch (e) { return []; }
}
if (typeof module !== 'undefined') module.exports = { pecEntrepriseOption_: pecEntrepriseOption_, pecOptionsPourPortee_: pecOptionsPourPortee_, pecIdsDeLiens_: pecIdsDeLiens_, PEC_APPELS_: PEC_APPELS_ };

/** À lancer UNE FOIS dans l'éditeur Apps Script (▶ Exécuter) après activation de GATEWAY_SCOPES_PEC : fait demander les autorisations Docs et Drive. */
function autoriserPriseEnCharge() {
  DriveApp.getFileById(PEC_SS_ID).getName();
  DocumentApp.openById(PECW_TEMPLATE_PEC_ID).getName();
  PropertiesService.getScriptProperties().setProperty('PEC_PORTAIL_PRET', '1');   // à partir de maintenant la carte du catalogue ouvre la page du portail
  Logger.log('Autorisations Docs et Drive accordées. Quota d\'e-mails restant : ' + MailApp.getRemainingDailyQuota());
}
