// Prises en charge ↔ Enquêtes : recherche pendant la saisie, détection des doublons, choix de l'onglet, ligne libre.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const racine = path.join(__dirname, '..', '..', '..');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(racine, 'badges', 'badges.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Enquetes.gs'), 'utf8'), ctx);
const E = (code, ...a) => { ctx.__a = a; return JSON.parse(JSON.stringify(vm.runInContext(code + '(...__a)', ctx))); };

const INDEX = [
  { nom: 'KACI', prenom: 'Farid', fonction: 'Chauffeur', entreprise: 'ENAGEO', onglet: 'ENAGEO' },
  { nom: 'BEN ALIA', prenom: 'Meftah', fonction: 'maçon', entreprise: 'ETBE ZAATOUT TAYEB', onglet: 'Z.TAYEB' },
  { nom: 'MHENNI', prenom: 'Belal', fonction: '', entreprise: 'ETS MHENNI', onglet: 'MHENNI' },
  { nom: 'KACIMI', prenom: 'Said', fonction: '', entreprise: 'X', onglet: 'X' }];

test('recherche pendant la saisie : début de mots, ordre libre, 3 lettres minimum', () => {
  assert.deepStrictEqual(E('enqChercher_', INDEX, 'ka').length, 0);
  assert.deepStrictEqual(E('enqChercher_', INDEX, 'kac').map(p => p.nom), ['KACI', 'KACIMI']);          // le plus court d'abord
  assert.deepStrictEqual(E('enqChercher_', INDEX, 'farid kaci').map(p => p.nom), ['KACI']);
  assert.deepStrictEqual(E('enqChercher_', INDEX, 'ben al me').map(p => p.prenom), ['Meftah']);
});
test('même personne : ordre des mots indifférent, petite faute tolérée, personnes différentes non confondues', () => {
  assert.ok(E('enqMemePersonne_', 'KACI Farid', 'Farid KACI'));
  assert.ok(E('enqMemePersonne_', 'MEHENNI Belal', 'MHENNI Belal'));
  assert.ok(!E('enqMemePersonne_', 'KACI Farid', 'KACI Fares'));
  assert.ok(!E('enqMemePersonne_', 'KACI Farid', 'KACI'));
  assert.strictEqual(E('enqTrouver_', INDEX, 'BEN ALIA', 'MEFTAH').nom, 'BEN ALIA');
  assert.strictEqual(E('enqTrouver_', INDEX, 'DUPONT', 'Paul'), null);
});
test('onglet du prestataire : rapprochement sûr, sinon rien', () => {
  const onglets = [{ onglet: 'ENCC', entreprise: 'ENCC SPA UNITE HAMIZ' }, { onglet: 'Z.TAYEB', entreprise: 'ETBE ZAATOUT TAYEB' }, { onglet: 'Z.ABD Manuel', entreprise: 'ETB ZATOUT ABDENCER' }];
  assert.strictEqual(E('enqOngletPour_', onglets, 'ENCC SPA'), 'ENCC');
  assert.strictEqual(E('enqOngletPour_', onglets, 'ETB ZATOUT ABDENCER'), 'Z.ABD Manuel');
  assert.strictEqual(E('enqOngletPour_', onglets, 'ETS ZAATOUT AUTRE'), '');
  assert.strictEqual(E('enqOngletPour_', onglets, 'INCONNU'), '');
});
test('entreprise tirée du prestataire du formulaire ; visite sur site ignorée', () => {
  assert.strictEqual(E('enqEntrepriseDe_', '24.INFRA.25 - ENCC SPA - Génie civil'), 'ENCC SPA');
  assert.strictEqual(E('enqEntrepriseDe_', 'Visite sur site - Direction'), '');
  assert.strictEqual(E('enqEntrepriseDe_', ''), '');
});
test('ligne libre : première ligne sans nom sous les en-têtes (lignes numérotées vides du modèle), sinon à la suite', () => {
  const col = { h: 2, fr: 1, fonction: 0 };
  const lignes = [['t'], [''], ['الوظيفة', 'بالفرنسية'], ['Chauffeur', 'KACI Farid'], ['', '', '2'], ['', '', '3']];
  assert.strictEqual(E('enqLigneLibre_', lignes, col), 4);
  assert.strictEqual(E('enqLigneLibre_', lignes.slice(0, 4), col), 4);
  assert.strictEqual(E('enqNomComplet_', 'kaci', 'Farid'), 'KACI Farid');
});
test('résumé lisible', () => {
  const t = E('enqResume_', { ajoutes: ['A B'], existants: ['C D', 'E F'], sansOnglet: [], entreprise: 'X', erreur: '' });
  assert.ok(/1 personne\(s\) ajoutée/.test(t) && /2 déjà présente/.test(t));
  assert.ok(/Aucun onglet/.test(E('enqResume_', { ajoutes: [], existants: [], sansOnglet: ['Z'], entreprise: 'X', erreur: '' })));
});
