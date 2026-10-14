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

/** Corrections (pointages T/R) des demandes APPROUVÉES de chaque agent : { email: [{ date, statut }] }, appliquées dans l'ordre de décision. */
function correctionsParEmail_() {
  var out = {}, l = [];
  try { l = Store.table('Modifications'); } catch (e) { l = []; }
  l.filter(function (r) { return String(r.statut) === 'approuvee'; })
    .sort(function (a, b) { return String(a.decide_le) < String(b.decide_le) ? -1 : 1; })
    .forEach(function (r) {
      var m = { debut: jour_(r.debut), periodes: simuJson_(r.periodes, []), reprise: String(r.reprise) };
      if (!Simulation.estDate(m.debut) || !m.periodes.length) return;
      var k = String(r.email).toLowerCase();
      out[k] = (out[k] || []).concat(Simulation.corrections(m));
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
  var rq = Simulation.reliquatDetail(off, mod, F, m);
  return { actuel: Simulation.tableau(off, F, du, fin).slice(0, 14), modifie: Simulation.tableau(mod, F, du, fin).slice(0, 14), reprise: rep, reliquat: rq.pic, reliquat_net: rq.net };
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
           peut_decider: String(r.statut) === 'en_attente' && simuNiveau_(u) >= 2 && simuDansPortee_(u, cible) };
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
  if (String(r.statut) !== 'en_attente') throw new Error('Cette demande a déjà été traitée');
  var decision = String(req.decision);
  if (decision !== 'approuvee' && decision !== 'refusee') throw new Error('Décision invalide');
  var com = String(req.commentaire || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (decision === 'approuvee' && !rotationDe_(r.email)) throw new Error('L\'agent n\'a plus de rotation renseignée');
  Store.maj('Modifications', { numero: String(r.numero) }, { statut: decision, decide_par: u.email, decide_le: new Date().toISOString(), commentaire: com });
  Store.journal(decision === 'approuvee' ? 'modification_approuvee' : 'modification_refusee', u.email, String(r.numero) + ' ' + r.email);
  var row = simuLigne_(r.numero);
  return { demande: simuResume_(row, u), emails: simuNotifier_(row, decision, u) };
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
