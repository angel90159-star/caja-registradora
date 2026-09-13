# Plan de trabajo: Descarga automática del Portal Yastás + Encuadre contra la Caja

**Fecha:** 2026-09-12
**Origen:** sesión de Claude Code con Miguel Ángel (usuario/dueño del proyecto)
**Estado global (2026-09-13):** extensión funcionando de punta a punta; **Bloque 1 integrado en la app** (`index.html` + `app.js`/`app_v3.js`: ventana de encuadre, importación manual del XLSX a Supabase, ganancia incremental a Terminal Yastás firmada con PIN) y validado con Playwright aislado; **migración de Supabase aplicada por el usuario el 2026-09-13** (tablas verificadas vía REST). Pendientes: Bloque 2 (extensión → Supabase + borrado del archivo) y Bloque 3 (botones de corrección de errores de captura). Ver la entrada 2026-09-13 en `AGENTS.md`.

> **Para Antigravity:** este documento existe para que retomes el trabajo con todo el contexto sin releer la conversación. Aplican íntegras las reglas de `AGENTS.md` (sin `git push` sin autorización, sin adiciones no pedidas, sincronía `app.js`/`app_v3.js`, versión de script en `index.html`, `js_validator.py`, aislamiento de Supabase en pruebas Playwright). La sección 8 lista las preguntas abiertas y la 9 los puntos donde se espera que **propongas mejoras** antes de implementar.

---

## 1. Qué pidió el usuario

En sus palabras (resumido): *"montar un sistema automático que se ejecute desde la página web (Vercel) y al aplicar un botón descargue la base de datos de la fecha que requiero"* del Portal de Autoservicio de Yastás; *"de preferencia oculto, pero al final, porque ocupo ver qué hace en el proceso"*; y después *"una ventana nueva que compare ese documento con lo que se generó de movimiento el día de hoy; si está ese movimiento, que aparezca el nombre de la persona que lo hizo; los movimientos de recarga telefónica quiero que se actualice ese saldo pero que avise si no se hizo una recarga"*.

Interpretación acordada:
1. **Descarga automática** del "Reporte de Movimientos" del portal para una fecha dada, disparada desde la app.
2. **Encuadre (conciliación)** entre ese reporte y la bitácora de la caja (`caja_logs`) del mismo día: qué cuadra, qué no, y **quién** hizo cada operación (operador de la caja).
3. **Recargas telefónicas:** actualizar un saldo a partir de lo que reporta el portal y **avisar** cuando una recarga cobrada en caja no exista en el portal (o al revés).
4. La descarga **no** debe requerir subir el archivo a mano (el usuario lo preguntó explícitamente); se aceptó dejar la carga manual solo como respaldo.

---

## 2. Hallazgos técnicos del portal

- **URL:** `https://portales-ext.prd.cloud.yastas.com/portal-autoservicio/login` (empresa **Gentera**, dueña de Yastás/Compartamos).
- **Stack:** Angular **19.2.25** + Angular Material (IDs `mat-input-0`/`mat-input-1`, clases `mat-mdc-*`, datepicker con aria-labels nativos en inglés: `Open calendar`, `Previous month`, `Next month`).
- **Protección:** WAF **Imperva Incapsula** (`_Incapsula_Resource` en los scripts de la página). Esto es lo que descarta cualquier automatización desde IPs de datacenter (ver sección 3).
- **Login:** usuario + contraseña únicamente (sin OTP observado). Botón `ENTRAR` deshabilitado hasta que ambos campos son válidos. El botón "CERRAR SESIÓN" existe en el DOM incluso en la pantalla de login (oculto), con texto real `power_settings_newCERRAR SESIÓN` (ligadura del ícono pegada al texto).
- **Flujo grabado con `npx playwright codegen` por el usuario** (secuencia exacta que la extensión reproduce):
  1. Login → (redirección a `/portal-autoservicio/home`).
  2. Clic en hamburguesa `.hamburger > div:nth-child(2)`.
  3. Botón **Consultas** → menuitem **Reporte de Movimientos**.
  4. `app-daily-calendar` "Fecha inicial:" → `[aria-label="Open calendar"]` → (navegar mes con `.mat-calendar-previous-button`/`.mat-calendar-next-button` si hace falta) → botón del día (`button.mat-calendar-body-cell` con aria-label tipo `12 de septiembre de 2026`).
  5. Igual para "Fecha final:" (mismo día: reporte de un solo día).
  6. Botón **CONSULTAR** → se llena la tabla → botón **EXPORTAR** → descarga `Reporte de Movimientos.xlsx`.
  7. Cerrar sesión: ícono de usuario **arriba a la derecha** → se abre panel lateral con datos del comisionista → botón **CERRAR SESIÓN** al fondo → diálogo *"Cerrar sesión — ¿Estás seguro…?"* → botón **SÍ**.
- **Cabecera del calendario:** muestra `12-SEPTIEMBRE-2026` (no el formato estándar de Material); el parser de mes/año tolera ese formato.
- Días futuros aparecen deshabilitados en el datepicker.

---

## 3. Decisiones de arquitectura (ya tomadas con el usuario)

| Alternativa | Decisión | Por qué |
|---|---|---|
| Vercel serverless / GitHub Actions / VPS con Playwright headless | **Descartada** | Salen desde IPs de datacenter que Incapsula bloquea; además, construir evasión de detección de bots (stealth, fingerprint, proxies residenciales) **no es una opción** — se le explicó al usuario y lo aceptó. |
| "Tomar la IP del clic" para que el servidor la use | **Descartada** | No es técnicamente posible (TCP no permite suplantar origen). |
| Agente local en la Mac / mini-PC del negocio | Viable, no elegida | Requiere proceso aparte corriendo. |
| **Extensión de navegador (Chrome/Edge, Manifest V3)** | **Elegida** | Corre en el navegador real del usuario (su IP, su sesión, una pestaña de verdad). El botón de la app en Vercel solo le manda un mensaje (`externally_connectable`). Cumple "ver qué hace" (pestaña visible) y después "oculto" (`active:false`). |

Otras decisiones explícitas del usuario:
- **Credenciales nunca en el código versionado.** Se le dio un archivo local `yastas-extension/config.local.js` (en `.gitignore`, verificado con `git check-ignore`) donde él mismo las escribió. Alternativas ya implementadas: guardarlas desde el popup (`chrome.storage.local`) o confiar en el autofill del navegador. **La extensión "Contraseñas en iCloud" no sirve** (pide clic manual).
- **Ritmo humano:** pausas aleatorias entre pasos (0.7–1.4 s por defecto; 4–5 s después de entrar; 2–3.5 s tras CONSULTAR). Pedido explícito del usuario tras ver que "demasiado rápido se ciclaba".
- **Cerrar sesión al final** (tal como lo grabó). Se dejó comentado cómo desactivarlo si prefiere sesión viva.
- **Seguridad:** el usuario pegó su contraseña real en el chat durante la sesión; se le recomendó **rotarla**. No se guardó en ningún archivo por parte del agente.
- Se usa en **Edge** (Chromium) — mismo código que Chrome, se carga desde `edge://extensions`.

---

## 4. Estado actual de la extensión (`yastas-extension/`)

```
yastas-extension/
├── manifest.json               MV3. permissions: storage, tabs, downloads. host_permissions: portal Yastás.
│                               content_scripts: [config.local.js, content-scripts/watcher.js] en https://portales-ext.prd.cloud.yastas.com/*
│                               externally_connectable: https://caja-registradora.vercel.app/* y http://localhost:*/*  (⚠ confirmar dominio real)
├── background.js               Service worker. Recibe YASTAS_DESCARGAR (interno desde popup y externo desde la app),
│                               guarda pendingJob en chrome.storage.local, abre/enfoca la pestaña del portal,
│                               escucha progreso, y chrome.downloads.onCreated/onChanged para detectar el XLSX.
├── content-scripts/watcher.js  Vive en la pestaña del portal (SPA → un solo script con MutationObserver agrupado cada 400 ms).
│                               Fase 1 login (rellena desde credenciales o detecta autofill; clic ENTRAR una sola vez).
│                               Fase 2 secuencial: home → menú → Consultas → Reporte → fechas → CONSULTAR → EXPORTAR → marcar job terminado → cerrar sesión.
├── config.local.js             (.gitignore) globalThis.YASTAS_CREDENCIALES = {usuario, password}. Con placeholders se ignora.
├── config.local.example.js     Plantilla versionable.
├── popup/popup.html + popup.js Estado del job, prueba manual por fecha, panel para guardar/borrar credenciales en storage.
├── docs/encuadre-mockup.html   Mockup de la ventana de encuadre con datos reales del 2026-09-12 (ver sección 6).
├── docs/encuadre-mockup.png    Captura del mockup.
└── README.md                   Instalación (Chrome/Edge), qué falta, snippet de integración con app.js.
```

**Modelo de estado del job** (`chrome.storage.local.pendingJob`): `{ jobId, fecha:'YYYY-MM-DD', estado, origen, ts, redirigidoHome?, archivo?, error? }`. Estados: `iniciado` → `terminado` (lo marca watcher antes del logout) → `descarga-completa` (lo marca background al terminar el XLSX) | `abortado` (2 intentos fallidos). **Los estados finales detienen todo**: sin esto, al volver al login tras cerrar sesión el watcher repetía el ciclo completo (bug real que se corrigió).

**Mensajes:** `YASTAS_DESCARGAR {fecha, jobId}` (app/popup → background), `YASTAS_PROGRESO {paso, detalle}` y `YASTAS_TERMINADO` (watcher → background). Pasos reportados en consola con prefijo `[Yastás extensión]`: `login-detectado`, `login-credenciales-rellenadas`, `login-click-entrar`, `post-login-detectado`, `fase2-inicio`, `menu-abierto`, `reporte-movimientos-abierto`, `fechas-fijadas`, `consulta-disparada`, `exportar-click`, `menu-usuario-abierto`, `logout-click`, `sesion-cerrada`, `error`, `reintento`, `abortado`, `aviso`.

**Validado en el portal real por el usuario:** login automático, navegación al reporte, selección de fecha (tras corregir el selector del día y la regla "si ya estás en el mes correcto, nunca navegues"), CONSULTAR, EXPORTAR → el XLSX baja a `~/Downloads`. **El cierre de sesión se reescribió tras las capturas del usuario (avatar por posición, no por índice de imagen) y queda pendiente de confirmar en una corrida completa.**

**Limitaciones conocidas:**
- El navegador debe estar abierto en esa máquina para que reaccione (inherente a "usar la IP real").
- `chrome.downloads` da solo metadata (ruta/nombre), **no el contenido** del archivo → ver Fase B.
- `externally_connectable` tiene el dominio de Vercel supuesto (`caja-registradora-lyart.vercel.app` (dominio real de producción; `caja-registradora.vercel.app` es OTRO proyecto)); el ID de la extensión lo asigna el navegador al cargarla y hay que ponerlo en la app.
- Los selectores del calendario son los estándar de Angular Material 19; si el portal actualiza versión pueden cambiar.
- Recargas (`YASTAS_RECARGA`), retiros Getnet y RE-DEPÓSITO **no se han visto todavía en un reporte real del portal** (no hubo el día de la prueba); su mapeo es supuesto (sección 5.4).

---

## 5. Análisis de datos: reporte del portal vs. bitácora de la caja

### 5.1 Estructura del XLSX exportado (`Reporte de Movimientos.xlsx`)
- Una hoja `Reporte de Movimientos`. **Fila 0** = filtros aplicados (texto); **fila 1** = encabezados; **datos desde la fila 2**.
- 27 columnas: `Fecha, Hora, Comisionista, Tipo Cuenta, Grupo Cuenta, Num. Cuenta, Tipo Movimiento, Descripción, Operación, ID Operación, Autorización Yastás, Monto Total, Saldo Inicial, Saldo Deudor, Saldo Disponible, Servicio, Autorización Emisor, Comercio, Operador, Referencia, Status, Monto Operación, Comisión UF, Iva Comisión, Ganancia, Uso Plataforma, Nombre Emisor`.
- `Operador` del portal es el **ID de operador** de Yastás (`606`), **no** el nombre de la persona → el nombre solo puede salir de la caja.

### 5.2 Tipos de fila (el reporte del 12-sep tenía 20 filas, solo 11 son operaciones con clientes)
| `Tipo Movimiento` | `Operación` | Qué es | Se cruza |
|---|---|---|---|
| `OPERACIONES FINANCIERAS` | `CASH-IN` / `CASH-OUT` | Operación real con cliente (depósito, pago de crédito, pago de servicio, retiro, pago de ODP) | **Sí** |
| `COBRO DE CUENTA DE FONDEO` | `-` | Asiento interno de Yastás; aparece **en pareja** (Línea de sobregiro + Dinero Inmediato) espejando cada CASH-OUT | No (mostrar como "asientos internos") |
| `ABONO A INVERSION` | `-` | Movimiento propio del comisionista | No |
| cualquier fila con `Status` ≠ `APROBADA` | | Rechazada/cancelada | No cruzar; listar aparte |

Descripciones vistas: `DEPOSITO DE EFECTIVO-COMPARTAMOS`, `PAGO DE CREDITO-COMPARTAMOS`, `PAGO DE SERVICIO FACTURADOR-BANORTE` (CASH-IN); `COMPARTAMOS-RETIRO DE EFECTIVO`, `COMPARTAMOS-PAGO DE ODP` (CASH-OUT).

### 5.3 Modelo de la caja (`caja_logs` en Supabase; `DB.get('logs')` en memoria)
Campos: `id, timestamp (ISO UTC), type, category, amount, operator, details, pieces, extra_data`. El `timestamp` está en UTC → convertir a hora local (CDMX, UTC-6) antes de comparar con `Hora` del portal.

Categorías Yastás y cómo se generan (`registrarMovimientoBitacora`, app.js ~3917):
- `YASTAS`: `amount > 0` = DEPÓSITO, `amount < 0` = RETIRO. `details` = `"Op: DEPÓSITO. Monto de operación: $X"` o `"Op: DEPÓSITO. Depósito de $X. Recibido: $Y. Cambio: $Z (...)"`.
- `YASTAS_GETNET`: retiro cobrado por terminal Getnet (`amount < 0`).
- `YASTAS_RECARGA`: recarga telefónica. **⚠ `amount` = monto solo si método = Efectivo; si método = "Pago a Terminal", `amount = 0`.** El monto real siempre está en `details`: `"Op: RECARGA. Recarga Telefónica. Método: Efectivo|Pago a Terminal. Monto: $X"`. El encuadre debe extraerlo de ahí cuando `amount === 0`.
- `RE-DEPÓSITO`: operación combinada; `extra_data = { retiros:[…], deposito, efectivoRecibido, cambioEntregado }`. Para cruzar hay que **desglosarla** en N retiros virtuales + 1 depósito.

Efecto en saldos (app.js ~3620): depósito → `yastasEfectivo += monto`, `yastasTerminal -= monto`; retiro → inverso; recarga en efectivo → igual que depósito; recarga por terminal → efecto digital neto 0.

### 5.4 Reglas de cruce (las "combinaciones"), en el orden en que se prueban
Implementadas en `encuadrar()` dentro de `docs/encuadre-mockup.html` (JS puro, portable a `app.js`).

| Paso | Condición | Resultado |
|---|---|---|
| 0 Filtrar | Portal: solo `OPERACIONES FINANCIERAS` + `CASH-IN/OUT` + `APROBADA`. Caja: solo `YASTAS`, `YASTAS_GETNET`, `YASTAS_RECARGA`, `RE-DEPÓSITO` (desglosado). | Resto → internos / ignorados |
| 1 Tipo | `CASH-IN` ↔ DEPÓSITO; `CASH-OUT` ↔ RETIRO; si `Servicio`/`Descripción` coincide con `/RECARGA\|TELCEL\|MOVISTAR\|AT&T\|UNEFON\|BAIT\|VIRGIN\|TIEMPO AIRE/i` ↔ RECARGA | Solo se comparan del mismo tipo |
| 2 Exacto | \|monto caja\| = **`Monto Total`** del portal, a ±15 min; si hay varios, el más cercano en hora (greedy) | ✅ Cuadra |
| 3 Monto operación | \|monto caja\| = `Monto Operación` (≠ Monto Total), ±15 min | ⚠ Cuadra sin comisión |
| 4 Aproximado | diferencia ≤ $5.00 o ≤ 0.5 %, ±15 min | ⚠ Diferencia (se muestra el importe) |
| 5 Fuera de hora | monto exacto, mismo día, > 15 min | ⚠ Hora no coincide |
| 6 Huérfanos | sin pareja | ❌ Solo en portal (no registrado en caja) / ❌ Solo en caja (no existe en Yastás) |
| 7 Recargas | reglas 2–6 solo entre recargas + suma del portal → saldo de recargas | 🔴 recarga en caja sin portal · 🟠 recarga en portal sin caja |

**Hallazgos del reporte del 2026-09-10 (88 filas, 4 cajeras) que corrigen las reglas anteriores:**
- Las recargas vienen con `Tipo Movimiento = RECARGA DE TIEMPO AIRE` (no `OPERACIONES FINANCIERAS`), `Descripción = PAQUETE DATOS Y SALDO-TELCEL`, `Operación = CASH-IN`. El filtro del paso 0 debe admitir ese tipo.
- Para recargas se cruza contra **`Monto Operación`** (lo que pagó el cliente); `Monto Total` es el neto descontado en terminal. Al revés que el resto de operaciones.
- Filas con `Status = DECLINADA` (hubo un retiro de $5,000 declinado y repetido un minuto después) se excluyen del cruce y se listan aparte.
- `CONSULTA DE SALDO` con $0 se ignora.
- Resultado 10-sep: 47 pares, 46 exactos, 1 "hora no coincide" (depósito $3,876: portal 16:30, caja 17:17), 0 huérfanos, recargas 3/3, 3 re-depósitos desglosados correctamente. Archivo: `yastas-extension/docs/encuadre_2026-09-10.html` (+ `datos_2026-09-10.json`).
- Bug de texto en el banner del mockup de Antigravity: trata "hora no coincide" como "diferencia de dinero" y deja el monto vacío.

**Regla clave descubierta con datos reales:** comparar contra **`Monto Total`** (lo que el cliente pagó, comisión incluida), no contra `Monto Operación`. Ej.: pago de servicio Banorte con `Monto Operación` 838 + comisión 15 = `Monto Total` 853; la caja registró 853.

### 5.5 Resultado real del 2026-09-12 (11 vs 11 operaciones, todas de **Ingrid**)
- **10 cuadran exacto** (misma cifra; horas a segundos de diferencia, la mayor 3.7 min).
- **1 con diferencia:** 17:33:50 portal `COMPARTAMOS-PAGO DE ODP` CASH-OUT **$8,003.40** vs caja 17:34:45 RETIRO **$8,000.00** → la caja registró $3.40 menos.
- **0 huérfanos** en ambos lados. **Recargas 0/0.** 9 filas internas ignoradas (4 pares de fondeo + 1 abono a inversión).
- Neto portal $28,834.60 vs neto caja $28,838.00 (la diferencia es exactamente los $3.40).

---

## 6. Mockup entregado (`yastas-extension/docs/encuadre-mockup.html`)
Página autónoma (Montserrat + JetBrains Mono, tokens claro/oscuro, mismos colores de familia que la app: slate/indigo; violeta para el lado del portal; verde/ámbar/rojo semánticos). Contiene los datos reales del día incrustados (sin números de cuenta ni referencias) y **la función `encuadrar(portal, caja)`** con las reglas de 5.4. Secciones: cabecera con chips de fuente; 5 KPIs (cuadran / con diferencia / solo portal / solo caja / recargas); tabla lado a lado Portal ⇄ Estado ⇄ Caja con columna **Quién**; panel de recargas (saldo portal, cobrado en caja, diferencia, avisos, botón "Actualizar saldo de recargas", ejemplo ilustrativo de los dos avisos); asientos internos ignorados; tabla de reglas.
**Es un mockup:** los datos están incrustados, el botón de saldo solo cambia su texto. Sirve como especificación visual y como fuente de la lógica.

---

## 7. Plan de trabajo propuesto (fases)

### Fase A — Cerrar la extensión (pequeño)
- [ ] Confirmar en una corrida completa que el cierre de sesión funciona (avatar → CERRAR SESIÓN → SÍ). Ajustar `buscarAvatar()` si el ícono no es `img`.
- [ ] Decidir dominio real de Vercel para `externally_connectable` y anotar el ID de la extensión.
- [ ] Opcional (cuando el usuario lo pida): `active:false` en `abrirOEnfocarPestanaYastas()` para que corra en segundo plano.

### Fase B — Capturar el contenido del XLSX sin pasar por disco
El content script corre en el *isolated world*; el clic en EXPORTAR dispara una petición de red que devuelve el archivo (o genera un blob). Opciones, en orden de preferencia:
1. **Inyectar un script en el MAIN world** (`chrome.scripting.executeScript({world:'MAIN'})` o `web_accessible_resources` + `<script>`) que envuelva `fetch`/`XMLHttpRequest` y/o `URL.createObjectURL` para capturar la respuesta binaria del export y pasarla al content script con `window.postMessage`. Ventaja: cero dependencia de la carpeta de Descargas.
2. Respaldo: dejar que baje a disco y pedir al usuario seleccionarlo una vez (`<input type="file">`) — solo como fallback manual.
- [ ] Parsear el XLSX **dentro de la extensión** con SheetJS empaquetado localmente (`xlsx.full.min.js` en la carpeta; MV3 prohíbe scripts remotos). Leer a partir de la fila 2, usar la fila 1 como encabezados.
- [ ] Normalizar filas → objeto `{fecha, hora, tipoMovimiento, descripcion, operacion, montoTotal, montoOperacion, comision, servicio, status, idOperacion, operadorPortal, emisor, ganancia}`. **No** persistir `Num. Cuenta` ni `Referencia` completas (datos sensibles innecesarios para el encuadre).

### Fase C — Supabase
- [ ] Tabla `yastas_movimientos_portal` (una fila por operación del reporte): `id uuid pk`, `fecha date`, `hora time`, `id_operacion text unique` (idempotencia: re-importar el mismo día no duplica), `tipo_movimiento`, `descripcion`, `operacion`, `monto_total numeric(12,2)`, `monto_operacion numeric(12,2)`, `comision numeric(12,2)`, `servicio`, `status`, `operador_portal text`, `emisor`, `ganancia numeric(12,2)`, `es_interno boolean`, `importado_en timestamptz default now()`, `job_id text`.
- [ ] Tabla `yastas_import_jobs` para estado/progreso (`job_id pk, fecha, estado, paso, detalle, archivo, creado_en, actualizado_en`) con Realtime habilitado → la app muestra "qué está haciendo" en vivo y, cuando ya se confíe, se oculta.
- [ ] Migraciones en `supabase/migrations/` siguiendo la convención existente (`YYYYMMDDHHMMSS_descripcion.sql`).
- [ ] **RLS:** la app usa una *publishable key* pública (`app.js:159`). Decidir política de INSERT/UPSERT para la extensión (anon con `unique(id_operacion)` y validación de columnas, o una función RPC `importar_reporte_yastas(jsonb)` con `security definer` que valide el payload). **Punto para propuesta de Antigravity.**
- [ ] `background.js`: al recibir las filas parseadas, `POST /rest/v1/...` (o RPC) y actualizar `yastas_import_jobs`; marcar `pendingJob.estado = 'descarga-completa'` solo tras el upsert exitoso.

### Fase D — Ventana "Encuadre Yastás" en la app
- [ ] `index.html`: nueva sección/modal (respetando Tailwind, Dark/Light, layouts existentes; sin agregar nada no pedido). Selector de fecha (default hoy). Reproducir la estructura del mockup: KPIs, tabla lado a lado con **Quién** (= `log.operator`), recargas, internos, reglas colapsadas.
- [ ] `app.js`/`app_v3.js`: portar `encuadrar()` tal cual del mockup + adaptadores: caja desde `DB.get('logs')`/`historical_logs_by_date[fecha]` (convertir `timestamp` UTC → hora local), portal desde `yastas_movimientos_portal` filtrado por `fecha`. Extraer monto de recargas desde `details` cuando `amount === 0`. Desglosar `RE-DEPÓSITO` con `extraData`.
- [ ] Botón **"Descargar del portal"** → `chrome.runtime.sendMessage(YASTAS_EXTENSION_ID, {tipo:'YASTAS_DESCARGAR', fecha})`; si `chrome.runtime` no existe (navegador sin la extensión), mostrar aviso y ofrecer **carga manual** (`<input type="file">` + mismo parser SheetJS, cargado desde cdnjs en la app, donde sí se permite).
- [ ] Panel de progreso suscrito a `yastas_import_jobs` por Realtime (patrón ya usado en `suscribirseARealtimeSupabase()`).
- [ ] Recargas: botón "Actualizar saldo de recargas" → **definir con el usuario qué saldo** (ver 8.1) y registrar en bitácora un `AJUSTE_DE_SALDO` como ya hace la app en otros ajustes (`registrarMovimientoBitacora('Admin','AJUSTE_DE_SALDO',…)`, app.js ~4653).
- [ ] Actualizar `app.js?v=…` en `index.html`, sincronizar `app_v3.js`, correr `js_validator.py`.

### Fase E — Pruebas
- [ ] Playwright sobre la app local con **interceptación obligatoria** de `**/*.supabase.co/**` (regla 5 de AGENTS.md): alimentar `encuadrar()` con el JSON del mockup y verificar los 10 cuadres + 1 diferencia de $3.40.
- [ ] Casos sintéticos: recarga en caja sin portal (aviso rojo), recarga en portal sin caja (ámbar), recarga por terminal (`amount=0`, monto desde `details`), RE-DEPÓSITO desglosado, dos operaciones con el mismo monto en el mismo día (se emparejan por cercanía de hora), fila `RECHAZADA`.
- [ ] Prueba real de la extensión completa con un día que tenga recargas, para confirmar cómo las nombra el portal (sección 8.3).

### Fase F — Documentación
- [ ] Entrada en `AGENTS.md → Registro de Cambios` por cada bloque implementado (formato de las entradas existentes: motivación, funcionalidad, dónde se ve, validado).
- [ ] Actualizar `yastas-extension/README.md` con el ID real y el dominio.

---

## 8. Preguntas abiertas (necesitan respuesta del usuario antes de implementar)

1. ~~¿Qué saldo se actualiza con las recargas?~~ **RESUELTO 2026-09-12 (decisión explícita del usuario):** se actualiza `balances.yastasTerminal`. Al registrar una recarga en efectivo la app resta a la terminal el monto completo que pagó el cliente (`Monto Operación`, ej. $100), pero la terminal real solo descuenta el neto (`Monto Total`, ej. $96.50); la diferencia es la comisión/utilidad del comisionista. El encuadre suma las comisiones exactas de las recargas que cuadran y hace **un** `AJUSTE_DE_SALDO` (+utilidad) a `yastasTerminal`. **PROHIBIDO usar porcentajes o estimaciones** (el 3.5 % observado en Telcel NO se debe programar): el único dato válido es el valor de cada fila del reporte descargado. La captura de recargas en `app.js` (~línea 3627) **no se modifica**. Ejemplo real 10-sep: 3 recargas, cobrado $250.00, descontado $241.25, ajuste +$8.75.
   *(Pregunta original: ¿Qué saldo se actualiza con las recargas?* Hoy la app tiene `yastasEfectivo`, `yastasTerminal`, `yastasGetnet`. "Ese saldo" puede ser (a) `yastasTerminal` (reconciliar contra el saldo digital real del portal, columna `Saldo Disponible`), (b) un contador/saldo nuevo de recargas del día, o (c) otro. El mockup lo modela como "Saldo recargas · portal = suma de recargas del portal" solo como propuesta.
2. **Diferencias como la de $3.40 (ODP):** ¿solo aviso, o botón para ajustar el retiro de la caja al monto del portal (con registro en bitácora)?
3. **Cómo aparecen en el portal** las recargas telefónicas, los retiros Getnet y los re-depósitos (ninguno salió el 12-sep). El mapeo de la regla 1 es una suposición hasta ver un reporte con esos casos.
4. **Tolerancias:** ±15 min y ≤ $5 / 0.5 % son propuestas; el usuario puede querer otras.
5. **Cerrar sesión siempre** al terminar, o dejar la sesión viva para que la siguiente corrida sea más rápida.
6. **Histórico:** ¿guardar en Supabase el reporte de cada día (recomendado, permite encuadres pasados) o solo el día consultado?
7. **Dominio real de Vercel** para `externally_connectable` y si la ventana debe funcionar también desde `localhost`.
8. ¿Se commitea `yastas-extension/` al repo? (todo el código es seguro; `config.local.js` ya está ignorado). El usuario dijo "quién dijo que lo vamos a subir" respecto a las credenciales, pero no decidió sobre el resto.

---

## 9. Dónde se espera propuesta de mejora de Antigravity (antes de tocar código)
- **Captura del XLSX (Fase B):** validar la opción de MAIN-world hook vs. alternativas que conozca mejor para Angular/Material; qué hacer si el export es un `blob:` generado en cliente en vez de una respuesta HTTP.
- **Diseño de Supabase (Fase C):** esquema, índices (`fecha`, `id_operacion`), política RLS segura con la key pública, idempotencia de reimportaciones, y si conviene una RPC.
- **Integración en `app.js`:** en qué bloque/sub-bloque del mapa de líneas de AGENTS.md debe vivir la ventana, cómo reutilizar `cargarBitacora()`/`historical_logs_by_date`, y cómo evitar duplicar el parser SheetJS (extensión vs. app).
- **Robustez de la extensión:** detectar expiración de sesión del portal, día sin movimientos (¿EXPORTAR deshabilitado?), reporte de más de una página, y cambios de versión de Angular Material.
- **Lógica de cruce:** revisar el algoritmo greedy por cercanía de hora frente a alternativas (asignación óptima) cuando hay muchas operaciones con el mismo monto.
- **Modo oculto:** cómo mostrar el progreso en la app sin la pestaña visible (Realtime sobre `yastas_import_jobs`) y qué mostrar cuando la extensión no está instalada.

---

## 10. Inventario de archivos de esta sesión
| Archivo | Estado |
|---|---|
| `yastas-extension/manifest.json`, `background.js`, `content-scripts/watcher.js`, `popup/*`, `README.md`, `config.local.example.js` | Nuevos, funcionales |
| `yastas-extension/config.local.js` | Nuevo, **ignorado por git**, contiene credenciales reales escritas por el usuario (solo esta máquina) |
| `yastas-extension/docs/encuadre-mockup.html` / `.png` | Nuevos, mockup + captura |
| `.gitignore` | +`yastas-extension/config.local.js` |
| `.agents/PLAN_YASTAS_ENCUADRE.md` (este documento) y entrada en `AGENTS.md` | Nuevos |
| `app.js`, `app_v3.js`, `index.html`, Supabase | **Sin cambios** |

Nada se ha commiteado ni subido (regla de AGENTS.md).

## 11. Cómo reproducir
1. `edge://extensions` (o `chrome://extensions`) → Modo desarrollador → "Carga desempaquetada" → carpeta `yastas-extension/`.
2. Escribir credenciales en `config.local.js` (o en el popup) → recargar la extensión.
3. Popup → fecha → "Probar descarga". Ver consola de la pestaña del portal (`F12`) con prefijo `[Yastás extensión]` y la del service worker desde la tarjeta de la extensión.
4. Abrir `yastas-extension/docs/encuadre-mockup.html` en el navegador para ver el encuadre del 12-sep y leer `encuadrar()`.
