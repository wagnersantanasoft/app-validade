/* PATCH do trecho de scanner dentro do app.js (exemplo) */

import { simpleCamera } from "./scanner-simple.js";

// Substitua onde antes usava 'scanner'
els.scanBtn.addEventListener("click", async () => {
  openScannerOverlay();
  try {
    await simpleCamera.start();
  } catch (err) {
    showToast("Não foi possível acessar a câmera. Verifique permissões.", true);
    closeScannerOverlay();
  }
});

els.closeScanner.addEventListener("click", () => {
  simpleCamera.stop();
  closeScannerOverlay();
});

function openScannerOverlay() {
  els.scannerOverlay.classList.remove("hidden");
  // Aqui você pode opcionalmente limpar um input de código manual
}

function closeScannerOverlay() {
  simpleCamera.stop();
  els.scannerOverlay.classList.add("hidden");
}