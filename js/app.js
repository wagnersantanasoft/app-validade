/**
 * app.js
 * Agora o botão "Editar" permite alterar Validade, Estoque, Preço1 e Preço2.
 * - Envia somente campos que mudaram.
 * - Usa api.updateProduct(id, { expiryDate, stock, price, price2 })
 */

import { auth } from "./auth.js";
import { productsService } from "./products.js";
import { api } from "./api.js";
import { toggleTheme } from "./theme.js";
import { scanner } from "./scanner.js";

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
  toggleViewBtn: document.getElementById("toggle-view"),

  infiniteStatus: document.getElementById("infinite-status"),
  infiniteSentinel: document.getElementById("infinite-sentinel"),
  loadMoreBtn: document.getElementById("load-more-btn")
};

let currentStatusFilter = "all";
let usingCards = null;
let editingRowId = null;
let intersectionObserver = null;

init();

function init() {
  bindEvents();
  setupIntersectionObserver();
  if (auth.isAuthenticated()) enterApp();
  else showLogin();
}

function bindEvents() {
  els.loginForm.addEventListener("submit", onLoginSubmit);
  els.logoutBtn.addEventListener("click", () => { auth.logout(); showLogin(); });

  els.refreshBtn.addEventListener("click", () => reloadAll(true));
  els.groupFilter.addEventListener("change", onFilterChanged);
  els.brandFilter.addEventListener("change", onFilterChanged);
  els.searchFilter.addEventListener("input", debounce(onFilterChanged, 400));
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

  // Scanner
  els.scanBtn.addEventListener("click", async () => {
    openScannerOverlay();
    els.manualBarcode.value = "";
    els.scannerStatus.textContent = "Preparando câmera...";
    try { await scanner.start(); }
    catch (err) {
      toast("Falha ao iniciar câmera: " + (err.message || err), true);
      closeScannerOverlay();
    }
  });
  els.closeScanner.addEventListener("click", () => { scanner.stop(); closeScannerOverlay(); });
  els.applyBarcode.addEventListener("click", () => {
    const val = els.manualBarcode.value.trim();
    if (!val) return;
    els.searchFilter.value = val;
    onFilterChanged();
    closeScannerOverlay();
  });
  scanner.onStatus(msg => { if (els.scannerStatus) els.scannerStatus.textContent = msg; });
  scanner.onError(err => { toast("Erro scanner: " + (err.message || err), true); closeScannerOverlay(); });
  scanner.onDetected(code => {
    els.searchFilter.value = code;
    toast("Código detectado: " + code);
    onFilterChanged();
    closeScannerOverlay();
  });

  // Tema / Produto
  els.themeToggle.addEventListener("click", () => toggleTheme());
  els.addProductBtn.addEventListener("click", openProductModal);
  els.closeModal.addEventListener("click", closeProductModal);
  els.cancelModal.addEventListener("click", closeProductModal);
  els.productForm.addEventListener("submit", onProductSubmit);

  // Alternar visualização
  els.toggleViewBtn.addEventListener("click", () => {
    if (usingCards === null) usingCards = detectDefaultView();
    usingCards = !usingCards;
    applyViewMode();
    renderProducts(false);
  });

  window.addEventListener("resize", debounce(() => {
    if (usingCards === null) return;
    if (window.innerWidth < 560 && usingCards === false) {
      usingCards = true;
      applyViewMode();
      renderProducts(false);
    }
  }, 250));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!els.scannerOverlay.classList.contains("hidden")) {
        scanner.stop(); closeScannerOverlay();
      }
      if (!els.productModal.classList.contains("hidden")) closeProductModal();
    }
  });

  if (els.loadMoreBtn) {
    els.loadMoreBtn.addEventListener("click", () => loadMoreProducts());
  }
}

function setupIntersectionObserver() {
  if (!('IntersectionObserver' in window)) return;
  intersectionObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        loadMoreProducts();
      }
    });
  }, { root: null, rootMargin: "200px", threshold: 0 });
}

function observeSentinel() {
  if (intersectionObserver && els.infiniteSentinel) {
    intersectionObserver.unobserve(els.infiniteSentinel);
    intersectionObserver.observe(els.infiniteSentinel);
  }
}

function detectDefaultView() {
  return window.innerWidth >= 960 ? false : true;
}

/* Login */
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
  usingCards = detectDefaultView();
  applyViewMode();
  reloadAll(true);
}

/* Filtros */
function onFilterChanged() {
  reloadAll(true);
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

/* Carregamento */
async function reloadAll() {
  setTableLoading();
  const filters = getFilterOptions();
  try {
    await productsService.loadNext(filters, true);
    populateFilters(productsService.cache.products);
    renderProducts(false);
    if (!productsService.cache.allLoaded) {
      observeSentinel();
    }
    updateInfiniteStatus();
  } catch (err) {
    setTableError(err.message || "Erro ao carregar produtos");
  }
}

async function loadMoreProducts() {
  const filters = getFilterOptions();
  if (productsService.cache.loading || productsService.cache.allLoaded) {
    updateInfiniteStatus();
    return;
  }
  updateInfiniteStatus("loading");
  try {
    await productsService.loadNext(filters, false);
    renderProducts(false);
    updateInfiniteStatus();
  } catch (err) {
    updateInfiniteStatus("error", err.message);
  }
}

function updateInfiniteStatus(state, msg) {
  if (!els.infiniteStatus) return;
  if (state === "loading") {
    els.infiniteStatus.innerHTML = `<span class="muted">Carregando mais...</span>`;
  } else if (state === "error") {
    els.infiniteStatus.innerHTML = `<span style="color:#ff6d6d;">Erro ao carregar: ${escapeHtml(msg||"")}</span>`;
  } else {
    if (productsService.cache.allLoaded) {
      els.infiniteStatus.innerHTML = `<span class="muted">Todos os produtos carregados (${productsService.cache.products.length})</span>`;
    } else {
      els.infiniteStatus.innerHTML = `<span class="muted">Descendo carrega mais...</span>`;
    }
  }
  if (!('IntersectionObserver' in window) && els.loadMoreBtn) {
    els.loadMoreBtn.style.display = productsService.cache.allLoaded ? "none" : "inline-block";
  }
}

function populateFilters(products) {
  const groups = [...new Set(products.map(p=>p.group))].filter(Boolean).sort();
  const gCurrent = els.groupFilter.value;
  els.groupFilter.innerHTML = "<option value=''>Todos</option>" +
    groups.map(g=>`<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  if (groups.includes(gCurrent)) els.groupFilter.value = gCurrent;

  const brands = [...new Set(products.map(p=>p.brand))].filter(Boolean).sort();
  const bCurrent = els.brandFilter.value;
  els.brandFilter.innerHTML = "<option value=''>Todas</option>" +
    brands.map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
  if (brands.includes(bCurrent)) els.brandFilter.value = bCurrent;
}

function renderProducts() {
  const products = productsService.cache.products;
  if (!products.length) { setTableEmpty(); updateInfiniteStatus(); return; }
  const opts = getFilterOptions();
  const filtered = productsService
    .filter(products, opts)
    .sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate));
  if (usingCards) renderCards(filtered, opts);
  else renderTable(filtered, opts);
  updateInfiniteStatus();
}

function renderTable(filtered, opts) {
  if (!filtered.length) {
    els.tbody.innerHTML = `<tr><td colspan="9" class="center muted">Nenhum produto com esses filtros.</td></tr>`;
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
  tr.querySelector(".col-group").textContent = product.group || "-";
  tr.querySelector(".col-brand").textContent = product.brand || "-";

  const expiryCell = tr.querySelector(".col-expiry");
  expiryCell.textContent = formatDateBR(product.expiryDate);

  const daysCell = tr.querySelector(".col-days");
  daysCell.textContent = days;
  if (days < 0) daysCell.classList.add("negative");
  else if (days <= parseInt(els.thresholdDays.value,10)) daysCell.classList.add("warning");

  tr.querySelector(".col-status").appendChild(buildBadge(status));
  const actionCell = tr.querySelector(".col-action");
  actionCell.appendChild(buildEditButton(product, expiryCell, actionCell));
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
    els.cardsContainer.innerHTML = `<div class="muted" style="grid-column:1/-1;font-size:.75rem;">Nenhum produto com esses filtros.</div>`;
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
  card.querySelector(".pc-group").textContent = product.group || "-";
  card.querySelector(".pc-brand").textContent = product.brand || "-";
  card.querySelector(".pc-barcode").textContent = product.barcode || "-";
  card.querySelector(".pc-expiry").textContent = formatDateBR(product.expiryDate);
  const daysEl = card.querySelector(".pc-days");
  daysEl.textContent = days;
  if (days < 0) daysEl.style.color="#ff6d6d";
  else if (days <= parseInt(els.thresholdDays.value,10)) daysEl.style.color="var(--c-warn)";

  const actions = card.querySelector(".pc-actions");
  actions.appendChild(buildEditButton(product, card.querySelector(".pc-expiry"), actions, true));
  if (status === "expired" && !product.removed) {
    actions.appendChild(buildRemoveButton(product.id, true));
  } else if (status === "removed") {
    const span = document.createElement("span");
    span.className="muted"; span.textContent="Removido";
    actions.appendChild(span); card.style.opacity=.55;
  }
  return card;
}

/* ====== EDIÇÃO AMPLIADA (Validade, Estoque, Preço1, Preço2) ====== */
function buildEditButton(product, expiryDisplayEl, actionContainerEl, isCard=false) {
  const btn = document.createElement("button");
  btn.className = "btn small";
  btn.textContent = "Editar";
  btn.title = "Alterar validade / estoque / preços";
  btn.addEventListener("click", () => startMultiEdit(product, expiryDisplayEl, actionContainerEl, isCard));
  return btn;
}

function startMultiEdit(product, expiryCellEl, actionCellEl, isCard) {
  if (editingRowId && editingRowId !== product.id) return;
  if (editingRowId === product.id) return;
  editingRowId = product.id;

  // Guardar valores originais
  const original = {
    expiryDate: product.expiryDate,
    stock: product.stock,
    price: product.price,
    price2: product.price2
  };

  // Limpa área da ação e (opcional) a célula de validade (para caso de tabela)
  if (!isCard) {
    actionCellEl.innerHTML = "";
  } else {
    actionCellEl.innerHTML = "";
  }

  // Container de edição
  const wrap = document.createElement("div");
  wrap.className = "multi-edit";
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = ".35rem";
  wrap.style.minWidth = isCard ? "100%" : "240px";

  // Linha 1: Validade
  const line1 = document.createElement("div");
  line1.style.display = "flex";
  line1.style.gap = ".25rem";
  line1.style.flexWrap = "wrap";

  const inputDate = document.createElement("input");
  inputDate.type = "date";
  inputDate.value = original.expiryDate;
  inputDate.style.flex = "1";

  // Linha 2: Estoque / Preço1 / Preço2
  const line2 = document.createElement("div");
  line2.style.display = "flex";
  line2.style.gap = ".25rem";
  line2.style.flexWrap = "wrap";

  const inputStock = document.createElement("input");
  inputStock.type = "number";
  inputStock.placeholder = "Estoque";
  inputStock.value = original.stock ?? "";
  inputStock.style.width = "75px";

  const inputPrice1 = document.createElement("input");
  inputPrice1.type = "number";
  inputPrice1.step = "0.01";
  inputPrice1.placeholder = "Preço1";
  inputPrice1.value = original.price ?? "";
  inputPrice1.style.width = "80px";

  const inputPrice2 = document.createElement("input");
  inputPrice2.type = "number";
  inputPrice2.step = "0.01";
  inputPrice2.placeholder = "Preço2";
  inputPrice2.value = original.price2 ?? "";
  inputPrice2.style.width = "80px";

  // Linha 3: Botões
  const line3 = document.createElement("div");
  line3.style.display = "flex";
  line3.style.gap = ".35rem";

  const btnSave = document.createElement("button");
  btnSave.className = "btn small primary";
  btnSave.textContent = "Salvar";

  const btnCancel = document.createElement("button");
  btnCancel.className = "btn small";
  btnCancel.textContent = "Cancelar";

  line1.appendChild(labelWrap("Validade", inputDate));
  line2.appendChild(labelWrap("Estoque", inputStock));
  line2.appendChild(labelWrap("Preço1", inputPrice1));
  line2.appendChild(labelWrap("Preço2", inputPrice2));
  line3.appendChild(btnSave);
  line3.appendChild(btnCancel);

  wrap.appendChild(line1);
  wrap.appendChild(line2);
  wrap.appendChild(line3);

  actionCellEl.appendChild(wrap);

  if (!isCard) {
    // Atualiza célula de validade para dentro da edição (mostrar ISO atual formatado)
    expiryCellEl.textContent = formatDateBR(original.expiryDate);
  }

  inputDate.focus();

  btnSave.addEventListener("click", async () => {
    const newIso = inputDate.value;
    const newStock = inputStock.value === "" ? null : Number(inputStock.value);
    const newPrice1 = inputPrice1.value === "" ? null : Number(inputPrice1.value);
    const newPrice2 = inputPrice2.value === "" ? null : Number(inputPrice2.value);

    // Monta objeto apenas com mudanças
    const patch = {};
    if (newIso && newIso !== original.expiryDate) patch.expiryDate = newIso;
    if (newStock !== null && newStock !== original.stock) patch.stock = newStock;
    if (newPrice1 !== null && newPrice1 !== original.price) patch.price = newPrice1;
    if (newPrice2 !== null && newPrice2 !== original.price2) patch.price2 = newPrice2;

    if (!Object.keys(patch).length) {
      cancelEdit();
      return;
    }

    disableEditing(true);
    try {
      await api.updateProduct(product.id, patch);
      productsService.updateLocal(product.id, patch);
      editingRowId = null;
      toast("Registro atualizado");
      renderProducts(false);
    } catch (err) {
      alert("Falha ao atualizar: " + (err.message || err));
      disableEditing(false);
    }
  });

  btnCancel.addEventListener("click", cancelEdit);

  function cancelEdit() {
    editingRowId = null;
    renderProducts(false);
  }

  function disableEditing(disabled) {
    [inputDate, inputStock, inputPrice1, inputPrice2, btnSave, btnCancel]
      .forEach(el => el.disabled = disabled);
  }
}

function labelWrap(lbl, inputEl) {
  const w = document.createElement("label");
  w.style.display = "flex";
  w.style.flexDirection = "column";
  w.style.fontSize = ".55rem";
  w.style.flex = "1";
  const span = document.createElement("span");
  span.textContent = lbl;
  span.style.opacity = ".75";
  span.style.marginBottom = ".15rem";
  span.style.fontSize = ".55rem";
  w.appendChild(span);
  w.appendChild(inputEl);
  inputEl.style.padding = ".25rem";
  inputEl.style.fontSize = ".65rem";
  inputEl.style.border = "1px solid var(--c-border)";
  inputEl.style.borderRadius = "4px";
  inputEl.style.background = "var(--c-bg-soft)";
  inputEl.style.color = "var(--c-text)";
  return w;
}

/* Remoção */
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
    await api.removeProduct(id);
    const prod = productsService.cache.products.find(p=>p.id===id);
    if (prod) prod.removed = true;
    renderProducts(false);
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
    expiryDate: fd.get("expiryDate"),
    price: Number(fd.get("price") || 0),
    unit: (fd.get("unit") || "").trim()
  };
  if (!payload.code || !payload.name || !payload.group || !payload.brand || !payload.expiryDate) {
    showProductError("Preencha todos os campos obrigatórios.");
    return;
  }
  setProductFormDisabled(true);
  try {
    const prod = await api.addProduct(payload);
    productsService.addLocal(prod);
    closeProductModal();
    populateFilters(productsService.cache.products);
    renderProducts(false);
  } catch(err){
    showProductError(err.message || "Erro ao adicionar produto");
  } finally {
    setProductFormDisabled(false);
  }
}
function showProductError(msg){ els.productError.textContent=msg; els.productError.hidden=false; }
function setProductFormDisabled(disabled){ [...els.productForm.elements].forEach(el=>el.disabled=disabled); }

/* Scanner */
function openScannerOverlay() {
  els.scannerOverlay.classList.remove("hidden");
}
function closeScannerOverlay() {
  scanner.stop();
  els.scannerOverlay.classList.add("hidden");
}

/* Utilidades */
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
  updateInfiniteStatus("loading");
}
function setTableError(msg){
  els.tbody.innerHTML = `<tr><td colspan="9" class="center" style="color:#ff9e9e;">Erro: ${escapeHtml(msg)}</td></tr>`;
  els.cardsContainer.innerHTML = `<div style="color:#ff6d6d;">Erro: ${escapeHtml(msg)}</div>`;
  updateInfiniteStatus("error", msg);
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
function escapeHtml(str=""){
  return str.replace(/[&<>\"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c] || c));
}
function debounce(fn, wait=300){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),wait); };
}
function applyViewMode(){
  if(usingCards){
    els.tableView.classList.add("hidden");
    els.cardsView.classList.remove("hidden");
    els.toggleViewBtn.textContent="📋";
    els.toggleViewBtn.title="Modo tabela";
  } else {
    els.tableView.classList.remove("hidden");
    els.cardsView.classList.add("hidden");
    els.toggleViewBtn.textContent="🗂";
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