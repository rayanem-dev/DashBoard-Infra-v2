// node --test apps-script/gateway/test/statsst.test.js
const test = require('node:test');
const assert = require('node:assert');
const S = require('../StatsSousTraitants.gs');

const E = ['date', 'prestataire', 'base', 'documents', 'nom', 'prenom', 'fonction', 'vehicule', 'immatriculation', 'enquetes', 'arrivee', 'depart'];
const ligne = (date, presta, nom, prenom, a, d) => [date, presta, 'B', 'PEC', nom, prenom, '', '', '', '', a, d];

test('dates lues sous plusieurs formes, bornes du mois', () => {
  assert.strictEqual(S.dateIso('2026-04-27 08:15'), '2026-04-27'); assert.strictEqual(S.dateIso('27/04/2026'), '2026-04-27'); assert.strictEqual(S.dateIso('n/a'), '');
  assert.deepStrictEqual(S.bornes('2026-02'), { debut: '2026-02-01', fin: '2026-02-28' }); assert.strictEqual(S.bornes('2026-13'), null);
});
test('compter : personnes distinctes dont le séjour touche le mois, par prestataire', () => {
  const v = [E,
    ligne('2026-04-02 08:00', '53.INFRA.25 - ACOSCO - Maintenance', 'A', 'a', '2026-04-03', '2026-05-01'),
    ligne('2026-04-05 08:00', '53.INFRA.25 - ACOSCO - Maintenance', 'A', 'a', '2026-04-05', '2026-05-03'),      // même personne : une seule fois
    ligne('2026-04-05 08:00', '53.INFRA.25 - ACOSCO - Maintenance', 'B', 'b', '2026-03-10', '2026-04-07'),      // arrivée avant, présente début avril
    ligne('2026-04-05 08:00', '53.INFRA.25 - ACOSCO - Maintenance', 'C', 'c', '2026-03-01', '2026-03-29'),      // partie en mars : exclue
    ligne('2026-04-20 08:00', '30.INFRA.24 - GLOBI CORP - Électricité', 'D', 'd', '', ''),                         // sans dates : arrivée = date de la demande, 28 jours
    ligne('2026-02-01 08:00', '30.INFRA.24 - GLOBI CORP - Électricité', 'E', 'e', '', '')];                       // demande de février sans dates : terminée
  const r = S.compter(v, '2026-04', 360);
  assert.deepStrictEqual(r.map(x => [x.prestataire, x.effectif, x.heures]), [['ACOSCO', 2, 720], ['GLOBI CORP', 1, 360]]);
  assert.strictEqual(S.compter(v, '2026-04', 0)[0].heures, 720);   // heures par agent invalides : 360 par défaut
  assert.deepStrictEqual(S.compter([E], '2026-04'), []);
});
test('compter : plusieurs contrats d\'une même entreprise → intitulé entre parenthèses', () => {
  const v = [E, ligne('2026-04-02', '1.X - ETB ZAATOUT - dessablage manuel', 'A', 'a', '2026-04-03', '2026-04-30'), ligne('2026-04-02', '2.X - ETB ZAATOUT - terrassement', 'B', 'b', '2026-04-03', '2026-04-30')];
  assert.deepStrictEqual(S.compter(v, '2026-04').map(x => x.prestataire), ['ETB ZAATOUT (dessablage manuel)', 'ETB ZAATOUT (terrassement)']);
});
test('fusionner : ajoute, met à jour les lignes automatiques, respecte les lignes modifiées, supprimées et manuelles', () => {
  const calcul = [{ cle: 'a', prestataire: 'A', effectif: 5, heures: 1800 }, { cle: 'b', prestataire: 'B', effectif: 3, heures: 1080 }, { cle: 'c', prestataire: 'C', effectif: 2, heures: 720 },
    { cle: 'd', prestataire: 'D', effectif: 9, heures: 3240 }, { cle: 'e', prestataire: 'E', effectif: 1, heures: 360 }];
  const exist = [{ cle: 'a', origine: 'auto', modifie: 0, supprime: 0, effectif: 4, heures: 1440 }, { cle: 'b', origine: 'auto', modifie: 1, supprime: 0, effectif: 7, heures: 2520 },
    { cle: 'c', origine: 'auto', modifie: 0, supprime: 1, effectif: 2, heures: 720 }, { cle: 'd', origine: 'manuel', modifie: 1, supprime: 0, effectif: 1, heures: 1 }];
  const p = S.fusionner(exist, calcul);
  assert.deepStrictEqual(p.ajouter.map(x => x.cle), ['e']);
  assert.deepStrictEqual(p.maj.map(x => [x.ligne.cle, x.effectif, x.heures]), [['a', 5, 1800]]);
});
