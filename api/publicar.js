'use strict';
// POST /api/publicar  { baseSha, data, fotos: { ruta: blobSha }, cambios, forzar }  →  { sha, data }
// Arma UN commit con el catálogo + las fotos nuevas y borra las fotos del catálogo que ya no usa nadie.
// Solo puede escribir data/catalogo.json y assets/catalogo/: el resto de la web queda fuera de su alcance.
const P = require('./_lib/panel');

module.exports = async (req, res) => {
  if (!P.exigirPost(req, res)) return;
  const cfg = P.exigirSesion(req, res);
  if (!cfg) return;
  try {
    const body = await P.leerJSON(req, 1024 * 1024);
    const data = P.limpiarCatalogo(body.data);
    const fotos = body.fotos && typeof body.fotos === 'object' ? body.fotos : {};
    Object.entries(fotos).forEach(([ruta, sha]) => {
      if (!P.RUTA_FOTO_NUEVA.test(ruta) || !/^[0-9a-f]{40}$/.test(String(sha))) throw P.invalido('Una foto nueva llegó con datos inválidos.');
    });

    // ¿Alguien publicó desde otro dispositivo después de que este panel cargó el catálogo?
    const actual = await P.leerCatalogo(cfg);
    if (actual.sha && actual.sha !== body.baseSha && !body.forzar) throw Object.assign(new Error('conflicto'), { code: 'conflicto' });

    const ref = await P.gh(cfg, `/git/ref/heads/${P.REPO.branch}`);
    const base = await P.gh(cfg, `/git/commits/${ref.object.sha}`);

    let existentes = [];
    try {
      const lista = await P.gh(cfg, `/contents/${P.IMG_DIR}?ref=${ref.object.sha}`);
      existentes = (Array.isArray(lista) ? lista : []).filter((f) => f.type === 'file').map((f) => f.path);
    } catch (e) {
      if (!(e.github && e.status === 404)) throw e;
    }

    const usadas = new Set(data.productos.map((p) => p.foto).filter(Boolean));
    const arbol = [];
    usadas.forEach((ruta) => {
      if (!ruta.startsWith(`${P.IMG_DIR}/`)) return;
      if (fotos[ruta]) arbol.push({ path: ruta, mode: '100644', type: 'blob', sha: fotos[ruta] });
      else if (!existentes.includes(ruta)) throw P.invalido('Una foto no se terminó de subir. Volvé a elegirla y publicá de nuevo.');
    });
    existentes.forEach((ruta) => {
      if (!usadas.has(ruta)) arbol.push({ path: ruta, mode: '100644', type: 'blob', sha: null });
    });
    arbol.push({ path: P.DATA_PATH, mode: '100644', type: 'blob', content: `${JSON.stringify(data, null, 2)}\n` });

    const n = Math.max(1, Math.min(999, parseInt(body.cambios, 10) || 1));
    const tree = await P.gh(cfg, '/git/trees', { method: 'POST', body: { base_tree: base.tree.sha, tree: arbol } });
    const commit = await P.gh(cfg, '/git/commits', {
      method: 'POST',
      body: { message: `Catálogo: ${n} cambio${n === 1 ? '' : 's'} desde el panel`, tree: tree.sha, parents: [ref.object.sha] },
    });
    await P.gh(cfg, `/git/refs/heads/${P.REPO.branch}`, { method: 'PATCH', body: { sha: commit.sha } });

    const f = await P.gh(cfg, `/contents/${P.DATA_PATH}?ref=${commit.sha}`);
    return P.responder(res, 200, { sha: f.sha, data });
  } catch (e) {
    return P.fallar(res, e);
  }
};
