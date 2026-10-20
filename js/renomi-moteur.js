/* Copie de Renomi (dépôt rayanem-dev/renomi, src/moteur.js) : apprentissage des règles de nommage. */
/**
 * Renomi — moteur d'apprentissage du nommage (pur, sans DOM : testé avec Node, utilisable dans le navigateur ou Apps Script).
 *
 *   doc    = { nom: 'scan0042.pdf', texte: 'texte extrait du PDF / de l'image (OCR)' }
 *   regle  = { id, mots: ['facture', 'sarl'], modele: '{date}_Facture_{numero}', usages: 3 }
 *   regles = tableau de règles, appris au fil des corrections (stocké par l'application, exportable en JSON)
 *
 * proposer(doc, regles)            → { nom, regle, confiance, champs }   (le nom proposé, avec l'extension d'origine)
 * apprendre(doc, nomChoisi, regles) → regles mises à jour (une règle ajoutée ou affinée) : appelé quand l'utilisateur valide ou corrige un nom
 */
(function (racine) {
  var VIDES = 'avec dans pour sont cette cela leurs être avoir plus sans entre vers chez comme tout tous nous vous elle elles ils the and les des une aux par sur est pas que qui'.split(' ');

  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function extension(nom) { var m = /(\.[A-Za-z0-9]{2,5})$/.exec(String(nom || '')); return m ? m[1].toLowerCase() : ''; }
  function sansExtension(nom) { return String(nom || '').replace(/\.[A-Za-z0-9]{2,5}$/, ''); }
  /** Nom de fichier sûr : sans caractères interdits, espaces réduits, 120 caractères au plus. */
  function nettoyer(s) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[. ]+|[. ]+$/g, '').slice(0, 120).trim(); }

  /** Champs repérés dans le texte : date (AAAA-MM-JJ), numero (N° …), montant, annee. */
  function champs(texte, nom) {
    var t = String(texte || '') + ' ' + sansExtension(nom || ''), c = {}, m;
    if ((m = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/.exec(t))) c.date = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    else if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t))) c.date = m[0];
    if ((m = /\bN\s*[°ºo.]\s*:?\s*([A-Za-z0-9][A-Za-z0-9\/.\-_]{1,24})/.exec(t))) c.numero = m[1].replace(/[\/.]+$/, '').replace(/\//g, '-');
    if ((m = /\b(\d{1,3}(?:[  .]\d{3})*(?:,\d{1,2})?)\s*(?:DA|DZD|€|EUR)\b/i.exec(t))) c.montant = m[1].replace(/[  ]/g, '');
    if (c.date) c.annee = c.date.slice(0, 4);
    return c;
  }
  /** Mots caractéristiques d'un texte (les plus fréquents, hors mots vides), pour reconnaître le même genre de document. */
  function motsCles(texte, n) {
    var f = {}; norm(texte).split(/[^a-z0-9]+/).forEach(function (w) { if (w.length >= 5 && !/\d/.test(w) && VIDES.indexOf(w) < 0) f[w] = (f[w] || 0) + 1; });
    return Object.keys(f).sort(function (a, b) { return f[b] - f[a] || (a < b ? -1 : 1); }).slice(0, n || 4);
  }
  function remplir(modele, c) { return nettoyer(String(modele).replace(/\{(\w+)\}/g, function (_, k) { return c[k] || ''; }).replace(/[_\-\s]{2,}/g, function (s) { return s.charAt(0); }).replace(/^[_\-\s]+|[_\-\s]+$/g, '')); }

  /** Score d'une règle pour un document : part de ses mots-clés présents dans le texte (0 à 1), un peu favorisée par son usage. */
  function score(regle, texteNorm) {
    var mots = regle.mots || []; if (!mots.length) return 0;
    var ok = mots.filter(function (w) { return texteNorm.indexOf(w) >= 0; }).length;
    return ok / mots.length + Math.min(0.05, (regle.usages || 0) * 0.005);
  }

  function proposer(doc, regles) {
    var ext = extension(doc.nom), tn = norm(doc.texte + ' ' + doc.nom), c = champs(doc.texte, doc.nom), meilleure = null, s = 0;
    (regles || []).forEach(function (r) { var x = score(r, tn); if (x > s) { s = x; meilleure = r; } });
    if (meilleure && s >= 0.6) return { nom: remplir(meilleure.modele, c) + ext, regle: meilleure.id, confiance: Math.min(1, s), champs: c };
    var base = [c.date || '', motsCles(doc.texte, 2).join('-')].filter(Boolean).join('_') || sansExtension(doc.nom);
    return { nom: nettoyer(base) + ext, regle: null, confiance: 0, champs: c };
  }

  /** Transforme le nom choisi en modèle : les valeurs repérées dans le document redeviennent des {champs}. */
  function modeleDe(nomChoisi, c) {
    var m = sansExtension(nomChoisi);
    ['montant', 'numero', 'date', 'annee'].forEach(function (k) { if (c[k] && m.indexOf(c[k]) >= 0) m = m.split(c[k]).join('{' + k + '}'); });
    return m;
  }
  function apprendre(doc, nomChoisi, regles) {
    var liste = (regles || []).map(function (r) { return Object.assign({}, r); }), c = champs(doc.texte, doc.nom), modele = modeleDe(nomChoisi, c), mots = motsCles(String(doc.texte || '') + ' ' + sansExtension(doc.nom || ''), 4);
    var proposition = proposer(doc, liste), existante = liste.filter(function (r) { return r.id === proposition.regle; })[0] || liste.filter(function (r) { return r.modele === modele; })[0];
    if (existante) {
      existante.modele = modele; existante.usages = (existante.usages || 0) + 1;
      var commun = (existante.mots || []).filter(function (w) { return mots.indexOf(w) >= 0; });
      existante.mots = commun.length >= 2 ? commun : mots.slice(0, Math.max(2, commun.length));       // ne garde que ce qui revient d'un document à l'autre
      return liste;
    }
    if (!mots.length) return liste;                      // rien de caractéristique à retenir (texte non lu, nom banal) : pas de règle inutile
    liste.push({ id: 'r' + (liste.length + 1) + '-' + Date.now().toString(36), mots: mots, modele: modele, usages: 1 });
    return liste;
  }

  var API = { proposer: proposer, apprendre: apprendre, champs: champs, motsCles: motsCles, nettoyer: nettoyer, extension: extension };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Renomi = API;
})(typeof window !== 'undefined' ? window : this);
