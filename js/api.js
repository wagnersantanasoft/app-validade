/**
 * api.js
 * Ajustado para consumir a API externa em http://localhost:9000/produtos (somente leitura).
 * As demais operações (add/update/remove) permanecem locais (mock) ou retornam erro se desejar.
 *
 * O endpoint /produtos retorna registros como:
 * {
 *   "pro_codigo": "6",
 *   "pro_cod_barra": "7898201805295",
 *   "pro_nome": "ALL ATACK 1L",
 *   "pro_validade": "01/09/2025",
 *   "pro_estoq1": "11",
 *   "und_nome": "UN",
 *   "pro_preco1": "155",
 *   "pro_preco2": "150",
 *   "gp_descri": "MEDICAMENTOS",
 *   "mar_descri": ""
 * }
 *
 * Fazemos o mapeamento para o formato interno usado pela aplicação:
 * {
 *   id, code, barcode, name, group, brand, expiryDate (YYYY-MM-DD), price, unit, removed:false
 * }
 */

const EXTERNAL_PRODUCTS_ENDPOINT = "http://localhost:9000/produtos"; // Ajuste se necessário

export const api = {
  // Login segue mock (não há endpoint informado)
  async login(username, password) {
    return mockApi.login(username, password);
  },

  /**
   * Carrega produtos da API externa e mapeia para o modelo interno.
   * Se a resposta não for um array, tenta transformar num array.
   */
  async getProducts(_token) {
    try {
      const res = await fetch(EXTERNAL_PRODUCTS_ENDPOINT, {
        headers: {
          "Accept": "application/json"
        }
      });
      if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status}`);
      }
      let data = await res.json();

      // Caso o backend retorne objeto único em vez de array
      if (!Array.isArray(data)) {
        data = [data];
      }

      const mapped = data.map(mapBackendProduct).filter(Boolean);
      return mapped;
    } catch (err) {
      console.error("Falha ao buscar produtos externos, usando mock como fallback:", err);
      // Fallback opcional ao mock
      return mockApi.getProducts();
    }
  },

  /**
   * As operações abaixo não foram especificadas no backend fornecido.
   * Mantemos comportamento local (mock) para evitar quebrar a UI.
   * Se quiser bloquear totalmente, pode lançar erro.
   */

  async removeProduct(id, _token) {
    // Poderia lançar: throw new Error("Remoção não suportada pela API externa");
    return mockApi.removeProduct(id);
  },

  async addProduct(data, _token) {
    // Poderia lançar: throw new Error("Inclusão não suportada pela API externa");
    return mockApi.addProduct(data);
  },

  async updateProduct(id, data, _token) {
    // Poderia lançar: throw new Error("Atualização não suportada pela API externa");
    return mockApi.updateProduct(id, data);
  }
};

/**
 * Converte um registro do backend para o formato interno.
 */
function mapBackendProduct(p) {
  if (!p) return null;

  return {
    id: safeNumberOrString(p.pro_codigo),
    code: String(p.pro_codigo || "").trim(),
    barcode: (p.pro_cod_barra || "").trim(),
    name: (p.pro_nome || "").trim(),
    group: (p.gp_descri || "").trim(),
    brand: (p.mar_descri || "").trim(),
    expiryDate: parseBackendDate(p.pro_validade), // DD/MM/YYYY -> YYYY-MM-DD
    price: numberSafe(p.pro_preco1),
    unit: (p.und_nome || "").trim(),
    stock: numberSafe(p.pro_estoq1),
    removed: false
  };
}

function parseBackendDate(v) {
  if (!v) return "";
  // Esperado DD/MM/YYYY
  const parts = v.split("/");
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return "";
  // Normaliza
  const d = dd.padStart(2, "0");
  const m = mm.padStart(2, "0");
  return `${yyyy}-${m}-${d}`; // ISO esperado internamente
}

function numberSafe(n) {
  if (n === null || n === undefined || n === "") return 0;
  const num = Number(String(n).replace(",", "."));
  return isNaN(num) ? 0 : num;
}

function safeNumberOrString(v) {
  const n = Number(v);
  if (!isNaN(n)) return n;
  return String(v || "").trim();
}

/* ================= MOCK (mantido para login e operações locais) ================= */
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
      await delay(200);
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