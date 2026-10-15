function loadCatalog(atelier) {
  google.script.run
    .withSuccessHandler(function(data) {
      catalogParts = data || [];
      const refsDatalist = document.getElementById('refsList');
      const desigsDatalist = document.getElementById('desigsList');
      refsDatalist.innerHTML = '';
      desigsDatalist.innerHTML = '';
      catalogParts.forEach(item => {
        if (item.ref) { let o = document.createElement('option'); o.value = item.ref; refsDatalist.appendChild(o); }
        if (item.designation) { let o = document.createElement('option'); o.value = item.designation; desigsDatalist.appendChild(o); }
      });
      if (catalogParts.length === 0) {
        alert("Aucun article trouvé dans l'onglet '" + atelier + "'. Vérifie le nom exact de l'onglet et la ligne de départ des données.");
      }
    })
    .withFailureHandler(function(err) {
      alert("Erreur de chargement du catalogue : " + err.message);
    })
    .getArticles(atelier);
}
function testCatalog() {
  Logger.log(getArticles('Electricite'));
  Logger.log(getArticles('Froid'));
}
function doGet() {
  return HtmlService.createHtmlOutputFromFile('CommandeAtelier')
      .setTitle('Commande de Pièces - Service Électromécanique')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Charge le catalogue de l'atelier sélectionné (nom de l'onglet = nom de l'atelier)
function getArticles(atelier) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(atelier);
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 5) return [];

  var refValues = sheet.getRange("A5:A" + lastRow).getValues();
  var desigValues = sheet.getRange("C5:C" + lastRow).getValues();

  var articles = [];
  for (var i = 0; i < refValues.length; i++) {
    var ref = refValues[i][0] ? refValues[i][0].toString().trim() : "";
    var desig = desigValues[i][0] ? desigValues[i][0].toString().trim() : "";
    if (ref !== "" || desig !== "") {
      articles.push({ ref: ref, designation: desig });
    }
  }
  return articles;
}

function processCommande(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = ss.getSheetByName("Commandes_Enregistrees");
  if (!log) {
    log = ss.insertSheet("Commandes_Enregistrees");
    log.appendRow(["N° Commande", "Date", "Atelier", "Demandeur", "Destinataire", "Référence", "Désignation", "Quantité", "Unité", "Observations", "Lien PDF"]);
  }

  var numCommande = "BC-" + Utilities.formatDate(new Date(), "GMT+1", "yyyyMMdd-HHmmss");
  var dateStr = Utilities.formatDate(new Date(), "GMT+1", "dd/MM/yyyy HH:mm");
  var destinataire = "Service Électromécanique — Division Infrastructure RNS";

  // ── Génération des lignes du tableau PDF ──
  var rowsHtml = "";
  data.articles.forEach(function(item, i) {
    var bg = (i % 2 === 0) ? "#FFFFFF" : "#FAFAFA";
    rowsHtml += "<tr style='background:" + bg + "'>" +
      "<td style='text-align:center;color:#6B7280;'>" + (i + 1) + "</td>" +
      "<td><b>" + item.ref + "</b></td>" +
      "<td>" + item.designation + "</td>" +
      "<td style='text-align:center'>" + item.qte + "</td>" +
      "<td style='text-align:center'>" + item.unite + "</td>" +
      "</tr>";
  });

  // ── En-tête et mise en page soignée du bon de commande ──
  var htmlContent =
    "<html><head><meta charset='utf-8'><style>" +
    "@page{margin:24px;}" +
    "body{font-family:Arial,Helvetica,sans-serif;color:#1C1C1C;padding:0;margin:0;}" +
    ".letterhead{background:linear-gradient(135deg,#1A1A2E 0%,#16213E 60%,#0F3460 100%);padding:22px 30px;color:#fff;}" +
    ".letterhead-row{display:table;width:100%;}" +
    ".letterhead-left{display:table-cell;vertical-align:middle;}" +
    ".letterhead-right{display:table-cell;vertical-align:middle;text-align:right;}" +
    ".logo{display:inline-block;width:42px;height:42px;background:linear-gradient(135deg,#E85D04,#F48C06);border-radius:10px;color:#fff;font-weight:bold;font-size:17px;text-align:center;line-height:42px;margin-right:12px;}" +
    ".company-name{font-size:17px;font-weight:bold;vertical-align:middle;}" +
    ".company-sub{font-size:10.5px;color:rgba(255,255,255,0.65);letter-spacing:0.4px;text-transform:uppercase;margin-top:2px;}" +
    ".bc-num{font-size:13px;font-weight:bold;color:#F48C06;}" +
    ".bc-date{font-size:10.5px;color:rgba(255,255,255,0.7);margin-top:2px;}" +
    ".stripe{height:4px;background:linear-gradient(90deg,#9D0208,#E85D04,#F48C06,#FFBA08);}" +
    ".content{padding:26px 30px;}" +
    ".doc-title{font-size:15px;font-weight:bold;color:#1A1A2E;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:16px;border-bottom:2px solid #FFE8D6;padding-bottom:8px;}" +
    ".info-grid{display:table;width:100%;margin-bottom:20px;}" +
    ".info-cell{display:table-cell;width:50%;vertical-align:top;padding:12px 16px;background:#F8F9FA;border-radius:8px;}" +
    ".info-cell + .info-cell{padding-left:16px;}" +
    ".info-label{font-size:9.5px;font-weight:bold;color:#6B7280;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;}" +
    ".info-value{font-size:13px;font-weight:bold;color:#1A1A2E;}" +
    "table{width:100%;border-collapse:collapse;margin-top:6px;}" +
    "th{background:#1A1A2E;color:#fff;padding:9px 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:0.3px;text-align:left;}" +
    "td{border-bottom:1px solid #E5E7EB;padding:8px;font-size:12.5px;}" +
    ".remarks{margin-top:18px;padding:12px 16px;background:#FFF8F0;border-left:3px solid #E85D04;font-size:12px;border-radius:0 8px 8px 0;}" +
    ".remarks b{color:#9D0208;}" +
    ".footer{margin-top:30px;padding-top:12px;border-top:1px solid #E5E7EB;font-size:9.5px;color:#9CA3AF;text-align:center;}" +
    "</style></head><body>" +

    "<div class='letterhead'>" +
      "<div class='letterhead-row'>" +
        "<div class='letterhead-left'>" +
          "<span class='logo'>SH</span>" +
          "<span class='company-name'>Sonatrach · RNS</span>" +
          "<div class='company-sub'>Division Infrastructure — Service Électromécanique</div>" +
        "</div>" +
        "<div class='letterhead-right'>" +
          "<div class='bc-num'>" + numCommande + "</div>" +
          "<div class='bc-date'>" + dateStr + "</div>" +
        "</div>" +
      "</div>" +
    "</div>" +
    "<div class='stripe'></div>" +

    "<div class='content'>" +
      "<div class='doc-title'>Bon de Commande de Pièces de Rechange</div>" +

      "<div class='info-grid'>" +
        "<div class='info-cell'>" +
          "<div class='info-label'>Émetteur</div>" +
          "<div class='info-value'>" + data.atelier + "</div>" +
          "<div class='info-label' style='margin-top:8px;'>Demandeur</div>" +
          "<div class='info-value'>" + data.demandeur + "</div>" +
        "</div>" +
        "<div class='info-cell'>" +
          "<div class='info-label'>Destinataire</div>" +
          "<div class='info-value'>" + destinataire + "</div>" +
          "<div class='info-label' style='margin-top:8px;'>Code Imputation</div>" +
          "<div class='info-value'>4300045100</div>" +
        "</div>" +
      "</div>" +

      "<table><thead><tr>" +
        "<th style='width:5%;text-align:center;'>N°</th>" +
        "<th style='width:20%;'>Référence</th>" +
        "<th style='width:45%;'>Désignation</th>" +
        "<th style='width:15%;text-align:center;'>Quantité</th>" +
        "<th style='width:15%;text-align:center;'>Unité</th>" +
      "</tr></thead><tbody>" + rowsHtml + "</tbody></table>" +

      (data.remarks ? "<div class='remarks'><b>Observations :</b> " + data.remarks + "</div>" : "") +

      "<div class='footer'>Document généré automatiquement — Sonatrach · Division Infrastructure RNS · Service Électromécanique</div>" +
    "</div>" +
    "</body></html>";

  var blob = Utilities.newBlob(htmlContent, 'text/html', 'temp').getAs('application/pdf');
  blob.setName("Bon_Commande_" + numCommande + ".pdf");

  var folder = getOrCreateFolder("Commandes_Pieces_PDF");
  var pdfFile = folder.createFile(blob);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var pdfUrl = pdfFile.getUrl();

  data.articles.forEach(function(item) {
    log.appendRow([numCommande, dateStr, data.atelier, data.demandeur, destinataire, item.ref, item.designation, item.qte, item.unite, data.remarks, pdfUrl]);
  });

  return { status: "success", numCommande: numCommande, pdfUrl: pdfUrl };
}

function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}
