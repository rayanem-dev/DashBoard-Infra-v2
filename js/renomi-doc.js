/**
 * Renommage — documents du personnel (ce que sait faire la page « Documents » de Sijil) : types, agents de l'annuaire, doublons.
 * Le moteur de reconnaissance est AutoDetectDoc (js/autodetect-renommage.js, copie de lib/_autodetect-renommage) ; ce fichier n'ajoute que les aides de la page.
 * Pur, sans DOM : testé en Node (apps-script/gateway/test/renomidoc.test.js).
 */
(function (racine) {
  var TYPES = [['titre_conge', 'Titre de congé (TC)'], ['fiche_emolument', 'Fiche de paie (FDP)'], ['contrat', 'Contrat'], ['attestation_cnas', 'Attestation CNAS'], ['maj_cnas', 'Mise à jour CNAS'],
    ['attestation_travail', 'Attestation de travail'], ['certificat_travail', 'Certificat de travail'], ['attestation_emoluments', 'Attestation d\'émoluments'], ['ats', 'ATS'], ['autre', 'Autre']];
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function libelle(type) { var t = TYPES.filter(function (x) { return x[0] === type; })[0]; return t ? t[1] : type; }
  /** Personnes de l'annuaire (action annuaire_personnes) utilisables comme « agents » : nom et prénom présents, sans doublon. */
  function agentsDe(personnes) {
    var vus = {}, out = [];
    (personnes || []).forEach(function (p) {
      var nom = String(p && p.nom || '').replace(/\s+/g, ' ').trim(), k = norm(nom);
      if (nom.split(' ').length < 2 || vus[k]) return; vus[k] = 1; out.push({ id: nom, nom: nom });
    });
    return out;
  }
  /** Agent dont le nom correspond exactement (sans accents ni casse, ordre des mots indifférent) ; null sinon. */
  function agentParNom(agents, texte) {
    var mots = norm(texte).split(' ').filter(Boolean).sort().join(' '); if (!mots) return null;
    return (agents || []).filter(function (a) { return norm(a.nom).split(' ').filter(Boolean).sort().join(' ') === mots; })[0] || null;
  }
  /**
   * Doublons dans la liste : « exact » = même empreinte (même fichier déposé deux fois) ; « periode » = même agent, même type et même période.
   * liste = [{ id, nom, hash, type, agentId, champs }] ; periodeOf = AutoDetectDoc.periodeOf. Retourne { id: [{ niveau, avec }] } (seulement les éléments concernés).
   */
  function doublons(liste, periodeOf) {
    var out = {}; function add(id, niveau, avec) { (out[id] = out[id] || []).push({ niveau: niveau, avec: avec }); }
    liste.forEach(function (a, i) {
      for (var j = 0; j < i; j += 1) {
        var b = liste[j];
        if (a.hash && a.hash === b.hash) { add(a.id, 'exact', b.nom); continue; }
        if (a.type && a.type === b.type && a.type !== 'autre' && a.agentId && a.agentId === b.agentId) {
          var pa = periodeOf(a.type, a.champs || {}), pb = periodeOf(b.type, b.champs || {});
          if (pa && pa === pb) add(a.id, 'periode', b.nom);
        }
      }
    });
    return out;
  }
  var API = { TYPES: TYPES, libelle: libelle, agentsDe: agentsDe, agentParNom: agentParNom, doublons: doublons };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.RenomiDoc = API;
})(typeof window !== 'undefined' ? window : this);
