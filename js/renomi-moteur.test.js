const test = require('node:test'); const assert = require('node:assert');
const R = require('./renomi-moteur.js');
const T = `SONATRACH\nActivité Exploration Production\nN° 744 SH/E&P/RNS/INFRA/2026\nObjet : Invitation à l'ouverture des plis\nRéf : DAO N°26/SH-PROD/RNS/INFRA/2026\nA Monsieur le Directeur de l'Entreprise :\nATEF BEZZALLA\nE-mail : atefbezzalla@gmail.com\nRhourde-Nouss, le 07 Novembre 2026`;
test('courrier : numéro - objet - entreprise', () => {
  assert.strictEqual(R.proposer({ nom: 'Doc0061.pdf', texte: T }, []).nom, "744 - Invitation à l'ouverture des plis - ATEF BEZZALLA.pdf");
});
test('courrier : numéro manuscrit non lu → omis ; entreprise sur la même ligne', () => {
  const t = T.replace('N° 744 SH', 'N° SH').replace("Entreprise :\nATEF BEZZALLA", 'Entreprise : ATEF BEZZALLA');
  assert.strictEqual(R.proposer({ nom: 'x.pdf', texte: t }, []).nom, "Invitation à l'ouverture des plis - ATEF BEZZALLA.pdf");
});
test('autre document : comportement inchangé', () => {
  assert.strictEqual(R.courrier('Attestation de travail\nDate 14/02/2026'), null);
});
