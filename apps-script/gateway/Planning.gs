/**
 * Planning : situation d'une personne (en travail / en repos, depuis quand, jours restants, prochain changement)
 * et grille globale. Fonctions PURES (testées en Node : test/planning.test.js), s'appuient sur le moteur de Sijil (Cycle, Dates).
 *
 * Une rotation = { statut: 'T'|'R', depuis: 'AAAA-MM-JJ', jours_travail, jours_repos } : « je suis en <statut> depuis <date>,
 * premier jour de ma période en cours ». Le moteur enchaîne ensuite T, R, T… tout seul. Des corrections (pointages réels) peuvent
 * s'y ajouter plus tard : [{ date, statut: 'T'|'R'|'ABS' }].
 */
var Planning = (function () {
  function timeline(rot, corrections) {
    var tl = new Map();
    tl.set(rot.depuis, rot.statut);
    (corrections || []).forEach(function (c) { if (Dates.isDate(c.date)) tl.set(c.date, c.statut); });
    return tl;
  }
  function params(rot) { return { jours_travail: Number(rot.jours_travail), jours_repos: Number(rot.jours_repos) }; }

  function statutDu(tl, fc, d) { return tl.get(d) || fc.get(d) || ''; }

  /** Situation à la date `aujourdhui`. null si la rotation est invalide. */
  function situation(rot, corrections, aujourdhui) {
    var err = valider(rot, aujourdhui, true); if (err) return null;
    var p = params(rot); var tl = timeline(rot, corrections);
    if (aujourdhui < rot.depuis) return { avant: true, debut: rot.depuis };
    var info = Cycle.dayInfo(tl, p, aujourdhui);
    if (!info) return null;
    var fc = Cycle.forecastOf(tl, p, aujourdhui);
    // Début de la période en cours : on remonte tant que le statut est identique.
    var debut = aujourdhui;
    while (debut > rot.depuis && statutDu(tl, fc, Dates.addDays(debut, -1)) === info.status) debut = Dates.addDays(debut, -1);
    var total = info.status === 'T' ? p.jours_travail : info.status === 'R' ? p.jours_repos : 0;
    return {
      statut: info.status, depuis: debut, jour: Dates.diffDays(debut, aujourdhui) + 1, total: total,
      restants: info.remaining, prochain: info.change ? { date: info.change, statut: info.changeStatus } : null,
      prevu: !!info.prevu
    };
  }

  /** Lettres pour `n` jours à partir de `debut` : T, R, A (absence), « . » = avant le début de la rotation. */
  function grille(rot, corrections, debut, n) {
    var p = params(rot); var tl = timeline(rot, corrections);
    var fin = Dates.addDays(debut, n);
    var fc = Cycle.forecastOf(tl, p, fin);
    var out = '';
    for (var i = 0; i < n; i += 1) {
      var s = statutDu(tl, fc, Dates.addDays(debut, i));
      out += s === 'T' ? 'T' : s === 'R' ? 'R' : s === 'ABS' ? 'A' : '.';
    }
    return out;
  }

  /** Message d'erreur ou ''. `tolererFutur` : pour recalculer sans refuser une rotation déjà enregistrée. */
  function valider(rot, aujourdhui, tolererFutur) {
    if (!rot || (rot.statut !== 'T' && rot.statut !== 'R')) return 'Indiquez si vous êtes en travail ou en repos';
    if (!Dates.isDate(rot.depuis)) return 'Date invalide';
    if (!tolererFutur && rot.depuis > aujourdhui) return 'La date ne peut pas être dans le futur';
    if (!tolererFutur && Dates.diffDays(rot.depuis, aujourdhui) > 400) return 'Date trop ancienne (400 jours maximum)';
    var jt = Number(rot.jours_travail), jr = Number(rot.jours_repos);
    if (!(jt >= 1 && jt <= 90 && Math.floor(jt) === jt) || !(jr >= 1 && jr <= 90 && Math.floor(jr) === jr)) return 'Rotation invalide (1 à 90 jours)';
    return '';
  }

  return { situation: situation, grille: grille, valider: valider };
})();

if (typeof module !== 'undefined') module.exports = Planning;
