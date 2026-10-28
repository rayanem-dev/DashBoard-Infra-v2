/**
 * _autodetect — lit un PDF (prise en charge, demande de prise en charge, liste de personnel…) et en tire :
 *   Nom · Prénom · Fonction · Entreprise · Contrat
 * Aucune dépendance à installer : pdf.js (texte du PDF) et tesseract.js (PDF scanné) sont chargés à la demande depuis cdnjs.
 *
 *   AutoDetect.lireFichier(file, opt?)    → Promise<{ texte, source: 'pdf' | 'ocr' }>   (texte avec une tabulation entre les cellules d'une ligne)
 *   AutoDetect.analyser(texte)            → { entreprise, contrat, intitule, date, personnes: [{ nom, prenom, fonction, verifier }], avertissements: [] }
 *   AutoDetect.depuisFichier(file)        → Promise<analyser(...) + { source }>
 *   AutoDetect.versTsv(resultat)          → texte « Nom ⇥ Prénom ⇥ Fonction ⇥ Entreprise ⇥ Contrat » à coller dans un import
 *
 * L'analyse (analyser) est pure : elle se teste en Node, sans navigateur. Voir README.md.
 */
var AutoDetect = (function () {
  var CDN = { pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', ocr: 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js' };

  // ---------- analyse (pure) ----------
  function vide(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function norm(s) { return vide(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  var FORMES = /\b(sarl|eurl|spa|snc|sas|etb|etbe|ets|scs|groupe|enterprise|entreprise|sté|ste|societe|société)\b/i;
  var MAJ = "A-ZÀ-ÖØ-Ý", MIN = "a-zà-öø-ÿ";
  var RE_CONTRAT = /\b(\d{1,3}\s?\.\s?[A-Z]{2,8}\s?\.\s?\d{2})\b/;
  var RE_DATE = /\b(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})\b/;

  /** « CHAREF Kamel » → { nom: 'CHAREF', prenom: 'Kamel' } ; tout en majuscules : le 1er mot est le nom (à vérifier). */
  function separerNom(t) {
    var m = vide(t).split(' ').filter(Boolean);
    if (!m.length) return { nom: '', prenom: '', verifier: false };
    if (m.length === 1) return { nom: m[0], prenom: '', verifier: true };
    var i = -1; for (var j = 0; j < m.length; j += 1) { if (new RegExp('[' + MIN + ']').test(m[j])) { i = j; break; } }
    if (i > 0) return { nom: m.slice(0, i).join(' '), prenom: m.slice(i).join(' '), verifier: false };
    return { nom: m[0], prenom: m.slice(1).join(' '), verifier: true };
  }
  function cellules(ligne) { return String(ligne).split(/\t| {3,}| \| /).map(vide).filter(function (c) { return c !== ''; }); }
  function estEnteteNom(c) { var n = norm(c); return /^(nom( et| &)? prenom|nom prenom|nom et prenoms?|noms? et prenoms?|agent|personne)$/.test(n) || n === 'nom'; }

  function analyser(texte) {
    var lignes = String(texte || '').replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/ /g, ' ').replace(/[ ]+$/, ''); }).filter(function (l) { return vide(l) !== ''; });
    var res = { entreprise: '', contrat: '', intitule: '', date: '', personnes: [], avertissements: [] };
    var plein = lignes.join('\n');

    var mc = plein.match(RE_CONTRAT); if (mc) res.contrat = mc[1].replace(/\s+/g, '');
    var md = plein.match(/(?:à compter du|a compter du|du|le)\s*:?\s*(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})/i) || plein.match(RE_DATE); if (md) res.date = md[1].replace(/[-.]/g, '/');

    // entreprise : « Entreprise : XXX », sinon une ligne qui porte une forme juridique (hors Sonatrach)
    for (var i = 0; i < lignes.length && !res.entreprise; i += 1) {
      var m = lignes[i].match(/(?:entreprise|soci[ée]t[ée]|prestataire|st[ée]|contractant|cocontractant)\s*[:：]\s*([^\t]+?)\s*(?:\t|$)/i);
      if (m && vide(m[1]).length > 2) res.entreprise = vide(m[1]).replace(/[,;.]+$/, '');
    }
    for (i = 0; i < lignes.length && !res.entreprise; i += 1) {
      cellules(lignes[i]).forEach(function (c) { if (!res.entreprise && FORMES.test(c) && !/sonatrach|division|direction|r[ée]publique/i.test(c) && c.length < 70) res.entreprise = c.replace(/^(contrat|entreprise|soci[ée]t[ée])\s*[:\-]?\s*/i, ''); });
    }
    // intitulé : la ligne qui suit le n° de contrat quand elle n'est pas un en-tête
    if (res.contrat) { for (i = 0; i < lignes.length; i += 1) { if (lignes[i].replace(/\s/g, '').indexOf(res.contrat) >= 0 && lignes[i + 1] && !/nom|pr[ée]nom|fonction/i.test(lignes[i + 1]) && vide(lignes[i + 1]).length < 120) { res.intitule = vide(lignes[i + 1]); break; } } }

    // personnes — 1) tableau avec en-têtes
    var idxEnt = -1, col = null;
    for (i = 0; i < lignes.length; i += 1) {
      var cs = cellules(lignes[i]); if (cs.length < 2) { if (!(cs.length === 1 && estEnteteNom(cs[0]) && /prenom/.test(norm(cs[0])))) continue; }
      var c = { nom: -1, prenom: -1, fonction: -1, nomPrenom: -1 };
      cs.forEach(function (x, k) {
        var n = norm(x);
        if (/^(nom ?(et|&)? ?prenoms?|nom prenom|noms? et prenoms?)$/.test(n)) c.nomPrenom = k;
        else if (/^prenoms?$/.test(n)) c.prenom = k;
        else if (/^noms?$/.test(n)) c.nom = k;
        else if (/^(fonction|poste|qualite|qualification|grade|metier)$/.test(n)) c.fonction = k;
      });
      if ((c.nom >= 0 && c.prenom >= 0) || c.nomPrenom >= 0) { idxEnt = i; col = c; break; }
    }
    if (col) {
      for (i = idxEnt + 1; i < lignes.length; i += 1) {
        var r = cellules(lignes[i]);
        if (/^(le chef|signature|visa|fait a|fait le|cachet)/.test(norm(lignes[i]))) break;
        if (!r.length) continue;
        var p;
        if (col.nomPrenom >= 0) { var cell = r[col.nomPrenom]; if (!cell || !/[A-Za-zÀ-ÿ]{2}/.test(cell)) continue; p = separerNom(cell); }
        else { if (r.length <= Math.max(col.nom, col.prenom)) continue; p = { nom: r[col.nom], prenom: r[col.prenom], verifier: false }; }
        if (!p.nom || /^\d+$/.test(p.nom)) continue;
        p.fonction = col.fonction >= 0 && r[col.fonction] ? r[col.fonction] : '';
        res.personnes.push(p);
      }
    }
    // 2) liste simple : « 1. NOM Prénom — fonction »
    if (!res.personnes.length) {
      var re = new RegExp('^\\s*(?:[-–•*]\\s*|\\d{1,2}\\s*[.)\\-]\\s*)?([' + MAJ + "'\\-]{2,}(?: [" + MAJ + "'\\-]{2,})*)\\s+([" + MAJ + '][' + MIN + "'\\-]+(?: [" + MAJ + '][' + MIN + "'\\-]+)*)\\s*(?:[-–—,:/]\\s*(.+))?$");
      lignes.forEach(function (l) { var m2 = l.match(re); if (m2 && !FORMES.test(l) && !/sonatrach|division|direction/i.test(l)) res.personnes.push({ nom: m2[1], prenom: m2[2], fonction: vide(m2[3]), verifier: false }); });
    }
    var vus = {}; res.personnes = res.personnes.filter(function (p) { var k = norm(p.nom + ' ' + p.prenom); if (!k || vus[k]) return false; vus[k] = 1; return true; });
    if (!res.personnes.length) res.avertissements.push('Aucune personne reconnue : le PDF est peut-être une image de mauvaise qualité.');
    if (!res.entreprise) res.avertissements.push('Entreprise non reconnue.');
    if (!res.contrat) res.avertissements.push('N° de contrat non reconnu.');
    if (res.personnes.some(function (p) { return p.verifier; })) res.avertissements.push('Nom / prénom à vérifier (impossible de les séparer sûrement).');
    return res;
  }
  function versTsv(r) {
    return (r.personnes || []).map(function (p) { return [p.nom, p.prenom, p.fonction || '', r.entreprise || '', r.contrat || ''].join('\t'); }).join('\n');
  }

  // ---------- lecture du fichier (navigateur) ----------
  function charger(src) { return new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('Chargement impossible : ' + src)); }; document.head.appendChild(s); }); }
  /** Lignes du PDF : les éléments de texte sont regroupés par hauteur, une tabulation sépare deux cellules éloignées. */
  /** Écarts entre lignes successives (déjà triées) : un écart nettement plus grand que l'écart habituel sépare deux lignes d'un tableau. */
  function ecartsLarges(ecarts) { var t = ecarts.slice().sort(function (a, b) { return a - b; }), med = t.length ? t[Math.floor(t.length / 2)] : 0; return ecarts.map(function (e) { return med > 0 && e > med * 1.35; }); }
  function lignesDePage(items, opt) {
    var rangs = [];
    items.forEach(function (it) { if (!vide(it.str)) return; var y = Math.round(it.transform[5] / 3) * 3, r = rangs.filter(function (z) { return Math.abs(z.y - y) <= 3; })[0]; if (!r) { r = { y: y, t: [] }; rangs.push(r); } r.t.push({ x: it.transform[4], w: it.width || 0, s: it.str }); });
    rangs.sort(function (a, b) { return b.y - a.y; });
    var lignes = rangs.map(function (r) { r.t.sort(function (a, b) { return a.x - b.x; }); var out = '', fin = null; r.t.forEach(function (e) { if (fin !== null) out += (e.x - fin > 14 ? '\t' : ' '); out += e.s; fin = e.x + e.w; }); return out; });
    if (!(opt && opt.interlignes)) return lignes;
    var larges = ecartsLarges(rangs.slice(1).map(function (r, i) { return rangs[i].y - r.y; })), avecBlancs = [];   // option : une ligne vide marque l'espace entre deux rangées de tableau
    lignes.forEach(function (l, i) { if (i > 0 && larges[i - 1]) avecBlancs.push(''); avecBlancs.push(l); });
    return avecBlancs;
  }
  function lirePdfTexte(data, opt) {
    return charger(CDN.pdf).then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
      return window.pdfjsLib.getDocument({ data: data }).promise;
    }).then(function (pdf) {
      var pages = []; for (var n = 1; n <= Math.min(pdf.numPages, 10); n += 1) pages.push(n);
      return pages.reduce(function (p, n) { return p.then(function (acc) { return pdf.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) { return acc.concat(lignesDePage(tc.items, opt)); }); }); }, Promise.resolve([])).then(function (l) { return { pdf: pdf, texte: l.join('\n') }; });
    });
  }
  /** Niveaux de gris + étirement du contraste : un scan à 100 ppi est lu bien mieux (chiffres d'un tableau) qu'en couleur. */
  function griser(cv) { var cx = cv.getContext('2d'), im = cx.getImageData(0, 0, cv.width, cv.height), d = im.data, mn = 255, mx = 0, i, g; for (i = 0; i < d.length; i += 4) { g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000; d[i] = d[i + 1] = d[i + 2] = g; if (g < mn) mn = g; if (g > mx) mx = g; } var k = mx > mn ? 255 / (mx - mn) : 1; for (i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, (d[i] - mn) * k)); cx.putImageData(im, 0, 0); }
  /** Texte de l'OCR où une ligne vide sépare deux lignes d'un tableau (écart vertical plus grand que d'habitude). */
  function texteOcrAvecEcarts(d) {
    var l = (d.lines || []).filter(function (x) { return x.text && x.text.trim(); }); if (l.length < 4) return d.text;
    var larges = ecartsLarges(l.slice(1).map(function (x, i) { return x.bbox.y0 - l[i].bbox.y1; }).map(function (e) { return Math.max(0, e) + 1; })), out = [];
    l.forEach(function (x, i) { if (i > 0 && larges[i - 1]) out.push(''); out.push(x.text.replace(/\s+$/, '')); });
    return out.join('\n');
  }
  /**
   * Colonnes de montants relues à part : les chiffres d'un tableau scanné sont mieux lus quand la colonne est découpée, agrandie et lue avec la seule liste « 0-9 , . espace »
   * (le « 5 » de « 5 600,00 » ou un prix sous un tampon, perdus par la lecture de la page entière). Les montants à 2 décimales sont regroupés par bord droit (jusqu'à 3 colonnes) ;
   * pour chaque colonne, les mots de la page qui y figurent sont remplacés par la relecture, ligne par ligne (même hauteur). d = résultat de la lecture de la page.
   */
  function reprendreChiffres(cv, d, lecteur) {
    var mots = []; (d.lines || []).forEach(function (l) { (l.words || []).forEach(function (w) { mots.push(w); }); });
    var montants = mots.filter(function (w) { return /^\d[\d.,:;']*[.,:;]\d{2}$/.test(w.text.replace(/\s/g, '')) && w.bbox.y1 - w.bbox.y0 < 90; }), cols = [];
    montants.forEach(function (w) { var c = cols.filter(function (k) { return Math.abs(k.x1 - w.bbox.x1) < 60; })[0]; if (!c) { c = { x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1, n: 0, ys: [] }; cols.push(c); } c.n += 1; c.ys.push((w.bbox.y0 + w.bbox.y1) / 2); c.x0 = Math.min(c.x0, w.bbox.x0); c.x1 = Math.max(c.x1, w.bbox.x1); c.y0 = Math.min(c.y0, w.bbox.y0); c.y1 = Math.max(c.y1, w.bbox.y1); });
    cols = cols.filter(function (c) { return c.n >= 3; }).sort(function (a, b) { return b.x1 - a.x1; }).slice(0, 3);
    cols.forEach(function (c) { c.voisine = null; cols.forEach(function (o) { if (o !== c && o.x1 < c.x0 && (!c.voisine || o.x1 > c.voisine)) c.voisine = o.x1; }); });   // colonne de chiffres à gauche : la bande s'arrête contre elle
    if (!cols.length) return Promise.resolve(d);
    var remplacements = [];   // { ligne, x0, texte }
    var suite = function (k) {
      if (k >= cols.length) return Promise.resolve();
      var c = cols[k], x0 = Math.max(0, c.x0 - 130), x1 = Math.min(cv.width, c.x1 + 25), y0 = Math.max(0, c.y0 - 150), y1 = Math.min(cv.height, c.y1 + 150), h;
      if (c.voisine !== null) x0 = Math.max(x0, c.voisine + 8);
      mots.forEach(function (w) { if (/[A-Za-zÀ-ÿ]/.test(w.text) && !/\d/.test(w.text) && w.bbox.x1 - w.bbox.x0 < 200 && w.bbox.x1 > x0 && w.bbox.x0 < c.x0 && c.ys.some(function (y) { return Math.abs(y - (w.bbox.y0 + w.bbox.y1) / 2) < 20; })) x0 = Math.max(x0, w.bbox.x1 + 3); });   // pas de lettres (unité) dans la bande : seuls comptent les mots à la hauteur d'un montant
      if (x1 - x0 < 40) return suite(k + 1);
      var bande = document.createElement('canvas'); bande.width = (x1 - x0) * 2; bande.height = (y1 - y0) * 2;
      bande.getContext('2d').drawImage(cv, x0, y0, x1 - x0, y1 - y0, 0, 0, bande.width, bande.height);
      return lecteur().then(function (wd) { return wd.recognize(bande); }).then(function (r) {
        (r.data.lines || []).forEach(function (l2) {
          var t = l2.text.replace(/[^\d ,.]/g, ' ').replace(/\s+/g, ' ').trim(); if (!/\d[\d ]*[.,]\d{2}$/.test(t)) return;
          var yc = y0 + (l2.bbox.y0 + l2.bbox.y1) / 4, meilleure = null;
          (d.lines || []).forEach(function (l1) { var h1 = l1.bbox.y1 - l1.bbox.y0, dy = Math.abs((l1.bbox.y0 + l1.bbox.y1) / 2 - yc); if (dy < Math.max(14, h1 * 0.8) && (!meilleure || dy < meilleure.dy)) meilleure = { l: l1, dy: dy }; });
          if (meilleure) remplacements.push({ ligne: meilleure.l, x0: x0, x1: x1, texte: t });
        });
      }).then(function () { return suite(k + 1); });
    };
    return suite(0).then(function () {
      var parLigne = [];
      remplacements.forEach(function (r) { var e = parLigne.filter(function (p) { return p.ligne === r.ligne; })[0]; if (!e) { e = { ligne: r.ligne, r: [] }; parLigne.push(e); } if (!e.r.some(function (z) { return z.x0 === r.x0; })) e.r.push(r); });
      parLigne.forEach(function (e) {   // mots de la ligne hors des bandes relues + montants relus, dans l'ordre de gauche à droite
        var items = (e.ligne.words || []).filter(function (w) { return !e.r.some(function (z) { return w.bbox.x0 >= z.x0 - 4 && w.bbox.x1 <= z.x1 + 4; }); }).map(function (w) { return { x: w.bbox.x0, t: w.text }; });
        e.r.forEach(function (z) { items.push({ x: z.x0, t: z.texte }); });
        e.ligne.text = items.sort(function (a, b) { return a.x - b.x; }).map(function (z) { return z.t; }).join(' ');
      });
      return d;
    });
  }
  function lireOcr(pdf, opt) {
    return charger(CDN.ocr).then(function () { return window.Tesseract.createWorker('fra'); }).then(function (w) {
      var out = [], wd = null;
      var lecteur = function () { return wd ? Promise.resolve(wd) : window.Tesseract.createWorker('fra').then(function (w2) { return w2.setParameters({ tessedit_char_whitelist: '0123456789 ,.', tessedit_pageseg_mode: '4' }).then(function () { wd = w2; return w2; }); }); };
      var suite = function (n) {
        if (n > Math.min(pdf.numPages, (opt && opt.pages) || 5)) return Promise.all([w.terminate(), wd ? wd.terminate() : null]).then(function () { return out.join('\n'); });
        if (opt && opt.progres) opt.progres(n, Math.min(pdf.numPages, opt.pages || 5));
        return pdf.getPage(n).then(function (pg) {
          var vp = pg.getViewport({ scale: (opt && opt.echelle) || 2.2 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
          return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(function () { if (opt && opt.gris) griser(cv); return w.recognize(cv).then(function (r) { return opt && opt.chiffres ? reprendreChiffres(cv, r.data, lecteur) : r.data; }); });
        }).then(function (data) { out.push(opt && opt.interlignes ? texteOcrAvecEcarts(data) : (opt && opt.chiffres ? (data.lines || []).map(function (l) { return l.text.replace(/\s+$/, ''); }).join('\n') : data.text)); return suite(n + 1); });
      };
      return suite(1);
    });
  }
  /** opt (facultatif) : { echelle: 3, gris: true } pour un scan de faible résolution (tableaux de prix). */
  function lireFichier(file, opt) {
    return file.arrayBuffer().then(function (buf) { return lirePdfTexte(new Uint8Array(buf), opt); }).then(function (r) {
      if (vide(r.texte).length >= 40) return { texte: r.texte, source: 'pdf' };
      return lireOcr(r.pdf, opt).then(function (t) { return { texte: t, source: 'ocr' }; }); // PDF scanné : pas de texte, on lit l'image
    });
  }
  function depuisFichier(file) { return lireFichier(file).then(function (l) { var r = analyser(l.texte); r.source = l.source; r.texte = l.texte; return r; }); }

  var api = { analyser: analyser, versTsv: versTsv, separerNom: separerNom, lireFichier: lireFichier, depuisFichier: depuisFichier };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
