/**
 * scanner.js - Quagga simplificado
 * Detecta EAN/UPC e emite eventos.
 */
export const simpleScanner = (() => {
  let active = false;
  let scanning = false;
  let lastCode = null;

  const listeners = {
    detected: [],
    error: [],
    status: []
  };

  function emit(type, payload) {
    listeners[type].forEach(fn => fn(payload));
  }

  function onDetected(cb) { listeners.detected.push(cb); }
  function onError(cb) { listeners.error.push(cb); }
  function onStatus(cb) { listeners.status.push(cb); }

  async function start() {
    if (active) return;
    emit("status", "Inicializando câmera...");
    scanning = true;
    try {
      await initQuagga({ facingMode: { exact: "environment" } });
    } catch (e) {
      console.warn("Fallback sem exact:", e);
      await initQuagga({ facingMode: "environment" });
    }
    active = true;
    emit("status", "Câmera ativa. Aponte para o código de barras.");
  }

  function initQuagga(facingModeConstraint) {
    return new Promise((resolve, reject) => {
      if (!window.Quagga) {
        const err = new Error("Quagga não carregado");
        emit("error", err); reject(err); return;
      }
      window.Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.getElementById("barcode-scanner"),
          constraints: {
            ...facingModeConstraint,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        decoder: {
          readers: ["ean_reader","ean_8_reader","upc_reader","upc_e_reader"]
        },
        locate: true
      }, err => {
        if (err) {
          emit("error", err);
          reject(err);
          return;
        }
        try {
          window.Quagga.start();
          attachDetection();
          resolve();
        } catch (e2) {
          emit("error", e2);
          reject(e2);
        }
      });
    });
  }

  function attachDetection() {
    window.Quagga.offDetected(onQuaggaDetected);
    window.Quagga.onDetected(onQuaggaDetected);
  }

  function onQuaggaDetected(result) {
    if (!scanning) return;
    if (!result || !result.codeResult || !result.codeResult.code) return;
    const code = result.codeResult.code;
    if (code === lastCode) return; // evita repetição imediata
    lastCode = code;
    emit("status", "Código detectado: " + code);
    emit("detected", code);
    stop(); // para após primeira leitura
  }

  function stop() {
    scanning = false;
    if (window.Quagga && active) {
      try { window.Quagga.stop(); } catch {}
    }
    active = false;
    emit("status", "Scanner parado.");
  }

  return {
    start,
    stop,
    onDetected,
    onError,
    onStatus
  };
})();