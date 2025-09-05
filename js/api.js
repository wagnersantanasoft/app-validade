/**
 * api.js
 * Capa de acesso à API (real ou mock).
 * Adicionados: addProduct e updateProduct (alterar validade / outros campos).
 */

const BASE_URL = ""; // Exemplo: "https://suaapi.com"

export const api = {
  async login(username, password) {
    if (BASE_URL) {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error("Credenciais inválidas");
      return res.json();
    }
    return mockApi.login(username, password);
  },

  async getProducts(token) {
    if (BASE_URL) {
      const res = await fetch(`${BASE_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro ao buscar produtos");
      return res.json();
    }
    return mockApi.getProducts(token);
  },

  async removeProduct(id, token) {
    if (BASE_URL) {
      const res = await fetch(`${BASE_URL}/products/${id}/remove`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro ao remover produto");
      return res.json();
    }
    return mockApi.removeProduct(id, token);
  },

  async addProduct(data, token) {
    if (BASE_URL) {
      const res = await fetch(`${BASE_URL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Erro ao adicionar produto");
      return res.json();
    }
    return mockApi.addProduct(data, token);
  },

  async updateProduct(id, data, token) {
    if (BASE_URL) {
      const res = await fetch(`${BASE_URL}/products/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Erro ao atualizar produto");
      return res.json();
    }
    return mockApi.updateProduct(id, data, token);
  }
};

/* ================= MOCK API ================= */
const mockApi = (() => {
  const USERS = [
    { id: 1, username: "admin", password: "admin123", name: "Administrador" },
    { id: 2, username: "demo", password: "demo", name: "Usuário Demo" }
  ];

  function futureDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function pastDate(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  let nextId = 600;

  let PRODUCTS = [
    { id: 101, code: "L001", barcode: "7891000000001", name: "Leite Integral 1L", group: "Laticínios", expiryDate: futureDate(5), removed: false },
    { id: 102, code: "L002", barcode: "7891000000002", name: "Queijo Prato 500g", group: "Laticínios", expiryDate: futureDate(18), removed: false },
    { id: 103, code: "L003", barcode: "7891000000003", name: "Iogurte Natural 170g", group: "Laticínios", expiryDate: futureDate(2), removed: false },
    { id: 201, code: "M001", barcode: "7892000000001", name: "Macarrão Espaguete 500g", group: "Massas", expiryDate: futureDate(120), removed: false },
    { id: 202, code: "M002", barcode: "7892000000002", name: "Macarrão Parafuso 500g", group: "Massas", expiryDate: futureDate(40), removed: false },
    { id: 301, code: "B001", barcode: "7893000000001", name: "Biscoito Recheado", group: "Biscoitos", expiryDate: futureDate(25), removed: false },
    { id: 302, code: "B002", barcode: "7893000000002", name: "Biscoito Cream Cracker", group: "Biscoitos", expiryDate: futureDate(12), removed: false },
    { id: 401, code: "C001", barcode: "7894000000001", name: "Cereal Matinal Chocolate", group: "Cereais", expiryDate: pastDate(3), removed: false },
    { id: 402, code: "C002", barcode: "7894000000002", name: "Aveia em Flocos", group: "Cereais", expiryDate: futureDate(55), removed: false },
    { id: 501, code: "BEB001", barcode: "7895000000001", name: "Suco de Laranja 1L", group: "Bebidas", expiryDate: futureDate(9), removed: false },
    { id: 502, code: "BEB002", barcode: "7895000000002", name: "Refrigerante Cola 2L", group: "Bebidas", expiryDate: pastDate(1), removed: false },
    { id: 503, code: "BEB003", barcode: "7895000000003", name: "Água Mineral 500ml", group: "Bebidas", expiryDate: futureDate(365), removed: false }
  ];

  return {
    async login(username, password) {
      await delay(300);
      const user = USERS.find(u => u.username === username && u.password === password);
      if (!user) throw new Error("Usuário ou senha inválidos");
      return {
        token: btoa(`${user.id}:${Date.now()}`),
        user: { id: user.id, name: user.name, username: user.username }
      };
    },
    async getProducts() {
      await delay(250);
      return PRODUCTS.map(p => ({ ...p }));
    },
    async removeProduct(id) {
      await delay(150);
      const idx = PRODUCTS.findIndex(p => p.id === id);
      if (idx >= 0) PRODUCTS[idx].removed = true;
      return { success: true };
    },
    async addProduct(data) {
      await delay(200);
      const existsCode = PRODUCTS.some(p => p.code.toLowerCase() === data.code.toLowerCase());
      if (existsCode) throw new Error("Código já existente");
      const prod = {
        id: nextId++,
        code: data.code.trim(),
        barcode: data.barcode?.trim() || "",
        name: data.name.trim(),
        group: data.group.trim(),
        expiryDate: data.expiryDate,
        removed: false
      };
      PRODUCTS.push(prod);
      return prod;
    },
    async updateProduct(id, patch) {
      await delay(180);
      const prod = PRODUCTS.find(p => p.id === id);
      if (!prod) throw new Error("Produto não encontrado");
      Object.assign(prod, patch);
      return { ...prod };
    }
  };
})();

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}