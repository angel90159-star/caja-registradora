// content-scripts/watcher.js
//
// Se inyecta en TODO el portal de Yastás (es una SPA de Angular: navega sin
// recargar la página, así que un content_script "por ruta" no serviría).
// Fase 1 (login) es reactiva vía MutationObserver. Fase 2 (reporte/descarga)
// es un asistente secuencial de varios pasos, disparado una sola vez cuando
// detectamos que ya se hizo login y hay un trabajo pendiente.
//
// Ritmo: cada paso va separado por una pausa aleatoria "humana" y espera a
// que el elemento sea VISIBLE (no solo que exista en el DOM), porque Angular
// Material anima menús y calendarios y un clic demasiado rápido se pierde.
//
// Credenciales: nunca van en este archivo. Vienen de config.local.js (en
// .gitignore), del popup (chrome.storage.local) o del autofill del navegador.

(function () {
  const HOME_URL = 'https://portales-ext.prd.cloud.yastas.com/portal-autoservicio/home';
  const MAX_INTENTOS_FASE2 = 2;
  // Un job en cualquiera de estos estados ya no se toca (evita el bucle
  // login -> exportar -> logout -> login -> ...).
  const ESTADOS_FINALES = ['terminado', 'descarga-completa', 'abortado'];

  let ultimaFase = null;
  let descargaEnCurso = false; // candado de la Fase 2
  let loginIntentado = false;  // evita rellenar/clic en ENTRAR más de una vez
  let intentosFase2 = 0;
  let blobCapturadoResolve = null;

  window.addEventListener('message', (ev) => {
    if (ev.data?.origen === 'YASTAS_INTERCEPTOR' && ev.data?.tipo === 'BLOB_CAPTURADO') {
      reportar('excel-capturado', `${ev.data.metodo} (${ev.data.tamano} bytes)`);
      chrome.runtime.sendMessage({
        tipo: 'YASTAS_XLSX_CAPTURADO',
        base64: ev.data.base64,
        metodo: ev.data.metodo,
        tamano: ev.data.tamano,
      });
      if (blobCapturadoResolve) {
        blobCapturadoResolve(ev.data);
        blobCapturadoResolve = null;
      }
    }
  });

  function reportar(paso, detalle) {
    console.log('[Yastás extensión]', paso, detalle ?? '');
    chrome.runtime.sendMessage({ tipo: 'YASTAS_PROGRESO', paso, detalle });
  }

  function terminar(detalle) {
    chrome.runtime.sendMessage({ tipo: 'YASTAS_TERMINADO', detalle });
  }

  // --- Ritmo humano ---
  function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pausaHumana(minMs = 700, maxMs = 1400) {
    return esperar(minMs + Math.random() * (maxMs - minMs));
  }

  function esVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }

  async function esperarSelector(buscar, { timeoutMs = 8000, intervaloMs = 250 } = {}) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      const el = buscar();
      if (el) return el;
      await esperar(intervaloMs);
    }
    throw new Error('Timeout esperando elemento: ' + buscar.toString().slice(0, 90));
  }

  // Igual que esperarSelector, pero exige que el elemento se vea en pantalla.
  function esperarVisible(buscar, opts) {
    return esperarSelector(() => {
      const el = buscar();
      return esVisible(el) ? el : null;
    }, opts);
  }

  function botonPorTexto(texto, root = document) {
    return Array.from(root.querySelectorAll('button'))
      .find((b) => b.textContent.trim().toUpperCase() === texto.toUpperCase());
  }

  // Angular Material no "ve" un `input.value = x` directo: hay que usar el
  // setter nativo y disparar los eventos que escucha el formulario.
  function setValorAngular(input, valor) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // --- Credenciales, en orden de prioridad ---
  //   1. config.local.js (archivo local, en .gitignore) si tiene valores reales.
  //   2. Las guardadas desde el popup (chrome.storage.local).
  //   3. Ninguna -> se confía en el autofill del navegador.
  function credencialesDeArchivo() {
    const c = globalThis.YASTAS_CREDENCIALES;
    if (!c || !c.usuario || !c.password) return null;
    if (c.usuario.startsWith('AQUI_') || c.password.startsWith('AQUI_')) return null;
    return c;
  }

  async function marcarJob(cambios) {
    const { pendingJob } = await chrome.storage.local.get('pendingJob');
    if (!pendingJob) return;
    await chrome.storage.local.set({ pendingJob: { ...pendingJob, ...cambios } });
  }

  // --- Formateo de fecha en español, para calzar con el aria-label de Material ---
  const MESES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  function formatearFechaLarga(fecha) {
    // ej. "12 de septiembre de 2026" — mismo patrón que vimos en la grabación
    return `${fecha.getDate()} de ${MESES_ES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
  }

  function parsearMesAnioDePeriodo(texto) {
    // El botón de periodo de Material muestra algo como "septiembre 2026".
    const limpio = texto.trim().toLowerCase();
    const mes = MESES_ES.findIndex((m) => limpio.includes(m));
    const anioMatch = limpio.match(/\d{4}/);
    return { mes, anio: anioMatch ? parseInt(anioMatch[0], 10) : null };
  }

  // --- Datepicker de Angular Material (se usa dos veces: inicial / final) ---
  async function fijarFechaCalendario(etiquetaContenedor, fechaISO) {
    const contenedor = Array.from(document.querySelectorAll('app-daily-calendar'))
      .find((el) => el.textContent.includes(etiquetaContenedor));
    if (!contenedor) throw new Error(`No se encontró el calendario "${etiquetaContenedor}"`);

    const botonAbrir = await esperarVisible(() => contenedor.querySelector('[aria-label="Open calendar"]'));
    botonAbrir.click();

    // El popup de Material se monta en el overlay global (fuera de
    // app-daily-calendar), por eso se busca en `document`.
    await esperarVisible(() => document.querySelector('.mat-datepicker-content'));
    await pausaHumana(600, 1000); // animación de apertura del calendario

    const fecha = new Date(fechaISO + 'T00:00:00');
    const etiquetaObjetivo = formatearFechaLarga(fecha);
    const mesObjetivo = { mes: fecha.getMonth(), anio: fecha.getFullYear() };

    for (let intentos = 0; intentos < 24; intentos++) {
      // 1) Leer en qué mes/año está el calendario (cabecera, ej. "12-SEPTIEMBRE-2026").
      const textoPeriodo = document.querySelector('.mat-calendar-period-button')?.textContent || '';
      const mesActual = parsearMesAnioDePeriodo(textoPeriodo);
      if (mesActual.mes === -1 || mesActual.anio === null) {
        throw new Error(`No se pudo leer el mes/año del calendario desde "${textoPeriodo}"`);
      }

      const enMesCorrecto = mesActual.mes === mesObjetivo.mes && mesActual.anio === mesObjetivo.anio;

      // 2) Si ya estamos en el mes correcto: buscar el día y hacer clic. NUNCA
      //    navegar de mes aquí (eso era lo que producía el ir y venir).
      if (enMesCorrecto) {
        const botonDia = buscarBotonDia(fecha);
        if (!botonDia) {
          const muestra = Array.from(document.querySelectorAll('.mat-calendar-body [aria-label]'))
            .slice(0, 3).map((c) => c.getAttribute('aria-label'));
          throw new Error(
            `Calendario en "${textoPeriodo}" pero no se encontró el día ${fecha.getDate()}. ` +
            `Ejemplos de aria-label en las celdas: ${JSON.stringify(muestra)}`
          );
        }
        if (celdaDeshabilitada(botonDia)) {
          throw new Error(`El día ${etiquetaObjetivo} está deshabilitado en el portal (¿fecha futura o sin datos?)`);
        }
        await pausaHumana(400, 800);
        botonDia.click();
        await pausaHumana(500, 900); // cierre del calendario
        return;
      }

      // 3) Mes distinto: navegar un mes en la dirección correcta.
      const haciaAdelante =
        mesObjetivo.anio > mesActual.anio ||
        (mesObjetivo.anio === mesActual.anio && mesObjetivo.mes > mesActual.mes);

      const botonNav = document.querySelector(
        haciaAdelante ? '.mat-calendar-next-button' : '.mat-calendar-previous-button'
      );
      if (!botonNav) throw new Error('No se encontró el botón de navegación de mes');
      botonNav.click();
      await pausaHumana(500, 900); // deja que Angular re-renderice el mes
    }
    throw new Error(`No se pudo llegar al mes de ${etiquetaObjetivo} tras 24 intentos`);
  }

  // Doble lectura del día dentro del mes visible:
  //   a) por aria-label ("12 de septiembre de 2026"), tolerando prefijos como
  //      el día de la semana y sin depender del año;
  //   b) de respaldo, por el número visible en la celda.
  // Angular Material 15+: <button class="mat-calendar-body-cell" aria-label="…">
  //                         <span class="mat-calendar-body-cell-content">12</span>
  // Material <15:         <td class="mat-calendar-body-cell" aria-label="…">…</td>
  function buscarBotonDia(fecha) {
    const dia = fecha.getDate();
    const mes = MESES_ES[fecha.getMonth()];
    const re = new RegExp(`(^|[^\\d])${dia} de ${mes}\\b`, 'i');

    const porAria = Array.from(document.querySelectorAll('.mat-calendar-body [aria-label]'))
      .find((c) => re.test(c.getAttribute('aria-label') || ''));
    if (porAria) return porAria;

    return Array.from(document.querySelectorAll('.mat-calendar-body-cell'))
      .find((c) => c.querySelector('.mat-calendar-body-cell-content')?.textContent.trim() === String(dia));
  }

  function celdaDeshabilitada(celda) {
    return Boolean(
      celda.disabled ||
      celda.getAttribute('aria-disabled') === 'true' ||
      celda.classList.contains('mat-calendar-body-disabled')
    );
  }

  // Quita acentos y mayúsculas para comparar textos de botones sin sustos
  // ("CERRAR SESIÓN" vs "Cerrar Sesion", "Sí" vs "SI").
  function normalizar(texto) {
    return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  }

  // El ícono de usuario (círculo con silueta) vive en la esquina superior
  // derecha del encabezado, junto al "¡Hola!". Se busca por POSICIÓN en vez
  // de por índice de imagen (`img nth(2)` en la grabación) porque el índice
  // se rompe en cuanto el portal agrega o quita cualquier imagen.
  function buscarAvatar() {
    const candidatos = Array.from(document.querySelectorAll('img, mat-icon, button'))
      .filter((el) => {
        if (!esVisible(el)) return false;
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < 120 && r.left > window.innerWidth * 0.75 && r.width < 120;
      })
      .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left); // el más a la derecha primero

    return candidatos.find((el) => el.tagName === 'IMG') || candidatos[0] || document.querySelectorAll('img')[2] || null;
  }

  // --- Cierre de sesión, en capas (flujo confirmado con capturas) ---
  //   1. Si el botón "CERRAR SESIÓN" ya está visible, clic directo.
  //   2. Si no, clic en el avatar (arriba a la derecha) -> se abre el panel
  //      lateral con los datos del usuario y "CERRAR SESIÓN" al fondo.
  //   3. Último recurso: clic al botón aunque esté oculto (Angular ejecuta
  //      el (click) igual).
  //   Luego el diálogo "Cerrar sesión" -> botón "SÍ".
  async function cerrarSesion() {
    const buscarLogout = () => Array.from(document.querySelectorAll('button'))
      .find((b) => normalizar(b.textContent).includes('CERRAR SESION'));

    let botonLogout = buscarLogout();

    if (!botonLogout || !esVisible(botonLogout)) {
      const avatar = buscarAvatar();
      if (avatar) {
        avatar.click();
        reportar('menu-usuario-abierto', avatar.tagName.toLowerCase());
        await pausaHumana(1000, 1600); // animación del panel lateral
        botonLogout = await esperarVisible(buscarLogout, { timeoutMs: 5000 }).catch(() => buscarLogout());
      } else {
        reportar('aviso', 'No se encontró el ícono de usuario arriba a la derecha');
      }
    }

    if (!botonLogout) {
      reportar('aviso', 'No se encontró el botón CERRAR SESIÓN; la sesión queda abierta');
      return;
    }

    if (!esVisible(botonLogout)) {
      reportar('aviso', 'CERRAR SESIÓN sigue oculto; se intenta el clic de todos modos');
    }
    botonLogout.click();
    reportar('logout-click');
    await pausaHumana(800, 1300);

    // Diálogo "Cerrar sesión — ¿Estás seguro…?" con botones SÍ / NO.
    const botonSi = await esperarVisible(() =>
      Array.from(document.querySelectorAll('button')).find((b) => normalizar(b.textContent) === 'SI'),
      { timeoutMs: 6000 }
    ).catch(() => null);

    if (botonSi) {
      await pausaHumana(600, 1000); // "leer" el diálogo antes de confirmar
      botonSi.click();
      reportar('sesion-cerrada');
    } else {
      reportar('aviso', 'No apareció la confirmación "Sí" del cierre de sesión');
    }
  }

  // --- Fase 2 completa: home -> Consultas -> Reporte -> fechas -> exportar ---
  async function ejecutarDescarga(job) {
    if (descargaEnCurso) return;
    descargaEnCurso = true;
    intentosFase2++;

    try {
      reportar('fase2-inicio', `${job.fecha} (intento ${intentosFase2}/${MAX_INTENTOS_FASE2})`);
      await pausaHumana(4000, 5000); // respiro tras el login: el home tarda en armarse

      if (!location.pathname.includes('/portal-autoservicio/home')) {
        if (job.redirigidoHome) {
          // Ya redirigimos una vez y el portal nos mandó a otro lado: no
          // insistir (sería otro bucle), continuar desde donde estemos.
          reportar('aviso', `no estamos en /home (${location.pathname}) pero ya se redirigió; continuando aquí`);
        } else {
          await marcarJob({ redirigidoHome: true });
          reportar('redirigiendo-home', location.pathname);
          location.href = HOME_URL;
          return; // el content script se reinyecta al cargar /home y retoma
        }
      }

      const hamburguesa = await esperarVisible(() => document.querySelector('.hamburger > div:nth-child(2)'));
      await pausaHumana();
      hamburguesa.click();
      reportar('menu-abierto');
      await pausaHumana(800, 1300); // animación del menú lateral

      const botonConsultas = await esperarVisible(() => botonPorTexto('Consultas'));
      botonConsultas.click();
      await pausaHumana(800, 1300); // despliegue del submenú

      const itemReporte = await esperarVisible(() =>
        Array.from(document.querySelectorAll('[role="menuitem"]'))
          .find((el) => el.textContent.trim() === 'Reporte de Movimientos')
      );
      itemReporte.click();
      reportar('reporte-movimientos-abierto');
      await pausaHumana(1500, 2500); // carga de la pantalla del reporte

      await esperarVisible(() => document.querySelector('app-daily-calendar'));

      // Reporte de un solo día: fecha inicial = fecha final = job.fecha
      await fijarFechaCalendario('Fecha inicial:', job.fecha);
      await pausaHumana();
      await fijarFechaCalendario('Fecha final:', job.fecha);
      reportar('fechas-fijadas', job.fecha);
      await pausaHumana();

      const botonConsultar = await esperarVisible(() => botonPorTexto('CONSULTAR'));
      botonConsultar.click();
      reportar('consulta-disparada');
      await pausaHumana(2000, 3500); // la tabla tarda en cargar

      // EXPORTAR debe estar visible Y habilitado (se habilita cuando hay resultados).
      const botonExportar = await esperarVisible(() => {
        const b = botonPorTexto('EXPORTAR');
        return b && !b.disabled ? b : null;
      }, { timeoutMs: 20000 });
      await pausaHumana();
      botonExportar.click();
      reportar('exportar-click');

      // Dar oportunidad a que el interceptor capture el blob en memoria
      await Promise.race([
        new Promise((res) => { blobCapturadoResolve = res; }),
        esperar(6000),
      ]);

      // Marcar el job como terminado ANTES del logout: si no, al volver al
      // login el watcher lo vería pendiente y repetiría todo en bucle.
      await marcarJob({ estado: 'terminado' });
      terminar({ fecha: job.fecha, paso: 'exportar-disparado' });
      await pausaHumana(2500, 4000); // deja que arranque la descarga / borrado

      // Cierre de sesión — igual que en la grabación. Si prefieres que la
      // sesión quede viva para la siguiente corrida, comenta esta línea.
      await cerrarSesion();
    } catch (err) {
      reportar('error', String(err));
      if (intentosFase2 < MAX_INTENTOS_FASE2) {
        reportar('reintento', `esperando 5 s antes del intento ${intentosFase2 + 1}`);
        await esperar(5000);
        descargaEnCurso = false; // permite UN reintento más desde tick()
      } else {
        await marcarJob({ estado: 'abortado', error: String(err) });
        reportar('abortado', 'máximo de intentos alcanzado; vuelve a lanzarlo desde el popup');
        // descargaEnCurso se queda en true: no hay más ciclos.
      }
    }
  }

  // --- Loop principal: detecta login pendiente y dispara Fase 2 ---
  async function tick() {
    const { pendingJob, credenciales: credPopup } = await chrome.storage.local.get(['pendingJob', 'credenciales']);
    if (!pendingJob || ESTADOS_FINALES.includes(pendingJob.estado)) return;
    const credenciales = credencialesDeArchivo() || credPopup;

    const inputUsuario = document.querySelector('#mat-input-0');
    const inputPassword = document.querySelector('#mat-input-1');
    const botonEntrar = botonPorTexto('ENTRAR');

    // --- FASE 1: pantalla de login ---
    if (inputUsuario && inputPassword && botonEntrar) {
      if (ultimaFase !== 'login') {
        ultimaFase = 'login';
        reportar('login-detectado');
      }
      if (loginIntentado) return; // ya rellenamos/clicamos; esperar a que el portal responda

      // Opción A: hay credenciales guardadas y los campos están vacíos.
      if (!inputUsuario.value && !inputPassword.value && credenciales?.usuario && credenciales?.password) {
        loginIntentado = true;
        await pausaHumana(800, 1500);
        setValorAngular(inputUsuario, credenciales.usuario);
        await pausaHumana(600, 1200); // como si pasaras al siguiente campo
        setValorAngular(inputPassword, credenciales.password);
        reportar('login-credenciales-rellenadas');
        await pausaHumana(800, 1400); // deja que Angular valide y habilite el botón
        const boton = botonPorTexto('ENTRAR');
        if (boton && !boton.disabled) {
          boton.click();
          reportar('login-click-entrar');
        } else {
          reportar('error', 'ENTRAR sigue deshabilitado tras rellenar credenciales');
          loginIntentado = false;
        }
        return;
      }

      // Opción B: el autofill nativo del navegador ya llenó los campos.
      if (inputUsuario.value && inputPassword.value && !botonEntrar.disabled) {
        loginIntentado = true;
        reportar('login-autofill-detectado');
        await pausaHumana(800, 1400);
        botonEntrar.click();
      }
      return;
    }

    // Ya no estamos en login (o nunca estuvimos, sesión seguía viva) -> Fase 2
    if (ultimaFase !== 'reporte') {
      ultimaFase = 'reporte';
      reportar('post-login-detectado');
    }
    ejecutarDescarga(pendingJob);
  }

  // Angular dispara cientos de mutaciones por segundo; agrupamos en un tick
  // cada 400 ms para no saturar ni disparar pasos encimados.
  let tickProgramado = null;
  const observer = new MutationObserver(() => {
    if (tickProgramado) return;
    tickProgramado = setTimeout(() => {
      tickProgramado = null;
      tick();
    }, 400);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  tick(); // primer chequeo inmediato, sin esperar a que algo cambie
})();
