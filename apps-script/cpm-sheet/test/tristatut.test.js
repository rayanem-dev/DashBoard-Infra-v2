const test = require('node:test'), assert = require('node:assert'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const ctx = { module: {}, console }; vm.createContext(ctx);
vm.runInContext("function normalize(s){return s==null?'':String(s).trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}", ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'TriStatut.gs'), 'utf8'), ctx);
const R = s => ctx.module.exports.rangStatut(s);
test('ordre : Bloqué, Non démarré, Dossier en cours, Attribué, Contrat en exécution, Contrat échu, infructueux ; vide en bas', () => {
  const liste = ['infructueux', 'Contrat échu', 'Contrat en exécution', 'Attribué', 'Dossier en cours', 'Non démarré', 'Bloqué', ''];
  assert.deepStrictEqual(liste.slice().sort((a, b) => R(a) - R(b)), ['Bloqué', 'Non démarré', 'Dossier en cours', 'Attribué', 'Contrat en exécution', 'Contrat échu', 'infructueux', '']);
});
