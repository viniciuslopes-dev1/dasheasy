import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminLogin from './AdminLogin';

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  isDashboardAdmin: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  },
}));

vi.mock('../../services/adminAuthorizationService', () => ({
  isDashboardAdmin: mocks.isDashboardAdmin,
}));

describe('AdminLogin', () => {
  it('signs out authenticated accounts without administrative permission', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'regular-user' } },
      error: null,
    });
    mocks.isDashboardAdmin.mockResolvedValue(false);
    mocks.signOut.mockResolvedValue({ error: null });
    const onSignedIn = vi.fn();

    render(<AdminLogin onSignedIn={onSignedIn} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'vinicius' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Esta conta nao possui acesso administrativo.')).toBeTruthy();
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
