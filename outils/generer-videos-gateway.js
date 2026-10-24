// Génère, à partir de data/videos/<id>.mp4 (+ .jpg d'aperçu), les fichiers .gs de la passerelle qui servent les vidéos de formation APRÈS CONNEXION
// (elles ne sont plus publiées sur le site public). Un fichier Apps Script par morceau de 350 000 caractères + un fichier d'index.
// Usage : node outils/generer-videos-gateway.js [dossier_sources] [dossier_sortie]
const fs = require('fs'), path = require('path');
const TAILLE = 350000;
function nomVar(id, type, i) { return 'VF_' + id.replace(/[^A-Za-z0-9]/g, '_').toUpperCase() + '_' + type.toUpperCase() + '_' + i; }
function generer(src, sortie) {
  const ids = fs.readdirSync(src).filter(f => f.endsWith('.mp4')).map(f => f.slice(0, -4)).sort(), index = {}, fichiers = [];
  ids.forEach(id => {
    index[id] = {};
    [['mp4', '.mp4'], ['poster', '.jpg']].forEach(([type, ext]) => {
      const f = path.join(src, id + ext); if (!fs.existsSync(f)) { index[id][type] = []; return; }
      const b64 = fs.readFileSync(f).toString('base64'), noms = [];
      for (let i = 0, n = 0; i < b64.length; i += TAILLE, n += 1) { const v = nomVar(id, type, n); noms.push(v); fichiers.push({ nom: 'VideosFormation_' + v.toLowerCase() + '.gs', texte: 'var ' + v + " = '" + b64.slice(i, i + TAILLE) + "';\n" }); }
      index[id][type] = noms;
    });
  });
  const idx = '// Généré par outils/generer-videos-gateway.js (ne pas modifier à la main).\nfunction videosFormationParties_() {\n  return {' + ids.map(id => "\n    '" + id + "': { mp4: [" + index[id].mp4.join(', ') + '], poster: [' + index[id].poster.join(', ') + '] }').join(',') + '\n  };\n}\n';
  fichiers.push({ nom: 'VideosFormation.gs', texte: idx });
  fs.mkdirSync(sortie, { recursive: true }); fichiers.forEach(f => fs.writeFileSync(path.join(sortie, f.nom), f.texte));
  return { ids, fichiers: fichiers.map(f => f.nom) };
}
if (require.main === module) { const r = generer(process.argv[2] || 'data/videos', process.argv[3] || 'apps-script/gateway'); console.log(r.ids.length + ' vidéo(s), ' + r.fichiers.length + ' fichier(s) générés.'); }
module.exports = { generer, TAILLE };
