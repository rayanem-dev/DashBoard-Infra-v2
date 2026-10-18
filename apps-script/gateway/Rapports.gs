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
    // lignes par ouvrage / zone : { zone, texte, avancement } (30 au plus) ; le texte libre reste possible
    var lignes = [];
    if (Array.isArray(r.lignes)) {
      for (var k = 0; k < r.lignes.length && lignes.length < 30; k += 1) {
        var l = r.lignes[k]; if (!l) continue;
        var zone = nettoyer(l.zone, 120), texte = nettoyer(l.texte, 600), a = '';
        if (l.avancement !== '' && l.avancement != null) { a = Number(l.avancement); if (!(a >= 0 && a <= 100)) return { erreur: 'Avancement d\'une ligne : entre 0 et 100 %' }; a = Math.round(a * 10) / 10; }
        if (zone || texte || a !== '') lignes.push({ zone: zone, texte: texte, avancement: a });
      }
    }
    var travaux = nettoyer(r.travaux);
    if (travaux.length < 3 && !lignes.some(function (l) { return l.texte.length >= 3; })) return { erreur: 'Décrivez les travaux réalisés' };
    if (travaux.length < 3) travaux = lignesEnTexte(lignes);
    var av = '';
    if (r.avancement !== '' && r.avancement != null) {
      av = Number(r.avancement);
      if (!(av >= 0 && av <= 100)) return { erreur: 'Avancement : entre 0 et 100 %' };
      av = Math.round(av * 10) / 10;
    } else {
      var avl = lignes.map(function (l) { return l.avancement; }).filter(function (x) { return x !== ''; });
      if (avl.length) av = Math.max.apply(null, avl); // sans avancement global : le plus avancé des ouvrages
    }
    return { rapport: { date: date, chantier: chantier, effectif: eff, travaux: travaux, lignes: lignes, difficultes: nettoyer(r.difficultes), commentaire: nettoyer(r.commentaire), avancement: av } };
  }

  /** Lignes → texte lisible (« • Zone : texte — 99 % »), pour les anciens affichages et les e-mails. */
  function lignesEnTexte(lignes) {
    return (lignes || []).map(function (l) { return '• ' + (l.zone ? l.zone + ' : ' : '') + (l.texte || '') + (l.avancement !== '' && l.avancement != null ? ' — ' + l.avancement + ' %' : ''); }).join('\n').slice(0, 3000);
  }
  function sans(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
  /** Clé de service (construction / electromecanique / entretien / autre texte normalisé) : « Service Construction (Génie Civil) » = « Construction ». */
  function cleService(s) {
    var t = sans(s);
    if (!t) return '';
    if (/construction|genie civil/.test(t)) return 'construction';
    if (/electrom/.test(t)) return 'electromecanique';
    if (/entretien/.test(t)) return 'entretien';
    return t;
  }
  function servicePareil(a, b) { var x = cleService(a), y = cleService(b); return !!x && x === y; }
  /** Chantiers que l'utilisateur peut rapporter : niveau 3 = tous ; sinon ceux de son service (et ceux dont le service n'est pas encore défini). */
  function chantiersVisibles(chantiers, user, niveau) {
    if (niveau >= 3) return chantiers;
    return chantiers.filter(function (c) { return !cleService(c.service) || servicePareil(c.service, user.service); });
  }
  function slugContrat(n) { return String(n == null ? '' : n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  /**
   * Chantiers à partir du Suivi CPM (lecture seule) : un chantier par contrat « en exécution ». enr = cpmEnregistrements_ ; existants = lignes de l'onglet Chantiers.
   * Retourne { ajouter: [{ id, nom, contrat, entreprise, service: '', source: 'cpm', actif: 1 }], maj: [{ id, nom }], desactiver: [id], reactiver: [id] }.
   * Seuls les chantiers venus du CPM (source « cpm ») sont désactivés quand leur contrat n'est plus en exécution ; le service et les chantiers saisis à la main ne sont jamais touchés.
   */
  function chantiersDepuisCpm(enr, existants) {
    var voulus = {}, ordre = [];
    (enr.ordre || []).forEach(function (cle) {
      var d = enr.dossiers[cle]; if (!d || sans(d.statut).indexOf('execution') < 0) return;
      var contrat = String(d.n_contrat || '').trim(), id = slugContrat(contrat); if (!id) return;
      if (voulus[id]) return;
      var ent = String(d.attribue_a || '').trim(), titre = String(d.intitule || '').trim() || contrat;
      voulus[id] = { id: id, nom: titre + (ent ? ' — ' + ent : ''), contrat: contrat, entreprise: ent, service: '', source: 'cpm', actif: 1 }; ordre.push(id);
    });
    var parId = {}; (existants || []).forEach(function (c) { if (c.id) parId[String(c.id).toLowerCase()] = c; });
    var plan = { ajouter: [], maj: [], desactiver: [], reactiver: [] };
    ordre.forEach(function (id) {
      var c = parId[id], v = voulus[id];
      if (!c) { plan.ajouter.push(v); return; }
      if (String(c.nom) !== v.nom && String(c.source) === 'cpm') plan.maj.push({ id: id, nom: v.nom });
      if (String(c.actif) === '0' && String(c.source) === 'cpm') plan.reactiver.push(id);
    });
    Object.keys(parId).forEach(function (id) { var c = parId[id]; if (String(c.source) === 'cpm' && !voulus[id] && String(c.actif) !== '0') plan.desactiver.push(id); });
    return plan;
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

  return { valider: valider, lignesEnTexte: lignesEnTexte, cleService: cleService, servicePareil: servicePareil, chantiersVisibles: chantiersVisibles, chantiersDepuisCpm: chantiersDepuisCpm, slugContrat: slugContrat, filtrer: filtrer, synthese: synthese, peutViser: peutViser, dansLaPortee: dansLaPortee, cle: cle, nettoyer: nettoyer };
})();

if (typeof module !== 'undefined') module.exports = Rapports;
