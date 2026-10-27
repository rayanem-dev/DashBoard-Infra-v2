/**
 * Tableau de bord de l'accueil : chiffres et séries pour les graphiques (action tableau_bord).
 *  - présence sur site (prises en charge hébergées), effectif des rapports journaliers par service, rapports du jour reçus / manquants,
 *    avancement contre délai écoulé des chantiers, état des contrats du Suivi CPM et échéances proches.
 * Partie PURE (testée en Node : test/tableaubord.test.js), puis l'assemblage (lecture seule : rien n'est écrit).
 */
var TB = (function () {
  /** Jours consécutifs de du à au (AAAA-MM-JJ). */
  function jours(du, au) {
    var out = [], d = new Date(du + 'T00:00:00Z'), f = new Date(au + 'T00:00:00Z');
    for (var i = 0; i < 400 && d <= f; i += 1) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
    return out;
  }
  var SERVICES = [['construction', 'Construction'], ['electromecanique', 'Électromécanique'], ['entretien', 'Travaux Entretien'], ['autre', 'Autres']];
  function cleService(s) {
    var t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/construction|genie civil/.test(t)) return 'construction'; if (/electrom/.test(t)) return 'electromecanique'; if (/entretien/.test(t)) return 'entretien'; return 'autre';
  }
  /** Effectif des rapports par jour et par service : { services: [{ id, nom }], jours: [{ date, total, par: { id: n } }] }. */
  function serieEffectif(rapports, listeJours, serviceDe) {
    var idx = {}, out = listeJours.map(function (d) { var o = { date: d, total: 0, par: {} }; SERVICES.forEach(function (s) { o.par[s[0]] = 0; }); idx[d] = o; return o; });
    (rapports || []).forEach(function (r) {
      var o = idx[r.date]; if (!o) return; var n = Number(r.effectif) || 0, k = cleService(serviceDe ? serviceDe(r) : r.service);
      o.par[k] += n; o.total += n;
    });
    return { services: SERVICES.map(function (s) { return { id: s[0], nom: s[1] }; }), jours: out };
  }
  /** Rapports du jour : { total, recus, manquants: [{ nom, service }] } d'après Rapports.synthese. */
  function rapportsDuJour(synth) {
    var ch = (synth && synth.chantiers) || [], util = ch.filter(function (c) { return !c.phase; });
    var recus = util.filter(function (c) { return c.rapports && c.rapports.length; }).length;
    return { total: util.length, recus: recus, manquants: util.filter(function (c) { return !(c.rapports && c.rapports.length); }).map(function (c) { return { nom: c.nom, service: c.service || '' }; }).slice(0, 12) };
  }
  /** Chantiers du tableau (Rapports.tableau) : avancement déclaré contre part du délai écoulée ; le plus en retard d'abord. */
  function avancementDelai(tableau, limite) {
    var l = (tableau || []).filter(function (c) { return typeof c.avancement === 'number' && typeof c.delai_pct === 'number'; }).map(function (c) {
      return { nom: c.nom, service: c.service || '', avancement: c.avancement, delai: c.delai_pct, retard: c.delai_pct - c.avancement };
    });
    l.sort(function (a, b) { return b.retard - a.retard; });
    return { chantiers: l.slice(0, limite || 10), en_retard: l.filter(function (c) { return c.retard > 15; }).length, suivis: l.length };
  }
  /** Échéances des contrats (jours restants entre 0 et `horizon`) d'après le tableau des chantiers. */
  function echeances(tableau, horizon) {
    return (tableau || []).filter(function (c) { return typeof c.jours_restants === 'number' && c.jours_restants >= 0 && c.jours_restants <= (horizon || 60); })
      .map(function (c) { return { nom: c.nom, entreprise: c.entreprise || '', echeance: c.echeance || '', jours: c.jours_restants }; }).sort(function (a, b) { return a.jours - b.jours; }).slice(0, 8);
  }
  var STATUTS = [['execution', 'En exécution'], ['attribue', 'Attribué'], ['encours', 'Dossier en cours'], ['nondemarre', 'Non démarré'], ['bloque', 'Bloqué'], ['echu', 'Échu'], ['infructueux', 'Infructueux'], ['autre', 'Autre']];
  function cleStatut(s) {
    var t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    if (!t) return ''; if (/infructu/.test(t)) return 'infructueux'; if (/execution/.test(t)) return 'execution'; if (/echu|termin/.test(t)) return 'echu'; if (/attribu/.test(t)) return 'attribue';
    if (/bloqu/.test(t)) return 'bloque'; if (/non demarr/.test(t)) return 'nondemarre'; if (/en cours/.test(t)) return 'encours'; return 'autre';
  }
  /** Répartition des dossiers du Suivi CPM par statut : [{ id, nom, n }] (statuts vides ignorés, seulement ceux qui existent). */
  function contratsParStatut(enr) {
    var n = {}; ((enr && enr.ordre) || []).forEach(function (cle) { var d = enr.dossiers[cle]; var k = d && cleStatut(d.statut); if (k) n[k] = (n[k] || 0) + 1; });
    return STATUTS.filter(function (s) { return n[s[0]]; }).map(function (s) { return { id: s[0], nom: s[1], n: n[s[0]] }; });
  }
  /** Présence par jour (total de prestataires hébergés) : calculer(date) → { total }. */
  function serieAvecFonction(listeJours, calculer) { return listeJours.map(function (d) { return { date: d, total: calculer(d).total }; }); }
  return { jours: jours, cleService: cleService, serieEffectif: serieEffectif, rapportsDuJour: rapportsDuJour, avancementDelai: avancementDelai, echeances: echeances, contratsParStatut: contratsParStatut, serieAvecFonction: serieAvecFonction, cleStatut: cleStatut };
})();
if (typeof module !== 'undefined') module.exports = TB;

/** Action « tableau_bord » : lecture seule ; chaque bloc n'est fourni que si le compte a accès au module concerné. */
function tableauBord_(req) {
  var u = Auth.userFromToken(req.token), a = acces_(u), auj = Dates.today(), res = { date: auj, blocs: {} };
  var chantiersOk = (a.pilotage || 0) >= 1 || (a.rapports || 0) >= 1;
  if (chantiersOk) {
    var rapports = rapportsLus_(), chantiers = chantiersActifs_(), enr = null;
    try { enr = cpmEnregistrements_(lignesSource_('cpm')); } catch (e) { enr = null; }
    var j14 = TB.jours(Dates.addDays(auj, -13), auj);
    res.blocs.effectif = TB.serieEffectif(rapports, j14, function (r) { return r.service || (chantiers.filter(function (c) { return c.id === r.chantier; })[0] || {}).service; });
    res.blocs.rapports_jour = TB.rapportsDuJour(Rapports.synthese(chantiers, rapports, auj));
    var tab = Rapports.tableau(chantiers, enr, rapports, auj);
    res.blocs.avancement = TB.avancementDelai(tab, 10); res.blocs.echeances = TB.echeances(tab, 60);
    if (enr) res.blocs.contrats = TB.contratsParStatut(enr);
  }
  if ((a.badges || 0) >= 1) {
    try {
      var sejours = presentsSejours_(presentsLireJournal_(), enqEntrepriseDe_, enqContratDe_), j30 = TB.jours(Dates.addDays(auj, -29), auj);
      var serie = TB.serieAvecFonction(j30, function (d) { return presentsCalculer_(sejours, d, {}); }), auj_ = presentsCalculer_(sejours, auj, {});
      res.blocs.presents = { total: auj_.total, serie: serie, entreprises: auj_.entreprises.map(function (g) { return { nom: g.entreprise, n: g.personnes.length }; }).sort(function (x, y) { return y.n - x.n; }).slice(0, 6) };
    } catch (e) { /* journal illisible : bloc absent */ }
  }
  return res;
}
