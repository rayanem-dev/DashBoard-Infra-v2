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
  // ----- statistiques des rapports journaliers (semaine = samedi → vendredi, comme le rapport hebdomadaire du CPM) -----
  function plus(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function debutSemaine(iso) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7)); return d.toISOString().slice(0, 10); }
  function bornesSemaines(auj, nb) {   // la semaine en cours en dernier ; `nb` semaines au total
    var cur = debutSemaine(auj), out = [];
    for (var i = nb - 1; i >= 0; i -= 1) { var d = plus(cur, -7 * i); out.push({ debut: d, fin: plus(d, 6) }); }
    return out;
  }
  function moy(a) { return a.length ? a.reduce(function (n, x) { return n + x; }, 0) / a.length : 0; }
  function arr1(x) { return Math.round(x * 10) / 10; }
  /**
   * Rapports reçus par jour et par semaine : { semaines: [{ debut, fin, rapports, joursActifs, parJourActif, difficultes, effectifMoyen, enCours }], jours: [{ date, n, semaine }] }.
   * effectifMoyen = effectif moyen déclaré par jour d'activité (somme des chantiers un jour donné). Les jours de la semaine en cours après `auj` sont omis.
   */
  function rapportsParSemaine(rapports, auj, nb) {
    var sem = bornesSemaines(auj, nb || 4), debut0 = sem[0].debut, parJour = {}, effJour = {}, diff = {};
    (rapports || []).forEach(function (r) {
      if (!r.date || r.date < debut0 || r.date > auj) return;
      parJour[r.date] = (parJour[r.date] || 0) + 1; effJour[r.date] = (effJour[r.date] || 0) + (Number(r.effectif) || 0);
      if (String(r.difficultes || '').trim()) diff[r.date] = (diff[r.date] || 0) + 1;
    });
    var jours = [];
    sem.forEach(function (w, i) {
      var actifs = 0, n = 0, d = 0, effs = [];
      for (var k = 0; k < 7; k += 1) {
        var j = plus(w.debut, k); if (j > auj) break;
        jours.push({ date: j, n: parJour[j] || 0, semaine: i });
        if (parJour[j]) { actifs += 1; n += parJour[j]; effs.push(effJour[j]); }
        d += diff[j] || 0;
      }
      w.rapports = n; w.joursActifs = actifs; w.parJourActif = actifs ? arr1(n / actifs) : 0; w.difficultes = d; w.effectifMoyen = arr1(moy(effs)); w.enCours = i === sem.length - 1;
    });
    return { semaines: sem, jours: jours };
  }
  /** Classement des rapporteurs sur [du, au] : [{ nom, rapports, jours, chantiers, dernier }], le plus régulier d'abord ; total = nombre de rapporteurs. */
  function classementRapporteurs(rapports, du, au, limite) {
    var par = {}, ordre = [];
    (rapports || []).forEach(function (r) {
      if (!r.date || r.date < du || r.date > au) return;
      var k = String(r.auteur_email || r.auteur_nom || '').toLowerCase(); if (!k) return;
      var o = par[k]; if (!o) { o = par[k] = { nom: r.auteur_nom || r.auteur_email, rapports: 0, d: {}, c: {}, dernier: '' }; ordre.push(k); }
      o.rapports += 1; o.d[r.date] = 1; o.c[String(r.chantier || '')] = 1; if (r.date > o.dernier) o.dernier = r.date;
    });
    var l = ordre.map(function (k) { var o = par[k]; return { nom: o.nom, rapports: o.rapports, jours: Object.keys(o.d).length, chantiers: Object.keys(o.c).length, dernier: o.dernier }; });
    l.sort(function (a, b) { return (b.rapports - a.rapports) || (b.jours - a.jours) || String(a.nom).localeCompare(String(b.nom), 'fr'); });
    return { total: l.length, rapporteurs: l.slice(0, limite || 8) };
  }
  /**
   * Ouvriers (effectif déclaré) par chantier et par semaine : valeur = effectif moyen par jour rapporté de la semaine ; les chantiers les plus fournis (4 semaines) d'abord.
   * { semaines: [{ debut, fin }], chantiers: [{ id, nom, service, valeurs: [n par semaine], moyenne }], max }
   */
  function effectifParChantier(rapports, chantiers, auj, nb, limite) {
    var sem = bornesSemaines(auj, nb || 4), nom = {}, svc = {}, cum = {};
    (chantiers || []).forEach(function (c) { nom[String(c.id).toLowerCase()] = c.nom || c.id; svc[String(c.id).toLowerCase()] = c.service || ''; });
    (rapports || []).forEach(function (r) {
      if (!r.date || r.date < sem[0].debut || r.date > auj) return;
      var k = String(r.chantier || '').toLowerCase(), w = -1; sem.forEach(function (x, i) { if (r.date >= x.debut && r.date <= x.fin) w = i; }); if (w < 0 || !k) return;
      var c = cum[k] = cum[k] || { jours: sem.map(function () { return {}; }) }; c.jours[w][r.date] = (c.jours[w][r.date] || 0) + (Number(r.effectif) || 0);
    });
    var l = Object.keys(cum).map(function (k) {
      var v = cum[k].jours.map(function (j) { return arr1(moy(Object.keys(j).map(function (d) { return j[d]; }))); });
      return { id: k, nom: nom[k] || k, service: svc[k] || '', valeurs: v, moyenne: arr1(moy(v.filter(function (x) { return x > 0; }))) };
    }).filter(function (c) { return c.moyenne > 0; });
    l.sort(function (a, b) { return b.moyenne - a.moyenne; });
    l = l.slice(0, limite || 6);
    return { semaines: sem, chantiers: l, max: Math.max.apply(null, l.map(function (c) { return Math.max.apply(null, c.valeurs); }).concat([1])) };
  }
  /** Suivi de la saisie : chantiers sans rapport depuis `seuil` jours (ou jamais dans la fenêtre) et difficultés signalées sur les `jours` derniers jours. */
  function suiviSaisie(rapports, chantiers, auj, seuil, jours) {
    var dernier = {}, diff = {}, depuis = plus(auj, -((jours || 14) - 1));
    (rapports || []).forEach(function (r) {
      var k = String(r.chantier || '').toLowerCase(); if (!k || !r.date || r.date > auj) return;
      if (!dernier[k] || r.date > dernier[k]) dernier[k] = r.date;
      if (r.date >= depuis && String(r.difficultes || '').trim()) { var d = diff[k] = diff[k] || { n: 0, date: '', texte: '' }; d.n += 1; if (r.date >= d.date) { d.date = r.date; d.texte = String(r.difficultes).trim().slice(0, 140); } }
    });
    var ut = (chantiers || []).filter(function (c) { return !c.phase; }), dj = function (a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); };
    var silencieux = ut.map(function (c) { var k = String(c.id).toLowerCase(), d = dernier[k]; return { nom: c.nom, service: c.service || '', dernier: d || '', jours: d ? dj(d, auj) : null }; })
      .filter(function (c) { return c.jours === null || c.jours >= (seuil || 3); }).sort(function (a, b) { return (b.jours === null ? 9999 : b.jours) - (a.jours === null ? 9999 : a.jours); });
    var nomDe = {}; ut.forEach(function (c) { nomDe[String(c.id).toLowerCase()] = c.nom; });
    var difficultes = Object.keys(diff).map(function (k) { return { nom: nomDe[k] || k, n: diff[k].n, date: diff[k].date, texte: diff[k].texte }; }).sort(function (a, b) { return (b.n - a.n) || (a.date < b.date ? 1 : -1); });
    return { silencieux: silencieux.slice(0, 8), nbSilencieux: silencieux.length, difficultes: difficultes.slice(0, 6), nbDifficultes: difficultes.reduce(function (n, d) { return n + d.n; }, 0), suivis: ut.length };
  }
  /** Présence par jour (total de prestataires hébergés) : calculer(date) → { total }. */
  function serieAvecFonction(listeJours, calculer) { return listeJours.map(function (d) { return { date: d, total: calculer(d).total }; }); }
  return { cleStatut: cleStatut, debutSemaine: debutSemaine, rapportsParSemaine: rapportsParSemaine, classementRapporteurs: classementRapporteurs, effectifParChantier: effectifParChantier, suiviSaisie: suiviSaisie, jours: jours, cleService: cleService, serieEffectif: serieEffectif, rapportsDuJour: rapportsDuJour, avancementDelai: avancementDelai, echeances: echeances, contratsParStatut: contratsParStatut, serieAvecFonction: serieAvecFonction, cleStatut: cleStatut };
})();
if (typeof module !== 'undefined') module.exports = TB;

/** Action « tableau_bord » : lecture seule ; chaque bloc n'est fourni que si le compte a accès au module concerné. */
function tableauBord_(req) {
  var u = Auth.userFromToken(req.token), a = acces_(u), auj = Dates.today(), res = { date: auj, blocs: {} };
  var chantiersOk = (a.pilotage || 0) >= 1 || (a.rapports || 0) >= 1, enr = null;
  try { enr = cpmEnregistrements_(lignesSource_('cpm')); } catch (e) { enr = null; }
  // Échéance des fiches d'évaluation (carte visible du 22 à la fin du mois) : indépendante des rapports, selon l'accès à l'application « Fiche d'évaluation »
  try { var fe = fichesEvalBloc_(u, a, auj, enr); if (fe) res.blocs.fiches_eval = fe; } catch (e) { /* sans cette carte, le reste du tableau de bord s'affiche quand même */ }
  if (chantiersOk) {
    var rapports = rapportsLus_(), chantiers = chantiersActifs_();
    var j14 = TB.jours(Dates.addDays(auj, -13), auj);
    res.blocs.effectif = TB.serieEffectif(rapports, j14, function (r) { return r.service || (chantiers.filter(function (c) { return c.id === r.chantier; })[0] || {}).service; });
    res.blocs.rapports_jour = TB.rapportsDuJour(Rapports.synthese(chantiers, rapports, auj));
    var tab = Rapports.tableau(chantiers, enr, rapports, auj);
    res.blocs.avancement = TB.avancementDelai(tab, 10); res.blocs.echeances = TB.echeances(tab, 60);
    if (enr) res.blocs.contrats = TB.contratsParStatut(enr);
    // Statistiques des rapports journaliers : mêmes droits de lecture que la liste des rapports (le périmètre du compte) et réglage « Paramètres » (option stats.rapports)
    var niv = a.rapports || 0;
    if (niv >= 1 && optionPermise_(u, 'stats.rapports')) {
      var voitTout = Rapports.peutCorriger(u, Droits.roleCanon(u.role)), debut = Dates.addDays(auj, -34);
      var vus = Rapports.filtrer(rapports, u, voitTout ? 3 : niv, { du: debut, au: auj }), chs = (voitTout || niv >= 3 ? chantiers : Rapports.chantiersVisibles(chantiers, u, niv)).map(function (c) { return { id: c.id, nom: Rapports.etiquette(c), service: c.service, phase: c.phase }; });
      res.blocs.rapports_semaines = TB.rapportsParSemaine(vus, auj, 4);
      res.blocs.effectif_chantiers = TB.effectifParChantier(vus, chs, auj, 4, 6);
      res.blocs.suivi_saisie = TB.suiviSaisie(vus, chs, auj, 3, 14);
      if (voitTout || niv >= 3) res.blocs.classement = TB.classementRapporteurs(vus, Dates.addDays(auj, -29), auj, 8);   // noms des agents : responsables seulement
    }
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
