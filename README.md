# Controle de Validade de Produtos

Sistema frontend completo (HTML, CSS, JS puro) com:
- Autenticação (mock)
- Tema claro/escuro
- Listagem de produtos (Grupo, Marca, Código de Barras, Validade)
- Filtros: Grupo, Marca, Busca (nome / código / código de barras), Status (Todos / Próximo / Vencidos), Mostrar removidos
- Parâmetro de dias para "Próximo de Vencer"
- Edição inline da validade
- Inclusão de novos produtos (modal)
- Remoção (marca como removido)
- Visualização Tabela / Cartões (toggle)
- Scanner de código de barras usando apenas Quagga (detecta EAN/UPC e preenche busca)

## Estrutura

```
index.html
styles.css
js/
  api.js
  auth.js
  products.js
  theme.js
  scanner.js
  app.js
README.md
```

## Como Executar

1. Baixe/clonar os arquivos.
2. **Importante**: Sirva via servidor local (não abra file://):
   - `npx http-server` (ou)
   - `npx live-server` (ou)
   - qualquer servidor simples em Node / Python.
3. Abra `http://localhost:8080` (ou porta correspondente).
4. Login:
   - Usuário: `admin`
   - Senha: `admin123`

## Scanner (Quagga)

- Botão “🔍 Ler Código” abre um overlay.
- Ao detectar um código EAN/UPC: preenche o campo de busca e fecha o overlay.
- Campo manual disponível caso a leitura falhe.
- Caso deseje continuar lendo vários códigos (modo contínuo), remova `stop()` dentro do evento de detecção em `scanner.js`.

### Ajustes Possíveis

- Adicionar mais formatos (Code 128, etc.) em `decoder.readers`.
- Manter o scanner aberto para múltiplas leituras.
- Enviar imagem/frame para backend analisar (não implementado).

## Integração com API Real

Defina `BASE_URL` em `js/api.js` e implemente endpoints:

```
POST   /auth/login
GET    /products
POST   /products
PATCH  /products/:id
POST   /products/:id/remove
```

Estrutura de produto esperada:

```json
{
  "id": 101,
  "code": "L001",
  "barcode": "7891000000001",
  "name": "Leite Integral 1L",
  "group": "Laticínios",
  "brand": "Fazenda Boa",
  "expiryDate": "2025-12-01",
  "removed": false
}
```

## Lógica de Status

| Status  | Condição                               |
|---------|-----------------------------------------|
| removed | `produto.removed === true`              |
| expired | `diasRestantes < 0`                     |
| near    | `0 <= diasRestantes <= threshold`       |
| ok      | `diasRestantes > threshold`             |

`threshold` vem do input “Dias p/ considerar 'Próximo de Vencer'”.

## Melhorias Futuras (Sugestões)

- Paginação/virtualização (muitos produtos).
- Exportar CSV/Excel.
- Edição em massa de validade.
- Avisos (toast) para produtos próximos do vencimento.
- PWA + notificações.
- Modo inventário por múltiplos escaneamentos.
- Validação EAN-13 (dígito verificador).
- Backend real (Node/Express + banco).

## Licença

Livre para estudos e adaptações.