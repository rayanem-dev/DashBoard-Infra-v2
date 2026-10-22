/**
 * Vis-à-vis des agents : deux liens par agent, déclarés une fois et partagés par tous.
 *  - vis-à-vis de TRAVAIL : qui tient le poste quand l'agent est en repos (relevé dans la Simulation du planning) ;
 *  - vis-à-vis de CHAMBRE : qui occupe la même chambre (peut être une autre personne, d'une autre entité).
 * Stockés dans l'onglet « VisAVis » (uid, vis_travail, vis_chambre, maj_par, maj_le). Lecture : droit « rh » (Organigramme) ;
 * modification : comme les affectations (niveau 3 = tout le personnel, niveau 2 = les personnes de son service).
 * Un lien déclaré pour A est aussi posé chez son vis-à-vis tant que celui-ci n'en a pas déjà un (A↔B), sans jamais écraser un lien existant.
 */
function visavisPrets_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('VISAVIS_PRET') === '1') return;
  try {
    var db = SpreadsheetApp.openById(prop_('DB_ID'));
    if (!db.getSheetByName('VisAVis')) { var sh = db.insertSheet('VisAVis'); sh.appendRow(SCHEMA_.VisAVis); sh.setFrozenRows(1); sh.getRange('A:Z').setNumberFormat('@'); }
    props.setProperty('VISAVIS_PRET', '1');
    try { CacheService.getScriptCache().remove('TBL_VisAVis'); } catch (e) {}
  } catch (e) { /* on réessaiera à la requête suivante */ }
}
/** { uid: { vis_travail, vis_chambre } } */
function visavisCarte_() {
  visavisPrets_();
  var m = {};
  try { Store.table('VisAVis').forEach(function (r) { if (r.uid) m[String(r.uid)] = { vis_travail: String(r.vis_travail || ''), vis_chambre: String(r.vis_chambre || '') }; }); } catch (e) { /* onglet pas encore créé */ }
  return m;
}
/** Plan d'écriture PUR (testé en Node) : [{ uid, vis_travail?, vis_chambre? }]. `carte` = état actuel, `connus` = { uid: true }. Erreur → { erreur }. */
function visavisPlan_(carte, uid, travail, chambre, connus) {
  uid = String(uid || ''); travail = String(travail || ''); chambre = String(chambre || '');
  if (!connus[uid]) return { erreur: 'Personne inconnue' };
  var ecr = {}, plan = [];
  [['vis_travail', travail], ['vis_chambre', chambre]].forEach(function (c) {
    var v = c[1]; if (v && !connus[v]) return;
    if (v === uid) { plan.erreur = 'Un agent ne peut pas être son propre vis-à-vis'; return; }
    var cur = (carte[uid] || {})[c[0]] || ''; if (cur === v) return;
    var mod = { uid: uid }; mod[c[0]] = v; plan.push(mod);
    // réciprocité : posée chez le vis-à-vis seulement s'il n'en a pas déjà un ; le lien retiré chez lui aussi s'il pointait vers cet agent
    if (v) { if (!((carte[v] || {})[c[0]])) { var r = { uid: v }; r[c[0]] = uid; plan.push(r); } }
    else if (cur && (carte[cur] || {})[c[0]] === uid) { var r2 = { uid: cur }; r2[c[0]] = ''; plan.push(r2); }
  });
  [['vis_travail', travail], ['vis_chambre', chambre]].forEach(function (c) { if (c[1] && !connus[c[1]]) plan.erreur = 'Vis-à-vis inconnu'; });
  if (plan.erreur) return { erreur: plan.erreur };
  return { plan: plan };
}

function visavisListe_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).rh || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var carte = visavisCarte_(), niv = (typeof affNiveau_ === 'function') ? affNiveau_(u) : 0, personnes = [];
  Store.table('Utilisateurs').forEach(function (x) {
    if (String(x.actif) === '0' || !x.uid || !x.email) return;
    var l = carte[String(x.uid)] || {};
    personnes.push({ uid: String(x.uid), nom: Annuaire.nomAffichable(x.nom, x.email), fonction: x.fonction || '', service: String(x.service || '').replace(/\s+/g, ' ').trim(), dependance: x.dependance || '', telephone: x.telephone || '',
      vis_travail: l.vis_travail || '', vis_chambre: l.vis_chambre || '', modifiable: niv >= 3 || (niv >= 2 && affDansPortee_(u, x)) });
  });
  personnes.sort(function (a, b) { return a.nom < b.nom ? -1 : 1; });
  return { personnes: personnes };
}

function visavisEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); visavisPrets_();
  var c = Store.parUid(req.uid);
  if (!c || String(c.actif) === '0') throw new Error('Personne inconnue');
  if (affNiveau_(u) < 2 || !affDansPortee_(u, c)) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var connus = {}; Store.table('Utilisateurs').forEach(function (x) { if (x.uid && String(x.actif) !== '0') connus[String(x.uid)] = true; });
  var carte = visavisCarte_(), r = visavisPlan_(carte, c.uid, req.vis_travail, req.vis_chambre, connus);
  if (r.erreur) throw new Error(r.erreur);
  r.plan.forEach(function (m) {
    var v = {}; Object.keys(m).forEach(function (k) { if (k !== 'uid') v[k] = m[k]; });
    v.maj_par = u.email; v.maj_le = new Date().toISOString();
    Store.maj('VisAVis', { uid: m.uid }, v);
  });
  Store.journal('visavis', u.email, c.email + ' : travail=' + (req.vis_travail || '—') + ' chambre=' + (req.vis_chambre || '—'));
  return { enregistres: r.plan.length };
}
if (typeof module !== 'undefined') module.exports = { visavisPlan_: visavisPlan_ };
