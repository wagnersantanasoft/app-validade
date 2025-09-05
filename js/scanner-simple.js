/**
 * scanner-simple.js
 * Versão enxuta: apenas abre a câmera e mostra o vídeo.
 * Sem detecção automática de código. O callback 'onOpen' e 'onClose'
 * podem ser usados para limpar/atualizar interface.
 */

export const simpleCamera = (() => {
  let stream = null;
  let videoEl = null;
  const listeners = {
    open: [],
    close: [],
    error: []
  };

  function onOpen(cb){ listeners.open.push(cb); }
  function onClose(cb){ listeners.close.push(cb); }
  function onError(cb){ listeners.error.push(cb); }

  async function start() {
    if (stream) return;
    videoEl = document.getElementById("scanner-video");
    if (!videoEl) throw new Error("Elemento #scanner-video não encontrado");

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      listeners.open.forEach(fn => fn());
    } catch (err) {
      console.error("Erro câmera:", err);
      listeners.error.forEach(fn => fn(err));
      throw err;
    }
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
    listeners.close.forEach(fn => fn());
  }

  return { start, stop, onOpen, onClose, onError };
})();