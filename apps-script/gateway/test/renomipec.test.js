// Renommage : règle intégrée « PEC_<ENTREPRISE>_<date> » pour les prises en charge.
const test = require('node:test');
const assert = require('node:assert');
const P = require('../../../js/renomi-pec.js');

test('prise en charge produite par le portail : entreprise de la colonne Code, date « Rhourde Nouss, le : »', () => {
  const t = ['Division Production', 'Direction Régionale Rhourde Nouss', 'Rhourde Nouss, le : 22/10/2026', 'PRISE EN CHARGE', 'HEBERGEMENT', 'NOM ET PRENOM DATE D\'ARRIVEE DATE DE DEPART NBRE DE PERSONNES IMPUTATION ANALYTIQUE CODE OBSERVATIONS',
    '- DAHDOUH REBIAI', '- KOUHEL AKREM', '25/10/2026', '21/11/2026', '5', '4300045200', 'ETS MESSAI', '73.INFRA.25', 'Maint. hydrauliques infrastructures', 'BASE DE VIE CENTRALE'].join('\n');
  const r = P.reconnaitre(t);
  assert.strictEqual(r.nom, 'PEC_ETS MESSAI_2026-10-22');
});
test('lettre de l\'entreprise : Employeur et date « Le : »', () => {
  const t = ['ETS MAZOUZ SAID', 'Employeur:ETS MAZOUZ SAID', 'Activite:ENTREPRISE DE BATIMENT TOUS CORPS D\'ETAT', 'Objet:', 'prise en charge', 'LISTE NOMINATIVE', '1', 'SIDHOUM', '02/08/1985', 'A:SETIF Le:21/10/2026'].join('\n');
  assert.strictEqual(P.reconnaitre(t).nom, 'PEC_ETS MAZOUZ SAID_2026-10-21');
});
test('autres documents : non reconnus', () => {
  assert.strictEqual(P.reconnaitre('Facture N° 12 du 14/02/2026 SARL ACOSCO'), null);
  assert.strictEqual(P.reconnaitre('Attestation : prise en charge des frais médicaux'), null);
});
test('entreprise introuvable : PEC_date', () => {
  assert.strictEqual(P.reconnaitre('PRISE EN CHARGE\nLISTE NOMINATIVE\nLe : 05/11/2026').nom, 'PEC_2026-11-05');
});

test('texte réel de l\'OCR du scan Doc0079 (colonnes éclatées, en-têtes déformés, guillemet devant l\'entreprise)', () => {
  const ocr = ['Slho Low', '_——— A Monsieur', 'me Le Chef de Division MG', 'sonatrach Mes si EE PIRE Lee', 'Activité Exploration - Production', 'Division Production', 'Direction Régionale Rhourde Nouss Rhourde Nouss, le : 22/10/2026', 'Division Infrastructure',
    'PRISE EN CHARGE', 'HEBERGEMENT:O K', 'RESTAURATION: DH', 'DATE DATE DE NBRE DE IMPUTATION CODE OBSERVATIONS', '| NOMERPRENCR D\'ARRIVÉE DÉPART PERSONNES ANALYTIQUE', '- DAHDOUH REBIAI', '“ ETS MESSAI', '- KOUHEL AKREM BASE DE VIE',
    '- BOUKHANI MOHAMED 25/10/2026 | 24/11/2026 5 4300045200 T3.INFRA.25 CENTRALE', 'Maint. hydrauliques ANCIENNE BASE', '- LAARBI RACHID', 'infrastructures Remplacement', '- DOUAIM OMAR', 'LE CHEF DE DIVISON INFRASTRUCTURES LE CHEF DE DIVISION MG'].join('\n');
  assert.strictEqual(P.reconnaitre(ocr).nom, 'PEC_ETS MESSAI_2026-10-22');
});

test('entreprise mêlée à d\'autres colonnes ou absente : repli sur le n° de contrat du Suivi CPM', () => {
  const t = 'PRISE EN CHARGE\nIMPUTATION ANALYTIQUE\nRhourde Nouss, le : 22/10/2026\n- KOUHEL AKREM ETS MESSAI BASE DE VIE\n4300045200 T3.INFRA.25 CENTRALE';
  assert.strictEqual(P.reconnaitre(t).entreprise, 'ETS MESSAI');
  const sans = 'PRISE EN CHARGE\nIMPUTATION ANALYTIQUE\nLe : 22/10/2026\n4300045200 73.INFRA.25 CENTRALE';
  const r = P.reconnaitre(sans); assert.strictEqual(r.entreprise, ''); assert.strictEqual(r.contrat, '73-25');
  const cpm = [[], ['', '', '', '', '', '', '', '', '', '', '', '', 'ETS MESSAI ESSMAIL', '73.INFRA.25']];
  assert.strictEqual(P.entrepriseDuContrat(cpm, r.contrat), 'ETS MESSAI ESSMAIL');
  assert.strictEqual(P.nomAvec(r, 'ETS MESSAI ESSMAIL'), 'PEC_ETS MESSAI ESSMAIL_2026-10-22');
});
