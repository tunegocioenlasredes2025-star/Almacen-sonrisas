'use strict';
/* Lógica compartida de las funciones del panel (/api).
   Vercel no publica como ruta los archivos que empiezan con "_", así que esto no es accesible desde afuera.

   Variables de entorno (se cargan en Vercel → Settings → Environment Variables):
     GITHUB_TOKEN    token fine-grained con "Contents: Read and write" SOLO sobre Almacen-sonrisas
     PANEL_PASSWORD  contraseña con la que entra el cliente al panel
   Cambiar PANEL_PASSWORD cierra todas las sesiones abiertas. */

const crypto = require('crypto');

const REPO = { owner: 'tunegocioenlasredes2025-star', repo: 'Almacen-sonrisas', branch: 'main' };
const DATA_PATH = 'data/catalogo.json';
const IMG_DIR = 'assets/catalogo';
const GITHUB = process.env.GITHUB_API_URL || 'https://api.github.com';
const COOKIE = 'panel_sesion';
const DURACION = 30 * 24 * 3600; // segundos
const CATS = ['cotillon', 'reposteria', 'libreria'];
const ETQ = ['', 'oferta', 'nuevo', 'temporada'];
const RUTA_FOTO_NUEVA = /^assets\/catalogo\/[a-z0-9-]+\.(webp|jpg)$/;
const RUTA_FOTO = /^assets\/(img|catalogo)\/[a-z0-9._-]+\.(webp|jpe?g|png)$/i;

const config = () => {
  const token = process.env.GITHUB_TOKEN;
  const pass = process.env.PANEL_PASSWORD;
  return token && pass ? { token, pass } : null;
};

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const hoyAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

function responder(res, status, obj, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  res.end(JSON.stringify(obj));
}

const invalido = (mensaje) => Object.assign(new Error(mensaje), { status: 400, code: 'invalido' });

async function leerJSON(req, limite) {
  // En Vercel el cuerpo ya viene parseado en req.body; en un servidor Node común hay que leerlo.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}');
    return req.body;
  }
  const partes = [];
  let total = 0;
  for await (const p of req) {
    total += p.length;
    if (total > limite) throw Object.assign(new Error('Cuerpo demasiado grande'), { status: 413, code: 'grande' });
    partes.push(p);
  }
  const s = Buffer.concat(partes).toString('utf8');
  return s ? JSON.parse(s) : {};
}

/* ---------- Sesión: cookie firmada con HMAC ---------- */
const clave = (cfg) => crypto.createHash('sha256').update(`almacen-panel\n${cfg.token}\n${cfg.pass}`).digest();
const firma = (cfg, payload) => crypto.createHmac('sha256', clave(cfg)).update(payload).digest('base64url');

function crearSesion(cfg) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + DURACION })).toString('base64url');
  return `${COOKIE}=${payload}.${firma(cfg, payload)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURACION}`;
}
const borrarSesion = () => `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function sesionValida(cfg, req) {
  const par = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!par) return false;
  const [payload, sig] = par.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(firma(cfg, payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now() / 1000;
  } catch (_) {
    return false;
  }
}

function passwordCorrecta(cfg, intento) {
  const a = crypto.createHash('sha256').update(String(intento || '')).digest();
  const b = crypto.createHash('sha256').update(cfg.pass).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------- Guardas ---------- */
function exigirPost(req, res) {
  if (req.method !== 'POST') { responder(res, 405, { error: 'metodo' }); return false; }
  // Un formulario de otro sitio no puede mandar este encabezado: corta intentos de CSRF.
  if (req.headers['x-panel'] !== '1') { responder(res, 403, { error: 'origen' }); return false; }
  return true;
}

function exigirSesion(req, res) {
  const cfg = config();
  if (!cfg) { responder(res, 500, { error: 'config' }); return null; }
  if (!sesionValida(cfg, req)) { responder(res, 401, { error: 'sesion' }); return null; }
  return cfg;
}

/* ---------- GitHub ---------- */
async function gh(cfg, ruta, { method = 'GET', body } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${cfg.token}`,
    'User-Agent': 'almacen-sonrisas-panel',
  };
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${GITHUB}/repos/${REPO.owner}/${REPO.repo}${ruta}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    let msg = '';
    try { msg = (await r.json()).message; } catch (_) { /* sin cuerpo */ }
    throw Object.assign(new Error(msg || `GitHub ${r.status}`), { status: r.status, github: true });
  }
  return r.status === 204 ? null : r.json();
}

// Traduce errores de GitHub y de validación a respuestas que el panel sabe mostrar.
function fallar(res, e) {
  if (e.code === 'invalido') return responder(res, 400, { error: 'invalido', mensaje: e.message });
  if (e.code === 'grande') return responder(res, 413, { error: 'grande' });
  if (e.code === 'conflicto') return responder(res, 409, { error: 'conflicto' });
  if (e instanceof SyntaxError) return responder(res, 400, { error: 'invalido', mensaje: 'Los datos llegaron mal.' });
  if (e.github && e.status === 401) return responder(res, 502, { error: 'token' });
  if (e.github && (e.status === 403 || e.status === 404)) return responder(res, 502, { error: 'permiso' });
  if (e.github && (e.status === 409 || e.status === 422)) return responder(res, 409, { error: 'choque' });
  console.error(e);
  return responder(res, 500, { error: 'servidor' });
}

/* ---------- Catálogo ---------- */
function limpiarCatalogo(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.productos)) throw invalido('El catálogo no tiene el formato esperado.');
  if (d.productos.length > 500) throw invalido('Hay demasiados productos (máximo 500).');
  const ids = new Set();
  const productos = d.productos.map((p) => {
    const nombre = String((p && p.nombre) || '').trim().slice(0, 80);
    if (!nombre) throw invalido('Hay un producto sin nombre.');
    let id = String(p.id || '').slice(0, 40);
    if (!/^[a-z0-9-]+$/i.test(id) || ids.has(id)) id = `p-${crypto.randomBytes(5).toString('hex')}`;
    ids.add(id);
    const foto = String(p.foto || '');
    if (foto && !RUTA_FOTO.test(foto)) throw invalido(`La foto de "${nombre}" tiene una ruta inválida.`);
    const precio = typeof p.precio === 'number' && Number.isFinite(p.precio) && p.precio >= 0 ? Math.round(p.precio) : null;
    return {
      id,
      nombre,
      categoria: CATS.includes(p.categoria) ? p.categoria : 'cotillon',
      descripcion: String(p.descripcion || '').trim().slice(0, 180),
      precio,
      etiqueta: ETQ.includes(p.etiqueta) ? p.etiqueta : '',
      disponible: p.disponible !== false,
      destacado: !!p.destacado,
      foto,
    };
  });
  return { actualizado: hoyAR(), mostrarPrecios: !!d.mostrarPrecios, productos };
}

async function leerCatalogo(cfg) {
  try {
    const f = await gh(cfg, `/contents/${DATA_PATH}?ref=${REPO.branch}`);
    return { sha: f.sha, data: JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')) };
  } catch (e) {
    if (e.github && e.status === 404) return { sha: null, data: { actualizado: hoyAR(), mostrarPrecios: false, productos: [] } };
    throw e;
  }
}

module.exports = {
  REPO, DATA_PATH, IMG_DIR, RUTA_FOTO_NUEVA,
  config, esperar, responder, leerJSON, invalido,
  crearSesion, borrarSesion, passwordCorrecta, exigirPost, exigirSesion,
  gh, fallar, limpiarCatalogo, leerCatalogo,
};
