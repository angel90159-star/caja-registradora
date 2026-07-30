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
* **Sincronización y Validación:** Aplicar exactamente las mismas modificaciones en `app.js` y `app_v3.js`. Actualizar el parámetro de versión del script en `index.html` (ejemplo: `app.js?v=20260728_FIX`) para romper la caché del navegador y ejecutar `js_validator.py` antes de autorizar el despliegue.

---

### 2. Bloqueo de Interfaz (Gatekeeper) y Detección de Turnos
Al autenticarse el usuario con su PIN:
* **Consulta de estado:** El sistema verifica inmediatamente en la BD el estado del turno previo.
* **Si el turno anterior sigue `ABIERTO`:** Desplegar una alerta bloqueante e infranqueable: *"Atención: El turno del día anterior no fue cerrado formalmente. Por favor realiza el cierre para continuar."*
* **Si el turno anterior está `CERRADO`:** Activar el **Gatekeeper** (bloquear completamente el acceso a la interfaz principal, menú, ventas, cobros y movimientos) y forzar la pantalla/modal de **Apertura de Turno**.

---

### 3. Cierre Nocturno y Pre-carga Opcional (Flujo en 2 Pasos)
* **Paso 1: Cierre Definitivo de Turno:**
  * El operador firma e ingresa su PIN.
  * Se guarda en la BD: `turno_estado = CERRADO`.
* **Paso 2: Pre-carga de Fondo Base (Opcional):**
  * Se despliega la pantalla para registrar el dinero que permanecerá en caja para el día siguiente.
  * **Botón "Omitir y Salir":** Si el operador no desea hacer la pre-carga, al dar clic el sistema guarda `precarga_completada = false` en la BD, destruye la sesión de forma asíncrona y redirige al Login.
  * **Botón "Guardar Pre-carga":** Se guarda el desglose físico y saldos digitales, registrando `precarga_completada = true` en la BD, seguido del `logout`.

---

### 4. Pantalla de Apertura Matutina (Gatekeeper en Acción)
Al iniciar sesión con estado `CERRADO`, la pantalla de Apertura evaluará la bandera `precarga_completada`:
* **Escenario A: `precarga_completada = true` (Con Pre-carga)**
  * Se despliegan los campos pre-llenados con la captura nocturna (Efectivo por denominación y saldos digitales).
  * **Acción rápida:** Si el dinero físico coincide, el operador autoriza con 1 solo clic en **"Confirmar e Iniciar Turno"**.
* **Escenario B: `precarga_completada = false` (Sin Pre-carga / Omitido)**
  * La pantalla de Apertura se despliega totalmente en blanco (`$0.00`).
  * El operador debe realizar el conteo físico, capturar saldos de plataformas y presionar **"Registrar e Iniciar Turno"**.
* **Manejo de Discrepancias:** Si los valores físicos no coinciden con la pre-carga nocturna, el operador modifica los montos, captura de manera obligatoria una **Nota de Observación** y presiona **"Registrar Apertura con Observación"** (registrando la evidencia en la bitácora inmutable con usuario y sello de tiempo).

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

5. **PROTOCOLO DE DIAGNÓSTICO EN NAVEGADOR (PLAYWRIGHT) Y LIMPIEZA DE SIMULACRO:**
   * **Regla del 3er Intento:** Si un problema o fallo de UI persists tras 2 intentos de corrección (o si el usuario reporta por 3ra vez el mismo problema), **QUEDA ESTRICTAMENTE PROHIBIDO SEGUIR ADIVINANDO O ASUMIENDO LA CAUSA**.
   * El agente DEBE ejecutar inmediatamente un test automatizado en navegador real headless (Playwright Chromium) sobre el entorno local.
   * La prueba simulará el flujo completo del usuario, capturará la consola de JavaScript (`console.error`, `pageerror`, `ReferenceError`), evaluará la visibilidad real del DOM y justificará la corrección únicamente con la traza de error capturada en vivo.
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
| 🟢 **`apertura-gatekeeper`** | Líneas 1890 - 1940<br>Líneas 8790 - 8840 | `intentarIniciarTurno()`, `evaluarGatekeeper()` |
| 🔵 **`charola-calculadora`** | Líneas 1430 - 1510<br>Líneas 1618 - 1750 | `limpiarDesglose()`, asistencias, Widget Calculadora |
| 🟣 **`plataformas-financieras`** | Líneas 1530 - 2300<br>Líneas 8200 - 8450 | Módulos de Corresponsalías y Servicios (Sub-bloques 3.1 a 3.7) |
| └ *3.1 Yastás* | Líneas 2020 - 2080 | Lógica Yastás (Efectivo y Terminal) |
| └ *3.2 Mercado Libre* | Líneas 2080 - 2150 | Tienda / Negocio (Terminal y Saldo Base) |
| └ *3.3 Banorte* | Líneas 2150 - 2200 | Transacciones y Saldos Banorte |
| └ *3.4 T-Conecta / Banamex* | Líneas 1530 - 1550<br>Líneas 4300 - 4315 | Disponible Terminal, Banamex y Lápiz de edición |
| └ *3.5 Sistema Híbrido (Capital)* | Líneas 2200 - 2260 | Fondo / Capital de Trabajo |
| └ *3.6 Bóveda* | Líneas 8200 - 8450 | `abrirModalBoveda()`, traslados entre charola y bóveda |
| └ *3.7 BBVA / Transferencias* | Líneas 2260 - 2300 | Retiros BBVA / Transferencias bancarias |
| 🟡 **`cierre-reportes`** | Líneas 7660 - 7790<br>Líneas 8885 - 8960 | `firmarYCerrarTurno()`, `finalizarCierreNocturno()` |
| 🟠 **`bitacora-historico`** | Líneas 4496 - 4740 | `cargarBitacora()`, `getLogMs()` |
| 🔴 **`supabase-sync`** | Líneas 160 - 310<br>Líneas 463 - 605 | `syncToSupabase()`, Real-time |

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


