/**
 * Synchronisation de l'onglet « Utilisateurs » avec l'onglet BDDORGA du fichier « Organigrame Div Infra » (fonctions PURES, testées).
 *
 * On ne lit QUE les colonnes d'identité utiles : nom, e-mail, matricule, service, intitulé du poste, employeur (dépendance), téléphone.
 * L'identifiant Wi-Fi (« Wifi User ») est repris pour la fiche de l'agent ; les colonnes sensibles (mots de passe Windows / Wi-Fi, numéros nationaux…) ne sont JAMAIS lues.
 * Les colonnes gérées à la main dans la passerelle (uid, role, actif, civilite) ne sont jamais modifiées.
 */
var Annuaire = (function () {
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var CHAMPS = ['nom', 'matricule', 'service', 'fonction', 'dependance', 'telephone', 'sona', 'date_integration', 'wifi_user', 'sap', 'nin'];

  // ---- adresses e-mail copiées d'un tableur : espaces, espaces insécables, caractères invisibles, <>, « mailto: », ponctuation finale… ----
  var INVISIBLES = /[\u200B-\u200F\u2060\u2028\u2029\uFEFF\u00AD\u00A0\u202F\u3000]/g;
  var DOMAINES = ['gmail.com', 'hotmail.com', 'hotmail.fr', 'yahoo.fr', 'yahoo.com', 'outlook.com', 'outlook.fr', 'live.fr', 'icloud.com', 'sonatrach.dz'];
  function lev(a, b) { var m = a.length, nn = b.length, d = [], i, j; for (i = 0; i <= m; i += 1) d[i] = [i]; for (j = 1; j <= nn; j += 1) d[0][j] = j;
    for (i = 1; i <= m; i += 1) for (j = 1; j <= nn; j += 1) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)); return d[m][nn]; }
  /** Adresse nettoyée (minuscules, sans espace ni caractère invisible) ; chaîne vide si rien d'exploitable. */
  function nettoyerEmail(v) {
    var x = String(v == null ? '' : v).replace(/\uFF20/g, '@').replace(INVISIBLES, '').replace(/\s+/g, '');
    x = x.replace(/^mailto:/i, '').replace(/^[<\("'«]+/, '').replace(/[>\)"'».,;:]+$/, '').toLowerCase();
    return x;
  }
  /** { propre, valide, problemes: [texte], suggestion } : ce qui empêche d'envoyer un code à cette adresse et ce qu'il faudrait écrire. */
  function analyserEmail(v) {
    var brut = String(v == null ? '' : v), propre = nettoyerEmail(brut), pb = [];
    if (!brut.trim()) return { propre: '', valide: false, problemes: ['adresse absente'], suggestion: '' };
    if (INVISIBLES.test(brut.replace(/ /g, ''))) { pb.push('caractères invisibles (espace insécable, caractère de largeur nulle…)'); INVISIBLES.lastIndex = 0; }
    INVISIBLES.lastIndex = 0;
    if (/\s/.test(brut.trim())) pb.push('espace à l\'intérieur de l\'adresse');
    if (brut !== brut.trim()) pb.push('espace avant ou après');
    if (/[.,;:]$/.test(brut.trim())) pb.push('ponctuation à la fin');
    if (/^mailto:|^[<("'«]|[>)"'»]$/i.test(brut.trim())) pb.push('crochets, guillemets ou « mailto: » autour');
    if (/[;,]/.test(propre)) pb.push('plusieurs adresses ou virgule/point-virgule dans la cellule');
    var valide = EMAIL.test(propre) && !/[;,]/.test(propre) && /^[\x21-\x7E]+$/.test(propre) && propre.split('@').length === 2 && /\.[a-z]{2,}$/.test(propre);
    if (propre && !valide) {
      if (propre.split('@').length !== 2) pb.push(propre.indexOf('@') === -1 ? 'pas de « @ »' : 'plusieurs « @ »');
      else if (!/\.[a-z]{2,}$/.test(propre)) pb.push('domaine incomplet (ex. « .com » ou « .dz » manquant)');
      else if (!/^[\x21-\x7E]+$/.test(propre)) pb.push('caractères accentués ou non ASCII');
      else pb.push('format invalide');
    }
    var suggestion = propre, dom = propre.split('@')[1] || '';
    if (dom && DOMAINES.indexOf(dom) === -1) {
      var proche = DOMAINES.filter(function (d) { return lev(dom, d) <= 2 && Math.abs(dom.length - d.length) <= 2; })[0];
      if (proche) { pb.push('domaine suspect : « ' + dom + ' » ressemble à « ' + proche + ' »'); suggestion = propre.split('@')[0] + '@' + proche; }
    }
    if (propre && brut.trim() !== brut.trim().toLowerCase() && !pb.length) pb.push('majuscules (sans gravité : l\'adresse est mise en minuscules)');
    return { propre: propre, valide: valide, problemes: pb, suggestion: suggestion };
  }

  function n(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function t(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

  /** Vrai si la valeur ressemble à un NOM de personne (lettres, espaces, apostrophes, tirets) : ni numéro, ni e-mail. */
  function ressembleNom(v) {
    var s = t(v);
    if (!s || ressembleNumero(s) || EMAIL.test(s)) return false;
    return /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .\-]{2,}$/.test(s);
  }

  /**
   * Repère la ligne d'en-têtes et les colonnes utiles. La colonne des NOMS est trouvée par son contenu : parmi les colonnes
   * sans titre, celles qui contiennent le plus de vrais noms (jamais une colonne de numéros). Ainsi le fichier peut être réorganisé.
   */
  /** NIN valide : 18 chiffres saisis en TEXTE (un nombre de cette taille perd ses derniers chiffres dans un tableur : on le refuse). */
  function nin(v) { return typeof v === 'string' && /^\d{18}$/.test(v.replace(/\s+/g, '')) ? v.replace(/\s+/g, '') : ''; }

  function colonnes(valeurs) {
    for (var r = 0; r < Math.min(10, valeurs.length); r += 1) {
      var h = valeurs[r].map(n);
      var iMail = Math.max(h.indexOf('e mail'), h.indexOf('email'));
      var iServ = h.indexOf('service');
      if (iMail < 0 || iServ < 0) continue;
      var noms = [];
      ['nom', 'nom prenom', 'nom et prenom', 'agent'].forEach(function (c) { if (!noms.length && h.indexOf(c) >= 0) noms = [h.indexOf(c)]; });
      if (!noms.length) {
        var scores = [];
        for (var c = 0; c < h.length; c += 1) {
          if (h[c] !== '') continue;
          var sc = 0;
          for (var k = r + 1; k < Math.min(valeurs.length, r + 400); k += 1) if (ressembleNom(valeurs[k][c])) sc += 1;
          if (sc > 0) scores.push({ c: c, sc: sc });
        }
        scores.sort(function (x, y) { return y.sc - x.sc || x.c - y.c; });
        noms = scores.map(function (x) { return x.c; });
      }
      if (!noms.length) return { erreur: 'Colonne des noms introuvable dans BDDORGA (une colonne sans titre contenant les noms, ou une colonne intitulée « Nom »)' };
      var iNin = h.indexOf('nin');
      if (iNin < 0) { // colonne sans titre dont les cellules sont, pour la plupart, des numéros de 18 chiffres (texte) : le NIN
        var meilleur = 0;
        for (var cn = 0; cn < h.length; cn += 1) {
          if (h[cn] !== '' || noms.indexOf(cn) !== -1) continue;
          var k18 = 0;
          for (var rn = r + 1; rn < Math.min(valeurs.length, r + 400); rn += 1) if (nin(valeurs[rn][cn])) k18 += 1;
          if (k18 > meilleur) { meilleur = k18; iNin = cn; }
        }
      }
      var iTel = Math.max(h.indexOf('numero telephone'), h.indexOf('telephone'));
      return { ligne: r, idx: { nom: noms[0], noms: noms, email: iMail, matricule: h.indexOf('matricule'), service: iServ, fonction: h.lastIndexOf('fonction'), dependance: h.indexOf('dependance'), telephone: iTel, sona: h.indexOf('sona'), date_integration: h.indexOf('date integration'), wifi_user: h.indexOf('wifi user'), sap: h.indexOf('matricule sap'), nin: iNin } };
    }
    return { erreur: 'En-têtes introuvables dans BDDORGA (colonnes « Service » et « E-Mail » attendues)' };
  }

  /** Vrai si la chaîne est un numéro (identifiant, matricule numérique, téléphone…) et non un nom de personne. */
  function ressembleNumero(s) {
    var brut = String(s == null ? '' : s);
    var d = brut.replace(/[\s.\-_/]/g, '');
    return /^\d{6,}$/.test(d) || /\d{9,}/.test(brut);
  }
  /** « jean.dupont@exemple.dz » → « JEAN DUPONT » (repli quand le nom de la source est inutilisable). */
  function depuisEmail(email) {
    var l = String(email == null ? '' : email).split('@')[0].replace(/\d+/g, ' ').replace(/[._\-+]+/g, ' ').replace(/\s+/g, ' ').trim();
    return l ? l.toUpperCase() : '';
  }
  /** Nom à AFFICHER : jamais un numéro. À utiliser partout où un nom quitte le serveur (liste de connexion comprise, qui est publique). */
  function nomAffichable(nom, email) {
    var x = t(nom);
    if (x && !ressembleNumero(x)) return x;
    return depuisEmail(email) || '(nom à compléter)';
  }

  /** Date → « AAAA-MM-JJ » (objet Date, « JJ/MM/AAAA » ou « AAAA-MM-JJ ») ; chaîne vide si illisible ou impossible. */
  function dateIso(v) {
    if (v == null || v === '') return '';
    var y, m, d;
    if (Object.prototype.toString.call(v) === '[object Date]') { if (isNaN(v.getTime())) return ''; y = v.getFullYear(); m = v.getMonth() + 1; d = v.getDate(); }
    else {
      var s = t(v), a = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (a) { d = +a[1]; m = +a[2]; y = +a[3]; } else if (b) { y = +b[1]; m = +b[2]; d = +b[3]; } else return '';
    }
    var t2 = new Date(Date.UTC(y, m - 1, d));
    if (t2.getUTCFullYear() !== y || t2.getUTCMonth() !== m - 1 || t2.getUTCDate() !== d || y < 1950 || y > 2100) return '';
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  function telephone(v) {
    var s = t(v).replace(/[^\d+]/g, '');
    return /^\d{9}$/.test(s) ? '0' + s : s; // un tableur fait perdre le 0 initial des numéros
  }

  /** valeurs : tableau 2D de l'onglet BDDORGA. Retourne { personnes, ignores } ou { erreur }. */
  function lire(valeurs) {
    var c = colonnes(valeurs || []);
    if (c.erreur) return { erreur: c.erreur };
    var i = c.idx, personnes = [], ignores = [], avertissements = [], vus = {};
    function cell(row, k) { return k >= 0 ? row[k] : ''; }
    for (var r = c.ligne + 1; r < valeurs.length; r += 1) {
      var row = valeurs[r];
      var emailBrut = String(cell(row, i.email) == null ? '' : cell(row, i.email)), email = nettoyerEmail(emailBrut);
      var nom = '', brut = '', deduit = false;
      i.noms.forEach(function (c) { var v = t(cell(row, c)); if (v && !brut) brut = v; if (!nom && ressembleNom(v)) nom = v; }); // un numéro n'est JAMAIS pris pour un nom
      if (!nom && !brut && !email) continue; // ligne vide
      if (!nom && EMAIL.test(email)) { nom = depuisEmail(email); deduit = true; avertissements.push({ ligne: r + 1, texte: 'nom absent ou numérique : nom déduit de l\'e-mail (« ' + nom + ' »)' }); }
      if (!EMAIL.test(email)) { ignores.push({ ligne: r + 1, nom: nom, raison: 'e-mail manquant ou invalide' }); continue; }
      if (email !== t(emailBrut).toLowerCase()) avertissements.push({ ligne: r + 1, texte: 'e-mail nettoyé (espaces ou caractères invisibles retirés) : « ' + email + ' »' });
      if (vus[email]) { ignores.push({ ligne: r + 1, nom: nom, raison: 'e-mail en double (ligne ' + vus[email] + ')' }); continue; }
      vus[email] = r + 1;
      personnes.push({ nomDeduit: deduit, email: email, nom: nom, matricule: t(cell(row, i.matricule)), service: t(cell(row, i.service)),
                       fonction: t(cell(row, i.fonction)), dependance: t(cell(row, i.dependance)), telephone: telephone(cell(row, i.telephone)),
                       sona: t(cell(row, i.sona)).replace(/[\u200B-\u200D\uFEFF]/g, ''), date_integration: dateIso(cell(row, i.date_integration)), wifi_user: t(cell(row, i.wifi_user)), sap: t(cell(row, i.sap)), nin: nin(cell(row, i.nin)) });
    }
    return { personnes: personnes, ignores: ignores, avertissements: avertissements };
  }

  /**
   * Compare la liste de la source aux utilisateurs existants (objets avec au moins « email »).
   * Retourne { ajouts: [personne], maj: [{ email, nom, champs: { champ: nouvelleValeur } }], absents: [email], inchanges: n }.
   * Une valeur vide dans la source n'efface jamais une valeur existante.
   */
  function fusionner(existants, personnes) {
    var parEmail = {}; existants.forEach(function (u) { parEmail[String(u.email).toLowerCase()] = u; var p = nettoyerEmail(u.email); if (p && !parEmail[p]) parEmail[p] = u; });
    var dansSource = {}, ajouts = [], maj = [], inchanges = 0;
    personnes.forEach(function (p) {
      dansSource[p.email] = true;
      var u = parEmail[p.email];
      if (!u) { ajouts.push(p); return; }
      var champs = {};
      CHAMPS.forEach(function (k) {
        var actuel = k === 'date_integration' ? dateIso(u[k]) : t(u[k]);
        if (!p[k] || actuel === p[k]) return;
        if (k === 'nom' && p.nomDeduit && t(u.nom) && !ressembleNumero(u.nom)) return; // nom déduit de l'e-mail : jamais au détriment d'un vrai nom
        champs[k] = p[k];
      });
      if (Object.keys(champs).length) maj.push({ email: p.email, nom: u.nom || p.nom, champs: champs }); else inchanges += 1;
    });
    var absents = Object.keys(parEmail).filter(function (e) { return !dansSource[e]; });
    return { ajouts: ajouts, maj: maj, absents: absents, inchanges: inchanges };
  }

  /**
   * Lignes « fantômes » de la table Utilisateurs : ni uid ni e-mail (collées à la main avant la synchronisation, elles ne peuvent ni se connecter ni recevoir un rôle).
   * Retourne { doublons: [{ ligne, nom, avec }] (même personne déjà présente avec un e-mail : à supprimer), seuls: [{ ligne, nom }] (aucune autre ligne : à compléter dans BDDORGA) }.
   * `existants` : lignes de la table dans l'ordre (la 1re ligne de données = ligne 2).
   */
  function fantomes(existants) {
    var cle = function (u) { return n(u.nom).split(' ').filter(Boolean).sort().join(' '); };
    var vide = function (x) { return !t(x.email) && !t(x.uid); };
    var avecMail = existants.filter(function (u) { return !vide(u) && t(u.email); });
    var parNom = {}, parMat = {};
    avecMail.forEach(function (u) { if (cle(u)) parNom[cle(u)] = u; var m = n(u.matricule); if (m) parMat[m] = u; });
    var doublons = [], seuls = [];
    existants.forEach(function (u, i) {
      if (!vide(u) || (!t(u.nom) && !t(u.matricule))) return;
      var autre = parNom[cle(u)] || parMat[n(u.matricule)];
      if (autre) doublons.push({ ligne: i + 2, nom: t(u.nom), avec: t(autre.email), role: t(u.role), roleAvec: t(autre.role) }); else seuls.push({ ligne: i + 2, nom: t(u.nom) });
    });
    return { doublons: doublons, seuls: seuls };
  }

  /**
   * Plan d'écriture dans BDDORGA des champs saisis par l'agent (matricule, matricule SAP, NIN) : jamais d'écrasement d'une cellule déjà remplie,
   * colonnes « Matricule SAP » / « NIN » créées à droite si elles n'existent pas. Le NIN n'est écrit que si options.nin est vrai
   * (propriété ORGA_ECRIRE_NIN, à activer APRÈS avoir restreint le partage du fichier). Retourne { ligne, ecritures: [{ col, valeur, entete?, ligneEntete? }] } (1-based) ou { erreur }.
   */
  function planEcriture(valeurs, email, champs, options) {
    var c = colonnes(valeurs || []);
    if (c.erreur) return { erreur: c.erreur };
    var mail = t(email).toLowerCase(), ligne = -1;
    for (var r = c.ligne + 1; r < valeurs.length; r += 1) if (nettoyerEmail(valeurs[r][c.idx.email]) === nettoyerEmail(mail)) { ligne = r; break; }
    if (ligne < 0) return { erreur: 'Adresse absente de BDDORGA : ' + mail };
    var largeur = valeurs.reduce(function (m, row) { return Math.max(m, row.length); }, 0), ecritures = [];
    var autorises = ['matricule', 'sap']; if (options && options.nin) autorises.push('nin');
    if (options && options.etendu) autorises.push('telephone', 'sona'); // contrôle de l'annuaire : compléter les cases vides, colonnes existantes seulement
    autorises.forEach(function (k) {
      var v = t(champs && champs[k]); if (!v) return;
      var col = c.idx[k], neuf = false;
      if (col < 0) { if (k === 'matricule' || k === 'telephone' || k === 'sona') return; col = largeur; neuf = true; largeur += 1; }
      if (!neuf && t(valeurs[ligne][col])) return; // déjà renseigné dans le fichier : on n'y touche pas
      var e = { col: col + 1, valeur: v }; if (neuf) { e.entete = k === 'nin' ? 'NIN' : 'Matricule SAP'; e.ligneEntete = c.ligne + 1; }
      ecritures.push(e);
    });
    return { ligne: ligne + 1, ecritures: ecritures };
  }

  /**
   * Plan d'écriture d'un CHANGEMENT DE SERVICE dans BDDORGA : { ligne, col (1-based), ancien } ou { erreur }.
   * Ne touche qu'à la cellule « Service » de la ligne de la personne (repérée par son e-mail).
   */
  function planAffectation(valeurs, email, service) {
    var c = colonnes(valeurs || []);
    if (c.erreur) return { erreur: c.erreur };
    var mail = t(email).toLowerCase(), nouveau = t(service);
    if (!nouveau) return { erreur: 'Service vide' };
    for (var r = c.ligne + 1; r < valeurs.length; r += 1) {
      if (nettoyerEmail(valeurs[r][c.idx.email]) === nettoyerEmail(mail)) return { ligne: r + 1, col: c.idx.service + 1, ancien: t(valeurs[r][c.idx.service]) };
    }
    return { erreur: 'Adresse absente de BDDORGA : ' + mail };
  }

  return { fantomes: fantomes, nettoyerEmail: nettoyerEmail, analyserEmail: analyserEmail, planAffectation: planAffectation, nin: nin, planEcriture: planEcriture, lire: lire, fusionner: fusionner, colonnes: colonnes, ressembleNom: ressembleNom, nomAffichable: nomAffichable, dateIso: dateIso, norm: n, ressembleNumero: ressembleNumero, depuisEmail: depuisEmail, CHAMPS: CHAMPS };
})();

if (typeof module !== 'undefined') module.exports = Annuaire;
