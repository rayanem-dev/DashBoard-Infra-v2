/**
 * Diffusion d'un document généré (prise en charge, repas à emporter, ordre de travail…) par e-mail, TOUJOURS au clic de l'agent :
 *  - le secrétariat (coché par défaut) ;
 *  - et/ou la boîte du service de l'agent qui a créé le document.
 * Les adresses viennent de ce fichier, jamais de la page : un navigateur ne peut pas envoyer à une adresse de son choix.
 * Partie PURE (testée en Node : test/diffusion.test.js), puis l'envoi.
 */
var Diffusion = (function () {
  function sans(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  var SECRETARIAT = [{ nom: 'Secrétariat Division INFRA', email: 'sec-infra.rns@sonatrach.dz' }, { nom: 'sec.infra.rns', email: 'sec.infra.rns@gmail.com' }, { nom: 'Madani Rayane', email: 'rayanem@gmail.com' }];
  // [expression sur le service sans accents, boîte]
  var SERVICES = [
    [/construction|genie civil/, { nom: 'Service Construction INFRA - RNS', email: 'infra_constr.rns@sonatrach.dz' }],
    [/electrom/, { nom: 'Service Électromécanique INFRA - RNS', email: 'infra_electromec.rns@sonatrach.dz' }],
    [/entretien/, { nom: 'Service Travaux Entretien INFRA - RNS', email: 'service_travaux_entretien_infra.rns@sonatrach.dz' }],
    [/cpm|passation/, { nom: 'CPM INFRA RNS', email: 'rns.cpm_infra@sonatrach.dz' }],
    [/division infra|chef de division|^division/, { nom: 'Chef Division INFRA - RNS', email: 'cdd_infra.rns@sonatrach.dz' }]
  ];
  function boiteService(service) { var t = sans(service); for (var i = 0; i < SERVICES.length; i += 1) if (SERVICES[i][0].test(t)) return SERVICES[i][1]; return null; }
  /** Ce que la page propose : le secrétariat (coché) et la boîte du service de l'agent (si connue). */
  function proposer(service) { return { secretariat: SECRETARIAT.slice(), service: boiteService(service) }; }
  /** Adresses choisies : opts = { secretariat, service } ; peutService = faux pour un compte prestataire (jamais de boîte de service). Lève une erreur sans destinataire. */
  function destinataires(opts, service, peutService) {
    var out = [], vus = {}, add = function (b) { if (!vus[b.email]) { vus[b.email] = 1; out.push(b); } };
    if (opts && opts.secretariat) SECRETARIAT.forEach(add);
    if (opts && opts.service) {
      if (peutService === false) throw new Error('L\'envoi au service n\'est pas disponible pour ce compte');
      var b = boiteService(service); if (!b) throw new Error('Aucune boîte e-mail connue pour votre service (« ' + (service || 'non renseigné') + ' ») : cochez le secrétariat.');
      add(b);
    }
    if (!out.length) throw new Error('Cochez au moins un destinataire.');
    return out;
  }
  /** Retire d'un HTML fourni par la page ce qui n'a rien à faire dans un e-mail (scripts, cadres, gestionnaires d'événements). */
  function assainir(html) {
    return String(html == null ? '' : html).replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '').replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, '');
  }
  function sujetPropre(s) { return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/[\u0000-\u001F]/g, '').trim().slice(0, 150); }
  return { proposer: proposer, destinataires: destinataires, boiteService: boiteService, assainir: assainir, sujetPropre: sujetPropre, SECRETARIAT: SECRETARIAT };
})();
if (typeof module !== 'undefined') module.exports = Diffusion;

var DIFFUSION_MAX_HTML_ = 400000, DIFFUSION_MAX_PDF_ = 7000000;
/** Envoie un document aux destinataires choisis : pièce jointe PDF (octets), et/ou page HTML (corps du message, avec une copie PDF si la conversion réussit). Appelée par les actions et par la prise en charge. */
function diffusionEnvoyer_(u, doc, opts) {
  var prest = typeof badgesPortee_ === 'function' && badgesPortee_(u) !== null;
  var dest = Diffusion.destinataires(opts, u.service, !prest);
  var sujet = Diffusion.sujetPropre(doc.sujet) || 'Document généré', pieces = [];
  var nom = String(doc.nom || 'document').replace(/[^\w.\- àâäçéèêëîïôöùûüÿ]/gi, '_').slice(0, 80).replace(/\.pdf$/i, '');
  if (doc.octets) pieces.push(Utilities.newBlob(doc.octets, 'application/pdf', nom + '.pdf'));
  var corps = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' + (doc.message ? '<p>' + String(doc.message).replace(/&/g, '&amp;').replace(/</g, '&lt;').slice(0, 1000) + '</p>' : '<p>Veuillez trouver ci-joint le document généré depuis le portail de la Division Infrastructure RNS.</p>') +
    '<p style="color:#666;font-size:12px">Envoyé par ' + String(Annuaire.nomAffichable(u.nom, u.email)).replace(/</g, '&lt;') + (u.service ? ' — ' + String(u.service).replace(/</g, '&lt;') : '') + '</p></div>';
  if (doc.html) {
    var h = Diffusion.assainir(doc.html); if (h.length > DIFFUSION_MAX_HTML_) throw new Error('Document trop volumineux pour être envoyé par e-mail.');
    corps += h;
    if (!doc.octets) { try { pieces.push(Utilities.newBlob('<html><head><meta charset="utf-8"></head><body>' + h + '</body></html>', 'text/html', nom + '.html').getAs('application/pdf').setName(nom + '.pdf')); } catch (e) { /* le corps du message suffit */ } }
  }
  MailApp.sendEmail({ to: dest.map(function (d) { return d.email; }).join(','), subject: sujet, htmlBody: corps, attachments: pieces, replyTo: u.email, name: 'Division Infrastructure RNS' });
  Store.journal('diffusion', u.email, sujet + ' → ' + dest.map(function (d) { return d.email; }).join(', '));
  return { destinataires: dest.map(function (d) { return d.nom; }) };
}
function diffusionOptions_(req) {
  var u = Auth.userFromToken(req.token), prest = typeof badgesPortee_ === 'function' && badgesPortee_(u) !== null, p = Diffusion.proposer(u.service);
  return { secretariat: p.secretariat.map(function (b) { return b.nom; }), service: prest ? null : (p.service ? p.service.nom : null), service_agent: u.service || '' };
}
function diffusionEnvoyer_Action_(req) {
  var u = Auth.userFromToken(req.token), pdf = String(req.pdf_base64 || '');
  if (!pdf && !req.html) throw new Error('Rien à envoyer');
  if (pdf.length > DIFFUSION_MAX_PDF_) throw new Error('PDF trop volumineux pour être envoyé par e-mail.');
  return diffusionEnvoyer_(u, { sujet: req.sujet, nom: req.nom, message: req.message, html: req.html, octets: pdf ? Utilities.base64Decode(pdf) : null }, { secretariat: !!req.secretariat, service: !!req.service });
}
