/** E-mails de la passerelle (envoyés depuis le compte qui déploie le script). Quota Gmail : ~100 destinataires / jour. */
var Mail = (function () {
  function masquer(email) {
    var p = String(email).split('@'); if (p.length !== 2) return '***';
    var l = p[0];
    return (l.length <= 2 ? l.charAt(0) : l.slice(0, 2)) + '***@' + p[1];
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function envoyerCode(email, nom, code, minutes) {
    MailApp.sendEmail({
      to: email,
      name: 'Division Infrastructure RNS',
      subject: 'Votre code de connexion : ' + code,
      htmlBody: '<p>Bonjour ' + esc(nom) + ',</p>' +
        '<p>Votre code à usage unique pour définir votre mot de passe :</p>' +
        '<p style="font-size:28px;letter-spacing:6px;font-weight:700">' + code + '</p>' +
        '<p>Il est valable ' + minutes + ' minutes. Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message : rien ne sera modifié.</p>' +
        '<p>— Tableau de bord Division Infrastructure</p>'
    });
  }
  return { masquer: masquer, envoyerCode: envoyerCode };
})();

if (typeof module !== 'undefined') module.exports = Mail;
