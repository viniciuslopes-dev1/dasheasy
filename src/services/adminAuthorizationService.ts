import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export async function isDashboardAdmin(
  client: Pick<SupabaseClient, 'rpc'> | null = supabase,
): Promise<boolean> {
  if (!client) {
    throw new Error('Supabase nao esta configurado neste ambiente.');
  }

  const { data, error } = await client.rpc('is_dashboard_admin');

  if (error) {
    throw new Error('Nao foi possivel verificar a permissao administrativa.');
  }

  return data === true;
}
