// Génère apps-script/gateway/PecMoteur.gs : le moteur de « Prise en charge et autorisation d'accès » (apps-script/prise-en-charge/Code.js)
// repris À L'IDENTIQUE dans la passerelle, pour que l'application tourne derrière la connexion du portail.
// On n'y met que les fonctions utiles au chemin web (et leurs dépendances), chacune renommée avec le préfixe « pecw_ » / « PECW_ »
// pour ne jamais entrer en conflit avec les autres fichiers de la passerelle. La logique n'est pas réécrite : une seule source (Code.js).
// Usage : node outils/generer-pec-gateway.js [Code.js] [sortie.gs]
const fs = require('fs'), path = require('path');
const ENTREES = ['obtenirOptionsFormulaire', 'soumettreFormulairePEC', 'ajouterOrganisme', 'actualiserPrestatairesWeb', 'effacerToutWeb', 'traiterPDFUploadPECWeb',
  'listerFichiersGeneres', 'envoyerFichierParMail', 'lireFichierPourImpression', 'supprimerFichierGenere', 'ouvrirDossierPDFWeb'];
// Constantes du fichier d'origine que la passerelle redéfinit autrement (pas reprises)
const IGNORER = [];

/** Déclarations de premier niveau : { nom, type: 'function'|'const', debut, fin, texte } (commentaire qui précède inclus). */
function declarations(src) {
  const L = src.split('\n'), out = [];
  for (let i = 0; i < L.length; i += 1) {
    const m = /^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/.exec(L[i]) || /^(const|let|var)\s+([A-Za-z0-9_$]+)\s*=/.exec(L[i]);
    if (!m) continue;
    const fn = /^(?:async\s+)?function/.test(L[i]), nom = fn ? m[1] : m[2];
    let fin = i;
    if (fn) { while (fin < L.length && !/^\}\s*$/.test(L[fin])) fin += 1; }
    else { while (fin < L.length && !/;\s*(\/\/.*)?$/.test(L[fin])) fin += 1; }
    let debut = i;
    while (debut > 0 && (/^\s*(\/\*\*|\*|\*\/|\/\/)/.test(L[debut - 1]))) debut -= 1;
    out.push({ nom, type: fn ? 'function' : 'const', debut, fin, texte: L.slice(debut, fin + 1).join('\n') });
    i = fin;
  }
  return out;
}
function ident(re) { return new RegExp('(^|[^A-Za-z0-9_$.])' + re + '(?![A-Za-z0-9_$])', 'g'); }
function fermeture(decls, entrees) {
  const par = {}; decls.forEach(d => { par[d.nom] = d; });
  const pris = {}, pile = entrees.slice();
  while (pile.length) {
    const n = pile.pop(); if (pris[n] || !par[n] || IGNORER.indexOf(n) !== -1) continue; pris[n] = par[n];
    const sansCommentaire = par[n].texte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
    decls.forEach(d => { if (!pris[d.nom] && ident(d.nom.replace(/\$/g, '\\$')).test(sansCommentaire)) pile.push(d.nom); });
  }
  return Object.keys(pris).map(n => pris[n]).sort((a, b) => a.debut - b.debut);
}
function prefixe(d) { return d.type === 'const' || /^[A-Z0-9_]+$/.test(d.nom) ? 'PECW_' + d.nom : 'pecw_' + d.nom; }
function generer(srcPath, sortie) {
  const src = fs.readFileSync(srcPath, 'utf8'), decls = declarations(src), prises = fermeture(decls, ENTREES);
  const manque = ENTREES.filter(n => !prises.some(d => d.nom === n));
  if (manque.length) throw new Error('Fonctions d\'entrée introuvables dans Code.js : ' + manque.join(', '));
  const renom = prises.map(d => ({ d, neuf: prefixe(d) }));
  let texte = renom.map(x => x.d.texte).join('\n\n');
  renom.sort((a, b) => b.d.nom.length - a.d.nom.length).forEach(x => { texte = texte.replace(ident(x.d.nom.replace(/\$/g, '\\$')), (m, p) => p + x.neuf); });
  const entete = '// GÉNÉRÉ par outils/generer-pec-gateway.js à partir de apps-script/prise-en-charge/Code.js — ne pas modifier à la main (modifier Code.js).\n' +
    '// Moteur « Prise en charge et autorisation d\'accès » exécuté par la passerelle : mêmes fonctions, noms préfixés pecw_ / PECW_.\n';
  // Enquetes.gs (partagé, repris tel quel) lit ces trois constantes sous leur nom d'origine
  const alias = '\n// Noms d\'origine attendus par EnquetesPartage.gs\nvar PEC_SS_ID = PECW_PEC_SS_ID;\nvar SUIVI_CPM_ID = PECW_SUIVI_CPM_ID;\nvar SUIVI_CPM_TAB = PECW_SUIVI_CPM_TAB;\n';
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  fs.writeFileSync(sortie, entete + '\n' + texte + '\n' + alias);
  return { fonctions: renom.map(x => x.neuf).sort(), entrees: ENTREES.map(n => 'pecw_' + n) };
}
if (require.main === module) {
  const r = generer(process.argv[2] || 'apps-script/prise-en-charge/Code.js', process.argv[3] || 'apps-script/gateway/PecMoteur.gs');
  console.log(r.fonctions.length + ' éléments repris : ' + r.fonctions.join(', '));
}
module.exports = { generer, declarations, fermeture, ENTREES };
