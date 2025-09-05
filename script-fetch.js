const URL = 'https://dummyjson.com/products';

async function chamarApi() {
  try {
    const resp = await fetch(URL);
    if (!resp.ok) throw new Error("Falha ao buscar: " + resp.status);
    const data = await resp.json();
    console.log("Produtos:", data);
    // Exemplo: mostrar primeiro título
    if (data.products && data.products.length) {
      document.body.insertAdjacentHTML("beforeend",
        `<p>Total: ${data.total} • Primeiro produto: ${data.products[0].title}</p>`);
    }
  } catch (err) {
    console.error(err);
    alert("Erro ao consumir API: " + err.message);
  }
}

chamarApi();