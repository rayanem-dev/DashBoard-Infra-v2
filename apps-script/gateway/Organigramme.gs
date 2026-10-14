/**
 * Organigramme dynamique : construit à partir de l'onglet « Utilisateurs » (lui-même synchronisé avec BDDORGA et mis à jour par le module « affectation »).
 * Réservé aux personnes ayant accès au module « rh » (la carte « Organigramme » y est rangée). Aucune adresse e-mail n'en sort ; le téléphone, oui (annuaire interne).
 */
var RANG_ORGA_ = { chef_division: 0, chef_service: 1, interim_chef_service: 2, cadre_sup: 3, ordonnateur: 4 };

function organigramme_(req) {
  var u = Auth.userFromToken(req.token);
  if ((acces_(u).rh || 0) < 1) throw Object.assign(new Error('Droits insuffisants'), { code: 'DROITS' });
  var groupes = {}, ordre = [];
  Store.table('Utilisateurs').forEach(function (x) {
    if (String(x.actif) === '0' || !x.email) return;
    var nomService = String(x.service || '').replace(/\s+/g, ' ').trim() || 'Sans service', cle = nomService.toLowerCase();
    if (!groupes[cle]) { groupes[cle] = { nom: nomService, racine: false, membres: [] }; ordre.push(cle); }
    var role = Droits.roleCanon(x.role), rang = RANG_ORGA_[role] === undefined ? 9 : RANG_ORGA_[role];
    if (role === 'chef_division') groupes[cle].racine = true;
    groupes[cle].membres.push({ nom: Annuaire.nomAffichable(x.nom, x.email), fonction: x.fonction || '', dependance: x.dependance || '', role: role, chef: rang <= 2, rang: rang, telephone: x.telephone || '' });
  });
  var services = ordre.map(function (k) { return groupes[k]; });
  services.forEach(function (s) { s.membres.sort(function (a, b) { return a.rang - b.rang || (a.nom < b.nom ? -1 : 1); }); s.membres.forEach(function (m) { delete m.rang; }); });
  services.sort(function (a, b) { return (b.racine ? 1 : 0) - (a.racine ? 1 : 0) || (a.nom < b.nom ? -1 : 1); });
  return { services: services, total: services.reduce(function (n, s) { return n + s.membres.length; }, 0) };
}
