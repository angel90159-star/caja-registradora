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
   * Sé directo y conciso. Explica brevemente qué cambiaste y el impacto en las cuentas. Si detectas riesgo de descuadre contable, **ADVIÉRTELO PRIMERO**.
