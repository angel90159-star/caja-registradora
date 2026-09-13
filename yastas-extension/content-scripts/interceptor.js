// content-scripts/interceptor.js
//
// Se ejecuta en el contexto de la página ("world": "MAIN") a document_start.
// Intercepta la generación y entrega del archivo Excel exportado por el portal
// (URL.createObjectURL, fetch y XHR) para capturarlo en memoria antes o al
// momento de la descarga.

(function () {
  if (window.__yastasInterceptorInstalado) return;
  window.__yastasInterceptorInstalado = true;

  console.log('[Yastás Interceptor] Inicializado en el contexto de la página (MAIN world)');

  function notificarBlob(blob, metodo) {
    if (!blob || !(blob instanceof Blob)) return;
    if (blob.size < 100) return; // descartar blobs vacíos o íconos pequeños

    const reader = new FileReader();
    reader.onload = function () {
      const dataUrl = reader.result || '';
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
      if (!base64) return;

      console.log('[Yastás Interceptor] Archivo Excel capturado en memoria:', {
        metodo,
        tamano: blob.size,
        tipo: blob.type,
      });

      window.postMessage(
        {
          origen: 'YASTAS_INTERCEPTOR',
          tipo: 'BLOB_CAPTURADO',
          metodo,
          tamano: blob.size,
          mimeType: blob.type,
          base64: base64,
        },
        '*'
      );
    };
    reader.readAsDataURL(blob);
  }

  // 1. Interceptar URL.createObjectURL (usado habitualmente por Angular y librerías de exportación)
  const origCreateObjectURL = window.URL.createObjectURL;
  window.URL.createObjectURL = function (obj) {
    if (obj instanceof Blob) {
      notificarBlob(obj, 'URL.createObjectURL');
    }
    return origCreateObjectURL.apply(this, arguments);
  };

  // 2. Interceptar fetch por si el backend de Gentera devuelve el stream directamente
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const cd = (res.headers.get('content-disposition') || '').toLowerCase();
      if (
        cd.includes('.xls') ||
        cd.includes('.xlsx') ||
        ct.includes('spreadsheet') ||
        ct.includes('excel') ||
        ct.includes('octet-stream')
      ) {
        const clon = res.clone();
        clon.blob().then((b) => notificarBlob(b, 'fetch')).catch(() => {});
      }
    } catch (e) {}
    return res;
  };

  // 3. Interceptar XMLHttpRequest
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function () {
    this._url = arguments[1];
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        const ct = (this.getResponseHeader('content-type') || '').toLowerCase();
        const cd = (this.getResponseHeader('content-disposition') || '').toLowerCase();
        if (
          cd.includes('.xls') ||
          cd.includes('.xlsx') ||
          ct.includes('spreadsheet') ||
          ct.includes('excel') ||
          ct.includes('octet-stream')
        ) {
          if (this.response instanceof Blob) {
            notificarBlob(this.response, 'XHR-blob');
          } else if (this.response instanceof ArrayBuffer) {
            notificarBlob(new Blob([this.response]), 'XHR-arraybuffer');
          }
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };
})();
