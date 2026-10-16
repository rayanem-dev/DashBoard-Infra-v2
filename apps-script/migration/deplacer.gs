/**
 * Regroupe les fichiers d'origine dans « DashBoard-Infra v2 » en les DÉPLAÇANT (pas de copie).
 *
 * À LANCER DEPUIS LE COMPTE sec.infra.rns@gmail.com (script.google.com > Nouveau projet > coller ce code > exécuter  deplacer()).
 *  - Un fichier déplacé garde son identifiant : tous les liens du portail et de l'ancien site continuent de fonctionner.
 *  - Rien n'est supprimé ni copié ni modifié ; relançable sans risque (un fichier déjà en place est ignoré).
 *  - Les fichiers qui appartiennent à rayanem@gmail.com sont déplacés seulement si ce compte vous en a donné l'accès en modification ;
 *    sinon ils sont listés « À TRAITER » dans le journal (étape suivante : transfert de propriété).
 *  - Les fichiers déjà copiés par migrer() ne sont pas touchés.
 */
const RACINE_ = 'DashBoard-Infra v2';
// [identifiant, dossier de destination, nom (pour le journal), propriétaire : S = secrétariat, R = rayanem]
const A_DEPLACER_ = [
  ['1b8JgLaV1lxF1wdgHTHSkA9XBTp7m46y6', '03_RH_Personnel', 'formation SAP', 'S'],
  ['1Thk_-DUr1q9fetPX7W8qg2_SVNRhF_7LtD3xTZfn-OA', '98_Systeme_Donnees', 'Organigrame Div Infra (BDDORGA)', 'S'],
  ['1QmrWV8Qg174ZEq5m8DaECI_h2Pjg74kiFJH7V-yf87c', '00_Securite_Acces', 'Accès, partage et privilèges', 'S'],
  ['1LibEVNdujTDHAaGXz-EUh4oJr2SqXR2X0Q0wO2KDeoQ', '01_Pilotage_Projets', 'Imptutation Sh RNS', 'R'],
  ['1REasn3g8Tg77GldihvZFeDu6vtAIkm2clJNnjYeVajk', '04_Logistique_Stocks', 'Liste Radio INFRA RNS', 'S'],
  ['1KOoUvkV6DOXID9gRKohh7FJ0lA3p9PNOyFnjSNben0g', '03_RH_Personnel', 'Planning de formation PS RNS – Division Infrastructure', 'S'],
  ['1pvGALmksWQ-oLkxXrv74yjZk6QGyVbqHzgWfc6ol6SE', '04_Logistique_Stocks', 'SUIVI VH', 'S'],
  ['1_qZp9x1cgeq9dzZpJU4Bdpz1BGnuav02', '04_Logistique_Stocks', 'Statistique sous-traitants avril 2026.xlsx', 'S'],
  ['1Jlz8LmaawE4Fz7Dj1opxkg9kuk4G5fsO0UP4FOiRRWc', '01_Pilotage_Projets', 'Suivi INFRA', 'S'],
  ['1t9-Rks2tOPYAvwKBKM65mAOsSo5lzsSVyp4HrFayPc8', '05_Administration', 'Suivi Instance Courrier', 'S'],
  ['1OnDa-w4dyb2t1QyRk0DpoSJR5cmjJ9R1', '04_Logistique_Stocks', 'TABLE RNS SP1 (STOCK RNS avec les 2 codifications).xlsx', 'S'],
  ['1Uq_WkNxu5fdaN9p_JEo4BPKpXEHKUMHC', '03_RH_Personnel', 'planing Visites medicales 2026 mod.xlsx', 'R'],
  ['1wkbd3-ct19GifHZriKFLIRCPqUBiLjU0', '05_Administration', 'التحقيقات الادارية.xlsx', 'S'],
  ['1htHz2rgdyjtH3Ne5E8QNprX2LZKauui4hF25Xse5S18', '04_Logistique_Stocks', 'Prises en Charges & Autorisation Acces (base de l\'application)', 'S'],
  ['1v3SVsW36asErrhxIkHUuSFZCN0XA6RsjFcoOJO1Z0OA', '03_RH_Personnel', 'Catalogue IAP 2025', 'S'],
  ['1Pk0n5UNT8yf5A7yZNe8rwHyevn7XHsB4', '06_Chantiers_Fiches_Suiveuses', '01-SUIVI_ELECTRICITE_FINALE.xlsx', 'S'],
  ['1TRLH-zWEYLdwzVmQD7_GCfc4F8KsALh2pVzyu7IJpow', '06_Chantiers_Fiches_Suiveuses', 'FICHE SUIVEUSE VER01', 'S'],
  ['1gD_aQEw7YUU2DBGMrJchqUGvuFuEeyn8EG9XHf7gxkw', '06_Chantiers_Fiches_Suiveuses', 'Suivi_Forage_RNS_2', 'S'],
  ['1x7r94U66Ec7t7jBzyzcuHCS1JCrYlPinYRvpFA5gQ3s', '06_Chantiers_Fiches_Suiveuses', 'Suivi_Genie_Civil_2026_Consolide', 'S'],
  ['1noMG3iFyvLAPc0pWgoaLgeNbpMKTolv6iju-DUXjiVI', '06_Chantiers_Fiches_Suiveuses', 'Suivi_MCM000', 'S'],
  ['1_bL3vv2dtYJWmvs0ZqZqq2agACVEZdAr14UP2unoUhM', '06_Chantiers_Fiches_Suiveuses', 'Suivi_Terrassement_RNS_36Mois', 'S'],
  ['1pRtFlpkw3UK9B_RBR1jynRZ8tPYiYnErEvRUJjopSSQ', '06_Chantiers_Fiches_Suiveuses', 'fiche suiveuse LES ABRIS 01', 'R'],
  ['1NecYq1Deeler7RSuCbhWNjzAKJ3UkVgjjoDuCJ3yQHo', '06_Chantiers_Fiches_Suiveuses', 'fiche suiveuse MOSQUEE', 'R'],
  ['1kmCfSQoqz-aZcYGS3dfiD3H8_bdUWV9DNbK9t2tzcFU', '06_Chantiers_Fiches_Suiveuses', 'fiche suiveuse PISCINE', 'R'],
  ['1zIPfQNy0w5FBv8NY1jyokNwPRjBayc0ZT0Ub2lHEuHg', '06_Chantiers_Fiches_Suiveuses', 'fiche suiveuse STUDIO final', 'R'],
  ['1jyq7txHbS-XfbOc8N-4AwOyv8JRl6nuzEmIgbwAiYDU', '06_Chantiers_Fiches_Suiveuses', 'fiche suiveuse des stades', 'R'],
  ['1Sdf3uEgTlTerY4PQA_52ioysN6CxKOxio9EMPcqvOXw', '06_Chantiers_Fiches_Suiveuses', 'tab de suivi cpf', 'R'],
  ['1MWvURLJGH_46Z9mAnGdm04XxonQrg_7dWU9uC8JqCv0', '06_Chantiers_Fiches_Suiveuses/Plans_de_situation', 'Plan_situation_ENGCB_avancement', 'R'],
  ['1qBNcBUUZ0eBneDCJEcWWwvoVK2nnGGQtaEAoLofDvXE', '06_Chantiers_Fiches_Suiveuses/Plans_de_situation', 'Plan_situation_MCM_avancement', 'R'],
  ['1G2SQinHacAvDAqNuzFbLPo-F3phL_mCMB5li3YDMMFc', '06_Chantiers_Fiches_Suiveuses/Plans_de_situation', 'Plan_situation_MOSQUEE_avancement', 'R'],
  ['10iZZKgDi5lKoZjuNf8M6cdMfaqraWIOsEDTgWfRkduk', '06_Chantiers_Fiches_Suiveuses/Plans_de_situation', 'Plan_situation_piscine_avancement', 'R'],
  ['14IdNPWy2ymCIcI7TKE28gIRujQvuxYPpIxaBNRcwxWA', '06_Chantiers_Fiches_Suiveuses/Plans_de_situation', 'Plan_situation_stade_avancement', 'R'],
  ['1-_CaqptG2mr7WVz14tgCvmnBkHq2Gd0umj9DEnMDLuE', '06_Chantiers_Fiches_Suiveuses/Plans_de_situation', 'Plan_situation_studio cadre_avancement', 'R'],
  ['10NA8xSQbbLpAK10dao1fLRNVVjUQGYsc', '03_RH_Personnel', 'Veste en Cuir Liste du personnel actif RNS.xlsx', 'S'],
  ['1VOKT3OrWK3MVA9duOQxI2y--SDWuBB2O', '04_Logistique_Stocks', 'Ecarts INFRA.xlsx', 'S'],
  ['1_WTKk5_-nbKyR0yk7fE6bKiCku2ZtCez', '03_RH_Personnel', 'PERSONNEL DE PERMANENCE.docx', 'S'],
  ['1SyC226_iZHhAs01-NHtR-wyEtFOTAmOkzpSjPo1jm20', '01_Pilotage_Projets', 'Rapport Hebdomadire Infra.pptx', 'S'],
  ['1l-6f3oqFmToPe7MFd78wq6gxfcrw2rZNrNntVR1k2FY', '02_CPM', 'Ajout d’une entreprise au vivier sectoriel', 'S'],
  ['1olPzVux6UclQVytVphOIFFvIxCEbhfgUJieqwipls7g', '02_CPM', 'Base_Entreprises', 'S'],
  ['1gCOLKACGOTgzSs7pY_qYESD27du0O3Q6OmrHiqjrJ2I', '02_CPM', 'Suivi CPM V 5', 'R']
];
// Fichiers créés par la passerelle (cherchés par nom parmi les fichiers du secrétariat) : rangés dans 98_Systeme_Donnees
const SYSTEME_ = ['Gateway_DB', 'Gateway_Secrets'];

function deplacer() {
  const racines = DriveApp.getRootFolder().getFoldersByName(RACINE_);
  if (!racines.hasNext()) throw new Error('Dossier « ' + RACINE_ + ' » introuvable à la racine de Mon Drive.');
  const racine = racines.next(), cache = {};
  function dossier(chemin) {
    if (cache[chemin]) return cache[chemin];
    let cur = racine;
    chemin.split('/').forEach(function (nom) { const it = cur.getFoldersByName(nom); cur = it.hasNext() ? it.next() : cur.createFolder(nom); });
    return (cache[chemin] = cur);
  }
  const bilan = { ok: 0, deja: 0, traiter: [], absent: [] };
  function placer(id, chemin, nom, quand) {
    const dest = dossier(chemin);
    let obj = null, estDossier = false;
    try { obj = DriveApp.getFileById(id); } catch (e) { try { obj = DriveApp.getFolderById(id); estDossier = true; } catch (e2) { obj = null; } }
    if (!obj) { bilan.absent.push(nom + ' (' + id + ')'); return; }
    const parents = estDossier ? obj.getParents() : obj.getParents();
    while (parents.hasNext()) { if (parents.next().getId() === dest.getId()) { bilan.deja += 1; return; } }
    try { obj.moveTo(dest); bilan.ok += 1; Logger.log('OK  ' + nom + '  ->  ' + chemin); }
    catch (e) { bilan.traiter.push(nom + ' [' + (quand === 'R' ? 'rayanem' : 'secrétariat') + '] : ' + e.message); }
  }
  A_DEPLACER_.forEach(function (l) { placer(l[0], l[1], l[2], l[3]); });
  SYSTEME_.forEach(function (nom) {
    const it = DriveApp.getFilesByName(nom); let n = 0;
    while (it.hasNext()) { const f = it.next(); if (f.getOwner() && f.getOwner().getEmail() === Session.getActiveUser().getEmail()) { placer(f.getId(), '98_Systeme_Donnees', nom, 'S'); n += 1; } }
    if (!n) bilan.absent.push(nom + ' (introuvable parmi vos fichiers)');
  });
  Logger.log('--- BILAN ---');
  Logger.log('Déplacés : ' + bilan.ok + ' · déjà en place : ' + bilan.deja);
  Logger.log('À TRAITER (' + bilan.traiter.length + ') :\n' + bilan.traiter.join('\n'));
  Logger.log('INTROUVABLES (' + bilan.absent.length + ') :\n' + bilan.absent.join('\n'));
}
