// Cámara + decodificación de QR. Usa BarcodeDetector nativo cuando está
// disponible (Chrome/Edge/Android); si no, cae a jsQR (js/vendor/jsQR.js).
const QrScanner = (() => {
  let stream = null;
  let rafId = null;
  let canvas = null;
  let ctx = null;
  let detectorNativo = null;
  let activo = false;

  function soportaBarcodeDetector() {
    return 'BarcodeDetector' in window;
  }

  async function iniciar(videoEl, onDetected, onError) {
    detener();

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (e) {
      onError && onError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      return;
    }

    activo = true;
    videoEl.srcObject = stream;
    try {
      await videoEl.play();
    } catch (e) {
      // algunos navegadores exigen interacción extra; el elemento igual reproduce al estar listo
    }

    detectorNativo = null;
    if (soportaBarcodeDetector()) {
      try {
        detectorNativo = new BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        detectorNativo = null;
      }
    }

    if (detectorNativo) {
      loopNativo(videoEl, onDetected);
    } else if (typeof jsQR === 'function') {
      canvas = canvas || document.createElement('canvas');
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      loopJsQR(videoEl, onDetected);
    } else {
      onError && onError('Este navegador no puede leer códigos QR.');
    }
  }

  async function loopNativo(videoEl, onDetected) {
    if (!activo) return;
    try {
      const codigos = await detectorNativo.detect(videoEl);
      if (codigos.length > 0 && codigos[0].rawValue) {
        onDetected(codigos[0].rawValue);
        return;
      }
    } catch (e) {
      // frame no listo u otro error puntual: se ignora y se reintenta
    }
    if (activo) rafId = requestAnimationFrame(() => loopNativo(videoEl, onDetected));
  }

  function loopJsQR(videoEl, onDetected) {
    if (!activo) return;
    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && videoEl.videoWidth > 0) {
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const resultado = jsQR(imageData.data, imageData.width, imageData.height);
      if (resultado && resultado.data) {
        onDetected(resultado.data);
        return;
      }
    }
    if (activo) rafId = requestAnimationFrame(() => loopJsQR(videoEl, onDetected));
  }

  function detener() {
    activo = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    stream = null;
    detectorNativo = null;
  }

  return { iniciar, detener };
})();
