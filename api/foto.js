'use strict';
// POST /api/foto  { path, b64 }  →  { sha }
// Sube la foto a GitHub como blob suelto. No toca la web hasta que /api/publicar la incluya en un commit.
// Se sube de a una para no pasar el límite de 4,5 MB por pedido de Vercel.
const P = require('./_lib/panel');

const MAX = 2 * 1024 * 1024;
const esImagen = (buf) => (
  (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
  || (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
);

module.exports = async (req, res) => {
  if (!P.exigirPost(req, res)) return;
  const cfg = P.exigirSesion(req, res);
  if (!cfg) return;
  try {
    const body = await P.leerJSON(req, 3.5 * 1024 * 1024);
    if (!P.RUTA_FOTO_NUEVA.test(String(body.path || ''))) throw P.invalido('El nombre de la foto no es válido.');
    const buf = Buffer.from(String(body.b64 || ''), 'base64');
    if (!buf.length) throw P.invalido('La foto llegó vacía.');
    if (buf.length > MAX) throw Object.assign(new Error('grande'), { code: 'grande' });
    if (!esImagen(buf)) throw P.invalido('El archivo no es una foto JPG o WEBP.');
    const blob = await P.gh(cfg, '/git/blobs', { method: 'POST', body: { content: buf.toString('base64'), encoding: 'base64' } });
    return P.responder(res, 200, { sha: blob.sha });
  } catch (e) {
    return P.fallar(res, e);
  }
};
