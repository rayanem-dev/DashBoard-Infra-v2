// Renommage : documents du personnel (ce que sait faire la page « Documents » de Sijil) — types, agents de l'annuaire, doublons.
const test = require('node:test');
const assert = require('node:assert');
const D = require('../../../js/renomi-doc.js');
const A = require('../../../js/autodetect-renommage.js');

test('le portail utilise le même moteur que lib/_autodetect-renommage (Sijil v3.43.0) : certificat de travail reconnu', () => {
  assert.strictEqual(A.CODES.certificat_travail, 'CT');
  assert.deepStrictEqual(D.TYPES.map(t => t[0]).sort(), Object.keys(A.CODES).sort(), 'tous les types du moteur sont proposés dans la liste de la page');
  assert.strictEqual(D.libelle('certificat_travail'), 'Certificat de travail');
});
test('agents de l\'annuaire : nom ET prénom, sans doublon ; recherche exacte sans accents ni ordre', () => {
  const ag = D.agentsDe([{ nom: 'DURAND Marc' }, { nom: 'durand  marc' }, { nom: 'Poste de garde' }, { nom: 'SEUL' }, { nom: 'ÉLOI Zoé' }, null]);
  assert.deepStrictEqual(ag.map(a => a.nom), ['DURAND Marc', 'Poste de garde', 'ÉLOI Zoé']);
  assert.strictEqual(D.agentParNom(ag, 'marc durand').nom, 'DURAND Marc'); assert.strictEqual(D.agentParNom(ag, 'ELOI zoe').nom, 'ÉLOI Zoé');
  assert.strictEqual(D.agentParNom(ag, 'Durand'), null, 'un seul mot : pas d\'agent');
});
test('doublons : même fichier (empreinte) ou même agent + même type + même période', () => {
  const ch = (o) => Object.assign({ date: '', mois: '', mois2: '', nss: '' }, o);
  const l = [
    { id: 'a', nom: 'a.pdf', hash: 'h1', type: 'fiche_emolument', agentId: 'X', champs: ch({ mois: 'mars2026' }) },
    { id: 'b', nom: 'b.pdf', hash: 'h1', type: 'fiche_emolument', agentId: 'X', champs: ch({ mois: 'mars2026' }) },          // même fichier
    { id: 'c', nom: 'c.pdf', hash: 'h2', type: 'fiche_emolument', agentId: 'X', champs: ch({ mois: 'mars2026' }) },          // même période
    { id: 'd', nom: 'd.pdf', hash: 'h3', type: 'fiche_emolument', agentId: 'X', champs: ch({ mois: 'avril2026' }) },         // autre mois : pas un doublon
    { id: 'e', nom: 'e.pdf', hash: 'h4', type: 'fiche_emolument', agentId: 'Y', champs: ch({ mois: 'mars2026' }) },          // autre agent
    { id: 'f', nom: 'f.pdf', hash: 'h5', type: 'autre', agentId: 'X', champs: ch({}) }, { id: 'g', nom: 'g.pdf', hash: 'h6', type: 'autre', agentId: 'X', champs: ch({}) }];
  const r = D.doublons(l, A.periodeOf);
  assert.deepStrictEqual(r.b, [{ niveau: 'exact', avec: 'a.pdf' }]); assert.deepStrictEqual(r.c, [{ niveau: 'periode', avec: 'a.pdf' }, { niveau: 'periode', avec: 'b.pdf' }]);
  assert.strictEqual(r.a, undefined); assert.strictEqual(r.d, undefined); assert.strictEqual(r.e, undefined); assert.strictEqual(r.g, undefined, 'le type « autre » n\'a pas de période : jamais signalé');
});
