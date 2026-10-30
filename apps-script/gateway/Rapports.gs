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
  /** Texte libre en HTML : retour à la ligne conservé ; une ligne commençant par * (ou - ou •) ouvre un nouveau point (liste). */
  function texteLibreHtml(t, style) {
    var puces = false, out = [];
    String(t == null ? '' : t).replace(/\r/g, '').split('\n').forEach(function (x) { x.trim().split(/\s\*\s/).forEach(function (y, k) { var m = /^[*•]\s*|^-\s+/.exec(y); if (m || k > 0) puces = true; y = y.replace(/^[*•]\s*|^-\s+/, '').trim(); if (y) out.push(esc(y)); }); });
    return puces ? '<ul style="margin:3px 0 3px 18px;padding:0">' + out.map(function (y) { return '<li>' + y + '</li>'; }).join('') + '</ul>' : '<p style="' + style + '">' + out.join('<br>') + '</p>';
  }
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function dateLongue(iso) { var p = String(iso).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return JOURS[d.getUTCDay()] + ' ' + p[2] + '/' + p[1] + '/' + p[0]; }
  /**
   * Rapport consolidé (résultat de synthese) → { sujet, html } pour l'e-mail : MÊME contenu que le consolidé imprimé (en-tête Sonatrach, résumé, services, chantiers avec leurs rapports :
   * travaux, difficultés, commentaire, visa ; chantiers sans rapport ; pied avec auteur, date, version et signatures). Styles en ligne (tableaux) pour les messageries.
   * meta (facultatif) = { genere_par, genere_le }.
   */
  /**
   * Photos et vidéos d'un rapport dans le consolidé : opts.photo(id) → source de l'image (cid: pour l'e-mail, data: pour le PDF) ou '' ;
   * opts.lien(id) → { url, jusqua } du lien temporaire d'une vidéo ou null. Sans opts : simple mention.
   */
  function mediasHtml(r, opts) {
    var ms = r.medias || []; if (!ms.length) return '';
    var photos = ms.filter(function (m) { return m.type !== 'video'; }), videos = ms.filter(function (m) { return m.type === 'video'; }), h = '', omises = 0;
    if (photos.length) {
      var imgs = '';
      photos.forEach(function (m) { var src = opts && opts.photo ? opts.photo(m.id) : ''; if (src) imgs += '<img src="' + esc(src) + '" alt="Photo du chantier" width="230" style="width:230px;max-width:100%;height:auto;border:1px solid #999;margin:2px 6px 2px 0;vertical-align:top">'; else omises += 1; });
      if (imgs) h += '<div style="margin:4px 0">' + imgs + '</div>';
      if (omises) h += '<p style="margin:3px 0;font-size:11px;color:#555">🖼 ' + omises + ' photo' + (omises > 1 ? 's' : '') + (opts && opts.photo ? ' non jointe' + (omises > 1 ? 's' : '') + ' (limite de taille de l\'e-mail)' : ' jointe' + (omises > 1 ? 's' : '') + ' au rapport') + ' : à voir dans le portail (Rapports journaliers, Journal).</p>';
    }
    videos.forEach(function (m, i) {
      var l = opts && opts.lien ? opts.lien(m.id) : null;
      h += l ? '<p style="margin:3px 0">🎬 <a href="' + esc(l.url) + '">Voir la vidéo' + (videos.length > 1 ? ' ' + (i + 1) : '') + '</a> <span style="font-size:11px;color:#555">(lien valable jusqu\'au ' + esc(l.jusqua) + ')</span></p>'
        : '<p style="margin:3px 0;font-size:11px;color:#555">🎬 Vidéo jointe au rapport : à voir dans le portail (Rapports journaliers, Journal).</p>';
    });
    return h;
  }
  function consolideMail(s, version, meta, opts) {
    var avec = s.chantiers.filter(function (c) { return c.rapports.length; }), sans = s.chantiers.filter(function (c) { return !c.rapports.length && !c.phase; });
    var eff = avec.reduce(function (n, c) { return n + (Number(c.effectif) || 0); }, 0);
    var B = 'border:1px solid #999', G = '#f2f2f2';
    var h = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#000;max-width:760px">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-bottom:2.5px solid #F0A030;margin-bottom:8px"><tr>' +
      '<td style="vertical-align:top;font-size:11px;line-height:1.4;padding-bottom:6px"><b>SONATRACH</b><br>Activité Exploration – Production<br>Division Production<br>Direction Régionale Rhourde Nouss<br>Division Infrastructure</td>' +
      '<td style="vertical-align:top;text-align:right;padding-bottom:6px"><div style="font-size:16px;font-weight:bold">RAPPORT JOURNALIER CONSOLIDÉ DES CHANTIERS</div><div style="font-weight:bold;margin-top:3px">' + esc(dateLongue(s.date)) + (version ? ' <span style="font-weight:normal;color:#555">· version ' + version + '</span>' : '') + '</div></td></tr></table>' +
      '<div style="background:' + G + ';padding:6px 9px;margin:0 0 10px"><b>' + s.chantiers.length + '</b> chantier(s) suivi(s) · <b>' + avec.length + '</b> avec rapport · <b>' + sans.length + '</b> sans rapport · effectif total présent : <b>' + eff + '</b></div>';
    var parService = {}, ordre = [];
    avec.forEach(function (c) { var k = c.service || 'Sans service'; if (!parService[k]) { parService[k] = []; ordre.push(k); } parService[k].push(c); });
    ordre.forEach(function (k) {
      h += '<div style="font-size:14px;font-weight:bold;background:#FFE9D2;padding:4px 8px;margin:14px 0 6px">' + esc(k) + '</div>';
      parService[k].forEach(function (c) {
        h += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="' + B + ';border-collapse:collapse;margin-bottom:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#000"><tr><td style="background:' + G + ';padding:4px 8px;border-bottom:1px solid #999"><b>' + esc(c.nom) + '</b></td>' +
          '<td style="background:' + G + ';padding:4px 8px;border-bottom:1px solid #999;text-align:right;white-space:nowrap">Effectif : ' + c.effectif + (c.avancement != null ? ' · Avancement : ' + c.avancement + ' %' : '') + '</td></tr>';
        c.rapports.forEach(function (r, i) {
          h += '<tr><td colspan="2" style="padding:5px 8px;' + (i ? 'border-top:1px dashed #bbb;' : '') + '"><div style="font-size:11px;color:#333;margin-bottom:2px">Établi par : <b>' + esc(r.auteur_nom || r.auteur_email) + '</b>' + (r.effectif !== '' && r.effectif != null ? ' · effectif ' + esc(r.effectif) : '') + '</div>';
          if (r.lignes && r.lignes.length) h += '<ul style="margin:3px 0 3px 18px;padding:0">' + r.lignes.map(function (l) { return '<li>' + (l.routine ? '<i>[Routine]</i> ' : '') + (l.zone ? '<b>' + esc(l.zone) + '</b> : ' : '') + esc(l.texte || '') + (l.avancement !== '' && l.avancement != null ? ' — ' + esc(l.avancement) + ' %' : '') + '</li>'; }).join('') + '</ul>';
          if (r.travaux && !(r.lignes && r.lignes.length && String(r.travaux).indexOf('• ') === 0)) h += texteLibreHtml(r.travaux, 'margin:3px 0');
          if (r.difficultes) h += '<p style="margin:3px 0;color:#8a1c1c"><b>Difficultés :</b> ' + esc(r.difficultes) + '</p>';
          if (r.commentaire) h += '<p style="margin:3px 0"><b>Commentaire :</b> ' + esc(r.commentaire) + '</p>';
          h += mediasHtml(r, opts);
          if (r.visa_par) h += '<p style="margin:3px 0;font-style:italic;font-size:11px">Vu par ' + esc(r.visa_par) + (r.visa_note ? ' — ' + esc(r.visa_note) : '') + '</p>';
          h += '</td></tr>';
        });
        h += '</table>';
      });
    });
    if (sans.length) h += '<div style="font-size:14px;font-weight:bold;background:#FFE9D2;padding:4px 8px;margin:14px 0 6px">Chantiers sans rapport ce jour</div><p style="margin:3px 0;color:#8a1c1c;line-height:1.5">' + sans.map(function (c) { return esc(c.nom); }).join(' · ') + '</p>';
    h += '<p style="margin:18px 0 6px;font-size:12px">Consolidé par <b>' + esc(meta && meta.genere_par ? meta.genere_par : 'Portail Infra') + '</b>' + (meta && meta.genere_le ? ' le ' + esc(meta.genere_le) : '') + (version ? ' · version ' + version : '') + ' — un seul rapport consolidé par jour : le régénérer remplace la version précédente.</p>' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;font-weight:bold;font-size:12px"><tr><td>Le Chef de Service</td><td style="text-align:right">Le Chef de Division Infrastructures</td></tr></table></div>';
    return { sujet: 'Rapport journalier consolidé — ' + dateLongue(s.date), html: h };
  }
  /**
   * Boîtes fonctionnelles qui reçoivent le rapport consolidé (et non les adresses personnelles des agents) : une par service, celle du chef de division et celles du secrétariat.
   * groupes = { secretariat, chef_service, chef_division } (booléens).
   */
  var BOITES = {
    secretariat: [{ nom: 'Secrétariat Division INFRA', email: 'sec-infra.rns@sonatrach.dz' }, { nom: 'sec.infra.rns', email: 'sec.infra.rns@gmail.com' }, { nom: 'Madani Rayane', email: 'rayanem@gmail.com' }],
    chef_service: [{ nom: 'Service Travaux Entretien INFRA - RNS', email: 'service_travaux_entretien_infra.rns@sonatrach.dz' }, { nom: 'Service Construction INFRA - RNS', email: 'infra_constr.rns@sonatrach.dz' },
      { nom: 'Service Électromécanique INFRA - RNS', email: 'infra_electromec.rns@sonatrach.dz' }, { nom: 'CPM INFRA RNS', email: 'rns.cpm_infra@sonatrach.dz' }],
    chef_division: [{ nom: 'Chef Division INFRA - RNS', email: 'cdd_infra.rns@sonatrach.dz' }]
  };
  var ROLES_BOITES = { secretariat: 'Secrétariat', chef_service: 'Boîte de service', chef_division: 'Chef de division' };
  /** boites = { secretariat: [{ nom, email }], chef_service: […], chef_division: […] } (réglages de la page Paramètres) ; à défaut, les boîtes d'origine ci-dessus. */
  function boitesDestinataires(groupes, boites) {
    var vus = {}, out = [];
    ['secretariat', 'chef_service', 'chef_division'].forEach(function (g) {
      if (!groupes || !groupes[g]) return;
      ((boites && boites[g]) || BOITES[g]).forEach(function (b) { if (vus[b.email]) return; vus[b.email] = 1; out.push({ nom: b.nom, email: b.email, role: g, libelle: ROLES_BOITES[g] }); });
    });
    return out;
  }
  /** Adresses des destinataires (anciennement les comptes du portail) : groupes = { secretariat, chef_service, chef_division } (booléens) ; seuls les comptes actifs avec e-mail. */
  function destinataires(utilisateurs, groupes) {
    var roles = [];
    if (groupes && groupes.secretariat) roles.push('secretariat');
    if (groupes && groupes.chef_service) roles.push('chef_service', 'interim_chef_service');
    if (groupes && groupes.chef_division) roles.push('chef_division');
    return destinatairesDetail(utilisateurs, groupes).map(function (d) { return d.email; });
  }

  /**
   * Statistiques des rapports journaliers sur une période [du, au] (jusqu'à aujourd'hui au plus).
   * rapports = rapports de la période (déjà filtrés selon les droits) ; chantiers = chantiers suivis [{ id, nom, service }].
   * « Jours d'activité » = jours où au moins un rapport a été reçu (aucune hypothèse sur les week-ends ni les jours fériés) ;
   * taux de remise d'un chantier = jours avec rapport / jours d'activité.
   */
  function statistiques(rapports, chantiers, du, au, aujourdhui) {
    var fin = aujourdhui && au > aujourdhui ? aujourdhui : au, rs = (rapports || []).filter(function (r) { return r.date >= du && r.date <= fin; });
    var parJour = {}, parCh = {}, parAuteur = {}, diff = [];
    rs.forEach(function (r) {
      var j = parJour[r.date] = parJour[r.date] || { date: r.date, rapports: 0, effectif: 0 }; j.rapports += 1; j.effectif += Number(r.effectif) || 0;
      var k = norm(r.chantier), c = parCh[k] = parCh[k] || { rs: [], jours: {} }; c.rs.push(r); c.jours[r.date] = 1;
      var a = norm(r.auteur_email); parAuteur[a] = parAuteur[a] || { nom: r.auteur_nom || r.auteur_email, n: 0 }; parAuteur[a].n += 1;
      if (String(r.difficultes || '').trim()) diff.push({ date: r.date, chantier: k, texte: String(r.difficultes).trim() });
    });
    var jours = Object.keys(parJour).sort(), nbJoursActifs = jours.length;
    var suivis = (chantiers || []).slice(), connus = {}; suivis.forEach(function (c) { connus[norm(c.id)] = 1; });
    Object.keys(parCh).forEach(function (k) { if (!connus[k]) suivis.push({ id: k, nom: k, service: '' }); });
    var lignes = suivis.map(function (c) {
      var k = norm(c.id), d = parCh[k], r = d ? d.rs.slice().sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; }) : [];
      var av = r.filter(function (x) { return x.avancement !== '' && x.avancement != null && isFinite(Number(x.avancement)); });
      var nbJ = d ? Object.keys(d.jours).length : 0, eff = r.reduce(function (n, x) { return n + (Number(x.effectif) || 0); }, 0);
      var dernier = r.length ? r[r.length - 1].date : '', silence = dernier ? jours.filter(function (x) { return x > dernier; }).length : nbJoursActifs;
      return { id: k, nom: c.nom, service: c.service || '', rapports: r.length, jours: nbJ, taux: nbJoursActifs ? nbJ / nbJoursActifs : null,
        effectifMoyen: nbJ ? Math.round(eff / nbJ * 10) / 10 : null, avDebut: av.length ? Number(av[0].avancement) : null, avFin: av.length ? Number(av[av.length - 1].avancement) : null,
        progression: av.length > 1 ? Math.round((Number(av[av.length - 1].avancement) - Number(av[0].avancement)) * 10) / 10 : null,
        difficultes: r.filter(function (x) { return String(x.difficultes || '').trim(); }).length, vises: r.filter(function (x) { return x.visa_par; }).length, dernier: dernier, silence: silence };
    }).sort(function (a, b) { return (b.rapports - a.rapports) || String(a.nom).localeCompare(String(b.nom), 'fr'); });
    var avecRapport = lignes.filter(function (l) { return l.rapports > 0; }), avs = lignes.filter(function (l) { return l.avFin != null; });
    var jourCh = lignes.reduce(function (n, l) { return n + l.jours; }, 0), eff = jours.reduce(function (n, d) { return n + parJour[d].effectif; }, 0);
    return {
      du: du, au: fin,
      kpi: {
        rapports: rs.length, joursActifs: nbJoursActifs, chantiersSuivis: lignes.length, chantiersAvecRapport: avecRapport.length,
        tauxRemise: nbJoursActifs && lignes.length ? jourCh / (nbJoursActifs * lignes.length) : null,
        effectifMoyenJour: nbJoursActifs ? Math.round(eff / nbJoursActifs * 10) / 10 : null,
        avancementMoyen: avs.length ? Math.round(avs.reduce(function (n, l) { return n + l.avFin; }, 0) / avs.length * 10) / 10 : null,
        difficultes: diff.length, tauxVisa: rs.length ? rs.filter(function (x) { return x.visa_par; }).length / rs.length : null
      },
      jours: jours.map(function (d) { return parJour[d]; }),
      chantiers: lignes,
      sansRapport: lignes.filter(function (l) { return !l.rapports; }).map(function (l) { return l.nom; }),
      auteurs: Object.keys(parAuteur).map(function (a) { return parAuteur[a]; }).sort(function (x, y) { return y.n - x.n; }).slice(0, 8),
      difficultes: diff.sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 10)
    };
  }
  /**
   * Copies du soir : chaque agent qui a établi un rapport ce jour-là, et son vis-à-vis de TRAVAIL, reçoivent le consolidé restreint aux chantiers pour lesquels l'agent a rapporté.
   * donnees = synthèse du jour ; utilisateurs = comptes ; carte = { uid: { vis_travail } } ; deja = adresses qui reçoivent déjà le consolidé complet (écartées).
   * Retourne [{ chantiers: [ids], emails: [adresses] }] : une entrée par ensemble de chantiers identique (le message est préparé une fois par ensemble).
   */
  function calculerCopies(donnees, utilisateurs, carte, deja) {
    var parEmail = {}, parUid = {}, ecart = {}, destin = {}, info = {};
    (utilisateurs || []).forEach(function (u) { var m = norm(u.email_contact || u.email); if (!m || String(u.actif) === '0' || u.actif === false) return; parUid[String(u.uid)] = { mail: m, nom: String(u.nom || '') }; parEmail[norm(u.email)] = { uid: String(u.uid), mail: m, nom: String(u.nom || '') }; });
    (deja || []).forEach(function (m) { ecart[norm(m)] = 1; });
    ((donnees && donnees.chantiers) || []).forEach(function (c) {
      (c.rapports || []).forEach(function (r) {
        var a = parEmail[norm(r.auteur_email)]; if (!a) return;
        var cibles = [{ m: a.mail, nom: a.nom, role: 'a établi un rapport' }], vis = carte && carte[a.uid] && carte[a.uid].vis_travail;
        if (vis && parUid[String(vis)]) cibles.push({ m: parUid[String(vis)].mail, nom: parUid[String(vis)].nom, role: 'vis-à-vis de travail de ' + (r.auteur_nom || a.nom) });
        cibles.forEach(function (x) {
          if (ecart[x.m]) return; (destin[x.m] = destin[x.m] || {})[c.id] = c.nom || c.id;
          var f = info[x.m] = info[x.m] || { nom: x.nom, roles: [] }; if (f.roles.indexOf(x.role) < 0) f.roles.push(x.role);
        });
      });
    });
    return { destin: destin, info: info };
  }
  function copiesAgents(donnees, utilisateurs, carte, deja) {
    var d = calculerCopies(donnees, utilisateurs, carte, deja).destin, groupes = {};
    Object.keys(d).forEach(function (m) { var ids = Object.keys(d[m]).sort(), k = ids.join('|'); (groupes[k] = groupes[k] || { chantiers: ids, emails: [] }).emails.push(m); });
    return Object.keys(groupes).sort().map(function (k) { groupes[k].emails.sort(); return groupes[k]; });
  }
  /** Même calcul, personne par personne (aperçu « Voir les destinataires ») : [{ email, nom, roles, chantiers: [noms] }]. */
  function copiesListe(donnees, utilisateurs, carte, deja) {
    var c = calculerCopies(donnees, utilisateurs, carte, deja);
    return Object.keys(c.destin).sort().map(function (m) { return { email: m, nom: c.info[m].nom, roles: c.info[m].roles, chantiers: Object.keys(c.destin[m]).map(function (k) { return c.destin[m][k]; }) }; });
  }
  /** Tous les comptes actifs avec e-mail (SH, ACOSCO, GTP…) : [{ nom, email, role, service }]. Usage exceptionnel (envoi « toute la division »). */
  function tousLesComptes(utilisateurs) {
    var vus = {}, out = [];
    (utilisateurs || []).forEach(function (u) {
      var m = norm(u.email_contact || u.email);
      if (String(u.actif) === '0' || u.actif === false || !m || m.indexOf('@') < 1 || vus[m]) return;
      vus[m] = 1; out.push({ nom: String(u.nom || ''), email: m, role: norm(u.role), service: String(u.service || '') });
    });
    return out;
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

  return { copiesListe: copiesListe, copiesAgents: copiesAgents, statistiques: statistiques, tousLesComptes: tousLesComptes, texteLibreHtml: texteLibreHtml, boitesDestinataires: boitesDestinataires, BOITES: BOITES, destinatairesDetail: destinatairesDetail, peutCorriger: peutCorriger, corriger: corriger, idsSup: idsSup, consolideMail: consolideMail, destinataires: destinataires, tableau: tableau, valider: valider, lignesEnTexte: lignesEnTexte, cleService: cleService, servicePareil: servicePareil, chantiersVisibles: chantiersVisibles, chantiersDepuisCpm: chantiersDepuisCpm, PHASES: PHASES, horsExecution: horsExecution, jusquA: jusquA, ouvert: ouvert, etiquette: etiquette, ouvrirChantier: ouvrirChantier, slugContrat: slugContrat, filtrer: filtrer, synthese: synthese, peutViser: peutViser, dansLaPortee: dansLaPortee, cle: cle, nettoyer: nettoyer };
})();

if (typeof module !== 'undefined') module.exports = Rapports;
