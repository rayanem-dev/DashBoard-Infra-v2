/**
 * Rapports journaliers : validation, portée (qui voit quoi), visa, synthèse du jour. Fonctions PURES (test/rapports.test.js).
 *
 * Niveaux du module « rapports » :
 *   1 = voit ses propres rapports ;
 *   2 = saisit ses rapports ; voit ceux de son service ; vise ceux de son service (hors les siens) ;
 *   3 = voit tout ; vise tout (hors les siens) ; synthèse du jour par chantier ; peut saisir jusqu'à 60 jours en arrière.
 */
var Rapports = (function () {
  var MAX_TEXTE = 1000;
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function nettoyer(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || MAX_TEXTE); }

  function cle(date, chantier, email) { return [date, norm(chantier), norm(email)].join('|'); }

  /** Retourne { erreur } ou { rapport } (champs nettoyés). */
  function valider(r, aujourdhui, niveau, idsChantiers) {
    r = r || {};
    var date = String(r.date || '');
    if (!Dates.isDate(date)) return { erreur: 'Date invalide' };
    if (date > aujourdhui) return { erreur: 'La date ne peut pas être dans le futur' };
    var limite = niveau >= 3 ? 60 : 7;
    if (Dates.diffDays(date, aujourdhui) > limite) return { erreur: 'Rapport trop ancien (' + limite + ' jours maximum)' };
    var chantier = norm(r.chantier);
    if (idsChantiers.indexOf(chantier) === -1) return { erreur: 'Chantier inconnu' };
    var eff = Number(r.effectif);
    if (r.effectif === '' || r.effectif == null || !(eff >= 0 && eff <= 1000) || Math.floor(eff) !== eff) return { erreur: 'Effectif : nombre entier de 0 à 1000' };
    var travaux = nettoyer(r.travaux);
    if (travaux.length < 3) return { erreur: 'Décrivez les travaux réalisés' };
    var av = '';
    if (r.avancement !== '' && r.avancement != null) {
      av = Number(r.avancement);
      if (!(av >= 0 && av <= 100)) return { erreur: 'Avancement : entre 0 et 100 %' };
      av = Math.round(av * 10) / 10;
    }
    return { rapport: { date: date, chantier: chantier, effectif: eff, travaux: travaux, difficultes: nettoyer(r.difficultes), commentaire: nettoyer(r.commentaire), avancement: av } };
  }

  function dansLaPortee(user, niveau, r) {
    if (niveau >= 3) return true;
    if (norm(r.auteur_email) === norm(user.email)) return true;
    return niveau === 2 && !!norm(user.service) && norm(r.service) === norm(user.service);
  }
  function peutViser(user, niveau, r) {
    return niveau >= 2 && norm(r.auteur_email) !== norm(user.email) && dansLaPortee(user, niveau, r);
  }

  /** Rapports visibles par l'utilisateur, filtrés (du, au, chantier, auteur), du plus récent au plus ancien. */
  function filtrer(liste, user, niveau, crit) {
    crit = crit || {};
    return liste.filter(function (r) {
      if (!dansLaPortee(user, niveau, r)) return false;
      if (crit.du && r.date < crit.du) return false;
      if (crit.au && r.date > crit.au) return false;
      if (crit.chantier && norm(r.chantier) !== norm(crit.chantier)) return false;
      if (crit.auteur && norm(r.auteur_email) !== norm(crit.auteur)) return false;
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : String(a.chantier).localeCompare(String(b.chantier)); });
  }

  /** Synthèse d'un jour : chaque chantier actif avec ses rapports (ou « aucun rapport »). */
  function synthese(chantiers, liste, date) {
    var out = chantiers.filter(function (c) { return String(c.actif) !== '0'; }).map(function (c) {
      var rs = liste.filter(function (r) { return r.date === date && norm(r.chantier) === norm(c.id); });
      var avs = rs.map(function (r) { return r.avancement; }).filter(function (a) { return a !== '' && a != null; });
      return { id: c.id, nom: c.nom, service: c.service, rapports: rs, effectif: rs.reduce(function (s, r) { return s + (Number(r.effectif) || 0); }, 0),
               avancement: avs.length ? Math.max.apply(null, avs) : null };
    });
    return { date: date, chantiers: out, manquants: out.filter(function (c) { return !c.rapports.length; }).length };
  }

  return { valider: valider, filtrer: filtrer, synthese: synthese, peutViser: peutViser, dansLaPortee: dansLaPortee, cle: cle, nettoyer: nettoyer };
})();

if (typeof module !== 'undefined') module.exports = Rapports;
