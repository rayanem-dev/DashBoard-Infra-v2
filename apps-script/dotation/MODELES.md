# Modèles de la dotation (Google Docs)

Les modèles restent des **Google Docs dans Drive** (Mon Drive ▸ Suivi ▸ Demandes) : le script en fait une copie, remplace les balises `{{…}}`, puis exporte en PDF dans le même dossier. Ils ne peuvent pas vivre dans le dépôt, mais leur identifiant et leurs balises sont notés ici ; si un modèle est supprimé ou déplacé, on le recrée à partir de cette liste.

| Type | Modèle (Google Doc) | Identifiant (`Code.js`) | Balises remplacées |
|---|---|---|---|
| Vivres | DOTATION VIVRE | `DOC_TEMPLATE_ID` = `1woGvBaAaWMTuotbofnsVrr8WVbvdyF_NBAmpPdjqTvI` | `{{DATE}}` `{{TYPE}}` `{{DATE_DEBUT}}` `{{DATE_FIN}}` `{{QTE_CAFE}}` `{{IMPUTATION}}` `{{SERVICE}}` `{{OBSERVATIONS}}` `{{QTE_SUCRE}}` `{{QTE_GOBELET}}` `{{QTE_THE}}` `{{QTE_CUILLERES}}` `{{QTE_SERVIETTES}}` |
| Eau minérale | DOTATION EAU MINERALE | `EAU_TEMPLATE_ID` = `1Vp1Ic4TsxX_dktESec-fjXP8x_I6W-fBb16i0JH9dCw` | `{{DATE}}` `{{NOMS}}` `{{PERIODE_DEBUT}}` `{{PERIODE_FIN}}` `{{QUANTITE}}` `{{IMPUTATION}}` `{{SERVICE}}` `{{OBSERVATIONS}}` |
| Produits d'entretien | DOTATION PRODUITS D'ENTRETIEN | `ENTRETIEN_TEMPLATE_ID` = `11DHNDUKWdfv5l3DLGl51eJUPG3KF7pTQ7no4CXv9rPg` | `{{DATE}}` `{{PERIODE}}` `{{IMPUTATION}}` `{{OBSERVATIONS}}` + tableau « Désignations / Quantité » (12 produits) |
| Division (quinzaine) | Division Vivres | `DIVISION_TEMPLATE_ID` = `16ZwFUJrw_-UjbeEeKfiy8YErNst2tYPvkY9MUXKLtYQ` | `{{DATE}}` `{{PERIODE_DEBUT}}` `{{PERIODE_FIN}}` + tableau « Désignation / Quantité » (13 produits) |

Règles : ne pas renommer les balises ni les désignations du tableau (le script retrouve les lignes par leur désignation) ; les fichiers produits (`DOTATION_*`) sont créés à côté du modèle.
