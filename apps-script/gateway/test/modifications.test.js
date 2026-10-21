// Demandes de modification de planning : droits, portée, e-mails, approbation → planning officiel (faux services Google, vm).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const AUJ = '2026-10-13';
function monde() {
  const tables = {
    Utilisateurs: [
      { uid: 'u1', email: 'chef.div@x.dz', nom: 'HADJ CHEF', role: 'chef_division', service: 'Division', actif: 1 },
      { uid: 'u2', email: 'chef.s1@x.dz', nom: 'DURAND SERGE', role: 'chef_service', service: 'S1', actif: 1 },
      { uid: 'u3', email: 'agent.a@x.dz', nom: 'MARTIN ALAIN', role: 'agent', service: 'S1', actif: 1, matricule: 'M-1', fonction: 'Technicien' },
      { uid: 'u4', email: 'agent.b@x.dz', nom: 'BERNARD JEAN CLAUDE', role: 'agent', service: 'S2', actif: 1 },
      { uid: 'u5', email: 'secretaire@x.dz', nom: 'MADANI SARA', role: 'secretariat', service: 'Secretariat', actif: 1 },
      { uid: 'u6', email: 'chef.s2@x.dz', nom: 'LEROY PAUL', role: 'chef_service', service: 'S2', actif: 1 },
    ],
    Rotations: [
      { email: 'agent.a@x.dz', statut: 'T', depuis: '2026-09-01', jours_travail: 28, jours_repos: 28 },
      { email: 'agent.b@x.dz', statut: 'R', depuis: '2026-09-15', jours_travail: 28, jours_repos: 28 },
    ],
    Modifications: [],
  };
  const niveaux = { 'chef.div@x.dz': 3, 'secretaire@x.dz': 3, 'chef.s1@x.dz': 2, 'chef.s2@x.dz': 2 };
  const mails = [], journal = [];
  const ctx = {
    console,
    Utilities: { formatDate: () => AUJ }, Session: { getScriptTimeZone: () => 'UTC' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    MailApp: { sendEmail: m => mails.push(m) },
    Store: {
      table: n => tables[n].map(r => Object.assign({}, r)),
      utilisateur: e => tables.Utilisateurs.find(u => u.email === String(e).toLowerCase()) || null,
      parUid: uid => tables.Utilisateurs.find(u => u.uid === uid) || null,
      journal: (a, e, d) => journal.push([a, e, d]),
      maj: (n, cles, vals) => { const k = Object.keys(cles)[0]; const l = tables[n]; const r = l.find(x => String(x[k]) === String(cles[k])); if (r) Object.assign(r, vals); else l.push(Object.assign({}, cles, vals)); },
    },
    Auth: { userFromToken: t => { const u = tables.Utilisateurs.find(x => x.email === t); if (!u) throw new Error('Session expirée'); return u; } },
  };
  vm.createContext(ctx);
  const lire = f => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '');
  for (const f of ['Config.gs', 'Droits.gs', 'Annuaire.gs', 'Dates.gs', 'Cycle.gs', 'Planning.gs', '../../js/simulation.js', 'Mail.gs', 'Modifications.gs', 'Main.gs']) vm.runInContext(lire('../' + f), ctx, { filename: f });
  vm.runInContext('acces_ = function (u) { return { simulation: __niv[u.email] || 0, planning: (__niv[u.email] || 0) >= 3 ? 3 : 1 }; };', Object.assign(ctx, { __niv: niveaux }));
  return { ctx, tables, mails, journal, run: code => vm.runInContext(code, ctx) };
}
const appel = (m, fn, tok, req) => { m.ctx.__req = Object.assign({ token: tok }, req); return m.run(fn + '(__req)'); };
const MODIF = { uid: 'u3', debut: '2026-10-20', periodes: [{ type: 'R', jours: 10 }, { type: 'T', jours: 5 }], reprise: 'R', motif: 'Raison service', partenaire: 'u4' };

test('droits : un agent ne simule pas ; un chef de service ne voit que son service ; chef de division : tous', () => {
  const m = monde();
  assert.throws(() => appel(m, 'simuAgents_', 'agent.a@x.dz', {}), /Droits/);
  assert.deepStrictEqual(appel(m, 'simuAgents_', 'chef.s1@x.dz', {}).agents.map(a => a.uid).sort(), ['u2', 'u3']);
  assert.strictEqual(appel(m, 'simuAgents_', 'chef.div@x.dz', {}).agents.length, 6);
  assert.throws(() => appel(m, 'simuDonnees_', 'chef.s1@x.dz', { uid: 'u4' }), /Droits/); // agent d'un autre service
  const d = appel(m, 'simuDonnees_', 'chef.s1@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 60 });
  assert.strictEqual(d.grille.length, 60); assert.strictEqual(d.grille.charAt(0), 'T'); assert.strictEqual(d.rotation.jours_travail, 28);
  const e = appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u4', debut: '2026-09-01', jours: 60 });
  assert.strictEqual(e.debut, d.debut, 'même fenêtre pour tous les agents'); assert.strictEqual(e.grille.slice(0, 14), '.'.repeat(14), 'avant le début de sa rotation : « . »');
});

test('valider : demande numérotée en attente, e-mail unique aux 4 destinataires, contrôles', () => {
  const m = monde();
  assert.throws(() => appel(m, 'simuValider_', 'agent.a@x.dz', MODIF), /Droits/);
  assert.throws(() => appel(m, 'simuValider_', 'chef.s1@x.dz', Object.assign({}, MODIF, { uid: 'u4' })), /Droits/);
  assert.throws(() => appel(m, 'simuValider_', 'chef.s1@x.dz', Object.assign({}, MODIF, { periodes: [] })), /au moins une période/);
  assert.throws(() => appel(m, 'simuValider_', 'chef.s1@x.dz', Object.assign({}, MODIF, { motif: 'x' })), /motif/);
  const r = appel(m, 'simuValider_', 'chef.s1@x.dz', MODIF);
  assert.strictEqual(r.numero, 'MOD-' + new Date().getFullYear() + '-0001'); assert.strictEqual(r.demande.statut, 'en_attente');
  assert.strictEqual(r.demande.agent.nom, 'MARTIN'); assert.strictEqual(r.demande.agent.prenom, 'ALAIN'); assert.strictEqual(r.demande.agent.matricule, 'M-1');
  assert.ok(r.demande.actuel.length >= 3 && r.demande.modifie.length >= 3);
  assert.strictEqual(m.mails.length, 1);
  assert.deepStrictEqual(m.mails[0].to.split(',').sort(), ['agent.a@x.dz', 'chef.div@x.dz', 'chef.s1@x.dz', 'secretaire@x.dz']);
  assert.match(m.mails[0].subject, /MOD-.*MARTIN/);
  assert.match(appel(m, 'simuValider_', 'chef.div@x.dz', MODIF).numero, /-0002$/);
});

test('approbation : seule la portée décide ; le planning officiel change ; une décision est définitive', () => {
  const m = monde();
  const avant = appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 200 }).grille;
  const { numero } = appel(m, 'simuValider_', 'chef.s1@x.dz', MODIF);
  assert.strictEqual(appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 200 }).grille, avant, 'rien ne change avant décision');
  assert.throws(() => appel(m, 'simuDecider_', 'chef.s2@x.dz', { numero, decision: 'approuvee' }), /Droits/); // autre service
  assert.throws(() => appel(m, 'simuDecider_', 'agent.a@x.dz', { numero, decision: 'approuvee' }), /Droits/);
  assert.throws(() => appel(m, 'simuDecider_', 'chef.s1@x.dz', { numero, decision: 'peut-etre' }), /invalide/);
  const mailsAvant = m.mails.length;
  const d = appel(m, 'simuDecider_', 'chef.s1@x.dz', { numero, decision: 'approuvee', commentaire: 'OK' });
  assert.strictEqual(d.demande.statut, 'approuvee'); assert.strictEqual(m.mails.length, mailsAvant + 1);
  const apres = appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 200 }).grille;
  assert.notStrictEqual(apres, avant);
  const attendu = m.ctx.Simulation.appliquer(avant, '2026-09-01', { debut: MODIF.debut, periodes: MODIF.periodes, reprise: MODIF.reprise }, { jours_travail: 28, jours_repos: 28 });
  assert.strictEqual(apres, attendu, 'le planning officiel = la simulation validée');
  assert.throws(() => appel(m, 'simuDecider_', 'chef.s1@x.dz', { numero, decision: 'refusee' }), /déjà été traitée/);
  // planning global et situation du jour utilisent aussi la modification
  const pl = appel(m, 'planning_', 'chef.div@x.dz', { debut: '2026-09-01', jours: 200 }).lignes.find(l => l.nom === 'MARTIN ALAIN');
  assert.strictEqual(pl.grille, apres);
});

test('refus : archivé, planning inchangé ; liste et document : visibles par l\'agent, l\'émetteur et la portée seulement', () => {
  const m = monde();
  const avant = appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 200 }).grille;
  const { numero } = appel(m, 'simuValider_', 'chef.s1@x.dz', MODIF);
  appel(m, 'simuDecider_', 'chef.div@x.dz', { numero, decision: 'refusee', commentaire: 'Non' });
  assert.strictEqual(appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 200 }).grille, avant);
  assert.strictEqual(appel(m, 'simuListe_', 'agent.a@x.dz', {}).demandes.length, 1);   // l'intéressé voit la sienne
  assert.strictEqual(appel(m, 'simuListe_', 'agent.b@x.dz', {}).demandes.length, 0);
  assert.strictEqual(appel(m, 'simuListe_', 'chef.s2@x.dz', {}).demandes.length, 0);   // autre service
  assert.strictEqual(appel(m, 'simuListe_', 'chef.s1@x.dz', {}).demandes[0].statut, 'refusee');
  assert.strictEqual(appel(m, 'simuDemande_', 'agent.a@x.dz', { numero }).demande.statut, 'refusee');
  assert.throws(() => appel(m, 'simuDemande_', 'agent.b@x.dz', { numero }), /Droits/);
  assert.throws(() => appel(m, 'simuDemande_', 'chef.s1@x.dz', { numero: 'MOD-0000-0000' }), /introuvable/);
});

test('lot de deux agents : tout est contrôlé avant d\'enregistrer ; deux demandes liées ; un seul refus bloque tout', () => {
  const m = monde();
  const B = { uid: 'u4', debut: '2026-10-20', periodes: [{ type: 'T', jours: 7 }], reprise: 'R' };
  const A = { uid: 'u3', debut: '2026-10-20', periodes: [{ type: 'R', jours: 7 }], reprise: 'T' };
  // le chef de service S1 n'a pas le droit sur u4 (S2) : rien n'est enregistré, même pour u3
  assert.throws(() => appel(m, 'simuValider_', 'chef.s1@x.dz', { lot: [A, B], motif: 'Raison service' }), /Droits/);
  assert.strictEqual(m.tables.Modifications.length, 0);
  // un lot dont le 2e est invalide n'enregistre pas le 1er
  assert.throws(() => appel(m, 'simuValider_', 'chef.div@x.dz', { lot: [A, Object.assign({}, B, { periodes: [] })], motif: 'Raison service' }), /au moins une période/);
  assert.strictEqual(m.tables.Modifications.length, 0);
  assert.throws(() => appel(m, 'simuValider_', 'chef.div@x.dz', { lot: [A, A], motif: 'Raison service' }), /deux fois/);
  const r = appel(m, 'simuValider_', 'chef.div@x.dz', { lot: [A, B], motif: 'Raison service' });
  assert.strictEqual(r.numeros.length, 2); assert.strictEqual(m.tables.Modifications.length, 2);
  assert.deepStrictEqual(m.tables.Modifications.map(x => x.partenaire), ['u4', 'u3']);
  assert.strictEqual(m.mails.length, 2);
});

test('reliquat initial : saisie validée, présent dans la situation ; solde = initial + reliquat net des demandes approuvées', () => {
  const m = monde();
  const sit0 = m.run("situationDe_(Store.utilisateur('agent.a@x.dz'))");
  assert.strictEqual(sit0.reliquat_renseigne, false); assert.strictEqual(sit0.reliquat, null);
  assert.throws(() => appel(m, 'reliquatEnregistrer_', 'agent.a@x.dz', { reliquat: 'abc' }), /nombre entier/);
  assert.throws(() => appel(m, 'reliquatEnregistrer_', 'agent.a@x.dz', { reliquat: 1.5 }), /nombre entier/);
  assert.throws(() => appel(m, 'reliquatEnregistrer_', 'agent.a@x.dz', { reliquat: 999 }), /365/);
  assert.throws(() => appel(m, 'reliquatEnregistrer_', 'agent.a@x.dz', { reliquat: '' }), /nombre entier/);
  const sit = appel(m, 'reliquatEnregistrer_', 'agent.a@x.dz', { reliquat: -4 });
  assert.strictEqual(sit.reliquat, -4); assert.strictEqual(sit.reliquat_renseigne, true);
  assert.strictEqual(appel(m, 'reliquatEnregistrer_', 'agent.a@x.dz', { reliquat: 0 }).reliquat_renseigne, true, '0 est une réponse valable');
  appel(m, 'reliquatEnregistrer_', 'agent.a@x.dz', { reliquat: 12 });
  // la rotation peut être resaisie sans écraser le reliquat
  appel(m, 'rotationEnregistrer_', 'agent.a@x.dz', { statut: 'T', depuis: '2026-09-01', jours_travail: 28, jours_repos: 28 });
  assert.strictEqual(m.run("situationDe_(Store.utilisateur('agent.a@x.dz'))").reliquat, 12);
  const d0 = appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 200 });
  assert.strictEqual(d0.reliquat_initial, 12); assert.strictEqual(d0.solde, 12);
  const { numero } = appel(m, 'simuValider_', 'chef.s1@x.dz', MODIF);
  const row = m.tables.Modifications.find(x => x.numero === numero);
  assert.ok(row.reliquat !== undefined && row.reliquat_net !== undefined, 'le reliquat de la demande est enregistré');
  assert.strictEqual(appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 200 }).solde, 12, 'pas modifié tant que la demande n\'est pas approuvée');
  appel(m, 'simuDecider_', 'chef.s1@x.dz', { numero, decision: 'approuvee' });
  assert.strictEqual(appel(m, 'simuDonnees_', 'chef.div@x.dz', { uid: 'u3', debut: '2026-09-01', jours: 200 }).solde, 12 + Number(row.reliquat_net));
});

// ---------- « Modifier mon planning » : demande de l'agent, appliquée tout de suite, décision d'un responsable ----------
const ALIGNE = { debut: '2026-10-27', periodes: [{ type: 'T', jours: 14 }, { type: 'R', jours: 42 }], reprise: 'T', motif: 'Raison perso' };
const DECALE = { debut: '2026-10-27', periodes: [{ type: 'T', jours: 14 }, { type: 'R', jours: 35 }], reprise: 'T', motif: 'Raison perso' };
const gA = m => appel(m, 'planning_', 'chef.div@x.dz', { debut: '2026-09-01', jours: 200 }).lignes.find(l => l.nom === 'MARTIN ALAIN').grille;

test('demande de l\'agent : appliquée tout de suite, sans e-mail, retour à la rotation contrôlé', () => {
  const m = monde(), avant = gA(m);
  const d0 = appel(m, 'modifMoiDonnees_', 'agent.a@x.dz', {});
  assert.strictEqual(d0.en_cours, null); assert.strictEqual(d0.grille_actuelle, d0.grille_demande);
  const r = appel(m, 'modifMoi_', 'agent.a@x.dz', ALIGNE);
  assert.strictEqual(r.statut, 'appliquee'); assert.strictEqual(r.hors_rotation, false); assert.strictEqual(r.retour.ok, true);
  assert.strictEqual(m.mails.length, 0, 'aucun e-mail à l\'enregistrement');
  assert.notStrictEqual(gA(m), avant, 'visible tout de suite dans le planning global');
  assert.strictEqual(appel(m, 'planning_', 'agent.a@x.dz', { debut: '2026-09-01', jours: 200 }).lignes[0].grille, gA(m), 'et dans son propre planning');
  const d1 = appel(m, 'modifMoiDonnees_', 'agent.a@x.dz', {});
  assert.strictEqual(d1.en_cours.numero, r.numero); assert.strictEqual(d1.grille_actuelle.slice(0, 200), avant, 'le planning validé ne change pas'); assert.notStrictEqual(d1.grille_demande.slice(0, 200), avant);
  const h = appel(m, 'modifMoi_', 'agent.a@x.dz', DECALE);
  assert.strictEqual(h.hors_rotation, true); assert.strictEqual(m.tables.Modifications.find(x => x.numero === r.numero).statut, 'remplacee', 'une nouvelle demande remplace la précédente');
});

test('demande de l\'agent : jours passés intouchables, sans changement refusé, droits', () => {
  const m = monde();
  assert.throws(() => appel(m, 'modifMoi_', 'agent.a@x.dz', Object.assign({}, ALIGNE, { debut: '2026-10-05', periodes: [{ type: 'T', jours: 20 }], reprise: 'R' })), /déjà passés/);
  assert.throws(() => appel(m, 'modifMoi_', 'agent.a@x.dz', Object.assign({}, ALIGNE, { periodes: [{ type: 'T', jours: 28 }], reprise: 'R' })), /Aucune modification/);
  assert.throws(() => appel(m, 'modifMoi_', 'agent.a@x.dz', Object.assign({}, ALIGNE, { motif: 'x' })), /motif/);
  assert.strictEqual(m.tables.Modifications.length, 0);
});

test('décision : refus = retour au planning initial ; acceptation = validé, reliquat mis à jour, e-mail automatique au secrétariat', () => {
  const m = monde(), avant = gA(m);
  const { numero } = appel(m, 'modifMoi_', 'agent.a@x.dz', DECALE);
  assert.throws(() => appel(m, 'simuDecider_', 'agent.a@x.dz', { numero, decision: 'approuvee' }), /Droits/);
  assert.throws(() => appel(m, 'simuDecider_', 'chef.s2@x.dz', { numero, decision: 'approuvee' }), /Droits/);
  appel(m, 'simuDecider_', 'chef.s1@x.dz', { numero, decision: 'refusee', commentaire: 'Non' });
  assert.strictEqual(gA(m), avant, 'refus : retour au planning initial');
  const n2 = appel(m, 'modifMoi_', 'agent.a@x.dz', DECALE).numero;
  const soldeAvant = appel(m, 'modifMoiDonnees_', 'agent.a@x.dz', {}).solde, mails = m.mails.length;
  const grille = gA(m);
  appel(m, 'simuDecider_', 'secretaire@x.dz', { numero: n2, decision: 'approuvee' });
  assert.strictEqual(gA(m), grille, 'validée : le planning reste appliqué');
  assert.ok(m.mails.length > mails && m.mails[m.mails.length - 1].to.split(',').includes('secretaire@x.dz'), 'envoyé automatiquement au secrétariat');
  const d = appel(m, 'modifMoiDonnees_', 'agent.a@x.dz', {});
  assert.strictEqual(d.en_cours, null); assert.notStrictEqual(d.solde, soldeAvant, 'le reliquat est modifié à la validation');
});

test('alertes de l\'accueil : chef de service (son service), secrétariat et chef de division ; message en plus hors rotation ; on ne décide pas de sa propre demande', () => {
  const m = monde(); m.tables.Rotations.push({ email: 'chef.s1@x.dz', statut: 'T', depuis: '2026-09-01', jours_travail: 28, jours_repos: 28 });
  const ok = appel(m, 'modifMoi_', 'agent.a@x.dz', ALIGNE), hors = appel(m, 'modifMoi_', 'chef.s1@x.dz', DECALE);
  const al = t => appel(m, 'modifAlertes_', t, {}).alertes;
  assert.deepStrictEqual(al('chef.s1@x.dz').map(a => a.numero), [ok.numero], 'pas sa propre demande');
  assert.strictEqual(al('chef.s2@x.dz').length, 0); assert.strictEqual(al('agent.a@x.dz').length, 0);
  assert.strictEqual(al('chef.div@x.dz').length, 2); assert.strictEqual(al('secretaire@x.dz').length, 2);
  assert.strictEqual(al('chef.div@x.dz')[0].numero, hors.numero); assert.strictEqual(al('chef.div@x.dz')[0].hors_rotation, true); assert.strictEqual(al('chef.div@x.dz')[1].hors_rotation, false);
  assert.throws(() => appel(m, 'simuDecider_', 'chef.s1@x.dz', { numero: hors.numero, decision: 'approuvee' }), /propre demande/);
  appel(m, 'simuDecider_', 'chef.div@x.dz', { numero: hors.numero, decision: 'approuvee' });
  assert.strictEqual(al('chef.div@x.dz').length, 1, 'une fois décidée, l\'alerte disparaît');
});

test('envoi par e-mail : cases à cocher, seulement au clic, réservé à l\'agent et à sa portée', () => {
  const m = monde(), { numero } = appel(m, 'modifMoi_', 'agent.a@x.dz', ALIGNE);
  assert.throws(() => appel(m, 'simuEnvoyer_', 'agent.a@x.dz', { numero, destinataires: {} }), /Cochez/);
  assert.throws(() => appel(m, 'simuEnvoyer_', 'agent.b@x.dz', { numero, destinataires: { secretariat: true } }), /Droits/);
  appel(m, 'simuEnvoyer_', 'agent.a@x.dz', { numero, destinataires: { secretariat: true, chef_service: true } });
  assert.deepStrictEqual(m.mails[0].to.split(',').sort(), ['chef.s1@x.dz', 'secretaire@x.dz']);
});

test('le responsable corrige la demande de l\'agent avant de la valider', () => {
  const m = monde(), { numero } = appel(m, 'modifMoi_', 'agent.a@x.dz', DECALE);
  assert.throws(() => appel(m, 'modifAgentDonnees_', 'agent.a@x.dz', { numero }), /Droits/);
  assert.throws(() => appel(m, 'modifAgentDonnees_', 'chef.s2@x.dz', { numero }), /Droits/);
  const d = appel(m, 'modifAgentDonnees_', 'chef.s1@x.dz', { numero });
  assert.strictEqual(d.agent, 'MARTIN ALAIN'); assert.strictEqual(d.en_cours_modif.periodes[1].jours, 35);
  const r = appel(m, 'simuDecider_', 'chef.s1@x.dz', { numero, decision: 'approuvee', modif: ALIGNE });
  assert.strictEqual(r.demande.statut, 'approuvee'); assert.strictEqual(r.demande.hors_rotation, false);
  const ligne = m.tables.Modifications.find(x => x.numero === numero);
  assert.strictEqual(JSON.parse(ligne.periodes)[1].jours, 42); assert.match(ligne.commentaire, /Modifiée par/);
});
