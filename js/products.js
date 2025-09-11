/**
 * products.js
 * Agora com suporte a carregamento incremental (lazy).
 * Mantém cache global e sabe se todas as páginas foram carregadas.
 */
import { api } from "./api.js";
import { auth } from "./auth.js";

const DEFAULT_PAGE_SIZE = 50;

export const productsService = {
  cache: {
    products: [],
    lastFetch: 0,
    pageLoaded: 0,
    total: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    loading: false,
    allLoaded: false,
    lastFiltersKey: ""
  },

  /**
   * Reseta cache quando filtros mudam.
   */
  resetIfFiltersChanged(filters) {
    const key = JSON.stringify(filters);
    if (key !== this.cache.lastFiltersKey) {
      this.cache.products = [];
      this.cache.pageLoaded = 0;
      this.cache.total = 0;
      this.cache.allLoaded = false;
      this.cache.lastFiltersKey = key;
    }
  },

  /**
   * Carrega próxima página (ou primeira) respeitando filtros.
   */
  async loadNext(filters, force = false) {
    this.resetIfFiltersChanged(filters);
    if (this.cache.loading) return;
    if (this.cache.allLoaded && !force) return;

    this.cache.loading = true;
    try {
      const nextPage = force ? 1 : (this.cache.pageLoaded + 1);
      if (force) {
        this.cache.products = [];
        this.cache.pageLoaded = 0;
        this.cache.total = 0;
        this.cache.allLoaded = false;
      }

      const token = auth.getToken(); // mantido caso precise no futuro
      const { search, group, brand } = filters;
      const resp = await api.getProductsPage({
        page: nextPage,
        pageSize: this.cache.pageSize,
        search, group, brand
      });

      if (nextPage === 1) {
        this.cache.products = resp.items;
      } else {
        // Evita duplicados (caso backend repita)
        const existingIds = new Set(this.cache.products.map(p => p.id));
        resp.items.forEach(p => { if (!existingIds.has(p.id)) this.cache.products.push(p); });
      }

      this.cache.pageLoaded = resp.page;
      this.cache.total = resp.total;
      this.cache.allLoaded = !resp.hasMore;
      this.cache.lastFetch = Date.now();

      // Se fallback trouxe _allIfFallback e estamos na primeira página, armazenamos tudo
      if (resp._allIfFallback && nextPage === 1 && api.getPaginationCapability() === "unsupported") {
        // Já carregamos tudo, marca allLoaded
        this.cache.allLoaded = true;
        this.cache.products = resp._allIfFallback;
      }

      return { newItems: resp.items, hasMore: !this.cache.allLoaded };
    } finally {
      this.cache.loading = false;
    }
  },

  addLocal(product) {
    // Insere no topo por convenção
    this.cache.products.unshift(product);
    this.cache.total += 1;
  },

  updateLocal(id, data) {
    const p = this.cache.products.find(p => p.id === id);
    if (p) Object.assign(p, data);
  },

  computeStatus(product, thresholdDays) {
    const today = new Date();
    const expiry = new Date(product.expiryDate + "T00:00:00");
    const diff = expiry - today;
    const days = Math.floor(diff / 86400000);
    let status;
    if (product.removed) status = "removed";
    else if (days < 0) status = "expired";
    else if (days <= thresholdDays) status = "near";
    else status = "ok";
    return { days, status };
  },

  filter(products, { group, brand, search, status, thresholdDays, showRemoved }) {
    return products.filter(p => {
      const { status: st } = this.computeStatus(p, thresholdDays);
      if (!showRemoved && st === "removed") return false;
      if (group && p.group !== group) return false;
      if (brand && p.brand !== brand) return false;
      if (status && status !== "all" && st !== status) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(
          p.name.toLowerCase().includes(s) ||
          p.code.toLowerCase().includes(s) ||
          (p.barcode && p.barcode.toLowerCase().includes(s))
        )) return false;
      }
      return true;
    });
  }
};