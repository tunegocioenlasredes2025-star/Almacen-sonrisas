/* El Almacén de Sonrisas — interacciones */
(() => {
  'use strict';

  const WA = '5491156669809';
  const waLink = (msg) => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

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
    const abreHoy = dia !== 0;
    if (abreHoy) {
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
    return { abierto: false, texto: `Cerrado · abre ${cuando} a las 9:30 h`, dia };
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

  const hoy = ahoraAR().dia;
  const filaHoy = $(`[data-horarios] tr[data-day="${hoy}"]`);
  if (filaHoy) filaHoy.classList.add('is-today');

  /* ---------- Armá tu lista ---------- */
  const form = $('[data-lista]');
  const ticket = $('[data-ticket]');
  const count = $('[data-count]');
  const badge = $('[data-count-badge]');
  const send = $('[data-send-list]');
  const clear = $('[data-clear]');
  const KEY = 'almacen-lista-v1';

  const leer = () => {
    const grupos = {};
    $$('input[type="checkbox"]:checked', form).forEach((i) => {
      (grupos[i.name] = grupos[i.name] || []).push(i.value);
    });
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

  const fechaLinda = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const li = (cls, html) => { const el = document.createElement('li'); el.className = cls; el.innerHTML = html; return el; };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const render = () => {
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
    const listo = total > 0 || d.extra;
    send.setAttribute('aria-disabled', listo ? 'false' : 'true');
    send.href = listo ? waLink(mensaje(d)) : '#';
    if (listo) { send.target = '_blank'; send.rel = 'noopener'; } else { send.removeAttribute('target'); }
    guardar();
  };

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

  if (form) {
    restaurar();
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    form.addEventListener('submit', (e) => e.preventDefault());
    clear.addEventListener('click', () => {
      form.reset();
      try { localStorage.removeItem(KEY); } catch (_) { /* nada */ }
      render();
    });
    render();
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
