# Database Design

## Modelo Atual

O banco representa os dados financeiros da planilha em uma estrutura hierárquica e versionada. A solução não é limitada a salário: os agrupamentos principais, departamentos, pessoas/responsáveis e valores vêm da planilha importada.

## Tabelas Principais

### `dashboard_versions`

Controla cada versão importada do dashboard.

- `id uuid primary key`
- `version_number bigint identity unique`
- `status text`: `draft`, `published` ou `archived`
- `source_file_name text`
- `sheet_name text`
- `record_count integer`
- `block_count integer`
- `total_amount_cents bigint`
- `metadata jsonb`
- `created_by uuid references auth.users(id)`
- `published_by uuid references auth.users(id)`
- `created_at timestamptz`
- `published_at timestamptz`

### `financial_imports`

Mantém o evento de importação e seus metadados.

- `id uuid primary key`
- `version_id uuid references dashboard_versions(id)`
- `user_id uuid references auth.users(id)`
- `company_id uuid`
- `source_file_name text`
- `sheet_name text`
- `record_count integer`
- `block_count integer`
- `total_amount_cents bigint`
- `metadata jsonb`
- `created_at timestamptz`

### `admin_users`

Allowlist do usuário principal que pode administrar o sistema.

- `user_id uuid primary key references auth.users(id)`
- `created_at timestamptz`

### `financial_records`

Guarda os lançamentos normalizados da planilha.

- `id uuid primary key`
- `version_id uuid references dashboard_versions(id)`
- `import_id uuid references financial_imports(id)`
- `source_row integer`
- `group_name`, `group_key`
- `department_name`, `department_key`
- `classification_name`, `classification_key`
- `financial_type`, `financial_type_key`
- `document_number`
- `person_name`, `person_key`
- `due_date`
- `amount_cents bigint`
- `detail_group_name`, `detail_group_key`
- `raw_data jsonb`
- `dedupe_key text`
- `created_at timestamptz`

## Publicação

O admin importa uma planilha e cria uma versão `draft`. O link público continua exibindo a versão `published` atual. Ao clicar em **Publicar dashboard**, a função `publish_dashboard_version(target_version_id uuid)` arquiva a versão publicada anterior e torna a versão escolhida a nova versão pública.

Versões antigas ficam como `archived` e podem ser republicadas.

## RLS

- `anon`: pode ler somente `dashboard_versions.status = 'published'` e os `financial_records` ligados a essa versão.
- `authenticated`: só pode administrar se existir em `admin_users`.
- Admin em `admin_users`: pode ler histórico, criar versões, inserir importações/registros e publicar/republicar.
- O frontend usa apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Nenhuma operação usa `service_role` no cliente.

## Índices

- `dashboard_versions(status)`
- `dashboard_versions(created_at desc)`
- índice único parcial para garantir uma única versão `published`
- `financial_records(version_id)`
- `financial_records(version_id, group_key)`
- `financial_records(version_id, group_key, department_key)`
- índices antigos por `import_id`, `group_key`, `department_key`, `person_key` continuam úteis para filtros.
