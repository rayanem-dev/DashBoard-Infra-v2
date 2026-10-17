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
test('ligne libre : toujours à la suite de la dernière personne (jamais dans un trou, jamais sur une ligne remplie)', () => {
  const col = { h: 2, fr: 1, fonction: 0 };
  const lignes = [['t'], [''], ['الوظيفة', 'بالفرنسية'], ['Chauffeur', 'KACI Farid'], ['', '', '2'], ['', '', '3']];
  assert.strictEqual(E('enqLigneLibre_', lignes, col), 4);                  // ligne numérotée vide qui suit la dernière personne
  assert.strictEqual(E('enqLigneLibre_', lignes.slice(0, 4), col), 4);      // fin du tableau : on ajoute en bas
  const trou = [['t'], [''], ['الوظيفة', 'بالفرنسية'], ['', 'A B'], ['', ''], ['', 'C D'], ['', '']];
  assert.strictEqual(E('enqLigneLibre_', trou, col), 6);                    // le trou de la ligne 5 n'est pas rempli : on continue après C D
  const pleine = [['t'], [''], ['الوظيفة', 'بالفرنسية'], ['', 'A B'], ['Maçon', '']];
  assert.strictEqual(E('enqLigneLibre_', pleine, col), 5);                  // la ligne qui suit porte déjà une fonction : on n'écrase pas
  assert.strictEqual(E('enqLigneLibre_', [['t'], [''], ['الوظيفة', 'بالفرنسية']], col), 3);   // onglet vide : première ligne sous l'en-tête
  assert.strictEqual(E('enqNomComplet_', 'kaci', 'Farid'), 'KACI Farid');
});
test('résumé lisible', () => {
  const t = E('enqResume_', { ajoutes: ['A B'], existants: ['C D', 'E F'], sansOnglet: [], entreprise: 'X', erreur: '' });
  assert.ok(/1 personne\(s\) ajoutée/.test(t) && /2 ignorée/.test(t));
  assert.ok(/NON ajouté/.test(E('enqResume_', { ajoutes: [], existants: [], sansOnglet: ['Z'], entreprise: 'X', erreur: '' })));
});

// ---------- onglets normalisés, numéro d'agent, arabe ----------
const ONG = [{ onglet: 'Z.ABD Manuel', entreprise: 'ETB ZAATOUT ABDENCER', personnes: [] }, { onglet: 'Z.ABD Terass', entreprise: 'ETB ZAATOUT ABDENCER', personnes: [] }, { onglet: 'Z.ABD Mec', entreprise: 'ETB ZAATOUT ABDENCER', personnes: [] },
  { onglet: 'MHENNI', entreprise: 'ETS MHENNI', personnes: [] }, { onglet: 'GCB', entreprise: 'GCB DIRECTION', personnes: [] }, { onglet: 'Liste', entreprise: 'Liste', personnes: [] }];
const CPM = [{ entreprise: 'ZAATOUT ABDENCER', contrat: '53.INFRA.25', intitule: 'Terrassement & plates-formes tuf Rhourde' }, { entreprise: 'ZAATOUT ABDENCER', contrat: '54.INFRA.25', intitule: 'Dessablage manuel production Rhourde' },
  { entreprise: 'ZAATOUT ABDENCER', contrat: '58.INFRA.25', intitule: 'Dessablage méca. accès puits Rhourde' }, { entreprise: 'ETS MEHENNI ABDELKADER', contrat: '11.INFRA.26', intitule: 'Rénovation de deux piscines' },
  { entreprise: 'GCB', contrat: '51.INFRA.26', intitule: 'Routes' }, { entreprise: 'GCB', contrat: '52.INFRA.26', intitule: 'Routes périphérie' }];
test('nom d\'onglet normalisé : ENTREPRISE · contrat, sans caractère interdit', () => {
  assert.strictEqual(E('enqNomOnglet_', 'Eurl Alko Construction', '80.INFRA.26'), 'EURL ALKO CONSTRUCTION · 80.INFRA.26');
  assert.strictEqual(E('enqNomOnglet_', 'A/B [x]', 'N°I/51/RNS'), 'A-B -X- · N°I-51-RNS');
});
test('normalisation : un contrat reconnu par le mot restant du nom d\'onglet, sinon « ambigu » ; jamais deux onglets au même nom', () => {
  const plan = E('enqPlanNoms_', ONG, CPM), p = n => plan.find(x => x.onglet === n);
  assert.strictEqual(p('Z.ABD Manuel').nouveau, 'ZAATOUT ABDENCER · 54.INFRA.25');
  assert.strictEqual(p('Z.ABD Terass').nouveau, 'ZAATOUT ABDENCER · 53.INFRA.25');
  assert.strictEqual(p('Z.ABD Mec').nouveau, 'ZAATOUT ABDENCER · 58.INFRA.25');
  assert.strictEqual(p('MHENNI').nouveau, 'ETS MEHENNI ABDELKADER · 11.INFRA.26');
  assert.strictEqual(p('GCB').etat, 'ambigu');   // deux contrats GCB, rien dans le nom qui les distingue
});
test('l\'onglet est choisi par le contrat quand le nom le porte ; un autre contrat = autre onglet', () => {
  const o = [{ onglet: 'ENCC SPA · 12.INFRA.25', entreprise: 'ENCC SPA' }, { onglet: 'ENCC SPA · 99.INFRA.26', entreprise: 'ENCC SPA' }, { onglet: 'ATTIA', entreprise: 'SARL ATTIA MEHDI' }];
  assert.strictEqual(E('enqOngletPour_', o, 'ENCC SPA', '99.INFRA.26'), 'ENCC SPA · 99.INFRA.26');
  assert.strictEqual(E('enqOngletPour_', o, 'ENCC SPA', '77.INFRA.27'), '');            // nouveau contrat : un onglet sera créé
  assert.strictEqual(E('enqOngletPour_', o, 'ATTIA MEHDI', '14.INFRA.25'), 'ATTIA');    // ancien nom sans contrat : accepté
});
test('numéro d\'agent : colonne numérotée à gauche des noms, prochain = plus grand + 1', () => {
  const l = [['', '', 'x'], ['رقم', 'بالفرنسية', ''], ['1', 'A B', ''], ['2', 'C D', ''], ['3', '', '']];
  const col = { h: 1, fr: 1 };
  assert.strictEqual(E('enqColNumero_', l, col), 0);
  assert.strictEqual(E('enqProchainNumero_', l, col, 0), 4);
  assert.strictEqual(E('enqColNumero_', [['', 'بالفرنسية'], ['', 'A B']], { h: 0, fr: 1 }), -1);
});
test('arabe approché : prénoms courants et règles simples', () => {
  assert.strictEqual(E('enqArabe_', 'RAYANE'), 'ريان');
  assert.strictEqual(E('enqArabe_', 'Chems Eddine'), 'شمس الدين');
  assert.ok(/^[؀-ۿ ]+$/.test(E('enqArabe_', 'Boukhalfa')));
  assert.strictEqual(E('enqArabe_', ''), '');
});

test('onglet vierge : modèle = le plus petit onglet ; en-tête : titre remplacé, restes latins / numériques vidés, libellés arabes gardés', () => {
  const ong = [{ onglet: 'ENAGEO', personnes: new Array(70).fill(1) }, { onglet: 'Liste', personnes: new Array(5).fill(1) }, { onglet: 'RADJAA', personnes: new Array(8).fill(1) }, { onglet: 'CASSE', erreur: 'x', personnes: [] }];
  assert.deepStrictEqual(E('enqChoisirModele_', ong), ['RADJAA', 'ENAGEO']);
  const l = [['القائمة الإسمية للعمال ETS ANCIEN SPA'], ['', 'رقم العقد', '12.INFRA.25'], ['المشروع', 'Terrassement Rhourde'], ['', '', '05/10/2025'], ['الرقم', 'بالفرنسية']];
  assert.deepStrictEqual(E('enqCorrectionsEntete_', l, 4, 'eurl alko'), [
    { ligne: 1, col: 1, valeur: 'القائمة الإسمية للعمال EURL ALKO' },
    { ligne: 2, col: 3, valeur: '' }, { ligne: 3, col: 2, valeur: '' }, { ligne: 4, col: 3, valeur: '' }]);
});

test('numéro d\'agent dans un onglet vierge : colonne trouvée par son en-tête', () => {
  const vierge = [['t'], ['الرقم', 'بالفرنسية', 'الوظيفة'], ['', '', ''], ['', '', '']];
  assert.strictEqual(E('enqColNumero_', vierge, { h: 1, fr: 1 }), 0);
  assert.strictEqual(E('enqProchainNumero_', vierge, { h: 1, fr: 1 }, 0), 1);
});

test('doublon : seulement chez le même prestataire', () => {
  const idx = [{ nom: 'BENALI', prenom: 'Karim', entreprise: 'ENAGEO', onglet: 'ENAGEO' }];
  assert.ok(E('enqTrouver_', idx, 'BENALI', 'Karim'));
  assert.ok(E('enqTrouver_', idx, 'BENALI', 'Karim', 'ENAGEO'));
  assert.equal(E('enqTrouver_', idx, 'BENALI', 'Karim', 'CEERI SARMOUK'), null);
});

test('numéro d\'agent : colonne à droite des noms, repérée par son en-tête ou ses entiers qui se suivent', () => {
  const ent = ['ADRESSE', 'بالفرنسية', 'الوظيفة', 'تاريخ', 'الإسم', 'اللقب', 'الرقم'];
  const lignes = [ent, ['x', 'A B', 'f', '1984/03/04', 'ا', 'ب', '1'], ['x', 'C D', 'f', '1988/11/22', 'ا', 'ب', '2']];
  const col = { h: 0, fr: 1, fonction: 2, prenomAr: 4, nomAr: 5 };
  assert.equal(E('enqColNumero_', lignes, col), 6);
  assert.equal(E('enqProchainNumero_', lignes, col, 6), 3);
  const sansEnt = [['ADRESSE', 'بالفرنسية', 'الوظيفة', 'تاريخ', 'الإسم', 'اللقب', ''], lignes[1], lignes[2]];
  assert.equal(E('enqColNumero_', sansEnt, col), 6);
  assert.equal(E('enqColDate_', [['a', 'تاريخ التسجيل']], { h: 0 }), 1);
  assert.equal(E('enqColDate_', [['a', 'تاريخ']], { h: 0 }), -1);
});

test('numéro d\'agent : « رقم الهاتف » n\'est pas la colonne du numéro', () => {
  const lignes = [['رقم الهاتف', 'رقم', 'بالفرنسية', 'اللقب'], ['0555', '', 'A B', 'x']];
  assert.equal(E('enqColNumero_', lignes, { h: 0, fr: 2, fonction: -1, prenomAr: -1, nomAr: 3 }), 1);
});
