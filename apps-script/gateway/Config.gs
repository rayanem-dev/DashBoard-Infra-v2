/** Configuration de la passerelle. Les identifiants des classeurs sont dans les propriétés du script (jamais dans le code). */
var CFG = {
  SESSION_SECONDS: 6 * 3600,      // limite du CacheService : 6 h
  MAX_TENTATIVES: 5,              // par e-mail, sur la fenêtre ci-dessous
  FENETRE_SECONDES: 15 * 60,
  HASH_ITER: 2000,
  MDP_MIN: 4,
  MDP_DEFAUT: '0000',             // mot de passe provisoire (voir definirMotDePasseParDefaut)
  REMEMBER_DAYS: 30,              // « Rester connecté »
  CODE_ACTIVATION_HEURES: 48,     // code de secours remis par le secrétariat
  CODE_EMAIL_MINUTES: 30          // code envoyé par e-mail (première connexion / oubli)
};

/** Propriétés du script : DB_ID (classeur Utilisateurs/Modules/Droits), SECRETS_ID (classeur des empreintes), PEPPER. */
function prop_(k) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('Propriété manquante : ' + k + ' (lancer installer())');
  return v;
}
