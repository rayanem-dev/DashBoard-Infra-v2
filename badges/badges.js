/* Moteur « Badges prestataires » — sans dépendance, sans accès au navigateur : le même fichier sert
 *  - à l'application autonome (badges/index.html) et à la page du portail (badges.html),
 *  - à la passerelle Apps Script (copié en BadgesMoteur.gs par le déploiement) pour la lecture des « Enquêtes administratives » et la numérotation.
 * Tout ce qui change d'un site à l'autre se règle dans badges/config.js (voir README.md). */
var Badges = (function () {
  'use strict';

  var DEFAUT = {
    titre: 'BADGE PRESTATAIRE',
    base: 'SH RNS BASE DE VIE CENTRALE',        // nom de la base de vie (change selon l'hébergement)
    formatNumero: '{base}-BADGE N° {nn}/{annee}', // {base} {n} {nn} (zéros devant) {annee}
    chiffres: 2, numeroDepart: 1,
    structure: 'INFRA/RNS',                        // valeur par défaut, modifiable badge par badge
    couleur: '#E18500', logo: 'logo-sonatrach.png',
    libelles: { nom: 'NOM', prenom: 'PRENOM', fonction: 'FONCTION', entreprise: 'ENTREPRISE', structure: 'STRUCTURE', contrat: 'CONTRAT N°', visaPrestataire: 'Visa prestataire', visaStructure: 'Visa structure' },
    page: { largeur: 297, hauteur: 210 },          // A4 paysage, en mm
    // Dimensions du MODÈLE (diapositive PowerPoint) : carte 97,6 × 58,7 mm, pas 99,6 × 62 mm ; imprimées à l'échelle de l'A4 (0,877) => carte 85,6 × 51,5 mm
    carte: { largeur: 97.6, hauteur: 58.7 },
    grille: { colonnes: 3, lignes: 3, pasX: 99.6, pasY: 62 },
    echelle: 0.877,
    decalage: { x: 0, y: 0 },                      // calage fin recto (mm)
    verso: { miroir: 'colonnes', decalage: { x: 0, y: 0 } }, // 'colonnes' : retournement par le bord court ; 'lignes' : par le bord long ; 'aucun'
    bordure: true,
    qr: { actif: true, face: 'verso', modele: '{ref}|{prenom} {nom}|{entreprise}|{contrat}' },
    photo: { actif: true },
    arabe: { actif: false },
    police: { famille: 'Berlin Sans FB', taille: 11 }   // police d'impression (doit être installée sur le poste qui imprime ; sinon Calibri / Arial)
  };

  function fusion(base, sur) {
    var o = {};
    Object.keys(base).forEach(function (k) {
      var v = base[k], s = sur && sur[k];
      o[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? fusion(v, (s && typeof s === 'object') ? s : null) : (s === undefined || s === null ? v : s);
    });
    return o;
  }
  function config(sur) { return fusion(DEFAUT, sur || {}); }

  // ---------- Texte ----------
  function vide(s) { s = String(s == null ? '' : s).replace(/[\u200b-\u200f\u202a-\u202e\ufeff\u00a0]/g, ' ').replace(/\s+/g, ' ').trim(); return /^[—–\-\.\s]*$/.test(s) ? '' : s; }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').trim(); }
  function cle(p) { return norm(p.nom) + '|' + norm(p.prenom) + '|' + norm(p.entreprise); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function majuscules(s) { return String(s || '').toLocaleUpperCase('fr'); }

  // ---------- Numérotation ----------
  function pad(n, c) { var s = String(n); while (s.length < c) s = '0' + s; return s; }
  function formaterRef(cfg, n, annee) {
    return String(cfg.formatNumero).replace('{base}', cfg.base).replace('{nn}', pad(n, cfg.chiffres)).replace('{n}', String(n)).replace('{annee}', String(annee));
  }
  function prochain(hist, annee, cfg) {
    var m = (cfg && cfg.numeroDepart ? cfg.numeroDepart : 1) - 1;
    (hist || []).forEach(function (h) { if (Number(h.annee) === Number(annee) && Number(h.n) > m) m = Number(h.n); });
    return m + 1;
  }
  /** Donne un numéro à chaque badge : celui déjà attribué cette année à la même personne (même entreprise), sinon le suivant. Ne modifie rien. */
  function attribuer(hist, items, annee, cfg) {
    var connus = {};
    (hist || []).forEach(function (h) { if (Number(h.annee) === Number(annee)) connus[h.cle || cle(h)] = Number(h.n); });
    var suivant = prochain(hist, annee, cfg), sortie = [], nouveaux = [];
    items.forEach(function (it) {
      var k = cle(it), n = it.n ? Number(it.n) : connus[k], reutilise = !!n;
      if (!n) { n = suivant; suivant += 1; connus[k] = n; }
      var o = {}; Object.keys(it).forEach(function (x) { o[x] = it[x]; });
      o.n = n; o.annee = Number(annee); o.ref = formaterRef(cfg, n, annee); o.reutilise = reutilise;
      sortie.push(o);
      if (!reutilise) nouveaux.push(o);
    });
    return { items: sortie, nouveaux: nouveaux };
  }

  // ---------- Noms ----------
  function decouperNom(fr, nomAr) {
    var t = vide(fr).split(' ').filter(Boolean);
    if (!t.length) return { nom: '', prenom: '', verifier: false };
    if (t.length === 1) return { nom: t[0], prenom: '', verifier: false };
    var i = -1;
    for (var j = 0; j < t.length; j += 1) { if (/[a-zà-ÿ]/.test(t[j])) { i = j; break; } }
    if (i > 0) return { nom: t.slice(0, i).join(' '), prenom: t.slice(i).join(' '), verifier: false };
    var k = vide(nomAr).split(' ').filter(Boolean).length;
    if (k >= 1 && k < t.length) return { nom: t.slice(0, k).join(' '), prenom: t.slice(k).join(' '), verifier: false };
    return { nom: t[0], prenom: t.slice(1).join(' '), verifier: true };
  }

  // ---------- Lecture des « Enquêtes administratives » (un onglet par prestataire) ----------
  function sansEsp(s) { return String(s == null ? '' : s).replace(/\s+/g, ''); }
  function analyserEnquetes(lignes, onglet) {
    lignes = lignes || [];
    var h = -1, i, j;
    for (i = 0; i < Math.min(lignes.length, 12) && h < 0; i += 1) {
      if ((lignes[i] || []).some(function (c) { return sansEsp(c).indexOf('بالفرنسية') >= 0; })) h = i;
    }
    if (h < 0) return { onglet: onglet, entreprise: vide(onglet), personnes: [], erreur: 'en-têtes introuvables' };
    var col = { fr: -1, fonction: -1, prenomAr: -1, nomAr: -1 };
    (lignes[h] || []).forEach(function (c, x) {
      var s = sansEsp(c);
      if (s.indexOf('بالفرنسية') >= 0) col.fr = x;
      else if (s.indexOf('الوظيفة') >= 0) col.fonction = x;
      else if (s === 'الإسم' || s === 'الاسم') col.prenomAr = x;
      else if (s === 'اللقب') col.nomAr = x;
    });
    var societe = '';
    for (i = 0; i < h && !societe; i += 1) {
      for (j = 0; j < (lignes[i] || []).length && !societe; j += 1) {
        var c = String(lignes[i][j] || '');
        if (c.indexOf('القائمة') >= 0) { var lat = c.replace(/[\u0600-\u06ff\u200f\u200e]+/g, ' ').replace(/\s+/g, ' ').trim(); if (/[A-Za-z]{2}/.test(lat)) societe = lat; }
      }
    }
    var personnes = [];
    for (i = h + 1; i < lignes.length; i += 1) {
      var l = lignes[i] || [], fr = col.fr >= 0 ? vide(l[col.fr]) : '';
      if (!fr) continue;
      var nomAr = col.nomAr >= 0 ? vide(l[col.nomAr]) : '', prenomAr = col.prenomAr >= 0 ? vide(l[col.prenomAr]) : '';
      var d = decouperNom(fr, nomAr);
      personnes.push({ nom: d.nom, prenom: d.prenom, fonction: col.fonction >= 0 ? vide(l[col.fonction]) : '', nomAr: nomAr, prenomAr: prenomAr, verifier: d.verifier, onglet: onglet, ligne: i + 1 });
    }
    return { onglet: onglet, entreprise: societe || vide(onglet), personnes: personnes };
  }

  // ---------- Import de texte (CSV, ou collé depuis Excel) ----------
  function lireCsv(texte) {
    texte = String(texte || '').replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
    var premiere = texte.split('\n')[0] || '', sep = '\t';
    if (premiere.indexOf('\t') < 0) sep = (premiere.split(';').length >= premiere.split(',').length) ? ';' : ',';
    var lignes = [], l = [], c = '', q = false, i, ch;
    for (i = 0; i < texte.length; i += 1) {
      ch = texte[i];
      if (q) { if (ch === '"') { if (texte[i + 1] === '"') { c += '"'; i += 1; } else q = false; } else c += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { l.push(c); c = ''; }
      else if (ch === '\n') { l.push(c); lignes.push(l); l = []; c = ''; }
      else c += ch;
    }
    if (c !== '' || l.length) { l.push(c); lignes.push(l); }
    return lignes.filter(function (x) { return x.some(function (y) { return String(y).trim() !== ''; }); });
  }
  var ALIAS = { nom: ['nom', 'name', 'lastname', 'اللقب'], prenom: ['prenom', 'prénom', 'firstname', 'الاسم'], fonction: ['fonction', 'poste', 'function', 'الوظيفة'], entreprise: ['entreprise', 'societe', 'société', 'prestataire', 'company'], contrat: ['contrat', 'n contrat', 'n° contrat', 'numero contrat', 'contract'], structure: ['structure', 'service', 'direction'], nomAr: ['nom arabe', 'nom ar'], prenomAr: ['prenom arabe', 'prénom arabe', 'prenom ar'] };
  /** Lignes d'un tableau → personnes. Reconnaît aussi un onglet « Enquêtes administratives » collé tel quel. */
  function personnesDepuisTableau(lignes, defauts) {
    defauts = defauts || {};
    if (!lignes.length) return { personnes: [], ignorees: 0 };
    if (lignes.slice(0, 12).some(function (l) { return l.some(function (c) { return sansEsp(c).indexOf('بالفرنسية') >= 0; }); })) {
      var a = analyserEnquetes(lignes, defauts.entreprise || '');
      return { personnes: a.personnes.map(function (p) { p.entreprise = defauts.entreprise || a.entreprise; p.contrat = defauts.contrat || ''; return p; }), ignorees: 0 };
    }
    var en = lignes[0].map(function (c) { return norm(c); }), idx = {};
    Object.keys(ALIAS).forEach(function (k) { en.forEach(function (c, x) { if (idx[k] === undefined && ALIAS[k].map(norm).indexOf(c) >= 0) idx[k] = x; }); });
    var debut = Object.keys(idx).length >= 2 ? 1 : 0;
    if (!debut) { idx = { nom: 0, prenom: 1, fonction: 2, entreprise: 3, contrat: 4, structure: 5 }; }
    var out = [], ign = 0;
    lignes.slice(debut).forEach(function (l) {
      var p = {}; Object.keys(idx).forEach(function (k) { p[k] = vide(l[idx[k]]); });
      if (!p.nom && !p.prenom) { ign += 1; return; }
      if (!p.entreprise) p.entreprise = defauts.entreprise || '';
      if (!p.contrat) p.contrat = defauts.contrat || '';
      out.push(p);
    });
    return { personnes: out, ignorees: ign };
  }

  // ---------- Mise en page ----------
  function mm(v) { return (Math.round(v * 100) / 100) + 'mm'; }
  function taillePolice(txt, base, limite) { var n = String(txt || '').length; if (n <= limite) return base; return Math.max(base - 0.2 * (n - limite), base * 0.58); }
  function positions(cfg, verso) {
    var g = cfg.grille, E = cfg.echelle, w = ((g.colonnes - 1) * g.pasX + cfg.carte.largeur) * E, h = ((g.lignes - 1) * g.pasY + cfg.carte.hauteur) * E;
    var x0 = (cfg.page.largeur - w) / 2 + cfg.decalage.x + (verso ? cfg.verso.decalage.x : 0);
    var y0 = (cfg.page.hauteur - h) / 2 + cfg.decalage.y + (verso ? cfg.verso.decalage.y : 0);
    return { x0: x0, y0: y0 };
  }
  function casesParFeuille(cfg) { return cfg.grille.colonnes * cfg.grille.lignes; }
  /** Répartit les badges par feuille (une feuille = un recto puis son verso). caseDepart : 1 = première case. */
  function planifier(items, cfg, caseDepart) {
    var par = casesParFeuille(cfg), feuilles = [], i = 0, depart = Math.max(1, Math.min(par, Number(caseDepart) || 1)) - 1;
    while (i < items.length) {
      var cases = [], debut = feuilles.length ? 0 : depart;
      for (var c = debut; c < par && i < items.length; c += 1, i += 1) cases.push({ index: c, item: items[i] });
      feuilles.push(cases);
    }
    return feuilles;
  }
  // Mise en page IDENTIQUE au modèle BADGE_ENCC.pptx (coordonnées de la diapositive, en mm, relevées dans le fichier) :
  // Berlin Sans FB 11 pt non gras ; logo 12,65 × 16,85 à (5,1 ; 3,7) ; trait haut à (37,2 ; 7,1) jusqu'au bord droit ; trait bas à (0 ; 50,8), 60,3 de long ;
  // titre à droite sur la 1re ligne ; NOM / PRENOM / FONCTION / ENTREPRISE / STRUCTURE tous les 5,15 mm à partir de 26,1 ; pied de page tout en bas (54,6).
  var G = { marge: 1.9, titreX: 52, lignes: [26.1, 31.25, 36.4, 41.55, 46.7], deuxPoints: 24.5, valeur: 27.5, base1: 3.9, pied: 55.9, trait1: { x: 37.2, y: 8.4, w: 60.4, h: 1.23 }, trait2: { x: 0, y: 50.8, w: 60.33, h: 1.28 }, logo: { x: 5.1, y: 2.2, w: 12.65 }, photo: { x: 72.5, y: 11, w: 22, h: 28 }, qr: { x: 39.8, y: 30, t: 18 } }; // QR centré entre « Visa prestataire » et « Visa structure » (zones de signature laissées libres)
  function txt(x, baseline, T, contenu, extra, droite) {
    var top = baseline - 0.9 * T * 0.3528; // la position donnée est celle de la ligne d'écriture
    return '<div class="bdg-t" style="' + (droite ? 'right:' + mm(x) : 'left:' + mm(x)) + ';top:' + mm(top) + ';font-size:' + (Math.round(T * 100) / 100) + 'pt;' + (extra || '') + '">' + contenu + '</div>';
  }
  function cartesHtml(it, cfg, verso, opts) {
    opts = opts || {};
    var L = cfg.libelles, T = cfg.police.taille, W = cfg.carte.largeur, E = cfg.echelle, h = '';
    h += '<img class="bdg-logo" src="' + esc(opts.logoUrl || cfg.logo) + '" alt="" style="left:' + mm(G.logo.x) + ';top:' + mm(G.logo.y) + ';width:' + mm(G.logo.w) + '">';
    h += '<div class="bdg-trait" style="left:' + mm(G.trait1.x) + ';top:' + mm(G.trait1.y) + ';width:' + mm(W - G.trait1.x) + ';height:' + mm(G.trait1.h) + '"></div>';
    h += '<div class="bdg-trait" style="left:' + mm(G.trait2.x) + ';top:' + mm(G.trait2.y) + ';width:' + mm(G.trait2.w) + ';height:' + mm(G.trait2.h) + '"></div>';
    var ref = String(it.ref || ''), tp = Math.min(T, Math.round((W - 2 * G.marge) / (Math.max(ref.length, 1) * 0.52 * 0.3528) * 10) / 10);
    h += txt(G.marge, G.pied, tp, esc(ref));
    if (cfg.qr.actif && opts.qr && ((verso && cfg.qr.face !== 'recto') || (!verso && cfg.qr.face === 'recto'))) {
      var q = String(cfg.qr.modele).replace('{ref}', it.ref || '').replace('{prenom}', it.prenom || '').replace('{nom}', it.nom || '').replace('{entreprise}', it.entreprise || '').replace('{contrat}', it.contrat || '').replace('{fonction}', it.fonction || '');
      h += '<div class="bdg-qr" style="left:' + mm(G.qr.x) + ';top:' + mm(G.qr.y) + ';width:' + mm(G.qr.t) + ';height:' + mm(G.qr.t) + '">' + opts.qr(q) + '</div>';
    }
    if (verso) {
      var contrat = L.contrat + (it.contrat ? (/^N°/.test(it.contrat) ? ' ' : '') + it.contrat : '');
      h += txt(G.marge, G.base1, taillePolice(contrat, T, (W - G.trait1.x) / (T * 0.5 * 0.3528)), esc(contrat), 'text-align:right', true);
      h += txt(8.3, G.lignes[0], T, esc(L.visaPrestataire)) + txt(8.3, G.lignes[0], T, esc(L.visaStructure), '', true);
      return h;
    }
    h += txt(G.titreX, G.base1, T, esc(cfg.titre));
    var photo = cfg.photo.actif && it.photo;
    if (photo) h += '<img class="bdg-photo" src="' + esc(it.photo) + '" alt="" style="left:' + mm(G.photo.x) + ';top:' + mm(G.photo.y) + ';width:' + mm(G.photo.w) + ';height:' + mm(G.photo.h) + '">';
    var dispo = (photo ? G.photo.x - 1.5 : W - G.marge) - G.valeur, lim = dispo / (T * 0.5 * 0.3528);
    var champs = [[L.nom, majuscules(it.nom)], [L.prenom, it.prenom], [L.fonction, it.fonction], [L.entreprise, it.entreprise], [L.structure, it.structure || cfg.structure]];
    champs.forEach(function (c, i) {
      h += txt(G.marge, G.lignes[i], T, esc(c[0])) + txt(G.deuxPoints, G.lignes[i], T, ':') + txt(G.valeur, G.lignes[i], taillePolice(c[1], T, lim), esc(c[1]), 'max-width:' + mm(dispo) + ';overflow:hidden');
    });
    if (cfg.arabe.actif && (it.nomAr || it.prenomAr)) h += txt(G.marge, G.lignes[4], T * 0.9, esc((it.prenomAr || '') + ' ' + (it.nomAr || '')), 'direction:rtl;font-family:"Segoe UI",Tahoma,Arial,sans-serif', true);
    return h;
  }
  function feuilleHtml(cases, cfg, verso, opts) {
    var g = cfg.grille, p = positions(cfg, verso), s = '<section class="bdg-feuille' + (verso ? ' bdg-verso' : '') + '">';
    cases.forEach(function (c) {
      var col = c.index % g.colonnes, lig = Math.floor(c.index / g.colonnes);
      if (verso && cfg.verso.miroir === 'colonnes') col = g.colonnes - 1 - col;
      else if (verso && cfg.verso.miroir === 'lignes') lig = g.lignes - 1 - lig;
      s += '<div class="bdg-carte" style="left:' + mm(p.x0 + col * g.pasX * cfg.echelle) + ';top:' + mm(p.y0 + lig * g.pasY * cfg.echelle) + '"><div class="bdg-m">' + cartesHtml(c.item, cfg, verso, opts) + '</div></div>';
    });
    return s + '</section>';
  }
  /** Toutes les feuilles : recto 1, verso 1, recto 2, verso 2… (impression recto-verso automatique). */
  function feuillesHtml(items, cfg, opts) {
    opts = opts || {};
    return planifier(items, cfg, opts.caseDepart).map(function (cases) {
      return feuilleHtml(cases, cfg, false, opts) + (opts.recto === true ? '' : feuilleHtml(cases, cfg, true, opts));
    }).join('');
  }
  /** Page de calage : mêmes positions que les badges, avec repères numérotés (à imprimer en recto-verso pour régler le décalage). */
  function calibrageHtml(cfg, opts) {
    var items = [], n = casesParFeuille(cfg);
    for (var i = 1; i <= n; i += 1) items.push({ nom: 'CALAGE', prenom: 'Case ' + i, fonction: 'Repère recto-verso', entreprise: 'Test d\'alignement', structure: '', contrat: 'TEST', ref: 'CASE ' + i + ' / ' + n });
    return feuillesHtml(items, cfg, opts);
  }
  function css(cfg) {
    var W = cfg.carte.largeur, H = cfg.carte.hauteur, E = cfg.echelle, c = cfg.couleur;
    return '@page{size:' + cfg.page.largeur + 'mm ' + cfg.page.hauteur + 'mm;margin:0}' +
      '.bdg-feuille{position:relative;width:' + cfg.page.largeur + 'mm;height:' + cfg.page.hauteur + 'mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page;margin:0 auto 6mm}' +
      '.bdg-feuille:last-child{page-break-after:auto;break-after:auto}' +
      '.bdg-carte{position:absolute;width:' + mm(W * E) + ';height:' + mm(H * E) + ';box-sizing:border-box;' + (cfg.bordure ? 'border:' + mm(0.35 * E) + ' solid #000;' : '') + 'overflow:hidden;background:#fff;color:#000}' +
      // tout est dessiné aux dimensions du modèle puis réduit à l'échelle d'impression
      '.bdg-m{position:absolute;left:0;top:0;width:' + mm(W) + ';height:' + mm(H) + ';transform:scale(' + E + ');transform-origin:0 0;font-family:"' + String(cfg.police.famille).replace(/"/g, '') + '",Calibri,Arial,sans-serif;font-weight:400}' +
      '.bdg-m *{box-sizing:border-box}' +
      '.bdg-t{position:absolute;white-space:nowrap;line-height:1.2;font-weight:400}' +
      '.bdg-logo{position:absolute;display:block}' +
      '.bdg-trait{position:absolute;background:' + c + '}' +
      '.bdg-photo{position:absolute;object-fit:cover;border:0.2mm solid #999}' +
      '.bdg-qr{position:absolute}.bdg-qr svg{width:100%;height:100%;display:block}' +
      '@media screen{.bdg-feuille{box-shadow:0 1px 6px rgba(0,0,0,.25);margin-bottom:10px}}';
  }

  // ---------- Historique ----------
  var ENTETE_HISTO = ['date', 'ref', 'n', 'annee', 'nom', 'prenom', 'fonction', 'entreprise', 'structure', 'contrat', 'imprime_par'];
  function csv(lignes) {
    return lignes.map(function (l) { return l.map(function (c) { var s = String(c == null ? '' : c); return /[";\n\r\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\r\n');
  }
  function csvHistorique(hist) {
    return '\ufeff' + csv([ENTETE_HISTO].concat((hist || []).map(function (h) { return ENTETE_HISTO.map(function (k) { return h[k]; }); })));
  }

  var api = { DEFAUT: DEFAUT, config: config, vide: vide, norm: norm, cle: cle, esc: esc, formaterRef: formaterRef, prochain: prochain, attribuer: attribuer, decouperNom: decouperNom,
    analyserEnquetes: analyserEnquetes, lireCsv: lireCsv, personnesDepuisTableau: personnesDepuisTableau, planifier: planifier, positions: positions, casesParFeuille: casesParFeuille,
    feuillesHtml: feuillesHtml, calibrageHtml: calibrageHtml, css: css, csvHistorique: csvHistorique, ENTETE_HISTO: ENTETE_HISTO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
