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

test('journal : semaines du samedi au vendredi, phrases simples', () => {
  assert.strictEqual(Synthese.debutSemaine('2026-10-10'), '2026-10-10'); // samedi
  assert.strictEqual(Synthese.debutSemaine('2026-10-16'), '2026-10-10'); // vendredi
  assert.strictEqual(Synthese.debutSemaine('2026-10-17'), '2026-10-17'); // samedi suivant
  assert.strictEqual(Synthese.debutSemaine('2026-10-14'), '2026-10-10'); // mercredi
  const ev = [{ date: '2026-10-17', type: 'nouveau', dossier: 'N', apres: 'Non démarré' }, { date: '2026-10-16', type: 'modifie', champ: 'statut', dossier: 'A', avant: 'En cours', apres: 'Attribué' },
    { date: '2026-10-11', type: 'modifie', champ: 'montant', libelle: 'Montant', dossier: 'B', avant: '', apres: '10' }, { date: '2026-10-09', type: 'retire', dossier: 'R' }];
  const w = Synthese.semaines(ev);
  assert.deepStrictEqual(w.map(x => [x.debut, x.fin, x.evenements.length]), [['2026-10-17', '2026-10-23', 1], ['2026-10-10', '2026-10-16', 2], ['2026-10-03', '2026-10-09', 1]]);
  assert.strictEqual(Synthese.phrase(ev[0]), 'Nouveau dossier : N (Non démarré)');
  assert.strictEqual(Synthese.phrase(ev[1]), 'A : passe de « En cours » à « Attribué »');
  assert.strictEqual(Synthese.phrase(ev[2]), 'B — Montant : (vide) → 10');
  assert.strictEqual(Synthese.phrase(ev[3]), 'Dossier retiré du suivi : R');
});

test('rapport hebdomadaire : classement par type de dossier, texte O.B.S en gras, changements de la semaine seulement', () => {
  assert.strictEqual(Synthese.groupeRapport('Dossier Appel Offre DAO'), 'daocf');
  assert.strictEqual(Synthese.groupeRapport('Consultation Fournisseur CF'), 'daocf');
  assert.strictEqual(Synthese.groupeRapport("Gré à Gré Contrat d\\'application"), 'application');
  assert.strictEqual(Synthese.groupeRapport('Gré à Gré Convention Cadre'), 'cadre');
  assert.strictEqual(Synthese.groupeRapport('Bon De Commande'), 'autres');
  const ev = [ // du plus récent au plus ancien
    { date: '2026-10-16', cle: 'N:a', n_dossier: 'N°39/SH', dossier: 'Génie civil', type: 'modifie', champ: 'commentaire', libelle: 'Commentaire', avant: '', apres: 'Réserves levées le 16/09/2026', categorie: 'Dossier Appel Offre DAO' },
    { date: '2026-10-12', cle: 'N:a', n_dossier: 'N°39/SH', dossier: 'Génie civil', type: 'modifie', champ: 'statut', libelle: 'Statut', avant: 'Dossier en cours', apres: 'Attribué', categorie: 'Dossier Appel Offre DAO' },
    { date: '2026-10-11', cle: 'N:b', n_dossier: '', dossier: 'Réseau <eau>', type: 'nouveau', apres: 'Non démarré', categorie: 'Gré à Gré Convention Cadre' },
    { date: '2026-10-09', cle: 'N:c', n_dossier: 'X', dossier: 'Hors semaine', type: 'retire', categorie: 'Bon De Commande' }];
  const r = Synthese.rapportSemaine(ev, '2026-10-10');
  assert.deepStrictEqual([r.debut, r.fin], ['2026-10-10', '2026-10-16']);
  const daocf = r.groupes.find(g => g.cle === 'daocf');
  assert.strictEqual(daocf.dossiers.length, 1);
  assert.deepStrictEqual([...daocf.dossiers[0].lignes], ['Statut : Dossier en cours → Attribué', 'Réserves levées le 16/09/2026']);
  assert.strictEqual(Synthese.htmlObs(daocf.dossiers[0]), '<b>Statut : Dossier en cours → Attribué</b><br><b>Réserves levées le 16/09/2026</b>');
  assert.strictEqual(r.groupes.find(g => g.cle === 'cadre').dossiers.length, 1);
  assert.strictEqual(r.groupes.find(g => g.cle === 'autres').dossiers.length, 0); // le 09/10 est dans la semaine précédente
  assert.match(Synthese.htmlObs({ lignes: ['A <b>'] }), /A &lt;b&gt;/);
});
