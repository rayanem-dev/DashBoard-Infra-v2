// Prise en charge hébergée par la passerelle : génération du moteur, absence de conflits de noms, droits et limite « prestataire = ses contrats ».
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const racine = path.join(__dirname, '..', '..', '..');
const gen = require(path.join(racine, 'outils', 'generer-pec-gateway.js'));
const Badges = require(path.join(racine, 'badges', 'badges.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pec-'));
const moteur = path.join(tmp, 'PecMoteur.gs');
gen.generer(path.join(racine, 'apps-script', 'prise-en-charge', 'Code.js'), moteur);

function noms(src) {
  const out = [];
  src.split('\n').forEach(l => { const m = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/.exec(l) || /^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/.exec(l); if (m) out.push(m[1]); });
  return out;
}
test('le moteur généré est du JavaScript valide, avec toutes les fonctions d\'entrée', () => {
  const src = fs.readFileSync(moteur, 'utf8');
  new vm.Script(src);
  gen.ENTREES.forEach(n => assert.ok(new RegExp('function pecw_' + n + '\\(').test(src), n));
  assert.ok(!/\bfunction (onOpen|onEdit|doGet|imprimerTout|buildDropdowns)\b/.test(src), 'aucune fonction de menu du classeur');
});
test('aucun nom défini deux fois dans la passerelle (moteur, lecture, enquêtes et fichiers existants)', () => {
  const dossier = path.join(__dirname, '..');
  const fichiers = fs.readdirSync(dossier).filter(f => f.endsWith('.gs') && !/^(PecMoteur|PecLecture|EnquetesPartage|Simulation|AnnuaireContacts|BadgesMoteur|PointageEffectif)\.gs$|^VideosFormation/.test(f))
    .map(f => path.join(dossier, f)).concat([moteur, path.join(racine, 'apps-script', 'prise-en-charge', 'LecturePEC.gs'), path.join(racine, 'apps-script', 'prise-en-charge', 'Enquetes.gs')]);
  const vus = {}, doubles = [];
  fichiers.forEach(f => noms(fs.readFileSync(f, 'utf8')).forEach(n => { if (vus[n] && vus[n] !== f) doubles.push(n + ' : ' + path.basename(vus[n]) + ' / ' + path.basename(f)); vus[n] = f; }));
  assert.deepStrictEqual(doubles, []);
});

function monde(role, portee) {
  const cache = {}, journal = [], appels = [], lignes = [['email', 'id', 'le']];
  const feuille = {   // onglet « PecFichiers » en mémoire
    getDataRange: () => ({ getValues: () => lignes.map(l => l.slice()) }), getLastRow: () => lignes.length, deleteRow: n => { lignes.splice(n - 1, 1); },
    getRange: (l, c, nl) => ({ setNumberFormat() {}, setValues: v => v.forEach((r, i) => { lignes[l - 1 + i] = r.slice(); }) })
  };
  const ctx = {
    cpmFeuille_: () => feuille,
    console, Badges, Droits: require('../Droits.gs'),
    Auth: { userFromToken: () => ({ email: 'x@y.dz', uid: 'u1', role, portee }) },
    acces_: () => ({ logistique: 2 }),
    Store: { journal: (...a) => journal.push(a) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    pecw_obtenirOptionsFormulaire: () => ({ prestataires: ['53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement', '30.INFRA.24 - GLOBI CORP - Maintenance', 'Visite sur site - Organisme X'], servicesParPrestataire: { '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement': 'S', '30.INFRA.24 - GLOBI CORP - Maintenance': 'S' }, basesParPrestataire: {}, emputations: ['E'], bases: ['B'] }),
    pecw_soumettreFormulairePEC: (d) => { appels.push(d.prestataire); return { success: true, liens: [{ nom: 'PEC', url: 'https://drive.google.com/file/d/ABCDEFGHIJKL1234/view' }] }; },
    pecw_listerFichiersGeneres: () => ({ success: true, fichiers: [{ id: 'ABCDEFGHIJKL1234', nom: 'a' }, { id: 'AUTREFICHIER99999', nom: 'b' }] }),
    pecw_supprimerFichierGenere: (id) => { appels.push('suppr ' + id); return { success: true }; },
    pecw_effacerToutWeb: () => { appels.push('efface'); return { success: true }; },
    rechercherPersonnes: () => ({ ok: true, personnes: [{ nom: 'A', entreprise: 'ETB ZATOUT ABDENACER' }, { nom: 'B', entreprise: 'GLOBI CORP' }] }),
  };
  vm.createContext(ctx);
  const b = fs.readFileSync(path.join(__dirname, '..', 'Badges.gs'), 'utf8');
  vm.runInContext(b.slice(b.indexOf('/** Entreprises d\'un compte prestataire'), b.indexOf('function badgesDroit_')), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Pec.gs'), 'utf8'), ctx);
  return { ctx, journal, appels, appeler: (fn, args) => vm.runInContext('pecAppeler_(' + JSON.stringify({ token: 't', fn, args }) + ')', ctx) };
}
test('personnel de la division : options et résultats inchangés', () => {
  const m = monde('chef_service', '');
  assert.strictEqual(m.appeler('obtenirOptionsFormulaire', []).prestataires.length, 3);
  assert.strictEqual(m.appeler('rechercherPersonnes', ['a']).personnes.length, 2);
  assert.strictEqual(m.appeler('effacerToutWeb', []).success, true);
});
test('prestataire : seulement ses contrats dans les options, la recherche et la génération', () => {
  const m = monde('prestataire', 'ETB Zatout Abdenacer');
  const o = m.appeler('obtenirOptionsFormulaire', []);
  assert.deepStrictEqual(Array.from(o.prestataires), ['53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement']);
  assert.deepStrictEqual(Object.keys(o.servicesParPrestataire), ['53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement']);
  assert.deepStrictEqual(m.appeler('rechercherPersonnes', ['a']).personnes.map(p => p.nom), ['A']);
  assert.throws(() => m.appeler('soumettreFormulairePEC', [{ prestataire: '30.INFRA.24 - GLOBI CORP - Maintenance' }]), /ne fait pas partie de vos contrats/);
  assert.deepStrictEqual(m.appels, []);
  assert.strictEqual(m.appeler('soumettreFormulairePEC', [{ prestataire: '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement' }]).success, true);
});
test('prestataire : ne voit et ne supprime que les documents qu\'il a générés ; aucune action d\'administration', () => {
  const m = monde('prestataire', 'ETB Zatout Abdenacer');
  assert.strictEqual(m.appeler('listerFichiersGeneres', []).fichiers.length, 0, 'rien avant d\'avoir généré');
  m.appeler('soumettreFormulairePEC', [{ prestataire: '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement' }]);
  assert.deepStrictEqual(m.appeler('listerFichiersGeneres', []).fichiers.map(f => f.id), ['ABCDEFGHIJKL1234']);
  assert.throws(() => m.appeler('supprimerFichierGenere', ['AUTREFICHIER99999']), /ne fait pas partie de vos documents/);
  assert.strictEqual(m.appeler('supprimerFichierGenere', ['ABCDEFGHIJKL1234']).success, true);
  ['ajouterOrganisme', 'actualiserPrestatairesWeb', 'ouvrirDossierPDFWeb'].forEach(a => assert.throws(() => m.appeler(a, []), /Réservé au personnel/));
});
test('prestataire : ses documents restent à sa disposition (liste gardée), « tout supprimer » ne touche que les siens', () => {
  const m = monde('prestataire', 'ETB Zatout Abdenacer');
  m.appeler('soumettreFormulairePEC', [{ prestataire: '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement' }]);
  m.appeler('soumettreFormulairePEC', [{ prestataire: '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement' }]);   // même fichier : pas de doublon
  vm.runInContext('CacheService = { getScriptCache: () => ({ get: () => null, put() {} }) };', m.ctx);               // le cache n'est plus nécessaire : la liste vient de l'onglet
  assert.deepStrictEqual(m.appeler('listerFichiersGeneres', []).fichiers.map(f => f.id), ['ABCDEFGHIJKL1234']);
  assert.strictEqual(m.appeler('effacerToutWeb', []).success, true);
  assert.deepStrictEqual(m.appels.filter(a => /^suppr|^efface/.test(a)), ['suppr ABCDEFGHIJKL1234']);              // jamais pecw_effacerToutWeb (tous les fichiers de la division)
  assert.strictEqual(m.appeler('listerFichiersGeneres', []).fichiers.length, 0);
  assert.ok(m.journal.some(j => j[0] === 'pec_efface_mes_fichiers'));
});
test('documents d\'une personne : identifiants sans doublon, adresse insensible à la casse, plafond', () => {
  const m = monde('prestataire', 'X'), f = (l, e, n) => JSON.parse(vm.runInContext('JSON.stringify(pecIdsDe_(' + JSON.stringify(l) + ',' + JSON.stringify(e) + ',' + n + '))', m.ctx));
  const l = [{ email: 'A@x.dz', id: '1' }, { email: 'b@x.dz', id: '2' }, { email: 'a@x.dz', id: '1' }, { email: 'a@x.dz', id: '3' }, { email: 'a@x.dz', id: '4' }];
  assert.deepStrictEqual(f(l, 'a@X.dz', 10), ['1', '3', '4']); assert.deepStrictEqual(f(l, 'a@x.dz', 2), ['3', '4']); assert.deepStrictEqual(f(l, 'zz@x.dz', 5), []);
});
test('une action inconnue ou un droit insuffisant est refusé', () => {
  const m = monde('agent', '');
  assert.throws(() => m.appeler('nimporte', []), /Action inconnue/);
  m.ctx.acces_ = () => ({ logistique: 1 });
  assert.throws(() => m.appeler('effacerToutWeb', []), /Droits insuffisants/);
  m.ctx.acces_ = () => ({});
  assert.throws(() => m.appeler('obtenirOptionsFormulaire', []), /Droits insuffisants/);
});

test('prestataire : l\'imputation n\'est pas un choix, elle vient du service du contrat', () => {
  const m = monde('prestataire', 'ETB Zatout Abdenacer');
  const f = (portee, d, o) => vm.runInContext('pecImputationFixee_(' + JSON.stringify(portee) + ',' + JSON.stringify(d) + ',' + JSON.stringify(o) + ')', m.ctx);
  const o = { servicesParPrestataire: { 'C1': 'Travaux Entretien' } };
  assert.strictEqual(f(['x'], { prestataire: 'C1', emputation: 'Construction' }, o).emputation, 'Travaux Entretien');   // le choix du prestataire est écrasé
  assert.strictEqual(f(['x'], { prestataire: 'C2', emputation: 'Construction' }, o).emputation, 'Construction');          // contrat sans service connu : inchangé
  assert.strictEqual(f(null, { prestataire: 'C1', emputation: 'Construction' }, o).emputation, 'Construction');            // personnel de la division : libre
  assert.strictEqual(m.appeler('obtenirOptionsFormulaire', []).imputation_fixe, true);
  assert.strictEqual(monde('chef_service', '').appeler('obtenirOptionsFormulaire', []).imputation_fixe, undefined);
});

test('mémoire de saisie : dernière saisie de chaque personne, véhicules connus, limitée aux contrats d\'un prestataire', () => {
  const m = monde('chef_service', '');
  const f = (brut, portee) => JSON.parse(vm.runInContext('JSON.stringify(pecMemoireDepuis_(' + JSON.stringify(brut) + ',' + JSON.stringify(portee) + '))', m.ctx));
  const E = ['date', 'prestataire', 'base', 'documents', 'nom', 'prenom', 'fonction', 'vehicule', 'immatriculation'];
  const brut = { valeurs: [E,
    ['2026-09-01', '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement', 'B', 'PEC', 'BENKHET', 'Mohamed', 'chauffeur', 'toyota hilux', '01307-316-30'],
    ['2026-10-01', '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement', 'B', 'PEC', 'BENKHET', 'Mohamed', 'Chauffeur poids lourd', '', ''],
    ['2026-10-02', '30.INFRA.24 - GLOBI CORP - Maintenance', 'B', 'PEC', 'DUPONT', 'Paul', 'Électricien', 'Nacelle', '00164-316-30']],
    vehicules: [{ immat: '00437-216-30', modele: 'Shacman' }] };
  const t = f(brut, null);
  assert.strictEqual(t.personnes.length, 2);
  const b = t.personnes.filter(p => p.nom === 'BENKHET')[0];
  assert.deepStrictEqual([b.fonction, b.typeVehicule, b.immatriculation], ['Chauffeur poids lourd', 'toyota hilux', '01307-316-30']);   // fonction la plus récente, véhicule le plus récent renseigné
  assert.ok(t.vehicules.some(v => v.immat === '00437-216-30' && v.modele === 'SHACMAN')); assert.ok(t.types.indexOf('NACELLE') >= 0);
  const pr = f(brut, ['etb zatout abdenacer']);
  assert.deepStrictEqual(pr.personnes.map(p => p.nom), ['BENKHET']); assert.ok(!pr.vehicules.some(v => v.immat === '00437-216-30'));
});

test('mémoire : le chauffeur déjà saisi avec un véhicule et celui du tableau des véhicules remontent avec l\'immatriculation', () => {
  const m = monde('chef_service', '');
  const f = (brut, portee) => JSON.parse(vm.runInContext('JSON.stringify(pecMemoireDepuis_(' + JSON.stringify(brut) + ',' + JSON.stringify(portee) + '))', m.ctx));
  const E = ['date', 'prestataire', 'base', 'documents', 'nom', 'prenom', 'fonction', 'vehicule', 'immatriculation'];
  const brut = { valeurs: [E,
    ['2026-09-01', '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement', 'B', 'PEC', 'ANCIEN', 'Paul', 'chauffeur', 'toyota hilux', '01307-316-30'],
    ['2026-10-01', '53.INFRA.25 - ETB ZATOUT ABDENACER - Terrassement', 'B', 'PEC', 'BENKHET', 'Mohamed', 'chauffeur poids lourd', 'toyota hilux', '01307-316-30']],
    vehicules: [{ immat: '00437-216-30', modele: 'Shacman', chauffeur: 'DERRADJI Abderrazak / MESSAI Ismail' }, { immat: '00999-216-30', modele: '', chauffeur: 'Vehicule Sonatrach' }, { immat: '01307-316-30', modele: 'Toyota', chauffeur: 'BENKHET Mohamed' }] };
  const t = f(brut, null), v = im => t.vehicules.filter(x => x.immat === im)[0];
  assert.deepStrictEqual(v('01307-316-30').conducteur, { nom: 'BENKHET', prenom: 'Mohamed', fonction: 'chauffeur poids lourd' });   // le plus récent
  assert.strictEqual(v('01307-316-30').chauffeur, 'BENKHET Mohamed');
  assert.strictEqual(v('00437-216-30').chauffeur, 'DERRADJI Abderrazak / MESSAI Ismail'); assert.strictEqual(v('00437-216-30').modele, 'SHACMAN');
  assert.strictEqual(v('00999-216-30'), undefined, 'véhicule sans type ni chauffeur réel : ignoré');
  const pr = f(brut, ['etb zatout abdenacer']);
  assert.ok(pr.vehicules.every(x => x.chauffeur === undefined) && !pr.vehicules.some(x => x.immat === '00437-216-30'), 'un prestataire ne voit rien du tableau des véhicules');
});
test('prestataire et invité : pas d\'ajout d\'organisme hors Suivi CPM (indicateur renvoyé à la page)', () => {
  assert.strictEqual(monde('prestataire', 'ETB Zatout Abdenacer').appeler('obtenirOptionsFormulaire', []).sans_organisme, true);
  assert.strictEqual(monde('guest', '').appeler('obtenirOptionsFormulaire', []).sans_organisme, true);
  assert.strictEqual(monde('chef_service', '').appeler('obtenirOptionsFormulaire', []).sans_organisme, undefined);
});
