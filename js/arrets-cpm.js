/**
 * Arrêts et reprises de chantier (Suivi CPM) : jours d'arrêt, nouvelle fin de contrat, part du délai consommée SANS les jours d'arrêt.
 * Colonnes du Suivi CPM lues par les pages et la passerelle : « Date arrêt 1 », « Date reprise 1 », « Date arrêt 2 », « Date reprise 2 », « Prolongation 1/2 » (jours d'arrêt), « Fin après prolongation 1/2 ».
 * Deux façons de renseigner un arrêt (au choix, par arrêt) :
 *   • date d'arrêt + DATE de reprise → la durée est calculée ;
 *   • date d'arrêt + DURÉE (colonne Prolongation, de préférence en JOURS ; « 2 mois » est aussi compris) → la date de reprise est calculée.
 * Sans reprise ni durée, le chantier est « arrêté en cours » : les jours d'arrêt courent jusqu'à aujourd'hui. Une « Fin après prolongation » saisie dans le fichier l'emporte sur le calcul.
 * Ce fichier est recopié À L'IDENTIQUE dans apps-script/gateway/ArretsCpm.gs (un test vérifie qu'ils ne divergent pas) : modifier les deux ensemble.
 */
(function (racine) {
  // <<arrets
  var JOUR = 864e5;
  function jours(a, b) { return Math.round((b.getTime() - a.getTime()) / JOUR); }
  function plus(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function plusMois(d, n) { var x = new Date(d.getTime()), j = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() !== j) x.setDate(0); return x; }
  /** « 45 », « 45 j », « 45 jours » → { jours: 45 } ; « 2 mois » → { mois: 2 } ; sinon null. */
  function lireDuree(t) {
    var s = String(t == null ? '' : t).trim().toLowerCase().replace(',', '.'), m;
    if (!s) return null;
    if ((m = /^(\d+(?:\.\d+)?)\s*(?:m|mois)$/.exec(s))) return Number(m[1]) > 0 ? { mois: Number(m[1]) } : null;
    if ((m = /^(\d+(?:\.\d+)?)\s*(?:j|jr|jrs|jour|jours)?$/.exec(s))) return Number(m[1]) > 0 ? { jours: Math.round(Number(m[1])) } : null;
    return null;
  }
  /**
   * entree = { echeance: Date (fin du contrat avant arrêts), ods: Date|null, aujourdhui: Date, arrets: [{ arret: Date|null, reprise: Date|null, duree: texte|nombre, fin: Date|null }] }
   * → { arrets: [{ arret, reprise, jours, enCours }], joursArret (arrêts décomptés au total), joursArretEcoules (déjà écoulés aujourd'hui), enArret, arretDepuis, finEffective, pctDelai (null si ods manquante), joursRestants }
   */
  function analyser(entree) {
    var auj = entree.aujourdhui, ech0 = entree.echeance, ods = entree.ods || null, liste = [], total = 0, ecoules = 0, enArret = false, depuis = null, finFichier = null;
    (entree.arrets || []).forEach(function (x) {
      if (x.fin && (!finFichier || x.fin.getTime() > finFichier.getTime())) finFichier = x.fin;
      if (!x.arret) return;
      var a = x.arret, r = x.reprise && x.reprise.getTime() > a.getTime() ? x.reprise : null, d = null, nb = 0, encours = false;
      if (!r) {
        d = lireDuree(x.duree);
        if (d) r = d.mois ? plusMois(a, d.mois) : plus(a, d.jours);
      }
      if (r) nb = jours(a, r); else { encours = true; nb = Math.max(0, jours(a, auj)); }
      var ecoule = encours ? nb : Math.max(0, Math.min(nb, jours(a, auj)));
      total += nb; ecoules += ecoule;
      if (encours) { enArret = true; depuis = a; }
      liste.push({ arret: a, reprise: r, jours: nb, enCours: encours });
    });
    var fin = ech0 ? plus(ech0, total) : null;
    if (finFichier && ech0 && finFichier.getTime() >= ech0.getTime()) fin = finFichier;   // la « Fin après prolongation » du fichier l'emporte
    var pct = null, restants = null;
    if (ech0 && ods) {
      var duree = jours(ods, ech0);
      if (duree > 0) pct = Math.max(0, Math.min(100, Math.round(((jours(ods, auj) - ecoules) / duree) * 100)));
    }
    if (fin) restants = jours(auj, fin);
    return { arrets: liste, joursArret: total, joursArretEcoules: ecoules, enArret: enArret, arretDepuis: depuis, finEffective: fin, pctDelai: pct, joursRestants: restants };
  }
  /** « 25/03/2026 » ou « 2026-03-25 » (ou une Date) → Date locale à minuit, sinon null. */
  function lireDate(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
    var t = String(v == null ? '' : v).trim(), m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t), y, mo, d, i;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; } else if ((i = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) { y = +i[1]; mo = +i[2]; d = +i[3]; } else return null;
    if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(y, mo - 1, d);
  }
  /** d = { arret1, reprise1, prol1, fin1, arret2, reprise2, prol2, fin2 } (textes de la feuille) → liste pour analyser(). */
  function lireArrets(d, parse) {
    var lire = parse || lireDate;
    return [1, 2].map(function (k) { return { arret: lire(d['arret' + k]), reprise: lire(d['reprise' + k]), duree: d['prol' + k], fin: lire(d['fin' + k]) }; });
  }
  var API = { lireDuree: lireDuree, lireDate: lireDate, lireArrets: lireArrets, analyser: analyser };
  // arrets>>
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Arrets = API;
})(typeof window !== 'undefined' ? window : this);
