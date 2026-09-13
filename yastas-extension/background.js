// background.js — Service worker de la extensión (Manifest V3)
//
// Recibe la orden "descarga la fecha X" desde el dashboard de Caja
// Registradora (vía externally_connectable, ver manifest.json) y abre/enfoca
// una pestaña REAL del navegador para que el content script (watcher.js)
// ejecute ahí la secuencia guardada. Nunca hace la petición él mismo: quien
// habla con Yastás siempre es una pestaña de tu Chrome, con tu sesión y tu IP.

const YASTAS_LOGIN_URL = 'https://portales-ext.prd.cloud.yastas.com/portal-autoservicio/login';

// --- 1. Manejador de "descargar fecha X" ---
// Llega por DOS canales distintos, y hay que atenderlos igual:
//   - onMessage (interno): desde el popup de la propia extensión (prueba manual).
//   - onMessageExternal: desde tu página en Vercel (externally_connectable).
function manejarSolicitudDescarga(mensaje, sender, sendResponse) {
  const fecha = mensaje.fecha; // ej. '2026-09-12'
  const jobId = mensaje.jobId || crypto.randomUUID();

  guardarTrabajoPendiente({
    jobId,
    fecha,
    estado: 'iniciado',
    origen: sender.origin || 'popup-interno',
    ts: Date.now(),
  })
    .then(() => {
      console.log('[Yastás extensión] job guardado, abriendo pestaña…', { jobId, fecha });
      return abrirOEnfocarPestanaYastas();
    })
    .then((tab) => {
      console.log('[Yastás extensión] pestaña lista, tabId:', tab.id, 'ventana:', tab.windowId);
      sendResponse({ ok: true, jobId, tabId: tab.id });
    })
    .catch((err) => {
      console.error('[Yastás extensión] ERROR al abrir la pestaña:', err);
      sendResponse({ ok: false, error: String(err) });
    });

  return true; // mantiene el canal abierto: la respuesta llega después (async)
}

chrome.runtime.onMessageExternal.addListener((mensaje, sender, sendResponse) => {
  if (!mensaje || mensaje.tipo !== 'YASTAS_DESCARGAR') {
    sendResponse({ ok: false, error: 'Mensaje no reconocido' });
    return;
  }
  return manejarSolicitudDescarga(mensaje, sender, sendResponse);
});

async function guardarTrabajoPendiente(job) {
  await chrome.storage.local.set({ pendingJob: job });
}

async function abrirOEnfocarPestanaYastas() {
  const [existente] = await chrome.tabs.query({ url: 'https://portales-ext.prd.cloud.yastas.com/*' });
  if (existente) {
    // Si ya había una pestaña abierta, la reusamos y la mandamos al login
    // (si la sesión sigue viva, el propio portal redirige al home).
    await chrome.tabs.update(existente.id, { active: true, url: YASTAS_LOGIN_URL });
    return existente;
  }
  // `active: true` para que la veas trabajar. Cuando ya confíes en el
  // proceso, cambia esto a `active: false` para que corra de fondo.
  return chrome.tabs.create({ url: YASTAS_LOGIN_URL, active: true });
}

// --- 2. Mensajes internos: del popup (prueba manual) y de watcher.js (progreso) ---
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  if (mensaje?.tipo === 'YASTAS_DESCARGAR') {
    return manejarSolicitudDescarga(mensaje, sender, sendResponse);
  }

  if (mensaje?.tipo === 'YASTAS_PROGRESO') {
    console.log('[Yastás extensión]', mensaje.paso, mensaje.detalle || '');
    // TODO: además de loguear aquí, hacer POST a Supabase (tabla job_logs)
    // para que el dashboard en Vercel vea el progreso en vivo vía Realtime.
    // Ejemplo (rellenar con tu URL/anon key, la misma que ya usa app.js):
    //
    // fetch(`${SUPABASE_URL}/rest/v1/job_logs`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     apikey: SUPABASE_ANON_KEY,
    //     Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    //   },
    //   body: JSON.stringify({ paso: mensaje.paso, detalle: mensaje.detalle }),
    // });
  }

  if (mensaje?.tipo === 'YASTAS_TERMINADO') {
    console.log('[Yastás extensión] terminado', mensaje.detalle);
    // No borramos pendingJob todavía: esperamos a que chrome.downloads
    // confirme que el archivo realmente terminó de bajar (ver abajo).
  }
});

// --- 3. Captura del archivo descargado al hacer clic en "EXPORTAR" ---
// El content script NO puede usar page.waitForEvent('download') (eso es API
// de Playwright, controla el navegador desde afuera). Dentro de una
// extensión, la forma real de enterarte de una descarga es la API
// chrome.downloads.
chrome.downloads.onCreated.addListener((item) => {
  if (!item.url.includes('portales-ext.prd.cloud.yastas.com')) return;
  console.log('[Yastás extensión] descarga iniciada:', item.filename || item.url);
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (delta.state?.current !== 'complete') return;

  const [item] = await chrome.downloads.search({ id: delta.id });
  if (!item || !item.url.includes('portales-ext.prd.cloud.yastas.com')) return;

  console.log('[Yastás extensión] descarga completa:', item.filename);

  const { pendingJob } = await chrome.storage.local.get('pendingJob');
  if (pendingJob) {
    await chrome.storage.local.set({
      pendingJob: { ...pendingJob, estado: 'descarga-completa', archivo: item.filename },
    });
  }

  // TODO (siguiente fase):
  //   1. Leer el contenido del archivo — chrome.downloads solo da metadata
  //      (ruta/nombre), no el contenido. Para leerlo hace falta o bien pedirle
  //      al usuario que lo seleccione una vez vía <input type="file"> /
  //      File System Access API, o mejor: en vez de depender del archivo ya
  //      en disco, interceptar la respuesta de red del clic en "EXPORTAR"
  //      directamente desde watcher.js (fetch/XHR) y mandar ese blob aquí
  //      por mensaje, sin pasar por el disco.
  //   2. Parsear el CSV/XLSX resultante.
  //   3. Subirlo a Supabase (tabla `yastas_movimientos_portal`) para la
  //      conciliación contra la bitácora local.
  //   4. Marcar el job como completado (pendingJob: null) solo hasta aquí.
});
