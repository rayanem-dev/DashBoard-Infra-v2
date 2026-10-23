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
test('texte : l\'identité de la 1re ligne séparée de sa date, l\'en-tête n\'est jamais prise pour une personne', () => {
  const txt = 'MAT NOM PRENOM\n1 SIDHOUM BADERDDINE\nFONCTION N° NTN 02/08/1985 MACON 109850676010160007\n2 KHALFAOUI ABDELHAK 08/10/1979 MACON 1097';
  const r = E('pecLireTexte_', txt);
  assert.deepStrictEqual(r.map(p => p.nom), ['Sidhoum', 'Khalfaoui']);
  assert.strictEqual(r[0].fonction, 'Macon');
  assert.deepStrictEqual(E('pecLireTexte_', 'FONCTION N° NTN 02/08/1985 MACON').length, 0);
});
test('texte lu colonne par colonne : les colonnes sont recollées', () => {
  const l = ['MAT', '1', '2', '3', '4', '5', 'NOM', 'SIDHOUM', 'KHALFAOUI', 'AOUCHERIA', 'MESSALI', 'BOUCHOUFA', 'PRENOM', 'BADERDDINE', 'ABDELHAK', 'DJAMEL EDDINE', 'ANIS', 'AYME',
    'DATE NAIS', '02/08/1985', '08/10/1979', '06/10/1991', '25/10/2005', '01/04/2005', 'FONCTION', 'MACON', 'MACON', 'Chauffeur de poids lourd', 'PLOMBIER', 'OURIER', 'N° NTN', '109850676010160007', '1097'];
  assert.deepStrictEqual(E('pecLireTexte_', l.join('\n')), ATTENDU);
});
test('texte : une cellule par ligne (tableau mal reconstruit)', () => {
  const l = ['MAT', 'NOM', 'PRENOM', 'DATE NAIS', 'FONCTION', '1', 'SIDHOUM', 'BADERDDINE', '02/08/1985', 'MACON', '109850676010160007', '2', 'MESSALI', 'ANIS', '25/10/2005', 'PLOMBIER', '100050073005440009'];
  assert.deepStrictEqual(E('pecLireTexte_', l.join('\n')), [ATTENDU[0], ATTENDU[3]]);
});
test('simples lignes « Nom Prénom » toujours lues ; date « à compter du » prioritaire', () => {
  assert.deepStrictEqual(E('pecLireTexte_', '1. KACI Farid\n- BEN Meftah').map(p => p.nom), ['Kaci', 'Ben']);
  assert.strictEqual(E('pecLireDate_', 'à compter du 05/11/2026 ... Le : 21/10/2026'), '05/11/2026');
});

test('service du projet (Suivi CPM) → émputation', () => {
  const EMP = ['Service Électromécanique', 'Service Construction', 'Service Travaux Entretien'];
  assert.strictEqual(E('pecServiceVersEmputation_', 'Service Construction', EMP), 'Service Construction');
  assert.strictEqual(E('pecServiceVersEmputation_', 'service electromecanique', EMP), 'Service Électromécanique');
  assert.strictEqual(E('pecServiceVersEmputation_', 'Travaux Entretien', EMP), 'Service Travaux Entretien');
  assert.strictEqual(E('pecServiceVersEmputation_', '', EMP), '');
  assert.strictEqual(E('pecServiceVersEmputation_', 'Autre', EMP), '');
});

test('OCR réel du scan MAZOUZ SAID : une cellule par ligne, en-têtes mêlés à la 1re ligne', () => {
  const txt = ['ETS MAZOUZ SAID', 'Employeur:ETS MAZOUZ SAID', 'Objet:', 'prise en charge', 'LISTE NOMINATIVE', 'MAT', 'NOM', '1', 'SIDHOUM', 'PRENOM', 'BADERDDINE', 'DATE NATS', 'FONCTION', 'No NTN', '02/08/1985', 'MACON', '2', 'KHALFAOUI', 'ABDELHAK', '08/10/1979', 'MACON', '109850676010160007', '109790703006700001', '3', 'AOUCHERIA', 'DJAMEL EDDINE', '06/10/1991', 'Chauffeur de poids lourd', '109910676016200003', '4', 'MESSALI', 'ANIS', '25/10/2005', 'PLOMBIER', '100050703005440009', '5', 'BOUCHOUFA', 'AYME', '01/04/2005', 'OURIER', '100050070301480009', 'A:SETIF Le:21/10/2026'].join('\n');
  assert.deepStrictEqual(E('pecLireTexte_', txt), ATTENDU);
  assert.strictEqual(E('pecLireDate_', txt), '21/10/2026');
});

test('clé d\'entreprise pour la base par défaut', () => {
  assert.strictEqual(E('pecCleEntreprise_', 'I/43/RNS/INFRA/2025 - ENCC SPA UNITE HAMIZ - Travaux'), 'encc spa unite hamiz');
  assert.strictEqual(E('pecCleEntreprise_', 'I/44 - Étb Zatout - X'), E('pecCleEntreprise_', 'I/54 - ETB ZATOUT - Y'));
});

test('courriel d\'entreprise (PDF avec texte) : « 1- NOM PRENOM en qualité Fonction », contrat et date prévue', () => {
  const txt = ['Demande de prise en charge – Mission à Rhourde Nouss Contrat N°', 'I/80/RNS/INFRA/2026', 'Bonjour,', 'départ en mission de Hassi Messaoud vers la Direction Régionale de Rhourde Nouss, prévu le 22/10/2026, de :',
    '1- CHENNA ILYAS en qualité Manoeuvre', '2- CHENNA MOUSSA en qualité Manoeuvre', '4- HAMADA MOHAMED DHIYA en qualité Manoeuvre', '8- ACHOUR MAMMAR en qualité Manoeuvre, en vue de la reprise de fonction', 'Avec leur propre moyen.'].join('\n');
  const r = E('pecLireTexte_', txt);
  assert.deepStrictEqual(r.map(p => p.nom + '|' + p.prenom + '|' + p.fonction), ['Chenna|Ilyas|Manoeuvre', 'Chenna|Moussa|Manoeuvre', 'Hamada|Mohamed Dhiya|Manoeuvre', 'Achour|Mammar|Manoeuvre']);
  assert.strictEqual(E('pecLireDate_', txt), '22/10/2026');
  assert.strictEqual(E('pecLireContrat_', txt), 'I/80/RNS/INFRA/2026');
  assert.strictEqual(E('pecCleContrat_', 'I/80/RNS/INFRA/2026'), E('pecCleContrat_', '80.INFRA.26'));
});

test('organisme hors Suivi CPM : option « ORGANISME - nom - détail », sans contrat dans le Suivi CPM', () => {
  assert.strictEqual(E('pecOptionOrganisme_', 'SONATRACH | Division Laboratoires', 'Direction Laboratoires & Carothèque centrale'), 'ORGANISME - SONATRACH | Division Laboratoires - Direction Laboratoires & Carothèque centrale');
  assert.strictEqual(E('pecOptionOrganisme_', '  Division  A - B ', ''), 'ORGANISME - Division A – B');   // « - » seul = séparateur de la liste : remplacé
  assert.strictEqual(E('pecOptionOrganisme_', '', 'x'), '');
  assert.strictEqual(E('pecSansContrat_', 'ORGANISME - SONATRACH | Division Laboratoires'), true);
  assert.strictEqual(E('pecSansContrat_', 'Visite sur site - (D12) - x'), true);
  assert.strictEqual(E('pecSansContrat_', '12/2026 - ENTREPRISE X - Travaux'), false);
});
