/**
 * Lecture de la liste nominative d'une demande de prise en charge (texte issu de l'OCR) : nom, prénom, fonction.
 * Fonctions pures (pas de service Google) : testées avec Node (test/lecture.test.js).
 *
 * Reconnaît :
 *  - un vrai tableau (en-têtes NOM / PRÉNOM / FONCTION, dans n'importe quel ordre, fautes d'OCR d'une lettre tolérées) : pecLireTableau_(lignes) ;
 *  - des lignes de texte « 1  SIDHOUM  BADERDDINE  02/08/1985  MACON  1098… » (la date de naissance sépare les noms de la fonction),
 *    ou une cellule par ligne (le texte d'un tableau mal reconstruit) ;
 *  - de simples lignes « Nom Prénom ».
 */
function pecNorm_(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' \-\/.]/g, ' ').replace(/\s+/g, ' ').trim(); }
function pecMot_(w) { return w.split(/([\-'’])/).map(function (x) { return x.length > 1 || /[A-Za-zÀ-ÿ]/.test(x) ? x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() : x; }).join(''); }
function pecCap_(s) { return String(s || '').trim().replace(/\s+/g, ' ').split(' ').map(pecMot_).join(' '); }
function pecFonction_(s) { var t = String(s || '').replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ''; }
/** Distance d'édition (OCR : « PRENQM » ≈ « PRENOM »). */
function pecDist_(a, b) {
  var m = [], i, j; for (i = 0; i <= a.length; i += 1) { m[i] = [i]; } for (j = 1; j <= b.length; j += 1) m[0][j] = j;
  for (i = 1; i <= a.length; i += 1) for (j = 1; j <= b.length; j += 1) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
  return m[a.length][b.length];
}
function pecEntete_(cellule) {
  var t = pecNorm_(cellule).replace(/[^a-z]/g, ''); if (!t) return '';
  if (t.indexOf('prenom') >= 0 || pecDist_(t, 'prenom') <= 1) return 'prenom';
  if (t.indexOf('fonction') >= 0 || t.indexOf('poste') >= 0 || t.indexOf('profession') >= 0 || (t.length >= 6 && pecDist_(t, 'fonction') <= 2)) return 'fonction';
  if (t === 'nom' || t.indexOf('nom') === 0 && t.length <= 6 || pecDist_(t, 'nom') <= 1 && t.length <= 4) return 'nom';
  return '';
}
/** `lignes` : tableau de lignes, chaque ligne = tableau de textes de cellules. Retourne [{ nom, prenom, fonction }]. */
function pecLireTableau_(lignes) {
  var out = [], h = -1, col = {}, i, c;
  for (i = 0; i < Math.min(4, lignes.length) && h < 0; i += 1) {
    var essai = {}; lignes[i].forEach(function (x, k) { var e = pecEntete_(x); if (e && essai[e] === undefined) essai[e] = k; });
    if (essai.nom !== undefined && essai.prenom !== undefined) { h = i; col = essai; }
  }
  if (h < 0) return out;
  for (i = h + 1; i < lignes.length; i += 1) {
    var l = lignes[i]; if (l.length <= Math.max(col.nom, col.prenom)) continue;
    var nom = String(l[col.nom] || '').replace(/\s+/g, ' ').trim(), prenom = String(l[col.prenom] || '').replace(/\s+/g, ' ').trim();
    if (!nom || !prenom || !/[A-Za-zÀ-ÿ]{2}/.test(nom + prenom) || pecEnteteMots_(nom + ' ' + prenom)) continue;
    out.push({ nom: pecCap_(nom), prenom: pecCap_(prenom), fonction: col.fonction !== undefined ? pecFonction_(l[col.fonction]) : '' });
  }
  return out;
}
var PEC_DATE_ = /(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4})/;
/** Une date de naissance plausible : âge d'au moins 15 ans (écarte la date de la lettre, « Le : 21/10/2026 »). */
function pecNaissance_(m) { var a = Number(m[3]); return a >= 1930 && a <= new Date().getFullYear() - 15; }
function pecNumeros_(t) { return String(t).replace(/\b\d[\d\s]{7,}\b/g, ' ').replace(/\b\d{5,}\b/g, ' '); }
/** Mots d'en-tête de colonne (jamais un nom de personne). */
function pecEnteteMots_(txt) { var t = pecNorm_(txt).split(' ').filter(Boolean); return t.length > 0 && t.every(function (w) { return /^(mat|matricule|nom|prenom|prenoms|date|nais|naiss|naissance|fonction|poste|n|no|ntn|nin|num|numero|liste|nominative|n°)$/.test(w.replace(/[^a-z0-9°]/g, '')) || !/[a-z]{2}/.test(w); }); }
function pecIdentite_(avant, apres) {
  var mots = String(avant).replace(/^[\s|\-–•*]*(?:\d{1,3}\s*[.\-)]?\s+)?/, '').replace(/[|_]+/g, ' ').trim().split(/\s+/).filter(function (w) { return /[A-Za-zÀ-ÿ]/.test(w); });
  if (mots.length < 2 || pecEnteteMots_(mots.join(' '))) return null;
  return { nom: pecCap_(mots[0]), prenom: pecCap_(mots.slice(1).join(' ')), fonction: pecFonction_(pecNumeros_(apres)) };
}
/** Texte lu colonne par colonne (l'OCR vide d'abord toute la colonne NOM, puis PRÉNOM, puis FONCTION…) : on recolle les colonnes ligne à ligne. */
function pecLireColonnes_(lignes) {
  var marques = [], i;
  for (i = 0; i < lignes.length; i += 1) {
    var mots = lignes[i].split(/\s+/);
    if (mots.length <= 3 && pecEnteteMots_(lignes[i])) marques.push({ i: i, type: pecEntete_(lignes[i].replace(/\bnais\w*|\bdate\b/gi, '').trim()) || (pecEntete_(lignes[i]) || '') });
  }
  var cols = {}, k;
  for (k = 0; k < marques.length; k += 1) {
    var m = marques[k]; if (!m.type || cols[m.type]) continue;
    var fin = k + 1 < marques.length ? marques[k + 1].i : lignes.length, vals = lignes.slice(m.i + 1, fin).filter(function (x) { return /[A-Za-zÀ-ÿ]{2}/.test(x) && !pecEnteteMots_(x); });
    cols[m.type] = vals;
  }
  if (!cols.nom || !cols.prenom || cols.nom.length < 1 || cols.nom.length !== cols.prenom.length) return [];
  var fct = cols.fonction && cols.fonction.length === cols.nom.length ? cols.fonction : null;
  return cols.nom.map(function (n, j) { return { nom: pecCap_(n), prenom: pecCap_(cols.prenom[j]), fonction: fct ? pecFonction_(fct[j]) : '' }; });
}
/** Texte brut (lignes) → personnes. */
function pecLireTexte_(texte) {
  var lignes = String(texte || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean), out = [], i, m;
  // 1) une ligne par personne, la date de naissance sépare identité et fonction
  lignes.forEach(function (l, k) {
    m = PEC_DATE_.exec(l); if (!m || m.index < 0 || !pecNaissance_(m)) return;
    var avant = l.slice(0, m.index), apres = l.slice(m.index + m[0].length);
    if (/:/.test(avant)) return;
    var p = avant.trim().length >= 3 ? pecIdentite_(avant, apres) : null;
    if (!p && k > 0) {                       // l'OCR a séparé l'identité (ligne précédente) de la date et de la fonction
      var prec = lignes[k - 1]; if (!PEC_DATE_.test(prec)) p = pecIdentite_(prec, apres);
    }
    if (!p && avant.trim().length >= 3 && k > 0 && pecEnteteMots_(avant)) { var pr = lignes[k - 1]; if (!PEC_DATE_.test(pr)) p = pecIdentite_(pr, apres); }
    if (p) out.push(p);
  });
  if (out.length) return out;
  // 1 bis) lecture colonne par colonne
  out = pecLireColonnes_(lignes); if (out.length) return out;
  // 2) une cellule par ligne : [n°] nom, prénom, date, fonction, numéro
  for (i = 0; i < lignes.length; i += 1) {
    m = PEC_DATE_.exec(lignes[i]); if (!m || lignes[i].replace(PEC_DATE_, '').trim().length > 2 || !pecNaissance_(m)) continue;
    var j = i - 1, ident = [];
    while (j >= 0 && ident.length < 2 && /[A-Za-zÀ-ÿ]{2}/.test(lignes[j]) && !PEC_DATE_.test(lignes[j])) { ident.unshift(lignes[j]); j -= 1; }
    if (ident.length === 2) out.push({ nom: pecCap_(ident[0]), prenom: pecCap_(ident[1]), fonction: i + 1 < lignes.length && /[A-Za-zÀ-ÿ]{3}/.test(lignes[i + 1]) && !PEC_DATE_.test(lignes[i + 1]) ? pecFonction_(lignes[i + 1]) : '' });
  }
  if (out.length) return out;
  // 3) lignes « Nom Prénom » seules
  var re = /^\s*(?:[-–—•*]\s*|\d{1,2}[\.\)]\s*)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-]*)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-]*)\s*$/;
  lignes.forEach(function (l) { var x = re.exec(l); if (x) out.push({ nom: pecCap_(x[1]), prenom: pecCap_(x[2]), fonction: '' }); });
  return out;
}
/** Date de début : formules habituelles ; à défaut la date de la lettre (« Le : 21/10/2026 »). */
function pecLireDate_(texte) {
  var pats = [/ceci est du\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i, /à compter du\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i, /a compter du\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    /prise en charge[^\.]*?du\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i, /\ble\s*:\s*(\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*\d{4})/i];
  for (var k = 0; k < pats.length; k += 1) { var m = String(texte || '').match(pats[k]); if (m) return m[1].replace(/\s+/g, '').replace(/-/g, '/'); }
  return null;
}

/** Service du projet (colonne « Service » du Suivi CPM) → émputation de la liste (accents, casse et « Service » en tête indifférents), '' si aucune ne correspond. */
function pecServiceVersEmputation_(service, emputations) {
  var n = pecNorm_(service).replace(/^service\s+/, ''); if (!n) return '';
  for (var i = 0; i < emputations.length; i += 1) { var e = pecNorm_(emputations[i]).replace(/^service\s+/, ''); if (e === n || e.indexOf(n) >= 0 || n.indexOf(e) >= 0) return emputations[i]; }
  return '';
}
