/**
 * Utilisateurs lus DIRECTEMENT dans BDDORGA (un seul fichier central), au lieu de la copie « Utilisateurs » de Gateway_DB.
 *
 * Activation : propriété de script UTILISATEURS_SOURCE = « bddorga » (fonctions activerBDDORGADirect / desactiverBDDORGADirect).
 * Sans cette propriété, rien ne change. En cas d'échec de lecture de BDDORGA, la passerelle retombe sur l'ancienne table (personne n'est bloqué).
 *
 * Colonnes ajoutées à droite de BDDORGA par la migration : « Rôle », « Actif », « E-mail de contact », « Civilité ».
 * Quand une de ces colonnes existe dans BDDORGA, elle fait foi (vide = pas de rôle / actif / pas d'adresse de contact).
 * Les mots de passe et leurs empreintes ne sont JAMAIS dans BDDORGA : ils restent dans Gateway_Secrets.
 * Les personnes présentes seulement dans l'ancienne table (avec e-mail) sont conservées (marquées horsBDDORGA) pour ne verrouiller aucun compte.
 */
var UBD = (function () {
  var ENTETES = { role: 'Rôle', actif: 'Actif', email_contact: 'E-mail de contact', civilite: 'Civilité' };
  var DIRECTS = ['nom', 'matricule', 'service', 'fonction', 'dependance', 'telephone', 'sona', 'date_integration', 'wifi_user', 'sap', 'nin'];

  function actifDe(v, defaut) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (s === '') return defaut;
    return /^(0|non|no|false|faux|inactif)$/.test(s) ? 0 : 1;
  }

  /** Construit la table Utilisateurs depuis la lecture de BDDORGA (Annuaire.lire + Annuaire.colonnes) et l'ancienne table. */
  function construire(lu, col, anciens, uidPour) {
    var idx = (col && col.idx) || {};
    var parEmail = {};
    anciens.forEach(function (u) { var e = String(u.email || '').toLowerCase(); if (e) parEmail[e] = u; });
    var vus = {}, sortie = [];
    lu.personnes.forEach(function (p) {
      var a = parEmail[p.email] || {}; vus[p.email] = true;
      var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; });
      o.uid = a.uid || uidPour(p.email); o.email = p.email;
      DIRECTS.forEach(function (k) { if (k === 'nom') o.nom = p.nom || a.nom || ''; else o[k] = p[k] !== '' && p[k] != null ? p[k] : (a[k] === undefined ? '' : a[k]); });
      o.role = idx.role >= 0 ? p.role : (a.role || '');
      o.actif = idx.actif >= 0 ? actifDe(p.actif, 1) : actifDe(a.actif, 1);
      o.email_contact = idx.email_contact >= 0 ? p.email_contact : (a.email_contact || '');
      o.civilite = idx.civilite >= 0 ? p.civilite : (a.civilite || '');
      o.ligne_bddorga = p.ligne;
      sortie.push(o);
    });
    anciens.forEach(function (a) {
      var e = String(a.email || '').toLowerCase();
      if (!e || vus[e]) return; // sans e-mail : ligne fantôme, elle disparaît
      var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; }); o.horsBDDORGA = 1; sortie.push(o);
    });
    return sortie;
  }

  /**
   * Plan d'écriture dans BDDORGA pour une personne (par e-mail). Retourne { ligne, ecritures: [{ col, valeur, entete?, ligneEntete }], reste: {champs non gérés} } ou { erreur }.
   * Les colonnes Rôle / Actif / E-mail de contact / Civilité sont créées à droite si besoin. Le NIN n'est écrit que si options.nin.
   */
  function planEcriture(valeurs, email, champs, options) {
    var c = Annuaire.colonnes(valeurs); if (c.erreur) return { erreur: c.erreur };
    var lu = Annuaire.lire(valeurs); if (lu.erreur) return { erreur: lu.erreur };
    var cible = String(email || '').toLowerCase(), p = null;
    lu.personnes.forEach(function (x) { if (x.email === cible) p = x; });
    if (!p) return { erreur: 'Personne introuvable dans BDDORGA (' + cible + ')' };
    var i = c.idx, ecritures = [], reste = {}, suivante = (valeurs[c.ligne] || []).length;
    Object.keys(champs).forEach(function (k) {
      if (k === 'nin' && !(options && options.nin)) { reste[k] = champs[k]; return; }
      var col = i[k] === undefined ? -1 : i[k];
      if (col >= 0 && k !== 'nom') { ecritures.push({ col: col + 1, valeur: champs[k] }); return; }
      if (ENTETES[k]) {
        var dejaCree = ecritures.filter(function (e) { return e.entete === ENTETES[k]; })[0];
        if (!dejaCree) { dejaCree = { col: ++suivante, valeur: champs[k], entete: ENTETES[k], ligneEntete: c.ligne + 1 }; ecritures.push(dejaCree); }
        else dejaCree.valeur = champs[k];
        return;
      }
      reste[k] = champs[k];
    });
    return { ligne: p.ligne, ecritures: ecritures, reste: reste };
  }
  return { construire: construire, planEcriture: planEcriture, actifDe: actifDe, ENTETES: ENTETES };
})();
if (typeof module !== 'undefined') module.exports = UBD;
