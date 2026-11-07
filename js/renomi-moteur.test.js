const test = require('node:test'); const assert = require('node:assert');
const R = require('./renomi-moteur.js');
const T = (ent) => `SONATRACH\nActivité Exploration Production\nN° 744 SH/E&P/RNS/INFRA/2026\nObjet : Invitation à l'ouverture des plis\nRéf : DAO N°26/SH-PROD/RNS/INFRA/2026\nA Monsieur le Directeur de l'Entreprise :\n${ent}\nE-mail : atefbezzalla@gmail.com\nRhourde-Nouss, le 07 Novembre 2026`;
const nom = (ent) => R.proposer({ nom: 'Doc.pdf', texte: T(ent) }, []).nom;
test('courrier : objet - entreprise, sans numéro', () => { assert.strictEqual(nom('ATEF BEZZALLA'), "Invitation à l'ouverture des plis - ATEF BEZZALLA.pdf"); });
test('courrier : parasite OCR « Lou » devant la forme juridique retiré', () => {
  assert.strictEqual(nom('Lou SARL GMS'), "Invitation à l'ouverture des plis - SARL GMS.pdf");
  assert.strictEqual(nom('Sl Lou EURL ABC'), "Invitation à l'ouverture des plis - EURL ABC.pdf");
  assert.strictEqual(nom('ETS MESSAI Ali'), "Invitation à l'ouverture des plis - ETS MESSAI Ali.pdf");
});
test('entreprise sur la même ligne ; autre document inchangé', () => {
  assert.strictEqual(R.proposer({ nom: 'x.pdf', texte: T('x').replace("Entreprise :\nx", 'Entreprise : SARL GMS') }, []).nom, "Invitation à l'ouverture des plis - SARL GMS.pdf");
  assert.strictEqual(R.courrier('Attestation de travail\nDate 14/02/2026'), null);
});
