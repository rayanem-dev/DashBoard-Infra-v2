/**
 * API JSON de la passerelle. Le site (GitHub Pages) appelle  POST <url /exec>  avec un corps texte/JSON
 * (Content-Type: text/plain, pour éviter la pré-requête CORS) :  { action, token?, ...paramètres }
 * Réponse : { ok: true, ... } ou { ok: false, erreur, code }.
 *
 * Planning (module « planning ») : situation, rotation_enregistrer (soi-même : niveau 1 ; autrui : niveau 3), planning (niveau 2 : tout le monde).
 * Organigramme dynamique (module « rh », voir Organigramme.gs) : organigramme.
 * Affectation du personnel (module « affectation », voir Affectations.gs) : aff_personnes, aff_changer, aff_historique.
 * Simulation de planning (module « simulation », voir Modifications.gs) : simu_agents, simu_donnees, simu_valider, simu_liste, simu_demande, simu_decider.
 * Rapports journaliers (module « rapports ») : rapports_chantiers, rapport_enregistrer, rapports_liste, rapport_viser, rapports_synthese (niveau 3).
 * Administration (niveau 3 sur le module « securite ») : admin_etat, admin_role, admin_actif, admin_droit, admin_exception, emettreCode.
 * Actions : liste (recherche : { q } — 3 lettres minimum, 8 résultats au plus), demanderCode, login, activer, reprendre (rester connecté), me, menu, logout, admin_app, emettreCode (admin).
 * `ident` = identifiant opaque (uid) choisi dans le sélecteur ; l'e-mail est aussi accepté.
 * Les données métier ne sortent QUE par cette passerelle, jamais par un lien public.
 */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    out = { ok: true };
    var r = route_(req);
    for (var k in r) out[k] = r[k];
  } catch (err) {
    out = { ok: false, erreur: err.message, code: err.code || 'ERR' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'DashBoard-Infra gateway' })).setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  chargerRoles_();
  // Mode support : pas de changement de mot de passe, d'e-mail de contact ni d'administration au nom du compte emprunté
  if (req.token && /^(admin_|changer_mdp$|email_contact_)/.test(String(req.action)) && Auth.estUsurpation(req.token)) throw new Error('Action interdite en mode support : revenez à votre compte.');
  if (req.token && !/^(liste|demanderCode|login|activer|reprendre|logout)$/.test(String(req.action))) {
    // Prestataire : uniquement ses données (menu, profil, mot de passe, Badges limités à ses entreprises) ; tout le reste est refusé quels que soient ses droits de module.
    var up = null; try { up = Auth.userFromToken(req.token); } catch (e0) { up = null; }
    if (up && Droits.roleCanon(up.role) === 'prestataire' && !ACTIONS_PRESTATAIRE_.test(String(req.action))) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  }
  switch (req.action) {
    case 'liste':        return Auth.liste(req.q);
    case 'demanderCode': return Auth.demanderCode(req.ident);
    case 'login':   return Auth.login(req.ident, req.mdp, req.remember);
    case 'activer': return Auth.activer(req.ident, req.code, req.mdp, req.remember);
    case 'reprendre': return Auth.reprendre(req.rt);
    case 'logout':  Auth.logout(req.token, req.rt); return {};
    case 'changer_mdp': return Auth.changerMdp(req.token, req.ancien, req.nouveau);
    case 'me':      { var um = Auth.userFromToken(req.token); return { user: pubUser_(um), acces: acces_(um) }; }
    case 'menu': {
      var u = Auth.userFromToken(req.token);
      if (typeof preparerStructure_ === 'function') preparerStructure_();
      if (typeof preparerSimulation_ === 'function') preparerSimulation_();
      if (typeof preparerAffectation_ === 'function') preparerAffectation_();
      if (typeof preparerPages_ === 'function') preparerPages_();
      if (typeof preparerAnnuaire_ === 'function') preparerAnnuaire_();
      if (typeof preparerLiens_ === 'function') preparerLiens_();
      if (typeof preparerLiensRapport_ === 'function') preparerLiensRapport_();
      if (typeof preparerCarteBadges_ === 'function') preparerCarteBadges_();
      if (typeof preparerCartesNouvelles_ === 'function') preparerCartesNouvelles_();
      if (typeof preparerJournalCpm_ === 'function') preparerJournalCpm_();
      return { user: pubUser_(u), mdp_par_defaut: Auth.estParDefaut(u.email), menu: Droits.menu(acces_(u), Store.table('Modules'), Store.table('Applications'), u.role), rubriques: orgRubriques_(), organiser: peutOrganiser_(u) };
    }
    case 'emettreCode': {
      var admin = Auth.userFromToken(req.token);
      if ((acces_(admin).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
      Store.journal('code_active', admin.email, req.email);
      return { code: Auth.emettreCode(req.email) };
    }
    case 'profil_enregistrer': return profilEnregistrer_(req);
    case 'profil_moi': return profilMoi_(req);
    case 'profil_maj': return profilMaj_(req);
    case 'profil_photo': return profilPhoto_(req);
    case 'photos_mini': return photosMini_(req);
    case 'acces_demander': return accesDemander_(req);
    case 'profil_correction': return profilCorrection_(req);
    case 'acces_demandes': return accesDemandes_(req);
    case 'acces_traiter': return accesTraiter_(req);
    case 'situation': return situationDe_(Auth.userFromToken(req.token));
    case 'rotation_enregistrer': return rotationEnregistrer_(req);
    case 'reliquat_enregistrer': return reliquatEnregistrer_(req);
    case 'planning': return planning_(req);
    case 'organigramme': return organigramme_(req);
    case 'visavis_liste': return visavisListe_(req);
    case 'visavis_enregistrer': return visavisEnregistrer_(req);
    case 'aff_personnes': return affPersonnes_(req);
    case 'aff_changer': return affChanger_(req);
    case 'aff_historique': return affHistorique_(req);
    case 'aff_chantiers_sup': return affChantiersSupLire_(req);
    case 'aff_chantiers_sup_maj': return affChantiersSupMaj_(req);
    case 'simu_agents': return simuAgents_(req);
    case 'simu_donnees': return simuDonnees_(req);
    case 'simu_valider': return simuValider_(req);
    case 'simu_liste': return simuListe_(req);
    case 'simu_demande': return simuDemande_(req);
    case 'simu_decider': return simuDecider_(req);
    case 'simu_annuler': return simuAnnuler_(req);
    case 'simu_supprimer': return simuSupprimer_(req);
    case 'simu_envoyer': return simuEnvoyer_(req);
    case 'modif_moi_donnees': return modifMoiDonnees_(req);
    case 'modif_moi': return modifMoi_(req);
    case 'planning_initial': return planningInitial_(req);
    case 'planning_effacer': return planningEffacer_(req);
    case 'modif_agent_donnees': return modifAgentDonnees_(req);
    case 'modif_moi_annuler': return modifMoiAnnuler_(req);
    case 'modif_alertes': return modifAlertes_(req);
    case 'donnees': return donneesCsv_(req);
    case 'badges_donnees': return badgesDonnees_(req);
    case 'badges_enquetes_fonctions': return badgesEnquetesFonctions_(req);
    case 'badges_enquetes_chercher': return badgesEnquetesChercher_(req);
    case 'badges_enquetes_verifier': return badgesEnquetesVerifier_(req);
    case 'badges_enquetes_saisir': return badgesEnquetesSaisir_(req);
    case 'badges_fiche': return badgesFiche_(req);
    case 'badges_enquetes_export': return badgesEnquetesExport_(req);
    case 'badges_fiche_maj': return badgesFicheMaj_(req);
    case 'badges_photo_archiver': return badgesPhotoArchiver_(req);
    case 'badges_photos_profils': return badgesPhotosProfils_(req);
    case 'video_formation': return videoFormation_(req);
    case 'habilitations_donnees': return habilitationsDonnees_(req);
    case 'pec': return pecAppeler_(req);
    case 'reservation_orga': return reservationOrga_(req);
    case 'reservation_envoyer': return reservationEnvoyer_(req);
    case 'reservation_trajet_supprimer': return reservationTrajetSupprimer_(req);
    case 'vivier_liste': return vivierListe_(req);
    case 'vivier_enregistrer': return vivierEnregistrer_(req);
    case 'vivier_supprimer': return vivierSupprimer_(req);
    case 'badges_personnes_sauver': return badgesPersonnesSauver_(req);
    case 'badges_entreprises_sauver': return badgesEntreprisesSauver_(req);
    case 'badges_numeroter': return badgesNumeroter_(req);
    case 'contacts_divergences': return contactsDivergences_(req);
    case 'contacts_confirmer': return contactsConfirmer_(req);
    case 'contacts_completer': return contactsCompleter_(req);
    case 'admin_connexions': return connexionsListe_(req);
    case 'admin_diagnostic': return connexionsDiagnostic_(req);
    case 'admin_mdp': return connexionsMdp_(req);
    case 'admin_mdp_defaut': return connexionsMdpDefautTous_(req);
    case 'admin_emails': return emailsControle_(req);
    case 'admin_email_contact': return emailContactAdmin_(req);
    case 'admin_utilisateur_modifier': {
      // Modifie les champs d'un compte : écrits dans BDDORGA quand la colonne existe, sinon dans Gateway_DB. Les champs que BDDORGA impose (ex. le nom) sont signalés.
      var a12 = admin_(req); cible_(req.email);
      var LONG12 = { nom: 120, service: 120, fonction: 120, dependance: 120, section: 60, telephone: 40, matricule: 30, sap: 30, sona: 30, civilite: 20, wifi_user: 60, date_integration: 10 };
      var ch12 = req.champs || {}, v12 = {};
      Object.keys(LONG12).forEach(function (k) { if (ch12[k] !== undefined) v12[k] = String(ch12[k]).replace(/\s+/g, ' ').trim().slice(0, LONG12[k]); });
      if (v12.nom !== undefined && !v12.nom) throw new Error('Le nom est obligatoire');
      if (v12.date_integration && !/^\d{4}-\d{2}-\d{2}$/.test(v12.date_integration)) throw new Error('Date d\'intégration : AAAA-MM-JJ');
      Object.keys(v12).forEach(function (k) { if (/^[=+@<>]/.test(v12[k])) throw new Error('Valeur invalide pour « ' + k + ' »'); });
      if (!Object.keys(v12).length) return { ignores: [] };
      Store.maj('Utilisateurs', { email: req.email }, v12);
      var ap12 = Store.utilisateur(req.email) || {}, ign12 = Object.keys(v12).filter(function (k) { return String(ap12[k] == null ? '' : ap12[k]) !== v12[k]; });
      Store.journal('utilisateur_modifie', a12.email, req.email + ' : ' + Object.keys(v12).join(', ') + (ign12.length ? ' (imposé par BDDORGA : ' + ign12.join(', ') + ')' : ''));
      return { ignores: ign12 };
    }
    case 'admin_utilisateur_supprimer': {
      var a13 = admin_(req), em13 = String(req.email || '').trim().toLowerCase(); cible_(em13);
      if (em13 === String(a13.email).toLowerCase()) throw new Error('Vous ne pouvez pas supprimer votre propre compte');
      if (String(req.confirmation || '').trim().toUpperCase() !== 'SUPPRIMER') throw new Error('Confirmation manquante');
      var cible13 = Store.utilisateur(em13);
      if (Droits.roleCanon(cible13.role) === 'chef_division') throw new Error('Un chef de division ne se supprime pas ici : changez d\'abord son rôle');
      Store.supprimerCompte(em13); Store.journal('utilisateur_supprime', a13.email, em13 + ' (' + (cible13.nom || '') + ')'); return {};
    }
    case 'admin_email_changer': {
      var a10 = admin_(req), ancien = String(req.email || '').trim().toLowerCase(), nouveau = String(req.nouveau || '').trim().toLowerCase();
      if (!Courriel.valide(nouveau)) throw new Error('Adresse e-mail invalide');
      if (!Store.utilisateur(ancien)) throw new Error('Compte inconnu');
      if (nouveau === ancien) throw new Error('C\'est déjà cette adresse');
      if (Store.utilisateur(nouveau)) throw new Error('Cette adresse est déjà utilisée par un autre compte');
      if (ancien === String(a10.email).toLowerCase()) throw new Error('Vous ne pouvez pas changer votre propre adresse ici : demandez à un autre administrateur');
      var lock10 = LockService.getScriptLock(); lock10.waitLock(30000);
      try { var n10 = Store.renommerEmail(ancien, nouveau); Store.journal('email_change', a10.email, ancien + ' → ' + nouveau + ' (' + n10 + ' cellule(s))'); return { cellules: n10, email: nouveau }; }
      finally { lock10.releaseLock(); }
    }
    case 'email_contact_demander': { var ue = Auth.userFromToken(req.token); if (typeof preparerStructure_ === 'function') preparerStructure_(); return Auth.demanderEmailContact(ue, req.adresse); }
    case 'email_contact_confirmer': { var uc = Auth.userFromToken(req.token); if (typeof preparerStructure_ === 'function') preparerStructure_(); return Auth.confirmerEmailContact(uc, req.code); }
    case 'admin_test_mail': return connexionsTestMail_(req);
    case 'annuaire_personnes': return annuairePersonnes_(req);
    case 'transport_telephone': return transportTelephone_(req);
    case 'vh_lire': return vhLire_(req);
    case 'vh_maj': return vhMaj_(req);
    case 'vh_ajouter': return vhAjouterAction_(req);
    case 'vh_supprimer': return vhSupprimer_(req);
    case 'vh_rattraper': return vhRattraperAction_(req);
    case 'stats_st_lire': return statsStLire_(req);
    case 'stats_st_recalculer': return statsStRecalculer_(req);
    case 'stats_st_maj': return statsStMaj_(req);
    case 'stats_st_supprimer': return statsStSupprimer_(req);
    case 'stats_st_ajouter': return statsStAjouter_(req);
    case 'benchmark_liste': return benchmarkListe_(req);
    case 'benchmark_lire': return benchmarkLire_(req);
    case 'benchmark_enregistrer': return benchmarkEnregistrer_(req);
    case 'benchmark_supprimer': return benchmarkSupprimer_(req);
    case 'pointage_effectif': { Auth.userFromToken(req.token); if ((acces_(Auth.userFromToken(req.token)).planning || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' }); return { groupes: POINTAGE_EFFECTIF }; }   // effectif de la division : réservé aux personnes connectées ayant le module planning
    case 'annuaire_fiches': { Auth.userFromToken(req.token); return { groupes: ANNUAIRE_DATA.groupes, rows: ANNUAIRE_DATA.rows }; }   // fiches contact : réservées aux personnes connectées (le fichier n'est plus publié sur le site)
    case 'cpm_journal': return cpmJournalListe_(req);
    case 'cpm_journal_supprimer': return cpmJournalSupprimer_(req);
    case 'cpm_instantane': return cpmInstantaneMaintenant_(req);
    case 'donnees_multi': return donneesMulti_(req);
    case 'rapport_diapos': return rapportDiaposInjecter_(req);
    case 'rapports_chantiers': return rapportsChantiers_(req);
    case 'rapport_chantier_ouvrir': return rapportChantierOuvrir_(req);
    case 'tableau_bord': return tableauBord_(req);
    case 'diffusion_options': return diffusionOptions_(req);
    case 'diffusion_envoyer': return diffusionEnvoyer_Action_(req);
    case 'menu_organisation_lire': return menuOrgLire_(req);
    case 'menu_organisation_enregistrer': return menuOrgEnregistrer_(req);
    case 'rapport_enregistrer': return rapportEnregistrer_(req);
    case 'rapports_liste': return rapportsListe_(req);
    case 'stats_rapports_lire': return statsRapportsLire_(req);
    case 'rapport_corriger': return rapportCorriger_(req);
    case 'rapport_viser': return rapportViser_(req);
    case 'rapports_synthese': return rapportsSynthese_(req);
    case 'rapports_consolide_generer': return rapportsConsolideGenerer_(req);
    case 'rapports_consolide_lire': return rapportsConsolideLire_(req);
    case 'rapports_consolide_envoyer': return rapportsConsolideEnvoyer_(req);
    case 'rapports_conso_destinataires': return consoDestinataires_(req);
    case 'rapports_conso_personnes': return consoPersonnes_(req);
    case 'rapports_conso_auto_lire': return consoAutoLire_(req);
    case 'rapports_conso_auto_maj': return consoAutoMaj_(req);
    case 'rapports_consolides_liste': return rapportsConsolidesListe_(req);
    case 'admin_etat': {
      admin_(req);
      var us = Store.table('Utilisateurs'); var nb = {};
      us.forEach(function (u) { var c = Droits.roleCanon(u.role); nb[c] = (nb[c] || 0) + 1; });
      return {
        roles: ROLES_INFO_.map(function (r) { return { id: r.id, libelle: r.libelle, niveau_max: r.niveau_max, interdits: r.interdits, nb_utilisateurs: nb[r.id] || 0, rang: Droits.rang(r.id) }; }),
        modules: Store.table('Modules'), droitsRole: Store.table('DroitsRole'), exceptions: Store.table('Exceptions'),
        applications: Store.table('Applications').map(function (x) { return { module: x.module, titre: x.titre, niveau_min: Number(x.niveau_min) || 1, roles: Droits.rolesDe(x.roles), rubrique: String(x.rubrique || ''), ordre: x.ordre === '' || x.ordre == null || isNaN(Number(x.ordre)) ? '' : Number(x.ordre), actif: String(x.actif) === '0' ? 0 : 1, vision: Droits.visionDe(x.vision) }; }),
        rubriques: orgRubriques_(),
        utilisateurs: us.map(function (u) { return { email: u.email, nom: Annuaire.nomAffichable(u.nom, u.email), service: u.service, fonction: u.fonction, dependance: u.dependance || '', role: Droits.roleCanon(u.role), actif: String(u.actif) !== '0', portee: String(u.portee || ''), section: String(u.section || ''), telephone: String(u.telephone || ''), matricule: String(u.matricule || ''), sap: String(u.sap || ''), sona: String(u.sona || ''), civilite: String(u.civilite || ''), wifi_user: String(u.wifi_user || ''), date_integration: String(u.date_integration || ''), hors: !!u.horsBDDORGA }; })
      };
    }
    case 'rapports_chantiers_admin': return rapportsChantiersAdmin_(req);
    case 'rapports_chantier_maj': return rapportsChantierMaj_(req);
    case 'chantiers_tableau': return chantiersTableau_(req);
    case 'rapports_chantiers_sync': return rapportsChantiersSync_(req);
    case 'admin_inviter': {
      // Invitation par e-mail : lien, première connexion et applications accordées. { emails: [...] } ou { email }
      var ai = admin_(req), cibles = Array.isArray(req.emails) ? req.emails : (req.email ? [req.email] : []);
      var lienSite = PropertiesService.getScriptProperties().getProperty('SITE_URL') || 'https://rayanem-dev.github.io/DashBoard-Infra-v2/';
      lienSite = lienSite.replace(/\/?$/, '/') + 'connexion.html';
      var envoyes = [], echecs = [], quota = typeof MailApp !== 'undefined' && MailApp.getRemainingDailyQuota ? MailApp.getRemainingDailyQuota() : 100;
      cibles.slice(0, 60).forEach(function (em) {
        try {
          var ui = Store.utilisateur(em); if (!ui || String(ui.actif) === '0') { echecs.push(em + ' : compte inactif ou inconnu'); return; }
          var dest = Auth.adresseEnvoi(ui); if (!dest) { echecs.push(em + ' : pas d\'adresse e-mail valide'); return; }
          if (envoyes.length >= quota) { echecs.push(em + ' : quota d\'envoi du jour atteint'); return; }
          Mail.envoyerInvitation(dest, Annuaire.nomAffichable(ui.nom, ui.email), Droits.menu(acces_(ui), Store.table('Modules'), Store.table('Applications'), ui.role), lienSite, Auth.estParDefaut(ui.email));
          Store.journal('invitation', ai.email, ui.email); envoyes.push(ui.email);
        } catch (e) { echecs.push(em + ' : ' + e.message); }
      });
      return { envoyes: envoyes, echecs: echecs };
    }
    case 'admin_usurper': {
      var au = admin_(req); cible_(req.email);
      // SUPER_ADMINS (propriété du script, e-mails séparés par des virgules) : si elle est renseignée, seuls ces comptes peuvent ouvrir une session de support
      var sa = String(PropertiesService.getScriptProperties().getProperty('SUPER_ADMINS') || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
      if (sa.length && sa.indexOf(String(au.email).toLowerCase()) === -1) throw Object.assign(new Error('Réservé aux super-administrateurs'), { code: 'DROITS' });
      return Auth.usurper(au, req.email);
    }
    case 'admin_role_enregistrer': return roleEnregistrer_(req);
    case 'admin_role_supprimer': return roleSupprimer_(req);
    case 'admin_role': {
      var a1 = admin_(req); var e1 = Droits.verifier(req.role); if (e1) throw new Error(e1);
      cible_(req.email);
      if (String(req.email).toLowerCase() === String(a1.email).toLowerCase()) throw new Error('Vous ne pouvez pas modifier votre propre rôle');
      Store.maj('Utilisateurs', { email: req.email }, { role: Droits.roleCanon(req.role) });
      Store.journal('role', a1.email, req.email + ' -> ' + req.role); return {};
    }
    case 'admin_utilisateur_ajouter': {
      // Nouveau compte (ex. chef d'équipe d'un prestataire, stagiaire) créé dans Gateway_DB ; les personnes de la division restent à inscrire aussi dans BDDORGA (organigramme, annuaire).
      var a7 = admin_(req), em = String(req.email || '').trim().toLowerCase(), nm = String(req.nom || '').replace(/\s+/g, ' ').trim();
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(em)) throw new Error('Adresse e-mail invalide');
      if (!nm) throw new Error('Le nom est obligatoire');
      var rl = Droits.roleCanon(req.role); var e7 = Droits.verifier(rl); if (e7) throw new Error(e7);
      var dep = String(req.dependance || '').replace(/\s+/g, ' ').trim();
      if (rl === 'prestataire' && !dep) throw new Error('Choisissez l\'entreprise du prestataire (champ « Dépendance / entreprise »)');
      if (Store.utilisateur(em)) throw new Error('Un compte existe déjà avec cette adresse');
      Store.maj('Utilisateurs', { email: em }, { uid: uidPour_(em), nom: nm.slice(0, 120), service: String(req.service || '').trim().slice(0, 120), fonction: String(req.fonction || '').trim().slice(0, 120), dependance: dep.slice(0, 120), portee: rl === 'prestataire' ? dep.slice(0, 120) : '', section: String(req.section || '').trim().slice(0, 60), role: rl, actif: 1, email_contact: em });
      Store.journal('utilisateur_ajout', a7.email, em + ' (' + rl + ')'); return { email: em };
    }
    case 'admin_portee': {
      // Entreprises d'un compte prestataire : il ne verra et ne créera que ce qui les concerne (Badges, et toute application qui lui sera ouverte)
      var a8 = admin_(req); cible_(req.email);
      var liste8 = (Array.isArray(req.entreprises) ? req.entreprises : String(req.entreprises || '').split(/[;\n]+/)).map(function (x) { return String(x).replace(/\s+/g, ' ').trim(); }).filter(Boolean).slice(0, 30);
      Store.maj('Utilisateurs', { email: req.email }, { portee: liste8.join(' ; ') });
      Store.journal('portee', a8.email, req.email + ' -> ' + (liste8.join(' ; ') || 'aucune')); return {};
    }
    case 'admin_section': {
      // Section d'un service (ex. Froid / Électricité pour l'Électromécanique, Hydraulique) : simple regroupement d'affichage dans l'organigramme, aucun droit.
      var a9 = admin_(req); cible_(req.email); var sec = String(req.section || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      Store.maj('Utilisateurs', { email: req.email }, { section: sec }); Store.journal('section', a9.email, req.email + ' -> ' + (sec || 'aucune')); return {};
    }
    case 'admin_portee_choix': { admin_(req); var noms9 = {}; badgesCharger_().entreprises.forEach(function (e) { noms9[e.nom] = 1; }); pecEntreprisesConfig_().forEach(function (n) { noms9[n] = 1; }); return { entreprises: Object.keys(noms9).sort() }; }
    case 'admin_actif': {
      var a2 = admin_(req); cible_(req.email);
      if (String(req.email).toLowerCase() === String(a2.email).toLowerCase()) throw new Error('Vous ne pouvez pas désactiver votre propre compte');
      Store.maj('Utilisateurs', { email: req.email }, { actif: req.actif ? 1 : 0 });
      Store.journal(req.actif ? 'activation' : 'desactivation', a2.email, req.email); return {};
    }
    case 'admin_droit': {
      var a3 = admin_(req); module_(req.module); var e3 = Droits.verifier(req.role, Number(req.niveau), req.module); if (e3) throw new Error(e3);
      if (String(req.role) === 'secretariat' && String(req.module) === 'securite' && Number(req.niveau) < 3) throw new Error('Le secrétariat doit garder l\'administration de la sécurité');
      var rc3 = Droits.roleCanon(req.role);
      if (Number(req.niveau) === 0) Store.supprimer('DroitsRole', { role: rc3, module: req.module });
      else Store.maj('DroitsRole', { role: rc3, module: req.module }, { niveau: Number(req.niveau) });
      Store.journal('droit_role', a3.email, req.role + '/' + req.module + '=' + req.niveau); return {};
    }
    case 'admin_exception': {
      var a4 = admin_(req); cible_(req.email); module_(req.module);
      if (req.niveau === null || req.niveau === undefined || req.niveau === '') Store.supprimer('Exceptions', { email: req.email, module: req.module });
      else { var rc4 = Droits.roleCanon(Store.utilisateur(req.email).role); var e4 = Droits.verifier(Droits.ROLES.indexOf(rc4) === -1 ? undefined : rc4, Number(req.niveau), req.module); if (e4) throw new Error(e4); Store.maj('Exceptions', { email: req.email, module: req.module }, { niveau: Number(req.niveau) }); }
      Store.journal('exception', a4.email, req.email + '/' + req.module + '=' + req.niveau); return {};
    }
    case 'admin_app': {
      var a5 = admin_(req);
      var ap = Store.table('Applications').filter(function (x) { return String(x.titre) === String(req.titre); })[0];
      if (!ap) throw new Error('Application inconnue');
      var nm = Number(req.niveau_min); if (!(nm === 1 || nm === 2 || nm === 3)) throw new Error('Niveau minimal invalide (1 à 3)');
      var liste = (req.roles || []).map(Droits.roleCanon);
      liste.forEach(function (r) { if (Droits.ROLES.indexOf(r) === -1) throw new Error('Rôle inconnu : ' + r); });
      Store.maj('Applications', { titre: req.titre }, { niveau_min: nm, roles: liste.join(',') });
      Store.journal('application', a5.email, req.titre + ' niveau>=' + nm + ' roles=' + (liste.join(',') || 'tous')); return {};
    }
    case 'admin_rubrique': {
      // Déplace une carte d'une catégorie d'affichage à une autre ; ne change aucun droit. rubrique vide = rangement automatique d'après le titre.
      var a6 = admin_(req);
      var ap6 = Store.table('Applications').filter(function (x) { return String(x.titre) === String(req.titre); })[0];
      if (!ap6) throw new Error('Application inconnue');
      var rb = String(req.rubrique || '');
      if (rb && RUBRIQUES_IDS_.concat(orgRubriques_().map(function (x) { return x.id; })).indexOf(rb) === -1) throw new Error('Catégorie inconnue');
      Store.maj('Applications', { titre: req.titre }, { rubrique: rb });
      Store.journal('rubrique', a6.email, req.titre + ' -> ' + (rb || 'automatique')); return {};
    }
    default: throw new Error('Action inconnue');
  }
}
var ACTIONS_PRESTATAIRE_ = /^(changer_mdp|me|menu|profil_moi|profil_enregistrer|profil_maj|profil_photo|photos_mini|acces_demander|profil_correction|email_contact_\w+|badges_donnees|badges_numeroter|badges_personnes_sauver|badges_entreprises_sauver|badges_enquetes_saisir|pec)$/;
var RUBRIQUES_IDS_ = ['pilotage', 'marches', 'acces', 'personnel', 'logistique', 'admin', 'it'];

function acces_(user) { return Droits.resolve(user, Store.table('DroitsRole'), Store.table('Exceptions')); }

function admin_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).securite || 0) < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return u;
}
function cible_(email) { if (!Store.utilisateur(email)) throw new Error('Utilisateur inconnu'); }
function module_(id) {
  if (!Store.table('Modules').some(function (m) { return String(m.id).toLowerCase() === String(id).toLowerCase(); })) throw new Error('Module inconnu');
}

// ---------- Planning (rotations) ----------
/** Personnes visibles dans le planning d'un agent sans droit « équipes » : ses vis-à-vis (déclarés dans l'outil Vis-à-vis). */
function visibilitePlanning_(u) {
  try { return (typeof simuVisibles_ === 'function') ? simuVisibles_(u) : null; } catch (e) { return {}; }
}
function jour_(v) {
  var s = String(v == null ? '' : v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(v); return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function rotationDe_(email) {
  var l = Store.table('Rotations'); email = String(email).toLowerCase();
  for (var i = 0; i < l.length; i += 1) if (String(l[i].email).toLowerCase() === email) {
    var rq = l[i].reliquat;
    return { statut: String(l[i].statut), depuis: jour_(l[i].depuis), jours_travail: Number(l[i].jours_travail), jours_repos: Number(l[i].jours_repos), reliquat: (rq === '' || rq == null || isNaN(Number(rq))) ? null : Number(rq) };
  }
  return null;
}
function situationDe_(u) {
  if ((acces_(u).planning || 0) < 1) return { acces: false };
  var rot = rotationDe_(u.email);
  if (!rot) return { acces: true, configuree: false, nom: u.nom };
  return { acces: true, configuree: true, nom: u.nom, rotation: rot, reliquat: rot.reliquat, solde: soldeDe_(u.email).solde, reliquat_renseigne: rot.reliquat !== null, situation: Planning.situation(rot, correctionsDe_(u.email), Dates.today()) };
}
function rotationEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); var niv = acces_(u).planning || 0;
  var email = String(req.email || u.email).toLowerCase();
  if (email !== String(u.email).toLowerCase()) { if (niv < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' }); cible_(email); }
  else if (niv < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var rot = { statut: String(req.statut), depuis: String(req.depuis), jours_travail: Number(req.jours_travail), jours_repos: Number(req.jours_repos) };
  var err = Planning.valider(rot, Dates.today()); if (err) throw new Error(err);
  var champsRot = { statut: rot.statut, depuis: rot.depuis, jours_travail: rot.jours_travail, jours_repos: rot.jours_repos, maj_par: u.email, maj_le: new Date().toISOString() };
  if (req.reliquat !== undefined && req.reliquat !== null && req.reliquat !== '') champsRot.reliquat = reliquatValide_(req.reliquat); // sinon le reliquat déjà saisi est conservé
  Store.maj('Rotations', { email: email }, champsRot);
  Store.journal('rotation', u.email, email + ' ' + rot.statut + ' depuis ' + rot.depuis + ' (' + rot.jours_travail + '/' + rot.jours_repos + ')');
  return situationDe_(Store.utilisateur(email));
}
/** Reliquat initial : entier de jours (+ : jours de congé dus, − : jours pris en avance). */
function reliquatValide_(x) {
  var n = Number(x);
  if (x === '' || x === null || x === undefined || !isFinite(n) || Math.floor(n) !== n || Math.abs(n) > 365) throw new Error('Reliquat : un nombre entier de jours entre −365 et 365 (0 si vous n\'en avez pas)');
  return n;
}
function reliquatEnregistrer_(req) {
  var u = Auth.userFromToken(req.token), niv = acces_(u).planning || 0;
  var email = String(req.email || u.email).toLowerCase();
  if (email !== String(u.email).toLowerCase()) { if (niv < 3) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' }); cible_(email); } // un autre agent : droit de modification (niveau 3)
  else if (niv < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  if (!rotationDe_(email)) throw new Error(email === String(u.email).toLowerCase() ? 'Renseignez d\'abord votre rotation' : 'Cet agent n\'a pas encore de rotation');
  var v = reliquatValide_(req.reliquat);
  Store.maj('Rotations', { email: email }, { reliquat: v, maj_par: u.email, maj_le: new Date().toISOString() });
  Store.journal('reliquat', u.email, email + ' reliquat initial : ' + v);
  return email === String(u.email).toLowerCase() ? situationDe_(u) : { reliquat: v };
}
function planning_(req) {
  var u = Auth.userFromToken(req.token); var niv = acces_(u).planning || 0;
  if (niv < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var auj = Dates.today();
  var debut = Dates.isDate(req.debut) ? req.debut : Dates.addDays(auj, -7);
  var n = Math.max(7, Math.min(370, Number(req.jours) || 35));
  var tous = niv >= 2; // 1 = son propre planning seulement ; 2 = tout le monde ; 3 = tout le monde + modification
  var moi = String(u.email).toLowerCase();
  var mods = correctionsParEmail_(); // demandes de modification approuvées
  var vis = tous ? null : visibilitePlanning_(u);   // niveau 1 : son planning + ses vis-à-vis (travail et chambre) quand ils existent
  var lignes = Store.table('Utilisateurs').filter(function (x) {
    return String(x.actif) !== '0' && x.email && (tous || String(x.email).toLowerCase() === moi || (vis && vis[String(x.uid)]));
  }).map(function (x) {
    var l = { uid: String(x.uid || ''), nom: Annuaire.nomAffichable(x.nom, x.email), service: x.service, fonction: x.fonction, dependance: x.dependance || '', configuree: false, moi: String(x.email).toLowerCase() === moi };
    if (niv >= 3) l.email = x.email;
    var rot = rotationDe_(x.email);
    if (!rot) return l;
    var corr = mods[String(x.email).toLowerCase()] || [];
    var s = Planning.situation(rot, corr, auj);
    l.configuree = true; l.rotation = { jours_travail: rot.jours_travail, jours_repos: rot.jours_repos, statut: rot.statut, depuis: rot.depuis, reliquat: rot.reliquat };
    l.situation = s; l.grille = Planning.grille(rot, corr, debut, n);
    return l;
  });
  return { aujourdhui: auj, debut: debut, jours: n, peutVoirTous: tous, peutModifier: niv >= 3, lignes: lignes };
}

// ---------- Rôles modifiables (onglet « Roles ») ----------
var ROLES_INFO_ = [];

/** Charge les rôles de l'onglet « Roles » ; à défaut (onglet absent ou vide), les rôles d'origine. Le secrétariat est toujours présent (anti-verrouillage). */
function chargerRoles_() {
  var l = [];
  try { l = Store.table('Roles'); } catch (e) { l = []; }
  var defs = l.map(function (r) {
    return { id: Droits.roleCanon(r.id), libelle: String(r.libelle || r.id), niveau_max: Number(r.niveau_max) || 0,
             interdits: String(r.interdits || '').split(/[,;]/).map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean) };
  }).filter(function (r) { return r.id; });
  if (defs.length && !defs.some(function (r) { return r.id === 'secretariat'; })) defs.push({ id: 'secretariat', libelle: 'Secrétariat', niveau_max: 0, interdits: [] });
  Droits.configurer(defs);
  ROLES_INFO_ = defs.length ? defs : Droits.rolesParDefaut();
}
function libelleRole_(role) {
  var c = Droits.roleCanon(role);
  for (var i = 0; i < ROLES_INFO_.length; i += 1) if (ROLES_INFO_[i].id === c) return ROLES_INFO_[i].libelle;
  return role || '';
}
function pubUser_(u) { var p = Auth.publique(u); p.uid = String(u.uid || ''); p.role_libelle = libelleRole_(u.role); try { if (typeof profilFusion_ === 'function') p = profilFusion_(p, profilDe_(u.email)); } catch (e) { /* onglet Profils absent : fiche sans corrections */ } return p; }

/** Si l'onglet « Roles » est vide, y recopie d'abord les rôles d'origine (sinon le premier rôle créé ferait disparaître les autres). */
function semerRoles_() {
  var l = []; try { l = Store.table('Roles'); } catch (e) { throw new Error('Onglet « Roles » absent : exécutez mettreAJourStructure dans l\'éditeur Apps Script'); }
  if (l.length) return;
  Droits.rolesParDefaut().forEach(function (r) { Store.maj('Roles', { id: r.id }, { libelle: r.libelle, niveau_max: r.niveau_max, interdits: r.interdits.join(',') }); });
}
function roleEnregistrer_(req) {
  var a = admin_(req); semerRoles_(); chargerRoles_();
  var def = { id: req.id, libelle: req.libelle, niveau_max: Number(req.niveau_max) || 0, interdits: req.interdits || [] };
  var mods = Store.table('Modules').map(function (x) { return String(x.id).toLowerCase(); });
  var err = Droits.validerRole(def, Droits.ROLES, mods, !!req.creation); if (err) throw new Error(err);
  var id = Droits.roleCanon(def.id || def.libelle);
  if (!req.creation && Droits.ROLES.indexOf(id) === -1) throw new Error('Rôle inconnu');
  if (id === 'secretariat' && (def.niveau_max || def.interdits.length)) throw new Error('Le rôle secrétariat ne peut pas être restreint');
  Store.maj('Roles', { id: id }, { libelle: String(def.libelle).trim(), niveau_max: def.niveau_max, interdits: def.interdits.map(function (x) { return String(x).toLowerCase(); }).join(',') });
  Store.journal(req.creation ? 'role_cree' : 'role_modifie', a.email, id);
  return { id: id };
}
function roleSupprimer_(req) {
  var a = admin_(req); semerRoles_(); chargerRoles_();
  var id = Droits.roleCanon(req.id);
  if (id === 'secretariat') throw new Error('Le rôle secrétariat ne peut pas être supprimé');
  if (Droits.ROLES.indexOf(id) === -1) throw new Error('Rôle inconnu');
  var nb = Store.table('Utilisateurs').filter(function (u) { return Droits.roleCanon(u.role) === id; }).length;
  if (nb) throw new Error('Impossible : ' + nb + ' utilisateur' + (nb > 1 ? 's ont' : ' a') + ' ce rôle. Changez d\'abord leur rôle.');
  // Droits et limitations d'applications qui le mentionnent
  var vus = {};
  Store.table('DroitsRole').forEach(function (d) { if (Droits.roleCanon(d.role) === id) vus[String(d.role)] = true; });
  Object.keys(vus).forEach(function (r) { Store.supprimerTout('DroitsRole', { role: r }); });
  Store.table('Applications').forEach(function (x) {
    var l = Droits.rolesDe(x.roles);
    if (l.indexOf(id) !== -1) Store.maj('Applications', { titre: x.titre }, { roles: l.filter(function (r) { return r !== id; }).join(',') });
  });
  Store.supprimer('Roles', { id: id });
  Store.journal('role_supprime', a.email, id);
  return {};
}

// ---------- Rapports journaliers ----------
function niveauRapports_(u, min) {
  var n = acces_(u).rapports || 0;
  if (n < (min || 1)) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return n;
}
/** Ajoute à l'onglet les colonnes qui manquent (en-têtes seulement ; jamais de donnée touchée). Une seule vérification par colonne et par version. */
function assurerColonnes_(nom, colonnes) {
  var props = PropertiesService.getScriptProperties(), cle = 'COL_' + nom + '_' + colonnes.join('_');
  if (props.getProperty(cle) === '1') return;
  var sh = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName(nom); if (!sh) return;
  var h = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  colonnes.forEach(function (c) { if (h.indexOf(c) < 0) { sh.getRange(1, h.length + 1).setValue(c); h.push(c); } });
  try { CacheService.getScriptCache().remove('TBL_' + nom); } catch (e) { /* rien */ }
  props.setProperty(cle, '1');
}
function chantiersTous_() {
  assurerColonnes_('Chantiers', ['contrat', 'entreprise', 'source', 'fiche', 'suivi']); assurerColonnes_('Chantiers', ['phase', 'ouvert_jusqu']);
  var auj = Dates.today();
  return Store.table('Chantiers').filter(function (c) { return c.id; })
    .map(function (c) {
      var o = { id: String(c.id).toLowerCase(), nom: c.nom, service: c.service || '', actif: String(c.actif) === '0' ? 0 : 1, contrat: c.contrat || '', entreprise: c.entreprise || '', source: c.source || '', fiche: c.fiche || '', suivi: c.suivi || '',
        phase: String(c.phase || ''), ouvert_jusqu: c.ouvert_jusqu instanceof Date ? Utilities.formatDate(c.ouvert_jusqu, 'Africa/Algiers', 'yyyy-MM-dd') : String(c.ouvert_jusqu || '') };
      if (!Rapports.ouvert(o, auj)) o.actif = 0;   // préparation / levée des réserves arrivée à sa date de fin : fermé sans écriture
      return o;
    });
}
function chantiersActifs_() { return chantiersTous_().filter(function (c) { return c.actif; }); }
function lignesLues_(v) { if (Array.isArray(v)) return v; try { var l = JSON.parse(String(v || '[]')); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function rapportsLus_() {
  assurerColonnes_('Rapports', ['lignes', 'corrige_par', 'corrige_le']);
  return Store.table('Rapports').map(function (r) {
    return { id: String(r.id), date: jour_(r.date), chantier: String(r.chantier).toLowerCase(), auteur_email: String(r.auteur_email), auteur_nom: r.auteur_nom, service: r.service,
      effectif: Number(r.effectif) || 0, travaux: String(r.travaux || ''), lignes: lignesLues_(r.lignes), difficultes: String(r.difficultes || ''), commentaire: String(r.commentaire || ''),
      avancement: r.avancement === '' || r.avancement == null ? '' : Number(r.avancement),
      visa_par: String(r.visa_par || ''), visa_note: String(r.visa_note || ''), visa_le: String(r.visa_le || ''), corrige_par: String(r.corrige_par || ''), corrige_le: String(r.corrige_le || '') };
  });
}
function rapportsChantiers_(req) {
  var u = Auth.userFromToken(req.token), niv = niveauRapports_(u, 1);
  assurerColonnes_('Utilisateurs', ['chantiers_sup']); u = Auth.userFromToken(req.token);
  var role = Droits.roleCanon(u.role), peut = Rapports.peutCorriger(u, role), vis = Rapports.chantiersVisibles(chantiersActifs_(), u, niv), hors = [];
  if (peut) {
    var tous = chantiersTous_(), ouverts = {}; vis.forEach(function (c) { ouverts[c.id] = 1; });
    try { hors = Rapports.horsExecution(cpmEnregistrements_(lignesSource_('cpm'))); } catch (e) { hors = []; }   // Suivi CPM illisible : on garde la saisie manuelle
    hors = hors.filter(function (h) { return !ouverts[h.id]; });
    var connus = {}; hors.forEach(function (h) { connus[h.id] = 1; });
    tous.forEach(function (c) { if (!c.actif && c.phase && !connus[c.id] && !ouverts[c.id]) hors.push({ id: c.id, nom: c.nom, contrat: c.contrat, entreprise: c.entreprise, statut: 'Période terminée', phase: c.phase }); });
  }
  return { chantiers: vis.map(function (c) { return { id: c.id, nom: Rapports.etiquette(c), service: c.service, phase: c.phase }; }), niveau: niv, peut_ouvrir: peut, peut_envoyer: role === 'secretariat' && niv >= 3, hors_contrat: hors };
}
/** Ouvre (ou rouvre) un chantier hors contrat : préparation avant le contrat, levée des réserves après ; chef de division, secrétariat et chefs de service, sans validation. */
function rapportChantierOuvrir_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 1);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var existants = chantiersTous_(), id = String(req.id || '').toLowerCase();
    if (id && !existants.some(function (c) { return c.id === id; })) {   // contrat du Suivi CPM pas encore chantier : créé (fermé) puis ouvert avec la phase demandée
      var h = Rapports.horsExecution(cpmEnregistrements_(lignesSource_('cpm'))).filter(function (x) { return x.id === id; })[0];
      if (!h) throw new Error('Ce contrat n\'est pas ouvrable hors contrat (en exécution, infructueux ou inconnu)');
      var neuf = { id: id, nom: h.nom, service: '', actif: 0, contrat: h.contrat, entreprise: h.entreprise, source: 'cpm', fiche: '', suivi: '', phase: '', ouvert_jusqu: '' };
      Store.maj('Chantiers', { id: id }, neuf); existants.push(neuf);
    }
    var v = Rapports.ouvrirChantier(req, u, Droits.roleCanon(u.role), Dates.today(), existants); if (v.erreur) throw new Error(v.erreur);
    Store.maj('Chantiers', { id: v.id }, v.valeurs);
    Store.journal('chantier_ouvert', u.email, v.id + ' ' + v.valeurs.phase + ' jusqu\'au ' + v.valeurs.ouvert_jusqu);
    return { id: v.id, neuf: v.neuf, phase: v.valeurs.phase, jusqu: v.valeurs.ouvert_jusqu };
  } finally { lock.releaseLock(); }
}
function rapportEnregistrer_(req) {
  var u = Auth.userFromToken(req.token); var niv = niveauRapports_(u, 2);
  assurerColonnes_('Utilisateurs', ['chantiers_sup']); u = Auth.userFromToken(req.token);
  var ids = Rapports.chantiersVisibles(chantiersActifs_(), u, niv).map(function (c) { return c.id; }); // seulement les chantiers de son service
  var v = Rapports.valider(req, Dates.today(), niv, ids); if (v.erreur) throw new Error(v.erreur);
  var r = v.rapport; var id = Rapports.cle(r.date, r.chantier, u.email);
  var maintenant = new Date().toISOString();
  var existe = Store.table('Rapports').some(function (x) { return String(x.id) === id; });
  var valeurs = { date: r.date, chantier: r.chantier, auteur_email: u.email, auteur_nom: Annuaire.nomAffichable(u.nom, u.email), service: serviceDuRapport_(u, r.chantier), effectif: r.effectif, travaux: r.travaux, lignes: JSON.stringify(r.lignes || []),
                  difficultes: r.difficultes, commentaire: r.commentaire, avancement: r.avancement, modifie_le: maintenant };
  if (!existe) valeurs.cree_le = maintenant;
  Store.maj('Rapports', { id: id }, valeurs);
  Store.journal(existe ? 'rapport_modifie' : 'rapport_cree', u.email, id);
  return { id: id, modifie: existe };
}
/** Service rattaché au rapport : celui de l'auteur ; pour un projet d'un autre service ouvert à l'agent (Affectation du personnel), celui du chantier, pour que son chef de service le voie et le vise. */
function serviceDuRapport_(u, chantierId) {
  if (Rapports.idsSup(u).indexOf(String(chantierId).toLowerCase()) < 0) return u.service || '';
  var c = chantiersTous_().filter(function (x) { return x.id === String(chantierId).toLowerCase(); })[0];
  return (c && c.service) || u.service || '';
}
function rapportsListe_(req) {
  var u = Auth.userFromToken(req.token); var niv = niveauRapports_(u, 1);
  var auj = Dates.today();
  var du = Dates.isDate(req.du) ? req.du : Dates.addDays(auj, -6);
  var au = Dates.isDate(req.au) ? req.au : auj;
  var voitTout = Rapports.peutCorriger(u, Droits.roleCanon(u.role));   // chef de division, secrétariat, chefs de service : tous les rapports (pour les corriger) ; le visa reste limité à la portée habituelle
  var liste = Rapports.filtrer(rapportsLus_(), u, voitTout ? 3 : niv, { du: du, au: au, chantier: req.chantier || '', auteur: niv >= 2 || voitTout ? (req.auteur || '') : '' });
  var out = liste.slice(0, 300).map(function (r) { r.peut_viser = Rapports.peutViser(u, niv, r); r.peut_corriger = voitTout; r.le_mien = String(r.auteur_email).toLowerCase() === String(u.email).toLowerCase(); return r; });
  return { du: du, au: au, niveau: niv, rapports: out, tronque: liste.length > 300 };
}
/** Statistiques des rapports journaliers sur une période (page « Statistiques », onglet Rapports journaliers) : mêmes droits de lecture que la liste des rapports. */
function statsRapportsLire_(req) {
  var u = Auth.userFromToken(req.token), niv = niveauRapports_(u, 1), auj = Dates.today();
  var du = Dates.isDate(req.du) ? req.du : Dates.addDays(auj, -29), au = Dates.isDate(req.au) ? req.au : auj;
  if (du > au) throw new Error('La période est à l\'envers');
  if (Dates.diffDays(du, au) > 400) throw new Error('Période trop longue (400 jours au plus)');
  var voitTout = Rapports.peutCorriger(u, Droits.roleCanon(u.role));
  var liste = Rapports.filtrer(rapportsLus_(), u, voitTout ? 3 : niv, { du: du, au: au, chantier: req.chantier || '' });
  var chs = (voitTout || niv >= 3 ? chantiersActifs_() : Rapports.chantiersVisibles(chantiersActifs_(), u, niv)).map(function (c) { return { id: c.id, nom: Rapports.etiquette(c), service: c.service }; });
  return Rapports.statistiques(liste, chs, du, au, auj);
}
/** Corrige un rapport d'un jour passé (chef de division, secrétariat, chef de service de son service) ; l'auteur, la date et le chantier restent, la correction est tracée. */
function rapportCorriger_(req) {
  var u = Auth.userFromToken(req.token);
  var r = rapportsLus_().filter(function (x) { return x.id === String(req.id); })[0];
  if (!r) throw new Error('Rapport introuvable');
  if (!Rapports.peutCorriger(u, Droits.roleCanon(u.role))) throw Object.assign(new Error('Vous ne pouvez pas corriger ce rapport'), { code: 'DROITS' });
  var v = Rapports.corriger(req, r); if (v.erreur) throw new Error(v.erreur);
  var x = v.rapport, maintenant = new Date().toISOString();
  Store.maj('Rapports', { id: r.id }, { effectif: x.effectif, travaux: x.travaux, lignes: JSON.stringify(x.lignes || []), difficultes: x.difficultes, commentaire: x.commentaire, avancement: x.avancement,
    modifie_le: maintenant, corrige_par: Annuaire.nomAffichable(u.nom, u.email), corrige_le: maintenant });
  Store.journal('rapport_corrige', u.email, r.id + ' (avancement ' + (r.avancement === '' ? '—' : r.avancement) + ' → ' + (x.avancement === '' ? '—' : x.avancement) + ')');
  return { id: r.id };
}
function rapportViser_(req) {
  var u = Auth.userFromToken(req.token); var niv = niveauRapports_(u, 2);
  var r = rapportsLus_().filter(function (x) { return x.id === String(req.id); })[0];
  if (!r) throw new Error('Rapport introuvable');
  if (!Rapports.peutViser(u, niv, r)) throw Object.assign(new Error('Vous ne pouvez pas viser ce rapport'), { code: 'DROITS' });
  Store.maj('Rapports', { id: r.id }, { visa_par: Annuaire.nomAffichable(u.nom, u.email), visa_note: Rapports.nettoyer(req.note, 500), visa_le: new Date().toISOString() });
  Store.journal('rapport_vise', u.email, r.id);
  return {};
}
/** Chantiers (tous, actifs ou non) pour la page d'administration du niveau 3. */
function rapportsChantiersAdmin_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 3);
  return { chantiers: chantiersTous_() };
}
/** Service et état d'un chantier (niveau 3). */
function rapportsChantierMaj_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 3);
  var id = String(req.id || '').toLowerCase(), c = chantiersTous_().filter(function (x) { return x.id === id; })[0];
  if (!c) throw new Error('Chantier inconnu');
  var v = {};
  if (req.service !== undefined) v.service = Rapports.nettoyer(req.service, 60);
  if (req.actif !== undefined) v.actif = req.actif ? 1 : 0;
  if (req.fiche !== undefined) {
    var f = Rapports.nettoyer(req.fiche, 500);
    if (f && !/^https:\/\//i.test(f)) throw new Error('Le lien de la fiche doit commencer par https://');
    v.fiche = f;
  }
  if (req.suivi !== undefined) {
    if (['', 'forage', 'terrassement', 'electricite'].indexOf(String(req.suivi)) < 0) throw new Error('Suivi inconnu');
    v.suivi = String(req.suivi);
  }
  if (!Object.keys(v).length) return {};
  Store.maj('Chantiers', { id: id }, v); Store.journal('chantier_maj', u.email, id + ' ' + JSON.stringify(v));
  return {};
}
var CHANTIERS_ROUTINE_ = [['routine-electromecanique', 'Travaux de routine — Électromécanique', 'Électromécanique'], ['routine-entretien', 'Travaux de routine — Entretien', 'Travaux Entretien']];
/** Synchronise les chantiers avec les contrats « en exécution » du Suivi CPM (LECTURE SEULE du CPM) ; ajoute les chantiers de routine manquants. */
function rapportsChantiersSync_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 3);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var existants = chantiersTous_(), plan = Rapports.chantiersDepuisCpm(cpmEnregistrements_(lignesSource_('cpm')), existants, Dates.today());
    plan.ajouter.forEach(function (c) { Store.maj('Chantiers', { id: c.id }, c); });
    plan.maj.forEach(function (c) { Store.maj('Chantiers', { id: c.id }, { nom: c.nom }); });
    plan.reserves.forEach(function (x) { Store.maj('Chantiers', { id: x.id }, { phase: 'reserves', ouvert_jusqu: x.jusqu }); });
    plan.reactiver.forEach(function (id) { Store.maj('Chantiers', { id: id }, { actif: 1, phase: '', ouvert_jusqu: '' }); });
    var routines = 0;
    CHANTIERS_ROUTINE_.forEach(function (r) { if (!existants.some(function (c) { return c.id === r[0]; })) { Store.maj('Chantiers', { id: r[0] }, { id: r[0], nom: r[1], service: r[2], actif: 1, source: 'manuel', contrat: '', entreprise: '' }); routines += 1; } });
    Store.journal('chantiers_sync', u.email, plan.ajouter.length + ' ajoutés, ' + plan.maj.length + ' renommés, ' + plan.reserves.length + ' en levée des réserves, ' + plan.reactiver.length + ' réactivés, ' + routines + ' routine(s)');
    return { ajoutes: plan.ajouter.length, renommes: plan.maj.length, desactives: plan.reserves.length, reactives: plan.reactiver.length, routines: routines, total: chantiersTous_().filter(function (c) { return c.actif; }).length };
  } finally { lock.releaseLock(); }
}
/** Pages Avancement et Suivi chantier : un élément par chantier actif ayant un contrat (voir Rapports.tableau). Lecture : pilotage ou module rapports. */
function chantiersTableau_(req) {
  var u = Auth.userFromToken(req.token);
  var a = acces_(u);
  if ((a.pilotage || 0) < 1 && (a.rapports || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  return { auj: Dates.today(), chantiers: Rapports.tableau(chantiersActifs_(), cpmEnregistrements_(lignesSource_('cpm')), rapportsLus_(), Dates.today()) };
}
function rapportsSynthese_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 3);
  var auj = Dates.today(); var date = Dates.isDate(req.date) ? req.date : auj;
  return Rapports.synthese(chantiersActifs_(), rapportsLus_(), date);
}

/**
 * Rapport journalier CONSOLIDÉ : un seul par jour, enregistré (onglet « RapportsConsolides ») à partir de la synthèse du jour (niveau 3).
 * Le régénérer écrase la version précédente (la version s'incrémente) ; il reste consultable à tout moment, comme les rapports de chantier.
 */
var CONSOLIDES_ENTETES_ = ['date', 'version', 'genere_par', 'genere_le', 'nb_chantiers', 'nb_rapports', 'p1', 'p2', 'p3', 'p4'];
var CONSOLIDE_MORCEAU_ = 45000;
function consolidesLignes_() {
  var v = cpmFeuille_('RapportsConsolides', CONSOLIDES_ENTETES_).getDataRange().getValues(), h = v[0].map(String), out = [];
  for (var i = 1; i < v.length; i += 1) { if (!v[i][0]) continue; var o = { ligne: i + 1 }; h.forEach(function (c, k) { o[c] = v[i][k]; });
    o.date = jour_(o.date); if (o.genere_le instanceof Date) o.genere_le = o.genere_le.toISOString();   // Sheets a pu convertir le texte en date : on le remet en AAAA-MM-JJ
    if (o.date) out.push(o); }
  return out;   // une date peut avoir plusieurs lignes si un doublon a été créé par erreur : supprimer et lister gardent la dernière
}
function consolideDe_(o) {
  var texte = [o.p1, o.p2, o.p3, o.p4].map(function (x) { return String(x || ''); }).join('');
  var donnees = null; try { donnees = JSON.parse(texte); } catch (e) { donnees = null; }
  return { date: String(o.date), version: Number(o.version) || 1, genere_par: String(o.genere_par), genere_le: String(o.genere_le), nb_chantiers: Number(o.nb_chantiers) || 0, nb_rapports: Number(o.nb_rapports) || 0, donnees: donnees };
}
function rapportsConsolideGenerer_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 3);
  var auj = Dates.today(), date = Dates.isDate(req.date) ? req.date : auj;
  if (date > auj) throw new Error('La date ne peut pas être dans le futur');
  return consolideGenererCore_(date, Annuaire.nomAffichable(u.nom, u.email), u.email);
}
/** Enregistre (ou écrase) le consolidé d'un jour. Utilisée par le bouton et par l'envoi automatique du soir. */
function consolideGenererCore_(date, parNom, parEmail) {
  var s = Rapports.synthese(chantiersActifs_(), rapportsLus_(), date);
  var nbR = s.chantiers.reduce(function (n, c) { return n + c.rapports.length; }, 0);
  if (!nbR) throw new Error('Aucun rapport de chantier ce jour-là : rien à consolider.');
  var texte = JSON.stringify(s);
  if (texte.length > CONSOLIDE_MORCEAU_ * 4) throw new Error('Rapport consolidé trop volumineux pour être enregistré.');
  var p = ['', '', '', '']; for (var k = 0; k < 4; k += 1) p[k] = texte.slice(k * CONSOLIDE_MORCEAU_, (k + 1) * CONSOLIDE_MORCEAU_);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = cpmFeuille_('RapportsConsolides', CONSOLIDES_ENTETES_), ex = consolidesLignes_().filter(function (o) { return String(o.date) === date; }).pop();
    var version = ex ? (Number(ex.version) || 1) + 1 : 1, maintenant = new Date().toISOString();
    var ligne = [date, version, parNom, maintenant, s.chantiers.length, nbR, p[0], p[1], p[2], p[3]];
    var ligneCible = ex ? ex.ligne : sh.getLastRow() + 1;
    if (ex) {   // un doublon créé par erreur pour ce jour est absorbé : une seule ligne par date, écrasée à chaque génération
      consolidesLignes_().filter(function (o) { return o.date === date && o.ligne !== ex.ligne; }).map(function (o) { return o.ligne; }).sort(function (x, y) { return y - x; })
        .forEach(function (n) { sh.deleteRow(n); if (n < ligneCible) ligneCible -= 1; });
    }
    var cible = sh.getRange(ligneCible, 1, 1, ligne.length); cible.setNumberFormat('@'); cible.setValues([ligne]);   // texte brut : la date reste « AAAA-MM-JJ »
    Store.journal(ex ? 'consolide_regenere' : 'consolide_cree', parEmail, date + ' v' + version);
    return { consolide: consolideDe_({ date: date, version: version, genere_par: ligne[2], genere_le: maintenant, nb_chantiers: ligne[4], nb_rapports: nbR, p1: p[0], p2: p[1], p3: p[2], p4: p[3] }), remplace: !!ex };
  } finally { lock.releaseLock(); }
}
var CONSOLIDE_GROUPES_ = ['secretariat', 'chef_service', 'chef_division'];
function groupesNettoyes_(g) { var o = {}; CONSOLIDE_GROUPES_.forEach(function (k) { o[k] = !!(g && (g[k] === true || g[k] === 'true' || g[k] === 1)); }); return o; }
/** Génération, aperçu, envoi et réglage automatique du consolidé : réservés au rôle secrétariat (décision du propriétaire). */
function niveauConsolide_(u) {
  var n = niveauRapports_(u, 3);
  if (Droits.roleCanon(u.role) !== 'secretariat') throw Object.assign(new Error('L\'envoi du consolidé est réservé au secrétariat'), { code: 'DROITS' });
  return n;
}
/** Envoie par e-mail le consolidé enregistré d'un jour aux groupes choisis. Jamais appelée sans clic, ni sans l'option automatique cochée. */
function consolideEnvoyerCore_(date, groupes, parEmail, personnes, toute) {
  var c = consolidesLignes_().filter(function (o) { return String(o.date) === date; }).pop();
  var cons = c ? consolideDe_(c) : null;
  if (!cons || !cons.donnees) throw new Error('Aucun consolidé enregistré pour le ' + date + ' : générez-le d\'abord.');
  var dest = consoDestinatairesTous_(groupes, personnes, toute).map(function (b) { return b.email; });
  if (!dest.length) throw new Error('Aucun destinataire : cochez au moins un groupe ou une personne.');
  var quand = ''; try { quand = Utilities.formatDate(new Date(cons.genere_le), 'Africa/Algiers', 'dd/MM/yyyy HH:mm'); } catch (e) { quand = ''; }
  var m = Rapports.consolideMail(cons.donnees, cons.version, { genere_par: cons.genere_par, genere_le: quand }), pieces = [];
  try { pieces.push(Utilities.newBlob('<html><head><meta charset="utf-8"></head><body>' + m.html + '</body></html>', 'text/html', 'consolide.html').getAs('application/pdf').setName('Rapport-consolide-' + date + '.pdf')); } catch (e) { /* le corps du message contient déjà tout le détail */ }
  if (toute) {   // toute la division : envoi par paquets de 50 en copie cachée (les adresses ne sont pas exposées entre destinataires)
    for (var k = 0; k < dest.length; k += 50) MailApp.sendEmail({ to: parEmail, bcc: dest.slice(k, k + 50).join(','), name: 'Division Infrastructure RNS', subject: m.sujet, htmlBody: m.html, attachments: pieces });
  } else MailApp.sendEmail({ to: dest.join(','), name: 'Division Infrastructure RNS', subject: m.sujet, htmlBody: m.html, attachments: pieces });
  Store.journal('consolide_envoye', parEmail, date + ' v' + cons.version + ' → ' + dest.length + ' destinataire(s)' + (toute ? ' [TOUTE LA DIVISION]' : ''));
  return { destinataires: dest.length, version: cons.version };
}
/** Personnes (comptes actifs avec e-mail : secrétariat, chefs de service, chef de division) proposées à cocher en plus des boîtes. */
function consoPersonnesListe_() {
  var lib = { secretariat: 'Secrétariat', chef_service: 'Chef de service', interim_chef_service: 'Chef de service (intérim)', chef_division: 'Chef de division' };
  return Rapports.destinatairesDetail(Store.table('Utilisateurs'), { secretariat: true, chef_service: true, chef_division: true }).map(function (d) {
    return { nom: Annuaire.nomAffichable(d.nom, d.email), email: d.email, role: lib[d.role] || d.role, service: d.service };
  });
}
function personnesNettoyees_(l) { var o = [], vus = {}; (Array.isArray(l) ? l : []).forEach(function (e) { e = String(e || '').toLowerCase().trim(); if (e && e.length <= 120 && !vus[e]) { vus[e] = 1; o.push(e); } }); return o.slice(0, 60); }
/** Boîtes des groupes cochés + personnes cochées (seulement celles qui sont bien dans la liste des comptes proposés : jamais une adresse libre). */
function consoDestinatairesTous_(groupes, personnes, toute) {
  var out = Rapports.boitesDestinataires(groupes), vus = {}; out.forEach(function (b) { vus[b.email] = 1; });
  if (toute) Rapports.tousLesComptes(Store.table('Utilisateurs')).forEach(function (d) { if (!vus[d.email]) { vus[d.email] = 1; out.push({ nom: Annuaire.nomAffichable(d.nom, d.email), email: d.email, role: d.role, libelle: d.role + (d.service ? ', ' + d.service : '') }); } });
  var voulues = personnesNettoyees_(personnes);
  if (voulues.length) consoPersonnesListe_().forEach(function (p) { if (voulues.indexOf(p.email) >= 0 && !vus[p.email]) { vus[p.email] = 1; out.push({ nom: p.nom, email: p.email, role: p.role, libelle: p.role }); } });
  return out;
}
function consoPersonnes_(req) { var u = Auth.userFromToken(req.token); niveauConsolide_(u); return { personnes: consoPersonnesListe_() }; }
/** Qui recevrait le consolidé avec les groupes cochés (aperçu, rien n'est envoyé). */
function consoDestinataires_(req) {
  var u = Auth.userFromToken(req.token); niveauConsolide_(u);
  var l = consoDestinatairesTous_(groupesNettoyes_(req.groupes), req.personnes, req.toute_division === true).map(function (b) { return { nom: b.nom, email: b.email, role: b.libelle }; });
  return { destinataires: l };
}
function rapportsConsolideEnvoyer_(req) {
  var u = Auth.userFromToken(req.token); niveauConsolide_(u);
  var date = String(req.date || ''); if (!Dates.isDate(date)) throw new Error('Date invalide');
  return consolideEnvoyerCore_(date, groupesNettoyes_(req.groupes), u.email, req.personnes, req.toute_division === true);
}
// ----- Envoi automatique du soir (option cochée dans Rapports journaliers ; désactivée par défaut)
function consoAutoConfig_() {
  var c = {}; try { c = JSON.parse(PropertiesService.getScriptProperties().getProperty('CONSO_AUTO') || '{}'); } catch (e) { c = {}; }
  var h = Number(c.heure); return { actif: !!c.actif, heure: h >= 0 && h <= 23 && Math.floor(h) === h ? h : 20, groupes: groupesNettoyes_(c.groupes), dernier: String(c.dernier || ''), essai: String(c.essai || ''), erreur: String(c.erreur || ''), personnes: personnesNettoyees_(c.personnes) };
}
function consoAutoEnregistrer_(c) { PropertiesService.getScriptProperties().setProperty('CONSO_AUTO', JSON.stringify(c)); }
/** Le déclencheur du soir doit exister (toutes les 15 minutes) tant que l'envoi automatique est coché ; recréé s'il a disparu ou s'il date de l'ancienne version (toutes les heures). */
function consoAutoAssurerDeclencheur_(force) {
  var cache = CacheService.getScriptCache(); if (!force && cache.get('CONSO_TRIG_OK')) return false;   // vérifié il y a moins d'une demi-heure
  var props = PropertiesService.getScriptProperties(), c = consoAutoConfig_(), presentes = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'consoAutoTick'; });
  if (!c.actif) { presentes.forEach(function (t) { ScriptApp.deleteTrigger(t); }); cache.put('CONSO_TRIG_OK', '1', 1800); return false; }
  if (presentes.length === 1 && props.getProperty('CONSO_TRIG_V2') === '1') { cache.put('CONSO_TRIG_OK', '1', 1800); return false; }
  presentes.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('consoAutoTick').timeBased().everyMinutes(15).create(); props.setProperty('CONSO_TRIG_V2', '1'); cache.put('CONSO_TRIG_OK', '1', 1800);
  return true;
}
function consoAutoLire_(req) {
  var u = Auth.userFromToken(req.token); niveauConsolide_(u);
  try { if (consoAutoAssurerDeclencheur_(true)) Store.journal('consolide_auto_declencheur', u.email, 'déclencheur recréé'); } catch (e) { /* lecture seule si l'autorisation manque */ }
  return consoAutoConfig_();
}
function consoAutoMaj_(req) {
  var u = Auth.userFromToken(req.token); niveauConsolide_(u);
  var h = Number(req.heure); if (!(h >= 0 && h <= 23) || Math.floor(h) !== h) throw new Error('Heure : nombre entier de 0 à 23');
  var ancien = consoAutoConfig_(), c = { actif: !!req.actif, heure: h, groupes: groupesNettoyes_(req.groupes), personnes: personnesNettoyees_(req.personnes), dernier: ancien.dernier, essai: '', erreur: '' };
  if (c.actif && !CONSOLIDE_GROUPES_.some(function (k) { return c.groupes[k]; }) && !c.personnes.length) throw new Error('Cochez au moins un destinataire pour l\'envoi automatique.');
  consoAutoEnregistrer_(c);
  consoAutoAssurerDeclencheur_(true);
  Store.journal('consolide_auto_maj', u.email, (c.actif ? 'activé à ' + c.heure + ' h' : 'désactivé'));
  return consoAutoConfig_();
}
/** Déclencheur (toutes les 15 min) : à partir de l'heure réglée, une seule fois par jour, génère (écrase) le consolidé du jour et l'envoie. Sans rapport ce jour-là, rien n'est envoyé. Chaque échec est noté (journal + réglage affiché dans Rapports journaliers). */
function consoAutoTick() {
  var c = consoAutoConfig_(); if (!c.actif) return;
  var auj = Dates.today(), heure = Number(Utilities.formatDate(new Date(), 'Africa/Algiers', 'H'));
  if (heure < c.heure || c.dernier === auj) return;
  var maintenant = Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy-MM-dd HH:mm');
  var r; try { r = consolideGenererCore_(auj, 'Envoi automatique', ''); } catch (e) { c.essai = maintenant; c.erreur = 'Génération : ' + e.message; consoAutoEnregistrer_(c); Store.journal('consolide_auto_echec', 'auto', c.erreur); return; }
  try { consolideEnvoyerCore_(auj, c.groupes, 'auto', c.personnes); } catch (e2) { c.essai = maintenant; c.erreur = 'Envoi : ' + e2.message; consoAutoEnregistrer_(c); Store.journal('consolide_auto_echec', 'auto', c.erreur); return; }
  c.dernier = auj; c.essai = maintenant; c.erreur = ''; consoAutoEnregistrer_(c);
}
function rapportsConsolideLire_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 3);
  var date = String(req.date || ''); if (!Dates.isDate(date)) throw new Error('Date invalide');
  var ex = consolidesLignes_().filter(function (o) { return String(o.date) === date; }).pop();
  return { consolide: ex ? consolideDe_(ex) : null };
}
function rapportsConsolidesListe_(req) {
  var u = Auth.userFromToken(req.token); niveauRapports_(u, 3);
  var vus = {};
  var l = consolidesLignes_().filter(function (o) { var d = o.date; vus[d] = o; return true; }).filter(function (o) { return vus[o.date] === o; }).map(function (o) { return { date: String(o.date), version: Number(o.version) || 1, genere_par: String(o.genere_par), genere_le: String(o.genere_le), nb_chantiers: Number(o.nb_chantiers) || 0, nb_rapports: Number(o.nb_rapports) || 0 }; });
  l.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return { consolides: l.slice(0, 90) };
}

/**
 * L'agent complète lui-même sa fiche (matricule, matricule SAP, NIN). Une valeur DÉJÀ renseignée n'est jamais écrasée :
 * pour la corriger, il passe par le secrétariat. Le NIN n'est jamais renvoyé en entier ni écrit dans le journal.
 */
function profilEnregistrer_(req) {
  var u = Auth.userFromToken(req.token);
  var regles = { matricule: /^[A-Za-z0-9\-]{3,15}$/, sap: /^[A-Za-z0-9\-]{3,15}$/, nin: /^\d{18}$/ };
  var noms = { matricule: 'Matricule', sap: 'Matricule SAP', nin: 'NIN (18 chiffres)' };
  var champs = {}, faits = [];
  Object.keys(regles).forEach(function (k) {
    var v = String(req[k] == null ? '' : req[k]).replace(/\s+/g, '');
    if (!v) return;
    if (String(u[k] || '').trim()) return; // déjà renseigné : on ne touche pas
    if (!regles[k].test(v)) throw new Error(noms[k] + ' : format invalide.');
    champs[k] = v; faits.push(k);
  });
  if (!faits.length) throw new Error('Rien à enregistrer : ces champs sont déjà renseignés (pour les corriger, contactez le secrétariat).');
  Store.maj('Utilisateurs', { email: u.email }, champs);
  Store.journal('profil', u.email, 'champs renseignés : ' + faits.join(', '));
  var versOrga = {}; faits.forEach(function (k) { versOrga[k] = champs[k]; });
  try { var n = ecrireDansBddorga_(u.email, versOrga); Store.journal('profil_bddorga', u.email, n + ' cellule(s) écrite(s) dans BDDORGA'); }
  catch (err) { Store.journal('profil_bddorga_echec', u.email, String(err.message || err)); } // l'agent n'est pas bloqué : la valeur est déjà dans la passerelle
  return { user: pubUser_(Store.utilisateur(u.email)) };
}

// ----- Organisation du menu (catégories et ordre des applications) : réservée au rôle secrétariat ; ne change aucun droit, seulement le rangement affiché (barre latérale ET cartes de l'accueil)
var RUBRIQUES_ENTETES_ = ['id', 'titre', 'icone', 'ordre'];
/** Catégories choisies par le secrétariat, dans l'ordre : [{ id, titre, icone }] ; vide tant que rien n'a été organisé (le portail utilise alors ses catégories d'origine). */
function orgRubriques_() {
  try {
    return Store.table('Rubriques').filter(function (x) { return x.id && x.titre; })
      .sort(function (a, b) { return (Number(a.ordre) || 0) - (Number(b.ordre) || 0); })
      .map(function (x) { return { id: String(x.id), titre: String(x.titre), icone: String(x.icone || '📁') }; });
  } catch (e) { return []; }   // onglet pas encore créé
}
/** Rôle secrétariat, ou plein pouvoir (module Sécurité niveau 3 : gestion des privilèges). */
function peutOrganiser_(u) { return Droits.roleCanon(u.role) === 'secretariat' || (acces_(u).securite || 0) >= 3; }
function menuOrgSecretariat_(req) {
  var u = Auth.userFromToken(req.token);
  if (!peutOrganiser_(u)) throw Object.assign(new Error('L\'organisation du menu est réservée au secrétariat'), { code: 'DROITS' });
  return u;
}
function menuOrgLire_(req) {
  menuOrgSecretariat_(req); assurerColonnes_('Applications', ['rubrique', 'ordre', 'actif', 'vision']);
  var mods = {}; Store.table('Modules').forEach(function (m) { mods[String(m.id).toLowerCase()] = m.titre; });
  var niveaux = Object.keys(Droits.RANGS).sort(function (x, y) { return Droits.RANGS[x] - Droits.RANGS[y]; }).map(function (id) { return { id: id, rang: Droits.RANGS[id], nom: Droits.LIBELLES_RANGS[id] || id }; });
  return { niveaux: niveaux, rangs: Droits.RANGS, rubriques: orgRubriques_(), apps: Store.table('Applications').filter(function (x) { return x.titre; }).map(function (x) {
    return { module: x.module, module_titre: mods[String(x.module).toLowerCase()] || x.module, titre: x.titre, description: x.description, emoji: x.emoji, url: x.url, rubrique: String(x.rubrique || ''), actif: String(x.actif) === '0' ? 0 : 1, vision: Droits.visionDe(x.vision), ordre: x.ordre === '' || x.ordre == null || isNaN(Number(x.ordre)) ? '' : Number(x.ordre) }; }) };
}
function menuOrgEnregistrer_(req) {
  var u = menuOrgSecretariat_(req); assurerColonnes_('Applications', ['rubrique', 'ordre', 'actif', 'vision']);
  var cats = Array.isArray(req.rubriques) ? req.rubriques : [], apps = Array.isArray(req.apps) ? req.apps : [];
  if (cats.length > 30) throw new Error('30 catégories au plus');
  var ids = {}, propres = cats.map(function (c, i) {
    var id = String(c.id || '').toLowerCase(), titre = Rapports.nettoyer(c.titre, 40), icone = Rapports.nettoyer(c.icone, 8) || '📁';
    if (!/^[a-z0-9][a-z0-9_-]{1,29}$/.test(id)) throw new Error('Identifiant de catégorie invalide');
    if (titre.length < 2 || /^[=+@\-]/.test(titre)) throw new Error('Nom de catégorie invalide (2 caractères au moins)');
    if (ids[id]) throw new Error('Catégorie en double : ' + titre); ids[id] = 1;
    return [id, titre, icone, i + 1];
  });
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = cpmFeuille_('Rubriques', RUBRIQUES_ENTETES_);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
    if (propres.length) { var z = sh.getRange(2, 1, propres.length, 4); z.setNumberFormat('@'); z.setValues(propres.map(function (l) { return l.map(String); })); }
    var ap = SpreadsheetApp.openById(prop_('DB_ID')).getSheetByName('Applications'), v = ap.getDataRange().getValues(), h = v[0].map(String), iT = h.indexOf('titre'), iR = h.indexOf('rubrique'), iO = h.indexOf('ordre'), iA = h.indexOf('actif'), iV = h.indexOf('vision');
    if (iT < 0 || iR < 0 || iO < 0 || iA < 0 || iV < 0) throw new Error('Colonnes « rubrique » / « ordre » / « actif » / « vision » introuvables dans Applications');
    var voulu = {}; apps.forEach(function (a) { var rb = String(a.rubrique || ''); if (rb && !ids[rb]) throw new Error('Une application est rangée dans une catégorie inconnue'); voulu[String(a.titre)] = { rubrique: rb, ordre: Number(a.ordre) || '', actif: a.actif === 0 || a.actif === '0' || a.actif === false ? 0 : 1, vision: a.vision === undefined ? undefined : Droits.visionDe(a.vision) }; });
    var colR = [], colO = [], colA = [], colV = [], n = 0;
    for (var i = 1; i < v.length; i += 1) { var w = voulu[String(v[i][iT])]; if (w) { colR.push([w.actif ? w.rubrique : '']); colO.push([w.ordre]); colA.push([w.actif]); colV.push([w.vision === undefined ? v[i][iV] : (w.vision === null ? '' : w.vision)]); n += 1; } else { colR.push([v[i][iR]]); colO.push([v[i][iO]]); colA.push([v[i][iA]]); colV.push([v[i][iV]]); } }
    if (v.length > 1) { ap.getRange(2, iR + 1, v.length - 1, 1).setValues(colR); ap.getRange(2, iO + 1, v.length - 1, 1).setValues(colO); ap.getRange(2, iA + 1, v.length - 1, 1).setValues(colA); ap.getRange(2, iV + 1, v.length - 1, 1).setValues(colV); }
    ['TBL_Applications', 'TBL_Rubriques'].forEach(function (k) { try { CacheService.getScriptCache().remove(k); } catch (e) { /* rien */ } });
    Store.journal('menu_organise', u.email, propres.length + ' catégories, ' + n + ' applications rangées');
    return { categories: propres.length, applications: n };
  } finally { lock.releaseLock(); }
}
