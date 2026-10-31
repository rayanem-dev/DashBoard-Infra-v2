/**
 * Paramètres (page parametres.html) : les petits réglages de tous les programmes, au même endroit, réservés au rôle « secrétariat » (rang 0).
 * Chaque réglage a un identifiant, un groupe (le programme), un type, une valeur d'origine ; la valeur choisie est gardée dans l'onglet « Parametres ».
 * Valeur utilisée = valeur enregistrée ici, sinon l'ancienne propriété de script (quand elle existait déjà), sinon la valeur d'origine.
 * Partie PURE (testée en Node : test/parametres.test.js) puis les actions de la passerelle.
 */
var Parametres = (function () {
  var BOITES_SECRETARIAT = 'Secrétariat Division INFRA <sec-infra.rns@sonatrach.dz>\nsec.infra.rns <sec.infra.rns@gmail.com>\nMadani Rayane <rayanem@gmail.com>';
  var BOITES_SERVICES = 'Service Travaux Entretien INFRA - RNS <service_travaux_entretien_infra.rns@sonatrach.dz>\nService Construction INFRA - RNS <infra_constr.rns@sonatrach.dz>\n' +
    'Service Électromécanique INFRA - RNS <infra_electromec.rns@sonatrach.dz>\nCPM INFRA RNS <rns.cpm_infra@sonatrach.dz>';
  var BOITES_DIVISION = 'Chef Division INFRA - RNS <cdd_infra.rns@sonatrach.dz>';
  /** Rôles par ordre de rang (0 = le plus élevé), comme Droits.RANGS ; « guest » = tout le monde (aucune restriction de rôle en plus du droit du module). */
  var ROLES = [['secretariat', 'Secrétariat'], ['chef_division', 'Chef de division'], ['cadre_sup', 'Cadre supérieur'], ['chef_service', 'Chef de service'], ['interim_chef_service', 'Chef de service (intérim)'], ['cpm', 'Cellule Passation de marché'],
    ['ordonnateur', 'Ordonnateur'], ['chef_atelier', 'Chef d\'atelier'], ['ingenieur', 'Ingénieur'], ['dessinateur', 'Dessinateur'], ['conducteur', 'Conducteur des travaux'], ['agent', 'Agent'], ['stagiaire', 'Stagiaire'], ['prestataire', 'Prestataire'], ['guest', 'Tout le monde']];
  /**
   * Options à interrupteur et niveau d'accès : « actif » (oui / non) et, quand `role` est défini, le rôle MINIMUM (ce rôle et ceux au-dessus). Une option ne donne jamais plus que le droit du module concerné :
   * elle peut le restreindre ou le couper ; seules les règles qui étaient écrites « secrétariat seulement » dans le code sont remplacées par le réglage (valeur d'origine = ce qui existait).
   * role: null = interrupteur seul (l'option vise une catégorie fixe de comptes).
   */
  var OPTIONS = [
    { id: 'rapports.envoi_consolide', groupe: 'Rapports journaliers', libelle: 'Générer l\'envoi, envoyer le consolidé et régler l\'envoi automatique', aide: 'Boutons « Envoyer maintenant », « Voir les destinataires », envoi automatique du soir et ses destinataires. Il faut aussi le niveau 3 sur le module Rapports.', role: 'secretariat' },
    { id: 'rapports.toute_division', groupe: 'Rapports journaliers', libelle: 'Envoyer le consolidé à « toute la division » (exceptionnel)', aide: 'La case rouge qui regroupe tous les comptes actifs avec e-mail. Il faut aussi avoir l\'option précédente.', role: 'secretariat' },
    { id: 'rapports.medias', groupe: 'Rapports journaliers', libelle: 'Joindre des photos et vidéos à un rapport', aide: 'Le bloc « Photos et vidéos » de « Saisir mon rapport ». Les médias déjà joints restent visibles par ceux qui lisent le rapport. Il faut aussi le niveau 2 sur le module Rapports.', role: 'guest' },
    { id: 'stats.rapports', groupe: 'Statistiques', libelle: 'Voir les statistiques des rapports journaliers', aide: 'L\'onglet « Rapports journaliers » de la page Statistiques ; chacun ne voit que ce que ses droits sur les rapports lui montrent.', role: 'guest' },
    { id: 'fiches.relance', groupe: 'Fiches d\'évaluation', libelle: 'Relancer par e-mail une fiche d\'évaluation non éditée', aide: 'Bouton « Relancer » de la carte « Fiches d\'évaluation » de l\'accueil (du 22 à la fin du mois) : un e-mail au service concerné et au conducteur affecté au chantier, au clic seulement. Il faut aussi avoir accès à l\'application Fiche d\'évaluation.', role: 'chef_service' },
    { id: 'fiches.ignorer', groupe: 'Fiches d\'évaluation', libelle: 'Ignorer une fiche d\'évaluation pour un projet et pour le mois', aide: 'Bouton « Ignorer ce mois » de la carte « Fiches d\'évaluation » de l\'accueil : le contrat n\'est plus attendu ni relancé ce mois-là (« Rétablir » le remet). Secrétariat et chefs de service par défaut.', role: 'chef_service' },
    { id: 'fiches.manuelle', groupe: 'Fiches d\'évaluation', libelle: 'Déclarer une fiche éditée à la main (hors générateur)', aide: 'Bouton « Éditée à la main » de la carte « Fiches d\'évaluation » : la fiche faite hors du générateur est comptée comme éditée et n\'est plus relancée (« Annuler » la retire). Secrétariat et chefs de service par défaut.', role: 'chef_service' },
    { id: 'planning.libre_service', groupe: 'Planning', libelle: 'Chaque agent peut déclarer son vis-à-vis de travail, son vis-à-vis de chambre et son numéro de chambre', aide: 'Dans « Mon profil » et dans le planning : l\'agent (prestataire compris, parmi les gens de son entreprise) renseigne ses vis-à-vis et sa chambre sans passer par le chef de service.', role: null },
    { id: 'planning.sync_bddorga', groupe: 'Planning', libelle: 'Reporter la chambre et les vis-à-vis dans BDDORGA à la connexion suivante', aide: 'À la connexion suivante de l\'agent, son numéro de chambre et ses vis-à-vis sont écrits dans BDDORGA (colonnes Chambre, Vis-à-vis travail, Vis-à-vis chambre ; valeur remplacée si elle a changé). Une panne de BDDORGA ne bloque jamais la connexion.', role: null },
    { id: 'securite.mdp_defaut_auto', groupe: 'Sécurité', libelle: 'Mot de passe par défaut « 0000 » à la première connexion', aide: 'Un compte qui ne s\'est jamais connecté entre avec « 0000 » et doit ensuite en choisir un. Jamais pour le secrétariat, le chef de division, les chefs de service (et intérims) ni les comptes ayant accès à la sécurité : ceux-là passent par « Première connexion ou mot de passe oublié ? ».', role: null },
    { id: 'pec.prestataire_envoi', groupe: 'Prise en charge et autorisation d\'accès', libelle: 'Un prestataire peut envoyer ses documents au secrétariat', aide: 'Bouton « Envoyer par email » de la liste de ses documents générés (le secrétariat est son seul destinataire).', role: null },
    { id: 'pec.prestataire_suppression', groupe: 'Prise en charge et autorisation d\'accès', libelle: 'Un prestataire peut supprimer ses documents', aide: 'Boutons 🗑 et « Tout supprimer » de la liste de ses documents (jamais ceux des autres).', role: null }
  ];
  /** type : nombre (min, max, unite, pas), email, emails (une adresse par ligne, « Nom <adresse> » accepté), url. legacy = ancienne propriété de script. */
  var REGISTRE = [
    { id: 'rapports.boites_secretariat', groupe: 'Rapports journaliers', libelle: 'Boîtes du secrétariat (envoi du consolidé)', aide: 'Adresses cochées par « Secrétariat » dans Synthèse du jour. Une par ligne : adresse seule ou « Nom <adresse> ».', type: 'emails', defaut: BOITES_SECRETARIAT },
    { id: 'rapports.boites_chef_service', groupe: 'Rapports journaliers', libelle: 'Boîtes des services (envoi du consolidé)', aide: 'Adresses cochées par « Chefs de service ». Une par ligne.', type: 'emails', defaut: BOITES_SERVICES },
    { id: 'rapports.boites_chef_division', groupe: 'Rapports journaliers', libelle: 'Boîte du chef de division (envoi du consolidé)', aide: 'Adresses cochées par « Chef de division ». Une par ligne.', type: 'emails', defaut: BOITES_DIVISION },
    { id: 'rapports.photos_mo', groupe: 'Rapports journaliers', libelle: 'Poids total des photos jointes à l\'e-mail du consolidé', aide: 'Les photos (dans l\'ordre du consolidé) sont ajoutées à l\'e-mail et au PDF tant que ce total n\'est pas dépassé ; les suivantes restent à voir dans le portail. L\'e-mail pèse environ 2,5 fois ce chiffre (images dans le message et dans le PDF) : gardez-le sous 8 Mo.', type: 'nombre', min: 0.5, max: 12, unite: 'Mo', defaut: '6' },
    { id: 'rapports.lien_video_jours', groupe: 'Rapports journaliers', libelle: 'Durée du lien temporaire des vidéos', aide: 'Les vidéos ne sont pas jointes : l\'e-mail contient un lien (« toute personne disposant du lien ») qui est fermé automatiquement après ce nombre de jours.', type: 'nombre', min: 1, max: 30, unite: 'jour(s)', defaut: '7' },
    { id: 'rapports.copie_agents', groupe: 'Rapports journaliers', libelle: 'Copie du soir aux agents qui ont rapporté', aide: 'À l\'envoi automatique du soir, chaque agent qui a établi un rapport ce jour-là et son vis-à-vis de travail reçoivent le consolidé limité aux chantiers de l\'agent (e-mail et PDF). N\'agit que sur l\'envoi automatique, jamais sur « Envoyer maintenant ».', type: 'choix', choix: ['oui', 'non'], defaut: 'oui' },
    { id: 'stats_st.heures', groupe: 'Statistiques', libelle: 'Heures travaillées par agent et par mois (sous-traitants)', aide: 'Les heures d\'un sous-traitant valent son effectif × cette valeur (12 h × 30 jours = 360). Les lignes déjà modifiées à la main ne changent pas.', type: 'nombre', min: 1, max: 744, unite: 'h', defaut: '360', legacy: 'STATS_ST_HEURES' },
    { id: 'reservation.destinataire', groupe: 'Réservation Vol', libelle: 'Adresse qui reçoit la demande de réservation', aide: 'Le bouton « Envoyer » de la demande écrit à cette adresse (jamais d\'envoi automatique).', type: 'email', defaut: 'Sec-INFRA.RNS@Sonatrach.dz', legacy: 'RESERVATION_DEST' },
    { id: 'cpm.rapport_extra', groupe: 'Suivi CPM', libelle: 'Destinataires supplémentaires du rapport des modifications', aide: 'En plus du chef de division et du secrétariat. Une adresse par ligne (vide = personne d\'autre).', type: 'emails', defaut: '', legacy: 'CPM_RAPPORT_DESTINATAIRES' },
    { id: 'benchmark.taux', groupe: 'Benchmark des prix (Banchy)', libelle: 'Taux d\'actualisation annuel', aide: 'Proposé aux nouveaux benchmarks ; chaque benchmark garde le sien. À valider.', type: 'nombre', min: 0, max: 100, unite: '%', defaut: '9' },
    { id: 'benchmark.seuil', groupe: 'Benchmark des prix (Banchy)', libelle: 'Écart toléré avant de dire « élevé » ou « bas »', aide: 'Proposé aux nouveaux benchmarks. À valider.', type: 'nombre', min: 0, max: 1000, unite: '%', defaut: '20' },
    { id: 'benchmark.nmin', groupe: 'Benchmark des prix (Banchy)', libelle: 'Nombre minimum de sources pour conclure sur un article', aide: 'Un article avec moins de sources n\'est jamais conclu. À valider.', type: 'nombre', min: 1, max: 20, unite: 'source(s)', defaut: '2' },
    { id: 'benchmark.dispersion', groupe: 'Benchmark des prix (Banchy)', libelle: 'Dispersion maximale des prix d\'un article', aide: 'Au-delà de ce rapport entre le plus haut et le plus bas prix actualisés, l\'article est « à vérifier ». À valider.', type: 'nombre', min: 1.1, max: 1000, unite: '×', defaut: '3' },
    { id: 'benchmark.couverture', groupe: 'Benchmark des prix (Banchy)', libelle: 'Part minimale du marché couverte pour un verdict global', aide: 'Si les articles fiables couvrent moins que cette part du montant, le verdict global est refusé. À valider.', type: 'nombre', min: 0, max: 100, unite: '%', defaut: '50' },
    { id: 'portail.site_url', groupe: 'Portail', libelle: 'Adresse du portail (liens des e-mails)', aide: 'Utilisée dans les e-mails d\'invitation et de notification.', type: 'url', defaut: 'https://rayanem-dev.github.io/DashBoard-Infra-v2/', legacy: 'SITE_URL' }
  ];
  OPTIONS.forEach(function (o) {
    REGISTRE.push({ id: 'option.' + o.id + '.actif', groupe: o.groupe, libelle: o.libelle, aide: o.aide, type: 'choix', choix: ['oui', 'non'], defaut: 'oui', option: o.id, champ: 'actif', optionLibelle: o.libelle });
    if (o.role) REGISTRE.push({ id: 'option.' + o.id + '.role', groupe: o.groupe, libelle: o.libelle, aide: o.aide, type: 'choix', choix: ROLES.map(function (r) { return r[0]; }), choixLibelles: ROLES.reduce(function (m, r) { m[r[0]] = r[1]; return m; }, {}), defaut: o.role, option: o.id, champ: 'role', optionLibelle: o.libelle });
  });
  var MAX_ADRESSES = 30, EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
  function def(id) { return REGISTRE.filter(function (d) { return d.id === id; })[0] || null; }
  /** « Nom <adresse> » ou adresse seule, une par ligne (virgules et points-virgules acceptés) → [{ nom, email }] ou { erreur }. */
  function adresses(texte) {
    var out = [], vus = {}, brut = String(texte == null ? '' : texte).split(/[\n;,]+/);
    for (var i = 0; i < brut.length; i += 1) {
      var l = brut[i].trim(); if (!l) continue;
      var m = /^(.*?)\s*<([^<>]+)>$/.exec(l), nom = m ? m[1].trim() : '', mail = (m ? m[2] : l).trim();
      if (!EMAIL.test(mail)) return { erreur: 'Adresse e-mail invalide : « ' + l.slice(0, 80) + ' »' };
      var cle = mail.toLowerCase(); if (vus[cle]) continue; vus[cle] = 1; out.push({ nom: nom || mail, email: mail });
      if (out.length > MAX_ADRESSES) return { erreur: 'Trop d\'adresses (' + MAX_ADRESSES + ' au plus)' };
    }
    return { liste: out };
  }
  /** Valide la saisie d'un réglage ; retourne { valeur } (texte normalisé) ou { erreur }. */
  function valider(d, brut) {
    var t = String(brut == null ? '' : brut).trim();
    if (d.type === 'nombre') {
      var n = Number(t.replace(/\s/g, '').replace(',', '.')); if (t === '' || !isFinite(n)) return { erreur: 'Entrez un nombre' };
      if (n < d.min || n > d.max) return { erreur: 'La valeur doit être comprise entre ' + d.min + ' et ' + d.max };
      return { valeur: String(Math.round(n * 1000) / 1000) };
    }
    if (d.type === 'choix') return d.choix.indexOf(t) >= 0 ? { valeur: t } : { erreur: 'Choix invalide' };
    if (d.type === 'email') return EMAIL.test(t) && t.length <= 120 ? { valeur: t } : { erreur: 'Adresse e-mail invalide' };
    if (d.type === 'url') return /^https:\/\/[^\s]+$/.test(t) && t.length <= 200 ? { valeur: t.slice(-1) === '/' ? t : t + '/' } : { erreur: 'Adresse invalide : elle doit commencer par https://' };
    if (d.type === 'emails') {
      var a = adresses(t); if (a.erreur) return a;
      if (!a.liste.length && d.defaut) return { erreur: 'Gardez au moins une adresse (ou utilisez « Rétablir »)' };
      return { valeur: a.liste.map(function (x) { return x.nom && x.nom !== x.email ? x.nom + ' <' + x.email + '>' : x.email; }).join('\n') };
    }
    return { erreur: 'Réglage inconnu' };
  }
  /** lignes = [{ cle, valeur }] de l'onglet ; legacy = fonction (propriété) → texte ou '' ; retourne tous les réglages avec leur valeur utilisée et sa source. */
  function etat(lignes, legacy) {
    var vals = {}; (lignes || []).forEach(function (l) { if (l && l.cle) vals[String(l.cle)] = String(l.valeur == null ? '' : l.valeur); });
    return REGISTRE.map(function (d) {
      var v = vals[d.id], source = 'defaut', valeur = d.defaut;
      if (v !== undefined && v !== '' || (v === '' && d.type === 'emails' && !d.defaut)) { valeur = v; source = 'parametres'; }
      else if (d.legacy && legacy) { var p = String(legacy(d.legacy) || '').trim(); if (p) { valeur = p; source = 'ancien'; } }
      return { id: d.id, groupe: d.groupe, libelle: d.libelle, aide: d.aide, type: d.type, choix: d.choix, choixLibelles: d.choixLibelles, option: d.option, champ: d.champ, min: d.min, max: d.max, unite: d.unite || '', defaut: d.defaut, valeur: valeur, source: source };
    });
  }
  function valeurDe(lignes, legacy, id) { var e = etat(lignes, legacy).filter(function (x) { return x.id === id; })[0]; return e ? e.valeur : ''; }
  /** Accès à une option : interrupteur sur « oui » et, si l'option a un niveau, rôle de la personne au moins aussi élevé que le rôle minimum. rangDe = Droits.rang. */
  function optionPermise(lignes, legacy, id, role, rangDe) {
    var e = etat(lignes, legacy).filter(function (x) { return x.option === id; }), actif = e.filter(function (x) { return x.champ === 'actif'; })[0], niv = e.filter(function (x) { return x.champ === 'role'; })[0];
    if (!actif) return false;
    if (actif.valeur === 'non') return false;
    if (!niv) return true;
    return rangDe(role) <= rangDe(niv.valeur);
  }
  return { ROLES: ROLES, OPTIONS: OPTIONS, optionPermise: optionPermise, REGISTRE: REGISTRE, def: def, adresses: adresses, valider: valider, etat: etat, valeurDe: valeurDe, MAX_ADRESSES: MAX_ADRESSES };
})();
if (typeof module !== 'undefined') module.exports = Parametres;

// ---------- passerelle ----------
var PARAMETRES_ENTETES_ = ['cle', 'valeur', 'maj_par', 'maj_le'];
function parametresFeuille_() { return cpmFeuille_('Parametres', PARAMETRES_ENTETES_); }
function parametresLignes_() {
  var v = parametresFeuille_().getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i += 1) if (v[i][0]) out.push({ ligne: i + 1, cle: String(v[i][0]), valeur: String(v[i][1] == null ? '' : v[i][1]), maj_par: String(v[i][2] || ''), maj_le: String(v[i][3] || '') });
  return out;
}
function parametresLegacy_(k) { try { return PropertiesService.getScriptProperties().getProperty(k) || ''; } catch (e) { return ''; } }
/** Valeur utilisée d'un réglage (lue par les autres programmes). Si l'onglet est illisible, retombe sur la valeur d'origine ou l'ancienne propriété. */
function parametre_(id) {
  var lignes = []; try { lignes = parametresLignes_(); } catch (e) { lignes = []; }
  return Parametres.valeurDe(lignes, parametresLegacy_, id);
}
/** Adresses d'un réglage de type « emails » : [{ nom, email }]. */
/** L'option est-elle ouverte à cette personne ? (interrupteur + niveau d'accès réglés dans Paramètres ; valeurs d'origine si rien n'est enregistré.) Sans l'onglet : valeurs d'origine. */
function optionPermise_(u, id) {
  var lignes = []; try { lignes = parametresLignes_(); } catch (e) { lignes = []; }
  return Parametres.optionPermise(lignes, parametresLegacy_, id, Droits.roleCanon(u.role), Droits.rang);
}
/** Interrupteur seul (options sans niveau : celles qui visent une catégorie fixe de comptes, ex. les prestataires). */
function optionActive_(id) {
  var lignes = []; try { lignes = parametresLignes_(); } catch (e) { lignes = []; }
  return Parametres.optionPermise(lignes, parametresLegacy_, id, 'secretariat', function () { return 0; });
}
function parametreAdresses_(id) { var a = Parametres.adresses(parametre_(id)); return a.liste || []; }
function parametreNombre_(id, repli) { var n = Number(String(parametre_(id)).replace(',', '.')); return isFinite(n) ? n : repli; }
function parametresSecretariat_(req) {
  var u = Auth.userFromToken(req.token);
  if (Droits.roleCanon(u.role) !== 'secretariat') throw Object.assign(new Error('Les paramètres sont réservés au secrétariat'), { code: 'DROITS' });
  return u;
}
function parametresLire_(req) {
  parametresSecretariat_(req);
  var lignes = parametresLignes_(), meta = {}; lignes.forEach(function (l) { meta[l.cle] = { maj_par: l.maj_par, maj_le: l.maj_le }; });
  return { parametres: Parametres.etat(lignes, parametresLegacy_).map(function (e) { var m = meta[e.id]; if (m && e.source === 'parametres') { e.maj_par = m.maj_par; e.maj_le = m.maj_le; } return e; }) };
}
function parametresEnregistrer_(req) {
  var u = parametresSecretariat_(req), d = Parametres.def(String(req.id || ''));
  if (!d) throw new Error('Réglage inconnu');
  var retablir = req.retablir === true, v = retablir ? { valeur: '' } : Parametres.valider(d, req.valeur);
  if (v.erreur) throw new Error(v.erreur);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = parametresFeuille_(), ex = parametresLignes_().filter(function (l) { return l.cle === d.id; })[0], par = Annuaire.nomAffichable(u.nom, u.email), maintenant = new Date().toISOString();
    if (retablir) { if (ex) sh.deleteRow(ex.ligne); }   // valeur d'origine (ou ancienne propriété) de nouveau utilisée
    else {
      var rng = ex ? sh.getRange(ex.ligne, 1, 1, 4) : sh.getRange(sh.getLastRow() + 1, 1, 1, 4); rng.setNumberFormat('@'); rng.setValues([[d.id, v.valeur, par, maintenant]]);
    }
    Store.journal(retablir ? 'parametre_retabli' : 'parametre_modifie', u.email, d.id + (retablir ? '' : ' = ' + String(v.valeur).replace(/\s+/g, ' ').slice(0, 120)));
  } finally { lock.releaseLock(); }
  return parametresLire_(req);
}
