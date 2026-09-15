'use strict';
// GET /api/estado  →  { ok: true } si el panel está configurado y el token de GitHub puede leer el catálogo.
// No devuelve datos: sirve para diagnosticar (token vencido, sin permiso, falta la variable) sin entrar al panel.
const P = require('./_lib/panel');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return P.responder(res, 405, { error: 'metodo' });
  const cfg = P.config();
  if (!cfg) return P.responder(res, 500, { error: 'config' });
  try {
    await P.gh(cfg, `/contents/${P.DATA_PATH}?ref=${P.REPO.branch}`);
    return P.responder(res, 200, { ok: true });
  } catch (e) {
    return P.fallar(res, e);
  }
};
