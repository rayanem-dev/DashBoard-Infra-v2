/**
 * Synchronisation de l'onglet « Utilisateurs » avec l'onglet BDDORGA du fichier « Organigrame Div Infra » (fonctions PURES, testées).
 *
 * On ne lit QUE les colonnes d'identité utiles : nom, e-mail, matricule, service, intitulé du poste, employeur (dépendance), téléphone.
 * Les colonnes sensibles de ce fichier (mots de passe Windows / Wi-Fi, identifiants, numéros nationaux…) ne sont JAMAIS lues.
 * Les colonnes gérées à la main dans la passerelle (uid, role, actif, civilite) ne sont jamais modifiées.
 */
var Annuaire = (function () {
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var CHAMPS = ['nom', 'matricule', 'service', 'fonction', 'dependance', 'telephone'];

  function n(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function t(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

  /** Repère la ligne d'en-têtes (dans les 10 premières lignes) et les colonnes utiles. */
  function colonnes(valeurs) {
    for (var r = 0; r < Math.min(10, valeurs.length); r += 1) {
      var h = valeurs[r].map(n);
      var iMail = Math.max(h.indexOf('e mail'), h.indexOf('email'));
      var iServ = h.indexOf('service');
      if (iMail < 0 || iServ < 0) continue;
      var iDep = h.indexOf('dependance');
      var iNom = -1;
      ['nom', 'nom prenom', 'nom et prenom', 'agent'].forEach(function (c) { if (iNom < 0) iNom = h.indexOf(c); });
      var iNom2 = -1;
      if (iNom < 0 && iDep >= 0 && h[iDep + 1] === '') { iNom = iDep + 1; if (h[iDep + 2] === '') iNom2 = iDep + 2; } // colonne(s) sans en-tête juste après « dépendance » : le nom, et parfois un numéro à côté
      if (iNom < 0) return { erreur: 'Colonne des noms introuvable dans BDDORGA (attendue juste après « dependance », ou intitulée « Nom »)' };
      var iTel = Math.max(h.indexOf('numero telephone'), h.indexOf('telephone'));
      return { ligne: r, idx: { nom: iNom, nom2: iNom2, email: iMail, matricule: h.indexOf('matricule'), service: iServ, fonction: h.lastIndexOf('fonction'), dependance: iDep, telephone: iTel } };
    }
    return { erreur: 'En-têtes introuvables dans BDDORGA (colonnes « Service » et « E-Mail » attendues)' };
  }

  /** Vrai si la chaîne est un numéro (identifiant, matricule numérique, téléphone…) et non un nom de personne. */
  function ressembleNumero(s) {
    var brut = String(s == null ? '' : s);
    var d = brut.replace(/[\s.\-_/]/g, '');
    return /^\d{6,}$/.test(d) || /\d{9,}/.test(brut);
  }
  /** « noureddine.lakkaichi@sonatrach.dz » → « NOUREDDINE LAKKAICHI » (repli quand le nom de la source est inutilisable). */
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
      var email = t(cell(row, i.email)).toLowerCase();
      var nom = '';
      [cell(row, i.nom), cell(row, i.nom2)].forEach(function (c) { if (!nom && t(c) && !ressembleNumero(c)) nom = t(c); }); // un numéro n'est JAMAIS pris pour un nom
      var brut = t(cell(row, i.nom)) || t(cell(row, i.nom2));
      if (!nom && !brut && !email) continue; // ligne vide
      if (!nom && EMAIL.test(email)) { nom = depuisEmail(email); avertissements.push({ ligne: r + 1, texte: 'nom absent ou numérique : nom déduit de l\'e-mail (« ' + nom + ' »)' }); }
      if (!EMAIL.test(email)) { ignores.push({ ligne: r + 1, nom: nom, raison: 'e-mail manquant ou invalide' }); continue; }
      if (vus[email]) { ignores.push({ ligne: r + 1, nom: nom, raison: 'e-mail en double (ligne ' + vus[email] + ')' }); continue; }
      vus[email] = r + 1;
      personnes.push({ email: email, nom: nom, matricule: t(cell(row, i.matricule)), service: t(cell(row, i.service)),
                       fonction: t(cell(row, i.fonction)), dependance: t(cell(row, i.dependance)), telephone: telephone(cell(row, i.telephone)) });
    }
    return { personnes: personnes, ignores: ignores, avertissements: avertissements };
  }

  /**
   * Compare la liste de la source aux utilisateurs existants (objets avec au moins « email »).
   * Retourne { ajouts: [personne], maj: [{ email, nom, champs: { champ: nouvelleValeur } }], absents: [email], inchanges: n }.
   * Une valeur vide dans la source n'efface jamais une valeur existante.
   */
  function fusionner(existants, personnes) {
    var parEmail = {}; existants.forEach(function (u) { parEmail[String(u.email).toLowerCase()] = u; });
    var dansSource = {}, ajouts = [], maj = [], inchanges = 0;
    personnes.forEach(function (p) {
      dansSource[p.email] = true;
      var u = parEmail[p.email];
      if (!u) { ajouts.push(p); return; }
      var champs = {};
      CHAMPS.forEach(function (k) { if (p[k] && t(u[k]) !== p[k]) champs[k] = p[k]; });
      if (Object.keys(champs).length) maj.push({ email: p.email, nom: u.nom || p.nom, champs: champs }); else inchanges += 1;
    });
    var absents = Object.keys(parEmail).filter(function (e) { return !dansSource[e]; });
    return { ajouts: ajouts, maj: maj, absents: absents, inchanges: inchanges };
  }

  return { lire: lire, fusionner: fusionner, colonnes: colonnes, nomAffichable: nomAffichable, ressembleNumero: ressembleNumero, depuisEmail: depuisEmail, CHAMPS: CHAMPS };
})();

if (typeof module !== 'undefined') module.exports = Annuaire;
