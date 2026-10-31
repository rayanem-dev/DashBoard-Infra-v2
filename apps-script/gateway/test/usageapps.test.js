// node --test apps-script/gateway/test/usageapps.test.js
const test = require('node:test');
const assert = require('node:assert');
const U = require('../UsageApps.gs');

test('compteurs d\'une personne : seulement les siens, lignes en double additionnées', () => {
  const l = [{ uid: 'u1', titre: 'Rapports', n: 5 }, { uid: 'u2', titre: 'Rapports', n: 9 }, { uid: 'u1', titre: 'Badges', n: 2 }, { uid: 'u1', titre: 'Rapports', n: 1 }];
  assert.deepStrictEqual(U.deUid(l, 'u1'), { Rapports: 6, Badges: 2 }); assert.deepStrictEqual(U.deUid(l, 'u3'), {});
});
test('une ouverture compte 1 ; au-delà du plafond tout est divisé par 2 (les habitudes récentes l\'emportent)', () => {
  assert.deepStrictEqual(U.incrementer({ A: 1 }, ' A '), { A: 2 }); assert.deepStrictEqual(U.incrementer({}, 'B'), { B: 1 }); assert.deepStrictEqual(U.incrementer({ A: 3 }, ''), { A: 3 });
  const gros = U.incrementer({ A: 200, B: 100, C: 1 }, 'A');                                         // total 302 > 300
  assert.deepStrictEqual(gros, { A: 100, B: 50 });                                                    // C tombe à 0 : retiré
});
test('historique venu du navigateur : le plus grand des deux compteurs, jamais d\'addition, valeurs bornées', () => {
  assert.deepStrictEqual(U.fusionner({ A: 5, B: 1 }, { A: 3, B: 4, C: 2, D: -3, E: 'x', F: 99999 }), { A: 5, B: 4, C: 2, F: 1000 });
  assert.deepStrictEqual(U.fusionner({ A: 5 }, null), { A: 5 });
});
test('applications populaires d\'un rôle : somme des compteurs des personnes de ce rôle, les plus ouvertes d\'abord', () => {
  const l = [{ uid: 'a', titre: 'Rapports', n: 10 }, { uid: 'b', titre: 'Rapports', n: 5 }, { uid: 'b', titre: 'Badges', n: 20 }, { uid: 'c', titre: 'Autre rôle', n: 99 }];
  assert.deepStrictEqual(Object.keys(U.populaires(l, ['a', 'b'], 40)), ['Badges', 'Rapports']); assert.strictEqual(U.populaires(l, ['a', 'b'], 1).Badges, 20); assert.deepStrictEqual(U.populaires(l, [], 5), {});
});
