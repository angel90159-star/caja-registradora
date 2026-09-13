// background.js — Service worker de la extensión (Manifest V3)
//
// 1. Recibe la orden "descarga la fecha X" desde la app o popup.
// 2. Abre/enfoca la pestaña del portal de Yastás y coordina la secuencia.
// 3. Captura el Excel (.xlsx) en memoria a través del interceptor.
// 4. Parsea las filas y las sube directamente a Supabase (yastas_movimientos_portal y yastas_import_jobs).
// 5. BORRA INMEDIATAMENTE el archivo .xlsx de la carpeta de Descargas (chrome.downloads.removeFile)
//    y limpia el historial del navegador (chrome.downloads.erase).

importScripts('lib/xlsx.full.min.js');

const YASTAS_LOGIN_URL = 'https://portales-ext.prd.cloud.yastas.com/portal-autoservicio/login';
const SUPABASE_URL = 'https://kpddjyytabxuxdjqsjze.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XEdoOM-_8_fP9fwNOSfmUg_0VZjbbBO';

// --- Funciones de parseo de celdas idénticas al motor de Encuadre ---
function encCeldaFecha(v) {
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && globalThis.XLSX) {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return String(v || '').trim().slice(0, 10);
}

function encCeldaHora(v) {
  if (v instanceof Date) {
    return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}:${String(v.getSeconds()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    const s = Math.round((v % 1) * 86400);
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  return String(v || '00:00:00').trim().slice(0, 8);
}

function encNum(v) {
  const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// --- Parseo y subida de datos a Supabase ---
async function procesarYSubirXlsx(base64, job) {
  try {
    console.log('[Yastás extensión] Procesando archivo Excel capturado en memoria…');
    const binario = atob(base64);
    const len = binario.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binario.charCodeAt(i);
    }

    const wb = XLSX.read(bytes, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

    const idxHdr = filas.findIndex((r) => r && r.some((x) => String(x).trim() === 'ID Operación'));
    if (idxHdr < 0) {
      throw new Error('El archivo no contiene el encabezado "ID Operación"');
    }

    const hdr = filas[idxHdr].map((x) => String(x ?? '').trim());
    const col = (nombre) => hdr.indexOf(nombre);
    const iFecha = col('Fecha'),
      iHora = col('Hora'),
      iTipoC = col('Tipo Cuenta'),
      iTipoM = col('Tipo Movimiento'),
      iDesc = col('Descripción'),
      iOp = col('Operación'),
      iId = col('ID Operación'),
      iTot = col('Monto Total'),
      iOpM = col('Monto Operación'),
      iServ = col('Servicio'),
      iSt = col('Status'),
      iComUF = col('Comisión UF'),
      iIva = col('Iva Comisión'),
      iGan = col('Ganancia'),
      iEm = col('Nombre Emisor');

    const rows = [];
    for (let r = idxHdr + 1; r < filas.length; r++) {
      const f = filas[r];
      if (!f || !f[iId]) continue;
      const tipoMov = String(f[iTipoM] ?? '').trim();
      rows.push({
        fecha: encCeldaFecha(f[iFecha]),
        hora: encCeldaHora(f[iHora]),
        id_operacion: String(f[iId]).trim(),
        tipo_movimiento: tipoMov,
        descripcion: String(f[iDesc] ?? '').trim(),
        operacion: String(f[iOp] ?? '').trim(),
        monto_total: encNum(f[iTot]),
        monto_operacion: encNum(f[iOpM]),
        comision: +(encNum(f[iComUF]) + encNum(f[iIva])).toFixed(2),
        ganancia: encNum(f[iGan]),
        servicio: String(f[iServ] ?? '').trim(),
        status: String(f[iSt] ?? '').trim(),
        emisor: String(f[iEm] ?? '').trim(),
        tipo_cuenta: String(f[iTipoC] ?? '').trim(),
        es_interno: !(tipoMov === 'OPERACIONES FINANCIERAS' || tipoMov === 'RECARGA DE TIEMPO AIRE'),
        origen: 'extension',
      });
    }

    if (!rows.length) {
      console.warn('[Yastás extensión] El reporte no contiene movimientos.');
      return;
    }

    const fechas = [...new Set(rows.map((x) => x.fecha))];
    const fechaArchivo = fechas[0] || job.fecha;
    console.log(`[Yastás extensión] Subiendo ${rows.length} movimientos de ${fechaArchivo} a Supabase…`);

    // 1. Upsert a yastas_movimientos_portal
    const resMov = await fetch(`${SUPABASE_URL}/rest/v1/yastas_movimientos_portal?on_conflict=id_operacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    });

    if (!resMov.ok) {
      const errTxt = await resMov.text();
      throw new Error(`Error en Supabase yastas_movimientos_portal: ${errTxt}`);
    }

    // 2. Upsert a yastas_import_jobs
    const resJob = await fetch(`${SUPABASE_URL}/rest/v1/yastas_import_jobs?on_conflict=job_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        job_id: job.jobId,
        fecha: fechaArchivo,
        estado: 'importado',
        paso: 'terminado',
        detalle: `${rows.length} filas importadas automáticamente desde el portal`,
        filas: rows.length,
        origen: 'extension',
        actualizado_en: new Date().toISOString(),
      }),
    });

    if (!resJob.ok) {
      console.warn('[Yastás extensión] Aviso al actualizar job:', await resJob.text());
    }

    // Purgar movimientos con más de 7 días de antigüedad (regla de retención estricta)
    try {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      const limite7d = d7.toISOString().slice(0, 10);
      fetch(`${SUPABASE_URL}/rest/v1/yastas_movimientos_portal?fecha=lt.${limite7d}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      }).catch(() => {});
      fetch(`${SUPABASE_URL}/rest/v1/yastas_import_jobs?fecha=lt.${limite7d}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      }).catch(() => {});
    } catch (e) {}

    console.log('[Yastás extensión] ✅ Importación completada con éxito en Supabase.');
    await chrome.storage.local.set({
      pendingJob: {
        ...job,
        estado: 'importado',
        filas: rows.length,
        fecha: fechaArchivo,
      },
    });

    // Notificar a las pestañas
    const tabs = await chrome.tabs.query({});
    tabs.forEach((t) => {
      chrome.tabs.sendMessage(t.id, {
        tipo: 'YASTAS_IMPORTACION_COMPLETA',
        fecha: fechaArchivo,
        filas: rows.length,
      }).catch(() => {});
    });
  } catch (err) {
    console.error('[Yastás extensión] ❌ Error procesando/subiendo XLSX:', err);
    await chrome.storage.local.set({
      pendingJob: { ...job, estado: 'error', error: String(err) },
    });
  }
}

// --- Borrado seguro del archivo descargado ---
async function borrarArchivoDescargado(downloadId) {
  try {
    await chrome.downloads.removeFile(downloadId);
    console.log('[Yastás extensión] 🗑️ Archivo borrado físicamente del disco:', downloadId);
  } catch (err) {
    console.warn('[Yastás extensión] Esperando liberación para borrar archivo:', err);
    setTimeout(async () => {
      try {
        await chrome.downloads.removeFile(downloadId);
        console.log('[Yastás extensión] 🗑️ Archivo borrado tras reintento:', downloadId);
      } catch (e) {}
    }, 1500);
  }

  try {
    await chrome.downloads.erase({ id: downloadId });
    console.log('[Yastás extensión] 🧹 Descarga borrada del historial del navegador:', downloadId);
  } catch (err) {}
}

// --- Manejo de la solicitud de descarga ---
function manejarSolicitudDescarga(mensaje, sender, sendResponse) {
  const fecha = mensaje.fecha;
  const jobId = mensaje.jobId || crypto.randomUUID();

  guardarTrabajoPendiente({
    jobId,
    fecha,
    estado: 'iniciado',
    origen: sender.origin || 'popup-interno',
    ts: Date.now(),
  })
    .then(() => {
      console.log('[Yastás extensión] Job guardado, abriendo portal…', { jobId, fecha });
      return abrirOEnfocarPestanaYastas();
    })
    .then((tab) => {
      console.log('[Yastás extensión] Pestaña lista, tabId:', tab.id);
      sendResponse({ ok: true, jobId, tabId: tab.id });
    })
    .catch((err) => {
      console.error('[Yastás extensión] ERROR al iniciar descarga:', err);
      sendResponse({ ok: false, error: String(err) });
    });

  return true;
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
    await chrome.tabs.update(existente.id, { active: false, url: YASTAS_LOGIN_URL });
    return existente;
  }
  return chrome.tabs.create({ url: YASTAS_LOGIN_URL, active: false });
}

// --- Mensajes internos ---
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  if (mensaje?.tipo === 'YASTAS_DESCARGAR') {
    return manejarSolicitudDescarga(mensaje, sender, sendResponse);
  }

  if (mensaje?.tipo === 'YASTAS_PROGRESO') {
    console.log('[Yastás extensión]', mensaje.paso, mensaje.detalle || '');
  }

  if (mensaje?.tipo === 'YASTAS_XLSX_CAPTURADO') {
    console.log('[Yastás extensión] XLSX recibido desde el content script. Procediendo a parsear y subir…');
    chrome.storage.local.get('pendingJob').then(({ pendingJob }) => {
      const job = pendingJob || { jobId: crypto.randomUUID(), fecha: new Date().toISOString().slice(0, 10) };
      procesarYSubirXlsx(mensaje.base64, job);
    });
  }

  if (mensaje?.tipo === 'YASTAS_TERMINADO' || mensaje?.tipo === 'YASTAS_CERRAR_PORTAL') {
    console.log('[Yastás extensión] Secuencia de portal terminada:', mensaje.detalle || mensaje.tipo);
    setTimeout(async () => {
      try {
        if (sender?.tab?.id) {
          await chrome.tabs.remove(sender.tab.id);
        } else {
          const portalTabs = await chrome.tabs.query({ url: 'https://portales-ext.prd.cloud.yastas.com/*' });
          for (const pt of portalTabs) {
            await chrome.tabs.remove(pt.id);
          }
        }
        console.log('[Yastás extensión] 🚪 Pestaña del portal cerrada automáticamente.');
        const allTabs = await chrome.tabs.query({});
        allTabs.forEach((t) => {
          chrome.tabs.sendMessage(t.id, { tipo: 'YASTAS_PORTAL_CERRADO' }).catch(() => {});
        });
      } catch (e) {
        console.warn('[Yastás extensión] Aviso al cerrar pestaña:', e);
      }
    }, 1500);
  }
});

// --- Detección y Borrado Obligatorio del archivo descargado en disco ---
chrome.downloads.onCreated.addListener((item) => {
  if (!item.url.includes('portales-ext.prd.cloud.yastas.com') && !item.filename.toLowerCase().includes('reporte de movimientos')) return;
  console.log('[Yastás extensión] Descarga detectada en navegador:', item.filename || item.url);
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (delta.state?.current !== 'complete') return;

  const [item] = await chrome.downloads.search({ id: delta.id });
  if (!item) return;

  const esYastas =
    item.url.includes('portales-ext.prd.cloud.yastas.com') ||
    item.filename.toLowerCase().includes('reporte de movimientos');

  if (!esYastas) return;

  console.log('[Yastás extensión] Archivo descargado en disco:', item.filename);

  // BORRADO OBLIGATORIO: eliminar de la carpeta de Descargas e historial
  await borrarArchivoDescargado(item.id);
});
