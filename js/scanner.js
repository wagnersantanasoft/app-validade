/**
 * scanner.js (inalterado em lógica principal; apenas compatível com novos estilos)
 * Scanner de código de barras com BarcodeDetector + fallback QuaggaJS.
 */
export const scanner = (() => {
  let videoEl;
  let stream;
  let running = false;
  let callbacks = {
    result: [],
    status: [],
    torchAvailability: [],
    multiCamera: []
  };
  let currentDeviceId = null;
  let devices = [];
  let barcodeDetector = null;
  let torchOn = false;
  let trackWithTorch = null;
  let frameReq;
  let usingBarcodeDetector = false;
  let usingQuagga = false;
  let quaggaLoaded = false;
  let scanningCooldown = false;

  function q(id) { return document.getElementById(id); }

  function onResult(cb) { callbacks.result.push(cb); }
  function onStatus(cb) { callbacks.status.push(cb); }
  function onTorchAvailability(cb) { callbacks.torchAvailability.push(cb); }
  function onMultipleCameras(cb) { callbacks.multiCamera.push(cb); }
  function emit(type, data) { callbacks[type].forEach(fn => fn(data)); }

  async function initDevices() {
    devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
    emit("multiCamera", devices.length > 1);
  }

  async function chooseDevice() {
    if (!devices.length) await initDevices();
    const back = devices.find(d => /back|trás|rear|environment/i.test(d.label));
    currentDeviceId = (back || devices[0])?.deviceId || null;
  }

  async function start() {
    if (running) return;
    videoEl = q("scanner-video");
    emit("status", "Inicializando...");
    await initDevices();
    await chooseDevice();

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined,
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch (err) {
      emit("status", "Permissão negada / câmera indisponível.");
      console.error(err);
      return;
    }

    videoEl.srcObject = stream;
    await videoEl.play();
    running = true;
    detectTorchSupport();

    if ("BarcodeDetector" in window) {
      try {
        barcodeDetector = new window.BarcodeDetector({
          formats: ["ean_13","ean_8","code_128","upc_a","upc_e","qr_code","codabar"]
        });
        usingBarcodeDetector = true;
        emit("status", "Scanner pronto (nativo). Aponte para o código.");
        loopNative();
      } catch (e) {
        console.warn("Falha BarcodeDetector:", e);
        fallbackQuagga();
      }
    } else {
      fallbackQuagga();
    }
  }

  function loopNative() {
    if (!running || !usingBarcodeDetector) return;
    frameReq = requestAnimationFrame(loopNative);
    scanFrameNative();
  }

  async function scanFrameNative() {
    if (scanningCooldown) return;
    try {
      const barcodes = await barcodeDetector.detect(videoEl);
      if (barcodes.length) {
        const value = barcodes[0].rawValue;
        scanningCooldown = true;
        emit("status", "Código: " + value);
        emit("result", value);
        setTimeout(() => { scanningCooldown = false; }, 1200);
      }
    } catch {}
  }

  function fallbackQuagga() {
    if (usingQuagga) return;
    emit("status", "Carregando fallback...");
    loadQuagga()
      .then(() => {
        usingQuagga = true;
        window.Quagga.init({
          inputStream: {
            type: "LiveStream",
            target: videoEl,
            constraints: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "environment",
              deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined
            }
          },
          decoder: {
            readers: [
              "ean_reader",
              "ean_8_reader",
              "code_128_reader",
              "upc_reader",
              "upc_e_reader",
              "codabar_reader"
            ]
          },
          locate: true
        }, err => {
          if (err) {
            console.error(err);
            emit("status", "Erro no fallback.");
            return;
          }
          window.Quagga.start();
          emit("status", "Scanner pronto (fallback).");
          window.Quagga.onDetected(onQuaggaDetected);
        });
      })
      .catch(e => {
        console.error(e);
        emit("status", "Falha no fallback.");
      });
  }

  function onQuaggaDetected(result) {
    if (!result || !result.codeResult) return;
    if (scanningCooldown) return;
    const value = result.codeResult.code;
    scanningCooldown = true;
    emit("status", "Código: " + value);
    emit("result", value);
    setTimeout(() => { scanningCooldown = false; }, 1200);
  }

  function stop() {
    running = false;
    usingBarcodeDetector = false;
    if (frameReq) cancelAnimationFrame(frameReq);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (usingQuagga && window.Quagga) {
      try { window.Quagga.stop(); } catch {}
    }
    emit("status", "Scanner parado.");
  }

  function detectTorchSupport() {
    const tracks = stream.getVideoTracks();
    trackWithTorch = tracks.find(t => {
      const caps = t.getCapabilities?.();
      return caps && ("torch" in caps);
    }) || null;
    emit("torchAvailability", !!trackWithTorch);
  }

  async function toggleTorch() {
    if (!trackWithTorch) return;
    try {
      const caps = trackWithTorch.getCapabilities();
      if (!("torch" in caps)) return;
      torchOn = !torchOn;
      await trackWithTorch.applyConstraints({ advanced: [{ torch: torchOn }] });
      emit("status", torchOn ? "Lanterna ligada" : "Lanterna desligada");
    } catch (e) {
      console.warn("Torch error", e);
      emit("status", "Não foi possível alternar lanterna.");
    }
  }

  async function switchCamera() {
    if (devices.length < 2) return;
    const idx = devices.findIndex(d => d.deviceId === currentDeviceId);
    const next = devices[(idx + 1) % devices.length];
    currentDeviceId = next.deviceId;
    emit("status", "Trocando câmera...");
    stop();
    start();
  }

  function loadQuagga() {
    if (quaggaLoaded) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js";
      script.onload = () => { quaggaLoaded = true; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return {
    start,
    stop,
    toggleTorch,
    switchCamera,
    onResult,
    onStatus,
    onTorchAvailability,
    onMultipleCameras
  };
})();