async function refrescarEstado() {
  const { pendingJob } = await chrome.storage.local.get('pendingJob');
  document.getElementById('estado').textContent = pendingJob
    ? `Job ${pendingJob.jobId.slice(0, 8)}… · fecha ${pendingJob.fecha} · ${pendingJob.estado}`
    : 'Sin trabajos pendientes';
}

async function refrescarCredenciales() {
  const { credenciales } = await chrome.storage.local.get('credenciales');
  const estado = document.getElementById('cred-estado');
  if (credenciales?.usuario) {
    estado.textContent = `✓ Guardadas (usuario: ${credenciales.usuario})`;
    document.getElementById('usuario').value = credenciales.usuario;
    // La contraseña nunca se vuelve a mostrar en el campo.
  } else {
    estado.textContent = 'Sin credenciales guardadas';
    document.getElementById('cred-panel').open = true; // abre el panel para que se note
  }
}

document.getElementById('probar').addEventListener('click', async () => {
  const fecha = document.getElementById('fecha').value;
  if (!fecha) {
    alert('Elige una fecha primero.');
    return;
  }
  // Simula el mensaje que en producción manda el botón de tu dashboard en
  // Vercel vía chrome.runtime.sendMessage(EXTENSION_ID, ...). Aquí lo
  // disparamos directo porque el popup ya corre dentro de la extensión.
  chrome.runtime.sendMessage(
    { tipo: 'YASTAS_DESCARGAR', fecha, jobId: crypto.randomUUID() },
    (respuesta) => {
      if (chrome.runtime.lastError) {
        alert('Error: ' + chrome.runtime.lastError.message);
      } else if (respuesta && !respuesta.ok) {
        alert('No se pudo abrir la pestaña: ' + respuesta.error);
      }
      refrescarEstado();
    }
  );
});

document.getElementById('guardar-cred').addEventListener('click', async () => {
  const usuario = document.getElementById('usuario').value.trim();
  const password = document.getElementById('password').value;
  if (!usuario || !password) {
    alert('Escribe usuario y contraseña.');
    return;
  }
  await chrome.storage.local.set({ credenciales: { usuario, password } });
  document.getElementById('password').value = '';
  refrescarCredenciales();
});

document.getElementById('borrar-cred').addEventListener('click', async () => {
  await chrome.storage.local.remove('credenciales');
  document.getElementById('usuario').value = '';
  document.getElementById('password').value = '';
  refrescarCredenciales();
});

refrescarEstado();
refrescarCredenciales();
