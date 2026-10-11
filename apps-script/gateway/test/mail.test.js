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
