revoke all on public.cash_flow_versions from anon, authenticated;
grant select on public.cash_flow_versions to anon;
grant select, insert, update on public.cash_flow_versions to authenticated;

revoke all on sequence public.cash_flow_versions_version_number_seq from anon, authenticated;
grant usage, select on sequence public.cash_flow_versions_version_number_seq to authenticated;

revoke execute on function public.publish_cash_flow_version(uuid) from public, anon;
grant execute on function public.publish_cash_flow_version(uuid) to authenticated;
