import { describe, expect, it, vi } from 'vitest';
import { isDashboardAdmin } from './adminAuthorizationService';

describe('adminAuthorizationService', () => {
  it('authorizes users accepted by the database admin check', async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));

    await expect(isDashboardAdmin({ rpc } as never)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('is_dashboard_admin');
  });

  it('rejects authenticated users that are not dashboard admins', async () => {
    const rpc = vi.fn(async () => ({ data: false, error: null }));

    await expect(isDashboardAdmin({ rpc } as never)).resolves.toBe(false);
  });

  it('surfaces failures while checking administrative access', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'permission denied' },
    }));

    await expect(isDashboardAdmin({ rpc } as never)).rejects.toThrow(
      'Não foi possível verificar a permissão administrativa.',
    );
  });
});
