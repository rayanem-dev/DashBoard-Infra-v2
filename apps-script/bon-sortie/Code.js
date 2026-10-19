// ========================================================================
// BON DE SORTIE MATÉRIEL — Division Infrastructure, Direction Régionale Rhourde Nouss
// Formulaire → PDF (mise en page du « Bon de sortie matériels Vierge ») → e-mail. Les personnes viennent de BDDORGA.
// ========================================================================

const SHEET_ID = '1Thk_-DUr1q9fetPX7W8qg2_SVNRhF_7LtD3xTZfn-OA'; // fichier Organigramme (même que Dotation)
const SHEET_TAB = 'BDDORGA';
const DOSSIER_PDF = 'Bons de sortie matériel';       // créé au premier bon, dans « Mon Drive » du compte qui déploie
const ENQUETES_ID = '1EQMsT8IeOF9ky9eOx7S3jXoq7jmcikjyVVuwryf0Npo'; // Enquêtes administratives : proposées pour le preneur (copie de badges/badges.js = BadgesMoteur.gs au déploiement)
const ONGLET_SIGNATAIRES = 'Signataires';      // onglet du fichier Organigramme : une colonne « nom et prénom » = les personnes autorisées à signer (« Je soussigné »)
const SIGNATAIRES = [];                         // ou noms écrits ici (en plus de l'onglet). Vide partout = tout BDDORGA peut signer
const EMAIL_SECRETARIAT = 'sec.infra.rns@gmail.com'; // destinataire par défaut
const PRINTBYXEROX_EMAIL = 'print@PrintByXerox.com';

// Colonnes de BDDORGA repérées par le NOM de leur en-tête (plusieurs libellés acceptés)
const ENTETES_ = {
  nom: ['nom et prenom', 'nom prenom', 'nom'],
  fonction: ['fonction', 'poste', 'intitule du poste'],
  matricule: ['matricule'],
  service: ['service'],
  dependance: ['dependance', 'employeur']
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('BonSortie')
    .setTitle('Bon de sortie matériel')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function normaliser_(t) { return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function propre_(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }

/** Lignes de BDDORGA → personnes { nom, fonction, matricule, service, dependance } (les colonnes absentes restent vides). Pur : testé en Node. */
function lirePersonnes_(valeurs) {
  const entetes = (valeurs[0] || []).map(normaliser_), idx = {};
  Object.keys(ENTETES_).forEach(k => { idx[k] = -1; ENTETES_[k].some(n => { const i = entetes.lastIndexOf(n); if (i >= 0) { idx[k] = i; return true; } return false; }); });
  if (idx.nom < 0) throw new Error('Colonne « nom et prénom » introuvable dans l\'onglet ' + SHEET_TAB + ' (en-têtes lus : ' + (valeurs[0] || []).join(' | ') + ').');
  const val = (r, k) => idx[k] >= 0 ? propre_(r[idx[k]]) : '';
  const vus = {};
  return valeurs.slice(1).map(r => ({ nom: val(r, 'nom'), fonction: val(r, 'fonction'), matricule: val(r, 'matricule'), service: val(r, 'service'), dependance: val(r, 'dependance') }))
    .filter(p => { const k = normaliser_(p.nom); if (!k || vus[k]) return false; vus[k] = 1; return true; })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

function personnesBddorga_() {
  const feuille = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_TAB);
  if (!feuille) throw new Error('Onglet « ' + SHEET_TAB + ' » introuvable dans le fichier Organigramme.');
  return lirePersonnes_(feuille.getDataRange().getValues());
}

/** Noms désignés dans l'onglet « Signataires » (colonne « nom et prénom » ou « nom ») ; pur : testé en Node. */
function lireSignataires_(valeurs) {
  const entetes = (valeurs[0] || []).map(normaliser_);
  let c = entetes.indexOf('nom et prenom'); if (c < 0) c = entetes.indexOf('nom'); if (c < 0) c = 0;
  return valeurs.slice(1).map(r => propre_(r[c])).filter(Boolean);
}
/** Parmi les personnes de BDDORGA, celles qui sont désignées (nom reconnu même si l'ordre ou la casse diffèrent). Pur : testé en Node. */
function filtrerSignataires_(personnes, noms) {
  const cle = t => normaliser_(t).split(' ').filter(Boolean).sort().join(' ');
  const voulus = {}; noms.forEach(n => voulus[cle(n)] = 1);
  return personnes.filter(p => voulus[cle(p.nom)]);
}
function nomsSignataires_() {
  let noms = SIGNATAIRES.slice();
  try {
    const f = SpreadsheetApp.openById(SHEET_ID).getSheetByName(ONGLET_SIGNATAIRES);
    if (f) noms = noms.concat(lireSignataires_(f.getDataRange().getValues()));
  } catch (e) { /* onglet illisible : on s'en tient à la liste du code */ }
  return noms;
}

/** « Je soussigné(e) » : les signataires désignés ; si personne n'est désigné, tout BDDORGA (restreint = false). */
function getSignataires() {
  const tous = personnesBddorga_(), noms = nomsSignataires_();
  if (!noms.length) return { liste: tous, restreint: false };
  const liste = filtrerSignataires_(tous, noms);
  if (!liste.length) throw new Error('Aucun signataire désigné n\'a été retrouvé dans BDDORGA : vérifiez l\'onglet « ' + ONGLET_SIGNATAIRES + ' ».');
  return { liste: liste, restreint: true };
}

/** Une fois, depuis l'éditeur : crée l'onglet « Signataires » (à remplir : un nom par ligne, comme dans BDDORGA). */
function creerOngletSignataires() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  if (ss.getSheetByName(ONGLET_SIGNATAIRES)) { Logger.log('L\'onglet existe déjà.'); return; }
  const f = ss.insertSheet(ONGLET_SIGNATAIRES);
  f.getRange(1, 1, 1, 2).setValues([['nom et prénom', 'remarque']]).setFontWeight('bold');
  f.getRange(2, 2).setValue('Un nom par ligne, écrit comme dans BDDORGA. Seules ces personnes pourront signer un bon de sortie (« Je soussigné »). Onglet vide = tout le monde.');
  f.setColumnWidth(1, 280); f.setFrozenRows(1);
  Logger.log('Onglet « ' + ONGLET_SIGNATAIRES + ' » créé.');
}

/** Personnes des Enquêtes administratives : { nom, fonction, matricule: '', service: entreprise, dependance: '', source: 'enquetes' }. */
function personnesEnquetes_() {
  const ss = SpreadsheetApp.openById(ENQUETES_ID), out = [];
  ss.getSheets().forEach(sh => {
    const a = Badges.analyserEnquetes(sh.getDataRange().getDisplayValues(), sh.getName());
    (a.personnes || []).forEach(p => out.push({ nom: (Badges.majNom(p.nom) + ' ' + Badges.capPrenom(p.prenom)).trim(), fonction: p.fonction || '', matricule: '', service: a.entreprise || sh.getName(), dependance: '', source: 'enquetes' }));
  });
  return out;
}
/** Fusion sans doublon (BDDORGA d'abord). Pur : testé en Node. */
function fusionnerPersonnes_(bddorga, enquetes) {
  const cle = t => normaliser_(t).split(' ').filter(Boolean).sort().join(' '), vus = {}, out = [];
  bddorga.map(p => Object.assign({ source: 'bddorga' }, p)).concat(enquetes).forEach(p => { const k = cle(p.nom); if (!k || vus[k]) return; vus[k] = 1; out.push(p); });
  return out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}
/** « Autorise » (le preneur) : BDDORGA + Enquêtes administratives ; la saisie libre reste possible. Gardé 10 minutes. */
function getPreneurs() {
  const cache = CacheService.getScriptCache(), vu = cache.get('PRENEURS');
  if (vu) { try { return JSON.parse(vu); } catch (e) { /* relire */ } }
  const bdd = personnesBddorga_(); let enq = [], avert = '';
  try { enq = personnesEnquetes_(); } catch (e) { avert = 'Enquêtes indisponibles : ' + e.message; }
  const r = { liste: fusionnerPersonnes_(bdd, enq), avertissement: avert };
  try { const t = JSON.stringify(r); if (t.length < 95000 && !avert) cache.put('PRENEURS', t, 600); } catch (e) { /* trop gros : pas de cache */ }
  return r;
}

function esc_(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
const POINTS_ = '.......................................................';
function ou_(t, points) { const v = propre_(t); return v ? '<b>' + esc_(v) + '</b>' : (points || POINTS_); }
function dateFr_(t) { const v = propre_(t); if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(8) + '/' + v.slice(5, 7) + '/' + v.slice(0, 4); return v; }

/**
 * HTML du bon (mise en page du modèle Word : en-tête Sonatrach, titre, deux phrases, matériel, lieux, trois signatures, instruction, NB, pied).
 * data : { soussigne, autorise: { nom, fonction, matricule }, materiel, lieuEnlevement, lieuDestination, habilite / preneur / sie: { date, structure }, instruction }. Pur : testé en Node.
 */
function bonHtml_(data, logoBase64) {
  data = data || {};
  const s = data.soussigne || {}, a = data.autorise || {}, h = data.habilite || {}, p = data.preneur || {}, c = data.sie || {};
  // Une ligne par matériel, précédée d'un tiret (le tiret saisi par l'agent n'est pas doublé)
  const lignesMat = String(data.materiel == null ? '' : data.materiel).split(/\r?\n/).map(l => l.replace(/^\s*[-–•]\s*/, '').trim()).filter(Boolean);
  const materiel = lignesMat.length ? lignesMat.map(l => '- ' + esc_(l)).join('<br>') : ('<span class="pts">' + POINTS_.repeat(12) + '</span>');
  const bloc = (titre, d, qui, visa) => '<td class="sig"><div class="sh">' + titre + '</div><div class="sl">Date : ' + (propre_(d.date) ? '<b>' + esc_(dateFr_(d.date)) + '</b>' : '...........') + '</div>' +
    '<div class="sl">Structure : ' + (propre_(d.structure) ? '<b>' + esc_(d.structure) + '</b>' : '.......') + '</div><div class="sv"><br>' + visa + (qui ? '<br><br><i>' + esc_(qui) + '</i>' : '') + '</div></td>';
  const logo = logoBase64 ? '<img src="data:image/jpeg;base64,' + logoBase64 + '" width="72" height="108">' : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#000;margin:0}' +
    '.ent{font-size:9.5pt;font-weight:bold;line-height:1.5}' +
    'h1{text-align:center;font-size:20pt;margin:16px 0 18px}' +
    'p{margin:0 0 14px;line-height:1.6}.pts{letter-spacing:0}' +
    'table{border-collapse:collapse;width:100%}' +
    '.mat{font-weight:bold;font-size:13pt;text-align:left;margin:0 0 16px;line-height:1.5}.lieux td{border:1px solid #000;width:50%;height:36px;padding:4px 6px;text-align:center;vertical-align:middle;font-weight:bold;font-size:13pt}.lieux .t{height:22px;font-size:11pt}' +
    '.sigs{margin-top:22px}.sigs td.sig{border:1px solid #000;width:33.33%;vertical-align:top;padding:3px 5px;font-size:10pt}.sh{text-align:center;font-weight:bold;border-bottom:1px solid #000;margin:-3px -5px 3px;padding:3px}' +
    '.sl{border-bottom:1px solid #000;margin:0 -5px;padding:1px 5px}.sv{height:85px;padding-top:6px}' +
    '.instr{margin-top:26px;font-weight:bold;font-size:12pt}.nb{margin-top:10px}' +
    '.pied{margin-top:26px;border-top:3px solid #E58A00;padding-top:6px;text-align:center;font-size:8pt;line-height:1.7}' +
    '</style></head><body>' +
    '<table><tr><td style="width:90px;vertical-align:top">' + logo + '</td><td style="vertical-align:top"><div style="border-top:3px solid #E58A00;margin-top:50px;margin-left:120px"></div></td></tr></table>' +
    '<div class="ent">Activité Exploration - Production<br>Division Production<br>Direction Régionale Rhourde Nouss<br>Division Infrastructure</div>' +
    '<h1>Bon De Sortie Matériel</h1>' +
    '<p>Je soussigné(e) M. ' + ou_(s.nom, '........................................') + ' Fonction ' + ou_(s.fonction, '....................') + ' Matricule ' + ou_(s.matricule, '....................') + '</p>' +
    '<p>Autorise M. ' + ou_(a.nom, '........................................') + ' Fonction ' + ou_(a.fonction, '....................') + ' Matricule ' + ou_(a.matricule, '....................') + '</p>' +
    '<p style="margin-bottom:6px">À faire sortir le matériel suivant : (en chiffre et en lettre)</p><div class="mat">' + materiel + '</div>' +
    '<table class="lieux"><tr><td class="t">Lieu d’enlèvement</td><td class="t">Lieu de destination</td></tr><tr><td>' + esc_(data.lieuEnlevement) + '</td><td>' + esc_(data.lieuDestination) + '</td></tr></table>' +
    '<table class="sigs"><tr>' + bloc('Personne habilitée', h, s.nom, 'Nom et Visa') + bloc('Preneur', p, a.nom, 'Nom et Visa') + bloc('Contrôlé par SIE', c, '', 'Nom et Visa du Chef de poste SIE') + '</tr></table>' +
    '<div class="instr">Instruction particulière</div>' + (propre_(data.instruction) ? '<p>' + esc_(data.instruction).replace(/\n/g, '<br>') + '</p>' : '<p>&nbsp;</p>') +
    '<div class="nb">NB : Le bon de sortie doit être établi en deux exemplaires.</div>' +
    '<div class="pied">Direction Régionale Rhourde-Nouss - BP 27 Hassi Messaoud – Ouargla Algérie<br>Tél. : 029 74 01 48 &nbsp; Fax : 029 74 01 40 &nbsp; www.sonatrach.dz &nbsp; Secrétariat.RNS@sonatrach.dz</div>' +
    '</body></html>';
}

function dossierPdf_() {
  const it = DriveApp.getFoldersByName(DOSSIER_PDF);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DOSSIER_PDF);
}

/** Crée le PDF du bon dans Drive. Retourne { success, fileId, fileName, pdfUrl, downloadUrl }. */
function genererBon(data) {
  try {
    if (!propre_((data.soussigne || {}).nom)) throw new Error('Choisissez la personne qui signe le bon (« Je soussigné »).');
    const sig = getSignataires(); // contrôle côté serveur : seul un signataire désigné peut signer
    if (sig.restreint && !filtrerSignataires_([{ nom: data.soussigne.nom }], sig.liste.map(p => p.nom)).length) throw new Error('« ' + propre_(data.soussigne.nom) + ' » n\'est pas désigné(e) comme signataire.');
    if (!propre_((data.autorise || {}).nom)) throw new Error('Choisissez la personne autorisée à faire sortir le matériel.');
    if (!propre_(data.materiel)) throw new Error('Indiquez le matériel à faire sortir.');
    const pdf = Utilities.newBlob(bonHtml_(data, LOGO_B64_), 'text/html', 'bon.html').getAs('application/pdf');
    const jour = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
    const nom = 'Bon_de_sortie_' + propre_(data.autorise.nom).replace(/[^\wÀ-ÿ]+/g, '_') + '_' + jour + '.pdf';
    const fichier = dossierPdf_().createFile(pdf).setName(nom);
    fichier.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, fileId: fichier.getId(), fileName: nom, pdfUrl: fichier.getUrl(), downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fichier.getId() };
  } catch (e) { return { success: false, error: e.message }; }
}

function adressesValides_(texte) {
  return String(texte || '').split(/[,;\s]+/).map(x => x.trim()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
}

/** Envoie le PDF par e-mail : au secrétariat et aux adresses ajoutées. { fileId, destinataires, message } */
function envoyerBon(fileId, destinataires, message) {
  try {
    const fichier = DriveApp.getFileById(fileId);
    const dest = Array.from(new Set([EMAIL_SECRETARIAT].concat(adressesValides_(destinataires))));
    MailApp.sendEmail({ to: dest.join(','), subject: 'Bon de sortie matériel — ' + fichier.getName().replace(/\.pdf$/, ''),
      body: (propre_(message) ? propre_(message) + '\n\n' : '') + 'Veuillez trouver ci-joint le bon de sortie matériel (à imprimer en deux exemplaires).\n\n— Division Infrastructure RNS',
      attachments: [fichier.getBlob()] });
    return { success: true, destinataires: dest };
  } catch (e) { return { success: false, error: e.message }; }
}

function envoyerImpression(fileId) {
  try {
    const f = DriveApp.getFileById(fileId);
    MailApp.sendEmail({ to: PRINTBYXEROX_EMAIL, subject: f.getName(), body: 'Document envoyé automatiquement depuis le bon de sortie matériel.', attachments: [f.getBlob()] });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

function supprimerBon(fileId) {
  try { DriveApp.getFileById(fileId).setTrashed(true); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}

const LOGO_B64_ = "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";

if (typeof module !== 'undefined') module.exports = { lirePersonnes_, bonHtml_, adressesValides_, dateFr_, lireSignataires_, filtrerSignataires_, fusionnerPersonnes_ };
