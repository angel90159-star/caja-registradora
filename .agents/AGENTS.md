# Reglas Globales, Comportamiento y Control de Despliegue (Antigravity)

## ⛔ Control Estricto de Despliegue a la Nube (Git Push)
- **PROHIBIDO GIT PUSH AUTOMÁTICO**: Está strictly prohibido ejecutar `git push`, `git push origin main` o cualquier comando que envíe cambios al repositorio remoto / Vercel sin solicitar y recibir previamente la **autorización explícita** del usuario en el chat.
- **Flujo de Trabajo Obligatorio**:
  1. Realizar todas las ediciones de código y pruebas únicamente en los archivos locales.
  2. Verificar la sintaxis y correcto funcionamiento de los cambios locales.
  3. Informar al usuario en el chat sobre los cambios realizados localmente.
  4. **DETENERSE Y ESPERAR** la confirmación o instrucción explícita del usuario (ejemplo: *"sube los cambios"*, *"haz push"*, *"actualiza la nube"*) antes de ejecutar cualquier comando de subida.

---

# Prompt para Antigravity: Refactorización del Sistema de Caja, Control de Turnos y Módulos Financieros

## 🎯 Objetivo General
Implementar la refactorización integral del sistema POS ("La Central") en `app.js` y `app_v3.js`. El objetivo es garantizar la persistencia en Base de Datos (BD) como única fuente de verdad, el bloqueo estricto de seguridad (Gatekeeper), el flujo de cierre nocturno en 2 pasos con pre-carga opcional, el rigor contable en saldos digitales y efectivo (con arqueo ciego), y la sincronización simétrica entre archivos bajo un estricto protocolo de desarrollo.

---

## PARTE I: REQUERIMIENTOS TÉCNICOS Y FUNCIONALES

### 1. Persistencia y Control de Sesión (BD como Fuente Única de Verdad)
* **Eliminación de dependencia local:** Eliminar totalmente la lectura/escritura de estados de turno y saldos en `localStorage`. Toda la lógica transaccional y el estado de la sesión deben ser consultados directamente a la BD.
* **Rehidratación automática:** Al recargar la página o limpiar la caché, la aplicación debe consultar la BD para rehidratar el estado actual del turno sin duplicar aperturas ni perder estados de la sesión.
* **Cierre secuencial asíncrono:** En los cierres de turno, implementar un flujo asíncrono estricto con `await` para garantizar que el guardado de datos en la BD finalice correctamente **antes** de ejecutar el `logout` y redirigir a la pantalla de login.
* **Arquitectura Híbrida de Persistencia (Online-First con Offline-Fallback):**
  - **Modo En Línea (Normal):** Supabase es la Fuente Única de Verdad. Todas las aperturas, cierres y saldos leen y escriben directamente en Supabase mediante `await`. Queda **estrictamente prohibido** que `localStorage` o la caché local sobrescriba la información de Supabase mientras la conexión esté disponible.
  - **Modo Offline de Emergencia (Sin Internet):** `localStorage` se bloquea totalmente mientras haya conexión y sólo se activa como mecanismo de contingencia si `navigator.onLine === false` o si falla la red, desplegando un aviso de emergencia en la interfaz.
* **Sincronización y Validación:** Aplicar exactamente las mismas modificaciones en `app.js` y `app_v3.js`. Actualizar el parámetro de versión del script en `index.html` (ejemplo: `app.js?v=20260728_FIX`) para romper la caché del navegador y ejecutar `js_validator.py` antes de autorizar el despliegue.

---

### 2. Bloqueo de Interfaz (Gatekeeper) y Detección de Turnos
Al autenticarse el usuario con su PIN:
* **Consulta de estado:** El sistema verifica inmediatamente en la BD el estado del turno previo.
* **Si el turno anterior sigue `ABIERTO`:** Desplegar una alerta bloqueante e infranqueable: *"Atención: El turno del día anterior no fue cerrado formalmente. Por favor realiza el cierre para continuar."*
* **Si el turno anterior está `CERRADO`:** Activar el **Gatekeeper** (bloquear completamente el acceso a la interfaz principal, menú, ventas, cobros y movimientos) y forzar la pantalla/modal de **Apertura de Turno**.

---

### 3. Cierre Nocturno (Flujo en 1 Solo Paso)
* **Decisión confirmada 2026-08-03:** el Paso 2 (pantalla opcional de "Pre-carga de Fondo Base" con botones "Omitir y Salir" / "Guardar Pre-carga") fue solicitado explícitamente por el usuario para ser eliminado. La bandera `precarga_completada` ya **no se usa** — permanece siempre en `false` y no tiene ningún efecto en la lógica actual.
* **Flujo real:** El operador captura el conteo físico de cierre, firma con PIN, y el sistema guarda de inmediato `turno_estado = CERRADO`, resetea los saldos/flujos diarios (Yastás, T-Conecta, BBVA, Transferencia, Capital, Bóveda) y hace `logout`. No hay pantalla intermedia.
* Las plataformas persistentes (Banorte, Meli/Meli Base, T-Conecta Terminal, Banamex) se preservan sin cambios de un turno a otro, tal como antes.

---

### 4. Pantalla de Apertura Matutina
* **Decisión confirmada 2026-08-03:** no existe pre-llenado automático a partir del cierre de la noche anterior. El usuario pidió explícitamente eliminar esa función (`cargarBilletesAyer`, que copiaba el desglose del último `cierre_reports` al formulario de apertura) — la experiencia anterior de Escenario A/B ("con pre-carga" vs. "en blanco") queda descartada.
* **Flujo real (único escenario):** La pantalla de Apertura siempre se despliega en blanco (`$0.00`). El operador realiza el conteo físico completo, captura los saldos iniciales de plataformas (Yastás Terminal, etc.) y presiona **"Iniciar Turno"**. No hay comparación automática contra un cierre anterior ni Nota de Observación por discrepancia, porque no hay ninguna cifra pre-cargada contra la cual discrepar.

---

### 5. Módulo T-Conecta, Banamex y Saldos Digitales
* **Cinta Azul de Información:** Mostrar etiquetas dinámicas en tiempo real: `DISPONIBLE TERMINAL` y `SALDO CUENTA BANAMEX`.
* **Edición Manual de Saldo Base ("Lápiz"):** Al hacer clic en el lápiz, la aplicación permite editar el saldo base, sobrescribiendo el valor de origen en la BD y registrando automáticamente un evento `AJUSTE DE SALDO` en la bitácora auditable.
* **Lógica de Cálculos y Persistencia:**
  * `Saldo Total Banamex` = Saldo Ajustado + Entradas del día.
  * `Saldo Disponible Terminal` = Se reduce dinámicamente según cada operación ejecutada.
  * Los saldos base ajustados se heredarán de turno a turno; los contadores de operaciones diarias (recargas/retiros) se reinician automáticamente a `$0.00` en cada apertura.

---

### 6. Validador Obligatorio de Efectivo y Arqueo Ciego
* **Desglose Físico Obligatorio:** Prohibir el ingreso de cifras globales o montos planos. Todas las entradas de efectivo deben capturarse mediante el conteo unitario por denominación (billetes de $1000 a $20 y monedas de $20 a 50¢).
* **Arqueos Intermedios Ciegos:** En las pantallas de arqueo o revisión intermedia, ocultar la expectativa teórica calculada por el sistema para obligar al operador a realizar y declarar una cuenta física real sin sesgos.

---

### 7. Herramientas Auxiliares, UI y Módulos
* **Segmentación por Pestañas:** Mantener divididas las transacciones e historiales en pestañas independientes para **Yastás**, **Mercado Libre (Meli)**, **Banorte** y **T-Conecta / Banamex**.
* **Calculadora Flotante:** Garantizar que la Calculadora Flotante esté accesible de forma global en la interfaz.
* **Atajos de Teclado:** Asegurar que los campos de captura respondan correctamente a la navegación con teclado numérico y físico.

---

## PARTE II: REGLAS ESTRICTAS DE COMPORTAMIENTO Y DESARROLLO

1. **CLARIFICACIÓN Y PROHIBICIÓN DE ADICIONES NO SOLICITADAS (RESPETO ESTRICTO DEL ALCANCE):**
   * Si la instrucción del usuario no está 100% clara, es ambigua o admite múltiples interpretaciones de UI/lógica contable, **HAZ PREGUNTAS CLARIFICADORAS PRIMERO**. No asumas ni comiences a editar código sin tener certeza del comportamiento esperado.
   * **PROHIBIDO AGREGAR ELEMENTOS NO PEDIDOS:** Queda strictly prohibido añadir componentes, botones, campos, estilos, funciones de JS o alterar la estructura visual/lógica existente con elementos que el usuario **no haya solicitado explícitamente**. No asumas "mejoras por iniciativa propia". Si consideras que algo hace falta o se puede optimizar, **consúltalo primero** antes de tocar el código.

2. **RIGOR FINANCIERO Y DOBLE AFECTACIÓN (FÍSICO Y DIGITAL):**
   * La precisión numérica es CRÍTICA. Evita errores de redondeo trabajando siempre a 2 decimales exactos.
   * Toda transacción (Depósito, Retiro, Re-depósito, Recarga, Bóveda) debe afectar de forma atómica y coherente tanto el **INVENTARIO FÍSICO DE PIEZAS** (billetes y monedas en la charola) como los **SALDOS DIGITALES** (`yastasEfectivo`, `yastasTerminal`, etc.).
   * Garantiza que cada movimiento quede registrado en la Bitácora Inmutable con fecha, hora, tipo de operación, desglose de piezas físicas y metadatos (`redepExtraData`).
   * Maneja estados de validación en tiempo real y prevención de doble clic en botones de autorización para evitar duplicados.

3. **CONTROL OBLIGATORIO DE CACHÉ DE NAVEGADOR:**
   * Para evitar que el navegador del usuario ejecute código antiguo guardado en memoria, **cada modificación funcional en `app.js` DEBE actualizar de forma obligatoria el parámetro de versión en `index.html`** (ejemplo: `<script src="app.js?v=20260728_FIX"></script>`).

4. **PREVENCIÓN DE ERRORES EN HTML DINÁMICO (COMILLAS E IDS):**
   * Al generar contenido HTML mediante interpolación de cadenas JS (tablas, botones, modales), es OBLIGATORIO envolver los argumentos entre comillas simples `onclick="funcion('${id}')"` y aplicar conversiones explícitas `String(id)` en las funciones de búsqueda para prevenir errores silenciosos de sintaxis o tipo.

5. **PROTOCOLO DE DIAGNÓSTICO EN NAVEGADOR (PLAYWRIGHT), INTERCEPTACIÓN DE RED Y AISLAMIENTO DE BD:**
   * **Regla del 3er Intento:** Si un problema o fallo de UI persiste tras 2 intentos de corrección (o si el usuario reporta por 3ra vez el mismo problema), **QUEDA ESTRICTAMENTE PROHIBIDO SEGUIR ADIVINANDO O ASUMIENDO LA CAUSA**.
   * El agente DEBE ejecutar inmediatamente un test automatizado en navegador real headless (Playwright Chromium) sobre el entorno local.
   * **AISLAMIENTO OBLIGATORIO DE BD EN SIMULACIONES:** Toda prueba en Playwright que implique simulaciones de cierre de turno (`finalizarCierreNocturno`), borrados o mutación de saldos **DEBE INTERCEPTAR OBLIGATORIAMENTE LAS PETICIONES DE RED A SUPABASE (`page.route('**/*.supabase.co/**', ...)` o desactivar `syncToSupabase`)** o restaurar automáticamente el snapshot de la BD en un bloque `finally`. Queda **ESTRICTAMENTE PROHIBIDO** que un test automatizado altere la sesión activa (`session_active = true`) o sobrescriba los saldos reales (`caja_balances`) de producción en Supabase.
   * **LIMPIEZA DE SIMULACRO:** Al concluir la prueba en el navegador, el agente DEBE limpiar o restaurar los datos de prueba generados en el almacenamiento local (`localStorage` / `logs`), garantizando que **NO queden transacciones ficticias en la Bitácora real ni se alteren los saldos verdaderos del negocio**.

6. **RESETEO HOLÍSTICO DE UI:**
   * Toda función de reseteo (`limpiarDesglose`, etc.) debe borrar incondicionalmente tanto los valores de los inputs como **TODOS los elementos visuales auxiliares** (wrappers de resultado de cambio, calculadoras auxiliares, mensajes de error), devolviendo la interfaz a su estado inicial totalmente limpio.

7. **ESTÁNDAR DE ASISTENTES DE CAMBIO Y OPERACIÓN (AUTO Y MANUAL):**
   * Respeta la arquitectura de Asistentes Inteligentes en las operaciones:
     * **Sugerido (Auto):** Calcula y descuenta automáticamente de la caja las piezas óptimas según el stock disponible.
     * **Manual (Piezas):** Despliega la cuadrícula interactiva de denominaciones ($1000 a 50¢) para captura del operador y valida montos antes de autorizar.

8. **EFICIENCIA DE TOKENS Y MODIFICACIONES INCREMENTALES:**
   * Sé extremadamente eficiente. No realices lecturas masivas de bases de datos o código completo si no es necesario.
   * Aplica cambios únicamente mediante parches o fragmentos de código modificados (Lazy Retrieval / Incremental Edits). No reescribas archivos enteros de miles de líneas a menos que se solicite explícitamente.

9. **CONSERVACIÓN DE UI, SINCRONIZACIÓN DE RESPALDO Y AUDITORÍA:**
   * Respeta la estructura visual y responsiva (Tailwind CSS, Dark/Light Mode) sin alterar layouts existentes.
   * Sincroniza siempre las modificaciones en las versiones de respaldo correspondientes (`app.js` / `app_v3.js`).
   * Valida la sintaxis de JS (`js_validator.py`) antes de finalizar.

10. **NOTIFICACIÓN OBLIGATORIA DE HERRAMIENTAS Y DEPENDENCIAS FALTANTES:**
    * Si el agente detecta que falta una herramienta, software, binario o dependencia (como Node.js, evaluadores sintácticos, CLI de desarrollo o compiladores) necesaria para trabajar de forma más eficiente, rápida y garantizando la ausencia total de errores, **EL AGENTE DEBE NOTIFICARLO INMEDIATAMENTE AL USUARIO EN EL CHAT**.
    * El agente explicará de forma clara el propósito de la herramienta y esperará a que el usuario determine si la instala o autoriza su configuración.

---

## PARTE III: PROTOCOLO ESTRICTO DE SUBAGENTES POR BLOQUES Y AUTORIZACIÓN PREVIA

### 📌 Módulo de 6 Bloques, Garantías y Condicionales de Subagentes
El sistema POS "La Central" está dividido en 6 Bloques aislados. Cada modificación debe asignarse a 1 solo sub-bloque y cumplir la garantía de no afectación:

1. **Bloque 1: `apertura-gatekeeper`** (Apertura de Turno, Pre-carga y Alerta Gatekeeper).
   - *Funciones*: `intentarIniciarTurno`, `evaluarGatekeeper`, `solicitarPreCargaNocturna`.
   - *Condicionales/Garantía*: **PROHIBIDO** modificar transacciones de charola, bitácora, Bóveda o saldos de plataformas.
2. **Bloque 2: `charola-calculadora`** (Charola de Efectivo Físico y Calculadora Flotante).
   - *Funciones*: `construirInputsDesglose`, `limpiarDesglose`, Asistente de Cambio, Widget Calculadora.
   - *Condicionales/Garantía*: **PROHIBIDO** modificar cierres de turno o lógica de base de datos.
3. **Bloque 3: `plataformas-financieras`** (Módulos independientes de corresponsalías y servicios financieros).
   - *3.1 Yastás*: Edición aislada de transacciones, recargas, depósitos y saldos (Efectivo y Terminal) de Yastás. **PROHIBIDO** tocar otros servicios.
   - *3.2 Mercado Libre (Meli)*: Edición aislada de Tienda vs. Negocio, Saldo Terminal y Saldo Base de Meli. **PROHIBIDO** tocar otros servicios.
   - *3.3 Banorte*: Edición aislada de transacciones Banorte y acumulado inicial heredable. **PROHIBIDO** tocar otros servicios.
   - *3.4 T-Conecta y Banamex*: Edición aislada de Disponible Terminal, Cuenta Banamex y Lápiz de edición de saldo base. **PROHIBIDO** tocar Bóveda, Yastás o Meli.
   - *3.5 Sistema Híbrido (Capital)*: Edición aislada de Fondo y Capital de Trabajo. **PROHIBIDO** tocar Bóveda o Cierres.
   - *3.6 Bóveda*: Edición aislada de `abrirModalBoveda()`, traslados entre charola y bóveda, e `inventoryBoveda`. **PROHIBIDO** tocar T-Conecta, Meli, Banorte o recargas.
   - *3.7 BBVA y Transferencias*: Edición aislada de Retiros BBVA y movimientos por transferencia bancaria. **PROHIBIDO** tocar otros servicios.
   - *Condicionales/Garantía General*: Edición estricta y aislada únicamente del servicio indicado en la instrucción. **PROHIBIDO** modificar pantallas de apertura o cierres nocturnos.
4. **Bloque 4: `cierre-reportes`** (Conteo Físico de Cierre, Firma con PIN y Reportes `cierre_reports`).
   - *Funciones*: `firmarYCerrarTurno`, `finalizarCierreNocturno`, guardado en `cierre_reports`.
   - *Condicionales/Garantía*: Preserva de forma obligatoria e inalterable los saldos acumulativos (`banorte`, `meli`, `tconectaTerminal`, `banamex`).
5. **Bloque 5: `bitacora-historico`** (Tabla de Bitácora, Filtros y Formatos de Fecha Cross-Browser).
   - *Funciones*: `cargarBitacora`, `renderizarReporteVisual`, `getLogMs`, filtros de tabla.
   - *Condicionales/Garantía*: **PROHIBIDO** modificar saldos en vivo, inventarios físicos o estado de sesión.
6. **Bloque 6: `supabase-sync`** (Persistencia en Nube y Sincronización Real-Time).
   - *Funciones*: `fetchInitialFromSupabase`, `syncToSupabase`, `suscribirseARealtimeSupabase`.
   - *Condicionales/Garantía*: **PROHIBIDO** modificar elementos de diseño HTML, estilos o modales de la interfaz.

---

### 📌 Mapeo Estricto de Líneas por Sub-bloque en `app.js`

| Subagente / Bloque | Rango de Líneas en `app.js` | Funciones y Módulos Asignados |
| :--- | :--- | :--- |
| 🟢 **`apertura-gatekeeper`** | Línea 1893<br>Línea 8481 | `intentarIniciarTurno()`, `evaluarGatekeeper()` |
| 🔵 **`charola-calculadora`** | Línea 936<br>Línea 1068 | `construirInputsDesglose()`, `limpiarDesglose()` |
| 🟣 **`plataformas-financieras`** | Líneas 2088 - 3676 | Módulos de Corresponsalías y Servicios (Sub-bloques 3.1 a 3.7) — *rango general confirmado por comentarios de sección; el desglose fino por sub-bloque 3.1-3.3/3.5/3.7 está pendiente de re-verificación línea por línea* |
| └ *3.4 T-Conecta / Banamex (Lápiz)* | Línea 4310 (`abrirAjusteSaldoTConecta`)<br>Línea 4331 (`guardarAjusteSaldoTConecta`) | Ajuste de saldo base T-Conecta/Banamex, registrado como `AJUSTE_DE_SALDO` en bitácora |
| └ *3.6 Bóveda* | Línea 8221 | `calcularBovedaOperacion()` — **corrección:** `abrirModalBoveda()` no existe en el código; la Bóveda se accede vía el patrón general `seleccionarServicioCard('capital')` / tarjeta `card-capital`, no por un modal dedicado |
| 🟡 **`cierre-reportes`** | Línea 7560 (`firmarYCerrarTurno`)<br>Línea 8540 (`finalizarCierreNocturno`) | Cierre en 1 solo paso (ver Sección 3 arriba). `solicitarPreCargaNocturna()` (línea 8531) es código huérfano sin llamadas — pantalla Paso 2 ya no se usa. |
| 🟠 **`bitacora-historico`** | Línea 4563 (`cargarBitacora`)<br>Línea 4625 (`getLogMs`) | Comentario de sección: línea 4462 |
| 🔴 **`supabase-sync`** | Líneas 149 - 730 (sección completa "PERSISTENCIA LOCAL Y CACHÉ...") | `syncToSupabase()` línea 163, `fetchInitialFromSupabase()` línea 260, `suscribirseARealtimeSupabase()` línea 516 |

---

### 🔍 REGLA DE VERIFICACIÓN Y SINCRONIZACIÓN DINÁMICA DE MÓDULOS
1. **Inspección autoritativa antes de editar**: El código fuente real (`app.js` e `index.html`) siempre tiene precedencia. Antes de ejecutar cualquier cambio, el subagente DEBE verificar la existencia real del módulo.
2. **Protocolo ante eliminación/modificación manual por el usuario**: Si el usuario eliminó o reestructuró una sección del código y esta ya no existe, el agente **NO intentará restaurarla ni asumirá su presencia**. El agente notificará al usuario:
   > *"Atención: El módulo/función [X] fue eliminado en el código fuente. Se actualizará la Ficha y el Mapa en AGENTS.md."*
3. **Actualización del Mapa**: En caso de cambios estructurales hechos por el usuario, el archivo `AGENTS.md` se actualizará de inmediato para reflejar la nueva distribución exacta del código.

---

### 🛡️ PROTOCOLO DE AUTORIZACIÓN PREVIA OBLIGATORIO (EN CADA SOLICITUD)
Antes de realizar cualquier edición de código en `app.js`, `app_v3.js` o `index.html`, el agente DEBE presentar en el chat la siguiente Ficha de Autorización y ESPERAR la aprobación explícita del usuario:

```
📌 Subagente Activo: [Nombre del Subagente / Sub-bloque]
📄 Archivo y Líneas: [Rango exacto de líneas]
🎯 Cambio Solicitado: [Descripción precisa del cambio]
⛔ Líneas protegidas: Todo el resto del archivo (Módulos no solicitados intocados)
```

**ESTRICO CUMPLIMIENTO**: Queda strictly prohibido realizar modificaciones antes de recibir el "Aprobado" u "OK" del usuario a la Ficha de Autorización.

---

### 📝 Registro de Cambios al Documento

**2026-08-03 — Limpieza de código muerto + corrección de Secciones 3 y 4 (Claude Code):**
* Se eliminaron 11 funciones huérfanas sin ningún punto de llamada en `app.js`/`app_v3.js` (autorizadas explícitamente por el usuario): `solicitarBorradoMonto`, `cerrarAnexarCapital`, `construirGridsAnexarCapital`, `abrirModalAjustarAlertas`, `cerrarModalAjustarAlertas`, `guardarAlertasStock`, `cargarSimulacion`, `cerrarCierreCajaModal`, `mapearFilaANubeReporte`, `cargarBilletesAyer`, `cambiarDevolucionRetiro`. Se validó sintaxis con `js_validator.py` y se mantuvo sincronía perfecta entre `app.js` y `app_v3.js`.
* Se corrigieron las Secciones 3 y 4 de este documento: el usuario confirmó que el Paso 2 de pre-carga nocturna y el auto-llenado de la apertura matutina (`precarga_completada`) fueron solicitados para eliminarse anteriormente. El código ya reflejaba esa realidad (funciones huérfanas); el documento no.
* Se corrigió el Mapa de Líneas: varias funciones se recorrieron por la limpieza, y se detectó que `abrirModalBoveda()` (referenciada en el mapa original) nunca existió en el código real.
* **Pendiente:** el desglose fino de líneas para los sub-bloques 3.1 (Yastás), 3.2 (Meli), 3.3 (Banorte), 3.5 (Capital) y 3.7 (BBVA) no se re-verificó a detalle en esta pasada — el rango general (2088-3676) es confiable, pero los sub-rangos individuales de la tabla anterior ya estaban desactualizados desde antes de este cambio.
* **Bugs identificados y aún NO corregidos** (ver auditoría completa en la conversación): (1) posible condición de carrera entre `localStorage` y la carga inicial desde Supabase al abrir la página — causa más probable de saldos/valores que aparecen y se borran solos, y de sesiones que parecen "cerrarse" pidiendo recapturar datos, especialmente justo después de una recarga completa de página; (2) posible cruce de fecha/hora en la bitácora cuando dos operaciones comparten monto+categoría+operador, incluso en fechas distintas (el sistema busca coincidencias en todo el historial, no solo el día en curso).

**2026-08-03 (mismo día) — Eliminación de la alerta de Gatekeeper no funcional (decisión explícita del usuario):**
* El usuario decidió, siendo consciente de las implicaciones, **eliminar** (no arreglar) la funcionalidad de "alerta bloqueante si el turno anterior quedó abierto" descrita en la Sección 2, ya que nunca funcionó y no es prioridad ahora mismo.
* Se eliminó el modal `modal-gatekeeper-alerta` de `index.html`, la función `forzarCierreTurnoPendiente()` de `app.js`/`app_v3.js`, y las referencias a ese modal dentro de `evaluarGatekeeper()`.
* **Nota:** la Sección 2 de este documento ("Si el turno anterior sigue ABIERTO: Desplegar una alerta bloqueante...") ya **no refleja el comportamiento real** — actualmente no hay ninguna advertencia si un turno queda sin cerrar. Queda pendiente decidir si se reescribe esa sección o si se retoma esta función más adelante.

**2026-08-03 (mismo día) — Corrección de la condición de carrera Supabase vs. localStorage (3 escenarios):**
* **Carga de página (bootstrap):** `DB.init()` y `window.onload` ahora son `async` y usan `await fetchInitialFromSupabase()` antes de evaluar `sessionActive` o dibujar cualquier pantalla. Antes, la app decidía con lo último guardado en `localStorage` de ESE dispositivo (a veces obsoleto) y corregía después al llegar la respuesta real de Supabase — causando saldos/valores que aparecían y luego se borraban solos, y en casos peores, sesiones que parecían "cerrarse" y pedían recapturar todo. Líneas afectadas: 649-733 aprox.
* **Edición simultánea multi-dispositivo:** el listener de tiempo real para `caja_state` (dentro de `suscribirseARealtimeSupabase()`, línea ~521) ahora respeta `isUserTyping()` antes de forzar un refresco de pantalla — mismo patrón que ya existía para `caja_balances`, aplicado también aquí. Si otro dispositivo cambia el estado del turno mientras el operador está capturando algo activamente, ya no se le pisa la pantalla ni se le borra lo que lleva escrito.
* **Reconexión tras pérdida de internet (ej. tablet/iPad que anda offline y luego recupera señal):** se agregó `window.addEventListener('online', ...)` que muestra un aviso ("Conexión restablecida. Actualizando información...") y recarga la página automáticamente tras 1.5s. Esto evita que datos obsoletos guardados durante el tiempo sin conexión sobrescriban información más nueva capturada en otros equipos mientras tanto. No afecta equipos con conexión estable (nunca dispara este evento).
* Validado: sintaxis OK en ambos archivos, `app.js`/`app_v3.js` siguen idénticos, prueba visual en navegador sin errores de consola ni comportamiento inesperado al cargar con turno activo real.

**2026-08-03 (mismo día) — Corrección del cruce de fecha/hora en la Bitácora:**
* En `fetchInitialFromSupabase()` (línea ~438), el emparejamiento por contenido local (monto+categoría+operador) que recuperaba fecha/hora ya **solo se aplica cuando el timestamp remoto es inválido o pertenece al lote histórico corrupto conocido** (`2026-07-24T15:06`). Con timestamp remoto normal (el caso de prácticamente todos los registros nuevos), la fecha/hora ya calculada directamente del timestamp real ya NO se sobreescribe.
* Antes, este emparejamiento se aplicaba SIEMPRE, buscando coincidencias en **todo el historial** (no solo el día en curso), causando que operaciones con el mismo monto+categoría+operador en fechas distintas se cruzaran la fecha/hora entre sí.
* Confirmado visualmente en producción real: la primera página de la Bitácora (10 registros más recientes) ahora baja en orden cronológico perfecto, sin saltos.

**2026-08-03 (mismo día) — Segunda corrección: el timestamp usado para ORDENAR no se actualizaba junto con la fecha/hora mostrada:**
* Hallazgo del usuario en pantalla real: 3 registros del lote histórico corrupto (2026-07-24T15:06) mostraban fecha/hora recuperada correcta y creíble, pero seguían apareciendo hasta el final de toda la lista (54 registros) sin importar su hora mostrada.
* Causa: el fix anterior corregía `dateStr`/`timeStr` (lo que se ve en pantalla) al detectar un timestamp sospechoso, pero el campo `timestamp` interno del objeto — el que usa `getLogMs()` para ordenar — seguía siendo el original corrupto de julio. Resultado: pantalla correcta, orden incorrecto (el registro se sigue tratando como si fuera de hace más de una semana).
* Corrección: al recuperar fecha/hora por coincidencia local, ahora también se recalcula `correctedTimestamp` (usando el timestamp del match local si es válido, o derivándolo de la fecha/hora recuperada vía `parseLocalDateAndTime`), y ese es el valor que se guarda en `logObj.timestamp`.
* Confirmado visualmente en producción real, los 3 registros que antes quedaban al final de los 54 registros totales ahora aparecen en su posición cronológica correcta.

**2026-08-03 (mismo día) — Tercera corrección: priorizar coincidencia por ID único (UUID) sobre monto+categoría+operador:**
* Análisis del respaldo completo (740 registros, `caja_logs.json`): 246 registros pertenecen al lote histórico corrupto (`2026-07-24T15:06`). Ninguno tiene ID (UUID) duplicado — cada uno es único e inequívoco. Pero 85 combinaciones de monto+categoría+operador tienen MÁS DE UN registro corrupto (ej. 9 "Cierres de Miguel por $0" indistinguibles entre sí por contenido), dejando margen real de cruce con el emparejamiento anterior.
* Corrección en `fetchInitialFromSupabase()` (línea ~416): se agregó `localLogsByIdMap` (mapa por UUID exacto). Ahora, para registros con timestamp sospechoso, se intenta PRIMERO la coincidencia por ID único (inequívoca, nunca se confunde) y solo si no existe, se usa el respaldo anterior por contenido.
* Los movimientos capturados de hoy en adelante nunca pasan por este mecanismo (nacen con timestamp correcto), así que están protegidos desde su creación, sin depender de ningún emparejamiento.
* Validado: sintaxis OK, `app.js`/`app_v3.js` sincronizados, prueba visual en producción real sin regresiones (primera página de bitácora sigue en orden correcto).

**2026-08-04 — Indicador de sincronización pendiente (no bloqueante), decisión explícita del usuario:**
* Nueva funcionalidad: cuando `syncToSupabase()` falla (ej. corte de red durante una operación), la operación se sigue completando localmente sin ningún bloqueo — solo se marca esa `key` (`balances`/`inventory`/`inventoryBoveda`/`logs`/`state`/`cierre_reports`) como pendiente en `pendingSyncKeys` (persistido en `localStorage` bajo `lc5_pending_sync`), y aparece un badge ámbar junto a "Turno Activo" en el header (`sync-pendiente-badge`, index.html) mostrando cuántas claves siguen sin subir.
* Al recuperar conexión (`window.addEventListener('online', ...)`), ahora primero se llama `reintentarSincronizacionPendiente()` (reenvía cada key pendiente con su valor local más actual) y solo después se recarga la página — así los cambios pendientes llegan a Supabase antes de que la recarga traiga el estado "oficial" de la nube.
* **Bug lateral corregido de paso:** en el sync de `logs`, el flag `l._synced = true` se marcaba ANTES de confirmar el envío a Supabase, no después. Si el `insert` fallaba, los logs quedaban marcados como sincronizados sin haberlo estado realmente — un reintento futuro los habría ignorado creyendo que ya estaban subidos, perdiendo la transacción en silencio. Se movió el marcado a después del `await` exitoso.
* Funciones nuevas: `marcarPendienteSync()`, `marcarSincronizado()`, `actualizarBadgeSincronizacion()`, `reintentarSincronizacionPendiente()` (todas en el bloque `supabase-sync`, cerca de línea 163).
* Validado: sintaxis OK, `app.js`/`app_v3.js` sincronizados, badge probado en vivo (aparece al marcar pendiente, desaparece limpio sin residuo en `localStorage` al confirmar sincronizado).
* **Bug encontrado y corregido durante la prueba:** el HTML del badge usaba `class="hidden sm:flex ..."` (copiado del patrón de `cajero-badge`) — en pantallas de escritorio, `sm:flex` le gana a `hidden` por el orden de las reglas generadas por Tailwind, dejando el badge visible aunque el contador fuera 0. Se corrigió a `class="hidden flex ..."` (sin el prefijo `sm:`). **Nota:** `cajero-badge` (el de "Turno Activo") usa el mismo patrón original y podría tener el mismo problema latente — no se tocó porque no fue lo solicitado, pero queda anotado por si se quiere revisar después.

**2026-08-04 (mismo día) — Triángulo de aviso por fila en la Bitácora, a petición del usuario:**
* Cada fila de la Bitácora (`cargarBitacora()`, tablas "Vista de Saldos" y "Vista de Piezas") ahora muestra un ícono de triángulo de alerta (ámbar, `data-lucide="triangle-alert"`) junto a la fecha cuando `log._synced` es falso — es decir, ese movimiento específico todavía no se confirma subido a Supabase.
* Se reutiliza el flag `_synced` que ya existía en cada registro (los que vienen de Supabase o ya se sincronizaron con éxito lo traen en `true`; los recién capturados localmente nacen sin él hasta confirmarse).
* `marcarSincronizado('logs')` ahora también refresca la Bitácora automáticamente para que el triángulo desaparezca en cuanto se confirma la subida, sin que el operador tenga que hacer nada.
* Validado en producción real: se inyectó una fila de prueba solo en memoria (sin `DB.set`, nunca tocó Supabase ni localStorage) para confirmar visualmente el triángulo, y se retiró sin dejar residuo.

