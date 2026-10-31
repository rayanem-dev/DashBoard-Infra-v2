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
  try { Store.table('VisAVis').forEach(function (r) { if (r.uid) m[String(r.uid)] = { vis_travail: String(r.vis_travail || ''), vis_chambre: String(r.vis_chambre || ''), prop_vis_travail: String(r.prop_vis_travail || ''), prop_vis_chambre: String(r.prop_vis_chambre || '') }; }); } catch (e) { /* onglet pas encore créé */ }
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
    if (v) {
      var autre = (carte[v] || {})[c[0]];
      if (!autre) { var r = { uid: v }; r[c[0]] = uid; plan.push(r); }
      else if (autre !== uid) { var rp = { uid: v }; rp['prop_' + c[0]] = uid; plan.push(rp); }   // il a déjà quelqu'un : il doit confirmer (accepter, garder l'actuel ou n'avoir aucun vis-à-vis)
    }
    if (cur && cur !== v) {   // l'ancien vis-à-vis perd son lien vers l'agent et toute proposition en attente venant de lui
      var anc = carte[cur] || {}, r2 = { uid: cur };
      if (anc[c[0]] === uid) r2[c[0]] = '';
      if (anc['prop_' + c[0]] === uid) r2['prop_' + c[0]] = '';
      if (Object.keys(r2).length > 1) plan.push(r2);
    }
  });
  [['vis_travail', travail], ['vis_chambre', chambre]].forEach(function (c) { if (c[1] && !connus[c[1]]) plan.erreur = 'Vis-à-vis inconnu'; });
  if (plan.erreur) return { erreur: plan.erreur };
  return { plan: plan };
}

/**
 * Réponse d'un agent à une proposition (un autre agent l'a choisi comme vis-à-vis alors qu'il en avait déjà un). PURE (testée en Node).
 * choix : 'accepter' (le proposant remplace l'actuel) · 'garder' (on garde l'actuel, le lien du proposant est retiré) · 'aucun' (plus de vis-à-vis du tout).
 */
function visavisReponse_(carte, uid, champ, choix) {
  var moi = carte[uid] || {}, p = moi['prop_' + champ];
  if (!p) return { erreur: 'Aucune proposition en attente.' };
  var valide = (carte[p] || {})[champ] === uid, actuel = moi[champ] || '', plan = [], propre = { uid: uid }; propre['prop_' + champ] = '';
  if (choix === 'accepter') {
    if (!valide) return { erreur: 'Cette proposition n\'est plus valable.' };
    propre[champ] = p;
    if (actuel && actuel !== p && (carte[actuel] || {})[champ] === uid) { var o = { uid: actuel }; o[champ] = ''; plan.push(o); }
  } else if (choix === 'aucun') {
    propre[champ] = '';
    if (actuel && (carte[actuel] || {})[champ] === uid) { var o2 = { uid: actuel }; o2[champ] = ''; plan.push(o2); }
    if (valide && p !== actuel) { var q = { uid: p }; q[champ] = ''; plan.push(q); }
  } else if (choix === 'garder') {
    if (valide) { var q2 = { uid: p }; q2[champ] = ''; plan.push(q2); }
  } else return { erreur: 'Choix inconnu.' };
  plan.unshift(propre);
  return { plan: plan };
}
/** Propositions en attente pour l'agent : [{ champ, uid, actuel }] (le proposant pointe toujours vers lui). */
function visavisPropositions_(carte, uid) {
  var out = [], moi = carte[uid] || {};
  ['vis_travail', 'vis_chambre'].forEach(function (c) { var p = moi['prop_' + c]; if (p && (carte[p] || {})[c] === uid) out.push({ champ: c, uid: p, actuel: moi[c] || '' }); });
  return out;
}

/**
 * Droit de lecture du listing / de l'organigramme : le module « rh » ou « simulation » niveau 2 ouvrent tout ; un agent (simulation niveau 1) ne voit que lui-même et ses vis-à-vis ; sinon refus.
 * Renvoie null (tout le monde) ou { uid: true }.
 */
function visibiliteListe_(u) {
  var a = acces_(u);
  if ((a.rh || 0) >= 1 || (a.simulation || 0) >= 2) return null;
  if ((a.simulation || 0) >= 1) return simuVisibles_(u);
  throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
}
function visavisListe_(req) {
  var u = Auth.userFromToken(req.token);
  var restreint = visibiliteListe_(u);   // null = tout le monde ; sinon { uid: true } (lui-même et ses vis-à-vis)
  var carte = visavisCarte_(), niv = (typeof affNiveau_ === 'function') ? affNiveau_(u) : 0, personnes = [];
  Store.table('Utilisateurs').forEach(function (x) {
    if (String(x.actif) === '0' || !x.uid || !x.email) return;
    if (restreint && !restreint[String(x.uid)]) return;
    var l = carte[String(x.uid)] || {};
    personnes.push({ uid: String(x.uid), nom: Annuaire.nomAffichable(x.nom, x.email), fonction: x.fonction || '', service: String(x.service || '').replace(/\s+/g, ' ').trim(), dependance: x.dependance || '', telephone: x.telephone || '',
      vis_travail: l.vis_travail || '', vis_chambre: l.vis_chambre || '', modifiable: niv >= 3 || (niv >= 2 && affDansPortee_(u, x)) });
  });
  personnes.sort(function (a, b) { return a.nom < b.nom ? -1 : 1; });
  return { personnes: personnes };
}

function visavisEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); visavisPrets_(); assurerColonnes_('VisAVis', ['prop_vis_travail', 'prop_vis_chambre']);
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

// ---------- Libre-service : chaque agent déclare SON vis-à-vis de travail, SON vis-à-vis de chambre et SA chambre ----------
function coordNorm_(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
/** Numéro / nom de chambre : 20 caractères (lettres, chiffres, espace, - / . #) ou vide. { valeur } ou { erreur }. */
function chambreValider_(x) {
  var v = String(x == null ? '' : x).replace(/\s+/g, ' ').trim();
  if (v.length > 20 || (v && !/^[A-Za-z0-9\u00C0-\u017F \-\/.#]+$/.test(v))) return { erreur: 'Chambre : 20 caractères au plus (lettres, chiffres, espace, - / . #).' };
  return { valeur: v };
}
/** Personnes que l'agent peut choisir comme vis-à-vis : tous les comptes actifs sauf lui ; un PRESTATAIRE ne choisit que parmi les gens de sa propre entreprise (même « dépendance »). */
function candidatsVisAVis_(moi, utilisateurs) {
  var presta = Droits.roleCanon(moi.role) === 'prestataire', ent = coordNorm_(moi.dependance);
  return utilisateurs.filter(function (x) {
    if (!x.uid || !x.email || String(x.actif) === '0' || String(x.uid) === String(moi.uid)) return false;
    return !presta || (!!ent && coordNorm_(x.dependance) === ent);
  });
}
/** Valeurs à porter dans BDDORGA : { chambre, vis_travail, vis_chambre } (noms) ; `lien` = { vis_travail, vis_chambre } (uid) et `nomDe` = uid → nom. */
function coordChamps_(chambre, lien, nomDe) {
  lien = lien || {};
  return { chambre: String(chambre || '').trim(), vis_travail: lien.vis_travail ? String(nomDe[lien.vis_travail] || '') : '', vis_chambre: lien.vis_chambre ? String(nomDe[lien.vis_chambre] || '') : '' };
}
function coordEmpreinte_(champs) { return [champs.chambre, champs.vis_travail, champs.vis_chambre].join('|'); }
/** Faut-il écrire dans BDDORGA ? Oui si l'empreinte a changé depuis la dernière écriture réussie (ou s'il y a quelque chose à écrire la première fois). */
function coordAEcrire_(champs, derniere) {
  var emp = coordEmpreinte_(champs), d = String(derniere || ''); if (d === '-') d = '||';   // « - » = tout effacé, déjà reporté
  if (emp === d) return false;
  return !!(champs.chambre || champs.vis_travail || champs.vis_chambre || d);
}

function coordLibreService_(u) {
  if (!optionActive_('planning.libre_service')) throw Object.assign(new Error('Cette fonction est désactivée par le secrétariat.'), { code: 'DROITS' });
  if ((acces_(u).planning || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
}
function visavisMoi_(req) {
  var u = Auth.userFromToken(req.token); visavisPrets_(); profilsPrets_(); assurerColonnes_('VisAVis', ['prop_vis_travail', 'prop_vis_chambre']);
  var actif = optionActive_('planning.libre_service'), tous = Store.table('Utilisateurs'), nomDe = {};
  tous.forEach(function (x) { if (x.uid) nomDe[String(x.uid)] = Annuaire.nomAffichable(x.nom, x.email); });
  var l = visavisCarte_()[String(u.uid)] || {}, o = profilDe_(u.email) || {};
  var cands = actif ? candidatsVisAVis_(u, tous).map(function (x) { return { uid: String(x.uid), nom: nomDe[String(x.uid)], fonction: x.fonction || '', service: String(x.service || '').replace(/\s+/g, ' ').trim() }; }) : [];
  cands.sort(function (a, b) { return a.nom < b.nom ? -1 : 1; });
  var props = visavisPropositions_(visavisCarte_(), String(u.uid)).map(function (x) { return { champ: x.champ, uid: x.uid, nom: nomDe[x.uid] || '', actuel: x.actuel, actuel_nom: nomDe[x.actuel] || '' }; });
  return { propositions: props, actif: actif, chambre: String(o.chambre || ''), vis_travail: l.vis_travail || '', vis_chambre: l.vis_chambre || '', candidats: cands, restreint: Droits.roleCanon(u.role) === 'prestataire' };
}
function visavisMoiEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); visavisPrets_(); profilsPrets_(); coordLibreService_(u); assurerColonnes_('VisAVis', ['prop_vis_travail', 'prop_vis_chambre']);
  var tous = Store.table('Utilisateurs'), cands = {}; candidatsVisAVis_(u, tous).forEach(function (x) { cands[String(x.uid)] = true; });
  var carte = visavisCarte_(), cur = carte[String(u.uid)] || {};
  var travail = req.vis_travail === undefined ? (cur.vis_travail || '') : String(req.vis_travail || ''), chambreV = req.vis_chambre === undefined ? (cur.vis_chambre || '') : String(req.vis_chambre || '');
  // un lien déjà en place (posé par le chef de service) reste valable même s'il sort de la liste proposée ; un nouveau lien doit venir de la liste
  if (travail && travail !== (cur.vis_travail || '') && !cands[travail]) throw new Error('Vis-à-vis de travail : personne non autorisée.');
  if (chambreV && chambreV !== (cur.vis_chambre || '') && !cands[chambreV]) throw new Error('Vis-à-vis de chambre : personne non autorisée.');
  var champs = { maj_le: new Date().toISOString() };
  if (req.chambre !== undefined) { var c = chambreValider_(req.chambre); if (c.erreur) throw new Error(c.erreur); champs.chambre = c.valeur; }
  var connus = {}; tous.forEach(function (x) { if (x.uid && String(x.actif) !== '0') connus[String(x.uid)] = true; });
  var r = visavisPlan_(carte, u.uid, travail, chambreV, connus);
  if (r.erreur) throw new Error(r.erreur);
  r.plan.forEach(function (m) {
    var v = {}; Object.keys(m).forEach(function (k) { if (k !== 'uid') v[k] = m[k]; });
    v.maj_par = u.email; v.maj_le = new Date().toISOString();
    Store.maj('VisAVis', { uid: m.uid }, v);
  });
  if (champs.chambre !== undefined || r.plan.length) { champs.coord_orga = ''; Store.maj('Profils', { email: String(u.email).toLowerCase() }, champs); }   // vide l'empreinte : BDDORGA sera mis à jour à la prochaine connexion
  Store.journal('visavis_moi', u.email, 'travail=' + (travail || '—') + ' chambre=' + (chambreV || '—') + (champs.chambre !== undefined ? ' n° chambre=' + (champs.chambre || '—') : ''));
  return visavisMoi_(req);
}
function visavisMoiRepondre_(req) {
  var u = Auth.userFromToken(req.token); visavisPrets_(); coordLibreService_(u);
  var champ = String(req.champ); if (champ !== 'vis_travail' && champ !== 'vis_chambre') throw new Error('Champ inconnu');
  var r = visavisReponse_(visavisCarte_(), String(u.uid), champ, String(req.choix));
  if (r.erreur) throw new Error(r.erreur);
  r.plan.forEach(function (m) {
    var v = {}; Object.keys(m).forEach(function (k) { if (k !== 'uid') v[k] = m[k]; });
    v.maj_par = u.email; v.maj_le = new Date().toISOString();
    Store.maj('VisAVis', { uid: m.uid }, v);
    var c = Store.parUid(m.uid); if (c && c.email) { try { Store.maj('Profils', { email: String(c.email).toLowerCase() }, { coord_orga: '' }); } catch (e) { /* profil absent */ } }   // BDDORGA mis à jour à leur prochaine connexion
  });
  Store.journal('visavis_reponse', u.email, champ + ' : ' + req.choix);
  return visavisMoi_(req);
}
/**
 * À la connexion : reporte dans BDDORGA le numéro de chambre et les vis-à-vis de l'agent s'ils ont changé depuis la dernière écriture réussie.
 * Ne bloque JAMAIS la connexion : toute erreur est seulement notée au journal et sera retentée à la connexion suivante.
 */
function coordSynchroniser_(u) {
  try {
    if (!optionActive_('planning.sync_bddorga')) return;
    profilsPrets_(); assurerColonnes_('Profils', ['chambre', 'coord_orga']);
    var o = profilDe_(u.email) || {}, tous = Store.table('Utilisateurs'), nomDe = {};
    tous.forEach(function (x) { if (x.uid) nomDe[String(x.uid)] = Annuaire.nomAffichable(x.nom, x.email); });
    var champs = coordChamps_(o.chambre, visavisCarte_()[String(u.uid)], nomDe);
    if (!coordAEcrire_(champs, o.coord_orga)) return;
    var n = ecrireDansBddorga_(u.email, champs, false, true);
    Store.maj('Profils', { email: String(u.email).toLowerCase() }, { coord_orga: coordEmpreinte_(champs) || '-' });
    Store.journal('coord_bddorga', u.email, n + ' cellule(s) écrite(s) dans BDDORGA (chambre, vis-à-vis)');
  } catch (err) { try { Store.journal('coord_bddorga_echec', u.email, String(err && err.message || err)); } catch (e2) { /* rien */ } }
}

/** Cellule CPM : rôle « cpm » ou service dont le nom contient « CPM » / « passation ». */
function estCpm_(x) { return Droits.roleCanon(x.role) === 'cpm' || /cpm|passation/i.test(String(x.service || '')); }
/**
 * Planning niveau 2 : qui l'utilisateur voit. Chef de service / intérim : les gens de SON service + la cellule CPM ;
 * rôle CPM : les gens de la cellule (son service et les membres CPM). Fonction pure (testée en Node) ; `moi` et `x` = { role, service }.
 */
function planningPortee_(moi, x) {
  var sv = function (s) { return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase(); };
  if (sv(moi.service) && sv(moi.service) === sv(x.service)) return true;
  return estCpm_(x);
}

if (typeof module !== 'undefined') module.exports = { visavisReponse_: visavisReponse_, visavisPropositions_: visavisPropositions_, estCpm_: estCpm_, planningPortee_: planningPortee_, visavisPlan_: visavisPlan_, chambreValider_: chambreValider_, candidatsVisAVis_: candidatsVisAVis_, coordChamps_: coordChamps_, coordEmpreinte_: coordEmpreinte_, coordAEcrire_: coordAEcrire_ };
