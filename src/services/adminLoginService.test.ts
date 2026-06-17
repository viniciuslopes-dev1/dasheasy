import { describe, expect, it } from 'vitest';
import { resolveAdminLoginEmail } from './adminLoginService';

describe('adminLoginService', () => {
  it('turns a simple access name into a Supabase Auth email', () => {
    expect(resolveAdminLoginEmail('admin')).toBe('admin@dasheasy.local');
  });

  it('normalizes spaces and accents before creating the auth email', () => {
    expect(resolveAdminLoginEmail('Vinícius Lopes')).toBe('vinicius.lopes@dasheasy.local');
  });

  it('supports a custom technical auth domain', () => {
    expect(resolveAdminLoginEmail('Financeiro', 'empresa.local')).toBe('financeiro@empresa.local');
  });
});
