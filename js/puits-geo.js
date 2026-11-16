/**
 * Géométrie de la carte des puits : projection Web Mercator (la même que les fonds de carte OpenStreetMap), distances, cap, tuiles.
 * Fonctions pures, sans dépendance : testées en Node (apps-script/gateway/test/puits.test.js).
 */
(function (racine) {
  var R_TERRE = 6371008.8, TUILE = 256, LAT_MAX = 85.0511287798;
  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  /** lat/lon → pixels « monde » au niveau de zoom z (zoom fractionnaire accepté) */
  function versPixels(lat, lon, z) {
    var s = TUILE * Math.pow(2, z), la = Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)), sin = Math.sin(rad(la));
    return { x: (lon + 180) / 360 * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
  }
  function depuisPixels(x, y, z) {
    var s = TUILE * Math.pow(2, z), n = Math.PI - 2 * Math.PI * y / s;
    return { lat: deg(Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))), lon: x / s * 360 - 180 };
  }
  /** distance en mètres (haversine) */
  function distance(lat1, lon1, lat2, lon2) {
    var a = Math.sin(rad(lat2 - lat1) / 2) * Math.sin(rad(lat2 - lat1) / 2) + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) * Math.sin(rad(lon2 - lon1) / 2);
    return 2 * R_TERRE * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /** cap initial en degrés (0 = nord, 90 = est) de A vers B */
  function cap(lat1, lon1, lat2, lon2) {
    var y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2)), x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }
  var POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  function pointCardinal(c) { return POINTS[Math.round(c / 45) % 8]; }
  function texteDistance(m) { return m < 950 ? Math.round(m / 10) * 10 + ' m' : (m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000)) + ' km'; }
  /** zoom auquel la boîte { minLat, maxLat, minLon, maxLon } tient dans largeur × hauteur pixels (marge en pixels) */
  function zoomPour(b, largeur, hauteur, marge) {
    for (var z = 18; z >= 0; z -= 0.25) {
      var a = versPixels(b.maxLat, b.minLon, z), c = versPixels(b.minLat, b.maxLon, z);
      if (c.x - a.x <= largeur - 2 * marge && c.y - a.y <= hauteur - 2 * marge) return z;
    }
    return 0;
  }
  function boite(points) {
    var b = { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 };
    points.forEach(function (p) { b.minLat = Math.min(b.minLat, p.lat); b.maxLat = Math.max(b.maxLat, p.lat); b.minLon = Math.min(b.minLon, p.lon); b.maxLon = Math.max(b.maxLon, p.lon); });
    return b;
  }
  /** tuiles { z, x, y } couvrant la fenêtre pixels [x0,x1]×[y0,y1] au zoom entier z */
  function tuiles(z, x0, y0, x1, y1) {
    var n = Math.pow(2, z), out = [], tx0 = Math.floor(x0 / TUILE), tx1 = Math.floor(x1 / TUILE), ty0 = Math.floor(y0 / TUILE), ty1 = Math.floor(y1 / TUILE);
    for (var ty = Math.max(0, ty0); ty <= Math.min(n - 1, ty1); ty += 1) for (var tx = tx0; tx <= tx1; tx += 1) out.push({ z: z, x: ((tx % n) + n) % n, y: ty, px: tx * TUILE, py: ty * TUILE });
    return out;
  }
  var API = { versPixels: versPixels, depuisPixels: depuisPixels, distance: distance, cap: cap, pointCardinal: pointCardinal, texteDistance: texteDistance, zoomPour: zoomPour, boite: boite, tuiles: tuiles, TUILE: TUILE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.PuitsGeo = API;
})(typeof window !== 'undefined' ? window : this);
