// Journal de connexion, diagnostic et mot de passe défini par l'administrateur (faux services Google, vm).
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

function monde(opts = {}) {
  const feuille = [['email', 'sel', 'empreinte', 'sel_code', 'empreinte_code', 'code_expire', 'doit_changer']];
  const journal = [], mails = [];
  const sheet = {
    getDataRange: () => ({ getValues: () => feuille.map(l => l.slice()) }), appendRow: l => feuille.push(l.slice()),
    getRange: (r, c, nr, nc) => ({ setValues: v => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { feuille[r - 1 + i] = feuille[r - 1 + i] || []; feuille[r - 1 + i][c - 1 + j] = v[i][j]; } } }),
  };
  const cache = new Map(), props = new Map([['PEPPER', 'p'], ['SECRETS_ID', 's'], ['DB_ID', 'd']]);
  const users = { 'a@x.dz': { email: 'a@x.dz', nom: 'AICHA Test', actif: 1, role: 'agent', uid: 'u1' }, 'b@sonatrach.dz': { email: 'b@sonatrach.dz', nom: 'BRAHIM Test', actif: 1, role: 'agent', uid: 'u2' } };
  const ctx = {
    console, Utilities: { DigestAlgorithm: { SHA_256: 's' }, computeDigest: (a, s) => crypto.createHash('sha256').update(String(s)).digest(), base64Encode: b => Buffer.from(b).toString('base64'), getUuid: () => crypto.randomUUID() },
    CacheService: { getScriptCache: () => ({ get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, String(v)), remove: k => cache.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k), getProperties: () => Object.fromEntries(props) }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    MailApp: { sendEmail: m => { if (opts.mailKo) throw new Error('Service invoked too many times for one day: email'); mails.push(m); }, getRemainingDailyQuota: () => 42 },
    Store: { utilisateur: e => users[String(e).toLowerCase()] || null, parUid: u => Object.values(users).find(x => x.uid === u) || null, journal: (a, e, d) => journal.push([a, e, d]), table: () => Object.values(users) },
  };
  vm.createContext(ctx);
  for (const f of ['Config.gs', 'Droits.gs', 'Annuaire.gs', 'Mail.gs', 'Auth.gs', 'Connexions.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/if \(typeof module[^\n]*\n/g, ''), ctx, { filename: f });
  return { ctx, feuille, journal, mails, cache, Auth: vm.runInContext('Auth', ctx), Connexions: vm.runInContext('Connexions', ctx) };
}
const echoue = (fn, motif) => { try { fn(); } catch (e) { assert.match(e.message, motif); return e; } assert.fail('devait échouer'); };
const actions = m => m.journal.map(j => j[0]);

test('journal : connexion refusée (mot de passe, inconnu), réussie, bloquée — sans jamais écrire le mot de passe', () => {
  const m = monde(); m.Auth.definirMdpAdmin('a@x.dz', 'secret1');
  echoue(() => m.Auth.login('a@x.dz', 'MauvaisMdp'), /incorrect/);
  echoue(() => m.Auth.login('inconnu@x.dz', 'x'), /incorrect/);
  m.Auth.login('a@x.dz', 'secret1');
  for (let i = 0; i < 5; i++) echoue(() => m.Auth.login('a@x.dz', 'faux'), /incorrect|Trop/);
  assert.deepStrictEqual([...new Set(actions(m))].sort(), ['connexion', 'connexion_bloque', 'connexion_echec']);
  assert.ok(!JSON.stringify(m.journal).includes('MauvaisMdp') && !JSON.stringify(m.journal).includes('secret1'));
  assert.match(m.journal.find(j => j[0] === 'connexion_echec')[2], /mot de passe incorrect/);
});
test('code par e-mail : envoi journalisé ; échec d\'envoi journalisé avec le quota et message clair pour l\'agent', () => {
  const ok = monde(); ok.Auth.demanderCode('a@x.dz');
  assert.ok(actions(ok).includes('code_envoye')); assert.match(ok.journal.find(j => j[0] === 'code_envoye')[2], /quota restant : 42/);
  const ko = monde({ mailKo: true });
  const e = echoue(() => ko.Auth.demanderCode('a@x.dz'), /n'a pas pu être envoyé/); assert.strictEqual(e.code, 'MAIL');
  assert.match(ko.journal.find(j => j[0] === 'code_echec')[2], /too many times/);
});
test('limite de 3 demandes de code par heure journalisée ; code refusé journalisé', () => {
  const m = monde(); for (let i = 0; i < 3; i++) m.Auth.demanderCode('a@x.dz');
  echoue(() => m.Auth.demanderCode('a@x.dz'), /Trop de demandes/); assert.ok(actions(m).includes('code_limite'));
  echoue(() => m.Auth.activer('a@x.dz', '000000', 'nouveau1'), /Code invalide/); assert.match(m.journal.find(j => j[0] === 'activation_echec')[2], /code incorrect/);
});
test('mot de passe défini par l\'administrateur : provisoire sans expiration, blocages levés, état lisible', () => {
  const m = monde(); m.Auth.definirMdpAdmin('a@x.dz', 'abc12345');
  for (let i = 0; i < 5; i++) echoue(() => m.Auth.login('a@x.dz', 'faux'), /incorrect|Trop/);
  assert.strictEqual(m.Auth.compteurs('a@x.dz').essais, 5);
  m.Auth.definirMdpAdmin('a@x.dz', 'nouveau99');
  assert.strictEqual(m.Auth.compteurs('a@x.dz').essais, 0);
  assert.ok(m.Auth.login('a@x.dz', 'nouveau99').token);
  assert.strictEqual(m.Auth.estParDefaut('a@x.dz'), true); assert.strictEqual(m.Auth.etatSecret('a@x.dz'), 'provisoire');
  assert.strictEqual(m.Auth.etatSecret('b@sonatrach.dz'), 'aucun');
  echoue(() => m.Auth.definirMdpAdmin('a@x.dz', 'ab'), /caractères minimum/); echoue(() => m.Auth.definirMdpAdmin('zz@x.dz', 'abcdefgh'), /inconnu/);
});
test('liste des événements : du plus récent au plus ancien, filtre, actions étrangères ignorées', () => {
  const m = monde(); const L = [['2026-10-01', 'connexion', 'a@x.dz', ''], ['2026-10-02', 'rapport_cree', 'a@x.dz', 'x'], ['2026-10-03', 'connexion_echec', 'b@x.dz', 'mot de passe incorrect'], ['2026-10-04', 'code_echec', 'a@x.dz', 'quota']];
  m.ctx.__l = L; const r = vm.runInContext("Connexions.evenements(__l, '', 50, { 'a@x.dz': 'AICHA' })", m.ctx);
  assert.deepStrictEqual([...r.map(x => x.action)], ['code_echec', 'connexion_echec', 'connexion']); assert.strictEqual(r[0].nom, 'AICHA');
  assert.deepStrictEqual([...vm.runInContext("Connexions.evenements(__l, 'b@x', 50, {})", m.ctx).map(x => x.action)], ['connexion_echec']);
});
test('conseils : adresse manquante ou invalide, blocage, quota, quarantaine @sonatrach.dz après un envoi réussi', () => {
  const m = monde(); const c = d => vm.runInContext('Connexions.conseils', m.ctx)(Object.assign({ actif: true, email: 'a@x.dz', etat: 'choisi', bloque: false, demandes_code: 0, quota_mail: 90 }, d)).join(' | ');
  assert.match(c({ email: '' }), /Aucune adresse e-mail/); assert.match(c({ email: 'pasunmail' }), /invalide/); assert.match(c({ bloque: true }), /BLOQUÉ/);
  assert.match(c({ quota_mail: 2 }), /Quota d'e-mails/); assert.match(c({ email: 'b@sonatrach.dz', dernier_code_envoye: '2026-10-15' }), /quarantaine/);
  assert.match(c({ etat: 'aucun' }), /première connexion/); assert.match(c({}), /Rien d'anormal/);
});
