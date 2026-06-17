# Rede Voluntaria API

API simples para formularios dinamicos multi-tenant. A ideia e manter o projeto facil de instalar e alterar, sem arquitetura grande.

## Rodar com Docker

```bash
docker compose up --build
```

A API fica em:

```txt
http://localhost:3333
```

O container da API espera o PostgreSQL ficar saudavel, aplica as migrations do Prisma e inicia o servidor.

## Rodar localmente sem Docker

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run prisma:deploy
npm run prisma:generate
npm run dev
```

## Arquivos principais

- `src/server.ts`: rotas da API
- `src/validation.ts`: validacao dos campos dinamicos
- `src/db.ts`: cliente Prisma
- `prisma/schema.prisma`: modelo do banco
- `docker-compose.yml`: API + PostgreSQL
- `Dockerfile`: imagem da API

## Como o tenant e identificado

Use um destes headers:

- `x-tenant-id`
- `x-tenant-slug`

## Rotas

- `GET /health`
- `POST /tenants`
- `GET /forms`
- `POST /forms`
- `POST /forms/:formId/publish`
- `GET /forms/:slug/public`
- `POST /forms/:formId/submissions`

## Exemplo rapido

```json
{
  "name": "Cadastro de Voluntarios Juridicos",
  "slug": "voluntario-juridico",
  "description": "Formulario publico para advogados voluntarios.",
  "fields": [
    {
      "key": "nome",
      "label": "Nome",
      "type": "TEXT",
      "required": true,
      "position": 1
    },
    {
      "key": "genero",
      "label": "Genero",
      "type": "SELECT",
      "required": false,
      "position": 2,
      "options": [
        { "label": "Masculino", "value": "masculino", "position": 1 },
        { "label": "Feminino", "value": "feminino", "position": 2 },
        { "label": "Nao-binario", "value": "nao-binario", "position": 3 }
      ]
    }
  ]
}
```

Crie o tenant:

```bash
curl -X POST http://localhost:3333/tenants \
  -H "content-type: application/json" \
  -d "{\"name\":\"Advocacia\",\"slug\":\"advocacia\"}"
```

Depois envie o JSON acima para `POST /forms` usando o header `x-tenant-slug: advocacia`.

## Exemplo de resposta do formulario

```json
{
  "values": {
    "nome": "Maria Silva",
    "genero": "feminino"
  }
}
```
