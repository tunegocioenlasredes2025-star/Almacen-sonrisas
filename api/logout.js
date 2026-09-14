'use strict';
// POST /api/logout  →  borra la cookie de sesión
const P = require('./_lib/panel');

module.exports = async (req, res) => {
  if (!P.exigirPost(req, res)) return;
  return P.responder(res, 200, { ok: true }, { 'Set-Cookie': P.borrarSesion() });
};
