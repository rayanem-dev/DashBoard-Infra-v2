// Lecture d'une liste nominative scannée (demande de prise en charge) : tableau, lignes, cellules une par ligne.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'LecturePEC.gs'), 'utf8'), ctx);
const E = (code, ...a) => { ctx.__a = a; return JSON.parse(JSON.stringify(vm.runInContext(code + '(...__a)', ctx))); };

const ATTENDU = [
  { nom: 'Sidhoum', prenom: 'Baderddine', fonction: 'Macon' },
  { nom: 'Khalfaoui', prenom: 'Abdelhak', fonction: 'Macon' },
  { nom: 'Aoucheria', prenom: 'Djamel Eddine', fonction: 'Chauffeur de poids lourd' },
  { nom: 'Messali', prenom: 'Anis', fonction: 'Plombier' },
  { nom: 'Bouchoufa', prenom: 'Ayme', fonction: 'Ourier' }];

test('tableau OCR : en-têtes NOM / PRENOM / FONCTION, colonnes parasites ignorées, faute d\'OCR tolérée', () => {
  const t = [['MAT', 'NOM', 'PRENOM', 'DATE NAIS', 'FONCTION', 'N° NTN'],
    ['1', 'SIDHOUM', 'BADERDDINE', '02/08/1985', 'MACON', '109850676010160007'], ['2', 'KHALFAOUI', 'ABDELHAK', '08/10/1979', 'MACON', '1097'],
    ['3', 'AOUCHERIA', 'DJAMEL EDDINE', '06/10/1991', 'Chauffeur de poids lourd', '1099'], ['4', 'MESSALI', 'ANIS', '25/10/2005', 'PLOMBIER', '1000'], ['5', 'BOUCHOUFA', 'AYME', '01/04/2005', 'OURIER', '1000']];
  assert.deepStrictEqual(E('pecLireTableau_', t), ATTENDU);
  t[0][2] = 'PRENQM'; t[0][1] = 'N0M';
  assert.strictEqual(E('pecLireTableau_', t).length, 5);
});
test('texte : une ligne par personne, la date de naissance sépare les noms de la fonction', () => {
  const txt = 'Objet: prise en charge\nLISTE NOMINATIVE\nMAT NOM PRENOM DATE NAIS FONCTION N° NTN\n1 SIDHOUM BADERDDINE 02/08/1985 MACON 109850676010160007\n2 KHALFAOUI ABDELHAK 08/10/1979 MACON 109790703006700001\n3 AOUCHERIA DJAMEL EDDINE 06/10/1991 Chauffeur de poids lourd 10991067601620003\n4 MESSALI ANIS 25/10/2005 PLOMBIER 100050073005440009\n5 BOUCHOUFA AYME 01/04/2005 OURIER 100050070301480009\nA :SETIF Le:21/10/2026';
  assert.deepStrictEqual(E('pecLireTexte_', txt), ATTENDU);
  assert.strictEqual(E('pecLireDate_', txt), '21/10/2026');
});
test('texte : une cellule par ligne (tableau mal reconstruit)', () => {
  const l = ['MAT', 'NOM', 'PRENOM', 'DATE NAIS', 'FONCTION', '1', 'SIDHOUM', 'BADERDDINE', '02/08/1985', 'MACON', '109850676010160007', '2', 'MESSALI', 'ANIS', '25/10/2005', 'PLOMBIER', '100050073005440009'];
  assert.deepStrictEqual(E('pecLireTexte_', l.join('\n')), [ATTENDU[0], ATTENDU[3]]);
});
test('simples lignes « Nom Prénom » toujours lues ; date « à compter du » prioritaire', () => {
  assert.deepStrictEqual(E('pecLireTexte_', '1. KACI Farid\n- BEN Meftah').map(p => p.nom), ['Kaci', 'Ben']);
  assert.strictEqual(E('pecLireDate_', 'à compter du 05/11/2026 ... Le : 21/10/2026'), '05/11/2026');
});
