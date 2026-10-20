/**
 * Prises en charge ↔ « Enquêtes administratives » (un onglet par prestataire).
 *  - recherche d'une personne pendant la saisie (nom, prénom, fonction proposés) : rechercherPersonnes(texte) ;
 *  - à la validation, si la case « Injecter dans les Enquêtes » est cochée : seules les personnes ABSENTES de toutes les Enquêtes sont ajoutées,
 *    dans l'onglet de leur prestataire (jamais de doublon, jamais d'écrasement) ;
 *  - journal de chaque demande dans l'onglet « Journal_PEC » du classeur des prises en charge.
 * Le moteur de lecture (Badges.analyserEnquetes) est partagé avec l'application Badges : badges/badges.js, copié en BadgesMoteur.gs au déploiement.
 * Fichier source : Google Sheets (pas .xlsx) ; propriété de script ENQUETES_ID pour en changer.
 */
var ENQUETES_ID_DEFAUT_ = '1EQMsT8IeOF9ky9eOx7S3jXoq7jmcikjyVVuwryf0Npo';
var ENQ_MOTS_VIDES_ = { sarl: 1, eurl: 1, spa: 1, sas: 1, snc: 1, ets: 1, etb: 1, etbe: 1, unite: 1, groupe: 1, cie: 1, de: 1, du: 1, des: 1, et: 1, la: 1, le: 1, location: 1, entreprise: 1, societe: 1, corp: 1 };

// ---------- logique pure (testée en Node) ----------
function enqJetons_(s) { return Badges.norm(s).split(' ').filter(Boolean); }
function enqProche_(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  var c = a.length > b.length ? a : b, d = a.length > b.length ? b : a;
  return c.slice(i + 1) === d.slice(i);
}
/** Même personne : mêmes mots du nom et du prénom, dans n'importe quel ordre (une lettre de différence tolérée sur les mots de 5 lettres et plus). */
function enqMemePersonne_(a, b) {
  var x = enqJetons_(a), y = enqJetons_(b);
  if (!x.length || x.length !== y.length) return false;
  var pris = {};
  return x.every(function (t) {
    for (var i = 0; i < y.length; i += 1) { if (!pris[i] && enqProche_(t, y[i])) { pris[i] = 1; return true; } }
    return false;
  });
}
/** Personnes dont le nom commence par ce qui est tapé (chaque mot saisi est le début d'un mot du nom) ; les plus proches d'abord. */
function enqChercher_(index, texte, max) {
  var q = enqJetons_(texte);
  if (q.join('').length < 3) return [];
  var res = [];
  index.forEach(function (p) {
    var mots = enqJetons_(p.nom + ' ' + p.prenom);
    var ok = q.every(function (t) { return mots.some(function (m) { return m.indexOf(t) === 0; }); });
    if (ok) res.push({ p: p, long: mots.join('').length });
  });
  res.sort(function (a, b) { return a.long - b.long; });
  return res.slice(0, max || 8).map(function (r) { return r.p; });
}
function enqTrouver_(index, nom, prenom, entreprise) {
  var voulu = nom + ' ' + prenom;
  for (var i = 0; i < index.length; i += 1) {
    if (!enqMemePersonne_(voulu, index[i].nom + ' ' + index[i].prenom)) continue;
    // avec une entreprise : seule une personne déjà listée chez CE prestataire compte comme doublon (une personne peut travailler pour plusieurs prestataires)
    if (entreprise && !(enqScoreEntreprise_(entreprise, index[i].entreprise) || enqScoreEntreprise_(entreprise, index[i].onglet))) continue;
    return index[i];
  }
  return null;
}
/** Contrat porté par le nom d'un onglet normalisé « ENTREPRISE · 60.INFRA.26 » ; '' pour un ancien nom sans contrat. */
function enqContratOnglet_(nomOnglet) {
  var p = String(nomOnglet || '').split(' · ');
  return p.length > 1 ? p.slice(1).join(' · ').trim() : '';
}
function enqMemeContrat_(a, b) { return Badges.norm(a).replace(/ /g, '') === Badges.norm(b).replace(/ /g, '') && Badges.norm(a) !== ''; }
/** Rapprochement entreprise ↔ entreprise : part de mots communs (0 si l'un n'est pas inclus dans l'autre). */
function enqScoreEntreprise_(x, y) {
  var a = enqJetons_(x).filter(function (t) { return !ENQ_MOTS_VIDES_[t]; }), b = enqJetons_(y).filter(function (t) { return !ENQ_MOTS_VIDES_[t]; });
  if (!a.length || !b.length) return 0;
  var commun = a.filter(function (t) { return b.some(function (u) { return enqProche_(t, u); }); }).length;
  return commun >= Math.min(a.length, b.length) ? commun / Math.max(a.length, b.length) : 0;
}
/**
 * Onglet du prestataire : le plus proche du nom d'entreprise (titre de l'onglet ou nom de l'onglet).
 * Si le contrat est connu : un onglet qui porte le même contrat l'emporte, et un onglet qui porte un AUTRE contrat n'est jamais choisi
 * (un nouveau contrat de la même entreprise aura son propre onglet). Pas de correspondance sûre = '' (rien n'est écrit au hasard).
 */
function enqOngletPour_(onglets, entreprise, contrat) {
  var meilleur = '', score = 0, exact = '', scoreExact = 0;
  onglets.forEach(function (o) {
    var s = Math.max(enqScoreEntreprise_(entreprise, o.entreprise), enqScoreEntreprise_(entreprise, o.onglet));
    if (!s) return;
    var c = enqContratOnglet_(o.onglet);
    if (contrat && c) { if (enqMemeContrat_(c, contrat)) { if (s > scoreExact) { scoreExact = s; exact = o.onglet; } } return; }
    if (s > score) { score = s; meilleur = o.onglet; }
  });
  return exact || meilleur;
}
/** Nom d'onglet normalisé : « ENTREPRISE · contrat » (sans les caractères interdits dans un nom d'onglet, 100 caractères au plus). */
function enqNomOnglet_(entreprise, contrat) {
  var propre = function (t) { return String(t || '').replace(/[\[\]*?:\/\\]+/g, '-').replace(/\s+/g, ' ').trim(); };
  var e = propre(entreprise).toUpperCase(), c = propre(contrat);
  return (c ? e + ' · ' + c : e).slice(0, 100);
}

/** Numéro d'agent : colonne (à gauche des noms) dont les cellules sont, pour la plupart, des numéros 1, 2, 3… ; -1 si introuvable. */
function enqColNumero_(lignes, col) {
  var pris = [col.fr, col.fonction, col.prenomAr, col.nomAr], largeur = 0, c, i;
  lignes.forEach(function (l) { if ((l || []).length > largeur) largeur = l.length; });
  var entete = lignes[col.h] || [];
  for (c = 0; c < largeur; c += 1) { // 1) colonne dont l'en-tête dit « numéro » (« الرقم », « رقم », « N° »), de n'importe quel côté
    if (pris.indexOf(c) >= 0) continue;
    var t = String(entete[c] == null ? '' : entete[c]).replace(/\s+/g, '');
    if (/^(ال)?رقم$|^n[°o]?$|^num(éro|ero)?$/i.test(t)) return c; // exact : pas « رقم الهاتف »
  }
  var meilleur = -1, score = 0; // 2) sinon colonne de petits entiers qui se suivent (1, 2, 3…)
  for (c = 0; c < largeur; c += 1) {
    if (pris.indexOf(c) >= 0) continue;
    var n = 0, tot = 0, max = 0;
    for (i = col.h + 1; i < lignes.length; i += 1) { var v = Badges.vide((lignes[i] || [])[c]); if (!v) continue; tot += 1; if (/^\d{1,4}$/.test(v)) { n += 1; if (Number(v) > max) max = Number(v); } }
    if (tot && n / tot >= 0.8 && max <= n + 5 && n > score) { score = n; meilleur = c; }
  }
  return meilleur;
}
/** Colonne repérée par son en-tête (regex sur le texte sans espaces), créée à droite du tableau (avec le style de l'en-tête voisin) si elle manque ; renvoie son indice (0 = A). */
function enqColonne_(sh, lignes, h, regex, titre) {
  var ent = lignes[h] || [];
  for (var c = 0; c < ent.length; c += 1) { if (regex.test(Badges.norm(ent[c]).replace(/ /g, '') + '|' + String(ent[c] == null ? '' : ent[c]).replace(/\s+/g, ''))) return c; }
  var n = Math.max(sh.getLastColumn(), ent.length);
  if (n + 1 > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), n + 1 - sh.getMaxColumns()); // jamais hors de la grille
  sh.getRange(h + 1, n, 1, 1).copyTo(sh.getRange(h + 1, n + 1, 1, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sh.getRange(h + 1, n + 1).setValue(titre);
  return n;
}
/** Colonne « date d'enregistrement » : repérée par son en-tête (« تاريخ التسجيل » / « Date d'enregistrement ») ; -1 si absente (elle est alors créée à droite du tableau). */
function enqColDate_(lignes, col) {
  var entete = lignes[col.h] || [];
  for (var c = 0; c < entete.length; c += 1) { var t = Badges.norm(entete[c]).replace(/ /g, ''); if (/تاريخالتسجيل|dateenregistrement|dateinscription/.test(t)) return c; }
  return -1;
}
/** Prochain numéro d'agent : le plus grand numéro déjà présent + 1. */
function enqProchainNumero_(lignes, col, colNum) {
  var max = 0;
  for (var i = col.h + 1; i < lignes.length; i += 1) { var v = Number(Badges.vide((lignes[i] || [])[colNum])); if (v > max) max = v; }
  return max + 1;
}

/** Translittération APPROCHÉE en arabe (prénoms et noms courants d'abord, puis règles simples) : à relire, jamais une traduction officielle. */
var ENQ_AR_MOTS_ = { mohamed: 'محمد', mohammed: 'محمد', muhammad: 'محمد', ahmed: 'أحمد', ahmad: 'أحمد', ali: 'علي', omar: 'عمر', amine: 'أمين', yacine: 'ياسين', yassine: 'ياسين', yasser: 'ياسر', rayane: 'ريان', rayan: 'ريان', madani: 'مداني', madni: 'مدني',
  karim: 'كريم', rachid: 'رشيد', youcef: 'يوسف', youssef: 'يوسف', brahim: 'إبراهيم', ibrahim: 'إبراهيم', mustapha: 'مصطفى', mostefa: 'مصطفى', lamine: 'لمين', nacer: 'ناصر', nasser: 'ناصر', salim: 'سليم', samir: 'سمير', farid: 'فريد', hamza: 'حمزة', ismail: 'إسماعيل',
  said: 'سعيد', khaled: 'خالد', fouad: 'فؤاد', walid: 'وليد', abdelkader: 'عبد القادر', abdelmadjid: 'عبد المجيد', abdelhak: 'عبد الحق', abderrahmane: 'عبد الرحمان', abderrahim: 'عبد الرحيم', abdelaziz: 'عبد العزيز', abdelghani: 'عبد الغني', abdelhamid: 'عبد الحميد', abdellatif: 'عبد اللطيف',
  abdelouahab: 'عبد الوهاب', abdelkrim: 'عبد الكريم', abdelmoumen: 'عبد المومن', abdennour: 'عبد النور', aissa: 'عيسى', ayoub: 'أيوب', bilal: 'بلال', djamel: 'جمال', fares: 'فارس', hicham: 'هشام', houcine: 'حسين', hocine: 'حسين', idir: 'إدير', ilyes: 'إلياس', lyes: 'إلياس', mehdi: 'مهدي',
  merouane: 'مروان', nabil: 'نبيل', nadir: 'نادر', redouane: 'رضوان', riad: 'رياض', sofiane: 'سفيان', tarek: 'طارق', toufik: 'توفيق', zinedine: 'زين الدين', chems: 'شمس', eddine: 'الدين', eddin: 'الدين', nour: 'نور', salah: 'صلاح', sid: 'سيد', ben: 'بن', bel: 'بل', ould: 'ولد', el: 'ال', al: 'ال' };
var ENQ_AR_LETTRES_ = [['ou', 'و'], ['ch', 'ش'], ['kh', 'خ'], ['gh', 'غ'], ['dj', 'ج'], ['th', 'ث'], ['dh', 'ذ'], ['sh', 'ش'], ['ai', 'ي'], ['ei', 'ي'], ['a', 'ا'], ['b', 'ب'], ['c', 'ك'], ['d', 'د'], ['e', ''], ['f', 'ف'], ['g', 'ق'], ['h', 'ه'], ['i', 'ي'], ['j', 'ج'], ['k', 'ك'], ['l', 'ل'], ['m', 'م'],
  ['n', 'ن'], ['o', 'و'], ['p', 'ب'], ['q', 'ق'], ['r', 'ر'], ['s', 'س'], ['t', 'ت'], ['u', 'و'], ['v', 'ف'], ['w', 'و'], ['x', 'كس'], ['y', 'ي'], ['z', 'ز']];
function enqArabeMot_(mot) {
  var m = Badges.norm(mot).replace(/ /g, '');
  if (!m) return '';
  if (ENQ_AR_MOTS_[m]) return ENQ_AR_MOTS_[m];
  var out = '', i = 0;
  while (i < m.length) {
    var trouve = false;
    for (var k = 0; k < ENQ_AR_LETTRES_.length; k += 1) {
      var l = ENQ_AR_LETTRES_[k][0];
      if (m.substr(i, l.length) === l) { out += ENQ_AR_LETTRES_[k][1]; i += l.length; trouve = true; break; }
    }
    if (!trouve) i += 1;
  }
  return out;
}
function enqArabe_(texte) { return String(texte || '').split(/[\s\-]+/).filter(Boolean).map(enqArabeMot_).filter(Boolean).join(' '); }

/**
 * Plan de normalisation des noms d'onglets : { onglet, nouveau, contrat, etat } avec etat = 'ok' (déjà normalisé), 'renommer', 'inconnu' (entreprise absente du CPM) ou 'ambigu' (plusieurs contrats possibles).
 * cpm : [{ entreprise, contrat, intitule }]. Le contrat est reconnu par les mots du nom de l'onglet qui restent après l'entreprise (ex. « Z.ABD Manuel » → « manuel » → « Dessablage manuel »).
 */
function enqPrefixeMot_(t, w) {
  if (t.length < 3) return false;
  if (w.indexOf(t) === 0) return true;
  if (t.length < 5) return false;
  var a = t, b = w.slice(0, t.length + 1), i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
}
function enqPlanNoms_(onglets, cpm) {
  var res = [], pris = {};
  onglets.forEach(function (o) {
    if (o.erreur || !o.personnes) { return; }
    if (enqContratOnglet_(o.onglet)) { res.push({ onglet: o.onglet, nouveau: o.onglet, contrat: enqContratOnglet_(o.onglet), etat: 'ok' }); pris[o.onglet] = 1; return; }
    var cands = cpm.filter(function (c) { return Math.max(enqScoreEntreprise_(o.entreprise, c.entreprise), enqScoreEntreprise_(o.onglet, c.entreprise)) > 0; });
    if (!cands.length) { res.push({ onglet: o.onglet, nouveau: o.onglet, contrat: '', etat: 'inconnu' }); return; }
    var choix = cands;
    if (cands.length > 1) {
      var entJ = enqJetons_(cands[0].entreprise);
      var reste = enqJetons_(o.onglet).filter(function (t) { return !entJ.some(function (u) { return u.indexOf(t) === 0; }); });
      var notes = cands.map(function (c) { var w = enqJetons_(c.intitule); return reste.filter(function (t) { return w.some(function (x) { return enqPrefixeMot_(t, x); }); }).length; });
      var max = Math.max.apply(null, notes), meilleurs = cands.filter(function (c, i) { return notes[i] === max; });
      choix = max > 0 && meilleurs.length === 1 ? meilleurs : [];
    }
    if (choix.length !== 1) { res.push({ onglet: o.onglet, nouveau: o.onglet, contrat: '', etat: 'ambigu' }); return; }
    var nouveau = enqNomOnglet_(choix[0].entreprise, choix[0].contrat);
    if (pris[nouveau]) { res.push({ onglet: o.onglet, nouveau: o.onglet, contrat: choix[0].contrat, etat: 'ambigu' }); return; }
    pris[nouveau] = 1;
    res.push({ onglet: o.onglet, nouveau: nouveau, contrat: choix[0].contrat, etat: nouveau === o.onglet ? 'ok' : 'renommer' });
  });
  return res;
}

/** « 12.3.INFRA.25 - ENCC SPA - Génie civil » → « ENCC SPA » ; « Visite sur site… » → '' (pas un prestataire). */
function enqEntrepriseDe_(prestataire) {
  var t = String(prestataire || '').trim();
  if (!t || /^visite sur site/i.test(t)) return '';
  var p = t.split(' - ');
  return (p.length > 1 ? p[1] : p[0]).trim();
}
/**
 * Ligne où écrire dans un onglet : TOUJOURS à la suite de la dernière personne déjà inscrite (jamais dans un trou au milieu, jamais sur une ligne remplie).
 * La ligne qui suit est utilisée si elle est vide (lignes numérotées du modèle), sinon on ajoute en bas.
 */
function enqLigneLibre_(lignes, col) {
  var derniere = col.h;
  for (var i = lignes.length - 1; i > col.h; i -= 1) { if (Badges.vide((lignes[i] || [])[col.fr])) { derniere = i; break; } }
  var suivante = derniere + 1;
  if (suivante < lignes.length) {
    var l = lignes[suivante] || [];
    var occupee = [col.fr, col.fonction, col.prenomAr, col.nomAr].some(function (c) { return c >= 0 && Badges.vide(l[c]); });
    if (!occupee) return suivante;
  }
  return lignes.length;
}
function enqNomComplet_(nom, prenom) { return (Badges.majNom(nom) + ' ' + Badges.capPrenom(prenom)).trim(); } // NOM en majuscules, Prénom avec sa majuscule : ce qui est écrit dans les Enquêtes

/** Résultat à afficher à l'utilisateur. */
function enqResume_(r) {
  var t = [];
  if (r.ajoutes.length) t.push('Enquêtes : ' + r.ajoutes.length + ' personne(s) ajoutée(s) (' + r.ajoutes.join(', ') + ')');
  if (r.existants.length) t.push(r.existants.length + ' ignorée(s) (déjà enregistrée(s))');
  if (r.crees && r.crees.length) t.push('Onglet créé : ' + r.crees.join(', '));
  if (r.sansOnglet.length) t.push('NON ajouté(s) pour « ' + r.entreprise + ' » : ' + r.sansOnglet.join(', '));
  if (r.erreur) t.push('Enquêtes : ' + r.erreur);
  if (r.details && r.details.length) t.push('Détail : ' + r.details.join(' ; '));
  return t.join(' · ');
}

// ---------- accès aux feuilles ----------
function enqClasseur_() {
  var pr = PropertiesService.getScriptProperties(), id = pr.getProperty('ENQUETES_ID') || pr.getProperty('BADGES_ENQUETES_ID') || ENQUETES_ID_DEFAUT_; // BADGES_ENQUETES_ID : même fichier que les badges (passerelle)
  try { return SpreadsheetApp.openById(id); }
  catch (e) { throw new Error('Le fichier « Enquêtes administratives » n\'est pas lisible (il doit être un Google Sheets partagé avec le compte de l\'application).'); }
}
function enqLireTout_(ss) {
  return ss.getSheets().map(function (sh) { return Badges.analyserEnquetes(sh.getDataRange().getDisplayValues(), sh.getName()); });
}
function enqIndex_(onglets) {
  var idx = [];
  onglets.forEach(function (o) { o.personnes.forEach(function (p) { idx.push({ nom: p.nom, prenom: p.prenom, fonction: p.fonction, entreprise: o.entreprise, onglet: o.onglet }); }); });
  return idx;
}
function enqIndexCache_() {
  var c = CacheService.getScriptCache(), v = c.get('ENQ_IDX');
  if (v) { try { return JSON.parse(v); } catch (e) { /* relire */ } }
  var idx = enqIndex_(enqLireTout_(enqClasseur_()));
  try { var t = JSON.stringify(idx); if (t.length < 95000) c.put('ENQ_IDX', t, 300); } catch (e) { /* trop gros : pas de cache */ }
  return idx;
}

/** Appelée par le formulaire pendant la frappe : personnes des Enquêtes dont le nom commence par le texte. */
function rechercherPersonnes(texte) {
  try {
    return { ok: true, personnes: enqChercher_(enqIndexCache_(), texte, 8).map(function (p) { return { nom: p.nom, prenom: p.prenom, fonction: p.fonction, entreprise: p.entreprise }; }) };
  } catch (e) { return { ok: false, message: e.message, personnes: [] }; }
}

/** Onglet le plus petit (le moins de personnes) parmi ceux dont la structure est lisible : le meilleur modèle pour un onglet VIERGE. */
function enqChoisirModele_(onglets) {
  return onglets.filter(function (o) { return !o.erreur && o.onglet !== 'Liste' && o.personnes; })
    .sort(function (a, b) { return a.personnes.length - b.personnes.length; }).map(function (o) { return o.onglet; });
}
/**
 * Corrections à faire dans l'EN-TÊTE d'un onglet copié (lignes au-dessus du tableau) : la partie latine du titre devient l'entreprise,
 * et toute autre cellule purement latine ou numérique (ancien contrat, date, nom de projet…) est vidée. Les libellés arabes ne bougent pas.
 * lignes : valeurs affichées de l'onglet ; h : indice (0) de la ligne d'en-têtes du tableau. Retourne [{ ligne, col, valeur }] (1 = première ligne / colonne).
 */
function enqCorrectionsEntete_(lignes, h, entreprise, wilaya) {
  var out = [], titreFait = false;
  for (var i = 0; i < h; i += 1) {
    for (var j = 0; j < (lignes[i] || []).length; j += 1) {
      var c = String(lignes[i][j] == null ? '' : lignes[i][j]);
      if (!c.trim()) continue;
      var arabe = /[\u0600-\u06ff]/.test(c), latin = /[A-Za-z0-9]/.test(c);
      if (arabe && c.indexOf('القائمة') >= 0 && /[A-Za-z]{2}/.test(c) && !titreFait) {
        out.push({ ligne: i + 1, col: j + 1, valeur: c.replace(/[A-Za-z][A-Za-z0-9 .&'’()\/\-]*[A-Za-z0-9.)]/, String(entreprise).toUpperCase()) }); titreFait = true;
      } else if (arabe && wilaya && /^\s*ولاية/.test(c)) out.push({ ligne: i + 1, col: j + 1, valeur: 'ولاية   ' + wilaya }); // « ولاية إليزي » : la wilaya choisie
      else if (!arabe && latin) out.push({ ligne: i + 1, col: j + 1, valeur: '' });
    }
  }
  return out;
}

/**
 * Crée l'onglet VIERGE d'un prestataire : copie du plus petit onglet existant (mise en forme, en-têtes, colonnes), puis TOUT le contenu du tableau est effacé
 * (noms, fonctions, arabe, numéros, autres colonnes, notes, images) ; seules 25 lignes mises en forme sont gardées ; le titre reprend l'entreprise.
 * Les numéros d'agent sont écrits au fur et à mesure des ajouts. Retourne le nom du nouvel onglet.
 */
function enqCreerOnglet_(ss, onglets, entreprise, contrat, wilaya) {
  var modele = null;
  enqChoisirModele_(onglets).some(function (nomOnglet) { if (Badges.colonnesEnquetes(ss.getSheetByName(nomOnglet).getDataRange().getDisplayValues())) { modele = nomOnglet; return true; } return false; });
  if (!modele) throw new Error('aucun onglet modèle exploitable dans les Enquêtes');
  var nom = enqNomOnglet_(entreprise, contrat), n = 1, base = nom;
  while (ss.getSheetByName(nom)) { n += 1; nom = base.slice(0, 94) + ' (' + n + ')'; }
  var sh = ss.getSheetByName(modele).copyTo(ss).setName(nom);
  var lignes = sh.getDataRange().getDisplayValues(), col = Badges.colonnesEnquetes(lignes), premiere = col.h + 2, derniere = sh.getLastRow(), nbCol = Math.max(sh.getLastColumn(), 1);
  if (derniere >= premiere) {
    sh.getRange(premiere, 1, derniere - premiere + 1, nbCol).clearContent().clearNote();
    var GARDEES = 25;
    if (derniere - premiere + 1 > GARDEES) { try { sh.deleteRows(premiere + GARDEES, derniere - premiere + 1 - GARDEES); } catch (e) { /* lignes figées : on les laisse vides */ } }
  }
  try { sh.getImages().forEach(function (img) { img.remove(); }); } catch (e) { /* pas d'image : rien à faire */ }
  enqCorrectionsEntete_(lignes, col.h, entreprise, wilaya).forEach(function (x) { sh.getRange(x.ligne, x.col).setValue(x.valeur); });
  return nom;
}

/** Ajoute aux Enquêtes les personnes de la demande qui n'y figurent pas encore. Ne lève jamais d'erreur : le résultat dit ce qui a été fait. */
function injecterEnquetes_(formData) {
  var r = { ajoutes: [], existants: [], sansOnglet: [], crees: [], details: [], entreprise: enqEntrepriseDe_(formData.prestataire), erreur: '' };
  try {
    var gens = (formData.personnes || []).filter(function (p) { return Badges.vide(p.nom) && (Badges.vide(p.prenom) || /\s/.test(Badges.vide(p.nom))); });
    if (!gens.length) return r;
    if (!r.entreprise) { r.erreur = 'visite sur site : rien à ajouter'; return r; }
    var ignorer = formData.ignorerEnquetes || [];
    var contrat = String(formData.prestataire || '').split(' - ')[0].trim();
    var lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      var ss = enqClasseur_(), onglets = enqLireTout_(ss), idx = enqIndex_(onglets), cible = enqOngletPour_(onglets, r.entreprise, contrat);
      gens.forEach(function (p) {
        var nom = Badges.vide(p.nom), prenom = Badges.vide(p.prenom), nomComplet = enqNomComplet_(nom, prenom);
        if (enqDejaChezCeContrat_(idx, cible, nom, prenom, r.entreprise, contrat)) { r.existants.push(nomComplet); r.details.push(nomComplet + ' : déjà dans « ' + cible + ' »'); return; }
        if (ignorer.indexOf(nomComplet) >= 0) { r.existants.push(nomComplet); r.details.push(nomComplet + ' : ignoré (déjà enregistré, à ta demande)'); return; }
        if (!cible) { // pas d'onglet pour ce prestataire (et ce contrat) : on le crée
          try { cible = enqCreerOnglet_(ss, onglets, r.entreprise, contrat, Badges.vide(formData.wilaya)); r.crees.push(cible); onglets.push({ onglet: cible, entreprise: r.entreprise.toUpperCase(), personnes: [] }); }
          catch (e) { r.erreur = 'création de l\'onglet impossible : ' + e.message; r.sansOnglet.push(nomComplet); return; }
        }
        try {
          var sh = ss.getSheetByName(cible), lignes = sh.getDataRange().getDisplayValues(), col = Badges.colonnesEnquetes(lignes);
          if (!col || col.fr < 0) { r.sansOnglet.push(nomComplet); r.details.push(nomComplet + ' : colonne « بالفرنسية » introuvable dans « ' + cible + ' »'); return; }
          var i = enqLigneLibre_(lignes, col), ligne = i + 1, colNum = enqColNumero_(lignes, col);
          if (ligne > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), ligne - sh.getMaxRows()); // jamais d'écriture hors de la grille
          var cd = enqColonne_(sh, lignes, col.h, /تاريخالتسجيل|dateenregistrement|dateinscription/, 'تاريخ التسجيل — Date d\'enregistrement');
          var cs = Badges.vide(p.structure) ? enqColonne_(sh, lignes, col.h, /^الهيكل|structure/i, 'الهيكل — Structure') : (col.structure >= 0 ? col.structure : -1);
          if (i >= lignes.length && lignes.length > 1) sh.getRange(lignes.length, 1, 1, sh.getLastColumn()).copyTo(sh.getRange(ligne, 1, 1, sh.getLastColumn()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
          sh.getRange(ligne, col.fr + 1).setValue(nomComplet);
          if (colNum >= 0 && !Badges.vide((lignes[i] || [])[colNum])) { /* ligne déjà numérotée : on garde son numéro */ }
          else if (colNum >= 0) sh.getRange(ligne, colNum + 1).setNumberFormat('00').setValue(enqProchainNumero_(lignes, col, colNum)); // numéro d'agent suivant
          if (col.fonction >= 0 && Badges.vide(p.fonction)) sh.getRange(ligne, col.fonction + 1).setValue(Badges.vide(p.fonction));
          var ar = { nomAr: Badges.vide(p.nomAr) || enqArabe_(nom), prenomAr: Badges.vide(p.prenomAr) || enqArabe_(prenom) }; // saisis, sinon approchés (à relire)
          if (col.nomAr >= 0 && ar.nomAr) sh.getRange(ligne, col.nomAr + 1).setValue(ar.nomAr);
          if (col.prenomAr >= 0 && ar.prenomAr) sh.getRange(ligne, col.prenomAr + 1).setValue(ar.prenomAr);
          [['naissance', col.naiss], ['lieu', col.lieu], ['pere', col.pere], ['mere', col.mere], ['adresse', col.adresse], ['embauche', col.embauche], ['nin', col.nin], ['acte', col.acte], ['tel', col.tel]].forEach(function (c) { if (c[1] >= 0 && Badges.vide(p[c[0]])) sh.getRange(ligne, c[1] + 1).setNumberFormat('@').setValue(Badges.vide(p[c[0]])); }); // texte : une date saisie reste telle quelle
          if (cs >= 0 && Badges.vide(p.structure)) sh.getRange(ligne, cs + 1).setValue(Badges.vide(p.structure));
          sh.getRange(ligne, cd + 1).setNumberFormat('dd/MM/yyyy').setValue(Utilities.formatDate(new Date(), 'Africa/Algiers', 'dd/MM/yyyy'));
          SpreadsheetApp.flush();
          if (Badges.vide(sh.getRange(ligne, col.fr + 1).getDisplayValue()) !== nomComplet) { r.sansOnglet.push(nomComplet); r.details.push(nomComplet + ' : écriture non retenue (ligne ' + ligne + ' de « ' + cible + ' » protégée ?)'); return; }
          r.details.push(nomComplet + ' → « ' + cible + ' », ligne ' + ligne);
        } catch (e) { r.sansOnglet.push(nomComplet); r.details.push(nomComplet + ' : ' + e.message); return; }
        idx.push({ nom: nom, prenom: prenom, fonction: p.fonction, entreprise: r.entreprise, onglet: cible });
        r.ajoutes.push(nomComplet);
      });
    } finally { lock.releaseLock(); }
    if (r.ajoutes.length || r.crees.length) { var c = CacheService.getScriptCache(); c.remove('ENQ_IDX'); }
  } catch (e) { r.erreur = e.message; }
  return r;
}

/**
 * Normalise les noms d'onglets des Enquêtes en « ENTREPRISE · contrat » (le contrat vient du Suivi CPM).
 * apercuNormalisationOnglets() : montre ce qui serait renommé, sans rien changer (à lancer en premier).
 * normaliserOngletsEnquetes() : renomme (jamais un onglet « ambigu » ou « inconnu » : ils sont seulement listés).
 */
function enqCpmContrats_() {
  var cpm = SpreadsheetApp.openById(SUIVI_CPM_ID).getSheetByName(SUIVI_CPM_TAB), data = cpm.getRange('C3:N' + cpm.getLastRow()).getValues(), out = [], vus = {};
  data.forEach(function (r) {
    var ent = Badges.vide(r[10]), num = Badges.vide(r[11]); if (!ent || !num) return;
    var k = Badges.norm(ent) + '|' + Badges.norm(num); if (vus[k]) return; vus[k] = 1;
    out.push({ entreprise: ent, contrat: num, intitule: Badges.vide(r[1]) });
  });
  return out;
}
function normalisationOnglets_(appliquer) {
  var ss = enqClasseur_(), plan = enqPlanNoms_(enqLireTout_(ss), enqCpmContrats_()), faits = 0, l = [];
  plan.forEach(function (p) {
    if (p.etat === 'renommer') { l.push('« ' + p.onglet + ' » → « ' + p.nouveau + ' »'); if (appliquer) { ss.getSheetByName(p.onglet).setName(p.nouveau); faits += 1; } }
  });
  Logger.log((appliquer ? 'RENOMMÉS (' + faits + ')' : 'APERÇU (rien n\'est renommé)') + ' : ' + (l.join(' ; ') || 'aucun'));
  Logger.log('Déjà normalisés : ' + plan.filter(function (p) { return p.etat === 'ok'; }).map(function (p) { return p.onglet; }).join(' ; '));
  Logger.log('Entreprise absente du Suivi CPM (non renommés) : ' + (plan.filter(function (p) { return p.etat === 'inconnu'; }).map(function (p) { return p.onglet; }).join(' ; ') || 'aucun'));
  Logger.log('Plusieurs contrats possibles (à renommer à la main, ex. « ENTREPRISE · 60.INFRA.26 ») : ' + (plan.filter(function (p) { return p.etat === 'ambigu'; }).map(function (p) { return p.onglet; }).join(' ; ') || 'aucun'));
  if (appliquer) { var c = CacheService.getScriptCache(); c.remove('ENQ_IDX'); c.remove('BADGES_SRC'); }
}
function apercuNormalisationOnglets() { normalisationOnglets_(false); }
function normaliserOngletsEnquetes() { normalisationOnglets_(true); }

/** Une ligne par personne et par demande, dans l'onglet « Journal_PEC » (créé au premier passage). */
function journaliserPEC_(ss, formData, enq) {
  try {
    var sh = ss.getSheetByName('Journal_PEC');
    if (!sh) { sh = ss.insertSheet('Journal_PEC'); sh.appendRow(['date', 'prestataire', 'base', 'documents', 'nom', 'prenom', 'fonction', 'vehicule', 'immatriculation', 'enquetes']); sh.setFrozenRows(1); }
    var date = Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy-MM-dd HH:mm');
    var docs = [formData.genererPEC ? 'PEC' : '', formData.genererAuto ? 'Autorisation' : ''].filter(Boolean).join('+');
    var lignes = (formData.personnes || []).map(function (p) {
      var nc = enqNomComplet_(p.nom, p.prenom), etat = enq ? (enq.ajoutes.indexOf(nc) >= 0 ? 'ajoutée' : enq.existants.indexOf(nc) >= 0 ? 'déjà présente' : enq.sansOnglet.indexOf(nc) >= 0 ? 'sans onglet' : '') : '';
      return [date, formData.prestataire || '', formData.base || '', docs, p.nom || '', p.prenom || '', p.fonction || '', p.typeVehicule || '', p.immatriculation || '', formData.injecterEnquetes ? etat : 'non demandé'];
    });
    if (lignes.length) sh.getRange(sh.getLastRow() + 1, 1, lignes.length, 10).setValues(lignes);
  } catch (e) { /* le journal ne doit jamais bloquer une génération */ }
}

/**
 * Personne déjà inscrite chez CE prestataire et CE contrat (index = enqIndex_) : rien à faire, ni avertissement ni ajout.
 * Compte l'onglet cible, mais aussi tout onglet du même prestataire dont l'intitulé porte le même contrat ou aucun contrat (ancien onglet).
 * Seul un autre contrat (ou un autre prestataire) mérite la question.
 */
function enqDejaChezCeContrat_(idx, cible, nom, prenom, entreprise, contrat) {
  if (!cible) return false;
  var voulu = nom + ' ' + prenom;
  return idx.some(function (p) {
    if (!enqMemePersonne_(voulu, p.nom + ' ' + p.prenom)) return false;
    if (p.onglet === cible) return true;
    if (!entreprise || !(enqScoreEntreprise_(entreprise, p.entreprise) || enqScoreEntreprise_(entreprise, p.onglet))) return false;
    var c = enqContratOnglet_(p.onglet);
    return !c || (!!contrat && enqMemeContrat_(c, contrat));
  });
}
/** Avant la génération : agents déjà présents dans les Enquêtes (chez ce prestataire ou un autre), avec l'onglet et la date d'enregistrement si elle existe. */
function verifierEnquetes(formData) {
  try {
    var gens = (formData.personnes || []).filter(function (p) { return Badges.vide(p.nom); });
    if (!gens.length || !enqEntrepriseDe_(formData.prestataire)) return { ok: true, deja: [] };
    var onglets = enqLireTout_(enqClasseur_()), idx = enqIndex_(onglets), deja = [];
    var cible = enqOngletPour_(onglets, enqEntrepriseDe_(formData.prestataire), String(formData.prestataire || '').split(' - ')[0].trim());
    gens.forEach(function (p) {
      if (enqDejaChezCeContrat_(idx, cible, Badges.vide(p.nom), Badges.vide(p.prenom), enqEntrepriseDe_(formData.prestataire), String(formData.prestataire || '').split(' - ')[0].trim())) return; // déjà chez ce prestataire / ce contrat : ignoré sans avertir
      var t = enqTrouver_(idx, Badges.vide(p.nom), Badges.vide(p.prenom));
      if (t) deja.push({ nomComplet: enqNomComplet_(p.nom, p.prenom), onglet: t.onglet, date: t.date || '' });
    });
    return { ok: true, deja: deja };
  } catch (e) { return { ok: false, deja: [], message: e.message }; }
}
