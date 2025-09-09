/**
 * api.js
 * Mock com campo 'brand'. Ajuste BASE_URL para backend real.
 */
const BASE_URL = ""; // ex: "https://suaapi.com"

export const api = {
  async login(username, password) {
    if (BASE_URL) {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
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
          "Content-Type":"application/json",
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
          "Content-Type":"application/json",
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

/* Mock */
const mockApi = (() => {
  const USERS = [
    { id: 1, username: "admin", password: "admin123", name: "Administrador" }
  ];

  function future(days) {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }
  function past(days) {
    const d = new Date(); d.setDate(d.getDate() - days);
    return d.toISOString().slice(0,10);
  }

  let nextId = 900;
  let PRODUCTS = [
    { id:101, code:"L001", barcode:"7891000000001", name:"Leite Integral 1L", group:"Laticínios", brand:"Fazenda Boa", expiryDate:future(5), removed:false },
    { id:102, code:"L002", barcode:"7891000000002", name:"Queijo Prato 500g", group:"Laticínios", brand:"LactoSul", expiryDate:future(18), removed:false },
    { id:103, code:"L003", barcode:"7891000000003", name:"Iogurte Natural 170g", group:"Laticínios", brand:"LactoSul", expiryDate:future(2), removed:false },
    { id:201, code:"M001", barcode:"7892000000001", name:"Macarrão Espaguete 500g", group:"Massas", brand:"MassaPura", expiryDate:future(120), removed:false },
    { id:202, code:"M002", barcode:"7892000000002", name:"Macarrão Parafuso 500g", group:"Massas", brand:"MassaPura", expiryDate:future(40), removed:false },
    { id:301, code:"B001", barcode:"7893000000001", name:"Biscoito Recheado", group:"Biscoitos", brand:"DoceCroc", expiryDate:future(25), removed:false },
    { id:302, code:"B002", barcode:"7893000000002", name:"Biscoito Cream Cracker", group:"Biscoitos", brand:"DoceCroc", expiryDate:future(12), removed:false },
    { id:401, code:"C001", barcode:"7894000000001", name:"Cereal Matinal Chocolate", group:"Cereais", brand:"NutriKids", expiryDate:past(3), removed:false },
    { id:402, code:"C002", barcode:"7894000000002", name:"Aveia em Flocos", group:"Cereais", brand:"GrãoVivo", expiryDate:future(55), removed:false },
    { id:501, code:"BEB001", barcode:"7895000000001", name:"Suco de Laranja 1L", group:"Bebidas", brand:"Frutale", expiryDate:future(9), removed:false },
    { id:502, code:"BEB002", barcode:"7895000000002", name:"Refrigerante Cola 2L", group:"Bebidas", brand:"Refrix", expiryDate:past(1), removed:false },
    { id:503, code:"BEB003", barcode:"7895000000003", name:"Água Mineral 500ml", group:"Bebidas", brand:"Fonte Clara", expiryDate:future(365), removed:false }
  ];

  return {
    async login(username, password) {
      await delay(250);
      const u = USERS.find(x => x.username === username && x.password === password);
      if (!u) throw new Error("Usuário ou senha inválidos");
      return {
        token: btoa(`${u.id}:${Date.now()}`),
        user: { id: u.id, name: u.name, username: u.username }
      };
    },
    async getProducts() {
      await delay(220);
      return PRODUCTS.map(p => ({ ...p }));
    },
    async removeProduct(id) {
      await delay(120);
      const p = PRODUCTS.find(p => p.id === id);
      if (p) p.removed = true;
      return { success:true };
    },
    async addProduct(data) {
      await delay(180);
      if (PRODUCTS.some(p => p.code.toLowerCase() === data.code.toLowerCase()))
        throw new Error("Código já existente");
      const prod = {
        id: nextId++,
        code: data.code.trim(),
        barcode: data.barcode?.trim() || "",
        name: data.name.trim(),
        group: data.group.trim(),
        brand: data.brand.trim(),
        expiryDate: data.expiryDate,
        price: Number(data.price) || 0,
        unit: (data.unit || "").trim(),
        removed: false
      };
      PRODUCTS.push(prod);
      return prod;
    },
    async updateProduct(id, patch) {
      await delay(160);
      const prod = PRODUCTS.find(p => p.id === id);
      if (!prod) throw new Error("Produto não encontrado");
      Object.assign(prod, patch);
      return { ...prod };
    }
  };
})();

function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }