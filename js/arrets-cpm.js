/**
 * Arrêts, reprises et prolongations (Suivi CPM) : mêmes règles que le script de la feuille (apps-script/cpm-sheet/SuiviCPM-complet.gs, analyserContrat).
 *   fin du contrat = fin initiale + jours d'arrêt (arrêt → reprise) + prolongations en jours (« 60 », « 15 j », « 2 mois » = 60 j), ou la plus tardive des « Fin après prolongation » si elle dépasse.
 * Le script de la feuille écrit DÉJÀ cette fin dans la colonne « Échéance » : quand l'échéance vient de la feuille, on ne la rallonge pas une seconde fois (inclus: true).
 * Un arrêt sans reprise = chantier à l'arrêt : le délai est figé à la date d'arrêt et le contrat n'est jamais « échu ».
 * Ce fichier est recopié À L'IDENTIQUE dans apps-script/gateway/ArretsCpm.gs (un test vérifie qu'ils ne divergent pas) : modifier les deux ensemble.
 */
(function (racine) {
  // <<arrets
  var JOUR = 864e5;
  function jours(a, b) { return Math.round((b.getTime() - a.getTime()) / JOUR); }
  function plus(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  /** Durée de prolongation → jours : 60 ; « 15 j » ; « 2 mois » (= 60, un mois = 30 jours comme dans la feuille). */
  function joursDe(v) {
    if (typeof v === 'number') return v > 0 ? Math.round(v) : 0;
    var t = String(v == null ? '' : v).trim().toLowerCase().replace(',', '.'), m = /(\d+(?:\.\d+)?)\s*([a-z]*)/.exec(t);
    if (!m) return 0;
    return Math.round(m[2].indexOf('m') === 0 ? Number(m[1]) * 30 : Number(m[1]));
  }
  /** « 25/03/2026 » ou « 2026-03-25 » (ou une Date) → Date locale à minuit, sinon null. */
  function lireDate(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
    var t = String(v == null ? '' : v).trim(), m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t), y, mo, d, i;
    if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; } else if ((i = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) { y = +i[1]; mo = +i[2]; d = +i[3]; } else return null;
    if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return new Date(y, mo - 1, d);
  }
  /** d = { arret1, reprise1, arret2, reprise2, prol1, prol2, fin1, fin2 } (textes de la feuille) → entrée pour analyser(). */
  function lireChamps(d, parse) {
    var lire = parse || lireDate;
    return {
      arrets: [1, 2].map(function (k) { return { arret: lire(d['arret' + k]), reprise: lire(d['reprise' + k]) }; }),
      prolongs: [d.prol1, d.prol2],
      fins: [lire(d.fin1), lire(d.fin2)]
    };
  }
  /**
   * entree = { echeance: Date, inclus: bool (true = échéance de la feuille, arrêts et prolongations déjà inclus), ods: Date|null, aujourdhui: Date, arrets: [{arret, reprise}], prolongs: [valeur], fins: [Date] }
   * → { joursArret, joursProlonges, enArret, arretDepuis, finInitiale, finEffective, pctDelai (null sans ods), joursRestants, arrets: [{arret, reprise, jours}] }
   */
  function analyser(entree) {
    var auj = entree.aujourdhui, ods = entree.ods || null, liste = [], total = 0, depuis = null, jp = 0, fin;
    (entree.arrets || []).forEach(function (x) {
      if (!x.arret) return;
      if (x.reprise && x.reprise.getTime() >= x.arret.getTime()) { var n = jours(x.arret, x.reprise); total += n; liste.push({ arret: x.arret, reprise: x.reprise, jours: n }); }
      else { depuis = x.arret; liste.push({ arret: x.arret, reprise: null, jours: 0 }); }
    });
    (entree.prolongs || []).forEach(function (v) { jp += joursDe(v); });
    var ech0 = entree.echeance || null, initiale = null;
    if (ech0) {
      if (entree.inclus) { fin = ech0; initiale = plus(ech0, -(total + jp)); }
      else { initiale = ech0; fin = plus(ech0, total + jp); }
      (entree.fins || []).forEach(function (f) { if (f && f.getTime() > fin.getTime()) fin = f; });
    }
    var pct = null, restants = null, repere = depuis && depuis.getTime() < auj.getTime() ? depuis : auj;   // à l'arrêt, le délai est figé à la date d'arrêt
    if (fin && ods) { var duree = jours(ods, fin); if (duree > 0) pct = Math.max(0, Math.min(100, Math.round((jours(ods, repere) / duree) * 100))); }
    if (fin) restants = jours(repere, fin);
    return { arrets: liste, joursArret: total, joursProlonges: jp, enArret: !!depuis, arretDepuis: depuis, finInitiale: initiale, finEffective: fin || null, pctDelai: pct, joursRestants: restants };
  }
  /** Texte d'information court (ou '') : « Arrêté depuis le … » / « Dont N j d'arrêt » / « Prolongé de N j ». */
  function mention(an) {
    var p = [];
    if (an.enArret) p.push('Arrêté depuis le ' + ('0' + an.arretDepuis.getDate()).slice(-2) + '/' + ('0' + (an.arretDepuis.getMonth() + 1)).slice(-2) + '/' + an.arretDepuis.getFullYear());
    if (an.joursArret > 0) p.push(an.joursArret + ' j d\'arrêt');
    if (an.joursProlonges > 0) p.push('prolongé de ' + an.joursProlonges + ' j');
    return p.length ? p.join(' · ') : '';
  }
  var API = { joursDe: joursDe, lireDate: lireDate, lireChamps: lireChamps, analyser: analyser, mention: mention };
  // arrets>>
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Arrets = API;
})(typeof window !== 'undefined' ? window : this);
