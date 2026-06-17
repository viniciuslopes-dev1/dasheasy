drop index if exists public.financial_records_import_dedupe_idx;

create index if not exists financial_records_import_dedupe_idx
  on public.financial_records(import_id, dedupe_key);
