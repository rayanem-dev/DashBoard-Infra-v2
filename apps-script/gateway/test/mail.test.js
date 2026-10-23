const test = require('node:test');
const assert = require('node:assert');
global.MailApp = { sent: [], sendEmail(m) { this.sent.push(m); } };
const Mail = require('../Mail.gs');

test("l'adresse est masquée", () => {
  assert.strictEqual(Mail.masquer('lamine.hadjadj@sonatrach.dz'), 'la***@sonatrach.dz');
  assert.strictEqual(Mail.masquer('a@x.dz'), 'a***@x.dz');
  assert.strictEqual(Mail.masquer('pas-un-mail'), '***');
});

test("le nom est échappé dans l'e-mail et le code y figure", () => {
  Mail.envoyerCode('a@x.dz', '<b>X</b>', '123456', 30);
  const m = MailApp.sent[0];
  assert.ok(m.htmlBody.includes('&lt;b&gt;X&lt;/b&gt;'));
  assert.ok(m.subject.includes('123456'));
  assert.strictEqual(m.to, 'a@x.dz');
});

test("invitation : lien, première connexion et applications accordées", () => {
  const menu = [{ id: 'badges', apps: [{ titre: 'Badges prestataires', description: 'Impression des badges' }, { titre: '<i>X</i>' }] }];
  const h = Mail.corpsInvitation('Aïcha <B>', menu, 'https://site/connexion.html', true);
  assert.ok(h.includes('https://site/connexion.html') && h.includes('0000'));
  assert.ok(h.includes('Badges prestataires') && h.includes('Impression des badges'));
  assert.ok(h.includes('&lt;i&gt;X') && h.includes('Aïcha &lt;B&gt;')); // tout est échappé
  const sans = Mail.corpsInvitation('Z', [], 'u', false);
  assert.ok(sans.includes('mot de passe oublié') && sans.includes('Aucune application'));
  Mail.envoyerInvitation('a@x.dz', 'Z', menu, 'u', false);
  assert.ok(MailApp.sent[MailApp.sent.length - 1].subject.includes('Invitation'));
});

test("demande approuvée : le document PDF est joint ; en attente : pas de pièce jointe", () => {
  const d = { numero: 'MOD-1', date: '2026-10-22', statut: 'approuvee', motif: 'Régul', emetteur: 'X', decide_par: 'Y', decide_le: '2026-10-23', agent: { nom: 'A<b>', prenom: 'B', fonction: 'F', service: 'S', division: 'INFRA' }, actuel: [{ type: 'T', du: '2026-10-01', au: '2026-10-28', jours: 28 }], modifie: [{ type: 'R', du: '2026-10-01', au: '2026-10-20', jours: 20 }] };
  const noms = [];
  global.Utilities = { newBlob: (h, t, n) => ({ getAs: ty => ({ setName: nm => { noms.push([ty, nm, h]); return { nom: nm }; } }) }) };
  Mail.envoyerDemande(['a@x.dz'], d, 'Titre', 'https://l', 'Moi');
  const m = MailApp.sent[MailApp.sent.length - 1];
  assert.strictEqual(m.attachments.length, 1); assert.deepStrictEqual(noms[0].slice(0, 2), ['application/pdf', 'Demande_MOD-1.pdf']);
  assert.ok(noms[0][2].includes('DEMANDE DE MODIFICATION DE PLANNING') && noms[0][2].includes('A&lt;b&gt;') && noms[0][2].includes('20'));
  Mail.envoyerDemande(['a@x.dz'], Object.assign({}, d, { statut: 'en_attente' }), 'Titre', 'https://l', 'Moi');
  assert.strictEqual(MailApp.sent[MailApp.sent.length - 1].attachments, undefined);
  global.Utilities = { newBlob() { throw new Error('conversion impossible'); } };
  Mail.envoyerDemande(['a@x.dz'], d, 'Titre', 'https://l', 'Moi');
  assert.strictEqual(MailApp.sent[MailApp.sent.length - 1].attachments, undefined, "l'e-mail part même si la conversion échoue");
  delete global.Utilities;
});
