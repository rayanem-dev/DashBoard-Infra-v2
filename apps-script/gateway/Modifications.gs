/**
 * Simulation et demandes de modification de planning (module « simulation »).
 *
 * Niveaux du module : 2 = simuler, émettre et approuver pour les agents de SON service (chef de service, intérim) ; 3 = pour tous (chef de division, secrétariat).
 * Une simulation n'enregistre rien. « Valider » enregistre une DEMANDE numérotée (statut en_attente) et prévient par e-mail l'intéressé,
 * l'émetteur, le chef de division et le secrétariat. Une demande APPROUVÉE s'applique au planning officiel (corrections du moteur de Sijil) ;
 * une demande refusée est seulement archivée. Le calcul est celui de Simulation.gs (copie de js/simulation.js, voir le workflow de déploiement).
 */
var VILLE_ = 'Rhourde Nouss';

function simuDroits_() { return Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' }); }
function simuNiveau_(u) { return acces_(u).simulation || 0; }
function simuNorm_(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

/** Niveau 3 : tout le monde ; niveau 2 : les agents du même service que le responsable. */
function simuDansPortee_(u, cible) {
  var niv = simuNiveau_(u);
  if (niv >= 3) return true;
  if (niv >= 2) return !!simuNorm_(u.service) && simuNorm_(u.service) === simuNorm_(cible.service);
  return false;
}
function simuCible_(u, uid) {
  var c = Store.parUid(uid);
  if (!c || String(c.actif) === '0') throw new Error('Agent inconnu');
  if (!simuDansPortee_(u, c)) throw simuDroits_();
  return c;
}
function simuJson_(v, defaut) { try { return JSON.parse(String(v)); } catch (e) { return defaut; } }

/**
 * Corrections (pointages T/R) de chaque agent : { email: [{ date, statut }] }, dans l'ordre de création des demandes.
 * Comptent les demandes APPROUVÉES et les demandes « appliquées » (demande de l'agent déjà en vigueur, en attente de décision) ; `approuveesSeulement` : planning officiel validé.
 * Une demande plus récente remplace les corrections plus anciennes à partir de son premier jour. Refusée, annulée ou remplacée : sans effet (retour au planning initial).
 */
function correctionsParEmail_(approuveesSeulement) {
  var out = {}, l = [], ok = approuveesSeulement ? ['approuvee'] : ['approuvee', 'appliquee'];
  try { l = Store.table('Modifications'); } catch (e) { l = []; }
  l.filter(function (r) { return ok.indexOf(String(r.statut)) >= 0; })
    .sort(function (a, b) { return String(a.cree_le) < String(b.cree_le) ? -1 : String(a.cree_le) > String(b.cree_le) ? 1 : 0; })
    .forEach(function (r) {
      var m = { debut: jour_(r.debut), periodes: simuJson_(r.periodes, []), reprise: String(r.reprise) };
      if (!Simulation.estDate(m.debut) || !m.periodes.length) return;
      var k = String(r.email).toLowerCase();
      out[k] = (out[k] || []).filter(function (c) { return c.date < m.debut; }).concat(Simulation.corrections(m));
    });
  return out;
}
/**
 * Solde de reliquat d'un agent : reliquat initial saisi + reliquat laissé (net) par ses demandes APPROUVÉES.
 */
function soldeDe_(email) {
  var rot = rotationDe_(email), solde = rot && rot.reliquat !== null ? rot.reliquat : 0, l = [];
  try { l = Store.table('Modifications'); } catch (e) { l = []; }
  l.forEach(function (r) { if (String(r.statut) === 'approuvee' && String(r.email).toLowerCase() === String(email).toLowerCase()) solde += Number(r.reliquat_net) || 0; });
  return { initial: rot && rot.reliquat !== null ? rot.reliquat : null, solde: solde };
}
function correctionsDe_(email) { return correctionsParEmail_()[String(email).toLowerCase()] || []; }
function correctionsValideesDe_(email) { return correctionsParEmail_(true)[String(email).toLowerCase()] || []; }

function simuAgents_(req) {
  if (typeof preparerSimulation_ === 'function') preparerSimulation_();
  var u = Auth.userFromToken(req.token);
  if (simuNiveau_(u) < 2) throw simuDroits_();
  var rots = {}; Store.table('Rotations').forEach(function (r) { rots[String(r.email).toLowerCase()] = true; });
  var agents = Store.table('Utilisateurs').filter(function (x) { return String(x.actif) !== '0' && x.uid && x.email && simuDansPortee_(u, x); })
    .map(function (x) { return { uid: String(x.uid), nom: Annuaire.nomAffichable(x.nom, x.email), service: x.service || '', fonction: x.fonction || '', dependance: x.dependance || '', configuree: !!rots[String(x.email).toLowerCase()] }; })
    .sort(function (a, b) { return a.nom < b.nom ? -1 : 1; });
  return { agents: agents, niveau: simuNiveau_(u), moi: String(u.uid || '') };
}

/** Rotation + planning officiel de l'agent sur la fenêtre demandée (le calcul de la simulation se fait dans le navigateur, sur cette grille). */
function simuDonnees_(req) {
  var u = Auth.userFromToken(req.token);
  if (simuNiveau_(u) < 2) throw simuDroits_();
  var c = simuCible_(u, req.uid);
  var rot = rotationDe_(c.email); if (!rot) throw new Error('Cet agent n\'a pas encore renseigné sa rotation');
  var auj = Dates.today();
  var debut = Dates.isDate(req.debut) ? req.debut : Dates.addDays(auj, -35);
  // la fenêtre commence à la même date pour tous les agents (avant le début de sa rotation, la grille est faite de « . ») : deux grilles se superposent toujours
  var n = Math.max(30, Math.min(400, Number(req.jours) || 240));
  return { uid: String(c.uid), nom: Annuaire.nomAffichable(c.nom, c.email), service: c.service || '', fonction: c.fonction || '', rotation: rot,
           aujourdhui: auj, debut: debut, jours: n, grille: Planning.grille(rot, correctionsDe_(c.email), debut, n), reliquat_initial: soldeDe_(c.email).initial, solde: soldeDe_(c.email).solde };
}

function simuModif_(req) {
  return { debut: String(req.debut || ''), periodes: (Array.isArray(req.periodes) ? req.periodes : []).map(function (p) { return { type: String(p && p.type), jours: Number(p && p.jours) }; }), reprise: String(req.reprise || '') };
}

/** Tableaux « actuel » / « modifié » de la demande, recalculés côté serveur (jamais pris tels quels du navigateur). */
function simuTableaux_(rot, corr, m) {
  var jt = Number(rot.jours_travail), jr = Number(rot.jours_repos), cy = jt + jr;
  var F = Dates.addDays(m.debut, -(cy + 30)); if (F < rot.depuis) F = rot.depuis;
  var rep = Simulation.dateReprise(m), fin = Dates.addDays(rep, 2 * cy - 1);
  var n = Simulation.diff(F, fin) + 1;
  var off = Planning.grille(rot, corr, F, n), mod = Simulation.appliquer(off, F, m, rot);
  var du = m.debut; // début de la période en cours la veille de la modification : repère pour le lecteur
  if (du > F) { var c = off.charAt(Simulation.diff(F, du) - 1); var i = Simulation.diff(F, du) - 1; while (i > 0 && off.charAt(i - 1) === c) i -= 1; du = Dates.addDays(F, i); }
  var rq = Simulation.reliquatDetail(off, mod, F, m), retour = Simulation.retour(Planning.grille(rot, [], F, n), mod, F, cy);
  return { retour: retour, actuel: Simulation.tableau(off, F, du, fin).slice(0, 14), modifie: Simulation.tableau(mod, F, du, fin).slice(0, 14), reprise: rep, reliquat: rq.pic, reliquat_net: rq.net };
}

function simuNumero_() {
  var an = String(new Date().getFullYear()), pref = 'MOD-' + an + '-', max = 0;
  Store.table('Modifications').forEach(function (r) { var s = String(r.numero); if (s.indexOf(pref) === 0) max = Math.max(max, Number(s.slice(pref.length)) || 0); });
  return pref + ('000' + (max + 1)).slice(-4);
}

/**
 * Valide UNE ou DEUX modifications d'un coup (req.lot : [{ uid, debut, periodes, reprise }]) : tout est contrôlé avant d'enregistrer quoi que ce soit,
 * puis une demande numérotée par agent est créée (même motif, statut en attente) et notifiée par e-mail.
 */
function simuValider_(req) {
  var u = Auth.userFromToken(req.token);
  if (simuNiveau_(u) < 2) throw simuDroits_();
  var lot = Array.isArray(req.lot) && req.lot.length ? req.lot : [req];
  if (lot.length > 2) throw new Error('Deux agents au maximum par simulation');
  var motif = String(req.motif || 'Raison de service').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (motif.length < 3) throw new Error('Indiquez le motif de la demande');
  var auj = Dates.today(), vus = {};
  var prets = lot.map(function (it) {
    var c = simuCible_(u, it.uid);
    if (vus[c.uid]) throw new Error('Le même agent ne peut pas être modifié deux fois');
    vus[c.uid] = true;
    var rot = rotationDe_(c.email); if (!rot) throw new Error(Annuaire.nomAffichable(c.nom, c.email) + ' n\'a pas encore renseigné sa rotation');
    var m = simuModif_(it), err = Simulation.valider(m, rot, auj);
    if (err) throw new Error(Annuaire.nomAffichable(c.nom, c.email) + ' : ' + err);
    return { c: c, m: m, t: simuTableaux_(rot, correctionsDe_(c.email), m) };
  });
  var lock = (typeof LockService !== 'undefined') ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(15000);
  var numeros = [];
  try {
    prets.forEach(function (p, i) {
      var numero = simuNumero_(), autre = prets[1 - i];
      Store.maj('Modifications', { numero: numero }, {
        cree_le: new Date().toISOString(), email: p.c.email, emetteur: u.email, motif: motif, debut: p.m.debut, periodes: JSON.stringify(p.m.periodes), reprise: p.m.reprise,
        partenaire: autre ? String(autre.c.uid) : String(req.partenaire || '').slice(0, 40), actuel: JSON.stringify(p.t.actuel), modifie: JSON.stringify(p.t.modifie), statut: 'en_attente', decide_par: '', decide_le: '', commentaire: '', reliquat: p.t.reliquat, reliquat_net: p.t.reliquat_net
      });
      numeros.push(numero);
    });
  } finally { if (lock) lock.releaseLock(); }
  var emails = 0, demandes = [];
  numeros.forEach(function (numero, i) {
    Store.journal('modification_demandee', u.email, numero + ' ' + prets[i].c.email + ' du ' + prets[i].m.debut);
    var row = simuLigne_(numero); demandes.push(simuDemandeDe_(row)); emails = Math.max(emails, simuNotifier_(row, 'demandee', u));
  });
  return { numero: numeros[0], numeros: numeros, emails: emails, demande: demandes[0], demandes: demandes };
}

function simuLigne_(numero) {
  var l = Store.table('Modifications');
  for (var i = 0; i < l.length; i += 1) if (String(l[i].numero) === String(numero)) return l[i];
  return null;
}

function simuResume_(r, u) {
  var cible = Store.utilisateur(r.email) || {}, emet = Store.utilisateur(r.emetteur) || {};
  var m = { debut: jour_(r.debut), periodes: simuJson_(r.periodes, []), reprise: String(r.reprise) };
  return { numero: String(r.numero), cree_le: String(r.cree_le), agent: Annuaire.nomAffichable(cible.nom, r.email), service: cible.service || '', debut: m.debut,
           reprise_le: m.periodes.length ? Simulation.dateReprise(m) : '', motif: String(r.motif || ''), statut: String(r.statut), emetteur: Annuaire.nomAffichable(emet.nom, r.emetteur),
           decide_par: r.decide_par ? Annuaire.nomAffichable((Store.utilisateur(r.decide_par) || {}).nom, r.decide_par) : '', decide_le: String(r.decide_le || ''), commentaire: String(r.commentaire || ''),
           peut_decider: simuAttend_(r) && simuNiveau_(u) >= 2 && simuDansPortee_(u, cible) && String(r.email).toLowerCase() !== String(u.email).toLowerCase(),
           hors_rotation: simuAttend_(r) ? simuHorsRotation_(r) : false, par_agent: String(r.email).toLowerCase() === String(r.emetteur).toLowerCase() };
}
/** Demande qui attend la décision d'un supérieur : en attente (émise par un responsable) ou appliquée (émise par l'agent lui-même, déjà en vigueur). */
function simuAttend_(r) { return String(r.statut) === 'en_attente' || String(r.statut) === 'appliquee'; }
/** La demande ne ramène pas l'agent dans sa rotation habituelle (calculé sur le planning officiel validé). */
function simuHorsRotation_(r) {
  try {
    var rot = rotationDe_(r.email), m = { debut: jour_(r.debut), periodes: simuJson_(r.periodes, []), reprise: String(r.reprise) };
    if (!rot || !m.periodes.length) return false;
    return !simuTableaux_(rot, correctionsValideesDe_(r.email), m).retour.ok;
  } catch (e) { return false; }
}

function simuListe_(req) {
  var u = Auth.userFromToken(req.token);
  var niv = simuNiveau_(u), moi = String(u.email).toLowerCase();
  var l = Store.table('Modifications').filter(function (r) {
    var cible = Store.utilisateur(r.email) || {};
    return String(r.email).toLowerCase() === moi || (niv >= 2 && (String(r.emetteur).toLowerCase() === moi || simuDansPortee_(u, cible)));
  }).sort(function (a, b) { return String(a.cree_le) < String(b.cree_le) ? 1 : -1; }).slice(0, 200);
  return { demandes: l.map(function (r) { return simuResume_(r, u); }), niveau: niv };
}

function simuDemandeDe_(r) {
  var c = Store.utilisateur(r.email) || {}, emet = Store.utilisateur(r.emetteur) || {};
  var nom = Annuaire.nomAffichable(c.nom, r.email), p = nom.split(/\s+/);
  return { numero: String(r.numero), ville: VILLE_, date: String(r.cree_le).slice(0, 10), statut: String(r.statut),
           agent: { nom: p[0] || '', prenom: p.slice(1).join(' '), matricule: c.matricule || '', fonction: c.fonction || '', service: c.service || '', division: 'INFRA' },
           motif: String(r.motif || ''), actuel: simuJson_(r.actuel, []), modifie: simuJson_(r.modifie, []), emetteur: Annuaire.nomAffichable(emet.nom, r.emetteur),
           decide_par: r.decide_par ? Annuaire.nomAffichable((Store.utilisateur(r.decide_par) || {}).nom, r.decide_par) : '', decide_le: String(r.decide_le || ''), commentaire: String(r.commentaire || '') };
}

function simuDemande_(req) {
  var u = Auth.userFromToken(req.token);
  var r = simuLigne_(req.numero); if (!r) throw new Error('Demande introuvable');
  var cible = Store.utilisateur(r.email) || {};
  var ok = String(r.email).toLowerCase() === String(u.email).toLowerCase() || String(r.emetteur).toLowerCase() === String(u.email).toLowerCase() || (simuNiveau_(u) >= 2 && simuDansPortee_(u, cible));
  if (!ok) throw simuDroits_();
  return { demande: simuDemandeDe_(r) };
}

function simuDecider_(req) {
  var u = Auth.userFromToken(req.token);
  if (simuNiveau_(u) < 2) throw simuDroits_();
  var r = simuLigne_(req.numero); if (!r) throw new Error('Demande introuvable');
  var cible = Store.utilisateur(r.email) || {};
  if (!simuDansPortee_(u, cible)) throw simuDroits_();
  if (!simuAttend_(r)) throw new Error('Cette demande a déjà été traitée');
  if (String(r.email).toLowerCase() === String(u.email).toLowerCase()) throw new Error('Vous ne pouvez pas décider de votre propre demande');
  var decision = String(req.decision);
  if (decision !== 'approuvee' && decision !== 'refusee') throw new Error('Décision invalide');
  var com = String(req.commentaire || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  var rot = rotationDe_(r.email);
  if (decision === 'approuvee' && !rot) throw new Error('L\'agent n\'a plus de rotation renseignée');
  var vals = { statut: decision, decide_par: u.email, decide_le: new Date().toISOString(), commentaire: com };
  if (decision === 'approuvee' && req.modif && Array.isArray(req.modif.periodes) && req.modif.periodes.length) { // le responsable corrige les périodes avant de valider
    var m = simuModif_(req.modif), err = Simulation.valider(m, rot, Dates.today()); if (err) throw new Error(err);
    var t = simuTableaux_(rot, correctionsValideesDe_(r.email), m);
    vals.debut = m.debut; vals.periodes = JSON.stringify(m.periodes); vals.reprise = m.reprise; vals.actuel = JSON.stringify(t.actuel); vals.modifie = JSON.stringify(t.modifie); vals.reliquat = t.reliquat; vals.reliquat_net = t.reliquat_net;
    vals.commentaire = (com ? com + ' — ' : '') + 'Modifiée par ' + Annuaire.nomAffichable(u.nom, u.email);
  }
  Store.maj('Modifications', { numero: String(r.numero) }, vals);
  Store.journal(decision === 'approuvee' ? 'modification_approuvee' : 'modification_refusee', u.email, String(r.numero) + ' ' + r.email);
  var row = simuLigne_(r.numero);
  return { demande: simuResume_(row, u), emails: simuNotifier_(row, decision, u) };
}

// ---------- Demande de l'agent lui-même (« Modifier mon planning ») ----------
/** Dernière demande « appliquée » (en vigueur, en attente de décision) de l'agent. */
function modifEnCours_(email) {
  var l = Store.table('Modifications').filter(function (r) { return String(r.email).toLowerCase() === String(email).toLowerCase() && String(r.statut) === 'appliquee'; });
  l.sort(function (a, b) { return String(a.cree_le) < String(b.cree_le) ? 1 : -1; });
  return l[0] || null;
}
/** Planning d'un agent pour l'écran de modification : officiel validé, avec sa demande en cours, et rotation habituelle (référence du retour à la normale). */
function modifDonnees_(email, u) {
  var rot = rotationDe_(email); if (!rot) throw new Error('Renseignez d\'abord votre rotation');
  var auj = Dates.today(), F = Dates.addDays(auj, -60); if (F < rot.depuis) F = rot.depuis;
  var n = 420, en = modifEnCours_(email), der = Store.table('Modifications').filter(function (r) { return String(r.email).toLowerCase() === String(email).toLowerCase(); })
    .sort(function (a, b) { return String(a.cree_le) < String(b.cree_le) ? 1 : -1; })[0] || null;
  return { rotation: rot, aujourdhui: auj, debut: F, jours: n,
           grille_actuelle: Planning.grille(rot, correctionsValideesDe_(email), F, n), grille_demande: Planning.grille(rot, correctionsDe_(email), F, n), grille_normale: Planning.grille(rot, [], F, n),
           solde: soldeDe_(email).solde, en_cours: en ? simuResume_(en, u) : null, en_cours_modif: en ? { debut: jour_(en.debut), periodes: simuJson_(en.periodes, []), reprise: String(en.reprise) } : null,
           derniere: der ? simuResume_(der, u) : null };
}
function modifMoiDonnees_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).planning || 0) < 1) throw simuDroits_();
  return modifDonnees_(u.email, u);
}
/**
 * Pour un responsable : les mêmes données pour un autre agent, soit celui d'une demande qui attend sa décision (`numero`, il peut la corriger puis la valider),
 * soit un agent de sa portée (`email`, pour modifier directement son planning).
 */
function modifAgentDonnees_(req) {
  var u = Auth.userFromToken(req.token);
  if (simuNiveau_(u) < 2) throw simuDroits_();
  var r = null, email = String(req.email || '').toLowerCase();
  if (req.numero) {
    r = simuLigne_(req.numero); if (!r) throw new Error('Demande introuvable');
    if (!simuAttend_(r)) throw new Error('Cette demande a déjà été traitée');
    email = String(r.email).toLowerCase();
  }
  var c = Store.utilisateur(email); if (!c) throw new Error('Agent inconnu');
  if (!simuDansPortee_(u, c)) throw simuDroits_();
  var d = modifDonnees_(email, u);
  d.agent = Annuaire.nomAffichable(c.nom, email); d.uid = String(c.uid || '');
  if (r) { d.numero = String(r.numero); d.en_cours_modif = { debut: jour_(r.debut), periodes: simuJson_(r.periodes, []), reprise: String(r.reprise) }; }
  return d;
}
/**
 * « Enregistrer ma demande » : la modification est appliquée tout de suite (visible dans « Mon planning » et le planning global) et attend la décision d'un responsable.
 * Une nouvelle demande remplace la précédente non encore décidée. Les jours déjà passés ne changent jamais.
 */
function modifMoi_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).planning || 0) < 1) throw simuDroits_();
  var rot = rotationDe_(u.email); if (!rot) throw new Error('Renseignez d\'abord votre rotation');
  var auj = Dates.today(), m = simuModif_(req), err = Simulation.valider(m, rot, auj); if (err) throw new Error(err);
  var motif = String(req.motif || 'Demande de l\'agent').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (motif.length < 3) throw new Error('Indiquez le motif de la demande');
  var cy = Number(rot.jours_travail) + Number(rot.jours_repos);
  var F = Dates.addDays(m.debut, -(cy + 30)); if (F < rot.depuis) F = rot.depuis;
  var n = Simulation.diff(F, Dates.addDays(Simulation.dateReprise(m), 2 * cy)) + 1;
  var off = Planning.grille(rot, correctionsValideesDe_(u.email), F, n), mod = Simulation.appliquer(off, F, m, rot), vigueur = Planning.grille(rot, correctionsDe_(u.email), F, n);
  for (var i = 0; i < n; i += 1) { if (Dates.addDays(F, i) <= auj && mod.charAt(i) !== vigueur.charAt(i)) throw new Error('Les jours déjà passés ne peuvent pas être modifiés : commencez à la prochaine rotation'); }
  if (mod === off) throw new Error('Aucune modification par rapport à votre planning');
  var t = simuTableaux_(rot, correctionsValideesDe_(u.email), m);
  var lock = (typeof LockService !== 'undefined') ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(15000);
  var numero;
  try {
    numero = simuNumero_();
    var en = modifEnCours_(u.email);
    if (en) Store.maj('Modifications', { numero: String(en.numero) }, { statut: 'remplacee', decide_le: new Date().toISOString(), commentaire: 'Remplacée par ' + numero });
    Store.maj('Modifications', { numero: numero }, {
      cree_le: new Date().toISOString(), email: u.email, emetteur: u.email, motif: motif, debut: m.debut, periodes: JSON.stringify(m.periodes), reprise: m.reprise, partenaire: '',
      actuel: JSON.stringify(t.actuel), modifie: JSON.stringify(t.modifie), statut: 'appliquee', decide_par: '', decide_le: '', commentaire: '', reliquat: t.reliquat, reliquat_net: t.reliquat_net
    });
  } finally { if (lock) lock.releaseLock(); }
  Store.journal('modification_appliquee', u.email, numero + ' du ' + m.debut + (t.retour.ok ? '' : ' (hors rotation)'));
  var row = simuLigne_(numero);
  return { numero: numero, statut: 'appliquee', demande: simuDemandeDe_(row), retour: t.retour, hors_rotation: !t.retour.ok, reliquat: t.reliquat, reliquat_net: t.reliquat_net };
}
/** Annule la demande en cours de l'agent (retour au planning validé). */
function modifMoiAnnuler_(req) {
  var u = Auth.userFromToken(req.token);
  var en = modifEnCours_(u.email); if (!en) throw new Error('Aucune demande en cours');
  Store.maj('Modifications', { numero: String(en.numero) }, { statut: 'annulee', decide_le: new Date().toISOString(), commentaire: 'Annulée par l\'agent' });
  Store.journal('modification_annulee', u.email, String(en.numero));
  return { numero: String(en.numero) };
}

/** Alertes de la page d'accueil : demandes qui attendent la décision du chef de service (son service), du secrétariat ou du chef de division (tous). */
function modifAlertes_(req) {
  var u = Auth.userFromToken(req.token), niv = simuNiveau_(u);
  if (niv < 2) return { niveau: niv, alertes: [] };
  var l = [];
  try { l = Store.table('Modifications'); } catch (e) { l = []; }
  var alertes = l.filter(function (r) { return simuAttend_(r) && String(r.email).toLowerCase() !== String(u.email).toLowerCase() && simuDansPortee_(u, Store.utilisateur(r.email) || {}); })
    .sort(function (a, b) { return String(a.cree_le) < String(b.cree_le) ? 1 : -1; }).slice(0, 50)
    .map(function (r) { return simuResume_(r, u); });
  alertes.sort(function (a, b) { return (b.hors_rotation ? 1 : 0) - (a.hors_rotation ? 1 : 0); });
  return { niveau: niv, alertes: alertes };
}

/** Envoi par e-mail d'une demande (clic de l'agent ou du responsable) : cases secrétariat / chef de service / chef de division. */
function simuEnvoyer_(req) {
  var u = Auth.userFromToken(req.token);
  var r = simuLigne_(req.numero); if (!r) throw new Error('Demande introuvable');
  var cible = Store.utilisateur(r.email) || {}, moi = String(u.email).toLowerCase();
  var ok = String(r.email).toLowerCase() === moi || String(r.emetteur).toLowerCase() === moi || (simuNiveau_(u) >= 2 && simuDansPortee_(u, cible));
  if (!ok) throw simuDroits_();
  var cases = req.destinataires || {}, dest = {};
  Store.table('Utilisateurs').forEach(function (x) {
    if (String(x.actif) === '0' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x.email || ''))) return;
    var role = Droits.roleCanon(x.role);
    if ((cases.secretariat && role === 'secretariat') || (cases.chef_division && role === 'chef_division') ||
        (cases.chef_service && role === 'chef_service' && !!simuNorm_(x.service) && simuNorm_(x.service) === simuNorm_(cible.service))) dest[String(x.email).toLowerCase()] = true;
  });
  var liste = Object.keys(dest);
  if (!liste.length) throw new Error('Cochez au moins un destinataire (ou aucune adresse trouvée)');
  var d = simuDemandeDe_(r), site = PropertiesService.getScriptProperties().getProperty('SITE_URL') || 'https://rayanem-dev.github.io/DashBoard-Infra-v2/';
  Mail.envoyerDemande(liste, d, req.pour_information ? 'Demande de modification de planning (pour information)' : 'Demande de modification de planning (pour décision)', site + 'demande.html?n=' + encodeURIComponent(d.numero), Annuaire.nomAffichable(u.nom, u.email));
  Store.journal('modification_envoyee', u.email, String(r.numero) + ' → ' + liste.length + ' destinataire(s)');
  return { emails: liste.length };
}

// ---------- E-mails ----------
function simuDestinataires_(r) {
  var s = {};
  function ajouter(e) { e = String(e || '').trim().toLowerCase(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) s[e] = true; }
  ajouter(r.email); ajouter(r.emetteur);
  Store.table('Utilisateurs').forEach(function (x) {
    var role = Droits.roleCanon(x.role);
    if (String(x.actif) !== '0' && (role === 'chef_division' || role === 'secretariat')) ajouter(x.email);
  });
  return Object.keys(s);
}

function simuNotifier_(r, evenement, u) {
  try {
    var d = simuDemandeDe_(r), dest = simuDestinataires_(r), site = PropertiesService.getScriptProperties().getProperty('SITE_URL') || 'https://rayanem-dev.github.io/DashBoard-Infra-v2/';
    var titre = evenement === 'demandee' ? 'Nouvelle demande de modification de planning' : evenement === 'approuvee' ? 'Demande de modification de planning APPROUVÉE' : 'Demande de modification de planning REFUSÉE';
    Mail.envoyerDemande(dest, d, titre, site + 'demande.html?n=' + encodeURIComponent(d.numero), Annuaire.nomAffichable(u.nom, u.email));
    return dest.length;
  } catch (e) { Store.journal('modification_mail_echec', u.email, String(e.message || e)); return 0; }
}
