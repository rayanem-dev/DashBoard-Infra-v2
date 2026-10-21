/** E-mails de la passerelle (envoyés depuis le compte qui déploie le script). Quota Gmail : ~100 destinataires / jour. */
var Mail = (function () {
  function masquer(email) {
    var p = String(email).split('@'); if (p.length !== 2) return '***';
    var l = p[0];
    return (l.length <= 2 ? l.charAt(0) : l.slice(0, 2)) + '***@' + p[1];
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function envoyerCode(email, nom, code, minutes, objet) {
    var adresse = objet === 'adresse';
    MailApp.sendEmail({
      to: email,
      name: 'Division Infrastructure RNS',
      subject: (adresse ? 'Confirmez votre adresse e-mail : ' : 'Votre code de connexion : ') + code,
      htmlBody: '<p>Bonjour ' + esc(nom) + ',</p>' +
        '<p>' + (adresse ? 'Votre code à usage unique pour confirmer cette adresse e-mail dans le portail :' : 'Votre code à usage unique pour définir votre mot de passe :') + '</p>' +
        '<p style="font-size:28px;letter-spacing:6px;font-weight:700">' + code + '</p>' +
        '<p>Il est valable ' + minutes + ' minutes. Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message : rien ne sera modifié.</p>' +
        '<p>— Tableau de bord Division Infrastructure</p>'
    });
  }
  function fr(d) { return /^\d{4}-\d{2}-\d{2}/.test(String(d)) ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : String(d || ''); }
  function lignes(t) { return (t || []).map(function (p) { return '<tr><td>' + (p.type === 'T' ? 'Travail' : 'Récupération') + '</td><td>' + fr(p.du) + '</td><td>' + fr(p.au) + '</td><td style="text-align:right">' + p.jours + '</td></tr>'; }).join(''); }
  /** Demande de modification de planning : à l'intéressé, au responsable, au chef de division et au secrétariat (un seul message). */
  function envoyerDemande(dest, d, titre, lien, parNom) {
    if (!dest.length) return;
    var nom = esc((d.agent.nom + ' ' + d.agent.prenom).trim()), st = d.statut === 'approuvee' ? 'Approuvée' : d.statut === 'refusee' ? 'Refusée' : d.statut === 'appliquee' ? 'Appliquée au planning, en attente de décision' : 'En attente de décision';
    var tab = function (t) { return '<table cellpadding="4" style="border-collapse:collapse;font-size:13px"><tr style="background:#f3f4f6"><th align="left">Statut</th><th align="left">Du</th><th align="left">Au</th><th align="right">Jours</th></tr>' + lignes(t) + '</table>'; };
    MailApp.sendEmail({
      to: dest.join(','), name: 'Division Infrastructure RNS', subject: '[Planning] ' + titre + ' ' + d.numero + ' — ' + (d.agent.nom + ' ' + d.agent.prenom).trim(),
      htmlBody: '<p><b>' + esc(titre) + '</b> n° ' + esc(d.numero) + '</p>' +
        '<p>Agent : <b>' + nom + '</b> (' + esc(d.agent.fonction) + ' — ' + esc(d.agent.service) + ')<br>Motif : ' + esc(d.motif) + '<br>Émise par : ' + esc(d.emetteur) + '<br>Situation : <b>' + st + '</b>' +
        (d.decide_par ? '<br>Décision de : ' + esc(d.decide_par) + (d.commentaire ? ' — ' + esc(d.commentaire) : '') : '') + '</p>' +
        '<p><u>Planning actuel</u></p>' + tab(d.actuel) + '<p><u>Planning modifié</u></p>' + tab(d.modifie) +
        '<p>Document à imprimer, signer et valider : <a href="' + esc(lien) + '">' + esc(lien) + '</a> (connexion au portail requise).</p>' +
        '<p>— Tableau de bord Division Infrastructure</p>'
    });
  }
  /** Changement d'affectation : à l'intéressé, à l'auteur, au chef de division et au secrétariat. */
  function envoyerAffectation(dest, a) {
    if (!dest.length) return;
    MailApp.sendEmail({
      to: dest.join(','), name: 'Division Infrastructure RNS', subject: '[Affectation] ' + a.nom + ' : ' + a.ancien + ' → ' + a.nouveau,
      htmlBody: '<p><b>Changement d\'affectation</b> n° ' + esc(a.id) + '</p><p>Agent : <b>' + esc(a.nom) + '</b><br>Ancien service : ' + esc(a.ancien || '—') + '<br>Nouveau service : <b>' + esc(a.nouveau) + '</b>' +
        (a.date_effet ? '<br>Date d\'effet : ' + esc(fr(a.date_effet)) : '') + (a.motif ? '<br>Motif : ' + esc(a.motif) : '') + '<br>Enregistré par : ' + esc(a.par) + '</p>' +
        '<p>Le service est modifié dans l\'Organigramme (BDDORGA) et dans le portail.</p><p>— Tableau de bord Division Infrastructure</p>'
    });
  }
  /** Invitation à se connecter : lien, première connexion, et brève présentation des applications accordées (menu = Droits.menu). */
  function corpsInvitation(nom, menu, lien, mdpDefaut) {
    var apps = [];
    (menu || []).forEach(function (m) { (m.apps || []).forEach(function (a) { apps.push('<li><b>' + esc(a.titre) + '</b>' + (a.description ? ' — ' + esc(String(a.description).slice(0, 140)) : '') + '</li>'); }); });
    return '<p>Bonjour ' + esc(nom) + ',</p>' +
      '<p>Votre accès au <b>portail de la Division Infrastructure</b> est ouvert.</p>' +
      '<p><b>Se connecter :</b> <a href="' + esc(lien) + '">' + esc(lien) + '</a></p>' +
      '<p><b>Première connexion :</b> saisissez votre adresse e-mail professionnelle' + (mdpDefaut ? ' et le mot de passe provisoire <b>0000</b>, puis choisissez votre mot de passe.' : ', puis « mot de passe oublié » pour recevoir un code à usage unique et choisir votre mot de passe.') + '</p>' +
      (apps.length ? '<p>Voici les applications auxquelles vous avez accès :</p><ul>' + apps.join('') + '</ul>' : '<p>Aucune application ne vous est accordée pour le moment ; elles apparaîtront ici dès que vos droits seront configurés.</p>') +
      '<p>Besoin d\'aide ? Répondez à ce message ou contactez le secrétariat.</p><p>— Division Infrastructure RNS</p>';
  }
  function envoyerInvitation(email, nom, menu, lien, mdpDefaut) {
    MailApp.sendEmail({ to: email, name: 'Division Infrastructure RNS', subject: 'Invitation : votre accès au portail Division Infrastructure', htmlBody: corpsInvitation(nom, menu, lien, mdpDefaut) });
  }
  return { corpsInvitation: corpsInvitation, envoyerInvitation: envoyerInvitation, masquer: masquer, envoyerCode: envoyerCode, envoyerDemande: envoyerDemande, envoyerAffectation: envoyerAffectation };
})();

if (typeof module !== 'undefined') module.exports = Mail;
