// L'ID de votre document Google Docs (le template cartouche vierge)
const TEMPLATE_ID = '1BCycQMNj0yo_yHElP65Pvd0CZ-STI4g7oLxJX5HSVMk';

// Adresse du service cloud d'impression Xerox
const PRINTBYXEROX_EMAIL = 'print@PrintByXerox.com';

// Adresse du secrétariat Infrastructure RNS
const EMAIL_SECRETARIAT = 'sec.infra.rns@gmail.com';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('requete')
      .setTitle('Générateur Requête Transport')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function genererDocument(data) {
  try {
    // 1. Faire une copie temporaire du template
    const templateFile = DriveApp.getFileById(TEMPLATE_ID);
    const dossierParent = templateFile.getParents().next(); // Sauvegarde dans le même dossier
    const docCopie = templateFile.makeCopy("Document_Temporaire_" + new Date().getTime(), dossierParent);

    // 2. Ouvrir la copie et remplacer les balises
    const doc = DocumentApp.openById(docCopie.getId());
    const body = doc.getBody();

    body.replaceText("{{DATE_JOUR}}", data.dateEntete);
    body.replaceText("{{SERVICE}}", data.serviceLabel);
    body.replaceText("{{AGENT}}", data.agent);
    body.replaceText("{{IMPUTATION}}", data.imputation);
    body.replaceText("{{VEHICULE}}", data.vehicule);
    body.replaceText("{{PERIODE}}", data.periode);
    body.replaceText("{{NATURE}}", data.nature);

    doc.saveAndClose(); // Sauvegarder les modifications

    // 3. Convertir le document rempli en PDF
    const pdfBlob = doc.getAs('application/pdf');
    const nomFichierPDF = "Requête_" + data.serviceLabel.replace(/\s+/g, '_') + "_" + data.dateEntete + ".pdf";
    const pdfFile = dossierParent.createFile(pdfBlob);
    pdfFile.setName(nomFichierPDF);

    // 4. Supprimer le document temporaire (Google Doc) pour ne garder que le PDF
    docCopie.setTrashed(true);

    // Rendre le PDF accessible via lien direct (pour le bouton Imprimer classique)
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      pdfUrl: pdfFile.getUrl(),
      fileId: pdfFile.getId(),
      fileName: nomFichierPDF,
      downloadUrl: "https://drive.google.com/uc?export=download&id=" + pdfFile.getId()
    };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Suppression d'un seul PDF par son fileId (non utilisé par le bouton "Supprimer tout" mais gardé si besoin ailleurs)
function supprimerDocument(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Envoi du PDF vers le service cloud @PrintByXerox (bouton "Envoyer à l'imprimante")
function envoyerImpression(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const pdfBlob = file.getBlob();

    MailApp.sendEmail({
      to: PRINTBYXEROX_EMAIL,
      subject: file.getName(),
      body: "Document envoyé automatiquement depuis le générateur de requêtes.",
      attachments: [pdfBlob]
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Envoi du PDF par email au secrétariat Infrastructure RNS (bouton "Envoyer par email")
function envoyerVersSecretariat(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const pdfBlob = file.getBlob();

    MailApp.sendEmail({
      to: EMAIL_SECRETARIAT,
      subject: "Requête Transport - " + file.getName(),
      body: "Veuillez trouver ci-joint la requête transport générée automatiquement.",
      attachments: [pdfBlob]
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Liste tous les PDF de requêtes déjà générés dans le dossier (utilisé par le bouton "Supprimer tout")
function listerRequetesGenerees() {
  try {
    const templateFile = DriveApp.getFileById(TEMPLATE_ID);
    const dossierParent = templateFile.getParents().next();
    const fichiers = dossierParent.getFilesByType(MimeType.PDF);
    const liste = [];

    while (fichiers.hasNext()) {
      const f = fichiers.next();
      if (f.getName().indexOf('Requête_') === 0) {
        liste.push({
          id: f.getId(),
          name: f.getName(),
          date: f.getDateCreated().toLocaleDateString('fr-FR')
        });
      }
    }

    return { success: true, fichiers: liste };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// Supprime tous les PDF de requêtes présents dans le dossier (bouton "Supprimer tout")
function supprimerToutesLesRequetes() {
  try {
    const templateFile = DriveApp.getFileById(TEMPLATE_ID);
    const dossierParent = templateFile.getParents().next();
    const fichiers = dossierParent.getFilesByType(MimeType.PDF);
    let compteur = 0;

    while (fichiers.hasNext()) {
      const f = fichiers.next();
      if (f.getName().indexOf('Requête_') === 0) {
        f.setTrashed(true);
        compteur++;
      }
    }

    return { success: true, count: compteur };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}