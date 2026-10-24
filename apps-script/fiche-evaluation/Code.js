// ========================================================================
// FICHE D'ÉVALUATION MENSUELLE DES TRAVAUX ET/OU PRESTATIONS — Division Infrastructure RNS
// L'agent choisit le contrat (cartouche remplie depuis le Suivi CPM, en lecture seule), clique les cases ; le taux de satisfaction se calcule seul ;
// le PDF reprend la mise en page de la fiche Word ; chaque fiche éditée est archivée (consultable, rouvrable, supprimable).
// ========================================================================

const SUIVI_CPM_ID = '1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I';
const SUIVI_CPM_TAB = 'suivi';
const DOSSIER_FICHES = 'Fiches d’évaluation';   // dossier Drive (créé à la première fiche) : un PDF par fiche, ses réponses dans la description du fichier

// Colonnes du Suivi CPM (indices 0 = A), les mêmes que la passerelle
const CPM_COL = { intitule: 3, statut: 8, attribue_a: 12, n_contrat: 13, montant: 14, date_signature: 15, date_ods: 16, duree: 17 };

/** Boîtes e-mail des services (« Envoyer au service ») : choix fait à l'écran, e-mail jamais automatique. À modifier ici si une adresse change. */
const SERVICES_MAIL = [
  { id: 'division', nom: 'Chef de division Infrastructure', email: 'CDD_INFRA.RNS@Sonatrach.dz' },
  { id: 'construction', nom: 'Service Construction', email: 'INFRA_CONSTR.RNS@Sonatrach.dz' },
  { id: 'entretien', nom: 'Service Travaux Entretien', email: 'Service_Travaux_Entretien_INFRA.RNS@Sonatrach.dz' },
  { id: 'electromec', nom: 'Service Électromécanique', email: 'INFRA_ELECTROMEC.RNS@Sonatrach.dz' },
  { id: 'cpm', nom: 'Cellule Passation de marché (CPM)', email: 'RNS.CPM_INFRA@Sonatrach.dz' }
];
function serviceMail_(id) { return SERVICES_MAIL.filter(x => x.id === String(id || ''))[0] || null; }
/** Liste des services proposés à l'écran (sans les adresses). */
function listeServices() { return { success: true, services: SERVICES_MAIL.map(x => ({ id: x.id, nom: x.nom })) }; }
const EMAIL_SECRETARIAT = 'sec.infra.rns@gmail.com';   // reçoit la fiche au clic sur « Envoyer au secrétariat » (jamais d'envoi automatique)
const POURCENTS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
/** Critères de la fiche, dans l'ordre du modèle. Chaque critère a un identifiant (0, 1, 2…) : c'est lui qui porte la note. */
const SECTIONS = [
  { n: 'I', t: 'Qualité des Travaux et /ou Prestations :', groupes: [
    { n: '1', t: 'Engineering :', items: ['Fiabilité des études et documents.', 'Nombre et qualité des documents.'] },
    { n: '2', t: 'Procurement :', items: ['Qualité de la Fourniture exigée.', 'Quantité de la Fourniture exigée / Planning.'] },
    { n: '3', t: 'Construction', items: ['Respect des spécifications techniques, plans, règles de l’art et normes en vigueur.'] },
    { n: '4', t: 'Reporting et Procédures :', items: ['Reporting d’avancement hebdomadaire, mensuel et annuel.', 'Procédures de Control Coûts.', 'Rapport de Clôture.'] },
    { n: '5', t: 'HSE :', items: ['Respect des normes et règles HSE.'] }] },
  { n: 'II', t: 'Délai de réalisation :', items: ['Respect du planning Projet.', 'Planification.', 'Rattrapage des retards.'] },
  { n: 'III', t: 'Moyens humains mis à disposition du projet :', items: ['Management du projet.', 'Nombre du Personnel déployé.', 'Qualification du Personnel déployé.'] },
  { n: 'IV', t: 'Moyens Matériels mis à disposition du projet :', items: ['Nombre des moyens matériels déployés.', 'Qualité des moyens matériels déployés.'] },
  { n: 'V', t: 'Communication :', items: ['Qualité de la communication et Interaction.', 'Temps de réponse aux requêtes et demandes du Maître de l\'Ouvrage.', 'Disponibilité.'] }
];
/** Liste à plat des critères : [{ id, section, groupe, texte }]. */
function criteres_() {
  const out = [];
  SECTIONS.forEach(s => {
    (s.groupes || [{ n: '', t: '', items: s.items }]).forEach(g => g.items.forEach(t => out.push({ id: out.length, section: s.n, groupe: g.n, texte: t })));
  });
  return out;
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Fiche')
    .setTitle('Fiche d’évaluation')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function propre_(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }
function esc_(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function norm_(t) { return propre_(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

/**
 * Taux de satisfaction globale : moyenne des pourcentages cochés (les critères non cochés ne comptent pas), arrondie à 2 décimales ; null si rien n'est coché.
 * notes : { "idCritère": 70, … }. Vérifié sur la fiche ETB ZATOUT ABDENACER : 11 × 70 % + 2 × 80 % → 71,53 %.
 */
function tauxGlobal_(notes) {
  const v = Object.keys(notes || {}).map(k => Number(notes[k])).filter(n => POURCENTS.indexOf(n) >= 0);
  if (!v.length) return null;
  return Math.floor(v.reduce((a, b) => a + b, 0) / v.length * 100 + 1e-9) / 100; // tronqué à 2 décimales comme la fiche Word (71,538… → 71,53)
}
function tauxFr_(t) { return t == null ? '' : String(t).replace('.', ',') + ' %'; }

/** « 53.INFRA.25 » (forme du Suivi CPM) → « I/53/RNS/INFRA/2025 » (forme de la fiche) ; toute autre forme est gardée telle quelle. */
function numeroLong_(n) {
  const v = propre_(n), m = /^(\d{1,3})\s*\.\s*([A-Za-z]+)\s*\.\s*(\d{2})$/.exec(v);
  return m ? 'I/' + m[1] + '/RNS/' + m[2].toUpperCase() + '/20' + m[3] : v;
}
/** Montant du CPM → « 162 300 000,00 DA HT » (nombre seul, avec ou sans espaces / virgule) ; un texte déjà formé est gardé. */
function montantFr_(m) {
  const v = propre_(m); if (!v) return '';
  if (/[a-z]/i.test(v)) return v;
  let t = v.replace(/\s/g, '');
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(/,/g, '');
  const n = Number(t); if (!isFinite(n)) return v + ' DA HT';
  const [e, d] = n.toFixed(2).split('.');
  return e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d + ' DA HT';
}
/** Durée du CPM : plus de 60 = jours, sinon mois (même règle que le Suivi CPM) → « 36 Mois » / « 540 Jours ». */
function delaiFr_(d) {
  const v = propre_(d); if (!v) return '';
  if (/[a-z]/i.test(v)) return v;
  const n = Number(v.replace(',', '.')); if (!isFinite(n)) return v;
  return n > 60 ? n + ' Jours' : n + ' Mois';
}

/** Lignes du Suivi CPM (texte affiché) → contrats en exécution : tout ce que la cartouche demande. Pur : testé en Node. */
function contratsDepuis_(lignes) {
  let h = -1;
  for (let i = 0; i < lignes.length && h < 0; i += 1) if ((lignes[i] || []).some(c => norm_(c) === 'statut')) h = i;
  if (h < 0) h = 1;
  const vus = {}, out = [], v = (r, k) => propre_(r[CPM_COL[k]]);
  lignes.slice(h + 1).forEach(r => {
    if (norm_(v(r, 'statut')).indexOf('execution') < 0) return;
    const brut = v(r, 'n_contrat'); if (!brut || vus[brut]) return; vus[brut] = 1;
    const ods = v(r, 'date_ods');
    out.push({ contrat: numeroLong_(brut), numeroCpm: brut, entrepreneur: v(r, 'attribue_a'), montant: montantFr_(v(r, 'montant')),
      dateOds: ods, dateVigueur: ods, dateService: ods, delai: delaiFr_(v(r, 'duree')), projet: v(r, 'intitule') });
  });
  return out.sort((a, b) => a.entrepreneur.localeCompare(b.entrepreneur, 'fr') || a.contrat.localeCompare(b.contrat));
}

/** Contrats en exécution du Suivi CPM (LECTURE SEULE) : remplissent la cartouche, tout reste modifiable. */
function getContrats() {
  const ss = SpreadsheetApp.openById(SUIVI_CPM_ID);
  const feuille = ss.getSheetByName(SUIVI_CPM_TAB) || ss.getSheets()[0];
  return contratsDepuis_(feuille.getDataRange().getDisplayValues());
}

function dateFr_(t) { const v = propre_(t); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(8) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4) : v; }

/**
 * HTML du PDF : mise en page de la fiche Word (cartouche logo / titre / Réf et date, entrepreneur… délai, projet, tableau des critères avec la case cochée « X », satisfaction globale, suggestions, signatures, NB).
 * data : { cartouche: { ref, date, entrepreneur, contrat, montant, dateOds, dateVigueur, delai, dateService, projet }, notes: { id: pct }, suggestion }. Pur : testé en Node.
 */
function ficheHtml_(data, logoBase64) {
  const c = (data && data.cartouche) || {}, notes = (data && data.notes) || {}, taux = tauxGlobal_(notes);
  const ligne = (lib, val) => '<tr><td class="l"><span style="display:inline-block;width:38%">' + lib + '</span>' + lib + ' ' + esc_(val) + '</td></tr>';
  const cases = id => POURCENTS.map(p => '<td class="x">' + (Number(notes[id]) === p ? 'X' : '&nbsp;') + '</td>').join('');
  // Jamais de ligne coupée entre deux pages : saut de page explicite AVANT la section IV (le tableau reprend alors avec son en-tête)
  const enTete = () => '<tr><td rowspan="2" style="width:5%;text-align:center"><b>N°</b></td><td rowspan="2" style="width:33%;text-align:center"><b>Désignation</b></td><td colspan="10" style="text-align:center"><b>Indice de satisfaction Projet</b></td></tr>' +
    '<tr>' + POURCENTS.map(p => '<td class="x" style="font-size:7.5pt;height:14px">' + p + '%</td>').join('') + '</tr>';
  let corps = '', k = 0;
  SECTIONS.forEach(s => {
    if (s.n === 'IV') corps += '</table><table style="page-break-before:always">' + enTete();
    corps += '<tr><td class="sec" colspan="2"><b>' + s.n + '.&nbsp; ' + esc_(s.t) + '</b></td><td class="x" colspan="10"></td></tr>';
    (s.groupes || [{ n: '', t: '', items: s.items }]).forEach(g => {
      if (s.groupes) corps += '<tr><td class="sec" colspan="2"><b>' + g.n + '.&nbsp; ' + esc_(g.t) + '</b></td><td class="x" colspan="10"></td></tr>';
      g.items.forEach(t => { corps += '<tr><td class="it" colspan="2">▪&nbsp; ' + esc_(t) + '</td>' + cases(k) + '</tr>'; k += 1; });
    });
  });
  const logo = logoBase64 ? '<img src="data:image/png;base64,' + logoBase64 + '" width="86" height="115">' : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#000;margin:0}table{border-collapse:collapse;width:100%}' +
    'tr{page-break-inside:avoid}td{border:1px solid #000;padding:2px 5px;vertical-align:middle}td.l{border:1px solid #000;font-size:9pt;padding:1px 5px}' +
    '.x{width:6.2%;text-align:center;height:19px;font-size:10pt}.sec{padding:5px;font-size:9pt}.it{padding:4px 5px;font-size:8.5pt}' +
    '.titre{text-align:center;font-weight:bold;font-size:10.5pt}.proj{text-align:center;font-weight:bold;font-size:11pt;height:60px}' +
    '</style></head><body>' +
    '<table><tr><td rowspan="2" style="width:22%;text-align:center">' + logo + '</td><td rowspan="2" class="titre" style="width:44%">FICHE D’EVALUATION MENSUELLE<br>DES TRAVAUX ET /OU PRESTATIONS</td><td style="height:45px"><b>Réf :</b> ' + (propre_(c.ref) ? esc_(c.ref) : '……………………') + '</td></tr>' +
    '<tr><td><b>Date : ' + esc_(dateFr_(c.date)) + '</b></td></tr></table>' +
    '<table>' + ligne('Entrepreneur :', c.entrepreneur) + ligne('Contrat :', c.contrat) + ligne('Montant Contractuel :', c.montant) + ligne('Date ODS :', dateFr_(c.dateOds)) +
    ligne('Date d\'entrée en vigueur :', dateFr_(c.dateVigueur)) + ligne('Délai de réalisation :', c.delai) + ligne('Date de mise en service :', dateFr_(c.dateService)) + '</table>' +
    '<table><tr><td class="proj">Projet : ' + esc_(c.projet) + '</td></tr></table>' +
    '<table style="margin-top:2px">' + enTete() + corps +
    '<tr><td class="sec" colspan="2"><b>VI.&nbsp; Satisfaction Globale :</b></td><td colspan="10" style="text-align:right;font-weight:bold;font-size:10.5pt">' + (taux == null ? '' : tauxFr_(taux)) + '</td></tr></table>' +
    '<table><tr><td style="height:60px;vertical-align:top"><b>Suggestion / Axes d’amélioration :</b><br>' + esc_(data.suggestion).replace(/\n/g, '<br>') + '</td></tr>' +
    '<tr><td style="height:55px;vertical-align:top"><b>Signature (Maitre de l’Ouvrage) :</b><span style="display:inline-block;width:45%"></span><b>Signature (Entrepreneur) :</b></td></tr></table>' +
    '<p style="margin:14px 0 2px"><b>NB :</b></p><ul style="margin:0 0 0 18px;padding:0;font-size:10pt"><li>Toute insuffisance doit être consignée dans le rapport journalier ;</li><li>Ce document est renseigné mensuellement sur la base des rapports journaliers ;</li></ul>' +
    '</body></html>';
}

function dossierFiches_() {
  const it = DriveApp.getFoldersByName(DOSSIER_FICHES);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DOSSIER_FICHES);
}
/** Ce qui est gardé dans la description du PDF (assez pour rouvrir la fiche) ; texte limité pour tenir dans la description Drive. */
function resume_(data, taux) {
  const c = data.cartouche || {};
  return JSON.stringify({ v: 1, taux: taux, c: c, n: data.notes || {}, s: propre_(data.suggestion).slice(0, 700) });
}

/** Crée (ou remplace, si fileId est donné) le PDF de la fiche et l'archive. */
function genererFiche(data, fileId) {
  try {
    const c = data.cartouche || {};
    if (!propre_(c.entrepreneur)) throw new Error('Indiquez l\'entrepreneur.');
    if (!propre_(c.contrat)) throw new Error('Indiquez le contrat.');
    const taux = tauxGlobal_(data.notes);
    if (taux == null) throw new Error('Cochez au moins une case : le taux de satisfaction se calcule à partir des cases cochées.');
    const pdf = Utilities.newBlob(ficheHtml_(data, LOGO_B64_), 'text/html', 'fiche.html').getAs('application/pdf');
    const mois = propre_(c.date).replace(/^(\d{4})-(\d{2}).*/, '$1-$2') || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');
    const nom = 'Fiche_evaluation_' + propre_(c.entrepreneur).replace(/[^\wÀ-ÿ]+/g, '_') + '_' + propre_(c.contrat).replace(/[^\wÀ-ÿ]+/g, '-') + '_' + mois + '.pdf';
    if (fileId) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* ancienne version déjà supprimée */ } }
    const f = dossierFiches_().createFile(pdf).setName(nom).setDescription(resume_(data, taux));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, fileId: f.getId(), fileName: nom, pdfUrl: f.getUrl(), downloadUrl: 'https://drive.google.com/uc?export=download&id=' + f.getId(), taux: taux };
  } catch (e) { return { success: false, error: e.message }; }
}

/** Archive : les fiches du dossier, de la plus récente à la plus ancienne. */
function listerFiches() {
  try {
    const it = dossierFiches_().getFilesByType(MimeType.PDF), out = [];
    while (it.hasNext()) {
      const f = it.next(); let d = {};
      try { d = JSON.parse(f.getDescription() || '{}'); } catch (e) { d = {}; }
      const c = d.c || {};
      out.push({ id: f.getId(), nom: f.getName(), entrepreneur: c.entrepreneur || '', contrat: c.contrat || '', projet: c.projet || '', date: c.date || '', taux: d.taux == null ? null : d.taux,
        creeLe: f.getDateCreated().getTime(), url: f.getUrl(), telecharger: 'https://drive.google.com/uc?export=download&id=' + f.getId() });
    }
    out.sort((a, b) => b.creeLe - a.creeLe);
    return { success: true, fiches: out };
  } catch (e) { return { success: false, error: e.message }; }
}

/** Rouvre une fiche archivée : { cartouche, notes, suggestion }. */
function ouvrirFiche(fileId) {
  try {
    const d = JSON.parse(DriveApp.getFileById(fileId).getDescription() || '{}');
    if (!d.c) throw new Error('Cette fiche n\'a pas de réponses enregistrées (créée autrement).');
    return { success: true, cartouche: d.c, notes: d.n || {}, suggestion: d.s || '' };
  } catch (e) { return { success: false, error: e.message }; }
}

function supprimerFiche(fileId) {
  try { DriveApp.getFileById(fileId).setTrashed(true); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}

/** Envoie le PDF d'une fiche archivée au secrétariat (au clic seulement). La fiche doit être dans le dossier d'archive. */
function envoyerFicheAuSecretariat(fileId) {
  try {
    const f = DriveApp.getFileById(String(fileId || '')), ps = f.getParents(), dossier = dossierFiches_(); let ok = false;
    while (ps.hasNext()) if (ps.next().getId() === dossier.getId()) ok = true;
    if (!ok) throw new Error('Cette fiche n\'appartient pas aux fiches archivées.');
    MailApp.sendEmail({ to: EMAIL_SECRETARIAT, subject: 'Fiche d\'évaluation - ' + f.getName(), body: 'Veuillez trouver ci-joint la fiche d\'évaluation mensuelle générée automatiquement.', attachments: [f.getBlob()] });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}
/** Envoie le PDF d'une fiche archivée à la boîte e-mail d'un service (au clic seulement, après confirmation à l'écran). */
function envoyerFicheAuService(fileId, serviceId) {
  try {
    const sv = serviceMail_(serviceId); if (!sv) throw new Error('Service inconnu.');
    const f = DriveApp.getFileById(String(fileId || '')), ps = f.getParents(), dossier = dossierFiches_(); let ok = false;
    while (ps.hasNext()) if (ps.next().getId() === dossier.getId()) ok = true;
    if (!ok) throw new Error('Cette fiche n\'appartient pas aux fiches archivées.');
    MailApp.sendEmail({ to: sv.email, subject: 'Fiche d\'évaluation - ' + f.getName(), body: 'Bonjour,\n\nVeuillez trouver ci-joint la fiche d\'évaluation mensuelle pour votre service.\n\nDivision Infrastructure - RNS', attachments: [f.getBlob()] });
    return { success: true, service: sv.nom };
  } catch (e) { return { success: false, error: e.message }; }
}
/** Contenu du PDF d'une fiche archivée (base64) pour l'impression en un clic depuis le navigateur (brique _output). */
function lireFichierPourImpression(fileId) {
  try {
    const f = DriveApp.getFileById(String(fileId || '')), ps = f.getParents(), dossier = dossierFiches_(); let ok = false;
    while (ps.hasNext()) if (ps.next().getId() === dossier.getId()) ok = true;
    if (!ok) throw new Error('Cette fiche n\'appartient pas aux fiches archivées.');
    return { success: true, nom: f.getName(), base64: Utilities.base64Encode(f.getBlob().getBytes()) };
  } catch (e) { return { success: false, error: e.message }; }
}
/** À lancer UNE FOIS dans l'éditeur Apps Script (▶ Exécuter) pour autoriser l'envoi d'e-mails. */
function autoriserEnvoiMail() { Logger.log('Quota d\'e-mails restant aujourd\'hui : ' + MailApp.getRemainingDailyQuota()); }

function getCriteres() { return { sections: SECTIONS, pourcents: POURCENTS, criteres: criteres_() }; }

const LOGO_B64_ = "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";

if (typeof module !== 'undefined') module.exports = { serviceMail_, listeServices, SERVICES_MAIL, tauxGlobal_, contratsDepuis_, numeroLong_, montantFr_, delaiFr_, ficheHtml_, criteres_, SECTIONS, POURCENTS, tauxFr_, dateFr_, envoyerFicheAuSecretariat, lireFichierPourImpression, EMAIL_SECRETARIAT };
