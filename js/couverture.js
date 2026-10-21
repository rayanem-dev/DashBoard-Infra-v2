/* Couverture d'une équipe : le planning de tous les agents d'un service (ou de la division) est-il correct ?
 * Pour chaque jour on compte les agents au travail (T) ; on cherche les jours SANS PERSONNE (trous) et les pics de présence (trop d'agents ensemble).
 * Pur (sans DOM), testé avec Node ; le navigateur et la simulation l'utilisent tel quel.
 *
 *   Couverture.analyser(grilles, { debut: 'AAAA-MM-JJ' (date du premier jour des grilles), de: 0, a: grilles[0].length, minimum: 1, tolerancePic: 2 })
 *   → { agents, jours, vides: [{ du, au, jours }], joursVides, pctVide, pics: [{ du, au, jours, max }], joursPic, moyenne, verdict: 'ok' | 'ajuster' | 'insuffisant', titre, details: [phrases] }
 */
(function (racine) {
  var SEUIL_OK = 0.02, SEUIL_KO = 0.10;
  function ts(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = new Date(ts(s) + n * 86400000); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function fr(s) { return s.slice(8, 10) + '/' + s.slice(5, 7); }
  function plage(r) { return r.jours > 1 ? 'du ' + fr(r.du) + ' au ' + fr(r.au) : 'le ' + fr(r.du); }
  function s(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }

  function analyser(grilles, o) {
    o = o || {};
    var gs = (grilles || []).filter(function (g) { return g && g.length; }), agents = gs.length;
    var n = agents ? Math.min.apply(null, gs.map(function (g) { return g.length; })) : 0;
    var de = Math.max(0, o.de || 0), a = Math.min(n, o.a == null ? n : o.a), min = o.minimum == null ? 1 : o.minimum, tolPic = o.tolerancePic == null ? 2 : o.tolerancePic;
    var debut = o.debut || '2000-01-01', jours = Math.max(0, a - de);
    var comptes = [], total = 0, i, k;
    for (i = de; i < a; i += 1) { var c = 0; for (k = 0; k < agents; k += 1) if (gs[k].charAt(i) === 'T') c += 1; comptes.push(c); total += c; }
    var moyenne = jours ? total / jours : 0;
    function plages(test) {
      var out = [], cur = null;
      comptes.forEach(function (c, j) { if (test(c)) { if (cur) { cur.au = addDays(debut, de + j); cur.jours += 1; if (c > cur.max) cur.max = c; } else { cur = { du: addDays(debut, de + j), au: addDays(debut, de + j), jours: 1, max: c }; out.push(cur); } } else cur = null; });
      return out;
    }
    var vides = plages(function (c) { return c < min; });
    var seuilPic = Math.max(3, Math.ceil(moyenne * 1.5 + 0.0001));
    var pics = plages(function (c) { return c >= seuilPic; }).filter(function (r) { return r.jours > tolPic; });
    var joursVides = vides.reduce(function (t, r) { return t + r.jours; }, 0), joursPic = pics.reduce(function (t, r) { return t + r.jours; }, 0);
    var pctVide = jours ? joursVides / jours : 0, pctPic = jours ? joursPic / jours : 0;
    var longueVide = vides.reduce(function (m, r) { return Math.max(m, r.jours); }, 0);
    var verdict = !agents || !jours ? 'ok' : (pctVide > SEUIL_KO || longueVide >= 7) ? 'insuffisant' : (pctVide >= SEUIL_OK || pctPic > 0.15) ? 'ajuster' : 'ok';
    var titre = !agents ? 'Aucun agent configuré' : verdict === 'ok' ? 'Planning des équipes équilibré' : verdict === 'ajuster' ? 'Planning des équipes à ajuster' : 'Couverture insuffisante';
    var details = [];
    if (!agents) details.push('Aucun agent de cette sélection n\'a de rotation enregistrée : la couverture ne peut pas être calculée.');
    else {
      details.push(s(agents, 'agent analysé', 'agents analysés') + ' sur ' + s(jours, 'jour', 'jours') + ' (présents en moyenne : ' + (Math.round(moyenne * 10) / 10).toString().replace('.', ',') + ' par jour).');
      if (vides.length) {
        details.push(s(joursVides, 'jour', 'jours') + ' sans personne' + (min > 1 ? ' (moins de ' + min + ' présents)' : '') + ' (' + String(Math.round(pctVide * 1000) / 10).replace('.', ',') + ' % de la période) : ' + vides.slice(0, 4).map(plage).join(' ; ') + (vides.length > 4 ? ' …' : '') + '.');
        details.push('À faire : décaler la rotation d\'un agent (ou allonger une période de travail) pour que quelqu\'un soit présent ces jours-là.');
      } else details.push('Aucun jour sans personne.');
      if (pics.length) {
        details.push(s(joursPic, 'jour', 'jours') + ' avec beaucoup d\'agents en même temps (' + seuilPic + ' ou plus) : ' + pics.slice(0, 4).map(function (r) { return plage(r) + ' (' + r.max + ' agents)'; }).join(' ; ') + (pics.length > 4 ? ' …' : '') + '.');
        details.push('À faire : étaler les rotations, par exemple décaler un agent de ces jours-là vers une période moins chargée.');
      } else if (agents > 1) details.push('Présence bien répartie : pas de pic de plus de ' + tolPic + ' jour' + (tolPic > 1 ? 's' : '') + '.');
      details.push('Seuils : correct sous ' + SEUIL_OK * 100 + ' % de jours vides ; insuffisant au-delà de ' + SEUIL_KO * 100 + ' % ou avec un trou de 7 jours ou plus.');
    }
    return { agents: agents, jours: jours, vides: vides, joursVides: joursVides, pctVide: pctVide, pics: pics, joursPic: joursPic, moyenne: moyenne, verdict: verdict, titre: titre, details: details };
  }
  /** Affiche le verdict dans `zone` (navigateur) : pastille colorée ; survol ou clic = l'explication et ce qu'il faut faire. */
  function monter(zone, res, intitule) {
    zone.textContent = ''; zone.hidden = false;
    var tr = function (x) { return typeof I18n !== 'undefined' && I18n.t ? I18n.t(x) : x; };
    var ic = { ok: '✅', ajuster: '⚠️', insuffisant: '❌' }[res.verdict] || '', d = document;
    var boite = d.createElement('div'); boite.className = 'couv ' + res.verdict;
    var b = d.createElement('button'); b.type = 'button'; b.className = 'couv-chip'; b.title = res.details.map(tr).join('\n'); b.setAttribute('aria-expanded', 'false');
    var t = d.createElement('b'); t.textContent = ic + ' ' + tr(res.titre); b.appendChild(t);
    var sm = d.createElement('small'); sm.textContent = (intitule ? ' · ' + intitule : '') + (res.agents ? ' · ' + res.agents + ' agent' + (res.agents > 1 ? 's' : '') + ' · ' + res.joursVides + ' jour' + (res.joursVides > 1 ? 's' : '') + ' sans personne' : ''); sm.textContent = tr(sm.textContent); b.appendChild(sm);
    var det = d.createElement('div'); det.className = 'couv-det'; det.hidden = true;
    res.details.forEach(function (x) { var p = d.createElement('p'); p.textContent = tr(x); det.appendChild(p); });
    b.addEventListener('click', function () { det.hidden = !det.hidden; b.setAttribute('aria-expanded', String(!det.hidden)); });
    boite.appendChild(b); boite.appendChild(det); zone.appendChild(boite);
  }
  var API = { analyser: analyser, monter: monter };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Couverture = API;
})(typeof window !== 'undefined' ? window : this);
