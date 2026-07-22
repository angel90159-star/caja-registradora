# Reglas de Proyecto y Control de Despliegue (Antigravity)

## ⛔ Control Estricto de Despliegue a la Nube (Git Push)

- **PROHIBIDO GIT PUSH AUTOMÁTICO**: Está estrictamente prohibido ejecutar `git push`, `git push origin main` o cualquier comando que envíe cambios al repositorio remoto / Vercel sin solicitar y recibir previamente la **autorización explícita** del usuario en el chat.
- **Flujo de Trabajo Obligatorio**:
  1. Realizar todas las ediciones de código y pruebas únicamente en los archivos locales.
  2. Verificar la sintaxis y correcto funcionamiento de los cambios locales.
  3. Informar al usuario en el chat sobre los cambios realizados localmente.
  4. **DETENERSE Y ESPERAR** la confirmación o instrucción explícita del usuario (ejemplo: *"sube los cambios"*, *"haz push"*, *"actualiza la nube"*) antes de ejecutar cualquier comando de subida.
