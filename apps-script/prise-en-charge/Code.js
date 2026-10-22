/******************************
 *  CONFIGURATION GLOBALE
 ******************************/
const SUIVI_CPM_ID = "1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I";
const SUIVI_CPM_TAB = "suivi";
const TEMPLATE_PEC_ID = "1V9e3k4eCCSzRPosjtTrAewCQrErDf2xDX1L0V9979xQ";

// Modèles pour les autorisations d'accès
const AUTORISATION_ID = "1U0Xg-_QenJJtCHhJC5O-IyzXU683XMzqtLyykPkAQG4";
const MACARON_ID = "13OFJuvreqXJE0DRrM0TPUS9JO-X9YjYVLuNjjlyDdM4";

// ID de CE spreadsheet (nécessaire car en Web App, il n'y a pas de "feuille active")
// -> Remplace par l'ID réel de ton fichier PEC (visible dans l'URL du Sheet)
const PEC_SS_ID = "1htHz2rgdyjtH3Ne5E8QNprX2LZKauui4hF25Xse5S18";

const EMPUTATIONS = {
  "Service Électromécanique": "4300045100",
  "Service Construction": "4300045300",
  "Service Travaux Entretien": "4300045200"
};

const BASES = [
  "BASE DE VIE CENTRALE",
  "BASE ANNEXE I LAVALIN",
  "ANNEXE II BJSP",
  "BASE DE VIE CENTRALE ANCIENNE BASE",
  "SHARM EL SHEIKH VIP"
];

/******************************
 *  MENU
 ******************************/
function onOpen() {
  buildDropdowns();

  SpreadsheetApp.getUi()
    .createMenu("Gestion Prestataires")
    .addItem("🔄 Actualiser la liste des prestataires", "actualiserPrestataires")
    .addItem("📤 Charger la demande PDF (OCR)", "ouvrirDialogueUploadPDF")
    .addItem("🔑 Configurer la clé API Gemini", "configurerCleGemini")
    .addSeparator()
    .addItem("✅ Générer", "genererTout")
    .addItem("🗑️ Supprimer tous les fichiers", "effacerTout")
    .addSeparator()
    .addItem("📁 Ouvrir dossier Output", "ouvrirDossierOutput")
    .addItem("📄 Ouvrir dossier PDF", "ouvrirDossierPDF")
    .addItem("🖨️ Imprimer tout", "imprimerTout")
    .addToUi();
}

/******************************
 *  Enregistre la clé API Gemini de façon sécurisée
 *  (dans les Propriétés du script, jamais en dur dans le code)
 ******************************/
function configurerCleGemini() {
  const ui = SpreadsheetApp.getUi();
  const existante = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  const message = existante
    ? "Une clé est déjà enregistrée (se terminant par ..." + existante.slice(-4) + "). Colle une nouvelle clé pour la remplacer, ou annule."
    : "Colle ta clé API Gemini (obtenue sur aistudio.google.com/apikey) :";
  const reponse = ui.prompt("Clé API Gemini", message, ui.ButtonSet.OK_CANCEL);

  if (reponse.getSelectedButton() !== ui.Button.OK) return;
  const cle = reponse.getResponseText().trim();
  if (!cle) {
    ui.alert("Aucune clé saisie, rien n'a été modifié.");
    return;
  }
  PropertiesService.getScriptProperties().setProperty("GEMINI_API_KEY", cle);
  ui.alert("Clé Gemini enregistrée avec succès.");
}

/******************************
 *  SYNCHRO PRESTATAIRES DEPUIS SUIVI CPM (source unique du contrat)
 *  Version "menu" (utilise l'UI et la feuille active du classeur ouvert)
 ******************************/
function actualiserPrestataires() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultat = synchroniserPrestataires(ss);
  buildDropdowns();
  SpreadsheetApp.getUi().alert(resultat.message);
}

/**
 * Logique partagée de synchronisation, réutilisable par le menu ET par la Web App.
 */
function synchroniserPrestataires(ss) {
  const cpmSS = SpreadsheetApp.openById(SUIVI_CPM_ID);
  const cpmSheet = cpmSS.getSheetByName(SUIVI_CPM_TAB);
  const lastRow = cpmSheet.getLastRow();
  // Une seule lecture de C à N : C=N°Dossier, D=Intitulé ... I=Statut ... M=Entreprise, N=N°Contrat
  const data = cpmSheet.getRange("C3:N" + lastRow).getValues();
  // Colonne « Service » du Suivi CPM (retrouvée par son en-tête, ligne 2) : le service du projet choisit l'émputation tout seul
  const entetes = cpmSheet.getRange(2, 1, 1, cpmSheet.getLastColumn()).getValues()[0].map(h => String(h || '').trim().toLowerCase());
  const colService = entetes.indexOf("service");
  const services = colService >= 0 ? cpmSheet.getRange(3, colService + 1, Math.max(0, lastRow - 2), 1).getValues().map(r => String(r[0] || '').trim()) : [];

  let configSheet = ss.getSheetByName("Config");
  if (!configSheet) configSheet = ss.insertSheet("Config");
  configSheet.clearContents();
  configSheet.getRange("A1:D1").setValues([["NumContrat", "Entreprise", "Intitule", "Service"]]);

  let rows = [];
  data.forEach((row, ir) => {
    const service = services[ir] || "";
    const numDossier = row[0];  // colonne C
    const intitule = row[1];    // colonne D
    const statut = row[6];      // colonne I
    const entreprise = row[10]; // colonne M
    const numContrat = row[11]; // colonne N

    // Prestataire "classique" (contrat avec entreprise + numéro de contrat)
    if (entreprise && numContrat) {
      rows.push([
        numContrat.toString().trim(),
        entreprise.toString().trim(),
        intitule ? intitule.toString().trim() : "",
        service
      ]);
    }

    // "Visite sur site" pour les dossiers marqués "Dossier en cours" (colonne I)
    if (numDossier && statut && statut.toString().trim().toLowerCase() === "dossier en cours") {
      rows.push([
        "Visite sur site",
        "(" + numDossier.toString().trim() + ")",
        intitule ? intitule.toString().trim() : "",
        service
      ]);
    }
  });

  // Tri alphabétique par nom d'entreprise (2e colonne), insensible à la casse/accents
  rows.sort((a, b) => a[1].localeCompare(b[1], "fr", { sensitivity: "base" }));

  if (rows.length > 0) {
    configSheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }

  // Rafraîchit la validation de C2 immédiatement (menu ET web), pour ne
  // plus jamais laisser la liste déroulante du Sheet en retard.
  mettreAJourValidationPrestataire(ss);

  return { success: true, message: "Liste des prestataires actualisée : " + rows.length + " entrée(s) trouvée(s)." };
}

/**
 * Met à jour la liste déroulante (validation) de la cellule C2 à partir
 * de la feuille "Config". Appelée à la fois par buildDropdowns() (menu)
 * et juste après synchroniserPrestataires() (menu ET web), pour que la
 * validation de C2 ne soit JAMAIS désynchronisée par rapport à "Config"
 * — c'est ce décalage qui provoquait l'erreur "Les données saisies dans
 * la cellule C2 ne respectent pas les règles de validation...".
 * setAllowInvalid(true) : garde l'avertissement visuel dans le Sheet,
 * mais n'empêche plus jamais l'écriture programmatique (Web App/menu)
 * même si la liste était temporairement en retard d'une synchro.
 */
function mettreAJourValidationPrestataire(ss, sheet) {
  sheet = sheet || ss.getSheetByName("PEC");
  if (!sheet) return;

  const configSheet = ss.getSheetByName("Config");
  if (!configSheet || configSheet.getLastRow() <= 1) return;

  const data = configSheet.getRange("A2:C" + configSheet.getLastRow()).getValues();
  let options = [];
  data.forEach(([numContrat, entreprise, intitule]) => {
    if (numContrat && entreprise) {
      let option = numContrat + " - " + entreprise;
      if (intitule) option += " - " + intitule;
      options.push(option);
    }
  });

  if (options.length > 0) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(options, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange("C2").setDataValidation(rule);
  }
}

/******************************
 *  MENUS DÉROULANTS + CASES À COCHER (feuille PEC = source unique)
 ******************************/
function buildDropdowns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("PEC");
  if (!sheet) return;

  // Case à cocher Remplacement (D5)
  const d5 = sheet.getRange("D5");
  if (!d5.getDataValidation()) d5.insertCheckboxes();

  // Date d'arrivée (D7) : format date uniquement, sans heure
  sheet.getRange("D7").setNumberFormat("dd/MM/yyyy");

  // Date de départ (F6) : calculée par défaut (arrivée + 28 jours), modifiable
  if (!sheet.getRange("E6").getValue()) sheet.getRange("E6").setValue("Date de départ");
  sheet.getRange("F6").setNumberFormat("dd/MM/yyyy");

  // Prestataire (C2) — affiché sous la forme "NumContrat - Entreprise - Intitulé"
  mettreAJourValidationPrestataire(ss, sheet);

  // Émputation (C3)
  const ruleEmp = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(EMPUTATIONS), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("C3").setDataValidation(ruleEmp);

  // Base (C4)
  const ruleBase = SpreadsheetApp.newDataValidation()
    .requireValueInList(BASES, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("C4").setDataValidation(ruleBase);

  // Case à cocher : Générer PRISE EN CHARGE (label C8 / case D8)
  if (!sheet.getRange("C8").getValue()) sheet.getRange("C8").setValue("Générer Prise en charge");
  const gPEC = sheet.getRange("D8");
  if (!gPEC.getDataValidation()) { gPEC.insertCheckboxes(); gPEC.setValue(true); }

  // Sous-options de la Prise en charge : Hébergement (G7/H7) et Restauration (G8/H8)
  // Indépendantes l'une de l'autre : on peut cocher seulement l'une, l'autre, ou les deux.
  if (!sheet.getRange("G7").getValue()) sheet.getRange("G7").setValue("Hébergement");
  const gHeb = sheet.getRange("H7");
  if (!gHeb.getDataValidation()) { gHeb.insertCheckboxes(); gHeb.setValue(true); }

  if (!sheet.getRange("G8").getValue()) sheet.getRange("G8").setValue("Restauration");
  const gRest = sheet.getRange("H8");
  if (!gRest.getDataValidation()) { gRest.insertCheckboxes(); gRest.setValue(false); }

  // Case à cocher : Générer Autorisation d'accès (label E7 / case F7)
  if (!sheet.getRange("E7").getValue()) sheet.getRange("E7").setValue("Générer Autorisation d'accès");
  const gAuto = sheet.getRange("F7");
  if (!gAuto.getDataValidation()) { gAuto.insertCheckboxes(); gAuto.setValue(false); }

  // Case à cocher : Autorisation valable 2 mois (label E8 / case F8)
  if (!sheet.getRange("E8").getValue()) sheet.getRange("E8").setValue("Autorisation valable 2 mois");
  const gMois = sheet.getRange("F8");
  if (!gMois.getDataValidation()) { gMois.insertCheckboxes(); gMois.setValue(false); }
}

/******************************
 *  AUTO-REMPLISSAGE (feuille PEC uniquement)
 ******************************/
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== "PEC") return;

  const cell = e.range.getA1Notation();

  if (cell === "C2") {
    const val = e.range.getValue();
    if (!val) { sheet.getRange("D2").setValue(""); sheet.getRange("E2").setValue(""); return; }
    // Format C2 : "NumContrat - Entreprise - Intitulé" -> D2 = numéro, E2 = intitulé
    const parts = val.split(" - ");
    sheet.getRange("D2").setValue(parts[0].trim());
    sheet.getRange("E2").setValue(parts.length > 2 ? parts.slice(2).join(" - ").trim() : "");
  }

  if (cell === "C3") {
    const val = e.range.getValue();
    sheet.getRange("D3").setValue(EMPUTATIONS[val] || "");
  }

  if (cell === "D7") {
    const val = e.range.getValue();
    if (val instanceof Date) {
      const depart = new Date(val);
      depart.setDate(depart.getDate() + 28);
      sheet.getRange("F6").setValue(depart);
    } else if (!val) {
      sheet.getRange("F6").setValue("");
    }
  }
}

/******************************
 *  GÉNÉRATION GLOBALE (bouton unique du menu, selon cases cochées)
 ******************************/
function genererTout() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pecSheet = ss.getSheetByName("PEC");
  if (!pecSheet) { SpreadsheetApp.getUi().alert("La feuille 'PEC' n'existe pas."); return; }

  const genererPECFlag = pecSheet.getRange("D8").getValue();
  const genererAutoFlag = pecSheet.getRange("F7").getValue();

  if (!genererPECFlag && !genererAutoFlag) {
    SpreadsheetApp.getUi().alert("Coche au moins une case : Prise en charge et/ou Autorisation d'accès.");
    return;
  }

  let bilan = [];

  if (genererPECFlag) {
    genererPEC(ss, false);
    bilan.push("Prise en charge générée.");
  }

  if (genererAutoFlag) {
    genererAutorisations(ss, false);
    bilan.push("Autorisation(s) d'accès + macaron(s) générés.");
  }

  SpreadsheetApp.getUi().alert(bilan.join("\n"));
}

/******************************
 *  WEB APP — sert le formulaire qui masque le Sheet
 ******************************/
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("Formulaire")
    .setTitle("Demande de Prise en Charge")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Renvoie toutes les options nécessaires pour remplir les listes déroulantes
 * du formulaire web (prestataires, émputations, bases).
 */
function obtenirOptionsFormulaire() {
  const ss = SpreadsheetApp.openById(PEC_SS_ID);
  const configSheet = ss.getSheetByName("Config");

  let prestataires = [];
  const servicesParPrestataire = {};   // « N° - Entreprise - Intitulé » → émputation (service du projet dans le Suivi CPM)
  if (configSheet && configSheet.getLastRow() > 1) {
    const data = configSheet.getRange("A2:D" + configSheet.getLastRow()).getValues();
    data.forEach(([numContrat, entreprise, intitule, service]) => {
      if (numContrat && entreprise) {
        let option = numContrat + " - " + entreprise;
        if (intitule) option += " - " + intitule;
        prestataires.push(option);
        const emp = pecServiceVersEmputation_(service, Object.keys(EMPUTATIONS));
        if (emp) servicesParPrestataire[option] = emp;
      }
    });
  }

  return {
    prestataires: prestataires,
    servicesParPrestataire: servicesParPrestataire,
    emputations: Object.keys(EMPUTATIONS),
    bases: BASES
  };
}

/**
 * Reçoit les données du formulaire web, les écrit dans la feuille PEC
 * (comme si un utilisateur avait rempli les cellules à la main), puis
 * lance la génération. Renvoie un objet {success, message, liens} au
 * formulaire pour affichage.
 */
function soumettreFormulairePEC(formData) {
  try {
    const ss = SpreadsheetApp.openById(PEC_SS_ID);
    const sheet = ss.getSheetByName("PEC");
    if (!sheet) throw new Error("La feuille 'PEC' est introuvable.");

    if (!formData.prestataire) throw new Error("Sélectionne un prestataire.");
    // Émputation et base ne servent qu'à la Prise en charge (une autorisation d'accès seule n'en a pas besoin)
    if (formData.genererPEC && !formData.emputation) throw new Error("Sélectionne une émputation.");
    if (formData.genererPEC && !formData.base) throw new Error("Sélectionne une base.");

    // C2 / D2 / E2 (format "NumContrat - Entreprise - Intitulé")
    sheet.getRange("C2").setValue(formData.prestataire);
    const partsPrestataire = formData.prestataire.split(" - ");
    sheet.getRange("D2").setValue(partsPrestataire[0] ? partsPrestataire[0].trim() : "");
    sheet.getRange("E2").setValue(partsPrestataire.length > 2 ? partsPrestataire.slice(2).join(" - ").trim() : "");

    // C3 / D3
    if (formData.emputation) { sheet.getRange("C3").setValue(formData.emputation); sheet.getRange("D3").setValue(EMPUTATIONS[formData.emputation] || ""); }
    else { sheet.getRange("C3:D3").clearContent(); }

    // C4
    // La liste de validation de C4 a pu être posée avec d'anciennes bases : on la remet à jour avant d'écrire
    sheet.getRange("C4").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(BASES, true).setAllowInvalid(false).build());
    if (formData.base) sheet.getRange("C4").setValue(formData.base); else sheet.getRange("C4").clearContent();

    // D5 Remplacement
    sheet.getRange("D5").setValue(!!formData.remplacement);

    // D6 Numéro de chambre
    sheet.getRange("D6").setNumberFormat("@").setValue(String(formData.numeroChambre || "")); // texte : « 04/09 » ne doit pas devenir une date

    // D7 Date d'arrivée (input HTML type="date" -> "AAAA-MM-JJ")
    if (formData.dateArrivee) {
      const [an, mois, jourN] = formData.dateArrivee.split("-").map(Number);
      sheet.getRange("D7").setValue(new Date(an, mois - 1, jourN));
    } else {
      sheet.getRange("D7").setValue("");
    }

    // F6 Date de départ (input HTML type="date" -> "AAAA-MM-JJ")
    if (formData.dateDepart) {
      const [anD, moisD, jourD] = formData.dateDepart.split("-").map(Number);
      sheet.getRange("F6").setValue(new Date(anD, moisD - 1, jourD));
    } else {
      sheet.getRange("F6").setValue("");
    }

    // D8 / F7 / F8
    sheet.getRange("D8").setValue(!!formData.genererPEC);
    sheet.getRange("F7").setValue(!!formData.genererAuto);
    sheet.getRange("F8").setValue(!!formData.valable2Mois);

    // H7 / H8 — sous-options Hébergement / Restauration (indépendantes)
    sheet.getRange("H7").setValue(!!formData.hebergement);
    sheet.getRange("H8").setValue(!!formData.restauration);

    if (!formData.genererPEC && !formData.genererAuto) {
      throw new Error("Coche au moins 'Prise en charge' ou 'Autorisation d'accès'.");
    }
    if (formData.genererPEC && !formData.hebergement && !formData.restauration) {
      throw new Error("Coche au moins 'Hébergement' ou 'Restauration' pour la Prise en charge.");
    }

    // Tableau des personnes/véhicules — on vide C10:F21 puis on réécrit
    sheet.getRange("C10:F21").clearContent();
    const lignes = (formData.personnes || []).slice(0, 12).map(p => [
      p.nom || "", p.prenom || "", p.typeVehicule || "", p.immatriculation || ""
    ]);
    if (lignes.length > 0) {
      sheet.getRange(10, 3, lignes.length, 4).setValues(lignes);
    }
    SpreadsheetApp.flush();

    // Génération (mode silencieux : pas de ui.alert, on récupère les liens)
    let liens = [];

    if (formData.genererPEC) {
      // Fonction(s) des personnes, écrite(s) sous la base dans la case « Observations » (case à cocher, facultatif)
      const fonctions = [];
      (formData.personnes || []).forEach(p => { const f = (p.fonction || "").toString().trim(); if (p.nom && f && fonctions.indexOf(f) === -1) fonctions.push(f); });
      const resultatPEC = genererPEC(ss, true, { observation: formData.fonctionObservation ? fonctions.join(" / ") : "" });
      if (resultatPEC && resultatPEC.url) liens.push({ nom: "Prise en charge (PDF)", url: resultatPEC.url });
    }

    if (formData.genererAuto) {
      const resultatAuto = genererAutorisations(ss, true);
      if (resultatAuto) {
        if (resultatAuto.autoUrl) liens.push({ nom: "Autorisation(s) d'accès (PDF)", url: resultatAuto.autoUrl });
        if (resultatAuto.macaronUrl) liens.push({ nom: "Macaron(s) (PDF)", url: resultatAuto.macaronUrl });
      }
    }

    // Enquêtes administratives : on ajoute seulement les personnes absentes de toutes les Enquêtes (jamais de doublon) ; ne bloque jamais la génération
    let message = "Génération terminée avec succès.";
    let enq = null;
    if (formData.injecterEnquetes) {
      enq = injecterEnquetes_(formData);
      const resume = enqResume_(enq);
      if (resume) message += "\n" + resume;
    }
    journaliserPEC_(ss, formData, enq);

    return { success: true, message: message, liens: liens };

  } catch (err) {
    return { success: false, message: err.message };
  }
}

/******************************
 *  UPLOAD & OCR DEMANDE PDF (PEC) — dialogue depuis le MENU du Sheet
 *  (indépendant de la version Web ci-dessus : celle-ci écrit directement
 *  dans la feuille active, utilisée quand on travaille dans le Sheet)
 ******************************/
function ouvrirDialogueUploadPDF() {
  const htmlContent = `
    <!DOCTYPE html>
    <html><head><base target="_top">
    <style>
      body { font-family: Arial, sans-serif; padding: 15px; background-color: #f8f9fa; color: #333; }
      .container { border: 2px dashed #0b57d0; padding: 20px; text-align: center; border-radius: 8px; background: #fff; }
      input[type="file"] { display: none; }
      .btn-select { background-color: #0b57d0; color: white; padding: 10px 20px; border-radius: 4px; cursor: pointer; display: inline-block; font-weight: bold; }
      #status { margin-top: 15px; font-weight: bold; color: #d93025; }
      .spinner { display: none; margin: 10px auto; border: 4px solid #f3f3f3; border-top: 4px solid #0b57d0; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style></head>
    <body>
      <div class="container">
        <h3>Charger la demande PDF du prestataire</h3>
        <label class="btn-select" for="pdfFile">Choisir le PDF</label>
        <input type="file" id="pdfFile" accept="application/pdf" onchange="traiterFichier(this)">
        <div id="file-name"></div>
        <div class="spinner" id="spinner"></div>
        <div id="status"></div>
      </div>
      <script>
        function traiterFichier(input) {
          const file = input.files[0];
          if (!file) return;
          document.getElementById('status').innerText = "Analyse et OCR du PDF en cours...";
          document.getElementById('status').style.color = "#0b57d0";
          document.getElementById('spinner').style.display = "block";
          const reader = new FileReader();
          reader.onload = function(e) {
            const data = e.target.result.split(',')[1];
            google.script.run
              .withSuccessHandler(function(res) {
                document.getElementById('spinner').style.display = "none";
                document.getElementById('status').innerText = res;
                document.getElementById('status').style.color = "green";
                setTimeout(function() { google.script.host.close(); }, 2000);
              })
              .withFailureHandler(function(err) {
                document.getElementById('spinner').style.display = "none";
                document.getElementById('status').innerText = "Erreur: " + err.message;
                document.getElementById('status').style.color = "red";
              })
              .traiterPDFUploadPEC(data, file.name);
          };
          reader.readAsDataURL(file);
        }
      </script>
    </body></html>
  `;
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent).setWidth(450).setHeight(280);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Upload demande prise en charge");
}

function traiterPDFUploadPEC(base64Data, fileName) {
  const bytes = Utilities.base64Decode(base64Data);
  const pdfBlob = Utilities.newBlob(bytes, "application/pdf", fileName);

  const cleGemini = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  let personnes = [];
  let dateDetectee = null;

  if (cleGemini) {
    try {
      const resultat = extraireAvecGemini(base64Data, cleGemini);
      personnes = resultat.personnes;
      dateDetectee = resultat.dateDebut;
    } catch (e) {
      // En cas d'échec Gemini (quota, réseau, format inattendu...), on bascule sur l'OCR Drive classique
      Logger.log("Extraction Gemini échouée, repli sur OCR Drive : " + e.message);
    }
  }

  if (personnes.length === 0) {
    const resultatOCR = extraireAvecOcrDrive(pdfBlob, fileName);
    personnes = resultatOCR.personnes;
    dateDetectee = resultatOCR.dateDetectee;
  }

  if (personnes.length === 0) {
    return "Aucun nom/prénom identifié dans le document. Vérifie le format ou saisis manuellement.";
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PEC");
  const startRow = 10;
  const maxPersonnes = Math.min(personnes.length, 12);
  const rowData = personnes.slice(0, maxPersonnes).map(p => [p.nom, p.prenom]);
  sheet.getRange(startRow, 3, rowData.length, 2).setValues(rowData); // colonnes C, D

  let message = "Succès : " + rowData.length + " personne(s) extraite(s) !";

  const dateActuelle = sheet.getRange("D7").getValue();
  if (dateDetectee && !dateActuelle) {
    sheet.getRange("D7").setValue(dateDetectee);
    message += " Date de début détectée : " + dateDetectee + " (vérifie-la).";
  } else if (!dateDetectee) {
    message += " Aucune date de début détectée automatiquement, pense à la vérifier/saisir.";
  }

  return message;
}

/******************************
 *  Extraction via l'API Gemini (lecture directe du PDF, comprend
 *  vraiment le contenu — pas de regex ni de format imposé).
 *  Nécessite une clé configurée via "🔑 Configurer la clé API Gemini".
 ******************************/
function extraireAvecGemini(base64Pdf, cleApi) {
  const modele = "gemini-2.0-flash";
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modele + ":generateContent";

  const prompt = "Tu analyses une lettre de demande de prise en charge envoyée par une entreprise prestataire. "
    + "Extrait la liste des personnes (agents) citées nommément dans la lettre (tableau « liste nominative » : colonnes NOM, PRENOM, FONCTION ; ignore la date de naissance et le numéro), et la date de début d'accès/prise en charge si elle est mentionnée. "
    + "Ignore l'en-tête, l'adresse, le numéro de contrat, la signature et tout ce qui n'est pas un nom de personne. "
    + "Corrige la casse : chaque nom et prénom doit commencer par une majuscule, le reste en minuscules. "
    + "Réponds UNIQUEMENT avec un JSON strictement de cette forme, sans texte autour : "
    + '{"personnes":[{"nom":"...","prenom":"...","fonction":"..."}],"dateDebut":"JJ/MM/AAAA ou null"}';

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "application/pdf", data: base64Pdf } }
      ]
    }],
    generationConfig: { response_mime_type: "application/json" }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": cleApi },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const reponse = UrlFetchApp.fetch(url, options);
  const code = reponse.getResponseCode();
  if (code !== 200) {
    throw new Error("Gemini a répondu " + code + " : " + reponse.getContentText());
  }

  const data = JSON.parse(reponse.getContentText());
  const texteJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texteJson) throw new Error("Réponse Gemini vide ou inattendue.");

  const resultat = JSON.parse(texteJson);
  const personnes = (resultat.personnes || [])
    .filter(p => p.nom && p.prenom)
    .map(p => ({ nom: pecCap_(p.nom), prenom: pecCap_(p.prenom), fonction: pecFonction_(p.fonction) }));

  return {
    personnes,
    dateDebut: resultat.dateDebut && resultat.dateDebut !== "null" ? resultat.dateDebut : null
  };
}

/******************************
 *  OCR Drive classique (repli si pas de clé Gemini ou en cas d'échec)
 ******************************/
function extraireAvecOcrDrive(pdfBlob, fileName) {
  let tempDocFile;
  if (typeof Drive !== 'undefined' && Drive.Files && typeof Drive.Files.create === 'function') {
    tempDocFile = Drive.Files.create(
      { name: "TEMP_OCR_" + fileName, mimeType: "application/vnd.google-apps.document" },
      pdfBlob, { ocrLanguage: "fr" }
    );
  } else if (typeof Drive !== 'undefined' && Drive.Files && typeof Drive.Files.insert === 'function') {
    tempDocFile = Drive.Files.insert(
      { title: "TEMP_OCR_" + fileName, mimeType: "application/vnd.google-apps.document" },
      pdfBlob, { ocr: true, ocrLanguage: "fr" }
    );
  } else {
    throw new Error("Le service 'Drive API' n'est pas activé. Ajoutez-le via (+) sous 'Services'.");
  }

  const tempDoc = DocumentApp.openById(tempDocFile.id);
  const resultat = extraireDonneesPEC(tempDoc);
  DriveApp.getFileById(tempDocFile.id).setTrashed(true);
  return resultat;
}

/**
 * Met une majuscule en début de mot, le reste en minuscule
 * (ex: "BENAREB" -> "Benareb", "mohamed" -> "Mohamed")
 */
function capitaliser(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Extraction intelligente : cherche un vrai tableau OCR avec colonnes Nom/Prénom,
 * peu importe leur ordre ou position. Fallback en texte brut si l'OCR n'a pas
 * reconstruit de tableau.
 */
function extraireDonneesPEC(doc) {
  const body = doc.getBody();
  let personnes = [];
  const tables = body.getTables();
  for (let t = 0; t < tables.length && personnes.length === 0; t++) {
    const table = tables[t], lignes = [];
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r), cellules = [];
      for (let c = 0; c < row.getNumCells(); c++) cellules.push(row.getCell(c).getText());
      lignes.push(cellules);
    }
    personnes = pecLireTableau_(lignes);
  }
  const fullText = body.getText();
  if (personnes.length === 0) personnes = pecLireTexte_(fullText);   // OCR sans tableau reconstruit (scan penché, cadre pâle…)
  return { personnes, dateDetectee: pecLireDate_(fullText), texte: fullText };
}

/******************************
 *  GÉNÉRATION DE LA PRISE EN CHARGE
 ******************************/
function genererPEC(ss, silencieux, options) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  silencieux = silencieux || false;
  options = options || {};
  const sheet = ss.getSheetByName("PEC");

  const prestataireCell = sheet.getRange("C2").getValue();
  const numContrat = sheet.getRange("D2").getValue();
  const intituleContrat = sheet.getRange("E2").getValue();
  // Format C2 : "NumContrat - Entreprise - Intitulé" -> entreprise = 2e partie
  const entreprise = prestataireCell.toString().split(" - ")[1].trim();
  const codeEmputation = sheet.getRange("D3").getValue();
  const base = sheet.getRange("C4").getValue();
  const estRemplacement = sheet.getRange("D5").getValue();
  const numeroChambre = sheet.getRange("D6").getDisplayValue();
  const hebergement = sheet.getRange("H7").getValue();
  const restauration = sheet.getRange("H8").getValue();

  if (!hebergement && !restauration) {
    const msg = "Coche au moins 'Hébergement' ou 'Restauration' pour générer la Prise en charge.";
    if (silencieux) throw new Error(msg);
    SpreadsheetApp.getUi().alert(msg);
    return;
  }
  let dateArriveeVal = sheet.getRange("D7").getValue();

  const today = new Date();
  const jour = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd/MM/yyyy");

  // Date d'arrivée : si non saisie, on prend aujourd'hui
  const dateArriveeObj = (dateArriveeVal instanceof Date) ? dateArriveeVal : today;
  const dateArrivee = Utilities.formatDate(dateArriveeObj, Session.getScriptTimeZone(), "dd/MM/yyyy");

  // Date de départ : si non saisie, on prend automatiquement arrivée + 28 jours —
  // SAUF pour une "Visite sur site", où la durée est généralement courte et limitée :
  // dans ce cas on respecte strictement ce qui est saisi, sans calcul automatique.
  const estVisiteSurSitePEC = prestataireCell.toString().trim().startsWith("Visite sur site");
  let dateDepartVal = sheet.getRange("F6").getValue();
  let dateDepartObj = null;
  if (dateDepartVal instanceof Date) {
    dateDepartObj = dateDepartVal;
  } else if (!estVisiteSurSitePEC) {
    dateDepartObj = new Date(dateArriveeObj);
    dateDepartObj.setDate(dateDepartObj.getDate() + 28);
  }
  const dateDepart = dateDepartObj ? Utilities.formatDate(dateDepartObj, Session.getScriptTimeZone(), "dd/MM/yyyy") : "";

  // Nom/Prénom : colonnes C/D, lignes 10 à 21 — Nom ET Prénom forcés en MAJUSCULES
  const personnes = sheet.getRange("C10:D21").getValues()
    .filter(([nom]) => nom)
    .map(([nom, prenom]) => [nom.toString().toUpperCase(), prenom ? prenom.toString().toUpperCase() : prenom]);

  if (personnes.length === 0) {
    if (silencieux) throw new Error("Aucune personne renseignée (lignes 10 à 21).");
    SpreadsheetApp.getUi().alert("Aucune personne renseignée (lignes 10 à 21).");
    return;
  }

  const ssFile = DriveApp.getFileById(ss.getId());
  const parentFolder = ssFile.getParents().next();
  let outputFolder = parentFolder.getFoldersByName("output").hasNext() ? parentFolder.getFoldersByName("output").next() : parentFolder.createFolder("output");
  let pdfFolder = outputFolder.getFoldersByName("pdf").hasNext() ? outputFolder.getFoldersByName("pdf").next() : outputFolder.createFolder("pdf");
  let docFolder = outputFolder.getFoldersByName("doc").hasNext() ? outputFolder.getFoldersByName("doc").next() : outputFolder.createFolder("doc");

  const nomFichier = "PEC_" + safeName(entreprise) + "_" + safeName(jour);
  const copie = DriveApp.getFileById(TEMPLATE_PEC_ID).makeCopy(nomFichier, docFolder);
  const doc = DocumentApp.openById(copie.getId());
  const body = doc.getBody();

  // Forcer la page en paysage (largeur > hauteur), quelle que soit
  // l'orientation d'origine du modèle — on garde le même format physique
  // (A4, Letter...), on inverse juste largeur/hauteur si besoin.
  if (body.getPageHeight() > body.getPageWidth()) {
    const largeur = body.getPageWidth();
    const hauteur = body.getPageHeight();
    body.setPageWidth(hauteur);
    body.setPageHeight(largeur);
  }

  body.replaceText("{{today}}", jour);
  body.replaceText("{{Date d’arriver}}", dateArrivee);
  body.replaceText("{{Date de départ}}", dateDepart);
  body.replaceText("{{CheckHebergement}}", hebergement ? "☒" : "☐");
  body.replaceText("{{CheckRestauration}}", restauration ? "☒" : "☐");
  body.replaceText("{{Nombre}}", personnes.length.toString());
  body.replaceText("{{Entreprise}}", entreprise);
  body.replaceText("{{Numero de contrat}}", numContrat);
  body.replaceText("{{IntituleContrat}}", intituleContrat || "");
  body.replaceText("{{CodeImputation}}", codeEmputation);
  body.replaceText("{{Base de vie}}", base);
  body.replaceText("{{Remplacement}}", estRemplacement ? "Remplacement" : "");
  body.replaceText("{{Numero de chambre}}", numeroChambre || "");

  for (let i = 0; i < 12; i++) {
    const num = i + 1;
    const nom = personnes[i] ? personnes[i][0] : "";
    const prenom = personnes[i] ? personnes[i][1] : "";
    body.replaceText("{{Nom" + num + "}}", nom);
    body.replaceText("{{Prénom" + num + "}}", prenom);
  }

  // Centrer les noms/prénoms dans la cellule du tableau
  const table = body.getTables()[0];
  const dataRow = table.getRow(1);
  const nomCell = dataRow.getCell(0);

  const totalSlots = nomCell.getNumChildren();
  const filled = personnes.length;

  // Le modèle physique n'a qu'un nombre fixe d'emplacements pour les noms.
  // Au-delà, on donnait un message Google Docs illisible ("index de l'enfant...").
  // On détecte le dépassement AVANT de toucher au document et on renvoie un
  // message clair, en nettoyant le fichier partiellement créé.
  if (filled > totalSlots) {
    doc.saveAndClose();
    try { DriveApp.getFileById(copie.getId()).setTrashed(true); } catch (e) {}
    const msg = "Le modèle de Prise en Charge accepte au maximum " + totalSlots
      + " personnes. Tu en as saisi " + filled
      + ". Réduis la liste ou fais une seconde prise en charge.";
    if (silencieux) throw new Error(msg);
    SpreadsheetApp.getUi().alert(msg);
    return;
  }

  const emptyTotal = Math.max(totalSlots - filled, 0);
  // 1 seule ligne vide en haut (si dispo), 1 seule ligne vide en bas (si dispo) —
  // le reste des lignes vides est supprimé du document pour resserrer le tableau
  // au lieu de laisser un grand espace vide quand il y a peu de personnes.
  const topPad = emptyTotal >= 1 ? 1 : 0;
  const bottomPad = emptyTotal >= 2 ? 1 : 0;
  const totalUtilise = topPad + filled + bottomPad;

  let filledTexts = [];
  for (let i = 0; i < filled; i++) {
    filledTexts.push(nomCell.getChild(i).asParagraph().getText());
  }
  for (let i = 0; i < totalSlots; i++) {
    nomCell.getChild(i).asParagraph().setText(" ");
  }
  for (let i = 0; i < filled; i++) {
    nomCell.getChild(topPad + i).asParagraph().setText(nomAvecTiret_(filledTexts[i]));
  }

  // Supprime les lignes vides en trop (au-delà d'1 en haut + 1 en bas) pour que
  // le tableau ne garde pas un grand espace inutilisé quand il y a peu de monde.
  for (let i = totalSlots - 1; i >= totalUtilise; i--) {
    try { nomCell.removeChild(nomCell.getChild(i)); } catch (e) { /* dernière ligne de la cellule, on ne peut pas la retirer */ }
  }

  // Case « Observations » (dernière de la ligne) : base / remplacement / chambre, puis UNE ligne vide, puis la fonction (si demandée).
  // Les paragraphes vides laissés par les balises {{…}} du modèle (remplacement, chambre absents) sont supprimés pour que le bloc soit compact,
  // puis tout est centré horizontalement et verticalement.
  try {
    const obsCell = dataRow.getCell(dataRow.getNumCells() - 1);
    for (let i = obsCell.getNumChildren() - 1; i >= 0; i--) {
      const enfant = obsCell.getChild(i);
      if (enfant.getType() === DocumentApp.ElementType.PARAGRAPH && !enfant.asParagraph().getText().trim() && obsCell.getNumChildren() > 1) obsCell.removeChild(enfant);
    }
    if (options.observation) {
      obsCell.appendParagraph(" ");
      obsCell.appendParagraph(options.observation);
    }
    obsCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
    for (let i = 0; i < obsCell.getNumChildren(); i++) {
      const enfant = obsCell.getChild(i);
      if (enfant.getType() === DocumentApp.ElementType.PARAGRAPH) {
        enfant.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(0).setSpacingAfter(0);
      }
    }
  } catch (e) { /* la mise en forme ne doit jamais bloquer la génération */ }

  // Colonne des noms assez large pour que « - NOM PRÉNOM » tienne sur UNE ligne : la place est prise sur les autres colonnes (nombre de personnes d'abord)
  try {
    const nbCol = dataRow.getNumCells(), actuelles = [];
    for (let c = 0; c < nbCol; c++) actuelles.push(table.getColumnWidth(c));
    const plusLong = filledTexts.reduce((m, t) => Math.max(m, nomAvecTiret_(t).length), 0);
    const nouvelles = largeursColonnes_(actuelles, plusLong);
    for (let c = 0; c < nbCol; c++) if (Math.abs(nouvelles[c] - actuelles[c]) > 0.5) table.setColumnWidth(c, nouvelles[c]);
  } catch (e) { /* la mise en forme ne doit jamais bloquer la génération */ }

  // Imputation analytique (colonne 5) : centrée horizontalement et verticalement
  try {
    if (dataRow.getNumCells() > 4) {
      const impCell = dataRow.getCell(4);
      impCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      for (let i = 0; i < impCell.getNumChildren(); i++) {
        const enfant = impCell.getChild(i);
        if (enfant.getType() === DocumentApp.ElementType.PARAGRAPH) enfant.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      }
    }
  } catch (e) { /* la mise en forme ne doit jamais bloquer la génération */ }

  // Noms toujours au milieu de leur case : centrés horizontalement et verticalement
  try {
    nomCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
    for (let i = 0; i < nomCell.getNumChildren(); i++) {
      const enfant = nomCell.getChild(i);
      if (enfant.getType() === DocumentApp.ElementType.PARAGRAPH) enfant.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
  } catch (e) { /* la mise en forme ne doit jamais bloquer la génération */ }

  doc.saveAndClose();
  const pdf = copie.getAs("application/pdf");
  const pdfFile = pdfFolder.createFile(pdf).setName(nomFichier + ".pdf");

  return { url: pdfFile.getUrl() };
}

/******************************
 *  UTILITAIRE : copier le contenu d'un modèle dans un document cible,
 *  puis remplacer les balises {{...}} UNIQUEMENT dans les éléments qu'on
 *  vient d'ajouter (pour ne pas écraser les blocs des véhicules précédents).
 ******************************/
function ajouterContenuAvecRemplacement(sourceBody, targetBody, remplacements) {
  const nbElements = sourceBody.getNumChildren();
  const elementsAjoutes = [];

  for (let i = 0; i < nbElements; i++) {
    const enfant = sourceBody.getChild(i).copy();
    const type = enfant.getType();
    let inserted = null;

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      inserted = targetBody.appendParagraph(enfant.asParagraph());
    } else if (type === DocumentApp.ElementType.TABLE) {
      inserted = targetBody.appendTable(enfant.asTable());
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      inserted = targetBody.appendListItem(enfant.asListItem());
    } else if (type === DocumentApp.ElementType.INLINE_IMAGE) {
      inserted = targetBody.appendImage(enfant.asInlineImage());
    } else {
      continue; // types rares (saut de section, etc.) ignorés
    }
    elementsAjoutes.push(inserted);
  }

  // Remplacement scopé : seulement sur les éléments qu'on vient d'insérer
  elementsAjoutes.forEach(el => {
    Object.keys(remplacements).forEach(cle => {
      if (typeof el.replaceText === "function") {
        el.replaceText(cle, remplacements[cle]);
      }
    });
  });
}

/******************************
 *  Supprime les paragraphes vides en fin de document (garde toujours
 *  au moins 1 paragraphe, contrainte imposée par Google Docs).
 *  Corrige le cas d'une page blanche en trop après copie de contenu.
 ******************************/
function supprimerParagraphesVidesFin(body) {
  let n = body.getNumChildren();
  while (n > 1) {
    const dernier = body.getChild(n - 1);
    const estParagrapheVide = dernier.getType() === DocumentApp.ElementType.PARAGRAPH
      && dernier.asParagraph().getText().trim() === "";
    if (!estParagrapheVide) break;
    try {
      body.removeChild(dernier);
    } catch (e) {
      // Google Docs refuse de supprimer le dernier paragraphe d'une section
      // (contrainte interne, indépendante du nombre total de paragraphes du
      // document). On s'arrête proprement plutôt que de planter le script.
      break;
    }
    n--;
  }
}

/******************************
 *  Copie la mise en page (taille de page + marges) d'un modèle vers un
 *  document cible, pour éviter que le contenu déborde/soit coupé quand
 *  on le copie dans un nouveau document vierge (mise en page par défaut).
 ******************************/
function copierMiseEnPage(sourceBody, targetBody) {
  targetBody.setPageWidth(sourceBody.getPageWidth());
  targetBody.setPageHeight(sourceBody.getPageHeight());
  targetBody.setMarginLeft(sourceBody.getMarginLeft());
  targetBody.setMarginRight(sourceBody.getMarginRight());
  targetBody.setMarginTop(sourceBody.getMarginTop());
  targetBody.setMarginBottom(sourceBody.getMarginBottom());
}

/******************************
 *  Déplace un fichier Drive nouvellement créé (racine) vers un dossier cible
 ******************************/
function deplacerVersDossier(fileId, dossierCible) {
  const file = DriveApp.getFileById(fileId);
  dossierCible.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
}

/******************************
 *  Nettoie une chaîne pour l'utiliser dans un nom de fichier
 *  (espaces -> _ ; / \ -> - )
 ******************************/
function safeName(str) {
  return str.toString().trim().replace(/[\/\\]/g, "-").replace(/\s+/g, "_");
}

/******************************
 *  Cherche dans un dossier le plus grand incrément déjà utilisé pour un
 *  préfixe donné (ex: "PEC_Entreprise_04-09-2026_") et renvoie le suivant.
 ******************************/
function prochainIncrement(dossier, prefixe) {
  const regex = new RegExp("^" + prefixe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\d+)\\.pdf$", "i");
  const files = dossier.getFiles();
  let max = 0;
  while (files.hasNext()) {
    const m = files.next().getName().match(regex);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

/******************************
 *  GÉNÉRATION DES AUTORISATIONS + MACARONS
 *  (tout est lu depuis la feuille PEC : C10:F21)
 *  C=Nom, D=Prénom, E=TypeVéhicule, F=Immatriculation
 *
 *  Version fusionnée : toutes les autorisations dans UN SEUL document
 *  (une page par véhicule) et tous les macarons dans UN SEUL document,
 *  pour limiter les allers-retours Drive/Docs à 2 exports PDF au lieu de
 *  2×(nombre de véhicules).
 ******************************/
/** « NOM PRÉNOM » → « - NOM PRÉNOM » (une ligne vide reste vide ; le tiret n'est pas doublé). */
function nomAvecTiret_(t) {
  const v = String(t == null ? "" : t).replace(/^\s*[-–]\s*/, "").trim();
  return v ? "- " + v : " ";
}
/**
 * Largeurs (en points) des colonnes de la ligne de données : la 1re (noms) est élargie pour contenir `nbCaracteres` sur une ligne,
 * en prenant la place sur les autres colonnes, dans cet ordre : nombre de personnes (4e), dates (2e, 3e), imputation (5e), observations (7e), code (6e),
 * sans jamais descendre sous un minimum ; la largeur totale du tableau ne change pas. Si la place manque, le nom reste sur plusieurs lignes.
 */
function largeursColonnes_(actuelles, nbCaracteres) {
  const w = actuelles.slice(), n = w.length;
  if (n < 4) return w;
  const total = w.reduce((a, b) => a + b, 0), besoin = Math.min(nbCaracteres * 6.4 + 14, total * 0.46);
  let manque = besoin - w[0];
  if (manque <= 0) return w;
  const minimums = { 3: 40, 1: 58, 2: 58, 4: 66, 6: 84, 5: 96 };
  [3, 1, 2, 4, 6, 5].forEach(function (c) {
    if (c >= n || manque <= 0) return;
    const prise = Math.min(manque, Math.max(0, w[c] - minimums[c]));
    w[c] -= prise; w[0] += prise; manque -= prise;
  });
  return w;
}
/** Date (objet Date, « jj/mm/aaaa » ou « aaaa-mm-jj ») → Date locale à minuit, ou null. */
function dateLue_(v) {
  if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const t = String(v == null ? "" : v).trim();
  let m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/.exec(t);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
/** Fin de contrat = date ODS + durée du CPM (plus de 60 = jours, sinon mois : même règle que le Suivi CPM) − 1 jour. Null si illisible. */
function finContrat_(ods, duree) {
  const d0 = dateLue_(ods), n = Number(String(duree == null ? "" : duree).replace(",", ".").replace(/[^\d.]/g, ""));
  if (!d0 || !isFinite(n) || n <= 0) return null;
  const fin = n > 60 ? new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + Math.round(n)) : new Date(d0.getFullYear(), d0.getMonth() + Math.round(n), d0.getDate());
  fin.setDate(fin.getDate() - 1);
  return fin;
}
/** Vrai si la date de départ a été choisie par l'agent (≠ date d'arrivée + 28 jours, valeur proposée automatiquement). */
function departManuel_(arrivee, depart) {
  const a = dateLue_(arrivee), d = dateLue_(depart);
  if (!d) return false;
  if (!a) return true;
  const auto = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 28);
  return d.getTime() !== auto.getTime();
}
/**
 * Fin de l'autorisation et du macaron :
 *  - date de départ choisie par l'agent (ou visite sur site) → les DEUX suivent cette date ;
 *  - sinon : autorisation mensuelle (fin du mois courant, ou du mois suivant si « valable 2 mois »), macaron TOUJOURS jusqu'à la fin du contrat (Suivi CPM),
 *    même dépassée ; seule une fin de contrat introuvable le fait suivre l'autorisation.
 */
function datesFin_(o) {
  const t = dateLue_(o.aujourdhui), depart = dateLue_(o.depart);
  if ((o.visite || o.departManuel) && depart) return { autorisation: depart, macaron: depart, source: "date choisie" };
  const mois = new Date(t.getFullYear(), t.getMonth() + (o.deuxMois ? 2 : 1), 0);
  const fc = dateLue_(o.finContrat);
  return { autorisation: mois, macaron: fc || mois, source: fc ? "fin de contrat" : "mois" };
}
/** Fin de contrat lue dans le Suivi CPM (LECTURE SEULE) pour un numéro de contrat ; null si introuvable. */
function lireFinContratCpm_(numContrat) {
  const cle = String(numContrat == null ? "" : numContrat).trim();
  if (!cle || /^visite sur site/i.test(cle)) return null;
  try {
    const sh = SpreadsheetApp.openById(SUIVI_CPM_ID).getSheetByName(SUIVI_CPM_TAB);
    const v = sh.getRange(3, 1, Math.max(sh.getLastRow() - 2, 1), 18).getValues();
    for (let i = 0; i < v.length; i++) if (String(v[i][13]).trim() === cle) return finContrat_(v[i][16], v[i][17]);
  } catch (e) { /* Suivi CPM illisible : on retombe sur la règle mensuelle */ }
  return null;
}

function genererAutorisations(ss, silencieux) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  silencieux = silencieux || false;
  const pecSheet = ss.getSheetByName("PEC");
  if (!pecSheet) throw new Error("La feuille 'PEC' n'existe pas.");

  // Source unique du contrat — format C2 : "NumContrat - Entreprise - Intitulé"
  const prestataireCell = pecSheet.getRange("C2").getValue().toString();
  const numContrat = pecSheet.getRange("D2").getValue();
  const intituleContrat = pecSheet.getRange("E2").getValue();
  const entreprise = prestataireCell.split(" - ")[1].trim();

  // Nom, Prénom, TypeVéhicule, Immatriculation
  const data = pecSheet.getRange("C10:F21").getValues();

  const today = new Date();
  const jour = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd/MM/yyyy");

  // Date de fin de la période d'accès (voir datesFin_) : date de départ choisie / visite sur site → autorisation ET macaron suivent cette date ;
  // sinon autorisation mensuelle et macaron jusqu'à la fin du contrat (Suivi CPM).
  const estVisiteSurSite = prestataireCell.trim().startsWith("Visite sur site");
  const departVal = pecSheet.getRange("F6").getValue();
  const df = datesFin_({
    aujourdhui: today, depart: departVal, visite: estVisiteSurSite && departVal instanceof Date,
    departManuel: departManuel_(pecSheet.getRange("D7").getValue(), departVal),
    deuxMois: !!pecSheet.getRange("F8").getValue(), finContrat: estVisiteSurSite ? null : lireFinContratCpm_(numContrat)
  });
  const fmt = d => Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy");
  const fin = fmt(df.autorisation), finMacaron = fmt(df.macaron);

  const ssFile = DriveApp.getFileById(ss.getId());
  const parentFolder = ssFile.getParents().next();

  let outputFolder = parentFolder.getFoldersByName("output").hasNext() ? parentFolder.getFoldersByName("output").next() : parentFolder.createFolder("output");
  let pdfFolder = outputFolder.getFoldersByName("pdf").hasNext() ? outputFolder.getFoldersByName("pdf").next() : outputFolder.createFolder("pdf");
  let docFolder = outputFolder.getFoldersByName("doc").hasNext() ? outputFolder.getFoldersByName("doc").next() : outputFolder.createFolder("doc");

  // Regrouper par véhicule (immatriculation)
  let vehicules = {};
  data.forEach(([nomRaw, prenomRaw, typeVehicule, immat]) => {
    if (!immat) return; // ligne sans véhicule = ignorée pour les autorisations
    const nom = nomRaw ? nomRaw.toString().toUpperCase() : nomRaw;
    const prenom = prenomRaw ? prenomRaw.toString().toUpperCase() : prenomRaw;
    if (!vehicules[immat]) vehicules[immat] = { typeVehicule, chauffeurs: [] };
    if (!vehicules[immat].chauffeurs.some(c => c.nom === nom && c.prenom === prenom)) {
      vehicules[immat].chauffeurs.push({ nom, prenom });
    }
  });

  const immats = Object.keys(vehicules);
  if (immats.length === 0) {
    if (silencieux) throw new Error("Aucun véhicule renseigné (colonnes E et F, lignes 10 à 21).");
    SpreadsheetApp.getUi().alert("Aucun véhicule renseigné (colonnes E et F, lignes 10 à 21).");
    return;
  }

  // Nom souhaité : prestataire_date_matricule(s)
  const entrepriseSafe = safeName(entreprise);
  const jourSafe = safeName(jour);
  const immatsSafe = immats.map(safeName).join("_");
  const baseNomAuto = "Autorisation_" + entrepriseSafe + "_" + jourSafe + "_" + immatsSafe;
  const baseNomMacaron = "Macaron_" + entrepriseSafe + "_" + jourSafe + "_" + immatsSafe;

  // Ouvrir les DEUX modèles UNE SEULE FOIS, en lecture (jamais sauvegardés/modifiés)
  const templateAutoBody = DocumentApp.openById(AUTORISATION_ID).getBody();
  const templateMacaronBody = DocumentApp.openById(MACARON_ID).getBody();

  // Créer les DEUX documents de sortie (un seul aller-retour de création chacun)
  const docAutorisations = DocumentApp.create(baseNomAuto);
  const bodyAutorisations = docAutorisations.getBody();
  const docMacarons = DocumentApp.create(baseNomMacaron);
  const bodyMacarons = docMacarons.getBody();

  // Reprendre la mise en page (taille de page + marges) des modèles,
  // sinon le nouveau document vierge utilise les valeurs par défaut de Google Docs
  // et le contenu large (tableaux) déborde/est coupé à l'impression.
  copierMiseEnPage(templateAutoBody, bodyAutorisations);
  copierMiseEnPage(templateMacaronBody, bodyMacarons);

  /********** AUTORISATIONS + MACARONS, PAR VÉHICULE (dans les mêmes 2 docs) **********/
  immats.forEach((immat, idx) => {
    const veh = vehicules[immat];
    const numeroAutorisation = "VEH" + ("000" + (idx + 1)).slice(-3);
    const numeroMacaron = "MAC" + ("000" + (idx + 1)).slice(-3);

    if (idx > 0) {
      bodyAutorisations.appendPageBreak();
      bodyMacarons.appendPageBreak();
    }

    ajouterContenuAvecRemplacement(templateAutoBody, bodyAutorisations, {
      "{{Numero}}": numeroAutorisation,
      "{{Date}}": jour,
      "{{Periode}}": "Du " + jour + " Au " + fin,
      "{{Entreprise}}": entreprise,
      "{{Numero de contrat}}": numContrat,
      "{{IntituleContrat}}": intituleContrat || "",
      "{{MotifAcces}}": estVisiteSurSite ? "VISITE SUR SITE" : "exécution du contrat prestation",
      "{{Nom1}}": veh.chauffeurs[0]?.nom || "",
      "{{Prénom1}}": veh.chauffeurs[0]?.prenom || "",
      "{{Nom2}}": veh.chauffeurs[1]?.nom || "",
      "{{Prénom2}}": veh.chauffeurs[1]?.prenom || "",
      "{{Nom3}}": veh.chauffeurs[2]?.nom || "",
      "{{Prénom3}}": veh.chauffeurs[2]?.prenom || "",
      "{{Nom4}}": "",
      "{{Prénom4}}": "",
      "{{TypeVehicule1}}": veh.typeVehicule || "",
      "{{Immatriculation1}}": immat,
      "{{TypeVehicule2}}": "",
      "{{Immatriculation2}}": "",
      "{{TypeVehicule3}}": "",
      "{{Immatriculation3}}": ""
    });

    ajouterContenuAvecRemplacement(templateMacaronBody, bodyMacarons, {
      "{{Numero}}": numeroMacaron,
      "{{Date}}": jour,
      "{{Periode}}": "Du " + jour + " Au " + finMacaron,
      "{{Entreprise}}": entreprise,
      "{{Numero de contrat}}": numContrat,
      "{{IntituleContrat}}": intituleContrat || "",
      "{{TypeVehicule}}": veh.typeVehicule || "",
      "{{Immatriculation}}": immat
    });
  });

  // Supprimer le paragraphe vide de départ créé par DocumentApp.create()
  try {
    if (bodyAutorisations.getNumChildren() > 1) bodyAutorisations.removeChild(bodyAutorisations.getChild(0));
  } catch (e) { /* section ne permettant pas la suppression, on laisse tel quel */ }
  try {
    if (bodyMacarons.getNumChildren() > 1) bodyMacarons.removeChild(bodyMacarons.getChild(0));
  } catch (e) { /* idem */ }

  // Supprimer les paragraphes vides en fin de document (cause fréquente d'une
  // page blanche en trop après la copie du contenu du modèle)
  supprimerParagraphesVidesFin(bodyAutorisations);
  supprimerParagraphesVidesFin(bodyMacarons);

  docAutorisations.saveAndClose();
  docMacarons.saveAndClose();

  // Déplacer les deux docs fusionnés dans le dossier "doc", puis exporter 2 PDF (au lieu de 2×N)
  deplacerVersDossier(docAutorisations.getId(), docFolder);
  deplacerVersDossier(docMacarons.getId(), docFolder);

  const pdfAutorisations = DriveApp.getFileById(docAutorisations.getId()).getAs("application/pdf");
  const fichierAuto = pdfFolder.createFile(pdfAutorisations).setName(baseNomAuto + ".pdf");

  const pdfMacarons = DriveApp.getFileById(docMacarons.getId()).getAs("application/pdf");
  const fichierMacaron = pdfFolder.createFile(pdfMacarons).setName(baseNomMacaron + ".pdf");

  return { autoUrl: fichierAuto.getUrl(), macaronUrl: fichierMacaron.getUrl() };
}

/******************************
 *  EFFACER TOUS LES FICHIERS — version MENU (feuille active du classeur ouvert)
 ******************************/
function effacerTout() {
  const ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parentFolder = ssFile.getParents().next();

  if (parentFolder.getFoldersByName("output").hasNext()) {
    const outputFolder = parentFolder.getFoldersByName("output").next();
    ["pdf", "doc"].forEach(nomDossier => {
      if (outputFolder.getFoldersByName(nomDossier).hasNext()) {
        const dossier = outputFolder.getFoldersByName(nomDossier).next();
        const fichiers = dossier.getFiles();
        while (fichiers.hasNext()) {
          try { fichiers.next().setTrashed(true); } catch (e) {}
        }
      }
    });
  }
}

/******************************
 *  OUVRIR DOSSIER OUTPUT — version MENU
 ******************************/
function ouvrirDossierOutput() {
  const ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parentFolder = ssFile.getParents().next();
  const folders = parentFolder.getFoldersByName("output");
  if (!folders.hasNext()) { SpreadsheetApp.getUi().alert("Le dossier 'output' n'existe pas."); return; }
  const url = folders.next().getUrl();
  const html = HtmlService.createHtmlOutput(
    '<script>window.open("' + url + '");google.script.host.close();</script>'
  ).setWidth(10).setHeight(10);
  SpreadsheetApp.getUi().showModalDialog(html, "Ouverture du dossier");
}

/******************************
 *  OUVRIR DOSSIER PDF — version MENU
 ******************************/
function ouvrirDossierPDF() {
  const ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parentFolder = ssFile.getParents().next();
  const folders = parentFolder.getFoldersByName("output");
  if (!folders.hasNext()) { SpreadsheetApp.getUi().alert("Le dossier 'output' n'existe pas."); return; }
  const outputFolder = folders.next();
  const pdfFolders = outputFolder.getFoldersByName("pdf");
  if (pdfFolders.hasNext()) {
    const url = pdfFolders.next().getUrl();
    const html = '<script>window.open("' + url + '");google.script.host.close();</script>';
    SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(100).setHeight(50), "Ouverture du dossier PDF");
  } else {
    SpreadsheetApp.getUi().alert("Le dossier 'pdf' n'existe pas.");
  }
}

/******************************
 *  IMPRIMER TOUT — version MENU
 ******************************/
function imprimerTout() {
  const ssFile = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId());
  const parentFolder = ssFile.getParents().next();
  const outputFolders = parentFolder.getFoldersByName("output");
  if (!outputFolders.hasNext()) { SpreadsheetApp.getUi().alert("Lance 'Générer' d'abord."); return; }
  const outputFolder = outputFolders.next();
  const pdfFolders = outputFolder.getFoldersByName("pdf");
  if (!pdfFolders.hasNext()) { SpreadsheetApp.getUi().alert("Lance 'Générer' d'abord."); return; }
  const pdfFolder = pdfFolders.next();

  const files = pdfFolder.getFiles();
  let script = "";
  let count = 0;
  while (files.hasNext()) {
    const file = files.next();
    const printUrl = "https://drive.google.com/file/d/" + file.getId() + "/view";
    script += `window.open("${printUrl}", "_blank");`;
    count++;
  }
  if (count === 0) { SpreadsheetApp.getUi().alert("Aucun PDF trouvé."); return; }

  const html = HtmlService.createHtmlOutput(`<script>${script}google.script.host.close();</script>`).setWidth(10).setHeight(10);
  SpreadsheetApp.getUi().showModalDialog(html, "Ouverture de " + count + " document(s)...");
}

/******************************
 *  FONCTIONS WEB (sans UI) — utilisées par les boutons de la page
 *  Formulaire, qui n'a pas accès à SpreadsheetApp.getUi() ni à une
 *  "feuille active" (contrairement au menu déclenché depuis le Sheet).
 ******************************/

/**
 * Équivalent web de "🔄 Actualiser la liste des prestataires".
 */
function actualiserPrestatairesWeb() {
  try {
    const ss = SpreadsheetApp.openById(PEC_SS_ID);
    const resultat = synchroniserPrestataires(ss);
    return {
      success: true,
      message: resultat.message,
      options: obtenirOptionsFormulaire()
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Équivalent web de "🗑️ Supprimer tous les fichiers".
 */
function effacerToutWeb() {
  try {
    const ss = SpreadsheetApp.openById(PEC_SS_ID);
    const ssFile = DriveApp.getFileById(ss.getId());
    const parentFolder = ssFile.getParents().next();
    let count = 0;

    if (parentFolder.getFoldersByName("output").hasNext()) {
      const outputFolder = parentFolder.getFoldersByName("output").next();
      ["pdf", "doc"].forEach(nomDossier => {
        if (outputFolder.getFoldersByName(nomDossier).hasNext()) {
          const dossier = outputFolder.getFoldersByName(nomDossier).next();
          const fichiers = dossier.getFiles();
          while (fichiers.hasNext()) {
            try { fichiers.next().setTrashed(true); count++; } catch (e) {}
          }
        }
      });
    }
    return { success: true, message: count + " fichier(s) supprimé(s)." };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Équivalent web de "📤 Charger la demande PDF (OCR)".
 * Ne modifie PAS le Sheet directement : renvoie les personnes/date au
 * navigateur, qui remplit le tableau du formulaire. L'écriture réelle
 * dans "PEC" n'a lieu qu'au clic sur "Générer les documents".
 */
function traiterPDFUploadPECWeb(base64Data, fileName) {
  try {
    const bytes = Utilities.base64Decode(base64Data);
    const pdfBlob = Utilities.newBlob(bytes, "application/pdf", fileName);

    const cleGemini = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    let personnes = [];
    let dateDetectee = null;
    let texteLu = '';

    if (cleGemini) {
      try {
        const resultat = extraireAvecGemini(base64Data, cleGemini);
        personnes = resultat.personnes;
        dateDetectee = resultat.dateDebut;
      } catch (e) {
        Logger.log("Extraction Gemini échouée, repli sur OCR Drive : " + e.message);
      }
    }

    if (personnes.length === 0) {
      const resultatOCR = extraireAvecOcrDrive(pdfBlob, fileName);
      personnes = resultatOCR.personnes;
      dateDetectee = resultatOCR.dateDetectee;
      texteLu = resultatOCR.texte || '';
      Logger.log('Texte lu par l\'OCR (' + fileName + ') :\n' + texteLu);
    }

    const apercu = personnes.length < 2 && texteLu ? texteLu.replace(/\s*\n\s*/g, ' ¶ ').slice(0, 700) : '';
    if (personnes.length === 0) {
      return { success: false, message: "Aucun nom/prénom identifié dans le document. Saisis manuellement.", apercuTexte: apercu };
    }

    return { success: true, personnes: personnes.slice(0, 12), dateDetectee: dateDetectee, apercuTexte: apercu };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Équivalent web de "📁 Ouvrir dossier PDF" : renvoie l'URL au lieu
 * d'ouvrir une boîte de dialogue modale (impossible en Web App).
 */
function ouvrirDossierPDFWeb() {
  try {
    const ss = SpreadsheetApp.openById(PEC_SS_ID);
    const ssFile = DriveApp.getFileById(ss.getId());
    const parentFolder = ssFile.getParents().next();
    const folders = parentFolder.getFoldersByName("output");
    if (!folders.hasNext()) return { success: false, message: "Le dossier 'output' n'existe pas encore. Génère au moins un document d'abord." };
    const outputFolder = folders.next();
    const pdfFolders = outputFolder.getFoldersByName("pdf");
    if (!pdfFolders.hasNext()) return { success: false, message: "Le dossier 'pdf' n'existe pas encore." };
    return { success: true, url: pdfFolders.next().getUrl() };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Équivalent web de "🖨️ Imprimer tout" : renvoie la liste des PDF au
 * lieu de les ouvrir directement (les navigateurs bloquent l'ouverture
 * de plusieurs onglets à la fois sans clic explicite de l'utilisateur).
 */
function imprimerToutWeb() {
  try {
    const ss = SpreadsheetApp.openById(PEC_SS_ID);
    const ssFile = DriveApp.getFileById(ss.getId());
    const parentFolder = ssFile.getParents().next();
    const outputFolders = parentFolder.getFoldersByName("output");
    if (!outputFolders.hasNext()) return { success: false, message: "Aucun document généré pour l'instant." };
    const outputFolder = outputFolders.next();
    const pdfFolders = outputFolder.getFoldersByName("pdf");
    if (!pdfFolders.hasNext()) return { success: false, message: "Aucun document généré pour l'instant." };
    const pdfFolder = pdfFolders.next();

    const files = pdfFolder.getFiles();
    let urls = [];
    while (files.hasNext()) {
      const file = files.next();
      urls.push({ nom: file.getName(), url: "https://drive.google.com/file/d/" + file.getId() + "/view" });
    }
    if (urls.length === 0) return { success: false, message: "Aucun PDF trouvé." };
    return { success: true, urls: urls };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/******************************
 *  FICHIERS À IMPRIMER (même présentation que Dotation) + ENVOI PAR E-MAIL (même bouton que Requête transport)
 ******************************/
const EMAIL_SECRETARIAT = "sec.infra.rns@gmail.com";

/** Dossier « output/pdf » à côté du fichier PEC, ou null. */
function dossierPdfGeneres_() {
  const parent = DriveApp.getFileById(PEC_SS_ID).getParents().next();
  const o = parent.getFoldersByName("output"); if (!o.hasNext()) return null;
  const p = o.next().getFoldersByName("pdf"); return p.hasNext() ? p.next() : null;
}
/** Type affiché d'après le nom du fichier. */
function typeFichier_(nom) {
  const n = String(nom || "");
  return /^PEC_/i.test(n) ? "PEC" : /^Autorisation_/i.test(n) ? "AUTORISATION" : /^Macaron_/i.test(n) ? "MACARON" : "PDF";
}
/** Fichier du dossier output/pdf uniquement (l'application est publique : jamais un autre fichier du Drive). */
function fichierGenere_(fileId) {
  const dossier = dossierPdfGeneres_(); if (!dossier) throw new Error("Aucun document généré pour l'instant.");
  const f = DriveApp.getFileById(String(fileId || ""));
  const ps = f.getParents(); let ok = false;
  while (ps.hasNext()) if (ps.next().getId() === dossier.getId()) ok = true;
  if (!ok) throw new Error("Ce fichier n'appartient pas aux documents générés.");
  return f;
}
/** Liste des PDF générés, du plus récent au plus ancien : [{ id, nom, type, date }]. */
function listerFichiersGeneres() {
  try {
    const dossier = dossierPdfGeneres_(); if (!dossier) return { success: true, fichiers: [] };
    const it = dossier.getFiles(), l = [];
    while (it.hasNext()) { const f = it.next(); if (f.getMimeType() !== MimeType.PDF) continue; l.push({ id: f.getId(), nom: f.getName().replace(/\.pdf$/i, ""), type: typeFichier_(f.getName()), t: f.getDateCreated().getTime(), date: Utilities.formatDate(f.getDateCreated(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") }); }
    l.sort((a, b) => b.t - a.t);
    return { success: true, fichiers: l.slice(0, 60).map(x => ({ id: x.id, nom: x.nom, type: x.type, date: x.date })) };
  } catch (err) { return { success: false, error: err.message }; }
}
/** Envoi du PDF par e-mail au secrétariat Infrastructure RNS (bouton « Envoyer par email »). */
function envoyerFichierParMail(fileId) {
  try {
    const f = fichierGenere_(fileId), type = typeFichier_(f.getName());
    const lib = type === "PEC" ? "Prise en charge" : type === "AUTORISATION" ? "Autorisation d'accès" : type === "MACARON" ? "Macaron" : "Document";
    MailApp.sendEmail({ to: EMAIL_SECRETARIAT, subject: lib + " - " + f.getName(), body: "Veuillez trouver ci-joint le document généré automatiquement (" + lib.toLowerCase() + ").", attachments: [f.getBlob()] });
    return { success: true };
  } catch (err) { return { success: false, error: err.toString() }; }
}
/** Contenu du PDF (base64) pour l'impression directe depuis le navigateur : la page l'ouvre dans la fenêtre d'impression, sur l'imprimante par défaut. */
function lireFichierPourImpression(fileId) {
  try {
    const f = fichierGenere_(fileId);
    return { success: true, nom: f.getName(), base64: Utilities.base64Encode(f.getBlob().getBytes()) };
  } catch (err) { return { success: false, error: err.message }; }
}
/** Met à la corbeille un PDF généré. */
function supprimerFichierGenere(fileId) {
  try { fichierGenere_(fileId).setTrashed(true); return { success: true }; } catch (err) { return { success: false, error: err.message }; }
}
/** À lancer UNE FOIS dans l'éditeur Apps Script (▶ Exécuter) pour autoriser l'envoi d'e-mails par l'application. */
function autoriserEnvoiMail() { Logger.log("Quota d'e-mails restant aujourd'hui : " + MailApp.getRemainingDailyQuota()); }

if (typeof module !== 'undefined') module.exports = { typeFichier_, dateLue_, finContrat_, departManuel_, datesFin_, nomAvecTiret_, largeursColonnes_ };
