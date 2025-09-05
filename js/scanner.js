/**
 * scanner.js
 * Implementação baseada no arquivo teste_camera.html fornecido, adaptada para o overlay do projeto.
 * - Usa Quagga2 (@ericblade/quagga2)
 * - Controla start/stop
 * - Emite eventos: detected(code), status(msg), error(err)
 * - Fecha após primeira leitura (pode remover stop() no onDetected para modo contínuo)
 */

export const scanner = (() => {
  let stream = null;
  let scanning = false;
  let lastCode = null;
  let quaggaStarted = false;

  const videoEl = () => document.getElementById("scanner-video");

  const listeners = {
    detected: [],
    status: [],
    error: []
  };

  function onDetected(cb) { listeners.detected.push(cb); }
  function onStatus(cb) { listeners.status.push(cb); }
  function onError(cb) { listeners.error.push(cb); }

  function emit(type, payload) {
    listeners[type].forEach(fn => fn(payload));
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function buildConstraints(primary = true) {
    if (primary && isMobile()) {
      return {
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
    }
    return {
      video: {
        facingMode: "environment"
      },
      audio: false
    };
  }

  async function start() {
    if (scanning) return;
    emit("status", "Solicitando acesso à câmera...");
    // Tenta primeiro com 'exact' em mobile
    try {
      await startCamera(buildConstraints(true));
    } catch (e1) {
      console.warn("Falhou com exact, tentando fallback:", e1);
      await startCamera(buildConstraints(false));
    }
    emit("status", "Câmera ok. Iniciando leitura...");
    await startQuagga();
    scanning = true;
    emit("status", "Aponte para o código de barras.");
  }

  async function startCamera(constraints) {
    stopCamera(); // limpa anterior
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    const v = videoEl();
    v.srcObject = stream;
    await v.play();
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    const v = videoEl();
    if (v) v.srcObject = null;
  }

  function startQuagga() {
    return new Promise((resolve, reject) => {
      if (!window.Quagga) {
        const err = new Error("Quagga2 não carregado");
        emit("error", err);
        return reject(err);
      }
      if (quaggaStarted) {
        // já iniciado em algum fluxo anterior: parar e reiniciar para limpar handlers
        try { window.Quagga.stop(); } catch {}
        quaggaStarted = false;
      }

      window.Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoEl(), // usando o <video> diretamente, como no seu exemplo
          constraints: {
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        },
        decoder: {
          readers: [
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader"
          ]
        },
        locate: true
      }, err => {
        if (err) {
          emit("error", err);
          return reject(err);
        }
        try {
          window.Quagga.start();
          quaggaStarted = true;
          window.Quagga.offDetected(handleDetected);
          window.Quagga.onDetected(handleDetected);
          resolve();
        } catch (e2) {
          emit("error", e2);
          reject(e2);
        }
      });
    });
  }

  function handleDetected(result) {
    if (!scanning) return;
    if (!result || !result.codeResult || !result.codeResult.code) return;
    const code = result.codeResult.code;
    if (code === lastCode) return; // evita repetição imediata
    lastCode = code;
    emit("status", "Código detectado: " + code);
    emit("detected", code);
    // Fecha após primeira leitura. Para leitura contínua, remova a linha abaixo:
    stop();
  }

  function stop() {
    scanning = false;
    lastCode = null;
    if (window.Quagga && quaggaStarted) {
      try { window.Quagga.stop(); } catch {}
      quaggaStarted = false;
    }
    stopCamera();
    emit("status", "Leitura encerrada.");
  }

  return {
    start,
    stop,
    onDetected,
    onStatus,
    onError
  };
})();