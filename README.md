# Rede Voluntariado API

API Python/FastAPI para migrar os sites PHP legados da Rede Voluntariado para uma base multi-tenant simples.

## Rodar com Docker

```bash
docker compose up --build
```

A API fica em:

```txt
http://localhost:8000
```

O frontend fica em:

```txt
http://localhost:3000
```

O container da API espera o PostgreSQL ficar saudavel, cria as tabelas no startup e inicia o servidor.

## Rodar localmente sem Docker

```bash
cp .env.example .env
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
docker compose up -d postgres
uvicorn app.main:app --reload
```

## Arquivos principais

- `app/main.py`: rotas da API
- `app/models.py`: modelo relacional multi-tenant
- `app/security.py`: JWT e senha
- `app/tenant.py`: resolucao e regras de tenant
- `frontend/src/App.tsx`: frontend React baseado nos sites antigos
- `frontend/src/styles.css`: identidade visual da Rede e do tenant Presbiterianos
- `docker-compose.yml`: API + PostgreSQL
- `Dockerfile`: imagem da API

## Login inicial

No primeiro startup, a API cria:

```txt
Tenant principal: redevoluntariado
Admin: admin@redevoluntariado.org.br
Senha: admin123
```

Altere esses valores no `.env` ou no `docker-compose.yml`.

## Como o tenant e identificado

O tenant pode ser identificado por:

- Header `x-tenant-slug`
- Header `x-tenant-domain`
- Host da requisicao

Exemplos:

- `redevoluntariado.org.br` -> tenant principal
- `presbiterianos.sco.org.br` -> tenant secundario

## Rotas

- `GET /health`
- `POST /auth/login`
- `POST /auth/register`
- `POST /tenants`
- `GET /tenants`
- `POST /users`
- `POST /volunteers`
- `PUT /volunteers/me`
- `GET /volunteers`
- `GET /volunteers/{id}`

## Regras de acesso

- Administrador do tenant principal ve todos os tenants e voluntarios.
- Administrador de tenant secundario ve apenas seus voluntarios.
- Voluntario ve apenas os proprios dados quando vinculado a usuario.

## Exemplo de login

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "content-type: application/json" \
  -H "x-tenant-slug: redevoluntariado" \
  -d "{\"email\":\"admin@redevoluntariado.org.br\",\"password\":\"admin123\"}"
```

## Exemplo de cadastro de voluntario

```json
{
  "name": "Maria",
  "gender": "f",
  "fullname": "Maria Silva",
  "birthday": "1990-01-20",
  "legal_id": "000.000.000-00",
  "email": "maria@example.com",
  "preferences": "Aulas e atendimentos",
  "schooling": 4,
  "phones": [
    { "phone": "(38) 99999-9999", "whatsapp": "s" }
  ],
  "courses": [
    { "level": "Superior", "area": "Ciencias Humanas", "conclusion": "2024", "course": "Servico Social" }
  ],
  "availability": [
    { "day_week": "seg", "period": "m", "hours": "3" }
  ]
}
```
