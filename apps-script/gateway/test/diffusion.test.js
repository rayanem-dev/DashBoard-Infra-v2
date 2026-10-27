// node --test apps-script/gateway/test/diffusion.test.js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../Diffusion.gs');

test('boîte du service de l\'agent d\'après son service', () => {
  assert.strictEqual(D.boiteService('Service Construction').email, 'infra_constr.rns@sonatrach.dz');
  assert.strictEqual(D.boiteService('Service Electromécanique').email, 'infra_electromec.rns@sonatrach.dz');
  assert.strictEqual(D.boiteService('Travaux Entretien').email, 'service_travaux_entretien_infra.rns@sonatrach.dz');
  assert.strictEqual(D.boiteService('Cellule Passation de marché').email, 'rns.cpm_infra@sonatrach.dz');
  assert.strictEqual(D.boiteService('Division Infrastructures').email, 'cdd_infra.rns@sonatrach.dz');
  assert.strictEqual(D.boiteService('Inconnu'), null);
});
test('destinataires : secrétariat seul, service seul, les deux ; jamais sans choix ; jamais de boîte de service pour un prestataire', () => {
  const e = (o, s, p) => D.destinataires(o, s, p).map(x => x.email);
  assert.deepStrictEqual(e({ secretariat: true }, 'Service Construction'), ['sec-infra.rns@sonatrach.dz', 'sec.infra.rns@gmail.com', 'rayanem@gmail.com']);
  assert.deepStrictEqual(e({ service: true }, 'Service Construction'), ['infra_constr.rns@sonatrach.dz']);
  assert.strictEqual(e({ secretariat: true, service: true }, 'Service Construction').length, 4);
  assert.throws(() => e({}, 'Service Construction'), /Cochez/);
  assert.throws(() => e({ service: true }, 'Service inconnu'), /Aucune boîte/);
  assert.throws(() => e({ service: true }, 'Service Construction', false), /pas disponible/);
  assert.deepStrictEqual(e({ secretariat: true }, 'x', false).length, 3);
});
test('HTML envoyé par une page : scripts, cadres et gestionnaires d\'événements retirés', () => {
  const h = D.assainir('<div onclick="x()" class="a">Bonjour<script>alert(1)</script><iframe src="//x"></iframe><a href="javascript:void(0)">l</a></div>');
  assert.ok(!/script|iframe|onclick|javascript:/i.test(h) && h.includes('Bonjour') && h.includes('class="a"'));
  assert.strictEqual(D.sujetPropre('Objet\r\nBcc: x@y.z'), 'Objet Bcc: x@y.z');
});
