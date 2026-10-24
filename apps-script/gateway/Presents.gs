/**
 * Prestataires présents sur site à une date donnée, d'après les « Enquêtes administratives » (un onglet par entreprise / contrat).
 * Règle (affichée à l'écran) : une personne est comptée présente à la date D si
 *   1. elle figure dans l'onglet de son entreprise et sa date de prise en charge (colonne « تاريخ التسجيل », ex. « Date d'enregistrement ») est antérieure ou égale à D
 *      — une personne sans date d'enregistrement (inscrite avant que la date soit tenue) est comptée, sauf si on le décoche ;
 *   2. le contrat de son onglet, connu du Suivi CPM, est en cours à D (date ODS ≤ D ≤ échéance) — un contrat sans dates connues n'exclut personne.
 * Lecture seule : rien n'est écrit dans les Enquêtes ni dans le Suivi CPM.
 */
// ---------- logique pure (testée en Node) ----------
function presentsDate_(s) {
  if (s == null || s === '') return '';
  if (Object.prototype.toString.call(s) === '[object Date]') return isNaN(s.getTime()) ? '' : s.getFullYear() + '-' + ('0' + (s.getMonth() + 1)).slice(-2) + '-' + ('0' + s.getDate()).slice(-2);
  var t = String(s).trim(), m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return m[1] + '-' + m[2] + '-' + m[3];
  if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(t))) { var a = m[3].length === 2 ? '20' + m[3] : m[3]; return a + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
  return '';
}
function presentsPlus_(iso, jours, mois) {
  var d = new Date(iso + 'T00:00:00Z'); if (isNaN(d.getTime())) return '';
  if (mois) d.setUTCMonth(d.getUTCMonth() + mois); if (jours) d.setUTCDate(d.getUTCDate() + jours); return d.toISOString().slice(0, 10);
}
/** Fin d'un contrat : l'échéance indiquée, sinon date ODS + durée (≤ 60 : mois ; au-delà : jours) − 1 jour ; '' si inconnue. */
function presentsFinContrat_(echeance, ods, duree) {
  var e = presentsDate_(echeance); if (e) return e;
  var d0 = presentsDate_(ods), n = Number(String(duree == null ? '' : duree).replace(',', '.').replace(/[^\d.]/g, ''));
  if (!d0 || !isFinite(n) || n <= 0) return '';
  return presentsPlus_(presentsPlus_(d0, n > 60 ? Math.round(n) : 0, n > 60 ? 0 : Math.round(n)), -1, 0);
}
/**
 * groupes : [{ entreprise, contrat, intitule, debut, fin, personnes: [{ nom, prenom, fonction, structure, date_enreg }] }] ; date : « aaaa-mm-jj » ;
 * options : { sansDate (défaut true), contratValide (défaut true), regDu, regAu : filtre sur la date de prise en charge (une personne sans date est alors écartée) }. Renvoie { entreprises: [...], total, exclus: { apres, sans_date_exclus, contrat } }.
 */
function presentsCalculer_(groupes, date, options) {
  var o = options || {}, sansDate = o.sansDate !== false, contratValide = o.contratValide !== false, du = presentsDate_(o.regDu), au = presentsDate_(o.regAu), plage = !!(du || au);
  var exclus = { apres: 0, sans_date: 0, contrat: 0, hors_plage: 0 }, out = [], total = 0;
  groupes.forEach(function (g) {
    var contratEnCours = !contratValide || ((!g.debut || g.debut <= date) && (!g.fin || date <= g.fin));
    var gardes = [];
    g.personnes.forEach(function (p) {
      var reg = presentsDate_(p.date_enreg);
      if (!contratEnCours) { exclus.contrat += 1; return; }
      if (reg ? reg > date : !sansDate) { if (reg) exclus.apres += 1; else exclus.sans_date += 1; return; }
      if (plage && (!reg || (du && reg < du) || (au && reg > au))) { exclus.hors_plage += 1; return; }   // filtre par date de prise en charge
      gardes.push({ nom: p.nom, prenom: p.prenom, fonction: p.fonction || '', structure: p.structure || '', date_enreg: reg });
    });
    if (!gardes.length) return;
    gardes.sort(function (a, b) { return (a.nom + ' ' + a.prenom) < (b.nom + ' ' + b.prenom) ? -1 : 1; });
    total += gardes.length;
    out.push({ entreprise: g.entreprise, contrat: g.contrat || '', intitule: g.intitule || '', debut: g.debut || '', fin: g.fin || '', personnes: gardes });
  });
  out.sort(function (a, b) { return String(a.entreprise).toLowerCase() < String(b.entreprise).toLowerCase() ? -1 : 1; });
  return { entreprises: out, total: total, exclus: exclus };
}

// ---------- lecture des Enquêtes et du Suivi CPM ----------
function presentsLireGroupes_() {
  var avert = [], contrats = {}, entCpm = [];
  try {
    var enr = cpmEnregistrements_(lignesSource_('cpm'));
    entCpm = badgesEntreprisesCpm_(enr);
    enr.ordre.forEach(function (k) {
      var d = enr.dossiers[k], num = Badges.vide(d.n_contrat); if (!num) return;
      contrats[Badges.norm(num).replace(/ /g, '')] = { debut: presentsDate_(d.date_ods), fin: presentsFinContrat_(d.echeance, d.date_ods, d.duree_contrat), intitule: Badges.vide(d.intitule) };
    });
  } catch (e) { avert.push('Suivi CPM illisible (' + e.message + ') : les dates de contrat ne sont pas contrôlées.'); }
  var ss = enqClasseur_(), cpmNoms = entCpm.map(function (e) { return e.nom; }), groupes = [];
  ss.getSheets().forEach(function (sh) {
    var lignes = sh.getDataRange().getDisplayValues(), a = Badges.analyserEnquetes(lignes, sh.getName());
    if (a.erreur || !a.personnes.length) return;
    var col = Badges.colonnesEnquetes(lignes), cd = col ? enqColDate_(lignes, col) : -1;
    var nom = badgesAppariement_(a.entreprise, cpmNoms) || badgesAppariement_(a.onglet, cpmNoms) || a.entreprise;
    var ent = entCpm.filter(function (e) { return Badges.norm(e.nom) === Badges.norm(nom); })[0] || { contrats: [] };
    var contrat = badgesContratOnglet_(a.onglet, ent.contrats); if (!contrat && ent.contrats.length === 1) contrat = ent.contrats[0].numero;
    var c = contrats[Badges.norm(contrat).replace(/ /g, '')] || {};
    groupes.push({ entreprise: nom, contrat: contrat, intitule: c.intitule || '', debut: c.debut || '', fin: c.fin || '',
      personnes: a.personnes.map(function (p) { return { nom: p.nom, prenom: p.prenom, fonction: p.fonction, structure: p.structure, date_enreg: cd >= 0 ? (lignes[p.ligne - 1] || [])[cd] : '' }; }) });
  });
  return { groupes: groupes, avertissements: avert };
}
/** Action « presents_donnees » : { date, sans_date, contrat_valide, reg_du, reg_au } → entreprises présentes à la date (droit Badges, lecture). */
function presentsDonnees_(req) {
  badgesDroit_(req, 1);
  var date = presentsDate_(req.date) || Dates.today();
  var cache = CacheService.getScriptCache(), cle = 'PRESENTS_SRC', vu = cache.get(cle), src = null;
  if (vu && !req.force) { try { src = JSON.parse(vu); } catch (e) { src = null; } }
  if (!src) { src = presentsLireGroupes_(); try { var t = JSON.stringify(src); if (t.length < 95000) cache.put(cle, t, 300); } catch (e) { /* trop gros : pas de cache */ } }
  var r = presentsCalculer_(src.groupes, date, { sansDate: req.sans_date !== false, contratValide: req.contrat_valide !== false, regDu: req.reg_du, regAu: req.reg_au });
  r.date = date; r.avertissements = src.avertissements; r.sans_date_total = src.groupes.reduce(function (n, g) { return n + g.personnes.filter(function (p) { return !presentsDate_(p.date_enreg); }).length; }, 0);
  return r;
}
if (typeof module !== 'undefined') module.exports = { presentsCalculer_: presentsCalculer_, presentsDate_: presentsDate_, presentsFinContrat_: presentsFinContrat_ };
