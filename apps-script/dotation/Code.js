// ========================================================================
// DOTATIONS - Division Infrastructure Sonatrach RNS (VIVRES + EAU + ENTRETIEN + DIVISION)
// ========================================================================

const DOC_TEMPLATE_ID = '1woGvBaAaWMTuotbofnsVrr8WVbvdyF_NBAmpPdjqTvI';
const EAU_TEMPLATE_ID = '1Vp1Ic4TsxX_dktESec-fjXP8x_I6W-fBb16i0JH9dCw';
const ENTRETIEN_TEMPLATE_ID = '11DHNDUKWdfv5l3DLGl51eJUPG3KF7pTQ7no4CXv9rPg'; // Google Doc (l'ancien identifiant était un .docx, que DocumentApp ne sait pas ouvrir)
const DIVISION_TEMPLATE_ID = '16ZwFUJrw_-UjbeEeKfiy8YErNst2tYPvkY9MUXKLtYQ';
const SHEET_ID = '1Thk_-DUr1q9fetPX7W8qg2_SVNRhF_7LtD3xTZfn-OA';
const SHEET_TAB = 'BDDORGA';

// Les colonnes sont repérées par le NOM de leur en-tête (et non par leur numéro) : le fichier Organigramme peut être réorganisé sans casser la dotation.
// Plusieurs libellés sont acceptés pour chaque colonne (ancien et nouveau format).
const ENTETES_ = {
  nom: ['nom et prenom', 'nom prenom', 'nom'],
  service: ['service'],
  dependance: ['dependance', 'employeur']
};

function normalizeService(raw) {
  raw = (raw || '').toString().trim();
  if (raw === '' || raw.indexOf('Division Infrastructures') !== -1) return 'Division Infrastructure';
  const t = normalizeTxt_(raw);
  if (t.indexOf('genie civil') !== -1 || t.indexOf('construction') !== -1) return 'Service Construction (Génie Civil)';
  if (t.indexOf('entretien') !== -1) return 'Service Travaux Entretien';
  if (t.indexOf('electrom') !== -1) return 'Service Electromécanique';
  return raw;
}

// Vivres + Eau ne proposent plus que ces 3 services
// (Division Infrastructure a désormais son propre type de dotation séparé,
// Secrétariat / Cellule Passation / Ordonnancement sont retirés du choix)
const SERVICES_VIVRES_EAU = [
  'Service Construction (Génie Civil)',
  'Service Travaux Entretien',
  'Service Electromécanique'
];

const IMPUTATION_MAP = {
  'Service Construction (Génie Civil)': '4300045300',
  'Service Travaux Entretien': '4300045200',
  'Service Electromécanique': '4300045100'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Dotation')
    .setTitle('Dotations - Division Infrastructure');
}

// Lignes de BDDORGA sous la forme { nom, service, dependance }, d'après les en-têtes de la première ligne.
function getOrgData_() {
  const feuille = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_TAB);
  if (!feuille) throw new Error('Onglet « ' + SHEET_TAB + ' » introuvable dans le fichier Organigramme.');
  return lireOrg_(feuille.getDataRange().getValues());
}

function lireOrg_(values) {
  const entetes = (values[0] || []).map(normalizeTxt_);
  const idx = {};
  Object.keys(ENTETES_).forEach(k => {
    idx[k] = -1;
    ENTETES_[k].some(nom => { const i = entetes.indexOf(nom); if (i >= 0) { idx[k] = i; return true; } return false; });
    if (idx[k] < 0) throw new Error('Colonne « ' + ENTETES_[k][0] + ' » introuvable dans l\'onglet ' + SHEET_TAB + ' (en-têtes lus : ' + (values[0] || []).join(' | ') + ').');
  });
  return values.slice(1).map(r => ({ nom: r[idx.nom], service: r[idx.service], dependance: r[idx.dependance] }));
}

function getServices() {
  return SERVICES_VIVRES_EAU;
}

// Ne retourne que le personnel Sonatrach (colonne « dependance » = "SONATRACH"),
// les sous-traitants (ACOSCO, GTP, etc.) sont exclus.
function getPersonnel(service) {
  const noms = [];
  getOrgData_().forEach(r => {
    const nom = (r.nom || '').toString().trim();
    const dependance = (r.dependance || '').toString().trim().toUpperCase();
    if (normalizeService(r.service) === service && nom && dependance === 'SONATRACH') {
      noms.push(nom);
    }
  });
  return noms;
}

function calcCafe(n) {
  if (n <= 0) return '0 GR';
  return (Math.ceil(n / 2) * 250) + ' GR';
}

// Affichage simple : "12 Bouteilles 1L"
function calcQuantiteEau(nAgents, format, dureeJours) {
  if (nAgents <= 0) return '0 Bouteilles ' + format;
  const semaines = Math.max(1, Math.ceil(dureeJours / 7));
  const fardeauxParAgent = semaines;
  const totalFardeaux = nAgents * fardeauxParAgent;
  const bouteillesParFardeau = (format === '0.5L') ? 12 : 6;
  const totalBouteilles = totalFardeaux * bouteillesParFardeau;
  return totalBouteilles + ' Bouteilles ' + format;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function getDossierParent_(templateId) {
  return DriveApp.getFileById(templateId).getParents().next();
}

function normalizeTxt_(s) {
  return (s || '').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ------------------------------------------------------------------------
// Point d'entrée unique appelé par le formulaire
// ------------------------------------------------------------------------
function genererDotation(form) {
  if (form.type === 'EAU') return genererDotationEau_(form);
  if (form.type === 'ENTRETIEN') return genererDotationEntretien_(form);
  if (form.type === 'DIVISION') return genererDotationDivision_(form);
  return genererDotationVivres_(form);
}

function genererDotationVivres_(form) {
  try {
    const dureeJours = 7;
    const dateFr = Utilities.formatDate(new Date(form.date), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const dateDebutFr = Utilities.formatDate(new Date(form.dateDebut), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const dateFinFr = addDays(form.dateDebut, dureeJours);

    const qteCafe = form.qteCafeManuel || calcCafe(form.presents.length);
    const imputation = IMPUTATION_MAP[form.service] || '';
    const observations = form.presents.join('\n');

    const dossierParent = getDossierParent_(DOC_TEMPLATE_ID);
    const nomBase = 'DOTATION_VIVRES_' + form.service + '_' + dateDebutFr.replace(/\//g, '-');

    const copie = DriveApp.getFileById(DOC_TEMPLATE_ID).makeCopy(nomBase, dossierParent);
    const doc = DocumentApp.openById(copie.getId());
    const body = doc.getBody();

    body.replaceText('{{DATE}}', dateFr);
    body.replaceText('{{TYPE}}', 'VIVRES');
    body.replaceText('{{DATE_DEBUT}}', dateDebutFr);
    body.replaceText('{{DATE_FIN}}', dateFinFr);
    body.replaceText('{{QTE_CAFE}}', qteCafe);
    body.replaceText('{{IMPUTATION}}', imputation);
    body.replaceText('{{SERVICE}}', form.service);
    body.replaceText('{{OBSERVATIONS}}', observations);
    body.replaceText('{{QTE_SUCRE}}', form.qteSucre || '01 boite');
    body.replaceText('{{QTE_GOBELET}}', form.qteGobelet || '01 Paquet');
    body.replaceText('{{QTE_THE}}', form.qteThe || '01 paquet');
    body.replaceText('{{QTE_CUILLERES}}', form.qteCuilleres || '25 pièces');
    body.replaceText('{{QTE_SERVIETTES}}', form.qteServiettes || '01 paquet');

    doc.saveAndClose();

    const pdfBlob = doc.getAs('application/pdf');
    const pdfFile = dossierParent.createFile(pdfBlob);
    pdfFile.setName(nomBase + '.pdf');

    return { success: true, docUrl: copie.getUrl(), pdfUrl: pdfFile.getUrl(),
             docId: copie.getId(), pdfId: pdfFile.getId(), nom: nomBase };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function genererDotationEau_(form) {
  try {
    const dureeJours = 7;
    const dateFr = Utilities.formatDate(new Date(form.date), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const dateDebutFr = Utilities.formatDate(new Date(form.dateDebut), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const dateFinFr = addDays(form.dateDebut, dureeJours);
    const imputation = IMPUTATION_MAP[form.service] || '';
    const format = form.format || '1L';
    const quantite = calcQuantiteEau(form.presents.length, format, dureeJours);

    const dossierParent = getDossierParent_(EAU_TEMPLATE_ID);
    const nomBase = 'DOTATION_EAU_' + form.service + '_' + dateDebutFr.replace(/\//g, '-');

    const copie = DriveApp.getFileById(EAU_TEMPLATE_ID).makeCopy(nomBase, dossierParent);
    const doc = DocumentApp.openById(copie.getId());
    const body = doc.getBody();

    body.replaceText('{{DATE}}', dateFr);
    body.replaceText('{{NOMS}}', form.presents.join('\n'));
    body.replaceText('{{PERIODE_DEBUT}}', dateDebutFr);
    body.replaceText('{{PERIODE_FIN}}', dateFinFr);
    body.replaceText('{{QUANTITE}}', quantite);
    body.replaceText('{{IMPUTATION}}', imputation);
    body.replaceText('{{SERVICE}}', form.service);
    body.replaceText('{{OBSERVATIONS}}', form.service);

    doc.saveAndClose();

    const pdfBlob = doc.getAs('application/pdf');
    const pdfFile = dossierParent.createFile(pdfBlob);
    pdfFile.setName(nomBase + '.pdf');

    return { success: true, docUrl: copie.getUrl(), pdfUrl: pdfFile.getUrl(),
             docId: copie.getId(), pdfId: pdfFile.getId(), nom: nomBase };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ===================== PRODUITS D'ENTRETIEN =====================

const ATELIERS = [
  'Atelier Electricité',
  'Atelier Froid',
  'Atelier Hydraulique',
  'Atelier Génie Civil'
];

const IMPUTATION_ENTRETIEN_MAP = {
  'Atelier Electricité': '4300045100',
  'Atelier Froid': '4300045100',
  'Atelier Hydraulique': '4300045200',
  'Atelier Génie Civil': '4300045300'
};

const PRODUITS_ENTRETIEN = [
  { nom: 'Savon poudre', qte: 3 },
  { nom: 'Savon liquide', qte: 3 },
  { nom: 'Savon morceau', qte: 0 },
  { nom: 'Eau de javel', qte: 3 },
  { nom: 'Sani bon', qte: 2 },
  { nom: 'Grésil', qte: 0 },
  { nom: 'Esprit de sel', qte: 2 },
  { nom: 'Balai avec manche', qte: 0 },
  { nom: 'Frottoir', qte: 0 },
  { nom: 'Serpillère', qte: 2 },
  { nom: 'Eponge', qte: 3 },
  { nom: 'Fly-tox', qte: 3 }
];

const MOIS_FR = ['JANVIER','FÉVRIER','MARS','AVRIL','MAI','JUIN','JUILLET',
                  'AOÛT','SEPTEMBRE','OCTOBRE','NOVEMBRE','DÉCEMBRE'];

function getAteliers() {
  return ATELIERS;
}

function getProduitsEntretien() {
  return PRODUITS_ENTRETIEN;
}

function getImputationEntretien(atelier) {
  return IMPUTATION_ENTRETIEN_MAP[atelier] || '';
}

function getPeriodeActuelle_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const mois = MOIS_FR[parseInt(Utilities.formatDate(now, tz, 'M'), 10) - 1];
  const annee = Utilities.formatDate(now, tz, 'yyyy');
  return mois + ' ' + annee;
}

// Règle métier : la demande n'est ouverte qu'entre le 01 et le 15 du mois en cours
function verifierFenetreEntretien() {
  const tz = Session.getScriptTimeZone();
  const jour = parseInt(Utilities.formatDate(new Date(), tz, 'd'), 10);
  return { ouvert: (jour >= 1 && jour <= 15), jour: jour };
}

function genererDotationEntretien_(form) {
  try {
    const fenetre = verifierFenetreEntretien();
    if (!fenetre.ouvert) {
      return { success: false, error: "La demande de dotation produits d'entretien ne peut être établie qu'entre le 01 et le 15 du mois. Merci de réessayer durant cette période." };
    }

    const dateFr = Utilities.formatDate(new Date(form.date), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const periode = getPeriodeActuelle_();
    const imputation = form.imputation || IMPUTATION_ENTRETIEN_MAP[form.atelier] || '';

    const dossierParent = getDossierParent_(ENTRETIEN_TEMPLATE_ID);
    const nomBase = 'DOTATION_ENTRETIEN_' + form.atelier.replace(/\s+/g, '_') + '_' + periode.replace(/\s+/g, '-');

    const copie = DriveApp.getFileById(ENTRETIEN_TEMPLATE_ID).makeCopy(nomBase, dossierParent);
    const doc = DocumentApp.openById(copie.getId());
    const body = doc.getBody();

    body.replaceText('{{DATE}}', dateFr);
    body.replaceText('{{PERIODE}}', periode);
    body.replaceText('{{IMPUTATION}}', imputation);
    body.replaceText('{{OBSERVATIONS}}', form.atelier);

    const table = body.getTables()[0];
    const numRows = table.getNumRows();
    for (let i = 0; i < numRows; i++) {
      const row = table.getRow(i);
      if (row.getNumCells() < 2) continue;
      const designation = normalizeTxt_(row.getCell(0).getText());
      const produit = PRODUITS_ENTRETIEN.find(p => normalizeTxt_(p.nom) === designation);
      if (produit) {
        const qteChoisie = (form.quantites && form.quantites[produit.nom] !== undefined && form.quantites[produit.nom] !== '')
          ? parseInt(form.quantites[produit.nom], 10) : produit.qte;
        const qteFormatee = (qteChoisie < 10 ? '0' : '') + qteChoisie;
        row.getCell(1).setText(qteFormatee);
      }
    }

    doc.saveAndClose();

    const pdfBlob = doc.getAs('application/pdf');
    const pdfFile = dossierParent.createFile(pdfBlob);
    pdfFile.setName(nomBase + '.pdf');

    return { success: true, docUrl: copie.getUrl(), pdfUrl: pdfFile.getUrl(),
             docId: copie.getId(), pdfId: pdfFile.getId(), nom: nomBase };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ===================== DOTATION DIVISION (quinzaine) =====================

// Quantités fixes par défaut, éditables au moment de la génération
const PRODUITS_DIVISION = [
  { nom: 'Café capsule', qte: '02 boites de 10 unités' },
  { nom: 'Café moulu', qte: '250 g' },
  { nom: 'Jus 1/6', qte: '27 Boites' },
  { nom: 'Sucre morceau', qte: '01 boite' },
  { nom: 'Chocolat tablette', qte: '03 unités' },
  { nom: 'Gaufrette', qte: '02 tablettes' },
  { nom: 'Biscuit', qte: '02 paquets' },
  { nom: 'Soda', qte: '18 canettes 33cl' },
  { nom: 'Goblet', qte: '50 pièces' },
  { nom: 'Cuillères jetables', qte: '50 pièces' },
  { nom: 'Serviettes en papier', qte: '01 paquet' },
  { nom: 'Eau minérale 1.5 L', qte: '12 Bouteilles Guedilla' },
  { nom: 'Eau minérale 0.5 L', qte: '48 Bouteille Guedilla' }
];

const IMPUTATION_DIVISION = '4300045000';
const OBSERVATION_DIVISION = 'Chef de Division Infrastructures';

function getProduitsDivision() {
  return PRODUITS_DIVISION;
}

// Calcule automatiquement la quinzaine (01-15 ou 16-fin de mois) à partir d'une date
function getPeriodeQuinzaine_(dateStr) {
  const d = new Date(dateStr);
  const annee = d.getFullYear();
  const mois = d.getMonth(); // 0-11
  const jour = d.getDate();
  const tz = Session.getScriptTimeZone();
  let debut, fin;
  if (jour <= 15) {
    debut = new Date(annee, mois, 1);
    fin = new Date(annee, mois, 15);
  } else {
    debut = new Date(annee, mois, 16);
    fin = new Date(annee, mois + 1, 0); // dernier jour du mois
  }
  return {
    debut: Utilities.formatDate(debut, tz, 'dd/MM/yyyy'),
    fin: Utilities.formatDate(fin, tz, 'dd/MM/yyyy')
  };
}

// Appelé depuis le front pour afficher la période avant génération
function getPeriodeDivisionPreview(dateStr) {
  return getPeriodeQuinzaine_(dateStr);
}

function genererDotationDivision_(form) {
  try {
    const dateFr = Utilities.formatDate(new Date(form.date), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const periode = getPeriodeQuinzaine_(form.date);

    const dossierParent = getDossierParent_(DIVISION_TEMPLATE_ID);
    const nomBase = 'DOTATION_DIVISION_' + periode.debut.replace(/\//g, '-') + '_au_' + periode.fin.replace(/\//g, '-');

    const copie = DriveApp.getFileById(DIVISION_TEMPLATE_ID).makeCopy(nomBase, dossierParent);
    const doc = DocumentApp.openById(copie.getId());
    const body = doc.getBody();

    body.replaceText('{{DATE}}', dateFr);
    body.replaceText('{{PERIODE_DEBUT}}', periode.debut);
    body.replaceText('{{PERIODE_FIN}}', periode.fin);
    body.replaceText('{{IMPUTATION}}', IMPUTATION_DIVISION);
    body.replaceText('{{OBSERVATIONS}}', OBSERVATION_DIVISION);

    const table = body.getTables()[0];
    const numRows = table.getNumRows();
    for (let i = 0; i < numRows; i++) {
      const row = table.getRow(i);
      if (row.getNumCells() < 2) continue;
      const designation = normalizeTxt_(row.getCell(0).getText());
      const produit = PRODUITS_DIVISION.find(p => normalizeTxt_(p.nom) === designation);
      if (produit) {
        const qteChoisie = (form.quantites && form.quantites[produit.nom] !== undefined && form.quantites[produit.nom] !== '')
          ? form.quantites[produit.nom] : produit.qte;
        row.getCell(1).setText(qteChoisie);
      }
    }

    doc.saveAndClose();

    const pdfBlob = doc.getAs('application/pdf');
    const pdfFile = dossierParent.createFile(pdfBlob);
    pdfFile.setName(nomBase + '.pdf');

    return { success: true, docUrl: copie.getUrl(), pdfUrl: pdfFile.getUrl(),
             docId: copie.getId(), pdfId: pdfFile.getId(), nom: nomBase };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ------------------------------------------------------------------------
// Historique (Vivres + Eau + Entretien + Division confondus)
// ------------------------------------------------------------------------
function listerDotationsGenerees() {
  try {
    const configs = [
      { type: 'VIVRES', dossier: getDossierParent_(DOC_TEMPLATE_ID), prefixe: 'DOTATION_VIVRES_' },
      { type: 'EAU', dossier: getDossierParent_(EAU_TEMPLATE_ID), prefixe: 'DOTATION_EAU_' },
      { type: 'ENTRETIEN', dossier: getDossierParent_(ENTRETIEN_TEMPLATE_ID), prefixe: 'DOTATION_ENTRETIEN_' },
      { type: 'DIVISION', dossier: getDossierParent_(DIVISION_TEMPLATE_ID), prefixe: 'DOTATION_DIVISION_' }
    ];
    const map = {};

    configs.forEach(cfg => {
      const fichiers = cfg.dossier.getFiles();
      while (fichiers.hasNext()) {
        const f = fichiers.next();
        const nom = f.getName();
        if (nom.indexOf(cfg.prefixe) !== 0) continue;
        const base = nom.replace(/\.pdf$/i, '');
        if (!map[base]) map[base] = { nom: base, type: cfg.type, date: f.getDateCreated(), docId: null, pdfId: null };
        if (f.getMimeType() === MimeType.GOOGLE_DOCS) map[base].docId = f.getId();
        else if (f.getMimeType() === MimeType.PDF) map[base].pdfId = f.getId();
        if (f.getDateCreated() > map[base].date) map[base].date = f.getDateCreated();
      }
    });

    const liste = Object.keys(map).map(k => ({
      nom: map[k].nom, type: map[k].type, docId: map[k].docId, pdfId: map[k].pdfId,
      date: Utilities.formatDate(map[k].date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
    })).sort((a, b) => b.date.localeCompare(a.date));

    return { success: true, fichiers: liste };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function supprimerDotation(docId, pdfId) {
  try {
    if (docId) DriveApp.getFileById(docId).setTrashed(true);
    if (pdfId) DriveApp.getFileById(pdfId).setTrashed(true);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function supprimerToutesLesDotations() {
  try {
    let compteur = 0;
    [ {id: DOC_TEMPLATE_ID, prefixe: 'DOTATION_VIVRES_'},
      {id: EAU_TEMPLATE_ID, prefixe: 'DOTATION_EAU_'},
      {id: ENTRETIEN_TEMPLATE_ID, prefixe: 'DOTATION_ENTRETIEN_'},
      {id: DIVISION_TEMPLATE_ID, prefixe: 'DOTATION_DIVISION_'} ].forEach(cfg => {
      const dossier = getDossierParent_(cfg.id);
      const fichiers = dossier.getFiles();
      while (fichiers.hasNext()) {
        const f = fichiers.next();
        if (f.getName().indexOf(cfg.prefixe) === 0) { f.setTrashed(true); compteur++; }
      }
    });
    return { success: true, count: compteur };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
