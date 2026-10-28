/**
 * Rubriques d'affichage du portail (7 familles de métiers), indépendantes des « modules » qui portent les DROITS.
 * Une carte est rangée d'après son titre ; une colonne « rubrique » du catalogue, si elle existe un jour, a la priorité (a.rubrique).
 * Rien ici ne donne ni ne retire un droit : on ne fait que regrouper les cartes que le menu autorise déjà.
 */
(function (racine) {
  var DEFS = [
    { id: 'pilotage', titre: 'Chantiers', icone: '📈' },
    { id: 'marches', titre: 'Marchés', icone: '📑' },
    { id: 'acces', titre: 'Accès site', icone: '🚧' },
    { id: 'personnel', titre: 'Personnel', icone: '👥' },
    { id: 'logistique', titre: 'Logistique', icone: '🚛' },
    { id: 'admin', titre: 'Admin', icone: '📨' },
    { id: 'it', titre: 'Informatique', icone: '💻' }
  ];
  // [expression sur le titre sans accents ni majuscules, rubrique] — la première qui correspond l'emporte
  var REGLES = [
    [/prise.? en charge|autorisation d.acces|badge|enquete|bon de sortie|habilitations|statistique sous.?traitants/, 'acces'],
    [/statistiques sous|fiche d.evaluation|suivi cpm|dossiers cpm|passation des contrats|vivier|benchmark/, 'marches'],
    [/rapport hebdomadaire|avancement chantiers|suivi chantier|taches journalieres|rapports journaliers|imputation|affectation chantier/, 'pilotage'],
    [/organigramme|feuille de pointage|affectation du personnel|planning global|planning & rotations|simulation de planning|permanence|formation|visite medicale/, 'personnel'],
    [/veste en cuir|dotation|repas a emporter|reservation|prise en charge hotel|ordre de travail|gaz.?oil|vehicule|requete transport|requete de transport|stock|inventaire|radio|commande de pieces/, 'logistique'],
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
  function rubriqueDe(app, defs) {
    defs = defs || DEFS; var ex = function (id) { return defs.some(function (d) { return d.id === id; }); };
    if (app && app.rubrique && ex(app.rubrique)) return app.rubrique;
    var t = norm(app && app.titre);
    for (var i = 0; i < REGLES.length; i += 1) if (REGLES[i][0].test(t) && ex(REGLES[i][1])) return REGLES[i][1];
    return null;
  }
  function motsCles(app) { var t = norm(app && app.titre), m = []; MOTS.forEach(function (x) { if (x[0].test(t)) m.push(x[1]); }); return m.join(' '); }
  /**
   * Regroupe les cartes d'un menu (modules → rubriques). Les cartes sans rubrique reconnue restent dans une rubrique « Autres » placée à la fin,
   * avec le titre de leur module. Chaque carte n'apparaît qu'une fois (même adresse). Retourne [{ id, titre, icone, niveau: 0, apps }].
   * config = catégories choisies par le secrétariat [{ id, titre, icone }] dans l'ordre (vide : catégories d'origine) ; une carte porte son `ordre` (nombre) pour se placer dans sa catégorie.
   */
  function regrouper(menu, config) {
    var defs = config && config.length ? config : DEFS;
    var par = {}, autres = {}, vus = {};
    (menu || []).forEach(function (m) {
      (m.apps || []).forEach(function (a) {
        var cle = String(a.url || a.titre); if (vus[cle]) return; vus[cle] = 1;
        var r = rubriqueDe(a, defs), carte = {}; Object.keys(a).forEach(function (k) { carte[k] = a[k]; }); carte.mots = motsCles(a);
        if (r) (par[r] = par[r] || []).push(carte); else { carte.module_titre = m.titre; (autres[m.id] = autres[m.id] || { id: 'autres-' + m.id, titre: m.titre, icone: m.icone || '📁', niveau: 0, apps: [] }).apps.push(carte); }
      });
    });
    var rang = function (a) { return typeof a.ordre === 'number' ? a.ordre : 1e9; };
    var out = defs.filter(function (d) { return (par[d.id] && par[d.id].length) || (config && config.length); }).map(function (d) {
      var l = (par[d.id] || []).map(function (a, i) { return { a: a, i: i }; }).sort(function (x, y) { return rang(x.a) - rang(y.a) || x.i - y.i; }).map(function (x) { return x.a; });
      return { id: d.id, titre: d.titre, icone: d.icone || '📁', niveau: 0, apps: l };
    });
    Object.keys(autres).forEach(function (k) { out.push(autres[k]); });
    return out;
  }
  var API = { definitions: DEFS, defs: function (config) { return config && config.length ? config : DEFS; }, rubriqueDe: rubriqueDe, motsCles: motsCles, regrouper: regrouper };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Rubriques = API;
})(typeof window !== 'undefined' ? window : this);
