// Hook após inicializar elementos
const manualInput = document.getElementById("manual-barcode");
const applyBtn = document.getElementById("apply-barcode");
if (applyBtn) {
  applyBtn.addEventListener("click", () => {
    els.searchFilter.value = manualInput.value.trim();
    closeScannerOverlay();
    renderProducts();
  });
}