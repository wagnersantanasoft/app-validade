let stream = null;

const preview = document.getElementById('preview');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const captureBtn = document.getElementById('captureBtn');
const statusMsg = document.getElementById('statusMsg');
const canvas = document.getElementById('snapshot');
const barcodeInput = document.getElementById('barcodeInput');

async function startCamera() {
  statusMsg.textContent = "Solicitando acesso à câmera...";
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    preview.srcObject = stream;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    captureBtn.disabled = false;
    statusMsg.textContent = "Câmera ativa.";
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Falha ao acessar câmera: " + (err.message || err.name);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  preview.srcObject = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  captureBtn.disabled = true;
  statusMsg.textContent = "Câmera parada.";
}

function captureFrame() {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const w = settings.width || preview.videoWidth;
  const h = settings.height || preview.videoHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(preview, 0, 0, w, h);
  statusMsg.textContent = "Frame capturado (canvas disponível).";
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
captureBtn.addEventListener('click', captureFrame);

window.addEventListener('beforeunload', stopCamera);