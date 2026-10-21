/**
 * Rubriques d'affichage du portail (7 familles de métiers), indépendantes des « modules » qui portent les DROITS.
 * Une carte est rangée d'après son titre ; une colonne « rubrique » du catalogue, si elle existe un jour, a la priorité (a.rubrique).
 * Rien ici ne donne ni ne retire un droit : on ne fait que regrouper les cartes que le menu autorise déjà.
 */
(function (racine) {
  var DEFS = [
    { id: 'pilotage', titre: 'Pilotage & chantiers', icone: '📈' },
    { id: 'marches', titre: 'Marchés & entreprises', icone: '📑' },
    { id: 'acces', titre: 'Accès site & sûreté', icone: '🚧' },
    { id: 'personnel', titre: 'Personnel', icone: '👥' },
    { id: 'logistique', titre: 'Logistique & moyens généraux', icone: '🚛' },
    { id: 'admin', titre: 'Administration & secrétariat', icone: '📨' },
    { id: 'it', titre: 'Informatique & accès', icone: '💻' }
  ];
  // [expression sur le titre sans accents ni majuscules, rubrique] — la première qui correspond l'emporte
  var REGLES = [
    [/prise.? en charge|autorisation d.acces|badge|enquete|bon de sortie/, 'acces'],
    [/statistiques sous|fiche d.evaluation|suivi cpm|dossiers cpm|passation des contrats|vivier/, 'marches'],
    [/rapport hebdomadaire|avancement chantiers|suivi chantier|taches journalieres|rapports journaliers|imputation/, 'pilotage'],
    [/organigramme|affectation du personnel|planning global|planning & rotations|simulation de planning|permanence|formation|visite medicale/, 'personnel'],
    [/veste en cuir|dotation|repas a emporter|ordre de travail|vehicule|requete transport|stock|inventaire|radio|commande de pieces/, 'logistique'],
    [/instances courriers|consignes|ordres de mission|documents administratifs|renommage/, 'admin'],
    [/annuaire|privileges|helpdesk|quarantaine/, 'it']
  ];
  // Mots que les agents tapent pour retrouver une carte (ajoutés à la recherche, jamais affichés)
  var MOTS = [
    [/prise.? en charge/, 'pec hebergement restauration macaron vehicule chambre'], [/badge/, 'carte acces prestataire'], [/documents administratifs/, 'imprime formulaire pret mutation sanction attestation conge avance mission'],
    [/renommage/, 'renommer fichier pdf scan photo jpg'], [/repas a emporter/, 'collation casse croute pause cafe'], [/dotation/, 'cafe eau vivres entretien repas'], [/simulation/, 'rotation relève releve reliquat vis a vis'],
    [/planning & rotations/, 'conge repos travail releve'], [/requete transport/, 'voiture bus navette deplacement'], [/commande de pieces/, 'piece rechange atelier'], [/suivi cpm|dossiers cpm/, 'marche contrat consultation'], [/ordres de mission/, 'odm deplacement']
  ];
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function defDe(id) { for (var i = 0; i < DEFS.length; i += 1) if (DEFS[i].id === id) return DEFS[i]; return null; }
  /** Rubrique (id) d'une carte : colonne du catalogue si valide, sinon d'après le titre ; null si inconnue (la carte reste alors sous son module). */
  function rubriqueDe(app) {
    if (app && app.rubrique && defDe(app.rubrique)) return app.rubrique;
    var t = norm(app && app.titre);
    for (var i = 0; i < REGLES.length; i += 1) if (REGLES[i][0].test(t)) return REGLES[i][1];
    return null;
  }
  function motsCles(app) { var t = norm(app && app.titre), m = []; MOTS.forEach(function (x) { if (x[0].test(t)) m.push(x[1]); }); return m.join(' '); }
  /**
   * Regroupe les cartes d'un menu (modules → rubriques). Les cartes sans rubrique reconnue restent dans une rubrique « Autres » placée à la fin,
   * avec le titre de leur module. Chaque carte n'apparaît qu'une fois (même adresse). Retourne [{ id, titre, icone, niveau: 0, apps }].
   */
  function regrouper(menu) {
    var par = {}, autres = {}, vus = {};
    (menu || []).forEach(function (m) {
      (m.apps || []).forEach(function (a) {
        var cle = String(a.url || a.titre); if (vus[cle]) return; vus[cle] = 1;
        var r = rubriqueDe(a), carte = {}; Object.keys(a).forEach(function (k) { carte[k] = a[k]; }); carte.mots = motsCles(a);
        if (r) (par[r] = par[r] || []).push(carte); else { carte.module_titre = m.titre; (autres[m.id] = autres[m.id] || { id: 'autres-' + m.id, titre: m.titre, icone: m.icone || '📁', niveau: 0, apps: [] }).apps.push(carte); }
      });
    });
    var out = DEFS.filter(function (d) { return par[d.id] && par[d.id].length; }).map(function (d) { return { id: d.id, titre: d.titre, icone: d.icone, niveau: 0, apps: par[d.id] }; });
    Object.keys(autres).forEach(function (k) { out.push(autres[k]); });
    return out;
  }
  var API = { definitions: DEFS, rubriqueDe: rubriqueDe, motsCles: motsCles, regrouper: regrouper };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Rubriques = API;
})(typeof window !== 'undefined' ? window : this);
