// Parcours d'authentification complet, avec de faux services Google (feuille, cache, propriétés) : node --test
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

function monde() {
  const ctx = { console };
  const feuille = [['email', 'sel', 'empreinte', 'sel_code', 'empreinte_code', 'code_expire', 'doit_changer']];
  const sheet = {
    getDataRange: () => ({ getValues: () => feuille.map(l => l.slice()) }),
    appendRow: l => feuille.push(l.slice()),
    getRange: (r, c, nr, nc) => ({ setValues: v => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { feuille[r - 1 + i] = feuille[r - 1 + i] || []; feuille[r - 1 + i][c - 1 + j] = v[i][j]; } } }),
  };
  const cacheMap = new Map(), props = new Map([['PEPPER', 'poivre-test'], ['SECRETS_ID', 's'], ['DB_ID', 'd']]);
  Object.assign(ctx, {
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (a, s) => crypto.createHash('sha256').update(String(s)).digest(),
      base64Encode: b => Buffer.from(b).toString('base64'),
      getUuid: () => crypto.randomUUID(),
    },
    CacheService: { getScriptCache: () => ({ get: k => (cacheMap.has(k) ? cacheMap.get(k) : null), put: (k, v) => cacheMap.set(k, String(v)), remove: k => cacheMap.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k), getProperties: () => Object.fromEntries(props) }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    Mail: { envoyerCode() {}, masquer: e => e },
    Store: { utilisateur: e => ({ email: e, nom: 'Test', actif: 1, role: 'agent' })._ || (e === 'a@x.dz' ? { email: 'a@x.dz', nom: 'Aïcha', actif: 1, role: 'agent', service: 'S1' } : null), journal() {}, parUid: () => null, table: () => [] },
  });
  vm.createContext(ctx);
  for (const f of ['Config.gs', 'Droits.gs', 'Auth.gs']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/if \(typeof module[^\n]*\n/g, ''), ctx, { filename: f });
  return { ctx, feuille, cacheMap, props, Auth: vm.runInContext('Auth', ctx) };
}
const ouvrir = (m, email, mdp, delaiMs) => {
  const e = m.Auth.empreinteDe(mdp);
  const ligne = [email, e.sel, e.empreinte, '', '', '', delaiMs === undefined ? 0 : Date.now() + delaiMs];
  const i = m.feuille.findIndex(l => l[0] === email); i > 0 ? (m.feuille[i] = ligne) : m.feuille.push(ligne);
};
const echoue = (fn, motif, code) => { try { fn(); } catch (e) { assert.match(e.message, motif); if (code) assert.strictEqual(e.code, code); return; } assert.fail('devait échouer : ' + motif); };

test('connexion : bon mot de passe accepté, mauvais refusé, limite de 5 essais', () => {
  const m = monde(); ouvrir(m, 'a@x.dz', 'secret1');
  assert.ok(m.Auth.login('a@x.dz', 'secret1').token);
  for (let i = 0; i < 5; i++) echoue(() => m.Auth.login('a@x.dz', 'faux'), /incorrect/);
  echoue(() => m.Auth.login('a@x.dz', 'secret1'), /Trop de tentatives/, 'LIMITE'); // même le bon est bloqué pendant la fenêtre
});

test('mot de passe par défaut : valable jusqu\'à la date, puis refusé ; signalé tant qu\'il est actif', () => {
  const m = monde(); ouvrir(m, 'a@x.dz', '0000', 86400000);
  assert.strictEqual(m.Auth.estParDefaut('a@x.dz'), true);
  assert.ok(m.Auth.login('a@x.dz', '0000').token);
  ouvrir(m, 'a@x.dz', '0000', -1000); // expiré
  assert.strictEqual(m.Auth.estParDefaut('a@x.dz'), false);
  echoue(() => m.Auth.login('a@x.dz', '0000'), /expiré/, 'DEFAUT_EXPIRE');
});

test('mot de passe par défaut SANS expiration : valable tant que la personne ne le change pas', () => {
  const m = monde(); ouvrir(m, 'a@x.dz', '0000'); m.feuille.find(l => l[0] === 'a@x.dz')[6] = 2; // 2 = provisoire sans expiration
  assert.strictEqual(m.Auth.estParDefaut('a@x.dz'), true);
  assert.ok(m.Auth.login('a@x.dz', '0000').token);
  const RealNow = Date.now; Date.now = () => RealNow() + 400 * 86400000; // 400 jours plus tard
  try { assert.strictEqual(m.Auth.estParDefaut('a@x.dz'), true); assert.ok(m.Auth.login('a@x.dz', '0000').token); } finally { Date.now = RealNow; }
  const { token } = m.Auth.login('a@x.dz', '0000'); m.Auth.changerMdp(token, '0000', 'choisi1');
  assert.strictEqual(m.Auth.estParDefaut('a@x.dz'), false);
  echoue(() => m.Auth.login('a@x.dz', '0000'), /incorrect/);
});

test('changer le mot de passe : ancien exigé, 4 caractères, jamais « 0000 », puis l\'ancien ne marche plus', () => {
  const m = monde(); ouvrir(m, 'a@x.dz', '0000', 86400000);
  const { token } = m.Auth.login('a@x.dz', '0000');
  echoue(() => m.Auth.changerMdp(token, 'pas-le-bon', 'nouveau1'), /Ancien mot de passe/);
  echoue(() => m.Auth.changerMdp(token, '0000', 'abc'), /4 caractères/);
  echoue(() => m.Auth.changerMdp(token, '0000', '0000'), /autre mot de passe/);
  m.Auth.changerMdp(token, '0000', 'nouveau1');
  assert.strictEqual(m.Auth.estParDefaut('a@x.dz'), false);
  echoue(() => m.Auth.login('a@x.dz', '0000'), /incorrect/);
  assert.ok(m.Auth.login('a@x.dz', 'nouveau1').token);
  echoue(() => m.Auth.changerMdp('jeton-bidon', 'x', 'yyyy'), /Session expirée/, 'SESSION');
});

test('rester connecté : jeton à usage unique, renouvelé, expire, supprimé à la déconnexion', () => {
  const m = monde(); ouvrir(m, 'a@x.dz', 'secret1');
  const r = m.Auth.login('a@x.dz', 'secret1', true);
  assert.ok(r.remember && r.remember.length > 60);
  const r2 = m.Auth.reprendre(r.remember);
  assert.ok(r2.token && r2.remember && r2.remember !== r.remember);
  echoue(() => m.Auth.reprendre(r.remember), /Session expirée/, 'SESSION'); // l'ancien jeton est mort
  m.Auth.logout(r2.token, r2.remember);
  echoue(() => m.Auth.reprendre(r2.remember), /Session expirée/, 'SESSION');
  // expiration (31 jours plus tard)
  const r3 = m.Auth.login('a@x.dz', 'secret1', true);
  for (const [k, v] of m.props) if (k.startsWith('RM_')) m.props.set(k, JSON.stringify({ e: 'a@x.dz', x: Date.now() - 1 }));
  echoue(() => m.Auth.reprendre(r3.remember), /Session expirée/, 'SESSION');
});

test('aucun mot de passe en clair dans la feuille des identifiants', () => {
  const m = monde(); ouvrir(m, 'a@x.dz', 'MonSecret42');
  assert.ok(!JSON.stringify(m.feuille).includes('MonSecret42'));
  assert.ok(m.feuille[1][2].length > 20);
});
