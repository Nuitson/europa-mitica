/* Las pantallas de la cuenta: entrar, crear una cuenta, recuperar la contraseña y «Mi zona» (sagas, creaciones y perfil).
   js/gate.js lo carga cuando hace falta y le pasa sus utilidades (ctx): el servidor, la pantalla de entrada y cómo abrir una saga. */
const SEASONS = ['Primavera', 'Verano', 'Otoño', 'Invierno'];

function crear(ctx) {
  const { el, api, showGate, busy, errBox, showErr, lsGet, lsSet, avatar } = ctx;

  /* ---------- piezas comunes */
  const fld = (id, label, input, hint) => el('div', { class: 'gate-fld' }, [el('label', { for: id, class: 'gate-lab', text: label }), input, hint ? el('span', { class: 'gate-hint', text: hint }) : null]);
  const campo = (id, tipo, extra) => el('input', Object.assign({ id: id, type: tipo, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' }, extra || {}));
  function claveConOjo(id, auto, label, hint) {
    const i = campo(id, 'password', { autocomplete: auto });
    const ver = el('button', { type: 'button', class: 'gate-eye', 'aria-pressed': 'false', text: 'Ver' });
    ver.addEventListener('click', () => { const on = i.type === 'password'; i.type = on ? 'text' : 'password'; ver.textContent = on ? 'Ocultar' : 'Ver'; ver.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    return { input: i, box: fld(id, label, el('div', { class: 'gate-code' }, [i, ver]), hint) };
  }
  function aviso() {
    const m = lsGet(ctx.K_MSG, true);
    lsSet(ctx.K_MSG, null, true);
    return m ? el('p', { class: 'gate-note', role: 'status', text: m }) : null;
  }
  /* un botón que manda un formulario: lo bloquea mientras espera y muestra el error si lo hay */
  function enviar(form, boton, err, texto, trabajo) {
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      showErr(err, '');
      const antes = boton.textContent;
      boton.disabled = true; boton.textContent = texto;
      try { await trabajo(); }
      catch (e) {
        boton.disabled = false; boton.textContent = antes;
        showErr(err, e.message);
        if (e.code === 'unavailable') { const o = ctx.offlineButton(e); if (o && !err.parentNode.querySelector('.glink[data-off]')) { o.setAttribute('data-off', '1'); err.insertAdjacentElement('afterend', o); } }
      }
    });
  }
  const abrir = (ses, remember, r) => { ctx.putSession({ token: r.token }, remember); ses.token = r.token; ses.perfil = r.perfil; ctx.continuar(ses); };

  /* ================================================================== entrar, crear cuenta, recuperar */
  function auth(opts) {
    opts = opts || {};
    if (opts.recuperar) return nuevaClave(opts.recuperar);
    entrar(opts.nota);
  }

  function entrar(nota) {
    const err = errBox();
    const u = campo('a-usuario', 'text', { autocomplete: 'username', autofocus: true });
    const c = claveConOjo('a-clave', 'current-password', 'Contraseña');
    const rem = el('input', { type: 'checkbox', id: 'a-rem', checked: true });
    const go = el('button', { type: 'submit', class: 'gbtn', text: 'Entrar' });
    const nueva = el('button', { type: 'button', class: 'glink', text: 'Crear una cuenta', onclick: () => registro() });
    const olvido = el('button', { type: 'button', class: 'glink', text: 'He olvidado mi contraseña', onclick: () => recuperar() });
    const n = aviso() || (nota ? el('p', { class: 'gate-note', role: 'status', text: nota }) : null);
    const form = el('form', { class: 'gate-form', novalidate: true }, [
      el('h2', { class: 'gate-h', text: 'Entrar' }), n,
      fld('a-usuario', 'Usuario o correo', u), c.box,
      el('label', { class: 'gate-chk', for: 'a-rem' }, [rem, ' Recordarme en este navegador']),
      err, el('div', { class: 'gate-act' }, [go, nueva, olvido])]);
    enviar(form, go, err, 'Comprobando…', async () => {
      if (!u.value.trim()) { u.focus(); throw new Error('Escribe tu usuario o tu correo.'); }
      if (!c.input.value) { c.input.focus(); throw new Error('Escribe tu contraseña.'); }
      abrir({}, rem.checked, await api('entrar', { usuario: u.value, password: c.input.value }));
    });
    showGate([form]);
  }

  function registro() {
    const err = errBox();
    const u = campo('r-usuario', 'text', { autocomplete: 'username', autofocus: true, maxlength: '30' });
    const nombre = campo('r-nombre', 'text', { autocomplete: 'name', maxlength: '60', autocapitalize: 'words', spellcheck: 'true' });
    const email = campo('r-email', 'email', { autocomplete: 'email', maxlength: '120' });
    const c1 = claveConOjo('r-clave', 'new-password', 'Contraseña', 'Al menos 8 caracteres.');
    const c2 = claveConOjo('r-clave2', 'new-password', 'Repite la contraseña');
    const rem = el('input', { type: 'checkbox', id: 'r-rem', checked: true });
    const go = el('button', { type: 'submit', class: 'gbtn', text: 'Crear la cuenta' });
    const back = el('button', { type: 'button', class: 'glink', text: 'Ya tengo cuenta', onclick: () => entrar() });
    const form = el('form', { class: 'gate-form', novalidate: true }, [
      el('h2', { class: 'gate-h', text: 'Crear una cuenta' }),
      fld('r-usuario', 'Usuario', u, 'Para entrar y para que el máster te añada a su saga. Letras sin tilde, números, punto, guion o guion bajo.'),
      fld('r-nombre', 'Nombre que se verá', nombre, 'Opcional: si lo dejas vacío, se usa el usuario.'),
      fld('r-email', 'Correo', email, 'Solo para recuperar la contraseña.'),
      c1.box, c2.box,
      el('label', { class: 'gate-chk', for: 'r-rem' }, [rem, ' Recordarme en este navegador']),
      err, el('div', { class: 'gate-act' }, [go, back])]);
    enviar(form, go, err, 'Creando la cuenta…', async () => {
      if (c1.input.value !== c2.input.value) { c2.input.focus(); throw new Error('Las dos contraseñas tienen que ser iguales.'); }
      abrir({}, rem.checked, await api('registrar', { usuario: u.value, nombre: nombre.value, email: email.value, password: c1.input.value }));
    });
    showGate([form]);
  }

  function recuperar() {
    const err = errBox();
    const email = campo('c-email', 'email', { autocomplete: 'email', autofocus: true });
    const go = el('button', { type: 'submit', class: 'gbtn', text: 'Enviar el enlace' });
    const back = el('button', { type: 'button', class: 'glink', text: 'Volver', onclick: () => entrar() });
    const form = el('form', { class: 'gate-form', novalidate: true }, [
      el('h2', { class: 'gate-h', text: 'Recuperar la contraseña' }),
      el('p', { class: 'gate-hint', text: 'Escribe el correo de tu cuenta y te mandamos un enlace para elegir una contraseña nueva. Vale una hora.' }),
      fld('c-email', 'Correo', email), err, el('div', { class: 'gate-act' }, [go, back])]);
    enviar(form, go, err, 'Enviando…', async () => {
      await api('recuperar', { email: email.value });
      showGate([el('div', { class: 'gate-form' }, [el('h2', { class: 'gate-h', text: 'Revisa tu correo' }),
        el('p', { class: 'gate-hint', text: 'Si hay una cuenta con ese correo, te hemos mandado un enlace. Puede tardar un par de minutos; mira también en el correo no deseado.' }),
        el('div', { class: 'gate-act' }, [el('button', { type: 'button', class: 'gbtn', text: 'Volver a entrar', onclick: () => entrar() })])])]);
    });
    showGate([form]);
  }

  /* se llega con el enlace del correo (#recuperar=…) */
  function nuevaClave(codigo) {
    const err = errBox();
    const c1 = claveConOjo('n-clave', 'new-password', 'Contraseña nueva', 'Al menos 8 caracteres.');
    const c2 = claveConOjo('n-clave2', 'new-password', 'Repite la contraseña');
    const go = el('button', { type: 'submit', class: 'gbtn', text: 'Cambiar la contraseña' });
    const back = el('button', { type: 'button', class: 'glink', text: 'Cancelar', onclick: () => { history.replaceState(null, '', location.pathname + location.search); entrar(); } });
    const form = el('form', { class: 'gate-form', novalidate: true }, [
      el('h2', { class: 'gate-h', text: 'Elige una contraseña nueva' }), c1.box, c2.box, err, el('div', { class: 'gate-act' }, [go, back])]);
    enviar(form, go, err, 'Cambiando…', async () => {
      if (c1.input.value !== c2.input.value) { c2.input.focus(); throw new Error('Las dos contraseñas tienen que ser iguales.'); }
      await api('restablecer', { codigo: codigo, password: c1.input.value });
      history.replaceState(null, '', location.pathname + location.search);
      entrar('Contraseña cambiada. Entra con la nueva.');
    });
    showGate([form]);
  }

  /* ================================================================== Mi zona */
  /* una foto cuadrada de 256 px, en WebP (o JPEG): pesa unos 15 KB, lo que el servidor admite de sobra */
  async function reducir(file, px) {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { throw new Error('No he podido leer esa imagen. Prueba con una foto JPG, PNG o WebP.'); }
    const lado = Math.min(bmp.width, bmp.height);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d').drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, px, px);
    let url = c.toDataURL('image/webp', 0.85);
    if (url.indexOf('data:image/webp') !== 0) url = c.toDataURL('image/jpeg', 0.85);
    return url;
  }

  function zona(ses) {
    let tab = 'sagas';
    let creaciones = null;                       // la lista de «Mis creaciones», cuando se ha cargado
    const panel = el('div', { class: 'zona-panel', role: 'tabpanel' });
    const cab = el('div', { class: 'zona-cab' });
    const tabs = el('div', { class: 'zona-tabs', role: 'tablist' });
    const notice = aviso();
    const estado = el('p', { class: 'gate-hint', role: 'status' });   // los avisos de «Mi perfil»: sobreviven a repintar el panel
    const dice = t => { estado.textContent = t; };
    const TABS = [['sagas', 'Mis sagas'], ['creaciones', 'Mis creaciones'], ['perfil', 'Mi perfil']];

    function pintaCab() {
      const p = ses.perfil;
      cab.innerHTML = '';
      cab.appendChild(avatar(p, 64));
      cab.appendChild(el('div', { class: 'zona-quien' }, [el('h2', { class: 'gate-h', text: p.nombre }), el('span', { class: 'gate-hint', text: '@' + p.usuario })]));
      cab.appendChild(el('button', { type: 'button', class: 'glink', text: 'Cerrar sesión', onclick: () => ctx.salir() }));
    }
    function pintaTabs() {
      tabs.innerHTML = '';
      TABS.forEach(([id, label]) => tabs.appendChild(el('button', { type: 'button', role: 'tab', class: 'zona-tab', 'aria-selected': tab === id ? 'true' : 'false', text: label, onclick: () => { tab = id; dice(''); pintaTabs(); pinta(); } })));
    }
    function pinta() {
      panel.innerHTML = '';
      if (tab === 'sagas') pSagas(); else if (tab === 'creaciones') pCreaciones(); else pPerfil();
    }

    /* ---------- mis sagas */
    function pSagas() {
      const p = ses.perfil;
      if (!p.sagas.length) panel.appendChild(el('p', { class: 'gate-hint', text: 'Todavía no estás en ninguna saga. Pide al máster que te añada con tu usuario: @' + p.usuario + '.' }));
      p.sagas.forEach(s => panel.appendChild(el('div', { class: 'saga-card' }, [
        el('div', { class: 'saga-card-t' }, [el('b', { text: s.nombre }), s.alianza ? el('small', { text: 'Alianza ' + s.alianza }) : null]),
        el('span', { class: 'chip' + (s.rol === 'master' ? ' chip-master' : ''), text: s.rol === 'master' ? 'Máster' : 'Jugador' }),
        el('button', { type: 'button', class: 'gbtn', text: 'Entrar', onclick: () => ctx.openSaga(ses, s.id) })])));
      if (p.creaSagas) panel.appendChild(el('div', { class: 'gate-act' }, [el('button', { type: 'button', class: 'glink', text: 'Crear una saga nueva', onclick: pNueva })]));
    }

    function pNueva() {
      panel.innerHTML = '';
      const err = errBox();
      const nombre = campo('s-nombre', 'text', { placeholder: 'Saga de …', autofocus: true, maxlength: '80', spellcheck: 'true' });
      const alianza = campo('s-alianza', 'text', { placeholder: 'Nombre de la alianza', maxlength: '60', spellcheck: 'true' });
      const est = el('select', { id: 's-est', 'aria-label': 'Estación' }, SEASONS.map((s, i) => el('option', { value: String(i + 1), text: s })));
      const anio = el('input', { id: 's-anio', type: 'number', min: '600', max: '1600', value: '1220', inputmode: 'numeric', 'aria-label': 'Año' });
      const aura = el('input', { id: 's-aura', type: 'number', min: '0', max: '10', value: '3', inputmode: 'numeric' });
      const go = el('button', { type: 'submit', class: 'gbtn', text: 'Crear la saga' });
      const back = el('button', { type: 'button', class: 'glink', text: 'Volver', onclick: pinta });
      const form = el('form', { class: 'gate-form gate-plain', novalidate: true }, [
        el('h3', { class: 'gate-h2', text: 'Saga nueva' }),
        el('p', { class: 'gate-hint', text: 'Serás su máster; después podrás añadir a los jugadores por su usuario.' }),
        fld('s-nombre', 'Nombre de la saga', nombre), fld('s-alianza', 'Alianza', alianza),
        el('div', { class: 'gate-row' }, [
          el('div', { class: 'gate-fld' }, [el('span', { class: 'gate-lab', text: 'Primera estación' }), el('div', { class: 'gate-pair' }, [est, anio])]),
          fld('s-aura', 'Aura de la alianza', aura)]),
        err, el('div', { class: 'gate-act' }, [go, back])]);
      enviar(form, go, err, 'Creando…', async () => {
        if (nombre.value.trim().length < 3) { nombre.focus(); throw new Error('Ponle un nombre a la saga.'); }
        const r = await api('crear', { token: ses.token, nombre: nombre.value, alianza: alianza.value, est: Number(est.value), anio: Number(anio.value), aura: Number(aura.value) });
        ses.perfil = r.perfil;
        ctx.openSaga(ses, r.saga.id);
      });
      panel.appendChild(form);
    }

    /* ---------- mis creaciones: lo que has escrito, repartido por clases, con la saga a la que pertenece */
    function pCreaciones() {
      if (!creaciones) {
        panel.appendChild(el('p', { class: 'gate-busy', role: 'status', text: 'Buscando lo que has creado…' }));
        api('contenido', { token: ses.token }).then(r => { creaciones = r.items; if (tab === 'creaciones') { panel.innerHTML = ''; pCreaciones(); } },
          e => { if (tab === 'creaciones') { panel.innerHTML = ''; panel.appendChild(el('p', { class: 'gate-err', role: 'alert', text: e.message })); } });
        return;
      }
      const sagaDe = {};
      ses.perfil.sagas.forEach(s => { sagaDe[s.id] = s.nombre; });
      let filtro = '';
      const lista = el('div', { class: 'crea' });
      const abrirItem = (it, hash) => { location.hash = hash || ''; ctx.openSaga(ses, it.saga); };
      const nombrePj = (it, id) => { const m = creaciones.find(x => x.saga === it.saga && x.ruta === 'personajes/' + id); return m && m.datos && m.datos.nombre ? m.datos.nombre : id; };
      const est = d => (d.est ? SEASONS[Number(d.est) - 1] + ' de ' + d.anio : '');
      function pintaLista() {
        lista.innerHTML = '';
        const its = creaciones.filter(it => !filtro || it.saga === filtro);
        const grupos = { personajes: [], hechizos: [], libros: [], estaciones: [], dinero: [] };
        its.forEach(it => {
          const d = it.datos || {}, id = it.ruta.split('/')[1];
          if (it.ruta.startsWith('personajes/')) {
            grupos.personajes.push({ it, titulo: d.nombre || id, detalle: [d.tipo, d.casa, d.concepto].filter(Boolean).join(' · '), hash: '#pj--' + id });
            (Array.isArray(d.hechizos) ? d.hechizos : []).forEach(x => grupos.hechizos.push({ it, titulo: x.n || 'Hechizo sin nombre',
              detalle: [[x.tec, x.forma].filter(Boolean).join(' '), x.nivel ? 'nivel ' + x.nivel : '', x.alc, x.dur, x.obj, 'de ' + (d.nombre || id)].filter(Boolean).join(' · '), hash: '#pj--' + id, orden: it.actualizado }));
          } else if (it.ruta.startsWith('avance/')) {
            const libro = /^Estudio: (summa|tractatus)/i.test(d.tipo || '');
            (libro ? grupos.libros : grupos.estaciones).push({ it, titulo: libro ? (d.nota || d.actividad || 'Libro sin título') : (d.tipo || d.actividad || 'Actividad'),
              detalle: [nombrePj(it, d.pj), est(d), libro ? d.tipo : ''].filter(Boolean).join(' · '), hash: '#pj--' + d.pj });
          } else if (it.ruta.startsWith('vis/')) {
            grupos.dinero.push({ it, titulo: 'Vis · ' + (d.tipo || 'Movimiento'), detalle: [est(d), d.nota].filter(Boolean).join(' · '), hash: '#estaciones' });
          } else if (it.ruta.startsWith('tesoreria/')) {
            grupos.dinero.push({ it, titulo: d.concepto || 'Movimiento', detalle: [est(d), d.libras != null ? d.libras + ' libras' : ''].filter(Boolean).join(' · '), hash: '#estaciones' });
          }
        });
        const SEC = [['personajes', 'Personajes'], ['hechizos', 'Hechizos'], ['libros', 'Libros estudiados'], ['estaciones', 'Actividades de estación'], ['dinero', 'Vis y tesorería']];
        let total = 0;
        SEC.forEach(([k, t]) => {
          const g = grupos[k];
          if (!g.length) return;
          total += g.length;
          lista.appendChild(el('h3', { class: 'gate-h2', text: t + ' (' + g.length + ')' }));
          g.forEach(x => lista.appendChild(el('div', { class: 'crea-row' }, [
            el('div', { class: 'crea-t' }, [el('b', { text: x.titulo }), x.detalle ? el('small', { text: x.detalle }) : null]),
            el('span', { class: 'chip', text: sagaDe[x.it.saga] || x.it.sagaNombre }),
            el('button', { type: 'button', class: 'glink', text: 'Abrir', onclick: () => abrirItem(x.it, x.hash) })])));
        });
        if (!total) lista.appendChild(el('p', { class: 'gate-hint', text: creaciones.length ? 'No hay nada de esa saga.' : 'Todavía no has creado nada. Lo que escribas en una saga (personajes, estaciones, movimientos de vis y de tesorería) aparecerá aquí, con la saga a la que pertenece.' }));
      }
      if (ses.perfil.sagas.length > 1) {
        const sel = el('select', { id: 'z-filtro', 'aria-label': 'Filtrar por saga' }, [el('option', { value: '', text: 'Todas mis sagas' })].concat(ses.perfil.sagas.map(s => el('option', { value: s.id, text: s.nombre }))));
        sel.addEventListener('change', () => { filtro = sel.value; pintaLista(); });
        panel.appendChild(el('div', { class: 'gate-act' }, [sel, el('button', { type: 'button', class: 'glink', text: 'Actualizar', onclick: () => { creaciones = null; pinta(); } })]));
      } else panel.appendChild(el('div', { class: 'gate-act' }, [el('button', { type: 'button', class: 'glink', text: 'Actualizar', onclick: () => { creaciones = null; pinta(); } })]));
      panel.appendChild(lista);
      pintaLista();
    }

    /* ---------- mi perfil: imagen, nombre y correo, contraseña y sesiones */
    function pPerfil() {
      const p = ses.perfil;
      const guardar = async (datos, msg) => {
        try { ses.perfil = (await api('actualizarPerfil', Object.assign({ token: ses.token }, datos))).perfil; pintaCab(); dice(msg); pinta(); return true; }
        catch (e) { dice(e.message); return false; }
      };
      // imagen
      const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', id: 'z-img', hidden: true });
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0];
        file.value = '';
        if (!f) return;
        try { await guardar({ avatar: await reducir(f, 256) }, 'Imagen cambiada.'); } catch (e) { dice(e.message); }
      });
      const imagen = el('div', { class: 'zona-img' }, [avatar(p, 96), el('div', { class: 'gate-act' }, [
        el('button', { type: 'button', class: 'gbtn', text: p.avatar ? 'Cambiar la imagen' : 'Poner una imagen', onclick: () => file.click() }), file,
        p.avatar ? el('button', { type: 'button', class: 'glink', text: 'Quitar', onclick: () => guardar({ avatar: '' }, 'Imagen quitada.') }) : null])]);
      // nombre y correo
      const nombre = campo('p-nombre', 'text', { value: p.nombre, maxlength: '60', autocomplete: 'name', spellcheck: 'true' });
      const email = campo('p-email', 'email', { value: p.email, maxlength: '120', autocomplete: 'email' });
      const datos = el('form', { class: 'gate-form gate-plain', novalidate: true }, [
        el('h3', { class: 'gate-h2', text: 'Mis datos' }), fld('p-nombre', 'Nombre que se verá', nombre), fld('p-email', 'Correo', email, 'Para recuperar la contraseña.'),
        el('div', { class: 'gate-act' }, [el('button', { type: 'submit', class: 'gbtn', text: 'Guardar' })])]);
      datos.addEventListener('submit', ev => { ev.preventDefault(); guardar({ nombre: nombre.value, email: email.value }, 'Datos guardados.'); });
      // contraseña
      const errC = errBox();
      const c0 = claveConOjo('p-actual', 'current-password', 'Contraseña actual');
      const c1 = claveConOjo('p-nueva', 'new-password', 'Contraseña nueva', 'Al menos 8 caracteres.');
      const c2 = claveConOjo('p-nueva2', 'new-password', 'Repite la contraseña nueva');
      const goC = el('button', { type: 'submit', class: 'gbtn', text: 'Cambiar la contraseña' });
      const clave = el('form', { class: 'gate-form gate-plain', novalidate: true }, [el('h3', { class: 'gate-h2', text: 'Contraseña' }), c0.box, c1.box, c2.box, errC, el('div', { class: 'gate-act' }, [goC])]);
      enviar(clave, goC, errC, 'Cambiando…', async () => {
        if (c1.input.value !== c2.input.value) { c2.input.focus(); throw new Error('Las dos contraseñas nuevas tienen que ser iguales.'); }
        const r = await api('cambiarPassword', { token: ses.token, actual: c0.input.value, nueva: c1.input.value });
        ctx.putSession({ token: r.token }, !!lsGet('em:sesion'));
        ses.token = r.token;
        clave.reset(); goC.disabled = false; goC.textContent = 'Cambiar la contraseña';
        dice('Contraseña cambiada. En los demás dispositivos tendrás que entrar de nuevo.');
      });
      // sesiones
      const cerrar = el('button', { type: 'button', class: 'glink', text: 'Cerrar sesión en todos los dispositivos', onclick: async () => {
        try { const r = await api('cerrarSesiones', { token: ses.token }); ctx.putSession({ token: r.token }, !!lsGet('em:sesion')); ses.token = r.token; dice('Se ha cerrado la sesión en los demás dispositivos.'); }
        catch (e) { dice(e.message); }
      } });
      [imagen, datos, clave].forEach(f => panel.appendChild(f));
      panel.appendChild(el('div', { class: 'gate-act' }, [cerrar]));
      panel.appendChild(estado);
    }

    pintaCab(); pintaTabs(); pinta();
    showGate([notice, cab, tabs, panel]);
    const card = document.querySelector('#gate .gate-card');
    if (card) card.classList.add('zona');
  }

  return { auth: auth, zona: zona };
}

export { crear };
