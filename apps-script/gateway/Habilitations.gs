/**
 * Fichier des habilitations (« Enquêtes administratives ») : extraction en vrac, personne par personne, avec choix des colonnes côté écran.
 * Colonnes courantes : droit Badges (lecture) ; colonnes personnelles (naissance, adresse, NIN, téléphone…) : droit Badges niveau 2 (saisie), comme la fiche d'une personne.
 * Lecture seule.
 */
var HAB_COLONNES_ = [
  { id: 'entreprise', l: 'Entreprise' }, { id: 'contrat', l: 'Contrat (onglet)' }, { id: 'nom', l: 'Nom' }, { id: 'prenom', l: 'Prénom' }, { id: 'fonction', l: 'Fonction' }, { id: 'structure', l: 'Structure' },
  { id: 'date_pec', l: 'Date de prise en charge' }, { id: 'base', l: 'Base d\'hébergement' }, { id: 'nomAr', l: 'Nom en arabe' }, { id: 'prenomAr', l: 'Prénom en arabe' },
  { id: 'naiss', l: 'Date de naissance', sensible: true }, { id: 'lieu', l: 'Lieu de naissance', sensible: true }, { id: 'pere', l: 'Père', sensible: true }, { id: 'mere', l: 'Mère', sensible: true },
  { id: 'adresse', l: 'Adresse', sensible: true }, { id: 'embauche', l: 'Date d\'embauche', sensible: true }, { id: 'nin', l: 'NIN', sensible: true }, { id: 'acte', l: 'N° acte de naissance', sensible: true }, { id: 'tel', l: 'Téléphone', sensible: true }
];
/** Pur (testé en Node) : colonnes visibles selon le niveau, lignes réduites à ces colonnes. */
function habColonnesVisibles_(niveau) { return HAB_COLONNES_.filter(function (c) { return !c.sensible || niveau >= 2; }); }
function habLigne_(lignes, i, col, cd, cb, a, p) {
  var l = lignes[i] || [], v = function (x) { return x >= 0 ? Badges.vide(l[x]) : ''; }, parts = String(a.onglet || '').split(' · ');
  return { entreprise: a.entreprise, contrat: parts.length > 1 ? parts.slice(1).join(' · ') : '', nom: p.nom, prenom: p.prenom, fonction: p.fonction, structure: p.structure, date_pec: cd >= 0 ? presentsDate_(l[cd]) : '', base: v(cb),
    nomAr: p.nomAr, prenomAr: p.prenomAr, naiss: v(col.naiss), lieu: v(col.lieu), pere: v(col.pere), mere: v(col.mere), adresse: v(col.adresse), embauche: v(col.embauche), nin: v(col.nin), acte: v(col.acte), tel: v(col.tel) };
}
function habilitationsDonnees_(req) {
  var u = badgesDroit_(req, 1), niveau = acces_(u).badges || 0, ok = habColonnesVisibles_(niveau), rows = [], ents = {}, onglets = [];
  enqClasseur_().getSheets().forEach(function (sh) {
    var lignes = sh.getDataRange().getDisplayValues(), a = Badges.analyserEnquetes(lignes, sh.getName());
    if (a.erreur || !a.personnes.length) return;
    var col = Badges.colonnesEnquetes(lignes), cd = enqColDate_(lignes, col), cb = enqColBase_(lignes, col);
    onglets.push({ onglet: sh.getName(), entreprise: a.entreprise, nb: a.personnes.length });
    a.personnes.forEach(function (p) { var r = habLigne_(lignes, p.ligne - 1, col, cd, cb, a, p), o = {}; ok.forEach(function (c) { o[c.id] = r[c.id] || ''; }); rows.push(o); ents[a.entreprise] = true; });
  });
  return { colonnes: ok.map(function (c) { return { id: c.id, libelle: c.l, sensible: !!c.sensible }; }), lignes: rows, entreprises: Object.keys(ents).sort(), onglets: onglets, niveau: niveau, peut_exporter: exportAutorise_(u), fichier_url: exportAutorise_(u) ? enqClasseur_().getUrl() : '' };
}
/**
 * Personnes des Enquêtes administratives (nom, prénom, fonction, structure, entreprise) pour préremplir « Ajouter un utilisateur » dans la Gestion des privilèges :
 * aucune donnée personnelle sensible (ni naissance, NIN, adresse, téléphone). Réservé à qui peut ajouter un compte ; liste gardée 10 minutes en mémoire.
 */
function enquetesPersonnes_(req) {
  admin_(req);
  var cache = CacheService.getScriptCache(), c = null; try { c = cache.get('ENQ_PERSONNES'); } catch (e) { c = null; }
  if (c) { try { return { personnes: JSON.parse(c) }; } catch (e) { /* recalcul */ } }
  var out = [];
  enqClasseur_().getSheets().forEach(function (sh) {
    var a = Badges.analyserEnquetes(sh.getDataRange().getDisplayValues(), sh.getName()); if (a.erreur) return;
    a.personnes.forEach(function (p) { if (p.nom || p.prenom) out.push([p.nom || '', p.prenom || '', p.fonction || '', p.structure || '', a.entreprise || '']); });
  });
  try { var j = JSON.stringify(out); if (j.length < 95000) cache.put('ENQ_PERSONNES', j, 600); } catch (e) { /* trop gros : pas de cache */ }
  return { personnes: out };
}
if (typeof module !== 'undefined') module.exports = { habColonnesVisibles_: habColonnesVisibles_ };
