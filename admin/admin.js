/* Panel del catálogo — El Almacén de Sonrisas
   El catálogo vive en data/catalogo.json dentro del repo de GitHub.
   "Publicar" hace un commit (catálogo + fotos nuevas) y Vercel republica la web sola.
   El código de acceso (token de GitHub) se guarda solo en el navegador de quien lo carga. */
(() => {
  'use strict';

  const CFG = {
    owner: 'tunegocioenlasredes2025-star',
    repo: 'Almacen-sonrisas',
    branch: 'main',
    dataPath: 'data/catalogo.json',
    imgDir: 'assets/catalogo',
    site: '../',
  };
  const API = 'https://api.github.com';
  const R = `/repos/${CFG.owner}/${CFG.repo}`;
  const CATS = { cotillon: 'Cotillón', reposteria: 'Repostería', libreria: 'Librería' };
  const ETQ = { oferta: 'Oferta', nuevo: 'Nuevo', temporada: 'De temporada' };
  const TOKEN_KEY = 'almacen-admin-token';
  const DRAFT_KEY = 'almacen-admin-borrador';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const hoyISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'producto';
  const nuevoId = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const mime = (path) => (path.endsWith('.webp') ? 'image/webp' : 'image/jpeg');

  const ICO = {
    subir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    bajar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
    duplicar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    borrar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  };

  // Estado: lo publicado (remoto) y lo que se está editando (data). pend = fotos nuevas en base64.
  const st = { token: null, sha: null, remoto: null, data: null, pend: {}, prev: {}, cambios: 0, q: '', cat: '' };

  /* ---------- Utilidades de interfaz ---------- */
  const ver = (nombre) => $$('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== nombre; });
  let tt;
  const toast = (msg, tipo = 'ok') => {
    const t = $('[data-toast]');
    t.textContent = msg;
    t.className = `toast toast--${tipo} is-on`;
    clearTimeout(tt);
    tt = setTimeout(() => t.classList.remove('is-on'), tipo === 'error' ? 8000 : 4500);
  };
  const ocupado = (btn, on) => { if (btn) { btn.classList.toggle('is-busy', on); btn.disabled = on; } };

  /* ---------- Token ---------- */
  const leerToken = () => { try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); } catch (_) { return null; } };
  const guardarToken = (t, recordar) => { try { (recordar ? localStorage : sessionStorage).setItem(TOKEN_KEY, t); } catch (_) { /* nada */ } };
  const borrarToken = () => { try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (_) { /* nada */ } };

  /* ---------- GitHub ---------- */
  async function gh(path, opts = {}) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${st.token}`,
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + path, { ...opts, headers, cache: 'no-store' });
    if (!res.ok) {
      let msg = '';
      try { msg = (await res.json()).message; } catch (_) { /* sin cuerpo */ }
      const e = new Error(msg || res.statusText);
      e.status = res.status;
      throw e;
    }
    return res.status === 204 ? null : res.json();
  }

  const b64enc = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const b64dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
  const blobB64 = (blob) => new Promise((ok, mal) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.onerror = mal;
    fr.readAsDataURL(blob);
  });

  const errorTexto = (e) => {
    if (e && e.status === 401) return 'El código de acceso no es válido o venció. Volvé a ingresarlo.';
    if (e && e.status === 403) return 'El código no tiene permiso para guardar. Tiene que tener "Contents: Read and write" sobre Almacen-sonrisas.';
    if (e && e.status === 404) return 'No se encontró el repositorio. Revisá que el código tenga acceso a Almacen-sonrisas.';
    if (e && (e.status === 409 || e.status === 422)) return 'Se cruzó con otro cambio publicado al mismo tiempo. Probá publicar de nuevo.';
    if (e && e.name === 'TypeError') return 'No hay conexión con GitHub. Revisá internet y probá de nuevo.';
    return `Algo salió mal: ${(e && e.message) || e}`;
  };

  /* ---------- Datos ---------- */
  const normalizar = (d) => {
    const data = d && typeof d === 'object' ? d : {};
    const productos = Array.isArray(data.productos) ? data.productos : [];
    return {
      actualizado: data.actualizado || hoyISO(),
      mostrarPrecios: !!data.mostrarPrecios,
      productos: productos.filter((p) => p && p.nombre).map((p) => ({
        id: p.id || nuevoId(),
        nombre: String(p.nombre),
        categoria: CATS[p.categoria] ? p.categoria : 'cotillon',
        descripcion: p.descripcion ? String(p.descripcion) : '',
        precio: typeof p.precio === 'number' && p.precio >= 0 ? p.precio : null,
        etiqueta: ETQ[p.etiqueta] ? p.etiqueta : '',
        disponible: p.disponible !== false,
        destacado: !!p.destacado,
        foto: p.foto ? String(p.foto) : '',
      })),
    };
  };

  const src = (path) => st.prev[path] || CFG.site + path;
  const fotosUsadas = () => new Set(st.data.productos.map((p) => p.foto).filter(Boolean));
  const limpiarPendientes = () => {
    const usadas = fotosUsadas();
    Object.keys(st.pend).forEach((p) => { if (!usadas.has(p)) delete st.pend[p]; });
  };

  const guardarBorrador = () => {
    const b = { baseSha: st.sha, data: st.data, pend: st.pend, cambios: st.cambios };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(b));
    } catch (_) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...b, pend: {} }));
        toast('Las fotos nuevas no entran en el borrador del navegador: publicá pronto para no perderlas.', 'error');
      } catch (__) { /* sin almacenamiento */ }
    }
  };
  const leerBorrador = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return null; } };
  const borrarBorrador = () => { try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* nada */ } };

  const cambio = () => {
    st.cambios += 1;
    guardarBorrador();
    pintar();
  };

  /* ---------- Inicio ---------- */
  async function iniciar() {
    ver('cargando');
    $('[data-sesion]').hidden = false;
    try {
      await gh(R);
      try {
        const f = await gh(`${R}/contents/${CFG.dataPath}?ref=${CFG.branch}`);
        st.sha = f.sha;
        st.remoto = normalizar(JSON.parse(b64dec(f.content)));
      } catch (e) {
        if (e.status !== 404) throw e;
        st.sha = null;
        st.remoto = normalizar({ productos: [] });
      }
    } catch (e) {
      $('[data-sesion]').hidden = true;
      if (e.status === 401 || e.status === 404) { borrarToken(); st.token = null; }
      ver('login');
      const err = $('[data-login-error]');
      err.textContent = errorTexto(e);
      err.hidden = false;
      return;
    }

    st.data = clone(st.remoto);
    st.pend = {};
    st.cambios = 0;
    const b = leerBorrador();
    if (b && b.cambios > 0) {
      const aviso = b.baseSha === st.sha
        ? `Tenés ${b.cambios} cambio${b.cambios === 1 ? '' : 's'} sin publicar de la última vez. ¿Los recuperás?`
        : 'Tenés cambios sin publicar de la última vez, pero el catálogo se modificó después desde otro dispositivo. Si los recuperás y publicás, reemplazás esa versión. ¿Recuperarlos igual?';
      if (confirm(aviso)) {
        st.data = normalizar(b.data);
        st.pend = b.pend || {};
        st.cambios = b.cambios;
        Object.entries(st.pend).forEach(([p, b64]) => { st.prev[p] = `data:${mime(p)};base64,${b64}`; });
      } else {
        borrarBorrador();
      }
    }
    pintar();
    ver('panel');
  }

  /* ---------- Pintar ---------- */
  function pintar() {
    const n = st.data.productos.length;
    const sinStock = st.data.productos.filter((p) => !p.disponible).length;
    $('[data-resumen]').textContent = `${n} producto${n === 1 ? '' : 's'}${sinStock ? ` · ${sinStock} sin stock` : ''} · publicado el ${st.remoto.actualizado.split('-').reverse().join('/')}`;
    const estado = $('[data-estado]');
    estado.textContent = st.cambios ? `${st.cambios} cambio${st.cambios === 1 ? '' : 's'} sin publicar` : 'Todo publicado';
    estado.classList.toggle('is-dirty', st.cambios > 0);
    $('[data-publicar]').disabled = st.cambios === 0;
    $('[data-descartar]').hidden = st.cambios === 0;
    $('[data-precios]').checked = st.data.mostrarPrecios;
    pintarLista();
  }

  function pintarLista() {
    const ul = $('[data-lista]');
    const filtrando = !!(st.q || st.cat);
    $('[data-nota-orden]').hidden = !filtrando;
    const total = st.data.productos.length;
    const items = st.data.productos
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => (!st.cat || p.categoria === st.cat) && (!st.q || norm(`${p.nombre} ${p.descripcion}`).includes(st.q)));
    if (!items.length) {
      ul.innerHTML = `<li class="vacio">${total ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no hay productos. Tocá “Nuevo producto” para cargar el primero.'}</li>`;
      return;
    }
    ul.innerHTML = items.map(({ p, i }) => {
      const inicial = `<span class="sin-foto">${esc(CATS[p.categoria].charAt(0))}</span>`;
      const img = p.foto
        ? `${inicial}<img src="${esc(src(p.foto))}" alt="" loading="lazy" onerror="this.remove()">`
        : inicial;
      const precio = typeof p.precio === 'number' ? money.format(p.precio) : 'Sin precio';
      return `<li class="prod prod--${p.categoria}${p.disponible ? '' : ' is-off'}" data-id="${esc(p.id)}">
        <div class="prod__img">${img}</div>
        <div class="prod__info">
          <strong>${esc(p.nombre)}</strong>
          <div class="prod__tags">
            <span class="tag tag--cat">${CATS[p.categoria]}</span>
            ${p.etiqueta ? `<span class="tag tag--${p.etiqueta}">${ETQ[p.etiqueta]}</span>` : ''}
            ${p.destacado ? '<span class="tag tag--dest">Destacado</span>' : ''}
            <span class="prod__precio">${precio}</span>
          </div>
        </div>
        <label class="switch"><input type="checkbox" data-act="disponible" ${p.disponible ? 'checked' : ''}><span aria-hidden="true"></span><em>${p.disponible ? 'Hay stock' : 'Sin stock'}</em></label>
        <div class="prod__acts">
          <button class="btn btn--line btn--sm" type="button" data-act="editar">Editar</button>
          <button class="ico-btn" type="button" data-act="subir" aria-label="Subir" title="Subir" ${filtrando || i === 0 ? 'disabled' : ''}>${ICO.subir}</button>
          <button class="ico-btn" type="button" data-act="bajar" aria-label="Bajar" title="Bajar" ${filtrando || i === total - 1 ? 'disabled' : ''}>${ICO.bajar}</button>
          <button class="ico-btn" type="button" data-act="duplicar" aria-label="Duplicar" title="Duplicar">${ICO.duplicar}</button>
          <button class="ico-btn ico-btn--danger" type="button" data-act="borrar" aria-label="Borrar" title="Borrar">${ICO.borrar}</button>
        </div>
      </li>`;
    }).join('');
  }

  /* ---------- Acciones de la lista ---------- */
  const lista = $('[data-lista]');
  const buscarProd = (el) => {
    const li = el.closest('[data-id]');
    const idx = li ? st.data.productos.findIndex((p) => p.id === li.dataset.id) : -1;
    return { idx, p: st.data.productos[idx] };
  };

  lista.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const { idx, p } = buscarProd(b);
    if (!p) return;
    const arr = st.data.productos;
    switch (b.dataset.act) {
      case 'editar': abrirEditor(p); break;
      case 'subir': if (idx > 0) { [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; cambio(); } break;
      case 'bajar': if (idx < arr.length - 1) { [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]; cambio(); } break;
      case 'duplicar':
        arr.splice(idx + 1, 0, { ...clone(p), id: nuevoId(), nombre: `${p.nombre} (copia)`.slice(0, 80) });
        cambio();
        toast('Producto duplicado. Editalo y publicá.');
        break;
      case 'borrar':
        if (confirm(`¿Borrar “${p.nombre}” del catálogo?`)) {
          arr.splice(idx, 1);
          limpiarPendientes();
          cambio();
          toast('Producto borrado. Se va de la web cuando publiques.');
        }
        break;
      default: break;
    }
  });

  lista.addEventListener('change', (e) => {
    const i = e.target.closest('input[data-act="disponible"]');
    if (!i) return;
    const { p } = buscarProd(i);
    if (!p) return;
    p.disponible = i.checked;
    cambio();
  });

  $('[data-buscar]').addEventListener('input', (e) => { st.q = norm(e.target.value.trim()); pintarLista(); });
  $('[data-filtro-cat]').addEventListener('change', (e) => { st.cat = e.target.value; pintarLista(); });
  $('[data-precios]').addEventListener('change', (e) => { st.data.mostrarPrecios = e.target.checked; cambio(); });
  $('[data-nuevo]').addEventListener('click', () => abrirEditor(null));

  /* ---------- Editor ---------- */
  const dlg = $('[data-editor]');
  const fe = $('[data-editor-form]');
  const campo = (n) => fe.elements[n];
  let edit = null;

  const pintarFoto = () => {
    const url = edit.nueva ? edit.nueva.url : (edit.foto ? src(edit.foto) : '');
    $('[data-foto-prev]').innerHTML = url ? `<img src="${esc(url)}" alt="">` : '<span>Sin foto</span>';
    $('[data-foto-quitar]').hidden = !url;
    $('[data-foto-txt]').textContent = url ? 'Cambiar foto' : 'Subir foto';
  };

  function abrirEditor(p) {
    edit = { id: p ? p.id : null, foto: p ? p.foto : '', nueva: null };
    $('[data-editor-titulo]').textContent = p ? 'Editar producto' : 'Nuevo producto';
    campo('nombre').value = p ? p.nombre : '';
    campo('categoria').value = p ? p.categoria : (st.cat || 'cotillon');
    campo('descripcion').value = p ? p.descripcion : '';
    campo('precio').value = p && typeof p.precio === 'number' ? p.precio : '';
    campo('etiqueta').value = p ? p.etiqueta : '';
    campo('disponible').checked = p ? p.disponible : true;
    campo('destacado').checked = p ? p.destacado : false;
    $('[data-editor-error]').hidden = true;
    pintarFoto();
    dlg.showModal();
    campo('nombre').focus();
  }

  const errorEditor = (msg) => {
    const el = $('[data-editor-error]');
    el.textContent = msg;
    el.hidden = false;
  };

  async function procesarFoto(file) {
    if (!file.type.startsWith('image/')) throw new Error('no es imagen');
    const bmp = await createImageBitmap(file);
    const max = 1000;
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * s);
    const h = Math.round(bmp.height * s);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.82));
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
      ext = 'jpg';
    }
    return { b64: await blobB64(blob), url: URL.createObjectURL(blob), ext };
  }

  campo('foto').addEventListener('change', async () => {
    const file = campo('foto').files[0];
    if (!file) return;
    const txt = $('[data-foto-txt]');
    txt.textContent = 'Procesando…';
    try {
      const r = await procesarFoto(file);
      edit.nueva = { ...r, path: `${CFG.imgDir}/${slug(campo('nombre').value)}-${Date.now().toString(36)}.${r.ext}` };
      $('[data-editor-error]').hidden = true;
    } catch (_) {
      errorEditor('No se pudo leer esa imagen. Probá con una foto JPG o PNG.');
    } finally {
      campo('foto').value = '';
      pintarFoto();
    }
  });

  $('[data-foto-quitar]').addEventListener('click', () => {
    edit.nueva = null;
    edit.foto = '';
    pintarFoto();
  });

  fe.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = campo('nombre').value.trim();
    if (!nombre) { errorEditor('Poné el nombre del producto.'); campo('nombre').focus(); return; }
    const precioTxt = campo('precio').value.trim();
    let precio = null;
    if (precioTxt !== '') {
      precio = Math.round(Number(precioTxt));
      if (!Number.isFinite(precio) || precio < 0) { errorEditor('El precio tiene que ser un número sin puntos ni signos. Ej: 1500'); campo('precio').focus(); return; }
    }
    let foto = edit.foto || '';
    if (edit.nueva) {
      foto = edit.nueva.path;
      st.pend[foto] = edit.nueva.b64;
      st.prev[foto] = edit.nueva.url;
    }
    const datos = {
      nombre,
      categoria: campo('categoria').value,
      descripcion: campo('descripcion').value.trim(),
      precio,
      etiqueta: campo('etiqueta').value,
      disponible: campo('disponible').checked,
      destacado: campo('destacado').checked,
      foto,
    };
    const eraNuevo = !edit.id;
    if (eraNuevo) st.data.productos.unshift({ id: nuevoId(), ...datos });
    else Object.assign(st.data.productos.find((x) => x.id === edit.id), datos);
    limpiarPendientes();
    dlg.close();
    cambio();
    toast(eraNuevo ? 'Producto agregado. Tocá “Publicar cambios” para que salga en la web.' : 'Producto actualizado. Tocá “Publicar cambios” para que salga en la web.');
  });

  $$('[data-editor-cancelar]').forEach((b) => b.addEventListener('click', () => dlg.close()));

  /* ---------- Publicar ---------- */
  async function publicar() {
    if (!st.cambios) return;
    const btn = $('[data-publicar]');
    ocupado(btn, true);
    try {
      let actual = null;
      try { actual = await gh(`${R}/contents/${CFG.dataPath}?ref=${CFG.branch}`); } catch (e) { if (e.status !== 404) throw e; }
      if (actual && actual.sha !== st.sha && !confirm('El catálogo se modificó desde otro dispositivo después de que lo abriste. Si publicás, se reemplaza por tu versión. ¿Publicar igual?')) return;

      const ref = await gh(`${R}/git/ref/heads/${CFG.branch}`);
      const base = await gh(`${R}/git/commits/${ref.object.sha}`);
      limpiarPendientes();
      const usadas = fotosUsadas();
      const arbol = [];

      for (const [path, b64] of Object.entries(st.pend)) {
        const blob = await gh(`${R}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: b64, encoding: 'base64' }) });
        arbol.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
      }

      // Fotos de la carpeta del catálogo que ya no usa ningún producto: se borran del repo.
      let existentes = [];
      try { existentes = await gh(`${R}/contents/${CFG.imgDir}?ref=${CFG.branch}`); } catch (e) { if (e.status !== 404) throw e; }
      (Array.isArray(existentes) ? existentes : []).forEach((f) => {
        if (f.type === 'file' && !usadas.has(f.path)) arbol.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
      });

      const data = { ...clone(st.data), actualizado: hoyISO() };
      arbol.push({ path: CFG.dataPath, mode: '100644', type: 'blob', content: `${JSON.stringify(data, null, 2)}\n` });

      const tree = await gh(`${R}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree: arbol }) });
      const n = st.cambios;
      const commit = await gh(`${R}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({ message: `Catálogo: ${n} cambio${n === 1 ? '' : 's'} desde el panel`, tree: tree.sha, parents: [ref.object.sha] }),
      });
      await gh(`${R}/git/refs/heads/${CFG.branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });

      const f = await gh(`${R}/contents/${CFG.dataPath}?ref=${commit.sha}`);
      st.sha = f.sha;
      st.data = data;
      st.remoto = clone(data);
      st.pend = {};
      st.cambios = 0;
      borrarBorrador();
      pintar();
      toast('¡Publicado! La web se actualiza sola en 1 o 2 minutos.');
    } catch (e) {
      if (e.status === 401) {
        toast(errorTexto(e), 'error');
        borrarToken();
        st.token = null;
        $('[data-sesion]').hidden = true;
        ver('login');
      } else {
        toast(errorTexto(e), 'error');
      }
    } finally {
      ocupado(btn, false);
      $('[data-publicar]').disabled = st.cambios === 0;
    }
  }

  $('[data-publicar]').addEventListener('click', publicar);

  $('[data-descartar]').addEventListener('click', () => {
    if (!confirm('¿Descartar todos los cambios sin publicar? Vuelve a como está en la web.')) return;
    st.data = clone(st.remoto);
    st.pend = {};
    st.cambios = 0;
    borrarBorrador();
    pintar();
    toast('Cambios descartados.');
  });

  /* ---------- Menú ---------- */
  const menu = $('.menu');
  document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });

  $('[data-copia]').addEventListener('click', () => {
    const blob = new Blob([`${JSON.stringify(st.data, null, 2)}\n`], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `catalogo-almacen-${hoyISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    menu.open = false;
  });

  $('[data-salir]').addEventListener('click', () => {
    if (st.cambios && !confirm('Tenés cambios sin publicar. Quedan guardados en este navegador, pero no en la web. ¿Cerrar sesión igual?')) return;
    borrarToken();
    st.token = null;
    menu.open = false;
    $('[data-sesion]').hidden = true;
    ver('login');
  });

  window.addEventListener('beforeunload', (e) => {
    if (st.cambios) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Ingreso ---------- */
  const fl = $('[data-login]');
  fl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = fl.elements.token.value.trim();
    const err = $('[data-login-error]');
    err.hidden = true;
    if (!/^(github_pat_|ghp_)\w{20,}$/.test(token)) {
      err.textContent = 'Eso no parece un código de GitHub. Tiene que empezar con github_pat_';
      err.hidden = false;
      return;
    }
    const btn = fl.querySelector('button[type="submit"]');
    ocupado(btn, true);
    st.token = token;
    guardarToken(token, fl.elements.recordar.checked);
    fl.reset();
    fl.elements.recordar.checked = true;
    ocupado(btn, false);
    await iniciar();
  });

  st.token = leerToken();
  if (st.token) iniciar();
  else ver('login');
})();
