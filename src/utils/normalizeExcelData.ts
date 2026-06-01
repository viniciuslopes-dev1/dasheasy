import type { FinancialRecord } from '../types/financial';

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeWhitespace(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeTextKey(value: unknown): string {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCurrencyToCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  const original = normalizeWhitespace(value).replace(/R\$/gi, '').replace(/\s/g, '');
  if (!original) {
    return null;
  }

  let normalized = original;
  const commaIndex = normalized.lastIndexOf(',');
  const dotIndex = normalized.lastIndexOf('.');

  if (commaIndex > dotIndex) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (commaIndex >= 0 && dotIndex < 0) {
    normalized = normalized.replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(EXCEL_EPOCH_UTC + value * DAY_MS).toISOString().slice(0, 10);
  }

  const text = normalizeWhitespace(value);
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function createDedupeKey(record: Pick<
  FinancialRecord,
  | 'groupName'
  | 'departmentName'
  | 'classificationName'
  | 'financialType'
  | 'documentNumber'
  | 'personName'
  | 'dueDate'
  | 'amountCents'
  | 'detailGroupName'
>): string {
  return [
    normalizeTextKey(record.groupName),
    normalizeTextKey(record.departmentName),
    normalizeTextKey(record.classificationName),
    normalizeTextKey(record.financialType),
    normalizeTextKey(record.documentNumber),
    normalizeTextKey(record.personName),
    record.dueDate ?? '',
    String(record.amountCents),
    normalizeTextKey(record.detailGroupName),
  ].join('|');
}

export function formatRawCell(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return normalizeWhitespace(value);
}

