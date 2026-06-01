# Database Design

## Modelo Proposto

O modelo preserva a hierarquia real encontrada na planilha e evita tabelas específicas para salário.

## Tabelas

### `financial_imports`

- `id uuid primary key`
- `user_id uuid`
- `company_id uuid`
- `source_file_name text`
- `sheet_name text`
- `record_count integer`
- `block_count integer`
- `total_amount_cents bigint`
- `metadata jsonb`
- `created_at timestamptz`

### `financial_records`

- `id uuid primary key`
- `import_id uuid references financial_imports(id)`
- `source_row integer`
- `group_name text`
- `group_key text`
- `department_name text`
- `department_key text`
- `classification_name text`
- `classification_key text`
- `financial_type text`
- `financial_type_key text`
- `document_number text`
- `person_name text`
- `person_key text`
- `due_date date`
- `amount_cents bigint`
- `detail_group_name text`
- `detail_group_key text`
- `raw_data jsonb`
- `dedupe_key text`
- `created_at timestamptz`

## Índices

- `financial_records(import_id)`
- `financial_records(group_key)`
- `financial_records(group_key, department_key)`
- `financial_records(group_key, department_key, person_key)`
- `financial_records(due_date)`
- unique parcial em `(import_id, dedupe_key)` para reduzir duplicidade exata dentro da mesma importação.

## RLS

RLS deve ser habilitado nas duas tabelas. A policy inicial usa `auth.uid() = user_id` em `financial_imports` e valida acesso aos registros via importação.

## Agregações

As consultas podem agregar diretamente em `financial_records`:

- geral: `group by group_name, group_key`;
- agrupamento: `where group_key = ? group by department_name, department_key`;
- departamento: `where group_key = ? and department_key = ? group by person_name, person_key`.

