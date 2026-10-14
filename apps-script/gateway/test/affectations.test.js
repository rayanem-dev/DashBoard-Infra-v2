// Affectation du personnel : droits, portée, écriture BDDORGA d'abord, historique, e-mail (faux services Google, vm).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function monde(options = {}) {
  const tables = {
    Utilisateurs: [
      { uid: 'u1', email: 'chef.div@x.dz', nom: 'HADJ CHEF', role: 'chef_division', service: 'Division', actif: 1 },
      { uid: 'u2', email: 'chef.s1@x.dz', nom: 'DURAND SERGE', role: 'chef_service', service: 'S1', actif: 1 },
      { uid: 'u3', email: 'agent.a@x.dz', nom: 'MARTIN ALAIN', role: 'agent', service: 'S1', actif: 1 },
      { uid: 'u4', email: 'agent.b@x.dz', nom: 'BERNARD JEAN', role: 'agent', service: 'S2', actif: 1 },
      { uid: 'u5', email: 'secretaire@x.dz', nom: 'MADANI SARA', role: 'secretariat', service: 'Secretariat', actif: 1 },
    ],
    Affectations: [],
  };
  const niveaux = { 'chef.div@x.dz': 3, 'secretaire@x.dz': 3, 'chef.s1@x.dz': 2 };
  const mails = [], journal = [], bddorga = [];
  const ctx = {
    console, MailApp: { sendEmail: m => mails.push(m) },
    Store: {
      table: n => tables[n].map(r => Object.assign({}, r)),
      utilisateur: e => tables.Utilisateurs.find(u => u.email === String(e).toLowerCase()) || null,
      parUid: uid => tables.Utilisateurs.find(u => u.uid === uid) || null,
      journal: (a, e, d) => journal.push([a, e, d]),
      maj: (n, cles, vals) => { const k = Object.keys(cles)[0]; const l = tables[n]; const r = l.find(x => String(x[k]) === String(cles[k])); if (r) Object.assign(r, vals); else l.push(Object.assign({}, cles, vals)); },
    },
    Auth: { userFromToken: t => { const u = tables.Utilisateurs.find(x => x.email === t); if (!u) throw new Error('Session expirée'); return u; } },
    ecrireServiceBddorga_: (email, service) => { if (options.bddorgaKo) throw new Error('fichier protégé'); bddorga.push([email, service]); },
  };
  vm.createContext(ctx);
  const lire = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/if \(typeof module[^\n]*\n/g, '');
  for (const f of ['Config.gs', 'Droits.gs', 'Annuaire.gs', 'Mail.gs', 'Affectations.gs']) vm.runInContext(lire(f), ctx, { filename: f });
  ctx.acces_ = u => ({ affectation: niveaux[u.email] || 0 });
  return { ctx, tables, mails, journal, bddorga, run: c => vm.runInContext(c, ctx) };
}
const appel = (m, fn, tok, req) => { m.ctx.__req = Object.assign({ token: tok }, req); return m.run(fn + '(__req)'); };

test('droits et portée : niveau 3 = tout le monde ; niveau 2 = son service ; agent = rien', () => {
  const m = monde();
  assert.throws(() => appel(m, 'affPersonnes_', 'agent.a@x.dz', {}), /Droits/);
  assert.deepStrictEqual([...appel(m, 'affPersonnes_', 'chef.s1@x.dz', {}).personnes.map(p => p.uid)], ['u2', 'u3']);
  const t = appel(m, 'affPersonnes_', 'chef.div@x.dz', {});
  assert.strictEqual(t.personnes.length, 5); assert.deepStrictEqual([...t.services], ['Division', 'S1', 'S2', 'Secretariat']);
});

test('changer : BDDORGA puis passerelle, historique, e-mail aux 4 personnes concernées', () => {
  const m = monde();
  const r = appel(m, 'affChanger_', 'chef.div@x.dz', { uid: 'u3', service: ' s2 ', motif: 'Réorganisation' });
  assert.strictEqual(r.nouveau, 'S2', 'l\'orthographe du service existant est reprise'); assert.strictEqual(r.ancien, 'S1');
  assert.deepStrictEqual(m.bddorga, [['agent.a@x.dz', 'S2']]);
  assert.strictEqual(m.tables.Utilisateurs.find(u => u.uid === 'u3').service, 'S2');
  assert.strictEqual(m.tables.Affectations.length, 1); assert.strictEqual(m.tables.Affectations[0].ancien, 'S1');
  assert.deepStrictEqual(m.mails[0].to.split(',').sort(), ['agent.a@x.dz', 'chef.div@x.dz', 'secretaire@x.dz']);
  assert.match(m.mails[0].subject, /MARTIN ALAIN : S1 → S2/);
  assert.match(r.id, /-0001$/);
});

test('contrôles : même service, service inconnu sans confirmation, hors portée, soi-même, service invalide', () => {
  const m = monde();
  assert.throws(() => appel(m, 'affChanger_', 'chef.div@x.dz', { uid: 'u3', service: 's1' }), /déjà dans ce service/);
  assert.throws(() => appel(m, 'affChanger_', 'chef.div@x.dz', { uid: 'u3', service: 'Nouveau Service' }), /confirmez/);
  assert.strictEqual(appel(m, 'affChanger_', 'chef.div@x.dz', { uid: 'u3', service: 'Nouveau Service', creer: true }).nouveau, 'Nouveau Service');
  assert.throws(() => appel(m, 'affChanger_', 'chef.s1@x.dz', { uid: 'u4', service: 'S1' }), /Droits/);          // personne d'un autre service
  assert.throws(() => appel(m, 'affChanger_', 'chef.s1@x.dz', { uid: 'u2', service: 'S2' }), /propre affectation/);
  assert.throws(() => appel(m, 'affChanger_', 'chef.div@x.dz', { uid: 'u4', service: '=CMD()', creer: true }), /invalide/);
  assert.throws(() => appel(m, 'affChanger_', 'agent.a@x.dz', { uid: 'u4', service: 'S1' }), /Droits/);
});

test('échec d\'écriture dans BDDORGA : rien n\'est modifié (sinon la synchro remettrait l\'ancien service)', () => {
  const m = monde({ bddorgaKo: true });
  assert.throws(() => appel(m, 'affChanger_', 'chef.div@x.dz', { uid: 'u3', service: 'S2' }), /BDDORGA impossible.*rien n'a été modifié/);
  assert.strictEqual(m.tables.Utilisateurs.find(u => u.uid === 'u3').service, 'S1');
  assert.strictEqual(m.tables.Affectations.length, 0); assert.strictEqual(m.mails.length, 0);
  assert.ok(m.journal.some(j => j[0] === 'affectation_echec'));
});

test('historique : visible selon la portée', () => {
  const m = monde();
  appel(m, 'affChanger_', 'chef.div@x.dz', { uid: 'u3', service: 'S2' });
  assert.strictEqual(appel(m, 'affHistorique_', 'chef.div@x.dz', {}).historique.length, 1);
  assert.strictEqual(appel(m, 'affHistorique_', 'chef.s1@x.dz', {}).historique.length, 1); // S1 est l'ancien service
  assert.throws(() => appel(m, 'affHistorique_', 'agent.b@x.dz', {}), /Droits/);
});
