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

  // 1. Interceptar URL.createObjectURL de forma segura (evita "Illegal invocation")
  const origCreateObjectURL = window.URL?.createObjectURL ? window.URL.createObjectURL.bind(window.URL) : null;
  if (origCreateObjectURL) {
    window.URL.createObjectURL = function (obj) {
      try {
        if (obj instanceof Blob) {
          notificarBlob(obj, 'URL.createObjectURL');
        }
      } catch (e) {}
      return origCreateObjectURL(obj);
    };
  }

  // 2. Interceptar fetch con contexto window obligatorio (evita "Illegal invocation")
  const origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = async function (...args) {
      const res = await origFetch(...args);
      try {
        const ct = (res.headers?.get('content-type') || '').toLowerCase();
        const cd = (res.headers?.get('content-disposition') || '').toLowerCase();
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
  }

  // 3. Interceptar XMLHttpRequest de forma segura
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function () {
    try { this._url = arguments[1]; } catch (e) {}
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    const xhr = this;
    xhr.addEventListener('load', function () {
      try {
        // Solo consultar cabeceras si la petición terminó exitosamente (readyState 4 y status 200)
        // Evita el DOMException "The object's state must be HEADERS_RECEIVED or LOADING or DONE"
        if (!xhr || xhr.readyState !== 4 || xhr.status !== 200) return;

        let ct = '';
        let cd = '';
        try { ct = (xhr.getResponseHeader('content-type') || '').toLowerCase(); } catch (e) {}
        try { cd = (xhr.getResponseHeader('content-disposition') || '').toLowerCase(); } catch (e) {}

        if (
          cd.includes('.xls') ||
          cd.includes('.xlsx') ||
          ct.includes('spreadsheet') ||
          ct.includes('excel') ||
          ct.includes('octet-stream')
        ) {
          try {
            if (xhr.response instanceof Blob) {
              notificarBlob(xhr.response, 'XHR-blob');
            } else if (xhr.response instanceof ArrayBuffer) {
              notificarBlob(new Blob([xhr.response]), 'XHR-arraybuffer');
            }
          } catch (e) {}
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };
})();
