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
    .setTitle('Dotations - Division Infrastructure')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
  if (form.type === 'REPAS') return genererPriseEnChargeRepas_(form);
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
// Prises en charge « repas » : collation, pause café, repas à emporter, casse-croûte (document paysage, sans modèle Google Doc)
// ------------------------------------------------------------------------
const LOGO_SONATRACH_B64 = "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";
const REPAS_TYPES = {
  COLLATION: { titre: 'COLLATION', code: 'COLLATION', colonne: 'Date', tiret: true },
  PAUSE_CAFE: { titre: 'PAUSE CAFE', code: 'PAUSE_CAFE', colonne: 'Date', tiret: false },
  REPAS_EMPORTER: { titre: 'REPAS A EMPORTER', code: 'REPAS_EMPORTER', colonne: 'Date', tiret: false },
  CASSE_CROUTE: { titre: 'CASSE - CROUTE', code: 'CASSE_CROUTE', colonne: 'Période De Dotation', tiret: false }
};
/** Google Docs refuse un texte vide (« Impossible d'insérer un élément de texte vide ») : une espace insécable le remplace. */
function vide_(t) { return t == null || t === '' ? '\u00a0' : t; }
function lignes_(t) { return String(t == null ? '' : t).split(/\r?\n/).map(l => l.trim()).filter(Boolean); }
function jjmmaaaa_(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
/** Contenu des cellules du tableau, d'après le formulaire. Pur : testé en Node. */
function repasChamps_(form) {
  const t = REPAS_TYPES[form.sousType]; if (!t) throw new Error('Choisissez le type de prise en charge.');
  let des = lignes_(form.designations);
  if (!des.length) throw new Error('Indiquez les désignations.');
  if (t.tiret) des = des.map(l => '- ' + l.replace(/^[-–]\s*/, ''));
  const d1 = jjmmaaaa_(form.dateDebut), d2 = jjmmaaaa_(form.dateFin);
  if (!d1) throw new Error('Indiquez la date.');
  const quand = d2 && d2 !== d1 ? (form.sousType === 'CASSE_CROUTE' ? [d1 + ' Au ' + d2] : [d1 + ' au', d2]) : [d1];
  if (form.heure && String(form.heure).trim()) quand.push('A ' + String(form.heure).trim());
  if (form.lieu && String(form.lieu).trim()) quand.push(String(form.lieu).trim());
  const n = String(form.nb == null ? '' : form.nb).trim(), nb = /^\d$/.test(n) ? '0' + n : n;
  if (!nb) throw new Error('Indiquez le nombre de personnes.');
  return { titre: 'PRISE EN CHARGE : ' + t.titre, code: t.code, colonne: t.colonne, designations: des, quand: quand, nb: nb, imputation: String(form.imputation || '').trim(), observations: lignes_(form.observations) };
}
function dateLongueFr_(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return '';
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return Number(m[3]) + ' ' + mois[Number(m[2]) - 1] + ' ' + m[1];
}
function genererPriseEnChargeRepas_(form) {
  try {
    const c = repasChamps_(form), dossier = getDossierParent_(DOC_TEMPLATE_ID);
    if (form.sousType === 'CASSE_CROUTE') return genererCasseCroute_(form, c, dossier);
    const nomBase = 'DOTATION_REPAS_' + c.code + '_' + jjmmaaaa_(form.date || form.dateDebut).replace(/\//g, '-');
    const doc = DocumentApp.create(nomBase), body = doc.getBody();
    body.setPageWidth(842).setPageHeight(595).setMarginTop(34).setMarginBottom(34).setMarginLeft(48).setMarginRight(48);
    // Met en forme un paragraphe (jamais null : on teste avant d'appliquer) ; renvoie le paragraphe
    const fixer = (p, o) => { if (!p) return p; p.setSpacingBefore(0); p.setSpacingAfter(o && o.apres != null ? o.apres : 0); if (o && o.align) p.setAlignment(o.align); return p; };
    const C = DocumentApp.HorizontalAlignment.CENTER, R = DocumentApp.HorizontalAlignment.RIGHT;
    // Le premier paragraphe d'un document neuf existe déjà : on l'utilise pour le logo (pas de paragraphe vide en trop)
    const logo = body.getNumChildren() ? body.getChild(0).asParagraph() : body.appendParagraph('\u00a0');
    fixer(logo, { apres: 2 });
    const img = logo.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(LOGO_SONATRACH_B64), 'image/png', 'sonatrach.png')); img.setWidth(60).setHeight(89);
    const texte = (t, o, taille, gras) => { const p = body.appendParagraph(vide_(t)); fixer(p, o); p.setBold(!!gras).setFontSize(taille).setFontFamily('Arial'); if (o && o.souligne) p.setUnderline(true); return p; };
    ['Activité Exploration Production', 'Division Production', 'Direction Régionale Rhourde-Nouss', 'Division Infrastructure'].forEach(t => texte(t, null, 9, true));
    texte('Rhourde Nouss, le : ' + dateLongueFr_(form.date || form.dateDebut), { align: R, apres: 14 }, 10, true);
    texte(c.titre, { align: C, apres: 14, souligne: true }, 12, true);
    // Cellule de tableau : on part de son paragraphe existant, on y met la 1re ligne, les suivantes sont ajoutées
    const cellule = (cell, lignes, o) => {
      cell.setPaddingTop(6).setPaddingBottom(6).setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      const l = lignes.length ? lignes : [''];
      const premier = cell.getNumChildren() ? cell.getChild(0).asParagraph() : cell.appendParagraph('\u00a0');
      premier.setText(vide_(l[0]));
      const paras = [premier].concat(l.slice(1).map(x => cell.appendParagraph(vide_(x))));
      paras.forEach(p => { fixer(p, { align: (o && o.align) || C }); p.setBold(!!(o && o.gras)).setFontSize((o && o.taille) || 10).setFontFamily('Arial'); });
    };
    const tab = body.appendTable([[c.designations.length > 1 ? 'Désignations' : 'Désignation', c.colonne, 'Nbr de Personnes', 'Imputation Analytique', 'Observations'], [vide_(c.designations[0]), vide_(c.quand[0]), c.nb, vide_(c.imputation), vide_(c.observations[0])]]);
    [235, 130, 70, 100, 195].forEach((w, i) => tab.setColumnWidth(i, w));
    for (let i = 0; i < 5; i++) cellule(tab.getRow(0).getCell(i), [tab.getRow(0).getCell(i).getText()], { gras: true });
    cellule(tab.getRow(1).getCell(0), c.designations, { gras: true });
    cellule(tab.getRow(1).getCell(1), c.quand, { gras: true });
    cellule(tab.getRow(1).getCell(2), [c.nb], { gras: true });
    cellule(tab.getRow(1).getCell(3), [c.imputation], { gras: true });
    cellule(tab.getRow(1).getCell(4), c.observations, { gras: true });
    texte('', { apres: 6 }, 6, false);
    const noms = ['LE PRENEUR', 'LE CHEF DE DIVISION INFRASTRUCTURE', 'LE CHEF DIVISION MOYENS GENERAUX'];
    const sig = body.appendTable([noms]);
    sig.setBorderWidth(0);
    noms.forEach((nom, i) => cellule(sig.getRow(0).getCell(i), [nom], { gras: true, taille: 9, align: i === 0 ? DocumentApp.HorizontalAlignment.LEFT : C }));
    doc.saveAndClose();
    const docFile = DriveApp.getFileById(doc.getId()); docFile.moveTo(dossier);
    const pdfFile = dossier.createFile(doc.getAs('application/pdf')); pdfFile.setName(nomBase + '.pdf');
    return { success: true, docUrl: docFile.getUrl(), pdfUrl: pdfFile.getUrl(), docId: doc.getId(), pdfId: pdfFile.getId(), nom: nomBase };
  } catch (error) {
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Casse-croûte : mise en page du modèle « STEP » (A Monsieur / Chef de Division MG, date, « PRISE EN CHARGE » puis « ☒ CASSE CROUTE » sans soulignement,
 * tableau Nom des agents · Nbre d'agent · Compte analytique · Période de la dotation · Structure, trois signatures, pied de page).
 * Le titre est descendu pour que le bloc soit centré dans la page.
 */
function genererCasseCroute_(form, c, dossier) {
  const nomBase = 'DOTATION_REPAS_' + c.code + '_' + jjmmaaaa_(form.date || form.dateDebut).replace(/\//g, '-');
  const doc = DocumentApp.create(nomBase), body = doc.getBody();
  body.setPageWidth(842).setPageHeight(595).setMarginTop(30).setMarginBottom(30).setMarginLeft(48).setMarginRight(48);
  const C = DocumentApp.HorizontalAlignment.CENTER, R = DocumentApp.HorizontalAlignment.RIGHT, L = DocumentApp.HorizontalAlignment.LEFT, ORANGE = '#E58A00';
  // Tout le texte est NOIR par défaut (un paragraphe hérite sinon de la couleur du précédent) ; seuls les filets sont orange. Tailles relevées sur le modèle STEP.
  const mise = (p, o) => { if (!p) return p; o = o || {}; p.setSpacingBefore(o.avant || 0).setSpacingAfter(o.apres || 0).setAlignment(o.align || L); p.setBold(!!o.gras).setItalic(false).setUnderline(false).setFontSize(o.taille || 11).setFontFamily('Arial').setForegroundColor('#000000'); return p; };
  const cellule = (cell, lignes, o) => {
    o = o || {}; cell.setPaddingTop(o.pad == null ? 5 : o.pad).setPaddingBottom(o.pad == null ? 5 : o.pad).setPaddingLeft(5).setPaddingRight(5).setVerticalAlignment(o.haut ? DocumentApp.VerticalAlignment.TOP : DocumentApp.VerticalAlignment.CENTER);
    const l = lignes.length ? lignes : [''], premier = cell.getNumChildren() ? cell.getChild(0).asParagraph() : cell.appendParagraph('\u00a0');
    premier.setText(vide_(l[0]));
    [premier].concat(l.slice(1).map(x => cell.appendParagraph(vide_(x)))).forEach(p => mise(p, { align: o.align || C, gras: o.gras, taille: o.taille }));
  };
  // En-tête : à gauche logo + service, à droite « A Monsieur / Le Chef de Division MG », filet orange, date
  const entete = body.appendTable([['\u00a0', '\u00a0']]); entete.setBorderWidth(0); entete.setColumnWidth(0, 330).setColumnWidth(1, 410);
  const g = entete.getRow(0).getCell(0), d = entete.getRow(0).getCell(1);
  g.setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0); d.setPaddingTop(0).setPaddingBottom(0).setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
  const pl = g.getChild(0).asParagraph(); mise(pl, { apres: 2 });
  pl.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(LOGO_SONATRACH_B64), 'image/png', 'sonatrach.png')).setWidth(66).setHeight(98);
  ['Activité Exploration - Production', 'Division Production', 'Direction Régionale Rhourde Nouss', 'Division Infrastructure'].forEach(t => mise(g.appendParagraph(t), { gras: true, taille: 10 }));
  const pd = d.getChild(0).asParagraph(); mise(pd, { apres: 0 });
  mise(d.appendParagraph('A Monsieur'), { gras: true, taille: 10, avant: 14, apres: 8 });
  mise(d.appendParagraph('Le Chef de Division MG'), { gras: true, taille: 10, apres: 6 });
  const filet = d.appendParagraph('\u2501'.repeat(40)); mise(filet, { taille: 9, apres: 12 }); filet.setForegroundColor(ORANGE);
  const dt = d.appendParagraph('Rhourde Nouss : ' + jjmmaaaa_(form.date || form.dateDebut)); mise(dt, { align: R, taille: 10 });
  dt.editAsText().setBold(false).setBold(0, 14, true);
  // Titre descendu : l'ensemble titre + tableau + signatures est centré verticalement dans la page
  mise(body.appendParagraph('PRISE EN CHARGE'), { align: C, gras: true, taille: 13, avant: 34, apres: 4 });
  mise(body.appendParagraph('\u2612 CASSE CROUTE'), { align: C, gras: true, taille: 11, apres: 18 });
  const ENT = ['Nom des agents', "Nbre d'agent", 'Compte analytique', 'Période de la dotation', 'Structure'];
  const tab = body.appendTable([ENT, ['\u00a0', '\u00a0', '\u00a0', '\u00a0', '\u00a0']]);
  [215, 70, 90, 170, 196].forEach((w, i) => tab.setColumnWidth(i, w));
  ENT.forEach((h, i) => cellule(tab.getRow(0).getCell(i), [h], { gras: true }));
  cellule(tab.getRow(1).getCell(0), c.designations, { align: L, pad: 8 });
  cellule(tab.getRow(1).getCell(1), [c.nb], { pad: 8 });
  cellule(tab.getRow(1).getCell(2), [c.imputation], { pad: 8 });
  cellule(tab.getRow(1).getCell(3), c.quand, { pad: 8 });
  cellule(tab.getRow(1).getCell(4), c.observations, { pad: 8 });
  mise(body.appendParagraph('\u00a0'), { taille: 6, apres: 12 });
  const noms = ['LE CHEF DIVISION INFRASTRUCTURES', 'LE PRENEUR', 'LE CHEF DIVISION DMG'];
  const sig = body.appendTable([noms]); sig.setBorderWidth(0);
  noms.forEach((nom, i) => cellule(sig.getRow(0).getCell(i), [nom], { gras: true, taille: 11, align: C, pad: 2 }));
  // Pied de page : filet orange + adresse (noir)
  const pied = doc.addFooter();
  const f0 = pied.getNumChildren() ? pied.getChild(0).asParagraph() : pied.appendParagraph('\u00a0'); f0.setText('\u2501'.repeat(38)); mise(f0, { taille: 10, apres: 4 }); f0.setForegroundColor(ORANGE);
  ['Direction Régionale Rhourde-Nouss - BP 27 Hassi Messaoud \u2013 Ouargla Algérie', 'Tél. : 029 74 01 48     Fax : 029 74 01 40     www.sonatrach.dz     Secrétariat.RNS@sonatrach.dz'].forEach(t => mise(pied.appendParagraph(t), { align: C, taille: 7.5, apres: 2 }));
  doc.saveAndClose();
  const docFile = DriveApp.getFileById(doc.getId()); docFile.moveTo(dossier);
  const pdfFile = dossier.createFile(doc.getAs('application/pdf')); pdfFile.setName(nomBase + '.pdf');
  return { success: true, docUrl: docFile.getUrl(), pdfUrl: pdfFile.getUrl(), docId: doc.getId(), pdfId: pdfFile.getId(), nom: nomBase };
}

// ------------------------------------------------------------------------
// Historique (Vivres + Eau + Entretien + Division + Repas confondus)
// ------------------------------------------------------------------------
function listerDotationsGenerees() {
  try {
    const configs = [
      { type: 'VIVRES', dossier: getDossierParent_(DOC_TEMPLATE_ID), prefixe: 'DOTATION_VIVRES_' },
      { type: 'EAU', dossier: getDossierParent_(EAU_TEMPLATE_ID), prefixe: 'DOTATION_EAU_' },
      { type: 'ENTRETIEN', dossier: getDossierParent_(ENTRETIEN_TEMPLATE_ID), prefixe: 'DOTATION_ENTRETIEN_' },
      { type: 'DIVISION', dossier: getDossierParent_(DIVISION_TEMPLATE_ID), prefixe: 'DOTATION_DIVISION_' },
      { type: 'REPAS', dossier: getDossierParent_(DOC_TEMPLATE_ID), prefixe: 'DOTATION_REPAS_' }
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

/** Contenu (base64) du PDF d'une dotation pour l'impression en un clic depuis le navigateur. Seuls les PDF « DOTATION_… » sont lisibles. */
function lireDotationPourImpression(pdfId) {
  try {
    const f = DriveApp.getFileById(String(pdfId || ''));
    if (f.getMimeType() !== MimeType.PDF || f.getName().indexOf('DOTATION_') !== 0) throw new Error('Ce fichier n\'est pas une dotation générée.');
    return { success: true, nom: f.getName(), base64: Utilities.base64Encode(f.getBlob().getBytes()) };
  } catch (error) { return { success: false, error: error.message }; }
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
      {id: DIVISION_TEMPLATE_ID, prefixe: 'DOTATION_DIVISION_'},
      {id: DOC_TEMPLATE_ID, prefixe: 'DOTATION_REPAS_'} ].forEach(cfg => {
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
