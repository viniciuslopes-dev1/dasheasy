create extension if not exists "pgcrypto";

create table if not exists public.financial_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_id uuid,
  source_file_name text not null,
  sheet_name text not null,
  record_count integer not null default 0,
  block_count integer not null default 0,
  total_amount_cents bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.financial_records (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.financial_imports(id) on delete cascade,
  source_row integer not null,
  group_name text not null,
  group_key text not null,
  department_name text not null,
  department_key text not null,
  classification_name text not null,
  classification_key text not null,
  financial_type text not null,
  financial_type_key text not null,
  document_number text not null,
  person_name text not null,
  person_key text not null,
  due_date date,
  amount_cents bigint not null,
  detail_group_name text not null,
  detail_group_key text not null,
  raw_data jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists financial_records_import_id_idx on public.financial_records(import_id);
create index if not exists financial_records_group_key_idx on public.financial_records(group_key);
create index if not exists financial_records_group_department_idx on public.financial_records(group_key, department_key);
create index if not exists financial_records_group_department_person_idx on public.financial_records(group_key, department_key, person_key);
create index if not exists financial_records_due_date_idx on public.financial_records(due_date);
create unique index if not exists financial_records_import_dedupe_idx on public.financial_records(import_id, dedupe_key);

alter table public.financial_imports enable row level security;
alter table public.financial_records enable row level security;

create policy "Users can read their financial imports"
  on public.financial_imports
  for select
  using (auth.uid() = user_id);

create policy "Users can create their financial imports"
  on public.financial_imports
  for insert
  with check (auth.uid() = user_id);

create policy "Users can read their financial records"
  on public.financial_records
  for select
  using (
    exists (
      select 1
      from public.financial_imports fi
      where fi.id = financial_records.import_id
        and fi.user_id = auth.uid()
    )
  );

create policy "Users can create their financial records"
  on public.financial_records
  for insert
  with check (
    exists (
      select 1
      from public.financial_imports fi
      where fi.id = financial_records.import_id
        and fi.user_id = auth.uid()
    )
  );

