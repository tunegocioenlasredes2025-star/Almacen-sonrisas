/* El Almacén de Sonrisas — interacciones */
(() => {
  'use strict';

  const WA = '5491156669809';
  const waLink = (msg) => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const fechaLinda = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const CATS = { cotillon: 'Cotillón', reposteria: 'Repostería', libreria: 'Librería' };
  const ETQ = { oferta: 'Oferta', nuevo: 'Nuevo', temporada: 'De temporada' };

  /* ---------- Links de WhatsApp con mensaje armado ---------- */
  $$('[data-wa]').forEach((a) => {
    a.href = waLink(a.dataset.wa);
    a.target = '_blank';
    a.rel = 'noopener';
  });

  /* ---------- Header y menú ---------- */
  const header = $('[data-header]');
  const burger = $('[data-burger]');
  const menu = $('#menu');
  const mbar = $('.mbar');

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 10);
    if (mbar) mbar.classList.toggle('is-visible', y > 480);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const closeMenu = () => {
    menu.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menú');
  };
  burger.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  $$('a', menu).forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Abierto / cerrado (hora de Argentina) ---------- */
  const TURNOS = [[9.5, 13], [17, 20]];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const fmt = (h) => (h % 1 ? `${Math.floor(h)}:30` : `${h}`);

  const ahoraAR = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    const hora = (Number(get('hour')) % 24) + Number(get('minute')) / 60;
    return { dia, hora };
  };

  const estado = () => {
    const { dia, hora } = ahoraAR();
    if (dia !== 0) {
      for (const [a, c] of TURNOS) {
        if (hora >= a && hora < c) return { abierto: true, texto: `Abierto ahora · cierra a las ${fmt(c)} h` };
      }
      for (const [a] of TURNOS) {
        if (hora < a) return { abierto: false, texto: `Cerrado · abre hoy a las ${fmt(a)} h` };
      }
    }
    let d = (dia + 1) % 7;
    while (d === 0) d = (d + 1) % 7;
    const cuando = d === (dia + 1) % 7 ? 'mañana' : `el ${DIAS[d]}`;
    return { abierto: false, texto: `Cerrado · abre ${cuando} a las 9:30 h` };
  };

  const status = $('[data-status]');
  const pintarEstado = () => {
    if (!status) return;
    const e = estado();
    status.classList.toggle('is-open', e.abierto);
    status.classList.toggle('is-closed', !e.abierto);
    $('[data-status-text]', status).textContent = e.texto;
  };
  pintarEstado();
  setInterval(pintarEstado, 60000);

  const filaHoy = $(`[data-horarios] tr[data-day="${ahoraAR().dia}"]`);
  if (filaHoy) filaHoy.classList.add('is-today');

  /* ---------- Estado compartido: catálogo + productos elegidos ---------- */
  let productos = [];
  let mostrarPrecios = false;
  const PICKS_KEY = 'almacen-catalogo-v1';
  let picks = new Set();
  try { picks = new Set(JSON.parse(localStorage.getItem(PICKS_KEY) || '[]')); } catch (_) { /* sin almacenamiento */ }
  const guardarPicks = () => {
    try { localStorage.setItem(PICKS_KEY, JSON.stringify([...picks])); } catch (_) { /* nada */ }
  };

  /* ---------- Armá tu lista ---------- */
  const form = $('[data-lista]');
  const ticket = $('[data-ticket]');
  const count = $('[data-count]');
  const badge = $('[data-count-badge]');
  const send = $('[data-send-list]');
  const clear = $('[data-clear]');
  const resumenCat = $('[data-cat-resumen]');
  const KEY = 'almacen-lista-v1';

  const leer = () => {
    const grupos = {};
    const sumar = (g, item) => {
      const arr = (grupos[g] = grupos[g] || []);
      if (!arr.includes(item)) arr.push(item);
    };
    $$('input[type="checkbox"]:checked', form).forEach((i) => sumar(i.name, i.value));
    productos.filter((p) => picks.has(p.id)).forEach((p) => sumar(CATS[p.categoria] || 'Otros', p.nombre));
    const v = (n) => (form.elements[n] ? form.elements[n].value.trim() : '');
    return {
      grupos,
      tematica: v('tematica'),
      invitados: v('invitados'),
      fecha: v('fecha'),
      extra: v('extra'),
      entrega: (form.querySelector('input[name="entrega"]:checked') || {}).value || '',
    };
  };

  const li = (cls, html) => { const el = document.createElement('li'); el.className = cls; el.innerHTML = html; return el; };

  const mensaje = (d) => {
    const lineas = ['¡Hola Almacén de Sonrisas! Armé mi lista desde la web:', ''];
    Object.entries(d.grupos).forEach(([g, items]) => {
      lineas.push(g.toUpperCase());
      items.forEach((it) => lineas.push(`• ${it}`));
      lineas.push('');
    });
    if (d.extra) lineas.push(`Además: ${d.extra}`, '');
    if (d.tematica) lineas.push(`Temática: ${d.tematica}`);
    if (d.invitados) lineas.push(`Invitados: ${d.invitados}`);
    if (d.fecha) lineas.push(`Para el: ${fechaLinda(d.fecha)}`);
    if (d.entrega) lineas.push(`Entrega: ${d.entrega}`);
    lineas.push('', '¿Me confirman stock y precio? ¡Gracias!');
    return lineas.join('\n');
  };

  const guardar = () => {
    try {
      const data = {};
      $$('input', form).forEach((i) => {
        if (i.type === 'checkbox') { if (i.checked) data[`${i.name}|${i.value}`] = 1; }
        else if (i.type === 'radio') { if (i.checked) data.entrega = i.value; }
        else if (i.value) data[i.name] = i.value;
      });
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (_) { /* sin almacenamiento: no pasa nada */ }
  };

  const restaurar = () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      $$('input', form).forEach((i) => {
        if (i.type === 'checkbox') i.checked = !!data[`${i.name}|${i.value}`];
        else if (i.type === 'radio') { if (data.entrega) i.checked = i.value === data.entrega; }
        else if (data[i.name]) i.value = data[i.name];
      });
    } catch (_) { /* nada */ }
  };

  const render = () => {
    if (!form) return;
    const d = leer();
    const total = Object.values(d.grupos).reduce((n, arr) => n + arr.length, 0);
    ticket.innerHTML = '';
    if (!total && !d.extra) {
      ticket.appendChild(li('ticket__empty', 'Todavía está vacía. Tildá lo que necesitás.'));
    } else {
      Object.entries(d.grupos).forEach(([g, items]) => {
        ticket.appendChild(li('cat', `<b>${esc(g)}</b>`));
        items.forEach((it) => ticket.appendChild(li('it', esc(it))));
      });
      if (d.extra) ticket.appendChild(li('it', esc(d.extra)));
      const meta = [
        d.tematica && `Temática: ${d.tematica}`,
        d.invitados && `Invitados: ${d.invitados}`,
        d.fecha && `Para el ${fechaLinda(d.fecha)}`,
        d.entrega,
      ].filter(Boolean);
      if (meta.length) {
        ticket.appendChild(li('cat', '<b>Detalles</b>'));
        meta.forEach((m) => ticket.appendChild(li('meta', esc(m))));
      }
    }
    count.textContent = total;
    if (badge) badge.textContent = total;
    if (resumenCat) {
      resumenCat.hidden = total === 0;
      $('[data-n]', resumenCat).textContent = total;
    }
    const listo = total > 0 || d.extra;
    send.setAttribute('aria-disabled', listo ? 'false' : 'true');
    send.href = listo ? waLink(mensaje(d)) : '#';
    if (listo) { send.target = '_blank'; send.rel = 'noopener'; } else { send.removeAttribute('target'); }
    guardar();
  };

  if (form) {
    restaurar();
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    form.addEventListener('submit', (e) => e.preventDefault());
    clear.addEventListener('click', () => {
      form.reset();
      picks.clear();
      guardarPicks();
      try { localStorage.removeItem(KEY); } catch (_) { /* nada */ }
      render();
      pintarCatalogo();
    });
    render();
  }

  /* ---------- Catálogo (lo carga el panel /admin en data/catalogo.json) ---------- */
  const grid = $('[data-cat-grid]');
  const nota = $('[data-cat-nota]');
  const buscador = $('[data-cat-search]');
  const masBtn = $('[data-cat-mas]');
  const filtros = $$('[data-filter]');
  const PASO = 12;
  let filtro = 'todo';
  let q = '';
  let qTexto = '';
  let limite = PASO;
  const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  // Los dibujos de cada góndola sirven de imagen cuando el producto no tiene foto.
  const ICONOS = {
    cotillon: ($('.gondola--mag .gondola__art svg') || {}).outerHTML || '',
    reposteria: ($('.gondola--nar .gondola__art svg') || {}).outerHTML || '',
    libreria: ($('.gondola--ver .gondola__art svg') || {}).outerHTML || '',
  };

  const card = (p) => {
    const cat = CATS[p.categoria] ? p.categoria : 'cotillon';
    const agotado = p.disponible === false;
    // El dibujo queda debajo de la foto: si la foto no carga (recién subida, todavía sin publicar), se ve el dibujo.
    const img = p.foto
      ? `${ICONOS[cat]}<img src="${esc(p.foto)}" alt="${esc(p.nombre)}" loading="lazy" width="400" height="400" onerror="this.remove()">`
      : ICONOS[cat];
    let etiqueta = '';
    if (agotado) etiqueta = '<span class="prod__badge prod__badge--agotado">Sin stock</span>';
    else if (ETQ[p.etiqueta]) etiqueta = `<span class="prod__badge prod__badge--${p.etiqueta}">${ETQ[p.etiqueta]}</span>`;
    const precio = mostrarPrecios && typeof p.precio === 'number' && p.precio > 0
      ? `<span class="prod__precio">${money.format(p.precio)}</span>`
      : '<span class="prod__precio prod__precio--consultar">Consultá el precio</span>';
    const on = picks.has(p.id);
    const boton = agotado
      ? '<button class="prod__add" type="button" disabled>Sin stock por ahora</button>'
      : `<button class="prod__add" type="button" data-add="${esc(p.id)}" aria-pressed="${on}">${on ? 'En tu lista ✓' : 'Sumar a mi lista'}</button>`;
    return `<article class="prod prod--${cat}${agotado ? ' is-agotado' : ''}">
      <div class="prod__img">${img}${etiqueta}</div>
      <div class="prod__body">
        <span class="prod__cat">${CATS[cat]}</span>
        <h3>${esc(p.nombre)}</h3>
        ${p.descripcion ? `<p class="prod__desc">${esc(p.descripcion)}</p>` : ''}
        <div class="prod__foot">${precio}${boton}</div>
      </div>
    </article>`;
  };

  function pintarCatalogo() {
    if (!grid || !productos.length && !grid.dataset.cargado) return;
    const lista = productos
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => filtro === 'todo' || (filtro === 'oferta' ? p.etiqueta === 'oferta' : p.categoria === filtro))
      .filter(({ p }) => !q || norm(`${p.nombre} ${p.descripcion}`).includes(q))
      .sort((a, b) => (b.p.destacado === true) - (a.p.destacado === true) || a.i - b.i)
      .map(({ p }) => p);

    if (!lista.length) {
      const consulta = q ? `¡Hola! ¿Tienen ${qTexto}?` : '¡Hola! Quería consultar qué productos tienen.';
      const texto = q
        ? 'No lo encontramos en el catálogo, pero puede que lo tengamos.'
        : 'Todavía no cargamos productos en esta sección.';
      grid.innerHTML = `<p class="cat-msg">${texto} <a href="${esc(waLink(consulta))}" target="_blank" rel="noopener">Preguntanos por WhatsApp</a></p>`;
      if (masBtn) masBtn.hidden = true;
      return;
    }
    grid.innerHTML = lista.slice(0, limite).map(card).join('');
    if (masBtn) masBtn.hidden = lista.length <= limite;
  }

  const cargarCatalogo = async () => {
    if (!grid) return;
    try {
      const r = await fetch('data/catalogo.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      productos = (Array.isArray(data.productos) ? data.productos : []).filter((p) => p && p.id && p.nombre);
      mostrarPrecios = !!data.mostrarPrecios;
      const ids = new Set(productos.map((p) => p.id));
      [...picks].forEach((id) => { if (!ids.has(id)) picks.delete(id); });
      guardarPicks();
      const fo = $('[data-filter="oferta"]');
      if (fo) fo.hidden = !productos.some((p) => p.etiqueta === 'oferta' && p.disponible !== false);
      if (nota && mostrarPrecios && data.actualizado) {
        nota.textContent = `Precios actualizados al ${fechaLinda(data.actualizado)}. Pueden cambiar: te los confirmamos por WhatsApp.`;
        nota.hidden = false;
      }
      grid.dataset.cargado = '1';
      pintarCatalogo();
      render();
    } catch (_) {
      grid.innerHTML = `<p class="cat-msg">No pudimos cargar el catálogo. <a href="${esc(waLink('¡Hola! Quería consultar qué productos tienen.'))}" target="_blank" rel="noopener">Preguntanos por WhatsApp</a></p>`;
    }
  };

  if (grid) {
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      const id = b.dataset.add;
      if (picks.has(id)) picks.delete(id); else picks.add(id);
      guardarPicks();
      const on = picks.has(id);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? 'En tu lista ✓' : 'Sumar a mi lista';
      render();
    });
    filtros.forEach((f) => f.addEventListener('click', () => {
      filtro = f.dataset.filter;
      filtros.forEach((x) => {
        const on = x === f;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', String(on));
      });
      limite = PASO;
      pintarCatalogo();
    }));
    let t;
    if (buscador) buscador.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        qTexto = buscador.value.trim();
        q = norm(qTexto);
        limite = PASO;
        pintarCatalogo();
      }, 140);
    });
    if (masBtn) masBtn.addEventListener('click', () => { limite += PASO; pintarCatalogo(); });
    cargarCatalogo();
  }

  /* ---------- Aparición al scrollear ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Año ---------- */
  const y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
