# Notas pendientes (bugs en observación)

Problemas reportados que **no se han corregido** todavía. Se dejan aquí por si se repiten.

---

## Valor fantasma en campos de Yastas (ej. `694`)

- **Reportado:** 2026-09-28 · Navegador: **Edge**
- **Estado:** en observación, sin corrección aplicada.

**Síntoma:** después de refrescar la pantalla y entrar a Yastas, un campo de monto aparece con un valor (`694`) que nadie escribió.

**Antecedentes:** mismo tipo de falla que el valor fantasma `1210` en "Monto del Depósito". Ya se intentó corregir dos veces:
1. `autocomplete="off"` en los campos de monto.
2. Commit `44c5124`: recarga limpia al restaurar desde bfcache (`pageshow` con `event.persisted`).

**Lo que ya se descartó en el código (`app.js`):**
- Al cargar, `refrescarPantallas()` llama a `limpiarDesglose(true)`, que vacía `op-cambio-deposito`, `op-retiro-monto`, `op-recarga-monto`, `op-monto-manual`, `redep-monto-*` y la charola.
- Al entrar a Yastas, `actualizarFormularioOperacion()` vuelve a llamar a `limpiarDesglose(true)`.
- Ningún código escribe un monto calculado en esos campos. La única copia es `actualizarMontoRecarga()` (Recarga → Depósito), y solo copia lo que se tecleó en ese momento.
- La extensión `yastas-extension` no toca los campos de la caja (`bridge.js` no escribe inputs).

**Sospecha principal:** autollenado o restauración de formularios de Edge, que pone el valor **después** de la limpieza de la app.

**Datos a recopilar si se repite:**
1. Captura del campo exacto con el valor.
2. Si ese monto se había tecleado antes de refrescar (operación sin terminar o ya registrada).
3. Si aparece al entrar a Yastas o al dar clic en el campo (y si sale una lista de sugerencias debajo).

**Campos que aún no tienen `autocomplete="off"`** (posibles candidatos si se confirma que es el navegador): `op-service` (select), `apertura-yastas`, `op-nombre-vale`.
