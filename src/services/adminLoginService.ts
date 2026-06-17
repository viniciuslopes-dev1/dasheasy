import { normalizeTextKey } from '../utils/normalizeExcelData';

const DEFAULT_AUTH_DOMAIN = 'dasheasy.local';

export function resolveAdminLoginEmail(loginName: string, domain = DEFAULT_AUTH_DOMAIN): string {
  const normalizedName = normalizeTextKey(loginName)
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  return `${normalizedName}@${domain}`;
}

export function getAdminAuthDomain(): string {
  return (import.meta.env.VITE_ADMIN_AUTH_DOMAIN as string | undefined) || DEFAULT_AUTH_DOMAIN;
}
