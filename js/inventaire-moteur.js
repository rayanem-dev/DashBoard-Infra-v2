/**
 * Moteur de l'application « Inventaire » : positions des articles, historique, fusion de positions, statistiques.
 * Pur (aucun navigateur) : testé en Node (apps-script/gateway/test/inventaire.test.js).
 *
 * Principe des processus d'inventaire : une position n'est JAMAIS écrasée sans trace. Chaque changement (import, correction, fusion, annulation)
 * ajoute une ligne à l'historique { id, date, inv, de, vers, source, motif } ; « annuler » rétablit l'ancienne position par une nouvelle ligne
 * (rien n'est supprimé de l'historique).
 *
 * État : { v: 1, articles: { [inv]: Article }, positions: { [nom]: { alias: [textes déjà vus] } }, historique: [ligne] }
 * Article : { inv, codeSh, designation, marque, type, serie, position, structure, imputation, etat, indice, valeur, nonTrouve: { [annee]: true }, maj }
 */
(function (racine) {
  var STOP = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, en: 1, au: 1, aux: 1, a: 1, d: 1, l: 1, n: 1, no: 1 };

  function sansAccent(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /** Forme comparable d'un texte : majuscules, sans accents ni ponctuation, espaces simples. */
  function cle(s) { return sansAccent(s).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); }
  function propre(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function invCle(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  function distance(a, b) {
    var m = [], i, j; for (i = 0; i <= a.length; i += 1) m[i] = [i]; for (j = 1; j <= b.length; j += 1) m[0][j] = j;
    for (i = 1; i <= a.length; i += 1) for (j = 1; j <= b.length; j += 1) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    return m[a.length][b.length];
  }
  function mots(s) { return cle(s).split(' ').filter(function (w) { return w && !STOP[w.toLowerCase()]; }); }
  function memeMot(a, b) {
    if (a === b) return true;
    if (a.length < 5 || b.length < 5 || /\d/.test(a + b)) return false;
    var d = distance(a, b);
    return d <= 1 || (d <= 2 && a.charAt(0) === b.charAt(0) && a.charAt(a.length - 1) === b.charAt(b.length - 1));   // FOSSE / FAUSSE
  }
  /**
   * Ressemblance de deux positions (0 à 1). Les mots qui contiennent un chiffre (RNH 03, PISCINE 1) distinguent deux lieux : s'ils diffèrent des deux côtés, 0.
   * Une faute de frappe (1 lettre, ou 2 si le mot commence et finit pareil) sur un mot de 5 lettres ou plus est tolérée (FOSSE / FAUSSE).
   */
  function ressemblance(a, b) {
    var A = mots(a), B = mots(b); if (!A.length || !B.length) return 0;
    if (cle(a) === cle(b)) return 1;
    var nA = A.filter(function (w) { return /\d/.test(w); }), nB = B.filter(function (w) { return /\d/.test(w); });
    // numéros de lieu : « N 1 » (atelier n°1) n'en est pas un ; on compare les chiffres seuls
    var chA = nA.join(' ').replace(/N(?=\d)/g, ''), chB = nB.join(' ').replace(/N(?=\d)/g, '');
    if (nA.length && nB.length && chA !== chB) return 0;
    var communs = 0, utilises = {};
    A.forEach(function (w) { for (var k = 0; k < B.length; k += 1) if (!utilises[k] && memeMot(w, B[k])) { utilises[k] = 1; communs += 1; return; } });
    var jaccard = communs / (A.length + B.length - communs), contenu = communs / Math.min(A.length, B.length);
    return Math.round(((jaccard + contenu) / 2) * 100) / 100;
  }

  function nouvelEtat() { return { v: 1, articles: {}, positions: {}, historique: [] }; }
  function copie(o) { return JSON.parse(JSON.stringify(o)); }
  var compteur = 0;
  function idLigne(date) { compteur += 1; return String(date || '').replace(/\D/g, '').slice(0, 14) + '-' + compteur + '-' + Math.floor(Math.random() * 1e6).toString(36); }

  /** Table des textes de position déjà connus : { cle(texte): nom de position } (nom officiel et anciennes écritures). */
  function carteAlias(etat) {
    var c = {};
    Object.keys(etat.positions).forEach(function (nom) { c[cle(nom)] = nom; (etat.positions[nom].alias || []).forEach(function (a) { c[cle(a)] = nom; }); });
    return c;
  }
  function ajouterPosition(etat, nom, alias) {
    nom = propre(nom); if (!nom) return '';
    var p = etat.positions[nom] || (etat.positions[nom] = { alias: [] });
    (alias || []).forEach(function (a) { a = propre(a); if (a && a !== nom && p.alias.indexOf(a) < 0) p.alias.push(a); });
    return nom;
  }
  /** Nombre d'articles par position : { nom: n }. */
  function effectifs(etat) { var n = {}; Object.keys(etat.articles).forEach(function (k) { var p = etat.articles[k].position || ''; n[p] = (n[p] || 0) + 1; }); return n; }

  /** Positions qui se ressemblent (à fusionner ?) : [{ membres: [{ nom, n }], propose, score }], les plus proches d'abord. `seuil` : 0,7 par défaut. */
  function suggestions(etat, seuil) {
    seuil = seuil == null ? 0.7 : seuil;
    var noms = Object.keys(etat.positions), n = effectifs(etat), parent = {}, best = {};
    noms.forEach(function (x) { parent[x] = x; });
    function racineDe(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    for (var i = 0; i < noms.length; i += 1) for (var j = i + 1; j < noms.length; j += 1) {
      var s = ressemblance(noms[i], noms[j]);
      if (s >= seuil) { parent[racineDe(noms[i])] = racineDe(noms[j]); var r = racineDe(noms[i]); best[r] = Math.min(best[r] == null ? 1 : best[r], s); }
    }
    var groupes = {}; noms.forEach(function (x) { var r = racineDe(x); (groupes[r] = groupes[r] || []).push(x); });
    var out = [];
    Object.keys(groupes).forEach(function (r) {
      var g = groupes[r]; if (g.length < 2) return;
      var score = 1; for (var a = 0; a < g.length; a += 1) for (var b = a + 1; b < g.length; b += 1) score = Math.min(score, ressemblance(g[a], g[b]));
      var membres = g.map(function (x) { return { nom: x, n: n[x] || 0 }; }).sort(function (p, q) { return q.n - p.n || q.nom.length - p.nom.length; });
      out.push({ membres: membres, propose: membres[0].nom, score: score });
    });
    return out.sort(function (p, q) { return q.score - p.score; });
  }

  /** Position la plus proche (déjà connue) d'un texte : { nom, score } ou null sous le seuil. */
  function plusProche(etat, texte, seuil) {
    var best = null; seuil = seuil == null ? 0.7 : seuil;
    Object.keys(etat.positions).forEach(function (nom) {
      var s = ressemblance(texte, nom); if (s >= seuil && (!best || s > best.score)) best = { nom: nom, score: s };
    });
    return best;
  }

  // ---------- lecture d'une feuille (lignes brutes → articles) ----------
  var COLONNES = [
    ['inv', /^(n ?inv|inv|numero inv|n° inv)/], ['codeSh', /^code ?sh/], ['designation', /^designation/], ['marque', /^marque/], ['type', /^type$/],
    ['serie', /^n ?serie|^numero serie/], ['position', /^position$/], ['structure', /^(structure|strc|str g)$/], ['imputation', /^(imput|imputation)$/],
    ['etat', /^etat$/], ['indice', /^indice$/], ['valeur', /^valeur/], ['recense', /^recense$/]
  ];
  function nombreFr(v) {
    if (typeof v === 'number') return v;
    var t = String(v == null ? '' : v).replace(/\s/g, '').replace(/ /g, ''); if (!t) return null;
    if (/,/.test(t) && /\./.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else if (/,\d{1,2}$/.test(t)) t = t.replace(',', '.'); else t = t.replace(/,/g, '');
    var x = Number(t); return isFinite(x) ? x : null;
  }
  /** `lignes` : tableau de lignes (tableaux de cellules). Retourne { articles: [...], colonnes: { champ: index }, ligneEntete, erreur }. */
  function lireFeuille(lignes) {
    var h = -1, col = {}, i;
    for (i = 0; i < Math.min(12, lignes.length) && h < 0; i += 1) {
      var essai = {}; (lignes[i] || []).forEach(function (c, k) {
        var t = cle(c).toLowerCase(); if (!t) return;
        COLONNES.forEach(function (d) { if (essai[d[0]] === undefined && d[1].test(t)) essai[d[0]] = k; });
      });
      if (essai.inv !== undefined && (essai.designation !== undefined || essai.position !== undefined)) { h = i; col = essai; }
    }
    if (h < 0) return { articles: [], colonnes: {}, ligneEntete: -1, erreur: 'En-têtes introuvables : colonnes « N° Inv » et « Désignation » ou « Position » attendues.' };
    var out = [];
    for (i = h + 1; i < lignes.length; i += 1) {
      var l = lignes[i] || [], g = function (c) { return col[c] === undefined ? '' : propre(l[col[c]]); };
      var inv = g('inv'); if (!invCle(inv)) continue;
      out.push({ inv: inv, codeSh: g('codeSh'), designation: g('designation'), marque: g('marque'), type: g('type'), serie: g('serie'), position: g('position'), structure: g('structure'),
        imputation: g('imputation').replace(/\.0$/, ''), etat: g('etat'), indice: g('indice'), valeur: col.valeur === undefined ? null : nombreFr(l[col.valeur]) });
    }
    return { articles: out, colonnes: col, ligneEntete: h, erreur: '' };
  }

  // ---------- import ----------
  /**
   * Analyse un import sans rien modifier. mode : 'positions' (la colonne Position met à jour les articles) ou 'ecarts' (articles NON TROUVÉS : on les marque, la position n'est pas touchée).
   * Retourne { nouveaux, changements: [{ inv, de, vers (texte brut) }], identiques, positionsAConfirmer: [{ texte, n, proche }], total }.
   */
  function analyserImport(etat, lignes) {
    var alias = carteAlias(etat), res = { nouveaux: [], changements: [], identiques: 0, positionsAConfirmer: [], total: lignes.length };
    var vus = {};
    lignes.forEach(function (l) {
      var k = invCle(l.inv), a = etat.articles[k] ? etat.articles[k] : null, t = propre(l.position);
      if (!a) res.nouveaux.push(l.inv);
      else if (t && alias[cle(t)] !== a.position && cle(t) !== cle(a.position)) res.changements.push({ inv: a.inv, de: a.position, vers: t });
      else res.identiques += 1;
      if (t && !alias[cle(t)] && !vus[cle(t)]) { vus[cle(t)] = { texte: t, n: 0, proche: plusProche(etat, t, 0.7) }; res.positionsAConfirmer.push(vus[cle(t)]); }
      if (t && vus[cle(t)] && !alias[cle(t)]) vus[cle(t)].n += 1;
    });
    return res;
  }
  /**
   * Applique un import. `choix` : { cle(texte brut): nom de position retenu } pour les positions à confirmer (absent = nouvelle position avec ce texte).
   * options : { mode: 'positions' | 'ecarts', annee, date, source }. Retourne un NOUVEL état (l'ancien n'est pas modifié) et le résumé.
   */
  function appliquerImport(etat, lignes, choix, options) {
    var o = options || {}, e = copie(etat), date = o.date || new Date().toISOString(), source = o.source || ('Import ' + (o.mode === 'ecarts' ? 'écarts ' + (o.annee || '') : 'positions')).trim();
    var resume = { crees: 0, deplaces: 0, marques: 0, identiques: 0 };
    choix = choix || {};
    lignes.forEach(function (l) {
      var k = invCle(l.inv), t = propre(l.position), alias = carteAlias(e), nom = '';
      if (t) {
        nom = alias[cle(t)] || (choix[cle(t)] ? choix[cle(t)] : t);
        nom = ajouterPosition(e, nom, nom === t ? [] : [t]);
        if (choix[cle(t)] && nom !== t) ajouterPosition(e, nom, [t]);
      }
      var a = e.articles[k];
      if (!a) {
        a = e.articles[k] = { inv: propre(l.inv), codeSh: l.codeSh, designation: l.designation, marque: l.marque, type: l.type, serie: l.serie, position: nom, structure: l.structure, imputation: l.imputation, etat: l.etat, indice: l.indice, valeur: l.valeur, nonTrouve: {}, maj: date };
        resume.crees += 1; e.historique.push({ id: idLigne(date), date: date, inv: a.inv, de: '', vers: nom, source: source, motif: 'Article créé' });
      } else {
        ['codeSh', 'designation', 'marque', 'type', 'serie', 'structure', 'imputation', 'etat', 'indice'].forEach(function (c) { if (!a[c] && l[c]) a[c] = l[c]; });
        if (a.valeur == null && l.valeur != null) a.valeur = l.valeur;
        if (o.mode !== 'ecarts' && nom && nom !== a.position) {
          e.historique.push({ id: idLigne(date), date: date, inv: a.inv, de: a.position, vers: nom, source: source, motif: 'Position mise à jour par import' });
          a.position = nom; a.maj = date; resume.deplaces += 1;
        } else if (o.mode !== 'ecarts') resume.identiques += 1;
      }
      if (o.mode === 'ecarts') { a.nonTrouve = a.nonTrouve || {}; if (!a.nonTrouve[o.annee]) { a.nonTrouve[o.annee] = true; resume.marques += 1; } }
    });
    return { etat: e, resume: resume };
  }

  // ---------- corrections ----------
  function deplacer(etat, inv, vers, motif, date, source) {
    var e = copie(etat), a = e.articles[invCle(inv)]; vers = propre(vers);
    if (!a) throw new Error('Article inconnu : ' + inv);
    if (!vers) throw new Error('Position vide');
    var carte = carteAlias(e), nom = carte[cle(vers)] || vers; ajouterPosition(e, nom, nom === vers ? [] : [vers]);
    if (nom === a.position) return e;
    date = date || new Date().toISOString();
    e.historique.push({ id: idLigne(date), date: date, inv: a.inv, de: a.position, vers: nom, source: source || 'Correction', motif: propre(motif) });
    a.position = nom; a.maj = date; return e;
  }
  /** Annule un changement : l'article revient à la position `de` de la ligne ; une nouvelle ligne le dit, la ligne annulée reste (marquée). */
  function annuler(etat, idHisto, date) {
    var e = copie(etat), h = e.historique.filter(function (x) { return x.id === idHisto; })[0];
    if (!h) throw new Error('Ligne d\'historique introuvable');
    if (h.annule) throw new Error('Déjà annulé');
    var a = e.articles[invCle(h.inv)]; if (!a) throw new Error('Article inconnu');
    if (a.position !== h.vers) throw new Error('L\'article a changé de position depuis : annulez d\'abord le changement le plus récent.');
    date = date || new Date().toISOString();
    h.annule = true;
    e.historique.push({ id: idLigne(date), date: date, inv: a.inv, de: a.position, vers: h.de, source: 'Annulation', motif: 'Annule le changement du ' + String(h.date).slice(0, 10), annule: false, annuleId: h.id });
    a.position = h.de; a.maj = date; return e;
  }
  /** Fusionne plusieurs positions en une seule (`nomFinal`) : les articles suivent, les anciens noms deviennent des alias (retenus pour les prochains imports), chaque article touché a sa ligne d'historique. */
  function fusionner(etat, noms, nomFinal, date) {
    var e = copie(etat); nomFinal = propre(nomFinal); if (!nomFinal) throw new Error('Nom final vide');
    date = date || new Date().toISOString();
    var anciens = noms.filter(function (n) { return n !== nomFinal; });
    anciens.forEach(function (n) {
      var p = e.positions[n]; ajouterPosition(e, nomFinal, [n].concat(p ? p.alias : []));
      Object.keys(e.articles).forEach(function (k) {
        var a = e.articles[k];
        if (a.position === n) { e.historique.push({ id: idLigne(date), date: date, inv: a.inv, de: n, vers: nomFinal, source: 'Fusion de positions', motif: 'Positions fusionnées : « ' + n + ' » → « ' + nomFinal + ' »' }); a.position = nomFinal; a.maj = date; }
      });
      delete e.positions[n];
    });
    ajouterPosition(e, nomFinal, []); return e;
  }
  function renommer(etat, ancien, nouveau, date) {
    nouveau = propre(nouveau); if (!nouveau) throw new Error('Nom vide');
    if (nouveau === ancien) return copie(etat);
    if (etat.positions[nouveau]) return fusionner(etat, [ancien, nouveau], nouveau, date);
    return fusionner(Object.assign(copie(etat), {}), [ancien], nouveau, date);
  }
  /** Marque l'article trouvé : il prend la position indiquée (historique) et n'est plus « non trouvé » pour l'année. */
  function marquerTrouve(etat, inv, position, annee, date) {
    var e = deplacer(etat, inv, position, 'Trouvé à cette position' + (annee ? ' (écart ' + annee + ')' : ''), date, 'Article retrouvé');
    var a = e.articles[invCle(inv)]; if (a && a.nonTrouve && annee) delete a.nonTrouve[annee]; return e;
  }

  // ---------- statistiques ----------
  var CHAMPS = { position: 'Position', structure: 'Structure', imputation: 'Imputation', etat: 'État', indice: 'Indice', marque: 'Marque', designation: 'Désignation', type: 'Type' };
  /** Regroupe les articles (filtrés) par un champ : [{ valeur, n, somme }] du plus nombreux au moins nombreux. filtre(a) : booléen. */
  function parChamp(etat, champ, filtre) {
    var g = {};
    Object.keys(etat.articles).forEach(function (k) {
      var a = etat.articles[k]; if (filtre && !filtre(a)) return;
      var v = champ === 'statut' ? (Object.keys(a.nonTrouve || {}).length ? 'Non trouvé ' + Object.keys(a.nonTrouve).join(', ') : 'Trouvé / sans écart') : (propre(a[champ]) || '(vide)');
      var x = g[v] || (g[v] = { valeur: v, n: 0, somme: 0 }); x.n += 1; x.somme += Number(a.valeur) || 0;
    });
    return Object.keys(g).map(function (v) { return g[v]; }).sort(function (p, q) { return q.n - p.n || (p.valeur < q.valeur ? -1 : 1); });
  }
  function resume(etat) {
    var arts = Object.keys(etat.articles).map(function (k) { return etat.articles[k]; });
    return { articles: arts.length, positions: Object.keys(etat.positions).length, historique: etat.historique.length, nonTrouves: arts.filter(function (a) { return Object.keys(a.nonTrouve || {}).length; }).length,
      valeur: arts.reduce(function (s, a) { return s + (Number(a.valeur) || 0); }, 0) };
  }

  // ---------- exports (tableaux de lignes pour SheetJS) ----------
  function derniereAncienne(etat) {
    var d = {}; etat.historique.forEach(function (h) { if (h.de && !h.annule) { var k = invCle(h.inv); d[k] = { de: h.de, date: h.date }; } }); return d;
  }
  function versTableaux(etat) {
    var anc = derniereAncienne(etat), eff = effectifs(etat);
    var inv = [['N° Inv', 'Code SH', 'Désignation', 'Marque', 'Type', 'N° Série', 'Position actuelle', 'Ancienne position', 'Date du dernier changement', 'Structure', 'Imputation', 'État', 'Indice', 'Valeur (DA)', 'Non trouvé']];
    Object.keys(etat.articles).sort().forEach(function (k) {
      var a = etat.articles[k], p = anc[k] || {};
      inv.push([a.inv, a.codeSh, a.designation, a.marque, a.type, a.serie, a.position, p.de || '', p.date ? String(p.date).slice(0, 10) : '', a.structure, a.imputation, a.etat, a.indice, a.valeur, Object.keys(a.nonTrouve || {}).join(', ')]);
    });
    var his = [['Date', 'N° Inv', 'De', 'Vers', 'Source', 'Motif', 'Annulé']];
    etat.historique.forEach(function (h) { his.push([String(h.date).slice(0, 19).replace('T', ' '), h.inv, h.de, h.vers, h.source, h.motif, h.annule ? 'oui' : '']); });
    var pos = [['Position', 'Nombre d\'articles', 'Autres écritures déjà vues']];
    Object.keys(etat.positions).sort().forEach(function (n) { pos.push([n, eff[n] || 0, (etat.positions[n].alias || []).join(' | ')]); });
    return { inventaire: inv, historique: his, positions: pos };
  }

  var API = { cle: cle, ressemblance: ressemblance, nouvelEtat: nouvelEtat, suggestions: suggestions, plusProche: plusProche, effectifs: effectifs, lireFeuille: lireFeuille, nombreFr: nombreFr,
    analyserImport: analyserImport, appliquerImport: appliquerImport, deplacer: deplacer, annuler: annuler, fusionner: fusionner, renommer: renommer, marquerTrouve: marquerTrouve,
    parChamp: parChamp, resume: resume, versTableaux: versTableaux, ajouterPosition: ajouterPosition, invCle: invCle, CHAMPS: CHAMPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.InventaireMoteur = API;
})(typeof window !== 'undefined' ? window : this);
