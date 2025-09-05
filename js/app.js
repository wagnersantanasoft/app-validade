/**
 * app.js
 * Integra UI, scanner, tema, CRUD local (mock) de produtos.
 */

import { auth } from "./auth.js";
import { productsService } from "./products.js";
import { api } from "./api.js";
import { scanner } from "./scanner.js";
import { toggleTheme } from "./theme.js";

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
  toggleTorch: document.getElementById("toggle-torch"),
  switchCamera: document.getElementById("switch-camera"),

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
let usingCards = false;
let editingRowId = null;

init();

function init() {
  bindEvents();
  if (auth.isAuthenticated()) {
    enterApp();
  } else {
    showLogin();
  }
}

function bindEvents() {
  els.loginForm.addEventListener("submit", onLoginSubmit);
  els.logoutBtn.addEventListener("click", () => { auth.logout(); showLogin(); });
  els.refreshBtn.addEventListener("click", () => loadAndRender(true));

  els.groupFilter.addEventListener("change", renderProducts);
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

  // Scanner
  els.scanBtn.addEventListener("click", openScanner);
  els.closeScanner.addEventListener("click", closeScanner);
  scanner.onResult(code => {
    els.searchFilter.value = code;
    closeScanner();
    renderProducts();
  });
  scanner.onStatus(msg => els.scannerStatus.textContent = msg);
  scanner.onTorchAvailability(avail => els.toggleTorch.hidden = !avail);
  scanner.onMultipleCameras(hasMulti => els.switchCamera.hidden = !hasMulti);
  els.toggleTorch.addEventListener("click", () => scanner.toggleTorch());
  els.switchCamera.addEventListener("click", () => scanner.switchCamera());
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!els.scannerOverlay.classList.contains("hidden")) closeScanner();
      if (!els.productModal.classList.contains("hidden")) closeProductModal();
    }
  });

  // Tema
  els.themeToggle.addEventListener("click", () => toggleTheme());

  // Modal Produto
  els.addProductBtn.addEventListener("click", openProductModal);
  els.closeModal.addEventListener("click", closeProductModal);
  els.cancelModal.addEventListener("click", closeProductModal);
  els.productForm.addEventListener("submit", onProductSubmit);

  // Alternar visualização
  els.toggleViewBtn.addEventListener("click", () => {
    usingCards = !usingCards;
    applyViewMode();
    renderProducts();
  });

  // Ajuste inicial baseado em largura
  if (window.innerWidth < 600) {
    usingCards = true;
  }
  applyViewMode();
  window.addEventListener("resize", debounce(() => {
    if (window.innerWidth < 560 && !usingCards) {
      usingCards = true;
      applyViewMode();
      renderProducts();
    }
  }, 300));
}

function applyViewMode() {
  if (usingCards) {
    els.tableView.classList.add("hidden");
    els.cardsView.classList.remove("hidden");
    els.toggleViewBtn.textContent = "📋";
    els.toggleViewBtn.title = "Modo tabela";
  } else {
    els.tableView.classList.remove("hidden");
    els.cardsView.classList.add("hidden");
    els.toggleViewBtn.textContent = "🗂";
    els.toggleViewBtn.title = "Modo cartões";
  }
}

/* ========== Login ========== */
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
  const session = auth.getSession();
  els.userBadge.textContent = session?.user?.name || session?.user?.username || "?";
  loadAndRender(true);
}

/* ========== Carregamento e Renderização ========== */
async function loadAndRender(force = false) {
  setTableLoading();
  try {
    const products = await productsService.load(force);
    populateGroupFilter(products);
    renderProducts();
  } catch (err) {
    setTableError(err.message || "Erro ao carregar produtos");
  }
}

function populateGroupFilter(products) {
  const groups = [...new Set(products.map(p => p.group))].sort();
  const current = els.groupFilter.value;
  els.groupFilter.innerHTML = "<option value=''>Todos</option>" +
    groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  if (groups.includes(current)) {
    els.groupFilter.value = current;
  }
}

function getFilterOptions() {
  return {
    group: els.groupFilter.value,
    search: els.searchFilter.value.trim(),
    status: currentStatusFilter,
    thresholdDays: parseInt(els.thresholdDays.value, 10) || 15,
    showRemoved: els.showRemoved.checked
  };
}

function renderProducts() {
  const products = productsService.cache.products;
  if (!products.length) {
    setTableEmpty();
    return;
  }
  const opts = getFilterOptions();
  const filtered = productsService.filter(products, opts)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (usingCards) {
    renderCards(filtered, opts);
  } else {
    renderTable(filtered, opts);
  }
}

function renderTable(filtered, opts) {
  if (!filtered.length) {
    els.tbody.innerHTML = `<tr><td colspan="8" class="center muted">Nenhum produto encontrado.</td></tr>`;
    return;
  }
  const frag = document.createDocumentFragment();
  filtered.forEach(product => {
    const { days, status } = productsService.computeStatus(product, opts.thresholdDays);
    frag.appendChild(renderRow(product, days, status));
  });
  els.tbody.innerHTML = "";
  els.tbody.appendChild(frag);
}

function renderRow(product, days, status) {
  const clone = els.rowTemplate.content.firstElementChild.cloneNode(true);

  clone.querySelector(".col-code").textContent = product.code;
  clone.querySelector(".col-barcode").textContent = product.barcode || "-";
  clone.querySelector(".col-name").textContent = product.name;
  clone.querySelector(".col-group").textContent = product.group;

  const expiryCell = clone.querySelector(".col-expiry");
  expiryCell.textContent = formatDateBR(product.expiryDate);

  const daysCell = clone.querySelector(".col-days");
  daysCell.textContent = days;
  if (days < 0) daysCell.classList.add("negative");
  else if (days <= parseInt(els.thresholdDays.value, 10)) daysCell.classList.add("warning");

  const statusCell = clone.querySelector(".col-status");
  statusCell.appendChild(buildBadge(status));

  const actionCell = clone.querySelector(".col-action");
  actionCell.appendChild(buildEditButton(product, expiryCell));
  if (status === "expired" && !product.removed) {
    actionCell.appendChild(buildRemoveButton(product.id));
  } else if (status === "removed") {
    const span = document.createElement("span");
    span.className = "muted";
    span.style.fontSize = ".55rem";
    span.textContent = "Removido";
    actionCell.appendChild(span);
    clone.style.opacity = .55;
  }

  return clone;
}

/* Cards */
function renderCards(filtered, opts) {
  if (!filtered.length) {
    els.cardsContainer.innerHTML = `<div class="muted" style="grid-column:1/-1;font-size:.75rem;">Nenhum produto encontrado.</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  filtered.forEach(product => {
    const { days, status } = productsService.computeStatus(product, opts.thresholdDays);
    frag.appendChild(renderCard(product, days, status));
  });
  els.cardsContainer.innerHTML = "";
  els.cardsContainer.appendChild(frag);
}

function renderCard(product, days, status) {
  const card = els.cardTemplate.content.firstElementChild.cloneNode(true);

  card.querySelector(".pc-code").textContent = product.code;
  const statusHolder = card.querySelector(".pc-status");
  statusHolder.appendChild(buildBadge(status));

  card.querySelector(".pc-name").textContent = product.name;
  card.querySelector(".pc-group").textContent = product.group;
  card.querySelector(".pc-barcode").textContent = product.barcode || "-";
  card.querySelector(".pc-expiry").textContent = formatDateBR(product.expiryDate);

  const daysEl = card.querySelector(".pc-days");
  daysEl.textContent = days;
  if (days < 0) daysEl.style.color = "#ff6d6d";
  else if (days <= parseInt(els.thresholdDays.value, 10)) daysEl.style.color = "var(--c-warn)";

  const actions = card.querySelector(".pc-actions");
  actions.appendChild(buildEditButton(product, card.querySelector(".pc-expiry"), true));
  if (status === "expired" && !product.removed) {
    actions.appendChild(buildRemoveButton(product.id, true));
  } else if (status === "removed") {
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = "Removido";
    actions.appendChild(span);
    card.style.opacity = .55;
  }

  return card;
}

/* Botões Helpers */
function buildEditButton(product, expiryDisplayEl, compact = false) {
  const btn = document.createElement("button");
  btn.className = "btn " + (compact ? "small" : "small");
  btn.textContent = "Editar";
  btn.title = "Alterar validade";
  btn.addEventListener("click", () => startInlineEdit(product, expiryDisplayEl, btn));
  return btn;
}

function startInlineEdit(product, expiryDisplayEl, btn) {
  if (editingRowId && editingRowId !== product.id) return; // permitir um por vez
  if (editingRowId === product.id) return;
  editingRowId = product.id;

  const original = product.expiryDate;
  const wrapper = document.createElement("div");
  wrapper.className = "edit-inline";
  const input = document.createElement("input");
  input.type = "date";
  input.value = original;
  input.min = "2000-01-01";
  input.max = "2100-12-31";

  const save = document.createElement("button");
  save.className = "btn small primary";
  save.textContent = "OK";

  const cancel = document.createElement("button");
  cancel.className = "btn small";
  cancel.textContent = "X";

  expiryDisplayEl.innerHTML = "";
  expiryDisplayEl.appendChild(wrapper);
  wrapper.appendChild(input);
  wrapper.appendChild(save);
  wrapper.appendChild(cancel);

  input.focus();

  save.addEventListener("click", async () => {
    const newDate = input.value;
    if (!newDate) return;
    save.disabled = true;
    try {
      await api.updateProduct(product.id, { expiryDate: newDate }, auth.getToken());
      productsService.updateLocal(product.id, { expiryDate: newDate });
      editingRowId = null;
      expiryDisplayEl.textContent = formatDateBR(newDate);
      renderProducts(); // atualiza status/dias
    } catch (err) {
      alert("Falha ao atualizar: " + err.message);
      save.disabled = false;
    }
  });

  cancel.addEventListener("click", () => {
    editingRowId = null;
    expiryDisplayEl.textContent = formatDateBR(original);
  });
}

function buildRemoveButton(id, compact = false) {
  const btn = document.createElement("button");
  btn.className = "btn danger " + (compact ? "small" : "small");
  btn.textContent = "Remover";
  btn.addEventListener("click", () => onRemove(id, btn));
  return btn;
}

/* CRUD Ações */
async function onRemove(id, btn) {
  btn.disabled = true;
  try {
    await api.removeProduct(id, auth.getToken());
    const prod = productsService.cache.products.find(p => p.id === id);
    if (prod) prod.removed = true;
    renderProducts();
  } catch (err) {
    alert("Falha ao remover: " + err.message);
    btn.disabled = false;
  }
}

/* Modal Novo Produto */
function openProductModal() {
  els.productForm.reset();
  els.productError.hidden = true;
  els.modalTitle.textContent = "Novo Produto";
  els.productModal.classList.remove("hidden");
  document.getElementById("p-code").focus();
}

function closeProductModal() {
  els.productModal.classList.add("hidden");
}

async function onProductSubmit(e) {
  e.preventDefault();
  els.productError.hidden = true;
  const formData = new FormData(els.productForm);
  const payload = {
    code: formData.get("code").trim(),
    barcode: formData.get("barcode").trim(),
    name: formData.get("name").trim(),
    group: formData.get("group").trim(),
    expiryDate: formData.get("expiryDate")
  };
  if (!payload.code || !payload.name || !payload.group || !payload.expiryDate) {
    showProductError("Preencha todos os campos obrigatórios.");
    return;
  }
  setProductFormDisabled(true);
  try {
    const prod = await api.addProduct(payload, auth.getToken());
    productsService.addLocal(prod);
    closeProductModal();
    populateGroupFilter(productsService.cache.products);
    renderProducts();
  } catch (err) {
    showProductError(err.message || "Erro ao adicionar produto");
  } finally {
    setProductFormDisabled(false);
  }
}

function showProductError(msg) {
  els.productError.textContent = msg;
  els.productError.hidden = false;
}

function setProductFormDisabled(disabled) {
  [...els.productForm.elements].forEach(el => el.disabled = disabled);
}

/* ========== Utilidades de UI ========== */
function buildBadge(status) {
  const span = document.createElement("span");
  span.classList.add("badge");
  switch (status) {
    case "ok":
      span.textContent = "OK";
      span.classList.add("ok");
      break;
    case "near":
      span.textContent = "PRÓXIMO";
      span.classList.add("near");
      break;
    case "expired":
      span.textContent = "VENCIDO";
      span.classList.add("expired");
      break;
    case "removed":
      span.textContent = "REMOVIDO";
      span.classList.add("removed");
      break;
    default:
      span.textContent = status.toUpperCase();
  }
  return span;
}

function setTableLoading() {
  els.tbody.innerHTML = `<tr><td colspan="8" class="center muted">Carregando...</td></tr>`;
  els.cardsContainer.innerHTML = "";
}

function setTableError(msg) {
  els.tbody.innerHTML = `<tr><td colspan="8" class="center" style="color:#ff9e9e;">Erro: ${escapeHtml(msg)}</td></tr>`;
  els.cardsContainer.innerHTML = `<div style="color:#ff6d6d;">Erro: ${escapeHtml(msg)}</div>`;
}

function setTableEmpty() {
  els.tbody.innerHTML = `<tr><td colspan="8" class="center muted">Nenhum produto.</td></tr>`;
  els.cardsContainer.innerHTML = `<div class="muted">Nenhum produto.</div>`;
}

function formatDateBR(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ========== Scanner ========== */
function openScanner() {
  els.scannerOverlay.classList.remove("hidden");
  scanner.start();
}
function closeScanner() {
  scanner.stop();
  els.scannerOverlay.classList.add("hidden");
}