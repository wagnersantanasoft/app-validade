# Sistema de Controle de Validade (Frontend)

Agora com:
- Modo claro/escuro (toggle 🌓 persistido em `localStorage`)
- Layout responsivo (tabela + modo cartões automático em telas estreitas, botão para alternar)
- Leitura de código de barras (BarcodeDetector / QuaggaJS)
- Inclusão de novos produtos (modal)
- Edição inline de validade (coluna Validade -> botão “Editar”)
- Remoção (marca localmente)
- Filtros (grupo, busca, status, dias próximos)
- Persistência de sessão via localStorage
- Mock API expandida com `addProduct`, `updateProduct`, `removeProduct`

## Estrutura

```
index.html
styles.css
js/
  api.js
  auth.js
  products.js
  app.js
  scanner.js
  theme.js
README.md
```

## Endpoints Esperados (API Real)

Ajuste `BASE_URL` em `js/api.js` e implemente:

- `POST /auth/login`
  Body: `{ "username": "...", "password": "..." }`
  Resposta: `{ "token": "...", "user": {"id":1,"name":"...","username":"..."} }`

- `GET /products`
  Retorna lista:
  ```json
  [
    {
      "id": 101,
      "code": "L001",
      "barcode": "7891000000001",
      "name": "Leite Integral 1L",
      "group": "Laticínios",
      "expiryDate": "2025-09-20",
      "removed": false
    }
  ]
  ```

- `POST /products`
  Body:
  ```json
  {
    "code": "X001",
    "barcode": "789...",
    "name": "Produto",
    "group": "Grupo",
    "expiryDate": "2025-10-01"
  }
  ```
  Resposta: objeto com `id`.

- `PATCH /products/:id`
  Body parcial, ex:
  ```json
  { "expiryDate": "2025-11-01" }
  ```

- `POST /products/:id/remove`
  Marca `removed=true`.

## Regras de Status

| Status    | Condição                                        |
|-----------|-------------------------------------------------|
| removed   | produto.removed === true                        |
| expired   | diasRestantes < 0                               |
| near      | 0 <= diasRestantes <= threshold                 |
| ok        | diasRestantes > threshold                       |

`threshold` = valor do input configurável.

## Modo Claro / Escuro

- Utiliza atributo `data-theme="dark|light"` na tag `<html>`.
- Variáveis CSS para ambos os temas.
- Persistência em `localStorage` (`cv_theme`).

## Responsividade

- Tabela com rolagem horizontal.
- Para < 600px alterna automaticamente para cards (pode ser revertido manualmente).
- Cards mostram informações essenciais e ações.

## Scanner

- Tenta `BarcodeDetector`.
- Fallback QuaggaJS (CDN).
- Torch (lanterna) se suportado (Chrome Android).
- Troca de câmera se múltiplas lentes.

## Edição Inline

- Botão “Editar” substitui valor por `<input type="date">` + OK / X.
- Persistência chama `api.updateProduct`.
- Mock atualiza cache local.

## Inclusão de Produto

- Botão “＋ Produto” abre modal.
- Validação simples (campos obrigatórios).
- Em API real, devolve ID gerado.

## Possíveis Melhorias Futuras

- Paginação / virtualização.
- Validação de EAN-13 (dígito verificador).
- Upload CSV / importação em lote.
- Notificações de lote próximo ao vencer (service worker + PWA).
- Multi-edição de validade.
- Histórico de alterações.

## Licença

Uso livre para estudos e adaptação.