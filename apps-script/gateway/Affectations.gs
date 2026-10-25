/**
 * Affectation du personnel (module « affectation ») : changer le SERVICE d'une personne directement dans BDDORGA (fichier Organigramme),
 * puis dans la passerelle, avec historique et e-mail. Niveau 3 = tout le personnel (chef de division, secrétariat) ; niveau 2 = les personnes de SON service.
 *
 * Ordre voulu : on écrit d'abord dans BDDORGA (la source de référence) ; si l'écriture échoue, RIEN n'est modifié (sinon la synchronisation
 * quotidienne remettrait l'ancien service). Les droits sur le planning par service suivent aussitôt le nouveau service.
 */
function affDroits_() { return Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' }); }
function affNiveau_(u) { return acces_(u).affectation || 0; }
function affNorm_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
function affCle_(s) { return affNorm_(s).toLowerCase(); }
function affDansPortee_(u, cible) {
  var niv = affNiveau_(u);
  if (niv >= 3) return true;
  return niv >= 2 && !!affCle_(u.service) && affCle_(u.service) === affCle_(cible.service);
}

function affPersonnes_(req) {
  var u = Auth.userFromToken(req.token);
  if (typeof preparerAffectation_ === 'function') preparerAffectation_();
  if (affNiveau_(u) < 2) throw affDroits_();
  var services = {}, personnes = [];
  Store.table('Utilisateurs').forEach(function (x) {
    if (String(x.actif) === '0' || !x.uid) return;
    var sv = affNorm_(x.service); if (sv) services[sv] = true;
    if (affDansPortee_(u, x)) personnes.push({ uid: String(x.uid), nom: Annuaire.nomAffichable(x.nom, x.email), service: sv, fonction: x.fonction || '', dependance: x.dependance || '' });
  });
  personnes.sort(function (a, b) { return a.nom < b.nom ? -1 : 1; });
  return { niveau: affNiveau_(u), personnes: personnes, services: Object.keys(services).sort(), moi: String(u.uid || '') };
}

function affChanger_(req) {
  var u = Auth.userFromToken(req.token);
  if (typeof preparerAffectation_ === 'function') preparerAffectation_();
  if (affNiveau_(u) < 2) throw affDroits_();
  var c = Store.parUid(req.uid);
  if (!c || String(c.actif) === '0') throw new Error('Personne inconnue');
  if (!affDansPortee_(u, c)) throw affDroits_();
  if (affNiveau_(u) < 3 && String(c.uid) === String(u.uid)) throw new Error('Vous ne pouvez pas modifier votre propre affectation');
  var nouveau = affNorm_(req.service);
  if (nouveau.length < 2 || nouveau.length > 60) throw new Error('Service : de 2 à 60 caractères');
  if (/[=+@<>]/.test(nouveau.charAt(0))) throw new Error('Service invalide');
  var ancien = affNorm_(c.service);
  if (affCle_(nouveau) === affCle_(ancien)) throw new Error('Cette personne est déjà dans ce service');
  var connus = {}; Store.table('Utilisateurs').forEach(function (x) { var s = affNorm_(x.service); if (s) connus[affCle_(s)] = s; });
  if (connus[affCle_(nouveau)]) nouveau = connus[affCle_(nouveau)]; // orthographe du service existant
  else if (!req.creer) throw new Error('Ce service n\'existe pas encore : confirmez sa création');
  var motif = affNorm_(req.motif).slice(0, 120);
  // 1) BDDORGA d'abord : en cas d'échec rien n'est modifié
  try { ecrireServiceBddorga_(c.email, nouveau); }
  catch (e) { Store.journal('affectation_echec', u.email, c.email + ' → ' + nouveau + ' : ' + String(e.message || e)); throw new Error('Écriture dans BDDORGA impossible : ' + (e.message || e) + ' (rien n\'a été modifié)'); }
  // 2) passerelle + historique
  Store.maj('Utilisateurs', { email: c.email }, { service: nouveau });
  var id = 'AFF-' + new Date().getFullYear() + '-' + ('000' + (Store.table('Affectations').length + 1)).slice(-4);
  Store.maj('Affectations', { id: id }, { date: new Date().toISOString(), email: c.email, ancien: ancien, nouveau: nouveau, par: u.email, motif: motif, date_effet: /^\d{4}-\d{2}-\d{2}$/.test(String(req.date_effet || '')) ? String(req.date_effet) : '' });
  Store.journal('affectation', u.email, c.email + ' : ' + ancien + ' → ' + nouveau);
  var emails = 0;
  if (req.envoyer_mail !== false) try {   // e-mail facultatif (case de la page ; envoyé par défaut)
    var dest = {}; function aj(e) { e = String(e || '').trim().toLowerCase(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) dest[e] = true; }
    aj(c.email); aj(u.email);
    Store.table('Utilisateurs').forEach(function (x) { var r = Droits.roleCanon(x.role); if (String(x.actif) !== '0' && (r === 'chef_division' || r === 'secretariat')) aj(x.email); });
    var liste = Object.keys(dest);
    Mail.envoyerAffectation(liste, { id: id, nom: Annuaire.nomAffichable(c.nom, c.email), ancien: ancien, nouveau: nouveau, motif: motif, par: Annuaire.nomAffichable(u.nom, u.email), date_effet: req.date_effet || '' });
    emails = liste.length;
  } catch (e2) { Store.journal('affectation_mail_echec', u.email, String(e2.message || e2)); }
  return { id: id, ancien: ancien, nouveau: nouveau, emails: emails };
}

function affHistorique_(req) {
  var u = Auth.userFromToken(req.token);
  if (affNiveau_(u) < 2) throw affDroits_();
  var l = Store.table('Affectations').filter(function (r) { var c = Store.utilisateur(r.email) || {}; return affNiveau_(u) >= 3 || affCle_(r.ancien) === affCle_(u.service) || affCle_(r.nouveau) === affCle_(u.service) || affDansPortee_(u, c); })
    .sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; }).slice(0, 100);
  return { historique: l.map(function (r) { var c = Store.utilisateur(r.email) || {}, p = Store.utilisateur(r.par) || {};
    return { id: String(r.id), date: String(r.date), nom: Annuaire.nomAffichable(c.nom, r.email), ancien: String(r.ancien || ''), nouveau: String(r.nouveau || ''), par: Annuaire.nomAffichable(p.nom, r.par), motif: String(r.motif || ''), date_effet: String(r.date_effet || '') }; }) };
}

/** Projets (chantiers) d'autres services ouverts à une personne pour saisir ses rapports : son service d'affectation ne change pas. */
function affChantiersSupLire_(req) {
  var u = Auth.userFromToken(req.token);
  if (affNiveau_(u) < 2) throw affDroits_();
  assurerColonnes_('Utilisateurs', ['chantiers_sup']);
  var c = Store.parUid(req.uid);
  if (!c || String(c.actif) === '0') throw new Error('Personne inconnue');
  if (!affDansPortee_(u, c)) throw affDroits_();
  return { service: affNorm_(c.service), sup: Rapports.idsSup(c), chantiers: chantiersActifs_().filter(function (x) { return String(x.contrat || '').trim(); }).map(function (x) { return { id: x.id, nom: x.nom, service: x.service }; }) };
}
function affChantiersSupMaj_(req) {
  var u = Auth.userFromToken(req.token);
  if (affNiveau_(u) < 2) throw affDroits_();
  assurerColonnes_('Utilisateurs', ['chantiers_sup']);
  var c = Store.parUid(req.uid);
  if (!c || String(c.actif) === '0') throw new Error('Personne inconnue');
  if (!affDansPortee_(u, c)) throw affDroits_();
  var valides = {}; chantiersActifs_().forEach(function (x) { valides[x.id] = true; });
  var ids = (Array.isArray(req.ids) ? req.ids : []).map(function (x) { return String(x).toLowerCase(); }).filter(function (x, i, t) { return valides[x] && t.indexOf(x) === i; });
  Store.maj('Utilisateurs', { email: c.email }, { chantiers_sup: ids.join(' ; ') });
  Store.journal('chantiers_sup', u.email, c.email + ' → ' + (ids.join(' ; ') || 'aucun'));
  return { sup: ids };
}
