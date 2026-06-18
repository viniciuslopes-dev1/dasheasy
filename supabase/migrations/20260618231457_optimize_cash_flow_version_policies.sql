create index if not exists cash_flow_versions_created_by_idx
  on public.cash_flow_versions(created_by);

create index if not exists cash_flow_versions_published_by_idx
  on public.cash_flow_versions(published_by);

drop policy if exists "Admins can create cash flow versions"
  on public.cash_flow_versions;

create policy "Admins can create cash flow versions"
  on public.cash_flow_versions
  for insert
  to authenticated
  with check (
    public.is_dashboard_admin()
    and created_by = (select auth.uid())
    and status = 'draft'
  );
