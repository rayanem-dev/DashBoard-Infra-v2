// Calculs des synthèses de l'accueil (données fictives) : node --test
const test = require('node:test');
const assert = require('node:assert');
const Synthese = require('../../../js/synthese.js');

const ENT = ['N°', 'Objet', 'Service', 'Désignation', '', '', '', '', 'Statut', '', '', '', '', '', '', '', 'Date ODS', 'Durée (mois)', 'Échéance'];
const L = (des, statut, ods = '', duree = '', ech = '') => { const r = new Array(19).fill(''); r[3] = des; r[8] = statut; r[16] = ods; r[17] = duree; r[18] = ech; return r; };
const ROWS = [['Suivi CPM'], ENT,
  L('Contrat A', 'Contrat en exécution', '01/01/2026', '10', ''),   // échéance 01/11/2026 : 9/10 mois écoulés ≥ 60 %
  L('Contrat B', 'Contrat en exécution', '01/09/2026', '12', ''),   // début : pas proche
  L('Dossier C', 'Dossier en cours'), L('Dossier D', 'Attribué'), L('Dossier E', 'Bloqué'), L('Dossier F', 'Infructueux'),
  L('Dossier G', 'Contrat échu'), L('Dossier H', 'Terminé'), L('Dossier I', 'Non démarré'), L('Dossier J', 'Truc inconnu'), L('', '')];

test('CSV : guillemets, virgules et lignes vides', () => {
  assert.deepStrictEqual(Synthese.parseCSV('a,"b,c",d\n\n"x ""y""",,z\r\n'), [['a', 'b,c', 'd'], ['x "y"', '', 'z']]);
});
test('statuts : clés normalisées (accents, casse)', () => {
  for (const [s, k] of [['Attribué', 'attribue'], ['CONTRAT EN EXÉCUTION', 'execution'], ['Contrat échu', 'echu'], ['Terminé', 'echu'], ['Dossier en cours', 'encours'], ['Bloqué', 'bloque'], ['Infructueux', 'infructueux'], ['Non démarré', 'nondemarre'], ['?', 'autre']]) assert.strictEqual(Synthese.cleStatut(s), k, s);
});
test('synthèse CPM : total, comptes par statut, contrats arrivant à échéance', () => {
  const s = Synthese.cpm(ROWS, new Date(2026, 9, 14));
  assert.strictEqual(s.total, 10); // la ligne vide n'est pas comptée
  assert.deepStrictEqual(s.comptes, { attribue: 1, encours: 1, execution: 2, echu: 2, bloque: 1, infructueux: 1, nondemarre: 1, autre: 1 });
  assert.strictEqual(s.echeanceProche, 1);
});
test('synthèse chantiers : ≥ 70 % bien avancé, 20–70 % en cours, < 20 % démarrage', () => {
  assert.deepStrictEqual(Synthese.chantiers([{ pct: 100 }, { pct: 70 }, { pct: 69.9 }, { pct: 20 }, { pct: 19 }, { pct: 0 }]), { total: 6, bien: 2, encours: 2, demarrage: 2 });
  assert.deepStrictEqual(Synthese.chantiers([]), { total: 0, bien: 0, encours: 0, demarrage: 0 });
});
