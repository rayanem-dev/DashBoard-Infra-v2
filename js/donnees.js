/** Lecture des feuilles de suivi par la passerelle (action « donnees »). Retourne le texte CSV, comme l'ancien export. Nécessite js/api.js. */
var Donnees = {
  csv: function (source) { return Api.call('donnees', { source: source }).then(function (r) { return r.csv; }); }
};
