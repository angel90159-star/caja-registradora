# Instrucciones para Claude Code: Integración del Modal de Encuadre Yastás

**Fecha:** 12 de septiembre de 2026  
**Referencia:** Complemento a `.agents/PLAN_YASTAS_ENCUADRE.md` y `.agents/AGENTS.md`  
**Prototipo visual terminado y validado con el usuario:** [`encuadre_mockup.html`](../encuadre_mockup.html)

---

## 🎯 Objetivo de esta tarea
Integrar la ventana de **Encuadre de Conciliación Diaria (Portal Yastás vs. Caja Registradora)** en el sistema POS ("La Central") en `index.html`, `app.js` y `app_v3.js`.

El diseño, estructura y reglas de interacción ya fueron aprobados por Miguel Ángel y están totalmente codificados y probados en el archivo local `encuadre_mockup.html`.

---

## 👵 Perfil de Usuario Obligatorio (Target UX)
La persona que opera principalmente la caja en este turno es una **mujer de 63 años con conocimientos básicos de computación**, atendiendo un volumen de **más de 50 operaciones diarias**.

### Decisiones de diseño ya validadas en `encuadre_mockup.html`:
1. **Espacio vertical liberado:** La tabla técnica de *"Cómo se cruza cada movimiento"* está oculta por defecto detrás del botón `[ ℹ️ ¿Cómo calcula el cruce? ]`, abriéndose en un `<dialog>` modal solo si se requiere.
2. **Diagnóstico Humano Inmediato (Cero estrés):** En la parte superior hay un banner que explica en español llano el estado del día:
   - Si todo cuadra: *"🎉 ¡Excelente! Todo cuadró al centavo hoy. Las X operaciones registradas en caja coinciden exactamente con la terminal Yastás."*
   - Si hay diferencias: *"⚠️ Atención: Se detectó 1 diferencia de dinero. 10 operaciones cuadraron exactas al centavo. Revisa la fila resaltada en amarillo ($3.40 de diferencia)."*
3. **Manejo de 50+ operaciones con Botones Filtro de 1 Clic:** Las tarjetas KPI (`Ver Todo`, `Con Diferencia`, `Solo en Portal`, `Solo en Caja`, `Cuadran Exacto`, `Recargas`) funcionan como botones de filtro instantáneo. La cajera no tiene que hacer scroll entre 50 filas: da 1 clic a `[ ⚠️ Con Diferencia (1) ]` y la tabla se reduce a esa única fila.
4. **Accesibilidad y Alto Contraste (WCAG AAA):**
   - **Bselector de Modo Claro / Oscuro (`☀️ Modo Claro` / `🌙 Modo Oscuro`):** Para vista cansada con luz de día en mostrador, el fondo blanco con letras negras profundas `#0F172A` se lee al instante.
   - **Modo Oscuro nítido:** En modo oscuro, los números son brillantes (verde esmeralda, amarillo oro, rosa coral, lila) y todos los textos secundarios usan blanco plateado `#E2E8F0`. **Prohibido usar grises oscuros o apagados** que dificulten la lectura.
   - **Selector de tamaño de letra:** Botones `[ A ] [ A+ ]` para ampliar la tipografía a 1.18rem.
5. **Tabla Unificada de Lectura Rápida:**
   - Columnas: `Hora / Cajero` (con avatar de inicial), `Concepto de la Operación`, `Portal Yastás`, `Caja Registradora`, `Resultado del Cruce`.
   - Filas con diferencia resaltadas en color ámbar suave con borde lateral visible.
   - Botón de acción directa en la fila: `[ ⚡ Ajustar $X.XX en caja ]`.

---

## 🛠️ Especificación de Implementación

### 1. `index.html`
* Integrar la estructura del modal `#modal-encuadre-yastas` (o incrustarlo en la pestaña correspondiente de Yastás) tomando como base exacta el marcado de `encuadre_mockup.html`.
* Incluir los estilos CSS correspondientes a los modos claro/oscuro y los controles de contraste.
* Actualizar el parámetro de versión del script: `<script src="app.js?v=20260912_ENCUADRE"></script>`.

### 2. `app.js` y `app_v3.js` (Sincronía estricta)
* **Función para abrir el modal:** `abrirModalEncuadreYastas(fecha)`.
* **Alimentación de datos:**
  - Extraer los movimientos de caja de la fecha dada desde `caja_logs` (categorías `YASTAS`, `YASTAS_RECARGA`, `YASTAS_GETNET`, `RE-DEPÓSITO`).
  - Obtener las transacciones del portal correspondientes a esa fecha (cargadas vía la extensión de Yastás o archivo JSON/XLSX importado).
  - Ejecutar el motor de encuadre de 5 pasos definido en `PLAN_YASTAS_ENCUADRE.md` y `encuadre_mockup.html`.
* **Acción de Auto-Ajuste:**
  - Al presionar `[ ⚡ Ajustar $X.XX en caja ]`, registrar un movimiento de tipo `AJUSTE_DE_SALDO` en `caja_logs` especificando la diferencia y el operador responsable, sincronizando con Supabase.
* **Recargas Telefónicas:**
  - Mostrar la sección de recargas con el comparativo `Total Portal` vs `Cobrado en Caja`, alertando si hay recargas huérfanas.

### 3. 🧹 Depuración Automática Post-Carga (Limpieza estricta)
* **Eliminación del archivo físico descargado:** Tan pronto como la extensión lea el XLSX y lo suba con éxito a Supabase, debe ejecutar `chrome.downloads.removeFile(downloadId)` para **eliminar automáticamente el archivo `Reporte de Movimientos.xlsx` del disco**. Esto evita saturar la carpeta de Descargas con archivos duplicados diarios y protege la privacidad bancaria.
* **Depuración de datos sensibles en BD:** Al procesar las filas, descartar números de cuenta completos y referencias privadas. Solo persistir los campos indispensables para el encuadre (monto, hora, servicio, tipo y ganancia).
* **Filtro de asientos internos:** Marcar o excluir de la conciliación los traspasos automáticos de fondeo (`COBRO DE CUENTA DE FONDEO`), para que no contaminen las cuentas de clientes.

---

## ⛔ Reglas Críticas de Desarrollo (AGENTS.md)
1. **PROHIBIDO GIT PUSH AUTOMÁTICO:** No ejecutar `git push` bajo ninguna circunstancia sin autorización explícita de Miguel Ángel en el chat.
2. **FICHA DE AUTORIZACIÓN PREVIA:** Presentar la Ficha de Autorización indicando el sub-bloque activo (Bloque 3.1 Yastás / Bloque 5 Bitácora) y rangos de líneas antes de aplicar modificaciones a `app.js`.
3. **VALIDACIÓN SINTÁCTICA:** Ejecutar obligatoriamente `python3 js_validator.py` tras editar `app.js` y `app_v3.js`.
4. **SIMETRÍA OBLIGATORIA:** Mantener idénticos los cambios entre `app.js` y `app_v3.js`.


---

## ⚠️ Actualización 2026-09-13 (Claude Code) — qué de este documento ya cambió
El Bloque 1 quedó integrado en la app (ver entrada 2026-09-13 en `AGENTS.md`). Las reglas decididas con el usuario después de escribir este documento **sustituyen** a lo siguiente:
* "Motor de 5 pasos" → motor de 7+ pasos con **ganancia unificada** (la terminal se mueve por `Monto Total`; la diferencia contra lo que la caja cargó es ganancia: recargas, vales/ODP) y **errores de captura** (dígito faltante/sobrante, ceros/punto, dígitos al revés, sentido invertido, dos-en-una, duplicado, otra cuenta). **Nunca porcentajes.**
* Banner "Se detectó 1 diferencia de dinero ($3.40)" → ese $3.40 (vale/ODP) es **ganancia**, no diferencia: "Todo cuadra. Hay $3.40 de ganancia por pasar a la terminal". El banner distingue ganancia / otra hora / errores / sin pareja / faltante.
* KPIs `Con Diferencia / Solo en Portal / Solo en Caja` → `Por ajustar / Errores de captura / Sin pareja`.
* Botón por fila `⚡ Ajustar $X en caja` → **un solo** `⚡ Ajustar Terminal Yastás +$X` por día (incremental, firmado con PIN). Los botones por fila para errores de captura son el **Bloque 3**.
* Recargas: tres cifras (cobrado en caja / descontado en terminal / utilidad); se cruzan por `Monto Operación`; vienen como `RECARGA DE TIEMPO AIRE`.
* "Prototipo validado `encuadre_mockup.html` (raíz)" → tiene el motor viejo (las recargas ni entraban al cruce). La fuente de verdad es `yastas-extension/docs/encuadre_2026-09-10.html`, `_09-12.html` y `_DEMO-errores.html` (mismo motor que `app.js`).
