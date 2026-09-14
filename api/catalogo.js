'use strict';
// GET /api/catalogo  →  { sha, data }  (lo lee de GitHub, no de la web publicada, para no ver una versión vieja)
const P = require('./_lib/panel');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return P.responder(res, 405, { error: 'metodo' });
  const cfg = P.exigirSesion(req, res);
  if (!cfg) return;
  try {
    return P.responder(res, 200, await P.leerCatalogo(cfg));
  } catch (e) {
    return P.fallar(res, e);
  }
};
