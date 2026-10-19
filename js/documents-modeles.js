/**
 * Documents administratifs de la Direction Régionale Rhourde Nouss : modèles de formulaires + mise en page imprimable.
 * Sans dépendance ni DOM (testable avec Node). Un modèle = { id, titre, categorie, champs, html(v, h) }.
 * Les cases vides s'impriment en pointillés pour pouvoir être complétées à la main.
 */
(function (racine) {
  var CATEGORIES = [
    { id: 'missions', titre: 'Missions & déplacements', emoji: '✈️' },
    { id: 'prets', titre: 'Prêts & avances', emoji: '💰' },
    { id: 'carriere', titre: 'Carrière & mutations', emoji: '🧭' },
    { id: 'primes', titre: 'Indemnités & primes', emoji: '🏷️' },
    { id: 'discipline', titre: 'Discipline', emoji: '⚖️' },
    { id: 'divers', titre: 'Attestations & divers', emoji: '📄' },
    { id: 'autres', titre: 'Autres modèles (hors dossier « Imprimés »)', emoji: '📎' }
  ];

  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function frDate(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || ''); }
  function jourIso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function ecart(a, b) { var x = Date.parse(a + 'T00:00:00Z'), y = Date.parse(b + 'T00:00:00Z'); return isNaN(x) || isNaN(y) ? null : Math.round((y - x) / 864e5); }
  function plus(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  /* ---------- champs communs (clé → définition) ---------- */
  var L = {
    date: { k: 'date', l: 'Date du document', t: 'date', def: 'aujourdhui' },
    agent: { k: 'agent', l: 'Nom et prénom', def: 'user.nom', pers: { matricule: 'matricule', fonction: 'fonction', service: ['service', 'structure'] } },
    matricule: { k: 'matricule', l: 'Matricule', def: 'user.matricule' },
    fonction: { k: 'fonction', l: 'Fonction', def: 'user.fonction' },
    echelle: { k: 'echelle', l: 'Échelle' },
    structure: { k: 'structure', l: 'Structure d\'affectation', def: 'user.service' },
    service: { k: 'service', l: 'Service', def: 'user.service' },
    division: { k: 'division', l: 'Division', def: 'Infrastructure' },
    recrutement: { k: 'recrutement', l: 'Date de recrutement', t: 'date', def: 'user.date_integration' },
    naissance: { k: 'naissance', l: 'Date de naissance', t: 'date' },
    chef: { k: 'chef', l: 'Chef de division (nom, facultatif)' }
  };

  /* ---------- éléments de mise en page ---------- */
  var PT = '<span class="pt">…………………………</span>';
  function pts(n) { var s = ''; for (var i = 0; i < n; i += 1) s += '…'; return '<span class="pt">' + s + '</span>'; }
  function lignesVides(n) { var s = ''; for (var i = 0; i < n; i += 1) s += '<div class="ligne-pt"></div>'; return s; }
  function V(v, k, n) { var x = v[k]; return x == null || String(x).trim() === '' ? pts(n || 18) : '<span class="val">' + (/^\d{4}-\d{2}-\d{2}$/.test(String(x)) ? frDate(x) : E(x)) + '</span>'; }
  function T(v, k, nl) { var x = String(v[k] == null ? '' : v[k]).trim(); return x ? '<span class="val">' + E(x).replace(/\n/g, '<br>') + '</span>' : lignesVides(nl || 3); }
  function P(h, cls) { return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + h + '</p>'; }
  function KV(rows) { return '<table class="kv">' + rows.map(function (r) { return '<tr><th>' + E(r[0]) + '</th><td>' + r[1] + '</td></tr>'; }).join('') + '</table>'; }
  function GRILLE(entetes, lignes) {
    return '<table class="tgr"><thead><tr>' + entetes.map(function (e) { return '<th>' + E(e) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      lignes.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function visas(titres, haut) { return '<table class="visas"><tr>' + titres.map(function (t) { return '<th>' + E(t) + '</th>'; }).join('') + '</tr><tr>' + titres.map(function () { return '<td style="height:' + (haut || 70) + 'px"></td>'; }).join('') + '</tr></table>'; }
  function CADRE(titre, interieur) { return '<div class="cadre"><div class="cadre-t">' + E(titre) + '</div>' + (interieur || '') + '</div>'; }
  function CASES(libelles) { return libelles.map(function (x) { return '<span class="case-c">☐ ' + E(x) + '</span>'; }).join(' '); }
  function titre(t, sous) { return '<h2 class="doc-titre">' + E(t) + '</h2>' + (sous ? '<div class="doc-sous">' + sous + '</div>' : ''); }
  function lieuDate(v) { return '<div class="droite">Rhourde Nouss, le : ' + V(v, 'date', 10) + '</div>'; }
  function signature(libelle, v, k) { return '<div class="sign"><b>' + E(libelle) + (k && v[k] ? '<br><span class="val">' + E(v[k]) + '</span>' : '') + '</b></div>'; }
  function avisDirecteur() { return visas(['Avis du Chef de Division Personnel', 'Décision du Directeur Régional'], 90); }
  function ligneIdentite(v) { return KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Structure', V(v, 'structure')]]); }

  /** En-têtes : « dr » (Direction Régionale), « dag » (Direction Générale / Affaires Sociales / RH). */
  function entete(type, v) {
    var g = type === 'dag'
      ? '<b>Ressources Humaines</b><br>Direction Affaires Sociales'
      : '<b>Activité Exploration - Production</b><br><b>Division Production</b><br>Direction Régionale Rhourde Nouss' + (v && v.entete_division ? '<br>' + E(v.entete_division) : '');
    return '<div class="entete"><img class="logo" src="@LOGO@" alt="Sonatrach"><div class="entete-t">' + g + '</div></div>';
  }

  /* ---------- modèles ---------- */
  var M = [];
  function modele(id, categorie, titreM, desc, champs, entetes, html) { M.push({ id: id, categorie: categorie, titre: titreM, description: desc, champs: champs, entete: entetes, html: html }); }
  var AVIS_FD = function (qui, v) { return '<div class="avis"><b>' + E(qui) + '</b><br>' + CASES(['Favorable', 'Défavorable']) + '<br><span class="pt-s">RNS, le : ' + pts(10) + '</span></div>'; };

  modele('odm', 'autres', 'Ordre de mission', 'Autorise un agent à se déplacer (objet, dates, trajet, moyen de transport).',
    [{ k: 'ref', l: 'Référence (N° …/SH/E&P/PROD/RNS-INFRA)', def: 'SH/E&P/PROD/RNS-INFRA/{annee}' }, { k: 'numero', l: 'Numéro d\'ordre' }, L.date, L.agent, L.fonction,
      { k: 'objet', l: 'Objet de la mission', t: 'textarea' }, { k: 'depart', l: 'Date de départ', t: 'date' }, { k: 'retour', l: 'Date de retour', t: 'date' },
      { k: 'trajet', l: 'Trajet à effectuer', def: 'RNS - ALGER - RNS' }, { k: 'accompagne', l: 'Accompagné de', def: '/' },
      { k: 'transport', l: 'Moyen de transport', t: 'select', opts: ['Avion', 'Véhicule de service', 'Véhicule personnel', 'Train', 'Autre'] },
      { k: 'signataire', l: 'Signataire', def: 'P/Le Chef de Division Infrastructures' }], 'dr',
    function (v) {
      return titre('ORDRE DE MISSION') + '<div class="deux"><div>N° ' + V(v, 'ref', 14) + '</div><div class="droite">Rhourde Nouss : ' + V(v, 'date', 10) + '</div></div>' +
        P('Numéro : ' + V(v, 'numero', 6)) +
        KV([['NOM & PRÉNOM', V(v, 'agent')], ['FONCTION', V(v, 'fonction')], ['OBJET', T(v, 'objet', 2)], ['DATE DÉPART', V(v, 'depart')], ['DATE RETOUR', V(v, 'retour')],
          ['TRAJET À EFFECTUER', V(v, 'trajet')], ['ACCOMPAGNÉ', V(v, 'accompagne', 6)], ['MOYEN TRANSPORT', V(v, 'transport')]]) + signature(v.signataire || 'Le Chef de Division', v);
    });

  modele('demande-mission', 'missions', 'Demande de mission', 'Demande au Directeur Régional d\'autoriser une mission de travail.',
    [L.date, L.division, L.agent, L.matricule, L.fonction, { k: 'objet', l: 'Objet détaillé de la mission', t: 'textarea' }, { k: 'depart', l: 'Date de départ', t: 'date' },
      { k: 'fin', l: 'Date prévue de fin', t: 'date' }, { k: 'itineraire', l: 'Itinéraire' }, { k: 'moyens', l: 'Moyens à utiliser' }], 'dr',
    function (v) {
      return '<div class="deux"><div></div><div class="droite">RNS, le : ' + V(v, 'date', 10) + '</div></div>' + P('Division : <b>' + E(v.division || '') + '</b>') +
        P('Monsieur le Directeur Régional,', 'droite') + titre('Demande de mission') + P('Monsieur le Directeur,') +
        P('Nous vous demandons de bien vouloir accorder le déplacement pour une mission de travail pour :') +
        KV([['Nom & prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Division', V(v, 'division')], ['Objet détaillé de la mission', T(v, 'objet', 3)],
          ['Date de départ en mission', V(v, 'depart')], ['Date prévue de fin de mission', V(v, 'fin')], ['Itinéraire', V(v, 'itineraire')], ['Moyens à utiliser', V(v, 'moyens')]]) +
        visas(['Le Chef de Division ' + (v.division || ''), 'Décision du Directeur Régional'], 90);
    });

  modele('compte-rendu-mission', 'missions', 'Compte rendu de mission', 'Déroulement jour par jour (hébergement, repas avec / sans prise en charge).',
    [{ k: 'odm', l: 'Ordre de mission N°' }, { k: 'odm_date', l: 'du', t: 'date' }, L.agent, L.matricule, L.fonction, L.structure, { k: 'objet', l: 'Objet de la mission', t: 'textarea' }, { k: 'itineraire', l: 'Itinéraire' },
      { k: 'dep_date', l: 'Départ : date', t: 'date' }, { k: 'dep_heure', l: 'Départ : heure' }, { k: 'arr_date', l: 'Arrivée : date', t: 'date' }, { k: 'arr_heure', l: 'Arrivée : heure' },
      { k: 'jours', l: 'Déroulement de la mission', t: 'repeat', colonnes: [{ k: 'date', l: 'Date', t: 'date' }, { k: 'detail', l: 'Détail de la mission' },
        { k: 'heb', l: 'Hébergement', t: 'select', opts: ['', 'Avec prise en charge', 'Sans prise en charge'] }, { k: 'dej', l: 'Déjeuner', t: 'select', opts: ['', 'Avec prise en charge', 'Sans prise en charge'] },
        { k: 'din', l: 'Dîner', t: 'select', opts: ['', 'Avec prise en charge', 'Sans prise en charge'] }],
        generer: function (v) {
          var d0 = v.dep_date, d1 = v.retour_date || v.fin_date; if (!d0 || !d1) return [];
          var n = ecart(d0, d1); if (n == null || n < 0 || n > 60) return []; var r = [];
          for (var i = 0; i <= n; i += 1) r.push({ date: plus(d0, i), detail: i === 0 ? 'Départ du domicile' : i === n ? 'Retour vers le domicile' : 'Jour ' + i + ' de la mission', heb: '', dej: '', din: '' });
          return r;
        } },
      { k: 'fin_date', l: 'Fin de mission : départ le', t: 'date' }, { k: 'fin_heure', l: 'à (heure)' }, { k: 'retour_date', l: 'Fin de mission : arrivée le', t: 'date' }, { k: 'retour_heure', l: 'à (heure)' },
      { k: 'transport_aller', l: 'Transport à l\'aller', def: 'Véhicule personnel' }, { k: 'transport_retour', l: 'Transport au retour', def: 'Véhicule personnel' }], 'dr',
    function (v) {
      var cases = function (x) { return [x === 'Avec prise en charge' ? 'x' : '', x === 'Sans prise en charge' ? 'x' : '']; };
      var lignes = (v.jours || []).map(function (j) { var a = cases(j.heb), b = cases(j.dej), c = cases(j.din); return [E(frDate(j.date)), E(j.detail || ''), a[0], a[1], b[0], b[1], c[0], c[1]]; });
      if (!lignes.length) for (var i = 0; i < 4; i += 1) lignes.push(['', '', '', '', '', '', '', '']);
      return titre('COMPTE RENDU DE MISSION') + '<div class="deux"><div></div><div class="droite">Ordre de Mission N° ' + V(v, 'odm', 8) + ' du ' + V(v, 'odm_date', 10) + '</div></div>' +
        KV([['Matricule', V(v, 'matricule')], ['Nom & prénoms', V(v, 'agent')], ['Fonction', V(v, 'fonction')], ['Structure', V(v, 'structure')], ['Objet de mission', T(v, 'objet', 2)], ['Itinéraire', V(v, 'itineraire')]]) +
        P('<b>Début de mission :</b> départ du lieu de résidence ou du lieu de travail habituel le ' + V(v, 'dep_date', 10) + ' à ' + V(v, 'dep_heure', 6) + ' ; arrivée au lieu de la mission le ' + V(v, 'arr_date', 10) + ' à ' + V(v, 'arr_heure', 6)) +
        '<table class="tgr serre"><colgroup><col style="width:16%"><col style="width:28%"><col span="6" style="width:9.33%"></colgroup><thead><tr><th rowspan="2">Date</th><th rowspan="2">Détail de la mission</th><th colspan="2">Hébergement</th><th colspan="2">Déjeuner</th><th colspan="2">Dîner</th></tr><tr>' +
        '<th>Avec PEC</th><th>Sans PEC</th><th>Avec PEC</th><th>Sans PEC</th><th>Avec PEC</th><th>Sans PEC</th></tr></thead><tbody>' + lignes.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (i > 1 ? ' class="c"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>' +
        P('<b>Fin de mission :</b> départ du lieu de la mission le ' + V(v, 'fin_date', 10) + ' à ' + V(v, 'fin_heure', 6) + ' ; arrivée au lieu de résidence ou de travail habituel le ' + V(v, 'retour_date', 10) + ' à ' + V(v, 'retour_heure', 6)) +
        P('<b>Moyens de transport utilisés :</b> à l\'aller : ' + V(v, 'transport_aller', 12) + ' — au retour : ' + V(v, 'transport_retour', 12)) +
        visas(['Visa du missionnaire', 'Le Responsable (signataire de l\'ordre de mission)'], 80) +
        P('Réf. CCE : articles 106 à 113. Rappel art. 113 : « le travailleur bénéficie des frais de restauration dès lors qu\'il se trouve éloigné de sa résidence ou de son lieu de travail habituel pendant les périodes comprises entre 11 h et 14 h, 18 h et 21 h. Il bénéficie des frais d\'hébergement lorsqu\'il se trouve éloigné de sa résidence habituelle entre 23 h et 6 h du matin. »', 'note');
    });

  modele('hotel', 'autres', 'Demande de prise en charge hôtel', 'Demande de prise en charge d\'hébergement pendant une mission.',
    [L.date, { k: 'ref', l: 'Référence', def: 'SH/E&P/PROD/RNS-INFRA/{annee}' }, { k: 'ville', l: 'Hôtel à (ville)', def: 'Alger' }, { k: 'odm_ref', l: 'Réf. ODM' }, L.agent, L.fonction, L.matricule,
      { k: 'odm', l: 'N° Ordre de mission' }, { k: 'du', l: 'Du', t: 'date' }, { k: 'au', l: 'Au', t: 'date' }, { k: 'nuitees', l: 'Nombre de nuitées (calculé si vide)', t: 'number' }, { k: 'lieu', l: 'Lieu de mission' },
      { k: 'objet', l: 'Objet précis de la mission', t: 'textarea' }, { k: 'imputation', l: 'Imputation' }], 'dr',
    function (v) {
      var n = v.nuitees || (v.du && v.au && ecart(v.du, v.au) > 0 ? ecart(v.du, v.au) : '');
      return '<div class="deux"><div><b>Division Infrastructure</b></div><div class="droite">Rhourde Nouss : ' + V(v, 'date', 10) + '</div></div>' + P('N° ' + V(v, 'ref', 14)) +
        P('<b>Objet :</b> Demande de prise en charge hôtel à ' + V(v, 'ville', 10) + '<br>Réf. : ODM ' + V(v, 'odm_ref', 8)) +
        KV([['Nom', V(v, 'agent')], ['Fonction', V(v, 'fonction')], ['Matricule', V(v, 'matricule')], ['N° ordre de mission', V(v, 'odm', 8)], ['Du / Au', V(v, 'du') + ' &nbsp;→&nbsp; ' + V(v, 'au')],
          ['Nombre de nuitées', n === '' ? pts(4) : '<span class="val">' + E(n) + '</span>'], ['Lieu de mission', V(v, 'lieu')], ['Objet précis de la mission', T(v, 'objet', 3)], ['Imputation', V(v, 'imputation', 10)]]) + signature('Le Directeur Régional', v);
    });

  modele('reservation', 'autres', 'Demande de réservation (vol)', 'Demande de réservation d\'une place sur un vol.',
    [L.date, { k: 'ref', l: 'Référence', def: 'SH/E&P/PROD/RNS-INFRA/{annee}' }, { k: 'sens', l: 'Vol', t: 'select', opts: ['Aller', 'Retour'] }, { k: 'trajet', l: 'Trajet', def: 'RNS → ' },
      { k: 'jour', l: 'Date du vol', t: 'date' }, { k: 'passager', l: 'Au profit de (nom et prénom)', pers: {} }, { k: 'places', l: 'Nombre de places', t: 'number', def: '1' }, { k: 'signataire', l: 'Signataire', def: 'P/Le Chef de Division Infrastructures' }], 'dr',
    function (v) {
      return '<div class="deux"><div><b>Division Infrastructure</b></div><div class="droite">Rhourde Nouss : ' + V(v, 'date', 10) + '</div></div>' + P('N° ' + V(v, 'ref', 14)) + P('<b>Objet :</b> Demande de réservation') +
        P('Nous vous demandons de bien vouloir nous signifier votre accord pour réserver (' + V(v, 'places', 2) + ') place(s) sur le vol <b>' + E((v.sens || 'retour').toLowerCase()) + '</b> suivant :') +
        P('<b>' + (v.trajet ? E(v.trajet) : pts(14)) + '</b> le ' + V(v, 'jour', 10) + ', au profit de Monsieur / Madame :', 'centre') + P('<b>' + (v.passager ? E(v.passager) : pts(24)) + '</b>', 'centre') + P('Meilleures salutations.') + signature(v.signataire || '', v);
    });

  modele('bordereau', 'autres', 'Bordereau d\'envoi', 'Transmission de pièces avec accusé de réception.',
    [L.date, { k: 'destinataire', l: 'Destinataire' }, { k: 'lignes', l: 'Désignations', t: 'repeat', colonnes: [{ k: 'des', l: 'Désignation' }, { k: 'nbr', l: 'Nbr', t: 'number' }, { k: 'obs', l: 'Observations' }] }], 'dr',
    function (v) {
      var l = (v.lignes || []).map(function (x) { return [E(x.des), E(x.nbr), E(x.obs)]; }); while (l.length < 5) l.push(['', '', '']);
      return '<div class="centre"><b>Division Infrastructure</b></div>' + titre('BORDEREAU D\'ENVOI') + P('Date : ' + V(v, 'date', 10)) + P('Destinataire : ' + V(v, 'destinataire', 24)) + GRILLE(['DÉSIGNATIONS', 'NBR', 'OBSERVATIONS'], l) +
        visas(['Reçu le', 'Signature'], 60) + P('Prière nous retourner le deuxième exemplaire.', 'note');
    });

  modele('convocation', 'autres', 'Convocation visite médicale', 'Convoque un ou plusieurs agents à la visite médicale périodique.',
    [L.date, { k: 'jour', l: 'Date de la visite', t: 'date' }, { k: 'lieu', l: 'Lieu', def: 'CMT - Base de vie Centrale' }, { k: 'personnes', l: 'Agents convoqués', t: 'repeat', colonnes: [{ k: 'nom', l: 'Nom et prénom', pers: { matricule: 'mle', fonction: 'fonction' } }, { k: 'mle', l: 'Matricule' }, { k: 'fonction', l: 'Fonction' }] }], 'dr',
    function (v) {
      var l = (v.personnes || []).map(function (x) { return [E(x.nom), E(x.mle), E(x.fonction)]; }); while (l.length < 3) l.push(['', '', '']);
      return lieuDate(v) + titre('CONVOCATION') + GRILLE(['Nom et prénom', 'Matricule', 'Fonction'], l) + P('Vous êtes prié(e) de vous présenter au <b>' + (v.lieu ? E(v.lieu) : pts(14)) + '</b> pour subir la visite médicale périodique le : <b>' + V(v, 'jour', 10) + '</b>.') +
        P('NB : le refus de se présenter à cette visite médicale est assimilé à une faute professionnelle (article n° 43 du Règlement Intérieur).', 'note') + signature('Le Chef de Division', v);
    });

  modele('attestation', 'divers', 'Demande d\'attestation de travail', 'Adressée à la Division Personnel (Service Gestion / Paie).',
    [L.date, L.matricule, L.agent, L.fonction, { k: 'division', l: 'Division', def: 'Infrastructure' }, { k: 'copies', l: 'Nombre de copies', t: 'number', def: '1' }], 'dr',
    function (v) { return P('Division Personnel<br>Service Gestion / Paie', 'droite') + titre('DEMANDE D\'ATTESTATION DE TRAVAIL') + KV([['Matricule', V(v, 'matricule')], ['Nom et prénom', V(v, 'agent')], ['Fonction actuelle', V(v, 'fonction')], ['Division', V(v, 'division')], ['Nombre de copies', V(v, 'copies', 4)]]) + P('Date : ' + V(v, 'date', 10)) + signature('Signature de l\'intéressé', v); });

  modele('avance', 'prets', 'Demande d\'avance sur salaire', 'Pour les nouvelles recrues (maximum 30 000 DA).',
    [L.date, L.agent, L.matricule, L.fonction, L.recrutement, L.structure, { k: 'montant', l: 'Montant demandé (DA, max 30 000)', t: 'number', max: 30000 }, { k: 'motif', l: 'Motif', t: 'textarea' }], 'dr',
    function (v) { return lieuDate(v) + P('<b>Objet :</b> Demande d\'avance sur salaire (nouvelles recrues)') + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Date de recrutement', V(v, 'recrutement')], ['Structure d\'affectation', V(v, 'structure')]]) +
      P('Je vous prie de bien vouloir m\'accorder une avance sur salaire d\'un montant de :') + P('En chiffres : ' + (v.montant ? '<b>' + E(Number(v.montant).toLocaleString('fr-FR')) + ' DA</b>' : pts(10) + ' DA') + ' (maximum 30 000 DA)') + P('Motif : ' + T(v, 'motif', 2)) + signature('L\'intéressé(e)', v); });

  modele('pret-social', 'prets', 'Demande de prêt social', 'Avec les avis successifs de la hiérarchie et décision.',
    [L.date, L.agent, L.matricule, L.fonction, L.echelle, L.structure, L.recrutement, { k: 'montant', l: 'Montant demandé (DA)', t: 'number' }, { k: 'motif', l: 'Motif', t: 'textarea' }], 'dr',
    function (v) { return lieuDate(v) + titre('DEMANDE DE PRÊT SOCIAL') + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Échelle', V(v, 'echelle', 6)], ['Structure d\'affectation', V(v, 'structure')], ['Date de recrutement', V(v, 'recrutement')],
      ['Montant demandé', v.montant ? '<span class="val">' + E(Number(v.montant).toLocaleString('fr-FR')) + ' DA</span>' : pts(10) + ' DA'], ['Motif', T(v, 'motif', 2)]]) + signature('L\'intéressé(e)', v) +
      '<div class="tgr-avis">' + AVIS_FD('Avis du Chef de Structure') + AVIS_FD('Avis du Service Prestations Sociales') + AVIS_FD('Avis du Chef Division Personnel') + AVIS_FD('Commission des Affaires Sociales et Culturelles') + '</div>' + visas(['Décision du Directeur Régional'], 70); });

  modele('pret-vehicule', 'prets', 'Demande de prêt achat véhicule', 'Engagement de justifier l\'achat dans le délai réglementaire.',
    [L.date, L.agent, L.matricule, L.fonction, L.echelle, L.structure, L.recrutement, { k: 'delai', l: 'Délai de justification', t: 'select', opts: ['neuf (09) mois (Sud)', 'six (06) mois (Nord)'] }, { k: 'historique', l: 'Historique des prêts achat véhicule contractés', t: 'textarea' }], 'dr',
    function (v) { return lieuDate(v) + titre('DEMANDE DE PRÊT ACHAT VÉHICULE') + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Échelle', V(v, 'echelle', 6)], ['Structure d\'affectation', V(v, 'structure')], ['Date de recrutement', V(v, 'recrutement')]]) +
      P('<b>ENGAGEMENT :</b> Je m\'engage, dans un délai n\'excédant pas ' + E(v.delai || 'neuf (09) mois (Sud)') + ', à compter de la date du versement du prêt, à présenter tous les documents prouvant l\'acquisition effective et personnelle du véhicule, à savoir : une photocopie de la carte d\'immatriculation du véhicule ; une photocopie de la police d\'assurance du véhicule.') +
      P('À défaut de justificatifs, SONATRACH est en droit de m\'exiger le remboursement, sans délai, des sommes restantes dues (cf. art. 4 et 8 du contrat).') + signature('Signature', v) + P('Je joins à la présente demande une copie de mon permis de conduire et une copie d\'un chèque barré.') +
      P('<b>Historique prêt achat véhicule contracté :</b>') + T(v, 'historique', 2) + visas(['Avis du Responsable de la Structure d\'Affectation', 'Avis du Responsable de l\'Activité Gestion Administrative'], 70) +
      P('Le délai de justification réglementaire est de six (06) mois pour les travailleurs du Nord et neuf (09) mois pour ceux du Sud.', 'note'); });

  var PIECES_PRET = ['Copie des 3 dernières fiches de paie', 'Extrait d\'acte de naissance', 'Acte de mariage'];
  modele('pret-construction', 'prets', 'Demande de prêt construction', 'Direction Générale — Direction Affaires Sociales, avec la liste des pièces à joindre.',
    [L.date, L.agent, L.matricule, { k: 'direction', l: 'Direction', def: 'Direction Régionale Rhourde Nouss' }, L.fonction, { k: 'email', l: 'E-mail (SH)' }, L.recrutement, L.naissance, { k: 'poste', l: 'N° de poste' },
      { k: 'deja', l: 'Prêt logement ou construction déjà obtenu ?', t: 'select', opts: ['Non', 'Oui'] }, { k: 'date_attribution', l: 'Si oui, date d\'attribution', t: 'date' }, { k: 'conjoint', l: 'Matricule du conjoint travaillant à Sonatrach' },
      { k: 'montant', l: 'Montant sollicité (DA)', t: 'number' }, { k: 'duree', l: 'Remboursement en (années)', t: 'number', def: '10' }, { k: 'capacite', l: 'Capacité mensuelle de remboursement (DA)', t: 'number' }], 'dag',
    function (v) { return titre('DEMANDE DE PRÊT CONSTRUCTION') + P('Je soussigné(e) :') + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Direction', V(v, 'direction')], ['Fonction', V(v, 'fonction')], ['E-mail (SH)', V(v, 'email')], ['Date de recrutement', V(v, 'recrutement')], ['Date de naissance', V(v, 'naissance')], ['N° de poste', V(v, 'poste', 8)],
      ['Prêt logement / construction déjà obtenu', V(v, 'deja', 8)], ['Date d\'attribution', V(v, 'date_attribution')], ['Matricule du conjoint (Sonatrach)', V(v, 'conjoint')]]) +
      P('Je sollicite un prêt construction d\'un montant de : ' + V(v, 'montant', 10) + ' DA, que je souhaite rembourser en ' + V(v, 'duree', 3) + ' ans. Mes capacités mensuelles de remboursement sont de ' + V(v, 'capacite', 10) + ' DA.') +
      P('Pour l\'étude du dossier, joindre à la présente demande :') + '<ul class="liste"><li>Copie de l\'acte de vente ou du livret foncier du terrain, ou acte de possession, ou décision d\'attribution délivrée par l\'APC (dûment authentifiée au niveau de l\'unité Sonatrach)</li><li>Copie du permis en cours de validité (construire, extension ou achèvement) ou certificat d\'avancement des travaux délivré par l\'APC ou un huissier de justice (dûment authentifié)</li>' +
      PIECES_PRET.map(function (x) { return '<li>' + E(x) + '</li>'; }).join('') + '<li>Fiche de paie du conjoint (agent Sonatrach) si le dossier est au nom de ce dernier</li></ul>' +
      P('Je certifie exactes et sincères toutes les informations contenues dans le présent document.') + '<div class="deux"><div>Fait à Rhourde Nouss, le ' + V(v, 'date', 10) + '</div><div class="droite"><b>L\'intéressé(e)</b></div></div>' + visas(['Le visa du responsable de la Structure'], 70); });

  modele('pret-cal', 'prets', 'Demande de prêt CAL (acquisition d\'un logement)', 'Prêt pour l\'acquisition d\'un logement familial.',
    [L.date, L.agent, L.matricule, L.recrutement, L.naissance, L.fonction, L.echelle, { k: 'adresse', l: 'Logement situé à l\'adresse' }, { k: 'attribution', l: 'Attribué par (document d\'affectation ou d\'achat)' }, { k: 'prix', l: 'Montant d\'achat (DA)', t: 'number' },
      { k: 'prets', l: 'Prêts déjà contractés', t: 'repeat', colonnes: [{ k: 'montant', l: 'Montant' }, { k: 'organisme', l: 'Organisme' }, { k: 'periode', l: 'Période' }, { k: 'mensuel', l: 'Remboursement mensuel' }] },
      { k: 'montant', l: 'Montant du prêt souhaité (DA)', t: 'number' }, { k: 'duree', l: 'Remboursement en (années)', t: 'number' }, { k: 'capacite', l: 'Capacité mensuelle de remboursement (DA)', t: 'number' }], 'dag',
    function (v) { var l = (v.prets || []).map(function (x) { return [E(x.montant), E(x.organisme), E(x.periode), E(x.mensuel)]; }); while (l.length < 2) l.push(['', '', '', '']);
      return titre('DEMANDE DE PRÊT — ACQUISITION D\'UN LOGEMENT') + P('Je soussigné(e) :') + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Activité / Division / Direction', 'Exploration-Production — Production — Direction Régionale de Rhourde Nouss'], ['Date de recrutement', V(v, 'recrutement')], ['Date de naissance', V(v, 'naissance')], ['Fonction', V(v, 'fonction')], ['Échelle', V(v, 'echelle', 6)]]) +
      P('Je sollicite un prêt en vue de l\'acquisition d\'un logement familial. Ce crédit est destiné en totalité à l\'achat du logement situé à : ' + V(v, 'adresse', 24) + ', qui m\'a été attribué par ' + V(v, 'attribution', 20) + '. Le montant d\'achat s\'élève à ' + V(v, 'prix', 10) + ' DA.') +
      P('J\'ai déjà contracté les prêts suivants :') + GRILLE(['Montant', 'Organisme', 'Période', 'Remboursement mensuel'], l) +
      P('Je souhaite me voir attribuer un prêt de ' + V(v, 'montant', 10) + ' DA, remboursable en ' + V(v, 'duree', 3) + ' ans. Mes capacités mensuelles de remboursement sont de ' + V(v, 'capacite', 10) + ' DA.') +
      P('Pièces jointes :') + '<ul class="liste"><li>Copie du document d\'attribution ou d\'acquisition (légalisée)</li><li>Reçu de versement bancaire (légalisé)</li><li>03 copies des dernières fiches de paie</li><li>Extrait d\'acte de naissance</li><li>Acte de mariage</li><li>Attestation de travail</li></ul>' +
      P('Je m\'engage à rembourser le prêt régulièrement, selon l\'échéancier arrêté et conformément aux dispositions contractuelles. J\'accepte les retenues sur mon salaire du montant mensuel de remboursement et autorise les services de Sonatrach à procéder automatiquement à ces prélèvements jusqu\'au terme de l\'échéancier. Je certifie exactes et sincères toutes les informations contenues dans le présent document.') +
      '<div class="deux"><div>Fait à Rhourde Nouss, le ' + V(v, 'date', 10) + '</div><div class="droite"><b>Signature</b></div></div>' + visas(['Le Directeur Régional'], 70); });

  var PROFIL = function (v) { return '<table class="tgr"><thead><tr><th colspan="3">P R O F I L</th></tr><tr><th>Formation de base (diplôme)</th><th>Fonction professionnelle</th><th>Expérience professionnelle</th></tr></thead><tbody><tr><td style="height:52px">' + E(v.diplome || '') + '</td><td>' + E(v.fonction_pro || '') + '</td><td>' + E(v.experience || '') + '</td></tr></tbody></table>'; };
  var POSTES = function (v) { var l = (v.postes || []).map(function (x) { return [E(x.poste), E(x.structure), E(x.lieu)]; }); for (var i = l.length; i < 3; i += 1) l.push(['', '', '']); return GRILLE(['Poste sollicité', 'Structure (Division)', 'Lieu'], l.map(function (r, i) { return r; })); };
  var CH_POSTES = { k: 'postes', l: 'Postes sollicités (par ordre de préférence)', t: 'repeat', colonnes: [{ k: 'poste', l: 'Poste sollicité' }, { k: 'structure', l: 'Structure (division)' }, { k: 'lieu', l: 'Lieu' }] };

  modele('mutation-interne', 'carriere', 'Demande de mutation interne', 'Avec profil, avis hiérarchiques et cadre réservé au Service Planification.',
    [L.date, L.agent, L.matricule, L.fonction, L.echelle, L.service, L.division, L.recrutement, { k: 'diplome', l: 'Formation de base (diplôme)' }, { k: 'fonction_pro', l: 'Fonction professionnelle' }, { k: 'experience', l: 'Expérience professionnelle', t: 'textarea' }, CH_POSTES, { k: 'motifs', l: 'Motifs de la demande', t: 'textarea' }], 'dr',
    function (v) { return titre('DEMANDE DE MUTATION INTERNE') + lieuDate(v) + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Échelle', V(v, 'echelle', 6)], ['Service', V(v, 'service')], ['Division', V(v, 'division')], ['Date de recrutement', V(v, 'recrutement')]]) + PROFIL(v) + POSTES(v) +
      P('<b>Sollicite cette mutation pour les motifs suivants :</b>') + T(v, 'motifs', 3) + signature('Signature de l\'intéressé(e)', v) + visas(['Avis du Chef hiérarchique', 'Avis du Chef de Division d\'origine', 'Avis du Chef de Division d\'accueil'], 80) +
      CADRE('Cadre réservé au Service Planification', GRILLE(['Poste sollicité', 'Critères d\'accès', 'Incidences financières éventuelles'], [['Intitulé exact : …<br>Échelle : …<br>Code Org : … Code fonction : …', '', ''], ['', '', '']])) + avisDirecteur(); });

  modele('mutation-externe', 'carriere', 'Demande de mutation externe', 'Avec avis hiérarchiques et cadre réservé au Service Gestion / Paie.',
    [L.date, L.agent, L.matricule, L.fonction, L.echelle, L.service, L.division, L.recrutement, CH_POSTES, { k: 'motifs', l: 'Motifs (à appuyer par des justificatifs probants)', t: 'textarea' },
      { k: 'prets', l: 'Prêts contractés (cadre Gestion / Paie)', t: 'repeat', colonnes: [{ k: 'nature', l: 'Nature du prêt' }, { k: 'date', l: 'Date d\'obtention' }, { k: 'reste', l: 'Reste à rembourser' }] }], 'dr',
    function (v) { var l = (v.prets || []).map(function (x, i) { return [(i + 1) + '.', E(x.nature), E(x.date), E(x.reste)]; }); for (var i = l.length; i < 3; i += 1) l.push([(i + 1) + '.', '', '', '']);
      return titre('DEMANDE DE MUTATION EXTERNE') + lieuDate(v) + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Échelle', V(v, 'echelle', 6)], ['Service', V(v, 'service')], ['Division', V(v, 'division')], ['Date de recrutement', V(v, 'recrutement')]]) + POSTES(v) +
      P('<b>Motifs (à appuyer par des justificatifs probants) :</b>') + T(v, 'motifs', 3) + signature('Signature de l\'intéressé(e)', v) + P('NB : joindre une demande manuscrite et une note d\'opportunité en cas d\'avis favorable.', 'note') +
      visas(['Avis du chef hiérarchique niv. 1', 'Avis du chef hiérarchique niv. 2', 'Avis du chef de Division'], 80) + CADRE('Cadre réservé au Service Gestion / Paie', GRILLE(['N°', 'Nature du prêt', 'Date d\'obtention', 'Reste à rembourser'], l)) + avisDirecteur(); });

  modele('mise-disponibilite', 'carriere', 'Demande de mise en disponibilité', 'Avec exposé des motifs et cadres réservés (Gestion du Personnel, Planning).',
    [L.date, L.agent, L.matricule, L.fonction, L.echelle, L.recrutement, { k: 'duree', l: 'Durée sollicitée', def: 'Une (01) année' }, { k: 'debut', l: 'À compter du', t: 'date' },
      { k: 'type', l: 'Motif', t: 'select', opts: ['Convenance personnelle', 'Motif de droit'] }, { k: 'precision', l: 'Si motif de droit, à préciser' }, { k: 'expose', l: 'Exposé des motifs (justificatifs à l\'appui)', t: 'textarea' }], 'dr',
    function (v) { return lieuDate(v) + titre('DEMANDE DE MISE EN DISPONIBILITÉ') + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Échelle', V(v, 'echelle', 6)], ['Date de recrutement', V(v, 'recrutement')]]) +
      P('Sollicite une mise en disponibilité de : <b>' + E(v.duree || '') + '</b> à compter du ' + V(v, 'debut', 10)) + P('<b>Exposé des motifs (justificatifs à l\'appui) :</b>') + T(v, 'expose', 3) + signature('Signature', v) +
      CADRE('Réservé à la Gestion du Personnel', P('Motif de la demande (cf. Convention art. 256) : ' + CASES(['1/ Convenance personnelle', '2/ Motif de droit']) + ' ' + (v.precision ? E(v.precision) : '') + '<br>Droits à congés (CR + CP) : ' + pts(10) + '<br>Prêts contractés (nature et solde) : ' + pts(16))) +
      CADRE('Réservé au Planning Personnel', lignesVides(2)) + visas(['Avis du responsable hiérarchique', 'Avis du Chef de Division'], 70) + visas(['Avis de la Commission du Personnel', 'Avis du Chef Division Personnel', 'Décision du Directeur Régional'], 80); });

  modele('interim', 'autres', 'Note d\'intérim', 'Désigne la personne qui assure l\'intérim d\'un poste pendant une absence.',
    [{ k: 'numero', l: 'Numéro (…/année)' }, L.date, { k: 'absent', l: 'Durant l\'absence de Monsieur', def: 'user.nom', pers: { fonction: 'absent_fonction' } }, { k: 'absent_fonction', l: 'Fonction', def: 'user.fonction' }, { k: 'absent_structure', l: 'Structure', def: 'Infrastructure' },
      { k: 'interim', l: 'Monsieur (intérimaire)', pers: { fonction: 'interim_fonction' } }, { k: 'interim_fonction', l: 'Fonction de l\'intérimaire' }, { k: 'interim_structure', l: 'Structure de l\'intérimaire', def: 'Infrastructure' }, { k: 'poste', l: 'Poste dont l\'intérim est assuré', def: 'CHEF DIVISION INFRASTRUCTURE' },
      { k: 'code', l: 'Code fonction' }, { k: 'du', l: 'Du', t: 'date' }, { k: 'au', l: 'Au', t: 'date' }], 'dr',
    function (v) { return titre('NOTE D\'INTÉRIM') + P('N° : ' + V(v, 'numero', 8)) + P('Durant l\'absence de Monsieur : <b>' + (v.absent ? E(v.absent) : pts(14)) + '</b><br>Fonction : ' + V(v, 'absent_fonction') + '<br>Structure : ' + V(v, 'absent_structure')) +
      P('Monsieur : <b>' + (v.interim ? E(v.interim) : pts(14)) + '</b><br>Fonction : ' + V(v, 'interim_fonction') + '<br>Structure : ' + V(v, 'interim_structure')) +
      P('Est chargé d\'assurer l\'intérim du poste : <b>' + V(v, 'poste', 14) + '</b><br>Code fonction : ' + V(v, 'code', 8)) + P('Du : ' + V(v, 'du', 10) + ' &nbsp; Au : ' + V(v, 'au', 10)) + P('Fait à Rhourde Nouss, le ' + V(v, 'date', 10)) + signature('LE DIRECTEUR RÉGIONAL', v); });

  var FICHE_PRIME = function (id, titreM, desc, ligneAvis, code) {
    modele(id, 'primes', titreM, desc,
      [L.date, { k: 'entete_division', l: 'Division', def: 'Division Infrastructure' }, L.agent, L.matricule, L.fonction, L.echelle, L.service, { k: 'division_agent', l: 'Division de l\'agent', def: 'Infrastructure' }, { k: 'effet', l: 'Date d\'effet', t: 'date' }, { k: 'chef', l: 'Chef de Division (nom)' }], 'dr',
      function (v) { return titre('DEMANDE D\'ATTRIBUTION ' + code, 'Destination : Division Personnel') + P('Division : <b>' + (v.entete_division ? E(v.entete_division) : pts(10)) + '</b>') + P('Nous vous demandons d\'attribuer ' + ligneAvis + ' à Monsieur :') +
        KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Échelle', V(v, 'echelle', 6)], ['Service', V(v, 'service')], ['Division', V(v, 'division_agent')], ['Date d\'effet', V(v, 'effet')]]) +
        P(id === 'nuisance' ? 'Tout changement définitif d\'affectation de l\'agent dans une activité non exposée aux nuisances vous sera notifié immédiatement.' : 'Tout changement dans le système de travail de l\'intéressé vous sera notifié immédiatement.') +
        '<div class="deux"><div>RNS, le : ' + V(v, 'date', 10) + '</div><div class="droite"><b>Le Chef de Division ' + (v.chef ? E(v.chef) : '') + '</b></div></div>' + CADRE('Cadre réservé au Service Gestion / Paie', lignesVides(3) + '<div class="droite">Visa : ' + pts(10) + '</div>') + avisDirecteur(); });
  };
  FICHE_PRIME('itp', 'Demande d\'indemnité de travail posté (ITP)', 'Attribution de l\'indemnité de travail posté.', 'l\'indemnité de travail posté', 'INDEMNITÉ DE TRAVAIL POSTÉ');
  FICHE_PRIME('nuisance', 'Demande d\'indemnité de nuisance', 'Attribution de l\'indemnité de nuisance.', 'l\'indemnité de nuisance', 'INDEMNITÉ DE NUISANCE');

  modele('pap-pac', 'primes', 'Demande PAP & PAC (port d\'arme)', 'Prime d\'astreinte particulière et complémentaire — Sûreté Interne Entreprise.',
    [L.date, L.agent, L.matricule, L.fonction, L.echelle, { k: 'recrutement', l: 'Date de recrutement', t: 'date' }, { k: 'cdd', l: 'Précision', def: 'Nouveau CDD' }, { k: 'effet', l: 'Date d\'effet', t: 'date' }, { k: 'observation', l: 'Observations (facultatif)', t: 'textarea' }], 'dr',
    function (v) { return titre('DEMANDE D\'ATTRIBUTION P.A.P & P.A.C', 'Suite port d\'arme — Destination : Division Personnel') + P('Structure : <b>Sûreté Interne Entreprise</b>') +
      P('Nous vous demandons de bien vouloir attribuer la prime d\'astreinte particulière et la prime d\'astreinte complémentaire (P.A.P & P.A.C) à Monsieur :') +
      KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Échelle', V(v, 'echelle', 6)], ['Date de recrutement', V(v, 'recrutement') + (v.cdd ? ' (' + E(v.cdd) + ')' : '')], ['Date d\'effet', V(v, 'effet')]]) +
      P('Tout changement à un poste de travail non soumis au port d\'arme vous sera notifié immédiatement.') + '<div class="deux"><div>RNS, le : ' + V(v, 'date', 10) + '</div><div class="droite"><b>L\'Assistant de Sûreté Interne</b></div></div>' +
      P('<b>Observations :</b> l\'attribution de la PAP et de la PAC n\'est pas cumulable avec les autres indemnités (nuisances, ITP, PRS). ' + (v.observation ? E(v.observation) : '')) +
      CADRE('Cadre réservé au Service Gestion', lignesVides(3) + '<div class="droite">Visa : ' + pts(10) + '</div>') + avisDirecteur(); });

  modele('sanction', 'discipline', 'Demande de sanction', 'Demande de sanction du 1er, 2e ou 3e degré (articles 86, 90, 96 et 97 du règlement intérieur).',
    [L.date, { k: 'degre', l: 'Degré', t: 'select', opts: ['1er degré', '2e degré', '3e degré'] }, { k: 'cible', l: 'À l\'encontre de Monsieur (nom et prénom)', pers: { matricule: 'mle', fonction: 'fonction_cible', service: 'affectation' } }, { k: 'mle', l: 'Matricule' }, { k: 'fonction_cible', l: 'Fonction' }, { k: 'affectation', l: 'Affectation (division)' },
      { k: 'demandeur', l: 'Demandeur (nom)', def: 'user.nom', pers: { fonction: 'fonction_dem' } }, { k: 'fonction_dem', l: 'Fonction du demandeur', def: 'user.fonction' }, { k: 'sanction', l: 'Sanction demandée' }, { k: 'motif', l: 'Motif' }, { k: 'faits', l: 'A) Exposé détaillé des faits', t: 'textarea' },
      { k: 'rapports', l: 'B) Éventuels rapports', t: 'textarea' }, { k: 'temoins', l: 'C) Supérieurs hiérarchiques immédiats ou témoins entendus', t: 'textarea' }, { k: 'declarations', l: 'D) Déclarations ou comptes rendus', t: 'textarea' },
      { k: 'reponse', l: 'L\'intéressé(e)', t: 'select', opts: ['a répondu', 'n\'a pas répondu'] }, { k: 'date_notif', l: 'à la notification adressée le', t: 'date' }, { k: 'division_chef', l: 'Chef de Division' }], 'dr',
    function (v) { return titre('DEMANDE DE SANCTION DU ' + (v.degre || '1er / 2e / 3e degré').toUpperCase()) + '<div class="droite">RNS, le : ' + V(v, 'date', 10) + '</div>' + P('Monsieur le Directeur Régional,', 'droite') +
      P('À l\'encontre de Monsieur : ' + V(v, 'cible') + ' — Matricule : ' + V(v, 'mle', 8) + '<br>Fonction : ' + V(v, 'fonction_cible') + ' — Affectation (division) : ' + V(v, 'affectation')) +
      P('En application des articles 86, 90, 96 et 97 du règlement intérieur, Monsieur ' + V(v, 'demandeur') + ', ' + V(v, 'fonction_dem') + ', demande la sanction suivante : ' + V(v, 'sanction') + ' pour le motif : ' + V(v, 'motif')) +
      P('<b>A) Exposé détaillé des faits :</b>') + T(v, 'faits', 3) + P('<b>B) Éventuels rapports :</b>') + T(v, 'rapports', 2) + P('<b>C) Supérieurs hiérarchiques immédiats ou témoins entendus :</b>') + T(v, 'temoins', 2) + P('<b>D) Déclarations ou comptes rendus :</b>') + T(v, 'declarations', 2) +
      P('L\'intéressé(e) ' + (v.reponse ? '<b>' + E(v.reponse) + '</b>' : 'a répondu / n\'a pas répondu') + ' à la notification de la mesure disciplinaire qui lui a été adressée le ' + V(v, 'date_notif', 10)) + signature('Le Chef de Division ' + (v.division_chef || ''), v); });

  modele('absolution', 'discipline', 'Demande d\'absolution de sanction', 'Avec avis motivés de la hiérarchie et décision.',
    [L.date, L.agent, L.matricule, L.fonction, L.division, { k: 'sanction', l: 'Sanction dont l\'absolution est demandée' }, { k: 'motif', l: 'Motif de la sanction', t: 'textarea' }, { k: 'effet', l: 'Date d\'effet de la sanction', t: 'date' }], 'dr',
    function (v) { return '<div class="droite">RNS, le : ' + V(v, 'date', 10) + '</div>' + titre('DEMANDE D\'ABSOLUTION DE SANCTION') + P('Monsieur : ' + V(v, 'agent') + '<br>Matricule : ' + V(v, 'matricule') + '<br>Fonction : ' + V(v, 'fonction') + '<br>Division : ' + V(v, 'division')) +
      P('Demande l\'absolution de la sanction suivante : ' + V(v, 'sanction')) + P('<b>Motif de la sanction :</b>') + T(v, 'motif', 2) + P('Date d\'effet de la sanction : ' + V(v, 'effet', 10)) + signature('L\'intéressé(e)', v) +
      visas(['Avis motivé du responsable hiérarchique', 'Avis motivé du Chef de Division ' + (v.division || ''), 'Avis du Chef Division Personnel', 'Décision du Directeur Régional'], 90); });

  modele('audience', 'divers', 'Demande d\'audience', 'Audience auprès du Directeur Régional ou de la Division Personnel.',
    [L.date, { k: 'destinataire', l: 'Adressée à', def: 'Monsieur le Directeur Régional' }, L.agent, L.matricule, L.fonction, L.structure, L.recrutement, { k: 'objet', l: 'Objet de l\'audience', t: 'textarea' }], 'dr',
    function (v) { return lieuDate(v) + P('À ' + (v.destinataire ? E(v.destinataire) : pts(14)), 'droite') + titre('DEMANDE D\'AUDIENCE') + KV([['Nom et prénom', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Structure', V(v, 'structure')], ['Date de recrutement', V(v, 'recrutement')]]) +
      P('Je sollicite une audience pour exposer l\'objet suivant :') + T(v, 'objet', 4) + signature('L\'intéressé(e)', v) + P('NB : joindre à ladite demande la fiche de synthèse et l\'état d\'assiduité de la dernière année et de l\'année en cours de l\'intéressé.', 'note'); });

  modele('requete', 'divers', 'Requête administrative (réclamation)', 'Adressée au Chef de Division Personnel sous couvert de la voie hiérarchique.',
    [L.date, L.matricule, L.agent, L.fonction, L.structure, { k: 'objet', l: 'Objet de la réclamation', t: 'textarea' }], 'dr',
    function (v) { return lieuDate(v) + P('À Monsieur le Chef de Division Personnel<br>S/C de la voie hiérarchique.', 'droite') + titre('REQUÊTE ADMINISTRATIVE') + KV([['Matricule', V(v, 'matricule')], ['Nom et prénom', V(v, 'agent')], ['Fonction', V(v, 'fonction')], ['Structure', V(v, 'structure')]]) +
      P('<b>OBJET DE LA RÉCLAMATION :</b>') + T(v, 'objet', 6) + signature('Date et signature de l\'agent', v) + visas(['Date et visa du Responsable de structure'], 70); });

  modele('engagement-route', 'divers', 'Engagement de départ par route', 'Déclaration sur l\'honneur : l\'agent rentre chez lui par ses propres moyens.',
    [L.date, L.agent, { k: 'naissance', l: 'Né(e) le', t: 'date' }, L.fonction, L.matricule, L.structure, { k: 'absence', l: 'Départ en absence autorisée le', t: 'date' }, { k: 'observations', l: 'Observations (facultatif)', t: 'textarea' }], 'dr',
    function (v) { return titre('ENGAGEMENT — DÉPART PAR ROUTE') + P('<b>Renseignements sur l\'agent</b>') + KV([['Nom et prénom', V(v, 'agent')], ['Fonction', V(v, 'fonction')], ['Matricule', V(v, 'matricule')], ['Structure', V(v, 'structure')]]) +
      P('Je soussigné(e), ' + V(v, 'agent') + ', né(e) le ' + V(v, 'naissance', 10) + ', travaillant comme ' + V(v, 'fonction') + ' à la Sonatrach, Direction Régionale de Rhourde Nouss, déclare sur l\'honneur que je me prends en charge pour arriver à mon domicile lors de mon départ en absence autorisée le ' + V(v, 'absence', 10) +
      ', à partir de mon lieu de travail (par route avec mes propres moyens), sans prétendre à des indemnités de route de ma part, et dégage l\'Entreprise de toute responsabilité en cas d\'incident.') + T(v, 'observations', 3) + P('Date et visa de l\'agent : ' + V(v, 'date', 10)) +
      P('Ce document doit être dûment signé par l\'agent et rendu à la Structure d\'affectation avant le départ de ce dernier.', 'note'); });

  modele('changement-planning', 'carriere', 'Demande de modification de planning (formulaire)', 'Maintien, réaménagement ou résorption de reliquat : planning initial, modification demandée, avis. (La simulation du portail produit la même demande, déjà remplie.)',
    [L.date, { k: 'type', l: 'Nature de la demande', t: 'select', opts: ['', 'Maintien', 'Réaménagement Planning', 'Résorption reliquat'] }, { k: 'regime', l: 'Régime', def: '4x4' }, L.agent, L.matricule, L.fonction, L.division,
      { k: 'releve', l: 'Jour de relève' }, { k: 'destination', l: 'Destination' }, { k: 'presente', l: 'Demande présentée par (l\'agent / son responsable)' },
      { k: 'initial', l: 'Planning initial', t: 'repeat', colonnes: [{ k: 'du', l: 'Du', t: 'date' }, { k: 'au', l: 'Au', t: 'date' }, { k: 'tr', l: 'T / R', t: 'select', opts: ['', 'T', 'R'] }] },
      { k: 'modif', l: 'Modification demandée', t: 'repeat', colonnes: [{ k: 'du', l: 'Du', t: 'date' }, { k: 'au', l: 'Au', t: 'date' }, { k: 'tr', l: 'T / R', t: 'select', opts: ['', 'T', 'R'] }] },
      { k: 'motif', l: 'Motif de la demande (avis du Chef de Service)', t: 'textarea' }], 'dr',
    function (v) {
      var n = Math.max((v.initial || []).length, (v.modif || []).length, 6), l = [];
      for (var i = 0; i < n; i += 1) { var a = (v.initial || [])[i] || {}, b = (v.modif || [])[i] || {};
        var plage = function (x) { return x.du || x.au ? E(frDate(x.du)) + ' → ' + E(frDate(x.au)) : ''; };
        l.push([plage(a), E(a.tr || ''), E(b.tr || ''), plage(b)]); }
      return '<div class="droite">RNS, le : ' + V(v, 'date', 10) + '</div>' + titre('DEMANDE DE MODIFICATION DE PLANNING', E(v.regime || '')) +
        P('<b>' + CASES(['Maintien', 'Réaménagement Planning', 'Résorption reliquat']).replace(new RegExp('☐ ' + (v.type || '§'), 'g'), '☒ ' + (v.type || '')) + '</b>') +
        KV([['Nom et prénoms', V(v, 'agent')], ['Matricule', V(v, 'matricule')], ['Fonction', V(v, 'fonction')], ['Division', V(v, 'division')], ['Jour de relève', V(v, 'releve')], ['Destination', V(v, 'destination')]]) +
        P('Demande présentée par l\'agent / son responsable : ' + V(v, 'presente', 20)) +
        '<table class="tgr serre"><thead><tr><th>Planning initial (semaines)</th><th>T/R</th><th>T/R</th><th>Modification demandée (semaines)</th></tr></thead><tbody>' + l.map(function (r) { return '<tr><td>' + r[0] + '</td><td class="c">' + r[1] + '</td><td class="c">' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('') + '</tbody></table>' +
        P('<b>Avis du Chef de Service — motif de la demande :</b>') + T(v, 'motif', 2) +
        CADRE('Cadre réservé au Service Gestion-Paie', P('Situation actuelle (sans modif) — Code 8 : ' + pts(6) + ' Code 7 : ' + pts(6) + '<br>Place disponible : ' + CASES(['OUI', 'NON']) + ' &nbsp; Relève : ' + pts(8) + '<br>Modif précédée par absences ? ' + pts(8) + ' &nbsp; Nbre de modif durant l\'exercice : ' + pts(4) + '<br>Reliquat : ' + pts(6) + ' &nbsp; Avis : ' + pts(10))) +
        visas(['Avis du Chef Division ' + (v.division || ''), 'Décision du Chef Division Personnel'], 80); });

  modele('prolongation-om', 'missions', 'Prolongation de mission (OM)', 'Demande au Directeur Régional de prolonger une mission en cours.',
    [L.date, L.division, { k: 'om', l: 'OM n°' }, { k: 'om_date', l: 'du', t: 'date' }, { k: 'du', l: 'Prolongation du', t: 'date' }, { k: 'au', l: 'Au', t: 'date' }, { k: 'jours', l: 'Soit (jours, calculé si vide)', t: 'number' },
      L.agent, L.fonction, { k: 'motif', l: 'Motif', t: 'textarea' }, { k: 'observations', l: 'Observations', t: 'textarea' }], 'dr',
    function (v) {
      var n = v.jours || (v.du && v.au && ecart(v.du, v.au) != null ? ecart(v.du, v.au) + 1 : '');
      return '<div class="deux"><div>Division : <b>' + (v.division ? E(v.division) : pts(10)) + '</b></div><div class="droite">RNS, le : ' + V(v, 'date', 10) + '</div></div>' + P('À Monsieur<br>Le Directeur Régional', 'droite') +
        P('<b>Objet : Prolongation de mission (OM n° ' + V(v, 'om', 6) + ' du ' + V(v, 'om_date', 10) + ')</b>') + P('Monsieur,') +
        P('Nous vous demandons de bien vouloir accorder une prolongation de mission du : ' + V(v, 'du', 10) + ' au : ' + V(v, 'au', 10) + ', soit : ' + (n === '' ? pts(4) : '<b>' + E(n) + '</b>') + ' jour(s) (cachet et date apposés de l\'organisme visité faisant foi).') +
        P('Pour l\'agent :<br>Nom et prénom : ' + V(v, 'agent') + '<br>Fonction : ' + V(v, 'fonction')) + P('<b>Motif :</b>') + T(v, 'motif', 2) + P('<b>Observations :</b>') + T(v, 'observations', 2) +
        visas(['Le Chef Division ' + (v.division || ''), 'Accord de M. le Directeur Régional'], 90); });

  var MOTIFS_Q = [['m1', 'Votre absence à votre poste de travail la demi-journée / la journée du', 'm1_date'], ['m2', 'Votre absence à votre poste de travail la journée du', 'm2_date', 'de', 'm2_h1', 'heures à', 'm2_h2', 'heures'],
    ['m3', 'Vos arrivées tardives et fréquentes à votre poste de travail'], ['m4', 'Négligences / non-respect de procédures de travail / non-exécution d\'un travail'], ['m5', 'Autres motifs (à préciser)', 'm5_precision']];
  modele('questionnaire', 'discipline', 'Questionnaire (absence ou motif professionnel)', 'Demande de justification adressée à un agent, avec réponse et avis.',
    [L.date, L.agent, L.matricule, L.fonction, L.service, L.division,
      { k: 'm1', l: 'Absence demi-journée / journée', t: 'select', opts: ['', 'Oui'] }, { k: 'm1_date', l: '… du', t: 'date' },
      { k: 'm2', l: 'Absence sur des heures', t: 'select', opts: ['', 'Oui'] }, { k: 'm2_date', l: '… journée du', t: 'date' }, { k: 'm2_h1', l: 'de (heure)' }, { k: 'm2_h2', l: 'à (heure)' },
      { k: 'm3', l: 'Arrivées tardives et fréquentes', t: 'select', opts: ['', 'Oui'] }, { k: 'm4', l: 'Négligences / non-respect de procédures', t: 'select', opts: ['', 'Oui'] },
      { k: 'm5', l: 'Autres motifs', t: 'select', opts: ['', 'Oui'] }, { k: 'm5_precision', l: 'Précision des autres motifs' }], 'dr',
    function (v) {
      var lignes = MOTIFS_Q.map(function (m) { var coche = v[m[0]] === 'Oui', t = (coche ? '☒ ' : '☐ ') + E(m[1]);
        if (m[0] === 'm1' || m[0] === 'm2') t += ' : ' + V(v, m[2], 8); if (m[0] === 'm2') t += ' de ' + V(v, 'm2_h1', 4) + ' h à ' + V(v, 'm2_h2', 4) + ' h'; if (m[0] === 'm5') t += ' : ' + V(v, 'm5_precision', 14); return '<li>' + t + '</li>'; }).join('');
      return titre('QUESTIONNAIRE', 'Suite absence au poste de travail ou autres motifs d\'ordre professionnel') +
        P('Monsieur : <b>' + (v.agent ? E(v.agent) : pts(14)) + '</b> &nbsp; Mle : ' + V(v, 'matricule', 8) + '<br>Fonction : ' + V(v, 'fonction') + ' &nbsp; Service : ' + V(v, 'service') + ' &nbsp; Division : ' + V(v, 'division')) +
        P('Je vous demande de justifier :') + '<ul class="liste" style="list-style:none;margin-left:6px">' + lignes + '</ul>' + '<div class="deux"><div>Date : ' + V(v, 'date', 10) + '</div><div class="droite"><b>Le Responsable Hiérarchique</b></div></div>' +
        P('<b>Réponse :</b>') + lignesVides(3) + signature('L\'intéressé(e)', v) + visas(['Avis du Chef de Service', 'Avis du Chef de Division'], 60) + visas(['Le Chef de Division Personnel', 'Décision du Directeur Régional'], 60) +
        P('NB : conformément au règlement intérieur de l\'Entreprise, les retards fréquents, absences non justifiées, sorties sans autorisation et absences au poste de travail sont passibles de la sanction suivante : code 8 + avertissement écrit (première fois) ; en cas de récidive, la sanction sera plus lourde. Les fautes professionnelles (négligences, non-exécution des obligations professionnelles, non-respect des procédures…) sont passibles de sanctions du 2e ou 3e degré.', 'note'); });

  /* ---------- préparation et rendu ---------- */
  /** Valeurs initiales d'un modèle (profil de l'utilisateur connecté, date du jour). */
  function valeursInitiales(m, user, aujourdhui) {
    var v = {}; user = user || {}; aujourdhui = aujourdhui || jourIso(new Date());
    m.champs.forEach(function (c) {
      var d = c.def; if (d == null) { if (c.t === 'repeat') v[c.k] = []; return; }
      if (d === 'aujourdhui') v[c.k] = aujourdhui;
      else if (/^user\./.test(d)) v[c.k] = /date/.test(d) ? String(user[d.slice(5)] || '').slice(0, 10) : String(user[d.slice(5)] || '');
      else v[c.k] = String(d).replace('{annee}', aujourdhui.slice(0, 4));
    });
    return v;
  }
  var CSS = '.doc{font-family:Arial,Helvetica,sans-serif;font-size:11.5pt;color:#000;line-height:1.45}.doc *{box-sizing:border-box}.entete{display:flex;align-items:center;gap:14px;border-bottom:3px solid #E85D04;padding-bottom:8px;margin-bottom:14px}.entete .logo{height:52px;width:auto}.entete-t{font-size:10pt;line-height:1.35}' +
    '.doc-titre{text-align:center;font-size:14pt;letter-spacing:.5px;margin:16px 0 4px;text-transform:uppercase}.doc-sous{text-align:center;font-size:9.5pt;margin-bottom:12px}.doc p{margin:8px 0}.droite{text-align:right}.centre{text-align:center}.deux{display:flex;justify-content:space-between;gap:12px;margin:6px 0}' +
    '.val{font-weight:700}.pt{color:#555;letter-spacing:1px;overflow-wrap:anywhere}.ligne-pt{border-bottom:1px dotted #555;height:22px}.note{font-size:8.5pt;color:#333}.liste{margin:6px 0 6px 22px;font-size:10.5pt}' +
    'table{border-collapse:collapse;width:100%;margin:8px 0;page-break-inside:avoid}table.kv th{width:34%;text-align:left;background:#f2f2f2;border:1px solid #333;padding:6px 8px;font-size:10pt}table.kv td{border:1px solid #333;padding:6px 8px}' +
    'table.tgr th,table.tgr td{border:1px solid #333;padding:5px 7px;text-align:left;font-size:10pt;vertical-align:top}table.tgr th{background:#f2f2f2}table.tgr td{height:24px}table.tgr.serre{table-layout:fixed}table.tgr.serre td,table.tgr.serre th{font-size:9pt;padding:3px 4px}.c{text-align:center}' +
    'table.visas th,table.visas td{border:1px solid #333;padding:6px 8px;font-size:10pt}table.visas th{background:#f2f2f2}.cadre{border:1px solid #333;margin:10px 0;padding:6px 10px;page-break-inside:avoid}.cadre-t{text-align:center;font-weight:700;text-decoration:underline;margin-bottom:6px}' +
    '.sign{text-align:right;margin:22px 0 40px}.avis{border:1px solid #333;padding:8px 10px;font-size:10pt;min-height:78px}.grille-avis{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.case-c{margin-right:12px;white-space:nowrap}.pt-s{font-size:9.5pt}';
  /** HTML complet d'un document (fragment à insérer dans la page ou dans une fenêtre d'impression). */
  function rendre(m, v, logo) {
    var h = '<div class="doc">' + entete(m.entete, v || {}) + m.html(v || {}) + '</div>';
    return h.replace('@LOGO@', E(logo || 'badges/logo-sonatrach.png'));
  }
  function trouver(id) { return M.filter(function (m) { return m.id === id; })[0] || null; }

  var API = { categories: CATEGORIES, modeles: M, trouver: trouver, valeursInitiales: valeursInitiales, rendre: rendre, css: CSS, frDate: frDate, echapper: E };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Documents = API;
})(typeof window !== 'undefined' ? window : this);
