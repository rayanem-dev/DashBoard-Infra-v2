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
    if (date !== aujourdhui) return { erreur: 'Un rapport ne peut être établi ou modifié que le jour même (les jours passés restent consultables)' };
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
        if (zone || texte || a !== '') { var lg = { zone: zone, texte: texte, avancement: a }; if (l.routine === true || l.routine === 'true' || l.routine === 1) lg.routine = true; lignes.push(lg); } // routine : travaux de routine de la prestation
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
      if (avl.length) av = Math.round(avl.reduce(function (t, x) { return t + x; }, 0) / avl.length * 10) / 10; // sans avancement global saisi : moyenne des ouvrages (modifiable : la valeur saisie l'emporte)
    }
    return { rapport: { date: date, chantier: chantier, effectif: eff, travaux: travaux, lignes: lignes, difficultes: nettoyer(r.difficultes), commentaire: nettoyer(r.commentaire), avancement: av } };
  }

  /** Lignes → texte lisible (« • Zone : texte — 99 % »), pour les anciens affichages et les e-mails. */
  function lignesEnTexte(lignes) {
    return (lignes || []).map(function (l) { return '• ' + (l.routine ? '[Routine] ' : '') + (l.zone ? l.zone + ' : ' : '') + (l.texte || '') + (l.avancement !== '' && l.avancement != null ? ' — ' + l.avancement + ' %' : ''); }).join('\n').slice(0, 3000);
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
  function idsSup(user) { return String((user && user.chantiers_sup) || '').split(/[;,\s]+/).map(norm).filter(Boolean); }
  /** Chantiers que l'utilisateur peut rapporter : niveau 3 = tous ; sinon ceux de son service (et ceux dont le service n'est pas encore défini). */
  function chantiersVisibles(chantiers, user, niveau) {
    if (niveau >= 3) return chantiers;
    var sup = idsSup(user);   // projets d'autres services ouverts à cet agent (Affectation du personnel)
    return chantiers.filter(function (c) { return !cleService(c.service) || servicePareil(c.service, user.service) || sup.indexOf(norm(c.id)) >= 0; });
  }
  function slugContrat(n) { return String(n == null ? '' : n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  /**
   * Chantiers à partir du Suivi CPM (lecture seule) : un chantier par contrat « en exécution ». enr = cpmEnregistrements_ ; existants = lignes de l'onglet Chantiers.
   * Retourne { ajouter: [{ id, nom, contrat, entreprise, service: '', source: 'cpm', actif: 1 }], maj: [{ id, nom }], reserves: [{ id, jusqu }], reactiver: [id] }.
   * Un chantier venu du CPM (source « cpm ») dont le contrat n'est plus en exécution passe en « levée des réserves » : il reste ouvert aux rapports jusqu'à `jusqu` (auj + 6 mois), puis se ferme tout seul.
   * Un chantier fermé ou en phase (préparation / réserves) dont le contrat est en exécution est remis en exécution (reactiver). Le service et les chantiers saisis à la main ne sont jamais touchés.
   */
  function chantiersDepuisCpm(enr, existants, auj) {
    var voulus = {}, ordre = [];
    (enr.ordre || []).forEach(function (cle) {
      var d = enr.dossiers[cle]; if (!d || sans(d.statut).indexOf('execution') < 0) return;
      var contrat = String(d.n_contrat || '').trim(), id = slugContrat(contrat); if (!id) return;
      if (voulus[id]) return;
      var ent = String(d.attribue_a || '').trim(), titre = String(d.intitule || '').trim() || contrat;
      voulus[id] = { id: id, nom: titre + (ent ? ' — ' + ent : ''), contrat: contrat, entreprise: ent, service: '', source: 'cpm', actif: 1 }; ordre.push(id);
    });
    var parId = {}; (existants || []).forEach(function (c) { if (c.id) parId[String(c.id).toLowerCase()] = c; });
    var plan = { ajouter: [], maj: [], reserves: [], reactiver: [] };
    ordre.forEach(function (id) {
      var c = parId[id], v = voulus[id];
      if (!c) { plan.ajouter.push(v); return; }
      if (String(c.nom) !== v.nom && String(c.source) === 'cpm') plan.maj.push({ id: id, nom: v.nom });
      if ((String(c.actif) === '0' && String(c.source) === 'cpm') || c.phase) plan.reactiver.push(id);
    });
    Object.keys(parId).forEach(function (id) { var c = parId[id]; if (String(c.source) === 'cpm' && !voulus[id] && String(c.actif) !== '0' && !c.phase) plan.reserves.push({ id: id, jusqu: auj ? jusquA(auj, MOIS_OUVERTURE) : '' }); });
    return plan;
  }

  // ---- chantiers hors contrat : préparation (avant le contrat) et levée des réserves (après) ----
  var PHASES = { preparation: 'Préparation', reserves: 'Levée des réserves' }, MOIS_OUVERTURE = 6;
  /** Date ISO + n mois (le jour est ramené à la fin du mois si besoin). */
  function jusquA(iso, n) { var p = String(iso).split('-'), y = +p[0], m = +p[1] - 1 + n, j = +p[2], d = new Date(Date.UTC(y, m, 1)); var fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), Math.min(j, fin))).toISOString().slice(0, 10); }
  /**
   * Contrats du Suivi CPM qui peuvent être ouverts « hors contrat » : tous sauf ceux en exécution (déjà des chantiers) et les infructueux.
   * Avant l'exécution (non démarré, dossier en cours, attribué, bloqué) → Préparation ; contrat échu / terminé → Levée des réserves.
   * Retourne [{ id, nom, contrat, entreprise, statut, phase }] (id = contrat sans caractères spéciaux, ou intitulé si le contrat n'a pas encore de numéro).
   */
  function horsExecution(enr) {
    var out = [], vus = {};
    ((enr && enr.ordre) || []).forEach(function (cle) {
      var d = enr.dossiers[cle]; if (!d) return;
      var st = sans(d.statut); if (!st || st.indexOf('infructueu') >= 0 || st.indexOf('execution') >= 0) return;
      var contrat = String(d.n_contrat || '').trim(), titre = String(d.intitule || '').trim(), ent = String(d.attribue_a || '').trim();
      var id = slugContrat(contrat) || (titre ? ('hc-' + slugContrat(titre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).slice(0, 44)) : ''); if (!id || vus[id]) return; vus[id] = 1;
      out.push({ id: id, nom: (titre || contrat) + (ent ? ' — ' + ent : ''), contrat: contrat, entreprise: ent, statut: String(d.statut || '').trim(), phase: /echu|termin|clotur|acheve/.test(st) ? 'reserves' : 'preparation' });
    });
    return out;
  }
  /** Chantier ouvert aux rapports à la date auj : actif, et pas arrivé au bout de sa période de préparation / de levée des réserves. */
  function ouvert(c, auj) { if (String(c.actif) === '0') return false; return !(c.phase && c.ouvert_jusqu && auj && String(auj) > String(c.ouvert_jusqu)); }
  /** Nom affiché : « Nom — Préparation » pour un chantier hors contrat. */
  function etiquette(c) { return PHASES[c.phase] ? c.nom + ' — ' + PHASES[c.phase] : c.nom; }
  /**
   * Ouverture (ou réouverture) d'un chantier hors contrat par le chef de division, le secrétariat ou un chef de service.
   * req = { phase, id?, nom?, service?, contrat?, jusqu? } ; existants = chantiers connus. Retourne { erreur } ou { id, valeurs, neuf }.
   * Un chef de service n'ouvre que pour son service. Sans date de fin, le chantier reste ouvert 6 mois.
   */
  function ouvrirChantier(req, user, role, auj, existants) {
    if (['chef_division', 'secretariat', 'chef_service', 'interim_chef_service'].indexOf(role) < 0) return { erreur: 'Seuls le chef de division, le secrétariat et les chefs de service peuvent ouvrir un chantier hors contrat' };
    var phase = String(req.phase || ''); if (!PHASES[phase]) return { erreur: 'Choisissez la phase : préparation ou levée des réserves' };
    var jusqu = String(req.jusqu || '').trim() || jusquA(auj, MOIS_OUVERTURE);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jusqu) || jusqu < auj) return { erreur: 'La date de fin doit être aujourd\'hui ou plus tard' };
    var chefService = role === 'chef_service' || role === 'interim_chef_service';
    var id = String(req.id || '').toLowerCase().trim(), ex = id ? (existants || []).filter(function (c) { return String(c.id).toLowerCase() === id; })[0] : null;
    if (id && !ex) return { erreur: 'Chantier inconnu' };
    if (!ex) {
      var nom = nettoyer(req.nom, 120); if (nom.length < 3) return { erreur: 'Indiquez le nom du chantier (3 caractères au moins)' };
      id = ('hc-' + slugContrat(nom.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))).slice(0, 48).replace(/-+$/, '');
      ex = (existants || []).filter(function (c) { return String(c.id).toLowerCase() === id; })[0] || null;
      if (!ex) {
        var service = chefService ? String(user.service || '') : nettoyer(req.service, 60);
        return { id: id, neuf: true, valeurs: { id: id, nom: nom, service: service, contrat: nettoyer(req.contrat, 60), entreprise: '', source: 'manuel', actif: 1, phase: phase, ouvert_jusqu: jusqu } };
      }
    }
    if (chefService && cleService(ex.service) && !servicePareil(ex.service, user.service)) return { erreur: 'Ce chantier est rattaché à un autre service' };
    var v = { actif: 1, phase: phase, ouvert_jusqu: jusqu };
    if (!String(ex.service || '').trim()) { var sv = chefService ? String(user.service || '') : nettoyer(req.service, 60); if (sv) v.service = sv; }
    return { id: String(ex.id).toLowerCase(), neuf: false, valeurs: v };
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
      return { id: c.id, nom: etiquette(c), phase: c.phase || '', service: c.service, rapports: rs, effectif: rs.reduce(function (s, r) { return s + (Number(r.effectif) || 0); }, 0),
               avancement: avs.length ? Math.max.apply(null, avs) : null };
    });
    return { date: date, chantiers: out, manquants: out.filter(function (c) { return !c.rapports.length && !c.phase; }).length };
  }

  function dateFr(s) {
    var t = String(s || '').trim(), m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t), iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    var y, mo, d; if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; } else if (iso) { y = +iso[1]; mo = +iso[2]; d = +iso[3]; } else return null;
    if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return Date.UTC(y, mo - 1, d);
  }
  function isoDe(ms) { return new Date(ms).toISOString().slice(0, 10); }
  /**
   * Tableau des chantiers (pages Avancement et Suivi chantier) : un élément par chantier ACTIF qui a un contrat (Affectation chantier),
   * avec les données du Suivi CPM (lecture seule : montant, ODS, échéance, part du délai écoulée) et ce que disent les rapports journaliers
   * (dernier rapport, avancement déclaré, effectif, rapports des 7 derniers jours). Le service vient de l'Affectation chantier.
   * enr = cpmEnregistrements_ ; auj = 'AAAA-MM-JJ'.
   */
  function tableau(chantiers, enr, rapports, auj) {
    var parContrat = {};
    ((enr && enr.ordre) || []).forEach(function (cle) {
      var d = enr.dossiers[cle]; if (!d || sans(d.statut).indexOf('execution') < 0) return;
      var id = slugContrat(d.n_contrat); if (id && !parContrat[id]) parContrat[id] = d;
    });
    var aujMs = dateFr(auj), il7 = aujMs == null ? null : isoDe(aujMs - 6 * 864e5);
    return chantiers.filter(function (c) { return String(c.actif) !== '0' && !c.phase && String(c.contrat || '').trim(); }).map(function (c) {
      var d = parContrat[c.id] || null, ods = d ? dateFr(d.date_ods) : null, ech = d ? dateFr(d.echeance) : null;
      var duree = d ? parseFloat(String(d.duree_contrat).replace(',', '.')) || null : null;
      if (ech == null && ods != null && duree) { var x = new Date(ods); x.setUTCMonth(x.getUTCMonth() + Math.round(duree)); ech = x.getTime(); }
      var delai = null, restants = null;
      if (ods != null && ech != null && aujMs != null && ech > ods) {
        delai = Math.max(0, Math.min(100, Math.round(((aujMs - ods) / (ech - ods)) * 100)));
        restants = Math.round((ech - aujMs) / 864e5);
      }
      var rs = rapports.filter(function (r) { return norm(r.chantier) === norm(c.id); }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
      var dern = rs[0] || null, avancement = null, lignes = [];
      if (dern) {
        var memeJour = rs.filter(function (r) { return r.date === dern.date; });
        var avs = memeJour.map(function (r) { return r.avancement; }).filter(function (a) { return a !== '' && a != null; });
        avancement = avs.length ? Math.max.apply(null, avs) : null;
        memeJour.forEach(function (r) { (r.lignes || []).forEach(function (l) { if (l && (l.zone || l.texte)) lignes.push({ zone: l.zone || '', texte: l.texte || '', avancement: l.avancement === '' || l.avancement == null ? null : Number(l.avancement), routine: !!l.routine }); }); });
        if (avancement == null) { var la = lignes.map(function (l) { return l.avancement; }).filter(function (a) { return a != null; }); if (la.length) avancement = Math.round(la.reduce(function (s, a) { return s + a; }, 0) / la.length * 10) / 10; }
      }
      return {
        id: c.id, nom: d && d.intitule ? d.intitule : c.nom, contrat: c.contrat, entreprise: c.entreprise || (d ? d.attribue_a : ''), service: c.service || '',
        fiche: c.fiche || '', suivi: c.suivi || '', montant: d ? d.montant : '', ods: ods == null ? '' : isoDe(ods), echeance: ech == null ? '' : isoDe(ech), delai_pct: delai, jours_restants: restants,
        avancement: avancement, dernier: dern ? { date: dern.date, auteur: dern.auteur_nom || '', effectif: dern.effectif, difficultes: dern.difficultes || '', lignes: lignes.slice(0, 30) } : null,
        rapports_7j: il7 == null ? 0 : rs.filter(function (r) { return r.date >= il7 && r.date <= auj; }).length
      };
    });
  }

  /** Correction d'un rapport passé : chef de division, secrétariat et chefs de service, pour TOUS les services. role = rôle canonique. */
  function peutCorriger(user, role) {
    return ['chef_division', 'secretariat', 'chef_service', 'interim_chef_service'].indexOf(role) >= 0;
  }
  /** Mêmes contrôles qu'une saisie, mais sans la règle « jour même » : la date et le chantier du rapport d'origine sont conservés. */
  function corriger(req, existant) {
    var v = valider({ date: existant.date, chantier: existant.chantier, effectif: req.effectif, avancement: req.avancement, travaux: req.travaux, lignes: req.lignes, difficultes: req.difficultes, commentaire: req.commentaire },
      existant.date, 3, [norm(existant.chantier)]);
    return v;
  }

  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function dateLongue(iso) { var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return JOURS[d.getUTCDay()] + ' ' + p[2] + '/' + p[1] + '/' + p[0]; }
  /** Rapport consolidé (résultat de synthese) → { sujet, html } pour l'e-mail (styles en ligne). */
  function consolideMail(s, version) {
    var avec = s.chantiers.filter(function (c) { return c.rapports.length; }), sans = s.chantiers.filter(function (c) { return !c.rapports.length; });
    var eff = avec.reduce(function (n, c) { return n + (Number(c.effectif) || 0); }, 0);
    var h = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:720px"><h2 style="margin:0 0 4px;color:#1A1A2E">Rapport journalier consolidé des chantiers</h2>' +
      '<p style="margin:0 0 12px;color:#555">' + esc(dateLongue(s.date)) + (version ? ' · version ' + version : '') + ' — Division Infrastructure RNS</p>' +
      '<p style="margin:0 0 14px"><b>' + s.chantiers.length + '</b> chantier(s) suivi(s) · <b>' + avec.length + '</b> avec rapport · <b>' + sans.length + '</b> sans rapport · effectif présent : <b>' + eff + '</b></p>';
    var parService = {}, ordre = [];
    avec.forEach(function (c) { var k = c.service || 'Sans service'; if (!parService[k]) { parService[k] = []; ordre.push(k); } parService[k].push(c); });
    ordre.forEach(function (k) {
      h += '<h3 style="margin:18px 0 6px;font-size:15px;color:#B94E00;border-bottom:2px solid #F48C06">' + esc(k) + '</h3>';
      parService[k].forEach(function (c) {
        h += '<div style="margin:0 0 12px;padding:8px 12px;border:1px solid #ddd;border-radius:8px"><b>' + esc(c.nom) + '</b><div style="color:#555;font-size:12px">Effectif : ' + c.effectif + (c.avancement != null ? ' · Avancement : ' + c.avancement + ' %' : '') + '</div>';
        c.rapports.forEach(function (r) {
          h += '<div style="margin-top:6px;font-size:13px"><span style="color:#555">Établi par ' + esc(r.auteur_nom || r.auteur_email) + '</span>';
          if (r.lignes && r.lignes.length) h += '<ul style="margin:4px 0;padding-left:18px">' + r.lignes.map(function (l) { return '<li>' + (l.routine ? '<i>[Routine]</i> ' : '') + (l.zone ? '<b>' + esc(l.zone) + '</b> : ' : '') + esc(l.texte || '') + (l.avancement !== '' && l.avancement != null ? ' — ' + esc(l.avancement) + ' %' : '') + '</li>'; }).join('') + '</ul>';
          else if (r.travaux) h += '<p style="margin:4px 0">' + esc(r.travaux) + '</p>';
          if (r.difficultes) h += '<p style="margin:4px 0;color:#B91C1C"><b>Difficultés :</b> ' + esc(r.difficultes) + '</p>';
          h += '</div>';
        });
        h += '</div>';
      });
    });
    if (sans.length) h += '<p style="color:#B91C1C"><b>Sans rapport :</b> ' + sans.map(function (c) { return esc(c.nom); }).join(' · ') + '</p>';
    h += '<p style="color:#888;font-size:12px;margin-top:18px">Envoyé depuis le Portail Infra — rapports journaliers.</p></div>';
    return { sujet: 'Rapport journalier consolidé — ' + dateLongue(s.date), html: h };
  }
  /** Adresses des destinataires : groupes = { secretariat, chef_service, chef_division } (booléens) ; seuls les comptes actifs avec e-mail. */
  function destinataires(utilisateurs, groupes) {
    var roles = [];
    if (groupes && groupes.secretariat) roles.push('secretariat');
    if (groupes && groupes.chef_service) roles.push('chef_service', 'interim_chef_service');
    if (groupes && groupes.chef_division) roles.push('chef_division');
    return destinatairesDetail(utilisateurs, groupes).map(function (d) { return d.email; });
  }
  /** Même liste, avec le nom et le rôle de chacun : [{ nom, email, role }]. */
  function destinatairesDetail(utilisateurs, groupes) {
    var roles = [];
    if (groupes && groupes.secretariat) roles.push('secretariat');
    if (groupes && groupes.chef_service) roles.push('chef_service', 'interim_chef_service');
    if (groupes && groupes.chef_division) roles.push('chef_division');
    var vus = {}, out = [];
    (utilisateurs || []).forEach(function (u) {
      var m = norm(u.email_contact || u.email);
      if (roles.indexOf(norm(u.role)) < 0 || String(u.actif) === '0' || u.actif === false || !m || vus[m]) return;
      vus[m] = 1; out.push({ nom: String(u.nom || ''), email: m, role: norm(u.role), service: String(u.service || '') });
    });
    return out;
  }

  return { destinatairesDetail: destinatairesDetail, peutCorriger: peutCorriger, corriger: corriger, idsSup: idsSup, consolideMail: consolideMail, destinataires: destinataires, tableau: tableau, valider: valider, lignesEnTexte: lignesEnTexte, cleService: cleService, servicePareil: servicePareil, chantiersVisibles: chantiersVisibles, chantiersDepuisCpm: chantiersDepuisCpm, PHASES: PHASES, horsExecution: horsExecution, jusquA: jusquA, ouvert: ouvert, etiquette: etiquette, ouvrirChantier: ouvrirChantier, slugContrat: slugContrat, filtrer: filtrer, synthese: synthese, peutViser: peutViser, dansLaPortee: dansLaPortee, cle: cle, nettoyer: nettoyer };
})();

if (typeof module !== 'undefined') module.exports = Rapports;
