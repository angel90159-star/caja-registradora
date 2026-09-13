// content-scripts/bridge.js
//
// Puente entre el dashboard de la app en Vercel/Localhost y el Service Worker
// de la extensión. Permite que la app ordene la descarga con un botón sin
// necesidad de conocer un ID de extensión fijo.

(function () {
  console.log('[Yastás Bridge] Conectado en el dashboard de Caja Registradora');

  // Marcar en el DOM que la extensión está activa
  document.documentElement.dataset.yastasExtension = '0.2.0';

  // Anunciar a la ventana
  function anunciarPresencia() {
    window.postMessage({ tipo: 'YASTAS_EXTENSION_LISTA', version: '0.2.0' }, '*');
  }
  anunciarPresencia();

  // Escuchar solicitudes desde la página web
  window.addEventListener('message', (evento) => {
    if (evento.source !== window || !evento.data) return;

    if (evento.data.tipo === 'YASTAS_CONSULTAR_EXTENSION') {
      anunciarPresencia();
      return;
    }

    if (evento.data.tipo === 'YASTAS_SOLICITAR_DESCARGA') {
      const { fecha, jobId } = evento.data;
      console.log('[Yastás Bridge] Solicitud de descarga recibida desde la app:', { fecha, jobId });

      chrome.runtime.sendMessage(
        { tipo: 'YASTAS_DESCARGAR', fecha, jobId },
        (respuesta) => {
          if (chrome.runtime.lastError) {
            console.error('[Yastás Bridge] Error comunicando con background:', chrome.runtime.lastError);
            window.postMessage(
              {
                tipo: 'YASTAS_DESCARGA_ERROR',
                error: chrome.runtime.lastError.message,
              },
              '*'
            );
            return;
          }
          window.postMessage({ tipo: 'YASTAS_DESCARGA_INICIADA', respuesta }, '*');
        }
      );
    }
  });

  // Reenviar avisos desde el Service Worker hacia la ventana web
  chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje?.tipo === 'YASTAS_PROGRESO' || mensaje?.tipo === 'YASTAS_TERMINADO' || mensaje?.tipo === 'YASTAS_ERROR') {
      window.postMessage(mensaje, '*');
    }
  });
})();
