import { supabase } from '../lib/supabase';
import type {
  DashboardLevel,
  ExcelAnalysis,
  FinancialRecord,
  FinancialSummary,
  SavedFinancialImport,
  SummaryFilters,
} from '../types/financial';
import { normalizeTextKey } from '../utils/normalizeExcelData';

function recordMatchesFilters(record: FinancialRecord, filters: SummaryFilters): boolean {
  if (filters.groupKey && record.groupKey !== filters.groupKey) {
    return false;
  }

  if (filters.departmentKey && record.departmentKey !== filters.departmentKey) {
    return false;
  }

  if (filters.search) {
    const searchKey = normalizeTextKey(filters.search);
    const haystack = normalizeTextKey([
      record.groupName,
      record.departmentName,
      record.personName,
      record.detailGroupName,
      record.documentNumber,
    ].join(' '));
    return haystack.includes(searchKey);
  }

  return true;
}

function getAggregationIdentity(record: FinancialRecord, level: DashboardLevel): { key: string; label: string } {
  if (level === 'department') {
    return { key: record.departmentKey || '(VAZIO)', label: record.departmentName || '(vazio)' };
  }

  if (level === 'person') {
    return { key: record.personKey || '(VAZIO)', label: record.personName || '(vazio)' };
  }

  return { key: record.groupKey || '(VAZIO)', label: record.groupName || '(vazio)' };
}

export function aggregateRecords(
  records: FinancialRecord[],
  level: DashboardLevel,
  filters: SummaryFilters = {},
): FinancialSummary[] {
  const summaries = new Map<string, FinancialSummary>();

  records.filter((record) => recordMatchesFilters(record, filters)).forEach((record) => {
    const { key, label } = getAggregationIdentity(record, level);
    const current = summaries.get(key) ?? { key, label, totalCents: 0, recordCount: 0 };
    summaries.set(key, {
      ...current,
      totalCents: current.totalCents + record.amountCents,
      recordCount: current.recordCount + 1,
    });
  });

  return Array.from(summaries.values()).sort((a, b) => b.totalCents - a.totalCents || a.label.localeCompare(b.label));
}

export async function saveFinancialAnalysis(
  analysis: ExcelAnalysis,
  sourceFileName: string,
  userId?: string,
): Promise<SavedFinancialImport | null> {
  if (!supabase) {
    return null;
  }

  const { data: importRow, error: importError } = await supabase
    .from('financial_imports')
    .insert({
      user_id: userId ?? null,
      source_file_name: sourceFileName,
      sheet_name: analysis.sheetName,
      record_count: analysis.recordCount,
      block_count: analysis.blockCount,
      total_amount_cents: analysis.totalAmountCents,
      metadata: {
        declaredTotalAmountCents: analysis.declaredTotalAmountCents,
        issueCounts: analysis.issues.reduce<Record<string, number>>((acc, issue) => {
          acc[issue.type] = (acc[issue.type] ?? 0) + 1;
          return acc;
        }, {}),
      },
    })
    .select()
    .single();

  if (importError) {
    throw new Error('Não foi possível salvar a importação no Supabase.');
  }

  const rows = analysis.records.map((record) => ({
    import_id: importRow.id,
    source_row: record.sourceRow,
    group_name: record.groupName,
    group_key: record.groupKey,
    department_name: record.departmentName,
    department_key: record.departmentKey,
    classification_name: record.classificationName,
    classification_key: record.classificationKey,
    financial_type: record.financialType,
    financial_type_key: record.financialTypeKey,
    document_number: record.documentNumber,
    person_name: record.personName,
    person_key: record.personKey,
    due_date: record.dueDate,
    amount_cents: record.amountCents,
    detail_group_name: record.detailGroupName,
    detail_group_key: record.detailGroupKey,
    raw_data: record.rawData,
    dedupe_key: record.dedupeKey,
  }));

  const { error: recordsError } = await supabase.from('financial_records').insert(rows);
  if (recordsError) {
    throw new Error('Não foi possível salvar os lançamentos no Supabase.');
  }

  return importRow;
}

