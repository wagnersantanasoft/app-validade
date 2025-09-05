/**
 * products.js
 * Lida com cache, cálculos e filtros.
 */
import { api } from "./api.js";
import { auth } from "./auth.js";

export const productsService = {
  cache: {
    products: [],
    lastFetch: 0
  },

  async load(force = false) {
    if (!force && Date.now() - this.cache.lastFetch < 15_000 && this.cache.products.length) {
      return this.cache.products;
    }
    const token = auth.getToken();
    const products = await api.getProducts(token);
    this.cache.products = products;
    this.cache.lastFetch = Date.now();
    return products;
  },

  addLocal(product) {
    this.cache.products.push(product);
  },

  updateLocal(id, data) {
    const p = this.cache.products.find(p => p.id === id);
    if (p) Object.assign(p, data);
  },

  computeStatus(product, thresholdDays) {
    const today = new Date();
    const expiry = new Date(product.expiryDate + "T00:00:00");
    const diffMs = expiry - today;
    const days = Math.floor(diffMs / 86400000);
    let status;
    if (product.removed) status = "removed";
    else if (days < 0) status = "expired";
    else if (days <= thresholdDays) status = "near";
    else status = "ok";
    return { days, status };
  },

  filter(products, { group, search, status, thresholdDays, showRemoved }) {
    return products.filter(p => {
      const { status: st } = this.computeStatus(p, thresholdDays);
      if (!showRemoved && st === "removed") return false;
      if (group && p.group !== group) return false;
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