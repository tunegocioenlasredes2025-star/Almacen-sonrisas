'use strict';
// POST /api/login  { password }  →  cookie de sesión por 30 días
const P = require('./_lib/panel');

module.exports = async (req, res) => {
  if (!P.exigirPost(req, res)) return;
  const cfg = P.config();
  if (!cfg) return P.responder(res, 500, { error: 'config' });
  let body;
  try {
    body = await P.leerJSON(req, 10000);
  } catch (e) {
    return P.fallar(res, e);
  }
  if (!P.passwordCorrecta(cfg, body.password)) {
    await P.esperar(900); // frena a quien pruebe contraseñas al voleo
    return P.responder(res, 401, { error: 'password' });
  }
  return P.responder(res, 200, { ok: true }, { 'Set-Cookie': P.crearSesion(cfg) });
};
