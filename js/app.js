/**
 * app.js (mantido quase todo original; ajustes no modo de visualização e detecção no login)
 */

import { auth } from "./auth.js";
import { productsService } from "./products.js";
import { api } from "./api.js";
import { toggleTheme } from "./theme.js";
import { scanner } from "./scanner.js";

/* Elementos */
const els = {
  loginView: document.getElementById("login-view"),
  dashboardView: document.getElementById("dashboard-view"),
  loginForm: document.getElementById("login-form"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  loginError: document.getElementById("login-error"),
  userBadge: document.getElementById("user-badge"),

  refreshBtn: document.getElementById("refresh-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  groupFilter: document.getElementById("group-filter"),
  brandFilter: document.getElementById("brand-filter"),
  searchFilter: document.getElementById("search-filter"),
  thresholdDays: document.getElementById("threshold-days"),
  showRemoved: document.getElementById("show-removed"),
  segBtns: document.querySelectorAll(".seg-btn"),
  tbody: document.getElementById("products-tbody"),
  rowTemplate: document.getElementById("row-template"),
  cardTemplate: document.getElementById("card-template"),
  cardsContainer: document.getElementById("cards-container"),
  tableView: document.getElementById("table-view"),
  cardsView: document.getElementById("cards-view"),

  scanBtn: document.getElementById("scan-btn"),
  scannerOverlay: document.getElementById("scanner-overlay"),
  closeScanner: document.getElementById("close-scanner"),
  scannerStatus: document.getElementById("scanner-status"),
  manualBarcode: document.getElementById("manual-barcode"),
  applyBarcode: document.getElementById("apply-barcode"),

  themeToggle: document.getElementById("theme-toggle"),
  addProductBtn: document.getElementById("add-product-btn"),
  productModal: document.getElementById("product-modal"),
  closeModal: document.getElementById("close-modal"),
  cancelModal: document.getElementById("cancel-modal"),
  productForm: document.getElementById("product-form"),
  productError: document.getElementById("product-error"),
  modalTitle: document.getElementById("modal-title"),
  toggleViewBtn: document.getElementById("toggle-view")
};

let currentStatusFilter = "all";
/* Visualização atual: true = Cartões, false = Tabela; null = ainda não definido */
let usingCards = null;
let editingRowId = null;

init();

function init() {
  bindEvents();
  if (auth.isAuthenticated()) enterApp();
  else showLogin();
}

function bindEvents() {
  // Login/filtros/tema/CRUD
  els.loginForm.addEventListener("submit", onLoginSubmit);
  els.logoutBtn.addEventListener("click", () => { auth.logout(); showLogin(); });
  els.refreshBtn.addEventListener("click", () => loadAndRender(true));
  els.groupFilter.addEventListener("change", renderProducts);
  els.brandFilter.addEventListener("change", renderProducts);
  els.searchFilter.addEventListener("input", debounce(renderProducts, 250));
  els.thresholdDays.addEventListener("change", renderProducts);
  els.showRemoved.addEventListener("change", renderProducts);
  els.segBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      els.segBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentStatusFilter = btn.dataset.status;
      renderProducts();
    });
  });

  // SCANNER
  els.scanBtn.addEventListener("click", async () => {
    openScannerOverlay();
    els.manualBarcode.value = "";
    els.scannerStatus.textContent = "Preparando câmera...";
    try {
      await scanner.start();
    } catch (err) {
      toast("Falha ao iniciar câmera: " + (err.message || err), true);
      closeScannerOverlay();
    }
  });

  els.closeScanner.addEventListener("click", () => {
    scanner.stop();
    closeScannerOverlay();
  });

  els.applyBarcode.addEventListener("click", () => {
    const val = els.manualBarcode.value.trim();
    if (!val) return;
    els.searchFilter.value = val;
    closeScannerOverlay();
    renderProducts();
  });

  scanner.onStatus(msg => {
    if (els.scannerStatus) els.scannerStatus.textContent = msg;
  });
  scanner.onError(err => {
    toast("Erro scanner: " + (err.message || err), true);
    closeScannerOverlay();
  });
  scanner.onDetected(code => {
    els.searchFilter.value = code;
    const formBarcode = document.getElementById("p-barcode");
    if (formBarcode && !els.productModal.classList.contains("hidden")) {
      formBarcode.value = code;
    }
    toast("Código detectado: " + code);
    renderProducts();
    closeScannerOverlay();
  });

  // Tema / Produto
  els.themeToggle.addEventListener("click", () => toggleTheme());
  els.addProductBtn.addEventListener("click", openProductModal);
  els.closeModal.addEventListener("click", closeProductModal);
  els.cancelModal.addEventListener("click", closeProductModal);
  els.productForm.addEventListener("submit", onProductSubmit);

  // Alternância de visualização via botão (com símbolo)
  els.toggleViewBtn.addEventListener("click", () => {
    // Se ainda não definido (antes do login), define padrão e alterna
    if (usingCards === null) usingCards = detectDefaultView();
    usingCards = !usingCards;
    applyViewMode();
    renderProducts();
  });

  // Responsivo: se estreitar muito (<560px) e estiver em tabela, força Cartões
  window.addEventListener("resize", debounce(() => {
    if (usingCards === null) return; // ainda não estamos no dashboard
    if (window.innerWidth < 560 && usingCards === false) {
      usingCards = true;
      applyViewMode();
      renderProducts();
    }
  }, 250));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!els.scannerOverlay.classList.contains("hidden")) {
        scanner.stop();
        closeScannerOverlay();
      }
      if (!els.productModal.classList.contains("hidden")) closeProductModal();
    }
  });
}

/* Define visualização padrão ao entrar (login): Desktop => Tabela; Mobile => Cartões */
function detectDefaultView() {
  return window.innerWidth >= 960 ? false /* Tabela */ : true /* Cartões */;
}

/* Overlay scanner */
function openScannerOverlay() {
  els.scannerOverlay.classList.remove("hidden");
}
function closeScannerOverlay() {
  scanner.stop();
  els.scannerOverlay.classList.add("hidden");
}

/* Fluxo de login/dashboard */
async function onLoginSubmit(e) {
  e.preventDefault();
  const username = els.username.value.trim();
  const password = els.password.value;
  els.loginError.hidden = true;
  setFormDisabled(true);
  try {
    await auth.login(username, password);
    enterApp();
  } catch (err) {
    els.loginError.textContent = err.message || "Erro ao autenticar";
    els.loginError.hidden = false;
  } finally {
    setFormDisabled(false);
  }
}
function setFormDisabled(disabled) {
  [...els.loginForm.elements].forEach(el => el.disabled = disabled);
}
function showLogin() {
  els.loginView.classList.add("active");
  els.dashboardView.classList.remove("active");
  els.loginForm.reset();
  els.username.focus();
}
function enterApp() {
  els.loginView.classList.remove("active");
  els.dashboardView.classList.add("active");
  const s = auth.getSession();
  els.userBadge.textContent = s?.user?.name || s?.user?.username || "?";

  // Define visualização padrão com base no dispositivo/tamanho no momento do login
  usingCards = detectDefaultView();
  applyViewMode();

  loadAndRender(true);
}

/* Carregamento e renderização */
async function loadAndRender(force=false) {
  setTableLoading();
  try {
    const products = await productsService.load(force);
    populateFilters(products);
    renderProducts();
  } catch (err) {
    setTableError(err.message || "Erro ao carregar produtos");
  }
}
function populateFilters(products) {
  const groups = [...new Set(products.map(p=>p.group))].sort();
  const gCurrent = els.groupFilter.value;
  els.groupFilter.innerHTML = "<option value=''>Todos</option>" +
    groups.map(g=>`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  if (groups.includes(gCurrent)) els.groupFilter.value = gCurrent;

  const brands = [...new Set(products.map(p=>p.brand))].sort();
  const bCurrent = els.brandFilter.value;
  els.brandFilter.innerHTML = "<option value=''>Todas</option>" +
    brands.map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  if (brands.includes(bCurrent)) els.brandFilter.value = bCurrent;
}
function getFilterOptions() {
  return {
    group: els.groupFilter.value,
    brand: els.brandFilter.value,
    search: els.searchFilter.value.trim(),
    status: currentStatusFilter,
    thresholdDays: parseInt(els.thresholdDays.value,10) || 15,
    showRemoved: els.showRemoved.checked
  };
}
function renderProducts() {
  const products = productsService.cache.products;
  if (!products.length) { setTableEmpty(); return; }
  const opts = getFilterOptions();
  const filtered = productsService
    .filter(products, opts)
    .sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate));
  if (usingCards) renderCards(filtered, opts);
  else renderTable(filtered, opts);
}
function renderTable(filtered, opts) {
  if (!filtered.length) {
    els.tbody.innerHTML = `<tr><td colspan="9" class="center muted">Nenhum produto encontrado.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  filtered.forEach(p=>{
    const { days, status } = productsService.computeStatus(p, opts.thresholdDays);
    frag.appendChild(renderRow(p, days, status));
  });
  els.tbody.innerHTML = "";
  els.tbody.appendChild(frag);
}
function renderRow(product, days, status) {
  const tr = els.rowTemplate.content.firstElementChild.cloneNode(true);
  tr.querySelector(".col-code").textContent = product.code;
  tr.querySelector(".col-barcode").textContent = product.barcode || "-";
  tr.querySelector(".col-name").textContent = product.name;
  tr.querySelector(".col-group").textContent = product.group;
  tr.querySelector(".col-brand").textContent = product.brand;

  const expiryCell = tr.querySelector(".col-expiry");
  expiryCell.textContent = formatDateBR(product.expiryDate);

  const daysCell = tr.querySelector(".col-days");
  daysCell.textContent = days;
  if (days < 0) daysCell.classList.add("negative");
  else if (days <= parseInt(els.thresholdDays.value,10)) daysCell.classList.add("warning");

  tr.querySelector(".col-status").appendChild(buildBadge(status));
  const actionCell = tr.querySelector(".col-action");
  actionCell.appendChild(buildEditButton(product, expiryCell));
  if (status === "expired" && !product.removed) {
    actionCell.appendChild(buildRemoveButton(product.id));
  } else if (status === "removed") {
    const span = document.createElement("span");
    span.className="muted"; span.style.fontSize=".55rem"; span.textContent="Removido";
    actionCell.appendChild(span); tr.style.opacity=.55;
  }
  return tr;
}
function renderCards(filtered, opts) {
  if (!filtered.length) {
    els.cardsContainer.innerHTML = `<div class="muted" style="grid-column:1/-1;font-size:.75rem;">Nenhum produto encontrado.</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  filtered.forEach(p=>{
    const { days, status } = productsService.computeStatus(p, opts.thresholdDays);
    frag.appendChild(renderCard(p, days, status));
  });
  els.cardsContainer.innerHTML = "";
  els.cardsContainer.appendChild(frag);
}
function renderCard(product, days, status) {
  const card = els.cardTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector(".pc-code").textContent = product.code;
  card.querySelector(".pc-status").appendChild(buildBadge(status));
  card.querySelector(".pc-name").textContent = product.name;
  card.querySelector(".pc-group").textContent = product.group;
  card.querySelector(".pc-brand").textContent = product.brand;
  card.querySelector(".pc-barcode").textContent = product.barcode || "-";
  card.querySelector(".pc-expiry").textContent = formatDateBR(product.expiryDate);
  const daysEl = card.querySelector(".pc-days");
  daysEl.textContent = days;
  if (days < 0) daysEl.style.color="#ff6d6d";
  else if (days <= parseInt(els.thresholdDays.value,10)) daysEl.style.color="var(--c-warn)";

  const actions = card.querySelector(".pc-actions");
  actions.appendChild(buildEditButton(product, card.querySelector(".pc-expiry"), true));
  if (status === "expired" && !product.removed) {
    actions.appendChild(buildRemoveButton(product.id, true));
  } else if (status === "removed") {
    const span = document.createElement("span");
    span.className="muted"; span.textContent="Removido";
    actions.appendChild(span); card.style.opacity=.55;
  }
  return card;
}

/* Botões/Ações */
function buildEditButton(product, expiryDisplayEl, compact=false) {
  const btn = document.createElement("button");
  btn.className = "btn " + (compact?"small":"small");
  btn.textContent = "Editar";
  btn.addEventListener("click", () => startInlineEdit(product, expiryDisplayEl));
  return btn;
}
function startInlineEdit(product, expiryDisplayEl) {
  if (editingRowId && editingRowId !== product.id) return;
  if (editingRowId === product.id) return;
  editingRowId = product.id;
  const original = product.expiryDate;
  const wrap = document.createElement("div");
  wrap.className = "edit-inline";
  const input = document.createElement("input");
  input.type="date"; input.value=original;
  const save = document.createElement("button");
  save.className="btn small primary"; save.textContent="OK";
  const cancel = document.createElement("button");
  cancel.className="btn small"; cancel.textContent="X";
  expiryDisplayEl.innerHTML="";
  wrap.appendChild(input); wrap.appendChild(save); wrap.appendChild(cancel);
  expiryDisplayEl.appendChild(wrap);
  input.focus();
  save.addEventListener("click", async ()=>{
    const newDate = input.value;
    if(!newDate) return;
    save.disabled = true;
    try {
      await api.updateProduct(product.id,{ expiryDate:newDate }, auth.getToken());
      productsService.updateLocal(product.id,{ expiryDate:newDate });
      editingRowId=null;
      expiryDisplayEl.textContent = formatDateBR(newDate);
      renderProducts();
    } catch(err){
      alert("Falha ao atualizar: "+err.message);
      save.disabled=false;
    }
  });
  cancel.addEventListener("click", ()=>{
    editingRowId=null;
    expiryDisplayEl.textContent = formatDateBR(original);
  });
}
function buildRemoveButton(id, compact=false) {
  const btn = document.createElement("button");
  btn.className="btn danger "+(compact?"small":"small");
  btn.textContent="Remover";
  btn.addEventListener("click", () => onRemove(id, btn));
  return btn;
}
async function onRemove(id, btn) {
  btn.disabled=true;
  try {
    await api.removeProduct(id, auth.getToken());
    const prod = productsService.cache.products.find(p=>p.id===id);
    if (prod) prod.removed = true;
    renderProducts();
  } catch(err){
    alert("Falha ao remover: "+err.message);
    btn.disabled=false;
  }
}

/* Modal Produto */
function openProductModal() {
  els.productForm.reset();
  els.productError.hidden=true;
  els.modalTitle.textContent="Novo Produto";
  els.productModal.classList.remove("hidden");
  document.getElementById("p-code").focus();
}
function closeProductModal() { els.productModal.classList.add("hidden"); }
async function onProductSubmit(e) {
  e.preventDefault();
  els.productError.hidden = true;
  const fd = new FormData(els.productForm);
  const payload = {
    code: fd.get("code").trim(),
    barcode: fd.get("barcode").trim(),
    name: fd.get("name").trim(),
    group: fd.get("group").trim(),
    brand: fd.get("brand").trim(),
    expiryDate: fd.get("expiryDate")
    // Campos price/unit existem no modal e podem ser enviados ao backend caso você queira ativá-los:
    // price: Number(fd.get("price") || 0),
    // unit: (fd.get("unit") || "").trim()
  };
  if (!payload.code || !payload.name || !payload.group || !payload.brand || !payload.expiryDate) {
    showProductError("Preencha todos os campos obrigatórios.");
    return;
  }
  setProductFormDisabled(true);
  try {
    const prod = await api.addProduct(payload, auth.getToken());
    productsService.addLocal(prod);
    closeProductModal();
    populateFilters(productsService.cache.products);
    renderProducts();
  } catch(err){
    showProductError(err.message || "Erro ao adicionar produto");
  } finally {
    setProductFormDisabled(false);
  }
}
function showProductError(msg){ els.productError.textContent=msg; els.productError.hidden=false; }
function setProductFormDisabled(disabled){ [...els.productForm.elements].forEach(el=>el.disabled=disabled); }

/* Utilitários */
function buildBadge(status) {
  const span = document.createElement("span");
  span.classList.add("badge");
  switch(status){
    case "ok": span.textContent="OK"; span.classList.add("ok"); break;
    case "near": span.textContent="PRÓXIMO"; span.classList.add("near"); break;
    case "expired": span.textContent="VENCIDO"; span.classList.add("expired"); break;
    case "removed": span.textContent="REMOVIDO"; span.classList.add("removed"); break;
    default: span.textContent = status.toUpperCase();
  }
  return span;
}
function setTableLoading(){
  els.tbody.innerHTML = `<tr><td colspan="9" class="center muted">Carregando...</td></tr>`;
  els.cardsContainer.innerHTML="";
}
function setTableError(msg){
  els.tbody.innerHTML = `<tr><td colspan="9" class="center" style="color:#ff9e9e;">Erro: ${escapeHtml(msg)}</td></tr>`;
  els.cardsContainer.innerHTML = `<div style="color:#ff6d6d;">Erro: ${escapeHtml(msg)}</div>`;
}
function setTableEmpty(){
  els.tbody.innerHTML = `<tr><td colspan="9" class="center muted">Nenhum produto.</td></tr>`;
  els.cardsContainer.innerHTML = `<div class="muted">Nenhum produto.</div>`;
}
function formatDateBR(iso){
  if(!iso) return "-";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function escapeHtml(str){
  return str.replace(/[&<>\"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}
function debounce(fn, wait=300){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),wait); };
}
/* Aplica ícone e visibilidade com base em usingCards */
function applyViewMode(){
  if(usingCards){
    els.tableView.classList.add("hidden");
    els.cardsView.classList.remove("hidden");
    els.toggleViewBtn.textContent="📋"; // indica que o próximo clique leva para Tabela
    els.toggleViewBtn.title="Modo tabela";
  } else {
    els.tableView.classList.remove("hidden");
    els.cardsView.classList.add("hidden");
    els.toggleViewBtn.textContent="🗂"; // indica que o próximo clique leva para Cartões
    els.toggleViewBtn.title="Modo cartões";
  }
}
function toast(msg, error=false){
  const div = document.createElement("div");
  div.textContent=msg;
  Object.assign(div.style,{
    position:"fixed",bottom:"16px",left:"50%",transform:"translateX(-50%)",
    background: error?"#b3261e":"#2563eb",
    color:"#fff",padding:"8px 14px",fontSize:"12px",
    borderRadius:"6px",boxShadow:"0 4px 12px -4px rgba(0,0,0,.4)",
    zIndex:3000
  });
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),2600);
}