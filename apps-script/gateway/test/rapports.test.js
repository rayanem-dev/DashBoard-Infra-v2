// node --test apps-script/gateway/test/rapports.test.js
const test = require('node:test');
const assert = require('node:assert');
global.Dates = require('../Dates.gs');
const Rapports = require('../Rapports.gs');

const AUJ = '2026-10-13', IDS = ['forage_rns', 'terrassement_rns'];
const ok = { date: '2026-10-13', chantier: 'Forage_RNS', effectif: '12', travaux: 'Forage du puits P2 jusqu\'à 85 m', avancement: '42.34' };

test('rapport valide : champs nettoyés, avancement arrondi, chantier normalisé', () => {
  const r = Rapports.valider(ok, AUJ, 2, IDS);
  assert.strictEqual(r.erreur, undefined);
  assert.deepStrictEqual(r.rapport, { date: AUJ, chantier: 'forage_rns', effectif: 12, travaux: ok.travaux, lignes: [], difficultes: '', commentaire: '', avancement: 42.3 });
});

test('refus : date future, trop ancienne, chantier inconnu, effectif, travaux, avancement', () => {
  const err = (patch, niv = 2) => Rapports.valider({ ...ok, ...patch }, AUJ, niv, IDS).erreur;
  assert.match(err({ date: '2026-10-14' }), /futur/);
  assert.match(err({ date: '2026-10-05' }), /7 jours/);
  assert.strictEqual(err({ date: '2026-10-05' }, 3), undefined); // niveau 3 : 60 jours
  assert.match(err({ date: '2026-02-30' }), /Date invalide/);
  assert.match(err({ chantier: 'xxx' }), /Chantier inconnu/);
  assert.match(err({ effectif: '' }), /Effectif/); assert.match(err({ effectif: '-1' }), /Effectif/); assert.match(err({ effectif: '2.5' }), /Effectif/);
  assert.match(err({ travaux: ' a ' }), /travaux réalisés/);
  assert.match(err({ avancement: '101' }), /entre 0 et 100/);
  assert.strictEqual(err({ avancement: '' }), undefined);
});

test('texte : caractères de contrôle retirés, longueur bornée', () => {
  const r = Rapports.valider({ ...ok, travaux: 'ok\u0000\u0007 suite', commentaire: 'x'.repeat(5000) }, AUJ, 2, IDS).rapport;
  assert.strictEqual(r.travaux, 'ok suite'); assert.strictEqual(r.commentaire.length, 1000);
});

const L = [
  { id: 'a', date: '2026-10-13', chantier: 'forage_rns', auteur_email: 'c1@x.dz', service: 'Travaux Entretien', effectif: 10, avancement: 40 },
  { id: 'b', date: '2026-10-13', chantier: 'forage_rns', auteur_email: 'c2@x.dz', service: 'Travaux Entretien', effectif: 5, avancement: 45 },
  { id: 'c', date: '2026-10-12', chantier: 'terrassement_rns', auteur_email: 'c3@x.dz', service: 'Électromécanique', effectif: 8, avancement: '' },
];
const c1 = { email: 'C1@x.dz', service: 'Travaux Entretien' };

test('portée : niveau 1 = les siens ; niveau 2 = son service ; niveau 3 = tout', () => {
  assert.deepStrictEqual(Rapports.filtrer(L, c1, 1).map(r => r.id), ['a']);
  assert.deepStrictEqual(Rapports.filtrer(L, c1, 2).map(r => r.id), ['a', 'b']);
  assert.deepStrictEqual(Rapports.filtrer(L, c1, 3).map(r => r.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(Rapports.filtrer(L, { email: 'z@x.dz', service: '' }, 2).map(r => r.id), []); // sans service : pas de fuite
});

test('filtres : période, chantier, auteur', () => {
  assert.deepStrictEqual(Rapports.filtrer(L, c1, 3, { du: '2026-10-13' }).map(r => r.id), ['a', 'b']);
  assert.deepStrictEqual(Rapports.filtrer(L, c1, 3, { chantier: 'Terrassement_RNS' }).map(r => r.id), ['c']);
  assert.deepStrictEqual(Rapports.filtrer(L, c1, 3, { auteur: 'C2@x.dz' }).map(r => r.id), ['b']);
});

test('visa : jamais sur son propre rapport, niveau 2 limité au service', () => {
  assert.strictEqual(Rapports.peutViser(c1, 2, L[0]), false);
  assert.strictEqual(Rapports.peutViser(c1, 2, L[1]), true);
  assert.strictEqual(Rapports.peutViser(c1, 2, L[2]), false);
  assert.strictEqual(Rapports.peutViser(c1, 3, L[2]), true);
  assert.strictEqual(Rapports.peutViser(c1, 1, L[1]), false);
});

test('synthèse du jour : rapports par chantier, effectif cumulé, manquants', () => {
  const ch = [{ id: 'forage_rns', nom: 'Forage', actif: 1 }, { id: 'terrassement_rns', nom: 'Terrassement', actif: 1 }, { id: 'ancien', nom: 'Ancien', actif: 0 }];
  const s = Rapports.synthese(ch, L, '2026-10-13');
  assert.strictEqual(s.chantiers.length, 2);
  assert.strictEqual(s.chantiers[0].effectif, 15); assert.strictEqual(s.chantiers[0].avancement, 45);
  assert.strictEqual(s.chantiers[1].rapports.length, 0); assert.strictEqual(s.manquants, 1);
});

test('clé d\'unicité : date | chantier | auteur', () => {
  assert.strictEqual(Rapports.cle('2026-10-13', 'Forage_RNS', 'C1@X.dz'), '2026-10-13|forage_rns|c1@x.dz');
});

test('rapport en lignes : zone, texte, avancement ; le texte et l\'avancement global se déduisent des lignes', () => {
  const lignes = [{ zone: 'Base de vie (BVC)', texte: 'Finitions', avancement: '99' }, { zone: 'Région', texte: 'Peinture', avancement: '96.46' }, { zone: '', texte: '', avancement: '' }];
  const r = Rapports.valider({ date: AUJ, chantier: 'forage_rns', effectif: '5', lignes }, AUJ, 2, IDS);
  assert.strictEqual(r.erreur, undefined);
  assert.deepStrictEqual(r.rapport.lignes, [{ zone: 'Base de vie (BVC)', texte: 'Finitions', avancement: 99 }, { zone: 'Région', texte: 'Peinture', avancement: 96.5 }]);
  assert.strictEqual(r.rapport.avancement, 99);
  assert.strictEqual(r.rapport.travaux, '• Base de vie (BVC) : Finitions — 99 %\n• Région : Peinture — 96.5 %');
  assert.match(Rapports.valider({ date: AUJ, chantier: 'forage_rns', effectif: '5', lignes: [{ texte: 'ok ok', avancement: '150' }] }, AUJ, 2, IDS).erreur, /entre 0 et 100/);
  assert.match(Rapports.valider({ date: AUJ, chantier: 'forage_rns', effectif: '5', lignes: [{ zone: 'x', texte: '', avancement: '' }] }, AUJ, 2, IDS).erreur, /travaux/);
});

test('services : « Service Construction (Génie Civil) » = « Construction » ; les chantiers sans service restent visibles', () => {
  assert.ok(Rapports.servicePareil('Service Construction (Génie Civil)', 'Construction'));
  assert.ok(Rapports.servicePareil('Service Electromécanique', 'Électromécanique'));
  assert.ok(!Rapports.servicePareil('Travaux Entretien', 'Construction'));
  const ch = [{ id: 'a', service: 'Construction' }, { id: 'b', service: 'Électromécanique' }, { id: 'c', service: '' }];
  const u = { service: 'Service Construction (Génie Civil)' };
  assert.deepStrictEqual(Rapports.chantiersVisibles(ch, u, 2).map(c => c.id), ['a', 'c']);
  assert.deepStrictEqual(Rapports.chantiersVisibles(ch, u, 3).map(c => c.id), ['a', 'b', 'c']);
});

test('chantiers depuis le CPM : seuls les contrats en exécution ; rien de manuel n\'est touché', () => {
  const enr = { ordre: ['a', 'b', 'c', 'd'], dossiers: {
    a: { statut: 'Contrat en exécution', n_contrat: '72.INFRA.25', intitule: 'Forage trois puits', attribue_a: 'ENAGEO' },
    b: { statut: 'Contrat échu', n_contrat: '10.INFRA.24', intitule: 'Ancien', attribue_a: 'X' },
    c: { statut: 'Contrat en exécution', n_contrat: '', intitule: 'Sans numéro', attribue_a: 'Y' },
    d: { statut: 'Contrat en exécution', n_contrat: '43.INFRA.25', intitule: 'Abris', attribue_a: 'ENCC' } } };
  const existants = [
    { id: '43-infra-25', nom: 'ancien nom', service: 'Construction', source: 'cpm', actif: '1' },
    { id: '99-infra-20', nom: 'Fini', service: '', source: 'cpm', actif: '1' },
    { id: 'routine-entretien', nom: 'Routine', service: 'Entretien', source: 'manuel', actif: '1' }];
  const p = Rapports.chantiersDepuisCpm(enr, existants);
  assert.deepStrictEqual(p.ajouter.map(c => [c.id, c.nom, c.service]), [['72-infra-25', 'Forage trois puits — ENAGEO', '']]);
  assert.deepStrictEqual(p.maj, [{ id: '43-infra-25', nom: 'Abris — ENCC' }]);
  assert.deepStrictEqual(p.desactiver, ['99-infra-20']); // contrat sorti de l'exécution ; la routine manuelle reste
  assert.deepStrictEqual(p.reactiver, []);
});

test('ligne de travaux de routine (prestation) : repérée, texte préfixé', () => {
  const r = Rapports.valider({ date: AUJ, chantier: 'forage_rns', effectif: '3', lignes: [{ zone: 'Climatiseurs', texte: 'Réparation sur sites', routine: true }, { zone: 'GC', texte: 'Dépose', avancement: '5' }] }, AUJ, 2, IDS);
  assert.strictEqual(r.erreur, undefined);
  assert.deepStrictEqual(r.rapport.lignes, [{ zone: 'Climatiseurs', texte: 'Réparation sur sites', avancement: '', routine: true }, { zone: 'GC', texte: 'Dépose', avancement: 5 }]);
  assert.match(r.rapport.travaux, /\[Routine\] Climatiseurs/);
});
