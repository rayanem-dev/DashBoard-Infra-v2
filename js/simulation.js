/**
 * Simulation de modification de planning — moteur PUR, partagé par le navigateur (simulation.html, js/simulation.js) et la passerelle
 * (copié en apps-script/gateway/Simulation.gs par le workflow de déploiement ; testé en Node : test/simulation.test.js).
 *
 * Modèle d'une modification :
 *   { debut: 'AAAA-MM-JJ', periodes: [{ type: 'T'|'R', jours: n }, ...], reprise: 'T'|'R' }
 * Les périodes s'enchaînent à partir de `debut` ; le lendemain de la dernière, la rotation habituelle (jours_travail / jours_repos de l'agent)
 * reprend par une période de type `reprise`. Une grille = chaîne de lettres T (travail), R (repos), « . » (hors rotation), un jour par lettre.
 *
 * Une modification APPROUVÉE s'applique au planning officiel sous forme de « corrections » (un pointage T/R par jour modifié + le jour de reprise),
 * que le moteur de Sijil (Cycle.simulate) sait déjà traiter : voir corrections().
 *
 * Aucune dépendance (ni Dates, ni Cycle) : même code côté navigateur et côté Apps Script.
 */
var Simulation = (function () {
  var MS = 86400000;
  function ts(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function iso(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function addDays(s, n) { return iso(ts(s) + n * MS); }
  function diff(a, b) { return Math.round((ts(b) - ts(a)) / MS); }
  function estDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && iso(ts(s)) === s; }
  function autre(t) { return t === 'T' ? 'R' : 'T'; }
  function entier(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  function totalJours(m) { return (m.periodes || []).reduce(function (a, p) { return a + Number(p.jours); }, 0); }
  function dateReprise(m) { return addDays(m.debut, totalJours(m)); }

  /** Message d'erreur ou ''. `rot` : { statut, depuis, jours_travail, jours_repos } ; `aujourdhui` : date du jour. */
  function valider(m, rot, aujourdhui) {
    if (!m || !estDate(m.debut)) return 'Date de début invalide';
    if (!rot || !estDate(rot.depuis)) return 'La rotation de l\'agent n\'est pas renseignée';
    if (m.debut < rot.depuis) return 'La modification ne peut pas commencer avant le début de la rotation (' + rot.depuis + ')';
    if (aujourdhui && m.debut < addDays(aujourdhui, -30)) return 'La modification ne peut pas commencer plus de 30 jours dans le passé';
    if (aujourdhui && m.debut > addDays(aujourdhui, 400)) return 'La modification est trop lointaine (400 jours maximum)';
    if (!Array.isArray(m.periodes) || !m.periodes.length) return 'Ajoutez au moins une période';
    if (m.periodes.length > 12) return '12 périodes au maximum';
    for (var i = 0; i < m.periodes.length; i += 1) {
      var p = m.periodes[i];
      if (!p || (p.type !== 'T' && p.type !== 'R')) return 'Période ' + (i + 1) + ' : indiquez travail ou repos';
      if (!entier(p.jours) || p.jours < 1 || p.jours > 120) return 'Période ' + (i + 1) + ' : de 1 à 120 jours';
    }
    if (totalJours(m) > 400) return 'Durée totale trop longue (400 jours maximum)';
    if (m.reprise !== 'T' && m.reprise !== 'R') return 'Indiquez par quoi reprend la rotation habituelle';
    if (m.reprise === m.periodes[m.periodes.length - 1].type) return 'La rotation habituelle doit reprendre par l\'autre statut que la dernière période (sinon allongez cette dernière période)';
    var jt = Number(rot.jours_travail), jr = Number(rot.jours_repos);
    if (!(jt >= 1 && jr >= 1)) return 'Rotation invalide';
    return '';
  }

  /** Lettres des périodes à plat (une lettre par jour modifié). */
  function lettresPeriodes(m) {
    var s = '';
    m.periodes.forEach(function (p) { for (var i = 0; i < p.jours; i += 1) s += p.type; });
    return s;
  }

  /** Grille modifiée sur la même fenêtre que `off` (grille officielle commençant à `debutF`) : avant la modification = officiel ; puis périodes ; puis rotation habituelle. */
  function appliquer(off, debutF, m, rot) {
    var jt = Number(rot.jours_travail), jr = Number(rot.jours_repos), cy = jt + jr;
    var custom = lettresPeriodes(m), rep = dateReprise(m), out = '';
    var len1 = m.reprise === 'T' ? jt : jr;
    for (var i = 0; i < off.length; i += 1) {
      var d = addDays(debutF, i);
      if (d < m.debut) out += off.charAt(i);
      else if (d < rep) out += custom.charAt(diff(m.debut, d));
      else { var c = diff(rep, d) % cy; out += c < len1 ? m.reprise : autre(m.reprise); }
    }
    return out;
  }

  /** Corrections [{ date, statut }] à donner au moteur de Sijil pour appliquer la modification au planning officiel. */
  function corrections(m) {
    var l = [], d = m.debut;
    m.periodes.forEach(function (p) { for (var i = 0; i < p.jours; i += 1) { l.push({ date: d, statut: p.type }); d = addDays(d, 1); } });
    l.push({ date: d, statut: m.reprise });
    return l;
  }

  /** Périodes consécutives T/R d'une grille entre `du` et `au` : [{ type, du, au, jours }]. */
  function tableau(g, debutF, du, au) {
    var out = [], cur = null;
    var i0 = Math.max(0, diff(debutF, du)), i1 = Math.min(g.length - 1, diff(debutF, au));
    for (var i = i0; i <= i1; i += 1) {
      var c = g.charAt(i);
      if (c !== 'T' && c !== 'R') { cur = null; continue; }
      var d = addDays(debutF, i);
      if (cur && cur.type === c) { cur.au = d; cur.jours += 1; } else { cur = { type: c, du: d, au: d, jours: 1 }; out.push(cur); }
    }
    return out;
  }

  /**
   * Vis-à-vis de deux grilles A et B (même fenêtre). Idéal : l'un travaille quand l'autre est en repos.
   *  - « chevauchement » : les deux travaillent ; toléré jusqu'à `tolChev` jours consécutifs (relève, jours de passation) ;
   *  - « trou » : les deux sont en repos ; toléré jusqu'à `tolTrou` jours consécutifs (0 par défaut).
   * Retourne { marques: chaîne (0 = vis-à-vis, t = toléré, C = chevauchement en trop, V = trou), plages: [...], jours: nb de jours en conflit }.
   */
  function conflits(gA, gB, debutF, opts, depuisIdx) {
    var tolC = opts && opts.tolChev != null ? opts.tolChev : 2, tolV = opts && opts.tolTrou != null ? opts.tolTrou : 0;
    var n = Math.min(gA.length, gB.length), marques = '', plages = [], jours = 0;
    var i = 0;
    while (i < n) {
      var a = gA.charAt(i), b = gB.charAt(i);
      var kind = (a === 'T' && b === 'T') ? 'C' : (a === 'R' && b === 'R') ? 'V' : '';
      if (!kind) { marques += '0'; i += 1; continue; }
      var j = i; while (j < n && gA.charAt(j) === a && gB.charAt(j) === b) j += 1;
      var len = j - i, tolere = len <= (kind === 'C' ? tolC : tolV);
      var cnt = (depuisIdx || 0) > i ? Math.max(0, j - Math.max(i, depuisIdx)) : len;
      for (var k = i; k < j; k += 1) marques += tolere ? 't' : kind;
      plages.push({ type: kind === 'C' ? 'chevauchement' : 'trou', du: addDays(debutF, i), au: addDays(debutF, j - 1), jours: len, tolere: tolere });
      if (!tolere) jours += cnt;
      i = j;
    }
    return { marques: marques, plages: plages, jours: jours };
  }

  function changes(g1, g2, depuisIdx, finIdx) { var c = 0; for (var i = depuisIdx; i < Math.min(g1.length, finIdx); i += 1) if (g1.charAt(i) !== g2.charAt(i)) c += 1; return c; }

  /**
   * Propose des modifications de l'agent A qui le mettent en vis-à-vis de B (grille officielle de B inchangée).
   * opts : { offA, gB, debutF, rot, debut, tolChev, tolTrou, maxTransition (60), max (4) }.
   * Essaie une période de transition (travail ou repos de 1 à `maxTransition` jours) ou deux, puis la rotation habituelle ;
   * classe par jours en conflit, puis par nombre de jours modifiés pendant la transition (la rotation habituelle reprend ensuite, décalée). Retourne [{ modif, grille, conflits, jours_modifies }].
   */
  function proposer(opts) {
    var offA = opts.offA, gB = opts.gB, debutF = opts.debutF, rot = opts.rot, debut = opts.debut;
    var depuisIdx = Math.max(0, diff(debutF, debut)), maxT = opts.maxTransition || 60, res = [];
    function essayer(periodes, reprise) {
      var m = { debut: debut, periodes: periodes, reprise: reprise };
      if (valider(m, rot, null)) return;
      var g = appliquer(offA, debutF, m, rot), c = conflits(g, gB, debutF, opts, depuisIdx);
      res.push({ modif: m, grille: g, conflits: c, jours_modifies: changes(offA, g, depuisIdx, depuisIdx + totalJours(m)) });
    }
    var X = ['T', 'R'], x, l1, l2;
    for (x = 0; x < 2; x += 1) for (l1 = 1; l1 <= maxT; l1 += 1) essayer([{ type: X[x], jours: l1 }], autre(X[x]));
    for (x = 0; x < 2; x += 1) for (l1 = 1; l1 <= 40; l1 += 1) for (l2 = 1; l2 <= 40; l2 += 1) essayer([{ type: X[x], jours: l1 }, { type: autre(X[x]), jours: l2 }], X[x]);
    res.sort(function (p, q) { return p.conflits.jours - q.conflits.jours || p.jours_modifies - q.jours_modifies || totalJours(p.modif) - totalJours(q.modif); });
    var vus = {}, out = [];
    for (var i = 0; i < res.length && out.length < (opts.max || 4); i += 1) {
      if (vus[res[i].grille]) continue; vus[res[i].grille] = true; out.push(res[i]);
    }
    return out;
  }


  /** Nombre de jours en conflit (sans allocation : sert à classer des milliers de candidats). */
  function compter(gA, gB, depuisIdx, tolC, tolV) {
    var n = Math.min(gA.length, gB.length), tot = 0, i = 0;
    while (i < n) {
      var a = gA.charCodeAt(i), b = gB.charCodeAt(i);
      var T = 84, R = 82;
      if (!((a === T && b === T) || (a === R && b === R))) { i += 1; continue; }
      var j = i + 1; while (j < n && gA.charCodeAt(j) === a && gB.charCodeAt(j) === b) j += 1;
      if (j - i > (a === T ? tolC : tolV)) tot += j - Math.max(i, depuisIdx) > 0 ? j - Math.max(i, depuisIdx) : 0;
      i = j;
    }
    return tot;
  }

  /**
   * Reliquat concédé par une modification, période par période (travail : +, repos : −) :
   *  - période du MÊME statut que le planning actuel à cette date : on compare sa durée au reste du bloc actuel
   *    (congé de 28 j écourté à 7 j : +21 ; congé de 28 j rallongé à 35 j : −7 ; travail prolongé : +) ;
   *  - période d'un AUTRE statut (insérée avant le bloc suivant) : elle compte en entier
   *    (7 j de travail avant un congé : +7 ; congé prolongé de 7 j alors qu'on devrait travailler : −7).
   *  - plusieurs périodes : on cumule, et on retient le PLUS FORT reliquat atteint (28 j de travail en plus suivis de 28 j de repos en plus : +28, pas 0).
   * + = jours travaillés en plus, reliquat à récupérer ; − = jours de repos en plus. 0 si pas de modification.
   */
  function reliquatDetail(off, mod, debutF, m) {
    if (!m) return { pic: 0, net: 0 };
    var total = 0, pic = 0, d = m.debut;
    m.periodes.forEach(function (p) {
      var i = diff(debutF, d), st = i >= 0 && i < off.length ? off.charAt(i) : '', sg = p.type === 'T' ? 1 : -1;
      if (st === 'T' || st === 'R') {
        if (p.type === st) { var r = 0; while (i + r < off.length && off.charAt(i + r) === st) r += 1; total += sg * (p.jours - r); }
        else total += sg * p.jours;
      }
      if (Math.abs(total) > Math.abs(pic)) pic = total; // on retient le plus fort reliquat atteint (un travail en plus compensé ensuite par du repos reste concédé le temps de la transition)
      d = addDays(d, p.jours);
    });
    return { pic: pic, net: total }; // pic : reliquat concédé pendant la transition ; net : solde laissé une fois la transition terminée
  }
  function reliquat(off, mod, debutF, m) { return reliquatDetail(off, mod, debutF, m).pic; }

  /** Une passe : { conflits (jours), maxChev, maxTrou (plus longues séries), dernier (index du dernier jour en conflit, −1 si aucun) } à partir de depuisIdx. */
  function analyser(gA, gB, depuisIdx, tolC, tolV) {
    var n = Math.min(gA.length, gB.length), conflits = 0, maxChev = 0, maxTrou = 0, dernier = -1, i = 0;
    while (i < n) {
      var a = gA.charCodeAt(i), b = gB.charCodeAt(i);
      if (!((a === 84 && b === 84) || (a === 82 && b === 82))) { i += 1; continue; }
      var j = i + 1; while (j < n && gA.charCodeAt(j) === a && gB.charCodeAt(j) === b) j += 1;
      var len = j - i, chev = a === 84;
      if (j > depuisIdx) { var eff = j - Math.max(i, depuisIdx); if (chev) { if (eff > maxChev) maxChev = eff; } else if (eff > maxTrou) maxTrou = eff; if (len > (chev ? tolC : tolV)) { conflits += eff; dernier = j - 1; } }
      i = j;
    }
    return { conflits: conflits, maxChev: maxChev, maxTrou: maxTrou, dernier: dernier, n: n };
  }

  /** Premier jour (index) à partir de `idx` où la grille change de statut : la « relève » de l'agent (ou idx si c'est déjà un jour de relève). */
  function prochaineReleve(g, idx) {
    var i = Math.max(0, idx);
    if (i === 0 || g.charAt(i) !== g.charAt(i - 1)) return i;
    while (i < g.length && g.charAt(i) === g.charAt(i - 1)) i += 1;
    return i;
  }

  /** Modifications candidates d'UN agent : une ou deux périodes de transition (multiples de `pas`), depuis sa relève (ou la date choisie). */
  function candidats(off, debutF, rot, debut, o) {
    var pas = o.pas || 1, maxT = o.maxTransition || 60, X = ['T', 'R'];
    var idx = Math.max(0, diff(debutF, debut)), dep = o.alignerReleve ? prochaineReleve(off, idx) : idx;
    var d0 = addDays(debutF, dep), un = [{ modif: null, grille: off }], deux = [];
    var maxTotal = o.maxTotal || 1e9; // durée totale maximale de la transition d'un agent
    function ajouter(liste, periodes, reprise) {
      var m = { debut: d0, periodes: periodes, reprise: reprise };
      if (totalJours(m) > maxTotal || valider(m, rot, null)) return;
      var g = appliquer(off, debutF, m, rot); if (g === off) return; // sans effet sur le planning : pas une vraie modification
      liste.push({ modif: m, grille: g });
    }
    var x, l1, l2;
    for (x = 0; x < 2; x += 1) for (l1 = pas; l1 <= maxT; l1 += pas) ajouter(un, [{ type: X[x], jours: l1 }], autre(X[x]));
    var max2 = Math.min(maxT, 42);
    for (x = 0; x < 2; x += 1) for (l1 = pas; l1 <= max2; l1 += pas) for (l2 = pas; l2 <= max2; l2 += pas) ajouter(deux, [{ type: X[x], jours: l1 }, { type: autre(X[x]), jours: l2 }], X[x]);
    return { un: un, deux: deux, dep: dep };
  }

  /**
   * Propose des modifications de A et/ou de B (les deux ensemble si cela raccourcit la transition) qui les mettent en vis-à-vis.
   * opts : { offA, offB, debutF, rotA, rotB, debut, tolChev, tolTrou, pas (1 ou 7 : ajustement au jour ou par semaine), alignerReleve, maxTransition, maxTotal, preference, soldeA, soldeB, max }.
   * soldeA / soldeB : reliquat déjà détenu par chaque agent ; le classement porte sur le solde APRÈS modification (solde + reliquat concédé).
   * Classement : jours en conflit, puis jours de transition au total, puis nombre d'agents modifiés.
   * Retourne [{ A: modif|null, B: modif|null, grilleA, grilleB, conflits, transition, agents }].
   */
  function proposerPaire(opts) {
    var tolC = opts.tolChev != null ? opts.tolChev : 2, tolV = opts.tolTrou != null ? opts.tolTrou : 0, pref = opts.preference || 'indifferent';
    // debutA / debutB (facultatifs) : début propre à chaque agent, pris tel quel (sa relève) ; sinon `debut` commun, aligné sur la relève de chacun si alignerReleve
    var oExact = {}; Object.keys(opts).forEach(function (k) { oExact[k] = opts[k]; }); oExact.alignerReleve = false;
    var cA = candidats(opts.offA, opts.debutF, opts.rotA, opts.debutA || opts.debut, opts.debutA ? oExact : opts), cB = candidats(opts.offB, opts.debutF, opts.rotB, opts.debutB || opts.debut, opts.debutB ? oExact : opts);
    // Le vis-à-vis est exigé à partir de la date choisie : un candidat qui attend la prochaine relève laisse des conflits d'ici là, ce que la priorité « établi au plus tôt » compte.
    var depuisIdx = Math.max(0, diff(opts.debutF, opts.debut)), depuisDate = addDays(opts.debutF, depuisIdx);
    var cyMax = Math.max(Number(opts.rotA.jours_travail) + Number(opts.rotA.jours_repos), Number(opts.rotB.jours_travail) + Number(opts.rotB.jours_repos));
    var sA = Number(opts.soldeA) || 0, sB = Number(opts.soldeB) || 0; // reliquat déjà détenu par chaque agent (+ : jours dus, − : jours pris en avance)
    var AU = cA.un.concat(cA.deux), BU = cB.un.concat(cB.deux), res = [];
    function essayer(a, b) {
      if (!a.modif && !b.modif) return; // aucune modification : ce n'est pas une proposition
      var gA = a.grille, gB = b.grille;
      var rA = reliquat(opts.offA, gA, opts.debutF, a.modif), rB = reliquat(opts.offB, gB, opts.debutF, b.modif), tA = sA + rA, tB = sB + rB; // solde existant + reliquat concédé
      if (pref === 'negatif' && (rA > 0 || rB > 0)) return;   // personne ne travaille plus que prévu : congés prolongés seulement
      if (pref === 'positif' && (rA < 0 || rB < 0)) return;   // personne ne rallonge son congé : congés écourtés / travail en plus seulement
      var c = analyser(gA, gB, depuisIdx, tolC, tolV), tr = (a.modif ? totalJours(a.modif) : 0) + (b.modif ? totalJours(b.modif) : 0);
      var stable = c.dernier < c.n - cyMax; // les conflits cessent bien avant la fin de l'horizon : le vis-à-vis finit par s'établir
      res.push({ a: a, b: b, reliquatA: rA, reliquatB: rB, concession: Math.abs(rA) + Math.abs(rB), soldeA: tA, soldeB: tB, pire: Math.max(Math.abs(tA), Math.abs(tB)), petit: Math.min(Math.abs(tA), Math.abs(tB)), conflits: c.conflits, maxChev: c.maxChev, maxTrou: c.maxTrou, stable: stable, etabli: c.dernier + 1 < depuisIdx ? depuisIdx : c.dernier + 1, transition: tr, agents: (a.modif ? 1 : 0) + (b.modif ? 1 : 0) });
    }
    var i, j, B0 = cB.un[0], A0 = cA.un[0];
    for (i = 1; i < AU.length; i += 1) essayer(AU[i], B0);
    for (j = 1; j < BU.length; j += 1) essayer(A0, BU[j]);
    var plein = AU.length * BU.length <= 60000;
    var LA = plein ? AU : cA.un, LB = plein ? BU : cB.un;
    for (i = 1; i < LA.length; i += 1) for (j = 1; j < LB.length; j += 1) essayer(LA[i], LB[j]);
    // Priorités : 1) le vis-à-vis s'établit le plus TÔT possible ; 2) le plus fort reliquat atteint (par un des deux agents) classé EN DERNIER, donc le plus petit pire reliquat d'abord ;
    // 3) puis le plus petit reliquat de l'autre agent (jamais de somme) ; 4) la transition la plus courte ; 5) le moins d'agents modifiés. Sans vis-à-vis stable : les plus proches (plus longue série à tolérer), puis le moins de jours en conflit.
    res.sort(function (p, q) {
      if (p.stable !== q.stable) return p.stable ? -1 : 1;
      if (p.stable) return p.etabli - q.etabli || p.pire - q.pire || p.petit - q.petit || p.transition - q.transition || p.agents - q.agents;
      return Math.max(p.maxChev, p.maxTrou) - Math.max(q.maxChev, q.maxTrou) || p.conflits - q.conflits || p.concession - q.concession || p.transition - q.transition;
    });
    var vus = {}, out = [];
    for (i = 0; i < res.length && out.length < (opts.max || 10); i += 1) {
      var r = res[i], k = r.a.grille + '|' + r.b.grille; if (vus[k]) continue; vus[k] = true;
      out.push({ A: r.a.modif, B: r.b.modif, grilleA: r.a.grille, grilleB: r.b.grille, conflits: r.conflits, transition: r.transition, agents: r.agents, reliquatA: r.reliquatA, reliquatB: r.reliquatB, concession: r.concession, pire: r.pire, soldeApresA: r.soldeA, soldeApresB: r.soldeB,
                 tolChevMin: r.maxChev, tolTrouMin: r.maxTrou, stable: r.stable, etabliLe: addDays(opts.debutF, r.etabli), jusquEtabli: r.etabli - depuisIdx, depuis: depuisDate });
    }
    return out;
  }

  /**
   * Retour à la rotation habituelle : `norm` = grille de la rotation sans aucune modification, `mod` = grille modifiée (même fenêtre, qui commence à `debutF`).
   * L'agent est « rentré dans sa rotation » quand les deux grilles sont identiques sur au moins un cycle complet (`cy` jours) à la fin de la fenêtre.
   * Retourne { ok, dernierEcart: dernier jour qui diffère de la rotation ('' si aucun), reprendLe: premier jour de retour à la normale }.
   */
  function retour(norm, mod, debutF, cy) {
    var n = Math.min(norm.length, mod.length), dernier = -1;
    for (var i = 0; i < n; i += 1) if (norm.charAt(i) !== mod.charAt(i)) dernier = i;
    return { ok: n - 1 - dernier >= cy, dernierEcart: dernier < 0 ? '' : addDays(debutF, dernier), reprendLe: dernier < 0 ? '' : addDays(debutF, dernier + 1) };
  }

  return { retour: retour, reliquatDetail: reliquatDetail, reliquat: reliquat, proposerPaire: proposerPaire, prochaineReleve: prochaineReleve, addDays: addDays, diff: diff, estDate: estDate, autre: autre, totalJours: totalJours, dateReprise: dateReprise, valider: valider, appliquer: appliquer,
           corrections: corrections, tableau: tableau, conflits: conflits, proposer: proposer };
})();

if (typeof module !== 'undefined') module.exports = Simulation;
