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
