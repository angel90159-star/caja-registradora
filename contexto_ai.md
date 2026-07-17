# Contexto del Proyecto: Sistema de Caja Registradora (visa.xlsm)

**Última actualización:** 25 de Junio 2026

Este archivo sirve como "memoria" para la Inteligencia Artificial. Si estás leyendo esto desde un chat nuevo (ya sea en Mac o Windows), carga este contexto para saber exactamente en qué punto nos quedamos y cómo funciona el proyecto sin tener que volver a analizar todo el código desde cero.

## 📌 Datos Generales
*   **Archivo Principal:** `visa.xlsm`
*   **Contraseña del proyecto VBA / Hoja:** `12`
*   **Objetivo:** Funciona como un sistema de caja registradora, control de efectivo y Terminal Punto de Venta simulado.

## ⚙️ Funcionamiento y Lógica Clave (Ya analizada)
1.  **Inventario en Tiempo Real:** El código escanea la hoja "billetes" para calcular cuántas denominaciones (desde $1000 hasta $1) hay físicamente en la caja.
2.  **Operaciones Mapeadas:**
    *   **N4 (Transferencia):** Activa `UserForm13`. Mueve dinero digitalmente.
    *   **N5 (Anexar):** Activa `UserForm12`. Añade efectivo a la caja, requiere desglose en M13.
    *   **N6 (BBVA):** Activa `UserForm11`. Pago/Retiro de tarjeta. Exige que haya piezas suficientes.
    *   **N8 (Banorte):** Activa `UserForm10`. Registra ventas electrónicas (fondo de colores en hoja).
    *   **M7, M8, M9 (Efectivo Tradicional):** Activan `UserForm3, 2, 1`. Si hay cambio obligatorio, activa el "Modo Cambio" que obliga al operador a desglosar exactamente lo que le dará al cliente antes de continuar.
3.  **Candados Anti-Negativos:** El sistema bloquea operaciones si el operador intenta entregar un cambio o hacer un retiro en efectivo de piezas que no existen en el inventario real.
4.  **Usuarios y Seguridad (Códigos de 2 dígitos):**
    *   `20`: Ingrid
    *   `64`: Leticia
    *   `02`: Miguel
    *   `86`: Dita
    *   `26`: Yoyis
    *   `15`: Mabeli
5.  **Arqueo Diario y Limpieza:** Funciones en `Module3` para blindar el historial de transacciones (Arqueo) y reiniciar el tablero de la hoja "contador".

## 🚀 Estado Actual
*   El código VBA fue extraído de forma exitosa y analizado.
*   Se generó exitosamente una comprensión profunda de cómo interactúan las celdas de la hoja `contador` con los eventos `Worksheet_SelectionChange` (guías amarillas y azules que aparecen y desaparecen).
*   **Siguiente paso:** A la espera de las instrucciones de Miguel (o el usuario en turno) sobre qué modificar, qué formulario rediseñar o qué nueva función implementar.

---
*Prompt para la IA en el nuevo chat:* "Lee este archivo y dime que estás listo para continuar donde nos quedamos."
