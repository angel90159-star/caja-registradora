# Yastás Auto-Descarga (extensión de Chrome)

Extensión personal (no publicada en la Chrome Web Store) que automatiza, desde
el botón del dashboard de Caja Registradora, la descarga de movimientos del
[Portal de Autoservicio de Yastás](https://portales-ext.prd.cloud.yastas.com/portal-autoservicio/login).

## Por qué existe

El portal está protegido por un WAF anti-bots (Incapsula), así que la
automatización **no puede vivir en Vercel/GitHub Actions/un VPS** — esos
salen desde IPs de datacenter que el WAF bloquea. En cambio, esta extensión
corre dentro de tu Chrome real: usa tu sesión, tu IP y tu navegador, en una
pestaña de verdad. El botón de tu dashboard no descarga nada él mismo, solo
le avisa a la extensión qué fecha necesitas.

## Cómo está armada

```
yastas-extension/
├── manifest.json              # permisos, content script, externally_connectable
├── background.js              # recibe el mensaje del dashboard, abre la pestaña
├── content-scripts/
│   └── watcher.js             # vive en la pestaña de Yastás, ejecuta la secuencia
└── popup/
    ├── popup.html             # UI para probar manualmente sin el dashboard
    └── popup.js
```

Las credenciales **nunca van en el código** (este repo se sube a GitHub). Hay
dos formas de que el login sea automático:

1. **Credenciales guardadas desde el popup** (recomendado para máquina de
   prueba): en el popup, sección "Credenciales del portal", escribes usuario
   y contraseña una vez y das "Guardar". Quedan en `chrome.storage.local`,
   solo en ese navegador, sin cifrar — úsalo únicamente en un equipo de
   confianza. `watcher.js` las rellena y hace clic en "ENTRAR".
2. **Autofill nativo del navegador**: si Edge/Chrome ya tiene la contraseña
   guardada y la rellena solo al cargar la página, `watcher.js` detecta los
   campos llenos y hace clic en "ENTRAR". Ojo: la extensión "Contraseñas en
   iCloud" NO sirve para esto, pide un clic manual cada vez.

## Instalación (modo desarrollador, para tu propio uso)

Funciona igual en **Chrome** o **Edge** (Edge es Chromium por debajo y usa la
misma API `chrome.*`, incluido `externally_connectable` y `chrome.downloads`)
— mismo manifest, cero cambios entre uno y otro.

1. Abre `chrome://extensions` (Chrome) o `edge://extensions` (Edge).
2. Activa **"Modo de desarrollador"** (arriba a la derecha).
3. **"Cargar descomprimida"** → selecciona esta carpeta (`yastas-extension/`).
4. Copia el **ID de la extensión** que te asigna (lo vas a necesitar en el
   paso de integración).
5. Entra una vez a mano al portal de Yastás y deja que el navegador te
   ofrezca guardar la contraseña (si ya la tenías guardada de antes, el
   autofill debería funcionar directo).

## Estado actual: qué falta

- ✅ Detección de la pantalla de login y confirmación con autofill.
- ✅ **Secuencia completa post-login** (a partir de la grabación real con
  `playwright codegen`): home → menú hamburguesa → "Consultas" → "Reporte de
  Movimientos" → fijar fecha inicial/final en el datepicker de Angular
  Material (con navegación de mes) → "CONSULTAR" → "EXPORTAR" → cierre de
  sesión. Ver [`content-scripts/watcher.js`](content-scripts/watcher.js).
  - ⚠️ Sin probar todavía en el portal real — son selectores estándar de
    Angular Material (`.mat-calendar-*`, aria-labels "Open calendar" /
    "Previous month" / "Next month") deducidos de la grabación, pero conviene
    correrlo una vez y revisar los logs de la consola por si algo no calzó
    exacto (p. ej. el texto del botón de periodo del calendario).
- ⬜ **Captura del contenido del archivo descargado.** `chrome.downloads` solo
  da metadata (ruta/nombre), no el contenido — hay dos caminos, comentados en
  [`background.js`](background.js):
  1. Interceptar la respuesta de red del clic en "EXPORTAR" directamente
     desde `watcher.js` (fetch/blob) y mandarla por mensaje, sin tocar disco.
  2. Pedir al usuario que seleccione el archivo ya descargado una vez (File
     System Access API / `<input type="file">`).
- ⬜ Subida a Supabase de los datos descargados (tabla `yastas_movimientos_portal`)
  y de los logs de progreso (tabla `job_logs`) para verlos en vivo desde el
  dashboard — comentarios `TODO` con la forma exacta en `background.js`.

### Cosas a decidir/ajustar

- El cierre de sesión automático al final (`CERRAR SESIÓN` → `Sí`) está tal
  cual se grabó. Si prefieres que la sesión quede viva para que la siguiente
  corrida no tenga que hacer login de nuevo, comenta ese bloque en
  `ejecutarDescarga()`.
- El clic en `img nth(2)` que aparecía en la grabación (justo después de la
  descarga, antes del logout) no quedó incluido — no estaba claro si cerraba
  un modal de confirmación o era incidental. Si notas que algo se queda
  atorado ahí, dime qué es ese ícono y lo agrego.

## Integración con el dashboard (Vercel)

Antes de que el botón funcione hace falta:

1. Poner el **ID real de la extensión** (paso 4 de instalación) en el
   dashboard.
2. Cambiar en [`manifest.json`](manifest.json) el dominio de
   `externally_connectable` por tu dominio real de Vercel si no es
   `caja-registradora.vercel.app`.

Snippet de ejemplo para `app.js` (aún no está agregado al proyecto, es solo
la forma que tomaría):

```js
const YASTAS_EXTENSION_ID = 'PON_AQUI_EL_ID_DE_LA_EXTENSION'; // de chrome://extensions

function descargarMovimientosYastas(fecha) {
  if (!window.chrome?.runtime?.sendMessage) {
    alert('Esta función necesita la extensión de Chrome instalada en este navegador.');
    return;
  }
  chrome.runtime.sendMessage(
    YASTAS_EXTENSION_ID,
    { tipo: 'YASTAS_DESCARGAR', fecha },
    (respuesta) => {
      if (chrome.runtime.lastError || !respuesta?.ok) {
        console.error('No se pudo iniciar la descarga', chrome.runtime.lastError || respuesta);
        return;
      }
      console.log('Descarga iniciada, jobId:', respuesta.jobId);
    }
  );
}
```

## Probar sin tocar el dashboard todavía

Con la extensión cargada, haz clic en su ícono (barra de Chrome) → se abre
`popup.html` → eliges una fecha → **"Probar descarga"**. Eso dispara el mismo
flujo que usaría el botón del dashboard, sin depender de Vercel ni de
`externally_connectable`. Útil para ir probando la Fase 2 mientras se arma.
