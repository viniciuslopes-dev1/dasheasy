import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, FileSpreadsheet, Search, TrendingDown, TrendingUp } from 'lucide-react';
import type {
  CashFlowReportBankAccount,
  CashFlowReportDataset,
  CashFlowReportMovement,
  CashFlowReportVariation,
} from '../../types/cashFlowReport';
import {
  calculateCashFlowReportMetrics,
  formatCashFlowReportDate,
  getTransactionTypeLabel,
} from '../../services/cashFlowReportService';
import { formatCurrency } from '../../utils/formatCurrency';

type CashFlowReportTab = 'daily' | 'banks' | 'movements' | 'anticipated' | 'variations';
type MovementFilter = 'ALL' | 'DEBITO' | 'CREDITO';
type DateRangePreset = 'CURRENT_MONTH' | 'FULL' | 'NEXT_15' | 'NEXT_30' | 'NEXT_60' | 'CUSTOM';

const TABS: Array<{ value: CashFlowReportTab; label: string }> = [
  { value: 'daily', label: 'Fluxo diário' },
  { value: 'movements', label: 'Movimentações' },
  { value: 'anticipated', label: 'Antecipados' },
  { value: 'banks', label: 'Bancos' },
  { value: 'variations', label: 'Variações' },
];

const DATE_RANGE_PRESETS: Array<{ value: DateRangePreset; label: string; days?: number }> = [
  { value: 'CURRENT_MONTH', label: 'Mês atual' },
  { value: 'FULL', label: 'Tudo' },
  { value: 'NEXT_15', label: '15 dias', days: 15 },
  { value: 'NEXT_30', label: '30 dias', days: 30 },
  { value: 'NEXT_60', label: '60 dias', days: 60 },
];

interface CashFlowReportDashboardProps {
  dataset: CashFlowReportDataset | null;
  isEditable?: boolean;
  versionId?: string | null;
  onSaveDataset?: (dataset: CashFlowReportDataset) => Promise<void>;
}

type ManualBankDraft = {
  code: string;
  accountLabel: string;
  debitValue: string;
  creditValue: string;
  balanceValue: string;
  isGuaranteed: boolean;
  includeInCashFlow: boolean;
};

const EMPTY_BANK_DRAFT: ManualBankDraft = {
  code: '',
  accountLabel: '',
  debitValue: '',
  creditValue: '',
  balanceValue: '',
  isGuaranteed: false,
  includeInCashFlow: true,
};

export default function CashFlowReportDashboard({
  dataset,
  isEditable = false,
  versionId = null,
  onSaveDataset,
}: CashFlowReportDashboardProps) {
  const [activeTab, setActiveTab] = useState<CashFlowReportTab>('daily');
  const [search, setSearch] = useState('');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('ALL');
  const [bankAccounts, setBankAccounts] = useState<CashFlowReportBankAccount[]>(() => dataset?.bankAccounts ?? []);
  const [manualBankDraft, setManualBankDraft] = useState<ManualBankDraft>(EMPTY_BANK_DRAFT);
  const [bankSaveStatus, setBankSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('CURRENT_MONTH');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);

  useEffect(() => {
    setBankAccounts(dataset?.bankAccounts ?? []);
    setBankSaveStatus('idle');
    setDateRangePreset('CURRENT_MONTH');
    setCustomStartDate('');
    setCustomEndDate('');
    setIsDateRangeOpen(false);
  }, [dataset]);

  useEffect(() => {
    if (activeTab === 'banks' && bankAccounts.length === 0 && !isEditable) {
      setActiveTab('daily');
    }
  }, [activeTab, bankAccounts.length, isEditable]);

  const effectiveDataset = useMemo(
    () => (dataset ? applyBankSelectionToDataset(dataset, bankAccounts) : null),
    [bankAccounts, dataset],
  );
  const availableStartDate = effectiveDataset?.dailyRows[0]?.date ?? effectiveDataset?.startDate ?? '';
  const availableEndDate = effectiveDataset?.dailyRows[effectiveDataset.dailyRows.length - 1]?.date ?? effectiveDataset?.endDate ?? '';
  const effectiveDateRange = useMemo(
    () => resolveDateRange(dateRangePreset, availableStartDate, availableEndDate, customStartDate, customEndDate),
    [availableEndDate, availableStartDate, customEndDate, customStartDate, dateRangePreset],
  );
  const periodDataset = useMemo(
    () => (effectiveDataset ? filterDatasetByDateRange(effectiveDataset, effectiveDateRange.startDate, effectiveDateRange.endDate) : null),
    [effectiveDataset, effectiveDateRange.endDate, effectiveDateRange.startDate],
  );
  const metrics = useMemo(() => (periodDataset ? calculateCashFlowReportMetrics(periodDataset) : null), [periodDataset]);
  const variationImpactCents = useMemo(
    () => periodDataset?.variations.reduce((sum, variation) => sum + variation.impactCents, 0) ?? 0,
    [periodDataset],
  );
  const bankSummary = useMemo(() => {
    return {
      availableCents: bankAccounts
        .filter((account) => account.includeInCashFlow)
        .reduce((sum, account) => sum + account.balanceCents, 0),
      guaranteedCents: bankAccounts
        .filter((account) => account.isGuaranteed)
        .reduce((sum, account) => sum + Math.abs(account.balanceCents), 0),
    };
  }, [bankAccounts]);
  const hasBankChanges = useMemo(
    () => JSON.stringify(dataset?.bankAccounts ?? []) !== JSON.stringify(bankAccounts),
    [bankAccounts, dataset?.bankAccounts],
  );
  const variationDates = useMemo(() => {
    const dates = new Set<string>();
    periodDataset?.variations.forEach((variation) => {
      if (variation.dueDate) {
        dates.add(variation.dueDate);
      }
      if (variation.previousDueDate) {
        dates.add(variation.previousDueDate);
      }
    });
    return dates;
  }, [periodDataset]);
  const filteredMovements = useMemo(
    () =>
      (periodDataset?.cashFlowMovements ?? []).filter((movement) => {
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          [movement.documentNumber, movement.accountName, movement.dueDate].join(' ').toLowerCase().includes(normalizedSearch);
        const matchesType = movementFilter === 'ALL' || movement.transactionType === movementFilter;
        return matchesSearch && matchesType;
      }),
    [periodDataset, movementFilter, search],
  );

  function updateBankAccount(accountId: string, patch: Partial<CashFlowReportBankAccount>) {
    setBankSaveStatus('idle');
    setBankAccounts((accounts) =>
      accounts.map((account) => {
        if (account.id !== accountId) {
          return account;
        }

        const next = {
          ...account,
          ...patch,
        };
        return {
          ...next,
          bankName: parseBankName(next.accountLabel),
          includeInCashFlow: next.isGuaranteed ? false : next.includeInCashFlow,
        };
      }),
    );
  }

  function removeBankAccount(accountId: string) {
    setBankSaveStatus('idle');
    setBankAccounts((accounts) => accounts.filter((account) => account.id !== accountId));
  }

  function updateManualBankDraft(patch: Partial<ManualBankDraft>) {
    setManualBankDraft((current) => {
      const next = {
        ...current,
        ...patch,
      };
      return {
        ...next,
        includeInCashFlow: next.isGuaranteed ? false : next.includeInCashFlow,
      };
    });
  }

  function addManualBankAccount() {
    const accountLabel = manualBankDraft.accountLabel.trim();
    const debitCents = parseManualCurrencyToCents(manualBankDraft.debitValue) ?? 0;
    const creditCents = parseManualCurrencyToCents(manualBankDraft.creditValue) ?? 0;
    const informedBalanceCents = parseManualCurrencyToCents(manualBankDraft.balanceValue);
    const balanceCents = creditCents - debitCents || informedBalanceCents;
    if (!accountLabel || balanceCents === null) {
      return;
    }

    const code = manualBankDraft.code.trim() || String(bankAccounts.length + 1).padStart(2, '0');
    const account: CashFlowReportBankAccount = {
      id: `manual-bank-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code,
      bankName: parseBankName(accountLabel),
      accountLabel,
      debitCents,
      creditCents,
      balanceCents,
      runningBalanceCents: informedBalanceCents ?? balanceCents,
      isGuaranteed: manualBankDraft.isGuaranteed,
      includeInCashFlow: manualBankDraft.isGuaranteed ? false : manualBankDraft.includeInCashFlow,
    };

    setBankSaveStatus('idle');
    setBankAccounts((accounts) => [...accounts, account]);
    setManualBankDraft(EMPTY_BANK_DRAFT);
  }

  async function saveBankAccounts() {
    if (!effectiveDataset || !onSaveDataset || !versionId || !hasBankChanges) {
      return;
    }

    setBankSaveStatus('saving');
    try {
      await onSaveDataset(effectiveDataset);
      setBankSaveStatus('saved');
    } catch {
      setBankSaveStatus('error');
    }
  }

  if (!periodDataset || !effectiveDataset || !metrics) {
    return (
      <section className="dashboard-area cash-report-area" aria-label="Fluxo de caixa">
        <div className="cash-report-shell">
          <section className="panel cash-flow-empty-state">
            <FileSpreadsheet size={28} />
            <div>
              <h3>Nenhum fluxo de caixa publicado ainda.</h3>
              <p>Quando o administrador publicar uma planilha, o fluxo diário aparecerá aqui em formato de planilha.</p>
            </div>
          </section>
        </div>
      </section>
    );
  }

  const reportBankAccounts = bankAccounts;
  const visibleTabs = reportBankAccounts.length > 0 || isEditable ? TABS : TABS.filter((tab) => tab.value !== 'banks');
  const periodControl = (
    <DateRangeControl
      isOpen={isDateRangeOpen}
      preset={dateRangePreset}
      startDate={effectiveDateRange.startDate}
      endDate={effectiveDateRange.endDate}
      availableStartDate={availableStartDate}
      availableEndDate={availableEndDate}
      customStartDate={customStartDate}
      customEndDate={customEndDate}
      onToggle={() => setIsDateRangeOpen((current) => !current)}
      onClose={() => setIsDateRangeOpen(false)}
      onPresetChange={(nextPreset) => {
        setDateRangePreset(nextPreset);
        if (nextPreset !== 'CUSTOM') {
          setIsDateRangeOpen(false);
        }
      }}
      onCustomStartDateChange={(value) => {
        setDateRangePreset('CUSTOM');
        setCustomStartDate(value);
      }}
      onCustomEndDateChange={(value) => {
        setDateRangePreset('CUSTOM');
        setCustomEndDate(value);
      }}
    />
  );

  return (
    <section className="dashboard-area cash-report-area" aria-label="Fluxo de caixa">
      <div className="cash-report-shell">
        <section className="panel cash-report-header">
          <div>
            <span className="section-label">Fluxo de caixa</span>
            <h2>{periodDataset.monthLabel}</h2>
            <p>
              Créditos baixados entram em Antecipados e ficam fora do cálculo do fluxo. Saldo inicial não informado na
              planilha: cálculo iniciado em R$ 0,00.
            </p>
          </div>
          <div className="cash-report-header-side">
            {periodControl}
            <div
              className={`cash-report-header-kpis final-balance-card ${getBalanceTone(
                metrics.closingBalanceCents,
              )} ${getFinalBalanceCardToneClass(metrics.closingBalanceCents)}`}
            >
              <span>Saldo final projetado</span>
              <strong>{formatCurrency(metrics.closingBalanceCents)}</strong>
              <small>{formatPeriodLabel(effectiveDateRange.startDate, effectiveDateRange.endDate)}</small>
            </div>
          </div>
        </section>

        <div className="cash-report-metrics">
          <Metric label="Saldo inicial" value={metrics.initialBalanceCents} tone={getBalanceTone(metrics.initialBalanceCents)} />
          <Metric label="Débitos" value={metrics.totalDebitsCents} tone="debit" icon={<TrendingDown size={17} />} />
          <Metric label="Créditos" value={metrics.totalCreditsCents} tone="credit" icon={<TrendingUp size={17} />} />
          <Metric label="Antecipados" value={metrics.anticipatedCreditsCents} />
          <Metric
            label="Variação acumulada"
            value={variationImpactCents}
            tone={variationImpactCents < 0 ? 'negative' : 'positive'}
          />
          <Metric label="Menor saldo" value={metrics.minBalanceCents} tone={getBalanceTone(metrics.minBalanceCents)} note={formatCashFlowReportDate(metrics.minBalanceDate)} />
          <Metric label="Variações" value={metrics.variationCount} numeric />
        </div>

        {reportBankAccounts.length > 0 || isEditable ? (
          <section className="panel cash-report-bank-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Bancos e saldos</h3>
                <p>Resumo puxado da mesma planilha do fluxo de caixa. A edição manual fica na aba Bancos.</p>
              </div>
              <div className="cash-report-bank-summary">
                <span>Disponível: {formatCurrency(bankSummary.availableCents)}</span>
                <span>Garantida: {formatCurrency(bankSummary.guaranteedCents)}</span>
                <button className="bank-sheet-action" type="button" onClick={() => setActiveTab('banks')}>
                  Ver bancos
                </button>
              </div>
            </div>
            {reportBankAccounts.length > 0 ? <CompactBankAccountTable accounts={reportBankAccounts} /> : null}
          </section>
        ) : null}

        <nav className="cash-flow-tabs" aria-label="Navegação do fluxo de caixa">
          {visibleTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={activeTab === tab.value ? 'active' : ''}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'daily' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Planilha diária do fluxo</h3>
                <p>O saldo final de um dia vira o saldo inicial do próximo.</p>
              </div>
              <div className="cash-flow-heading-actions">
                <span className="cash-flow-chip">{periodDataset.dailyRows.length} dias</span>
              </div>
            </div>
            <div className="cash-report-table-wrap">
              <table className="cash-report-table cash-flow-statement-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th className="debit-heading">Débito</th>
                    <th className="credit-heading">Crédito</th>
                    <th className="balance-heading">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="cash-flow-balance-row">
                    <td colSpan={3}>Saldo inicial</td>
                    <td className={getBalanceValueClass(metrics.initialBalanceCents)}>
                      {formatCurrency(metrics.initialBalanceCents)}
                    </td>
                  </tr>
                  {periodDataset.dailyRows.map((day) => (
                    <tr key={day.date} className={variationDates.has(day.date) ? 'changed-row' : undefined}>
                      <td>{formatCashFlowReportDate(day.date)}</td>
                      <td className="debit-value">{formatCurrency(day.debitCents)}</td>
                      <td className="credit-value">{formatCurrency(day.creditCents)}</td>
                      <td className={getBalanceValueClass(day.closingBalanceCents)}>{formatCurrency(day.closingBalanceCents)}</td>
                    </tr>
                  ))}
                  <tr className="cash-flow-balance-row">
                    <td colSpan={3}>Saldo final</td>
                    <td className={getBalanceValueClass(metrics.closingBalanceCents)}>
                      {formatCurrency(metrics.closingBalanceCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'banks' ? (
          <section className="panel cash-flow-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Contas bancárias</h3>
                <p>
                  Dados importados da planilha do fluxo. No modo admin, adicione ou ajuste bancos manualmente aqui.
                </p>
              </div>
              <div className="cash-report-bank-summary">
                <span>Saldo considerado: {formatCurrency(metrics.initialBalanceCents)}</span>
                {isEditable ? (
                  <>
                    <button
                      className="bank-sheet-action"
                      type="button"
                      disabled={!versionId || !hasBankChanges || bankSaveStatus === 'saving'}
                      onClick={saveBankAccounts}
                    >
                      {bankSaveStatus === 'saving' ? 'Salvando...' : 'Salvar bancos'}
                    </button>
                    {bankSaveStatus === 'saved' ? <small>Salvo</small> : null}
                    {bankSaveStatus === 'error' ? <small className="negative-value">Não foi possível salvar</small> : null}
                  </>
                ) : null}
              </div>
            </div>
            {reportBankAccounts.length === 0 && !isEditable ? (
              <div className="empty-state">Nenhum banco foi encontrado na planilha.</div>
            ) : (
              <BankAccountTable
                accounts={reportBankAccounts}
                draft={manualBankDraft}
                isEditable={isEditable}
                onAdd={addManualBankAccount}
                onDraftChange={updateManualBankDraft}
                onRemove={removeBankAccount}
                onUpdate={updateBankAccount}
              />
            )}
          </section>
        ) : null}

        {activeTab === 'movements' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Movimentações do fluxo</h3>
                <p>Lista de débitos e créditos que entram no cálculo diário.</p>
              </div>
              <TableFilters search={search} setSearch={setSearch} filter={movementFilter} setFilter={setMovementFilter} />
            </div>
            <MovementTable movements={filteredMovements} />
          </section>
        ) : null}

        {activeTab === 'anticipated' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Antecipados</h3>
                <p>Créditos com Baixado = TRUE. Eles são exibidos, mas não entram no fluxo de caixa.</p>
              </div>
              <span className="cash-flow-chip">{periodDataset.anticipatedMovements.length} títulos</span>
            </div>
            <MovementTable movements={periodDataset.anticipatedMovements} />
          </section>
        ) : null}

        {activeTab === 'variations' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Variações</h3>
                <p>Novos títulos, valores alterados e datas alteradas contra a base acumulada anterior.</p>
              </div>
              <span className="cash-flow-chip">{periodDataset.variations.length} variações</span>
            </div>
            <VariationTable variations={periodDataset.variations} />
          </section>
        ) : null}

        {periodDataset.issues.length ? (
          <section className="cash-report-note">
            <AlertTriangle size={16} />
            <span>{periodDataset.issues[0].message}</span>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function applyBankSelectionToDataset(
  dataset: CashFlowReportDataset,
  bankAccounts: CashFlowReportBankAccount[],
): CashFlowReportDataset {
  if (bankAccounts.length === 0) {
    return {
      ...dataset,
      bankAccounts: [],
    };
  }

  const initialBalanceCents = bankAccounts
    .filter((account) => account.includeInCashFlow)
    .reduce((sum, account) => sum + account.balanceCents, 0);

  return {
    ...dataset,
    bankAccounts,
    initialBalanceCents,
    initialBalanceSource: 'spreadsheet',
    dailyRows: buildDailyRowsFromSelection(
      dataset.startDate,
      dataset.endDate,
      dataset.cashFlowMovements,
      dataset.anticipatedMovements,
      initialBalanceCents,
    ),
  };
}

function buildDailyRowsFromSelection(
  startDate: string,
  endDate: string,
  movements: CashFlowReportMovement[],
  anticipatedMovements: CashFlowReportMovement[],
  initialBalanceCents: number,
): CashFlowReportDataset['dailyRows'] {
  const byDate = movements.reduce<Record<string, { debitCents: number; creditCents: number; movementCount: number }>>(
    (acc, movement) => {
      acc[movement.dueDate] ??= { debitCents: 0, creditCents: 0, movementCount: 0 };
      acc[movement.dueDate].movementCount += 1;
      if (movement.transactionType === 'DEBITO') {
        acc[movement.dueDate].debitCents += movement.valueCents;
      } else {
        acc[movement.dueDate].creditCents += movement.valueCents;
      }
      return acc;
    },
    {},
  );
  const anticipatedByDate = anticipatedMovements.reduce<Record<string, number>>((acc, movement) => {
    acc[movement.dueDate] = (acc[movement.dueDate] ?? 0) + movement.valueCents;
    return acc;
  }, {});

  let balance = initialBalanceCents;
  return enumerateDates(startDate, endDate).map((date) => {
    const day = byDate[date] ?? { debitCents: 0, creditCents: 0, movementCount: 0 };
    const openingBalanceCents = balance;
    const netCents = day.creditCents - day.debitCents;
    balance += netCents;

    return {
      date,
      openingBalanceCents,
      debitCents: day.debitCents,
      creditCents: day.creditCents,
      anticipatedCents: anticipatedByDate[date] ?? 0,
      netCents,
      closingBalanceCents: balance,
      movementCount: day.movementCount,
    };
  });
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function filterDatasetByDateRange(
  dataset: CashFlowReportDataset,
  startDate: string,
  endDate: string,
): CashFlowReportDataset {
  const dailyRows = dataset.dailyRows.filter((day) => day.date >= startDate && day.date <= endDate);
  const visibleStartDate = dailyRows[0]?.date ?? startDate;
  const visibleEndDate = dailyRows[dailyRows.length - 1]?.date ?? endDate;

  return {
    ...dataset,
    monthLabel: formatPeriodLabel(visibleStartDate, visibleEndDate),
    startDate: visibleStartDate,
    endDate: visibleEndDate,
    initialBalanceCents: dailyRows[0]?.openingBalanceCents ?? dataset.initialBalanceCents,
    cashFlowMovements: dataset.cashFlowMovements.filter(
      (movement) => movement.dueDate >= visibleStartDate && movement.dueDate <= visibleEndDate,
    ),
    anticipatedMovements: dataset.anticipatedMovements.filter(
      (movement) => movement.dueDate >= visibleStartDate && movement.dueDate <= visibleEndDate,
    ),
    dailyRows,
    variations: dataset.variations.filter(
      (variation) =>
        (variation.dueDate !== null && variation.dueDate >= visibleStartDate && variation.dueDate <= visibleEndDate) ||
        (variation.previousDueDate !== undefined &&
          variation.previousDueDate !== null &&
          variation.previousDueDate >= visibleStartDate &&
          variation.previousDueDate <= visibleEndDate),
    ),
  };
}

function resolveDateRange(
  preset: DateRangePreset,
  availableStartDate: string,
  availableEndDate: string,
  customStartDate: string,
  customEndDate: string,
) {
  if (!availableStartDate || !availableEndDate) {
    return { startDate: '', endDate: '' };
  }

  if (preset === 'CUSTOM') {
    const startDate = clampDate(customStartDate || availableStartDate, availableStartDate, availableEndDate);
    const endDate = clampDate(customEndDate || availableEndDate, startDate, availableEndDate);
    return { startDate, endDate };
  }

  if (preset === 'CURRENT_MONTH') {
    return resolveCurrentMonthRange(availableStartDate, availableEndDate);
  }

  const selectedPreset = DATE_RANGE_PRESETS.find((option) => option.value === preset);
  if (!selectedPreset?.days) {
    return { startDate: availableStartDate, endDate: availableEndDate };
  }

  const today = new Date().toISOString().slice(0, 10);
  const anchorDate = today >= availableStartDate && today <= availableEndDate ? today : availableStartDate;

  return {
    startDate: anchorDate,
    endDate: minDate(addDays(anchorDate, selectedPreset.days - 1), availableEndDate),
  };
}

function resolveCurrentMonthRange(availableStartDate: string, availableEndDate: string) {
  const monthRange = getCurrentMonthRange();

  if (monthRange.endDate < availableStartDate) {
    const nextAvailableMonth = getMonthRangeForDate(availableStartDate);
    return {
      startDate: availableStartDate,
      endDate: minDate(nextAvailableMonth.endDate, availableEndDate),
    };
  }

  if (monthRange.startDate > availableEndDate) {
    const lastAvailableMonth = getMonthRangeForDate(availableEndDate);
    return {
      startDate: maxDate(lastAvailableMonth.startDate, availableStartDate),
      endDate: availableEndDate,
    };
  }

  return {
    startDate: maxDate(monthRange.startDate, availableStartDate),
    endDate: minDate(monthRange.endDate, availableEndDate),
  };
}

function formatPeriodLabel(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return 'Período sem datas';
  }

  if (startDate === endDate) {
    return formatCashFlowReportDate(startDate);
  }

  return `${formatCashFlowReportDate(startDate)} a ${formatCashFlowReportDate(endDate)}`;
}

function clampDate(date: string, min: string, max: string) {
  if (date < min) {
    return min;
  }

  if (date > max) {
    return max;
  }

  return date;
}

function minDate(a: string, b: string) {
  return a < b ? a : b;
}

function maxDate(a: string, b: string) {
  return a > b ? a : b;
}

function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getCurrentMonthRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();

  return {
    startDate: formatLocalDate(year, month + 1, 1),
    endDate: formatLocalDate(year, month + 1, lastDay),
  };
}

function getMonthRangeForDate(date: string) {
  const [year, month] = date.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    startDate: formatLocalDate(year, month, 1),
    endDate: formatLocalDate(year, month, lastDay),
  };
}

function formatLocalDate(year: number, month: number, day: number) {
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function parseBankName(accountLabel: string): string {
  return accountLabel.split('-')[0]?.trim() || accountLabel.trim() || 'Banco';
}

function parseManualCurrencyToCents(value: string): number | null {
  const trimmed = value.trim();
  const normalized = trimmed.includes(',') ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed;
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

function numberInputToCents(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function formatCentsForInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function getBankDebitCents(account: CashFlowReportBankAccount): number {
  return account.debitCents ?? (account.balanceCents < 0 ? Math.abs(account.balanceCents) : 0);
}

function getBankCreditCents(account: CashFlowReportBankAccount): number {
  return account.creditCents ?? (account.balanceCents > 0 ? account.balanceCents : 0);
}

function getBankStatementBalanceCents(account: CashFlowReportBankAccount): number {
  return account.runningBalanceCents ?? account.balanceCents;
}

function formatOptionalCurrency(cents: number): string {
  return cents === 0 ? '-' : formatCurrency(cents);
}

function CompactBankAccountTable({ accounts }: { accounts: CashFlowReportBankAccount[] }) {
  return (
    <div className="cash-report-bank-wrap compact">
      <table className="cash-report-table bank compact" aria-label="Bancos do fluxo de caixa">
        <thead>
          <tr>
            <th>Código</th>
            <th>Banco</th>
            <th className="debit-heading">Débito</th>
            <th className="credit-heading">Crédito</th>
            <th className="balance-heading">Saldo</th>
            <th>Garantida</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className={account.isGuaranteed ? 'guaranteed-row' : undefined}>
              <td>{account.code}</td>
              <td>
                <strong>{account.bankName}</strong>
                <small>{account.accountLabel}</small>
              </td>
              <td className="debit-value">{formatOptionalCurrency(getBankDebitCents(account))}</td>
              <td className="credit-value">{formatOptionalCurrency(getBankCreditCents(account))}</td>
              <td className={getBalanceValueClass(getBankStatementBalanceCents(account))}>
                {formatCurrency(getBankStatementBalanceCents(account))}
              </td>
              <td>
                <span className={account.isGuaranteed ? 'bank-status guaranteed' : 'bank-status available'}>
                  {account.isGuaranteed ? 'Sim' : 'Não'}
                </span>
              </td>
            </tr>
          ))}
          <tr className="cash-flow-balance-row">
            <td colSpan={4}>Saldo inicial</td>
            <td
              className={
                accounts.filter((account) => account.includeInCashFlow).reduce((sum, account) => sum + account.balanceCents, 0) < 0
                  ? 'balance-negative-value'
                  : 'balance-positive-value'
              }
            >
              {formatCurrency(accounts.filter((account) => account.includeInCashFlow).reduce((sum, account) => sum + account.balanceCents, 0))}
            </td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BankAccountTable({
  accounts,
  draft,
  isEditable,
  onAdd,
  onDraftChange,
  onRemove,
  onUpdate,
}: {
  accounts: CashFlowReportBankAccount[];
  draft: ManualBankDraft;
  isEditable: boolean;
  onAdd: () => void;
  onDraftChange: (patch: Partial<ManualBankDraft>) => void;
  onRemove: (accountId: string) => void;
  onUpdate: (accountId: string, patch: Partial<CashFlowReportBankAccount>) => void;
}) {
  return (
    <div className="cash-report-bank-wrap">
      <table className="cash-report-table bank">
        <thead>
          <tr>
            <th>Código</th>
            <th>Banco</th>
            <th className="debit-heading">Débito</th>
            <th className="credit-heading">Crédito</th>
            <th className="balance-heading">Saldo</th>
            <th>Garantida</th>
            <th>Entra no fluxo</th>
            {isEditable ? <th>Ação</th> : null}
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 && !isEditable ? (
            <tr>
              <td colSpan={isEditable ? 8 : 7}>Nenhum banco informado na planilha.</td>
            </tr>
          ) : null}
          {accounts.map((account) => (
            <tr key={account.id} className={account.isGuaranteed ? 'guaranteed-row' : undefined}>
              <td>
                {isEditable ? (
                  <input
                    className="bank-sheet-input code"
                    value={account.code}
                    onChange={(event) => onUpdate(account.id, { code: event.target.value })}
                  />
                ) : (
                  account.code
                )}
              </td>
              <td>
                {isEditable ? (
                  <input
                    className="bank-sheet-input"
                    value={account.accountLabel}
                    onChange={(event) => onUpdate(account.id, { accountLabel: event.target.value })}
                  />
                ) : (
                  <>
                    <strong>{account.bankName}</strong>
                    <small>{account.accountLabel}</small>
                  </>
                )}
              </td>
              <td className="debit-value">
                {isEditable ? (
                  <input
                    className="bank-sheet-input money"
                    type="number"
                    step="0.01"
                    value={formatCentsForInput(getBankDebitCents(account))}
                    onChange={(event) => {
                      const debitCents = numberInputToCents(event.target.value) ?? 0;
                      const creditCents = getBankCreditCents(account);
                      const balanceCents = creditCents - debitCents;
                      onUpdate(account.id, { debitCents, creditCents, balanceCents, runningBalanceCents: balanceCents });
                    }}
                  />
                ) : (
                  formatOptionalCurrency(getBankDebitCents(account))
                )}
              </td>
              <td className="credit-value">
                {isEditable ? (
                  <input
                    className="bank-sheet-input money"
                    type="number"
                    step="0.01"
                    value={formatCentsForInput(getBankCreditCents(account))}
                    onChange={(event) => {
                      const creditCents = numberInputToCents(event.target.value) ?? 0;
                      const debitCents = getBankDebitCents(account);
                      const balanceCents = creditCents - debitCents;
                      onUpdate(account.id, { debitCents, creditCents, balanceCents, runningBalanceCents: balanceCents });
                    }}
                  />
                ) : (
                  formatOptionalCurrency(getBankCreditCents(account))
                )}
              </td>
              <td className={getBalanceValueClass(getBankStatementBalanceCents(account))}>
                {isEditable ? (
                  <input
                    className="bank-sheet-input money"
                    type="number"
                    step="0.01"
                    value={formatCentsForInput(getBankStatementBalanceCents(account))}
                    onChange={(event) => {
                      const balanceCents = numberInputToCents(event.target.value) ?? 0;
                      onUpdate(account.id, {
                        debitCents: balanceCents < 0 ? Math.abs(balanceCents) : 0,
                        creditCents: balanceCents > 0 ? balanceCents : 0,
                        balanceCents,
                        runningBalanceCents: balanceCents,
                      });
                    }}
                  />
                ) : (
                  formatCurrency(getBankStatementBalanceCents(account))
                )}
              </td>
              <td>
                {isEditable ? (
                  <label className="bank-sheet-check">
                    <input
                      checked={account.isGuaranteed}
                      type="checkbox"
                      onChange={(event) => onUpdate(account.id, { isGuaranteed: event.target.checked })}
                    />
                    Sim
                  </label>
                ) : (
                  <span className={account.isGuaranteed ? 'bank-status guaranteed' : 'bank-status available'}>
                    {account.isGuaranteed ? 'Sim' : 'Não'}
                  </span>
                )}
              </td>
              <td>
                {isEditable ? (
                  <label className="bank-sheet-check">
                    <input
                      checked={account.includeInCashFlow}
                      disabled={account.isGuaranteed}
                      type="checkbox"
                      onChange={(event) => onUpdate(account.id, { includeInCashFlow: event.target.checked })}
                    />
                    Sim
                  </label>
                ) : account.includeInCashFlow ? (
                  'Sim'
                ) : (
                  'Não'
                )}
              </td>
              {isEditable ? (
                <td>
                  <button className="bank-sheet-action danger" type="button" onClick={() => onRemove(account.id)}>
                    Remover
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
          {isEditable ? (
            <tr className="manual-bank-row">
              <td>
                <input
                  className="bank-sheet-input code"
                  placeholder="01"
                  value={draft.code}
                  onChange={(event) => onDraftChange({ code: event.target.value })}
                />
              </td>
              <td>
                <input
                  className="bank-sheet-input"
                  placeholder="ITAU - (53395) - POA"
                  value={draft.accountLabel}
                  onChange={(event) => onDraftChange({ accountLabel: event.target.value })}
                />
              </td>
              <td className="debit-value">
                <input
                  className="bank-sheet-input money"
                  placeholder="0,00"
                  type="number"
                  step="0.01"
                  value={draft.debitValue}
                  onChange={(event) => onDraftChange({ debitValue: event.target.value })}
                />
              </td>
              <td className="credit-value">
                <input
                  className="bank-sheet-input money"
                  placeholder="0,00"
                  type="number"
                  step="0.01"
                  value={draft.creditValue}
                  onChange={(event) => onDraftChange({ creditValue: event.target.value })}
                />
              </td>
              <td className="balance-positive-value">
                <input
                  className="bank-sheet-input money"
                  placeholder="0,00"
                  type="number"
                  step="0.01"
                  value={draft.balanceValue}
                  onChange={(event) => onDraftChange({ balanceValue: event.target.value })}
                />
              </td>
              <td>
                <label className="bank-sheet-check">
                  <input
                    checked={draft.isGuaranteed}
                    type="checkbox"
                    onChange={(event) => onDraftChange({ isGuaranteed: event.target.checked })}
                  />
                  Sim
                </label>
              </td>
              <td>
                <label className="bank-sheet-check">
                  <input
                    checked={draft.includeInCashFlow}
                    disabled={draft.isGuaranteed}
                    type="checkbox"
                    onChange={(event) => onDraftChange({ includeInCashFlow: event.target.checked })}
                  />
                  Sim
                </label>
              </td>
              <td>
                <button className="bank-sheet-action" type="button" onClick={onAdd}>
                  Adicionar
                </button>
              </td>
            </tr>
          ) : null}
          <tr className="cash-flow-balance-row">
            <td colSpan={4}>Saldo inicial</td>
            <td
              className={
                accounts.filter((account) => account.includeInCashFlow).reduce((sum, account) => sum + account.balanceCents, 0) < 0
                  ? 'balance-negative-value'
                  : 'balance-positive-value'
              }
            >
              {formatCurrency(accounts.filter((account) => account.includeInCashFlow).reduce((sum, account) => sum + account.balanceCents, 0))}
            </td>
            <td>-</td>
            <td>-</td>
            {isEditable ? <td /> : null}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DateRangeControl({
  isOpen,
  preset,
  startDate,
  endDate,
  availableStartDate,
  availableEndDate,
  customStartDate,
  customEndDate,
  onPresetChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onToggle,
  onClose,
}: {
  isOpen: boolean;
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  availableStartDate: string;
  availableEndDate: string;
  customStartDate: string;
  customEndDate: string;
  onPresetChange: (preset: DateRangePreset) => void;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="period-menu">
      <button
        type="button"
        className={isOpen ? 'period-menu-button active' : 'period-menu-button'}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <CalendarDays size={15} />
        <span>{formatPeriodLabel(startDate, endDate)}</span>
      </button>

      {isOpen ? (
        <div className="period-popover" role="dialog" aria-label="Selecionar período do fluxo de caixa">
          <div className="period-popover-header">
            <div>
              <strong>Período exibido</strong>
              <small>
                Base: {formatCashFlowReportDate(availableStartDate)} ate {formatCashFlowReportDate(availableEndDate)}
              </small>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar filtro de período">
              x
            </button>
          </div>

          <div className="period-actions" role="group" aria-label="Atalhos de período">
            {DATE_RANGE_PRESETS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={preset === option.value ? 'active' : ''}
                onClick={() => onPresetChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="period-date-fields">
            <label>
              <span>De</span>
              <input
                type="date"
                min={availableStartDate}
                max={availableEndDate}
                value={customStartDate || startDate}
                onChange={(event) => onCustomStartDateChange(event.target.value)}
              />
            </label>
            <label>
              <span>Ate</span>
              <input
                type="date"
                min={availableStartDate}
                max={availableEndDate}
                value={customEndDate || endDate}
                onChange={(event) => onCustomEndDateChange(event.target.value)}
              />
            </label>
          </div>

          <button type="button" className="period-apply-button" onClick={onClose}>
            Aplicar período
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
  icon,
  note,
  numeric = false,
}: {
  label: string;
  value: number;
  tone?: FinancialTone;
  icon?: React.ReactNode;
  note?: string;
  numeric?: boolean;
}) {
  return (
    <article className={`cash-flow-metric ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{numeric ? value.toLocaleString('pt-BR') : formatCurrency(value)}</strong>
        {note ? <small>{note}</small> : null}
      </div>
      {icon ? <i>{icon}</i> : null}
    </article>
  );
}

type FinancialTone = 'neutral' | 'positive' | 'negative' | 'debit' | 'credit' | 'balance-positive' | 'balance-negative';

function getBalanceTone(valueCents: number): FinancialTone {
  return valueCents < 0 ? 'balance-negative' : 'balance-positive';
}

function getFinalBalanceCardToneClass(valueCents: number): 'final-balance-card-positive' | 'final-balance-card-negative' {
  return valueCents < 0 ? 'final-balance-card-negative' : 'final-balance-card-positive';
}

function getBalanceValueClass(valueCents: number): 'balance-positive-value' | 'balance-negative-value' {
  return valueCents < 0 ? 'balance-negative-value' : 'balance-positive-value';
}

function TableFilters({
  search,
  setSearch,
  filter,
  setFilter,
}: {
  search: string;
  setSearch: (value: string) => void;
  filter: MovementFilter;
  setFilter: (value: MovementFilter) => void;
}) {
  return (
    <div className="cash-flow-filter-bar">
      <label className="cash-flow-search">
        <Search size={16} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, conta ou data..." />
      </label>
      <select value={filter} onChange={(event) => setFilter(event.target.value as MovementFilter)}>
        <option value="ALL">Todos</option>
        <option value="DEBITO">Débitos</option>
        <option value="CREDITO">Créditos</option>
      </select>
    </div>
  );
}

function MovementTable({ movements }: { movements: CashFlowReportMovement[] }) {
  if (movements.length === 0) {
    return <div className="empty-state">Nenhuma movimentação encontrada.</div>;
  }

  return (
    <div className="cash-report-table-wrap">
      <table className="cash-report-table movement">
        <thead>
          <tr>
            <th>Data</th>
            <th>Documento</th>
            <th>Conta / Razão social</th>
            <th>Tipo</th>
            <th>Previsão</th>
            <th>Baixado</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>{formatCashFlowReportDate(movement.dueDate)}</td>
              <td>{movement.documentNumber}</td>
              <td>{movement.accountName}</td>
              <td>
                <span className={movement.transactionType === 'DEBITO' ? 'movement-type debit' : 'movement-type credit'}>
                  {getTransactionTypeLabel(movement.transactionType)}
                </span>
              </td>
              <td>{movement.isForecast ? 'Sim' : 'Não'}</td>
              <td>{movement.isSettled ? 'Sim' : 'Não'}</td>
              <td className={movement.transactionType === 'DEBITO' ? 'debit-value' : 'credit-value'}>{formatCurrency(movement.valueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariationTable({ variations }: { variations: CashFlowReportVariation[] }) {
  if (variations.length === 0) {
    return <div className="empty-state">Nenhuma variação encontrada contra a versão anterior.</div>;
  }

  return (
    <div className="cash-report-table-wrap">
      <table className="cash-report-table movement">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Conta / Razão social</th>
            <th>Tipo</th>
            <th>Variação</th>
            <th>Data anterior</th>
            <th>Data atual</th>
            <th>Valor anterior</th>
            <th>Valor atual</th>
            <th>Impacto</th>
          </tr>
        </thead>
        <tbody>
          {variations.map((variation) => (
            <tr key={variation.id} className={variation.impactCents < 0 ? 'variation-negative-row' : 'variation-positive-row'}>
              <td>{variation.documentNumber}</td>
              <td>{variation.accountName}</td>
              <td>{getTransactionTypeLabel(variation.transactionType)}</td>
              <td>{variation.variationType.replace(/_/g, ' ')}</td>
              <td>{formatCashFlowReportDate(variation.previousDueDate)}</td>
              <td>{formatCashFlowReportDate(variation.dueDate)}</td>
              <td>{variation.previousValueCents === null || variation.previousValueCents === undefined ? '-' : formatCurrency(variation.previousValueCents)}</td>
              <td>{variation.currentValueCents === null || variation.currentValueCents === undefined ? '-' : formatCurrency(variation.currentValueCents)}</td>
              <td className={variation.impactCents < 0 ? 'negative-value' : 'positive-value'}>{formatCurrency(variation.impactCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
