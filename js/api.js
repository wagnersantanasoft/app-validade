/**
 * api.js (sem mocks)
 * Consome somente a API real:
 *   GET  /produtos
 *   PUT  /produtos/:id      (atualiza campos enviados)
 *
 * Campos aceitos para atualização (qualquer subconjunto):
 *   High-level (front):  expiryDate (YYYY-MM-DD), stock, price, price2
 *   Low-level (API):     pro_validade / PRO_VALIDADE (DD/MM/YYYY ou YYYY-MM-DD)
 *                        pro_estoq1 / PRO_ESTOQ1
 *                        pro_preco1 / PRO_PRECO1
 *                        pro_preco2 / PRO_PRECO2
 *
 * Mapeamento para uso interno do front:
 *   pro_codigo   -> id / code
 *   pro_validade -> expiryDate (YYYY-MM-DD)
 *   pro_estoq1   -> stock (number)
 *   pro_preco1   -> price (number)
 *   pro_preco2   -> price2 (number)
 */

const DEBUG = false;

const RAW_HOST = window.location.hostname;
const HOST = RAW_HOST && RAW_HOST.length ? RAW_HOST : "localhost";
const API_PORT = 9000;
const BASE_URL = `http://${HOST}:${API_PORT}`;
const PRODUCTS_ENDPOINT = `${BASE_URL}/produtos`;

let paginationCapability = "unknown"; // mantido para compatibilidade com productsService

export const api = {

  // Caso tenha autenticação real implemente aqui (ex: POST /login)
  async login(username, password) {
    // Simples stub: aceite tudo ou ajuste conforme sua API
    // Retorne um objeto com token se precisar inserir Authorization depois.
    return {
      token: btoa(username + ":" + Date.now()),
      user: { id: 1, name: username, username }
    };
  },

  /**
   * Busca página de produtos. Se backend não paginar, traz tudo e fatia localmente.
   * params: { page, pageSize, search?, group?, brand? }
   */
  async getProductsPage(params) {
    const { page, pageSize, search, group, brand } = params;
    // Monta query simples (ajuste se backend aceitar filtros via QS)
    const qs = buildQueryParams({ search, group, brand });
    const url = `${PRODUCTS_ENDPOINT}${qs}`;

    if (DEBUG) console.log("[api.getProductsPage] URL:", url);

    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`Falha HTTP ${res.status} ao buscar produtos`);

    let raw = await safeJson(res);
    if (!Array.isArray(raw)) {
      // Se vier objeto único, encapsula em array
      if (raw && typeof raw === "object") raw = [raw];
      else raw = [];
    }

    const mappedAll = raw.map(mapBackendProduct).filter(Boolean);

    // Paginação cliente (fallback)
    const start = (page - 1) * pageSize;
    const slice = mappedAll.slice(start, start + pageSize);
    paginationCapability = "unsupported";

    return {
      items: slice,
      page,
      pageSize,
      total: mappedAll.length,
      hasMore: start + pageSize < mappedAll.length,
      _allIfFallback: mappedAll
    };
  },

  /**
   * Atualiza produto parcial (PUT).
   * Exemplo:
   *   await api.updateProduct(6, { expiryDate:"2025-10-01", stock:25, price:155.9 });
   * Ou passando já campos da API:
   *   await api.updateProduct(6, { pro_validade:"05/09/2025" });
   */
  async updateProduct(id, data) {
    if (id === undefined || id === null) {
      throw new Error("ID é obrigatório em updateProduct");
    }

    // Monta o payload apenas com campos presentes
    const payload = buildPayloadFromData(data);

    if (!Object.keys(payload).length) {
      throw new Error("Nenhum campo válido para atualização foi fornecido.");
    }

    // Token opcional (se você implementar no login)
    const token = await tryGetToken();
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json"
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${PRODUCTS_ENDPOINT}/${encodeURIComponent(id)}`;

    if (DEBUG) {
      console.log("[api.updateProduct] URL:", url);
      console.log("[api.updateProduct] Payload:", payload);
    }

    let res;
    try {
      res = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload)
      });
    } catch (netErr) {
      throw new Error("Falha de rede ao enviar PUT: " + netErr.message);
    }

    if (!res.ok) {
      let bodyText = "";
      try { bodyText = await res.text(); } catch(_) {}
      throw new Error(`HTTP ${res.status} ao atualizar. Corpo: ${bodyText}`);
    }

    // Tenta extrair JSON; pode ser vazio
    const text = await res.text();
    if (DEBUG) console.log("[api.updateProduct] Raw response text:", text);

    if (!text) {
      // Sem corpo → devolve patch normalizado
      return normalizePatch(id, data);
    }

    let obj;
    try { obj = JSON.parse(text); } catch {
      return normalizePatch(id, data);
    }

    // Possíveis formatos
    // 1) Produto direto
    // 2) Wrapper { produto:{...} }
    // 3) Apenas mensagem { message:"..." }
    if (obj.produto && isProductLike(obj.produto)) {
      return mapBackendProduct(obj.produto);
    }
    if (isProductLike(obj)) {
      return mapBackendProduct(obj);
    }
    // Se veio algo como { message:'...' } sem produto, retorna patch
    return normalizePatch(id, data);
  },

  getPaginationCapability() {
    return paginationCapability;
  },

  // Stubs (removidos mocks). Se o front chamar isso, vai acusar erro até você implementar.
  async addProduct() {
    throw new Error("addProduct não implementado nesta versão da API.");
  },
  async removeProduct() {
    throw new Error("removeProduct não implementado nesta versão da API.");
  }
};

/* ================= Helpers de montagem ================= */

function buildPayloadFromData(data) {
  const payload = {};

  // HIGH-LEVEL -> back
  if ("expiryDate" in data) {
    if (data.expiryDate) {
      const br = isoToBackendDateAuto(data.expiryDate); // aceita YYYY-MM-DD ou DD/MM/YYYY
      if (br) {
        payload.PRO_VALIDADE = br;
        payload.pro_validade = br; // envia dupla
      }
    }
  }
  if ("stock" in data) {
    // Mantendo comportamento: enviar string
    const v = data.stock === null || data.stock === undefined ? "" : String(data.stock);
    payload.PRO_ESTOQ1 = v;
    payload.pro_estoq1 = v;
  }
  if ("price" in data) {
    const v = data.price === null || data.price === undefined ? "" : String(data.price);
    payload.PRO_PRECO1 = v;
    payload.pro_preco1 = v;
  }
  if ("price2" in data) {
    const v = data.price2 === null || data.price2 === undefined ? "" : String(data.price2);
    payload.PRO_PRECO2 = v;
    payload.pro_preco2 = v;
  }

  // LOW-LEVEL diretos (se o chamador quiser mandar já no formato)
  const directMap = [
    "PRO_VALIDADE","pro_validade",
    "PRO_ESTOQ1","pro_estoq1",
    "PRO_PRECO1","pro_preco1",
    "PRO_PRECO2","pro_preco2"
  ];
  directMap.forEach(k=>{
    if (k in data && data[k] !== undefined) {
      payload[k] = data[k];
    }
  });

  return payload;
}

/* ================= Helpers genéricos ================= */

function buildQueryParams(obj) {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([k,v]) => {
    if (v === undefined || v === null || v === "" ) return;
    params.append(k, v);
  });
  const s = params.toString();
  return s ? "?" + s : "";
}

function isProductLike(o) {
  if (!o || typeof o !== "object") return false;
  return ("pro_codigo" in o) || ("PRO_CODIGO" in o) ||
         ("pro_validade" in o) || ("PRO_VALIDADE" in o);
}

function mapBackendProduct(p) {
  if (!p) return null;
  return {
    id: safeNumberOrString(p.pro_codigo ?? p.PRO_CODIGO),
    code: String(p.pro_codigo ?? p.PRO_CODIGO ?? "").trim(),
    barcode: (p.pro_cod_barra ?? p.PRO_COD_BARRA ?? "").trim(),
    name: (p.pro_nome ?? p.PRO_NOME ?? "").trim(),
    group: (p.gp_descri ?? p.GP_DESCRI ?? "").trim(),
    brand: (p.mar_descri ?? p.MAR_DESCRI ?? "").trim(),
    expiryDate: parseBackendDate(p.pro_validade ?? p.PRO_VALIDADE),
    price: numberSafe(p.pro_preco1 ?? p.PRO_PRECO1),
    price2: numberSafe(p.pro_preco2 ?? p.PRO_PRECO2),
    unit: (p.und_nome ?? p.UND_NOME ?? "").trim(),
    stock: numberSafe(p.pro_estoq1 ?? p.PRO_ESTOQ1),
    removed: false
  };
}

function parseBackendDate(v) {
  if (!v) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [dd, mm, yyyy] = v.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
  return "";
}

function isoToBackendDateAuto(val) {
  if (!val) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y,m,d] = val.split("-");
    return `${d}/${m}/${y}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    // já está em BR
    return val;
  }
  return "";
}

function numberSafe(n) {
  if (n === null || n === undefined || n === "") return 0;
  const num = Number(String(n).replace(",", "."));
  return isNaN(num) ? 0 : num;
}

function safeNumberOrString(v) {
  const n = Number(v);
  return isNaN(n) ? String(v || "").trim() : n;
}

function normalizePatch(id, data) {
  const patch = { id: safeNumberOrString(id) };
  if ("expiryDate" in data) patch.expiryDate = data.expiryDate;
  if ("stock" in data) patch.stock = data.stock;
  if ("price" in data) patch.price = data.price;
  if ("price2" in data) patch.price2 = data.price2;
  return patch;
}

async function tryGetToken() {
  try {
    const mod = await import("./auth.js");
    if (mod.auth?.getToken) return mod.auth.getToken();
  } catch(_) {}
  return null;
}

async function safeJson(res) {
  const txt = await res.text();
  if (!txt) return null;
  try { return JSON.parse(txt); }
  catch {
    if (DEBUG) console.warn("[api] Resposta não é JSON válido:", txt);
    return null;
  }
}