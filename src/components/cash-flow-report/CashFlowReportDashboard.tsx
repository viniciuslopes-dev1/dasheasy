import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Search, TrendingDown, TrendingUp } from 'lucide-react';
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

const TABS: Array<{ value: CashFlowReportTab; label: string }> = [
  { value: 'daily', label: 'Fluxo diário' },
  { value: 'movements', label: 'Movimentações' },
  { value: 'anticipated', label: 'Antecipados' },
  { value: 'banks', label: 'Bancos' },
  { value: 'variations', label: 'Variações' },
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

  useEffect(() => {
    setBankAccounts(dataset?.bankAccounts ?? []);
    setBankSaveStatus('idle');
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
  const metrics = useMemo(() => (effectiveDataset ? calculateCashFlowReportMetrics(effectiveDataset) : null), [effectiveDataset]);
  const variationImpactCents = useMemo(
    () => effectiveDataset?.variations.reduce((sum, variation) => sum + variation.impactCents, 0) ?? 0,
    [effectiveDataset],
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
    effectiveDataset?.variations.forEach((variation) => {
      if (variation.dueDate) {
        dates.add(variation.dueDate);
      }
      if (variation.previousDueDate) {
        dates.add(variation.previousDueDate);
      }
    });
    return dates;
  }, [effectiveDataset]);
  const filteredMovements = useMemo(
    () =>
      (effectiveDataset?.cashFlowMovements ?? []).filter((movement) => {
        const normalizedSearch = search.trim().toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          [movement.documentNumber, movement.accountName, movement.dueDate].join(' ').toLowerCase().includes(normalizedSearch);
        const matchesType = movementFilter === 'ALL' || movement.transactionType === movementFilter;
        return matchesSearch && matchesType;
      }),
    [effectiveDataset, movementFilter, search],
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

  if (!effectiveDataset || !metrics) {
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

  return (
    <section className="dashboard-area cash-report-area" aria-label="Fluxo de caixa">
      <div className="cash-report-shell">
        <section className="panel cash-report-header">
          <div>
            <span className="section-label">Fluxo de caixa</span>
            <h2>{effectiveDataset.monthLabel}</h2>
            <p>
              Créditos baixados entram em Antecipados e ficam fora do cálculo do fluxo. Saldo inicial não informado na
              planilha: cálculo iniciado em R$ 0,00.
            </p>
          </div>
          <div className="cash-report-header-kpis">
            <span>Saldo final projetado</span>
            <strong>{formatCurrency(metrics.closingBalanceCents)}</strong>
            <small>{effectiveDataset.monthLabel}</small>
          </div>
        </section>

        <div className="cash-report-metrics">
          <Metric label="Saldo inicial" value={metrics.initialBalanceCents} />
          <Metric label="Débitos" value={metrics.totalDebitsCents} tone="negative" icon={<TrendingDown size={17} />} />
          <Metric label="Créditos" value={metrics.totalCreditsCents} tone="positive" icon={<TrendingUp size={17} />} />
          <Metric label="Antecipados" value={metrics.anticipatedCreditsCents} />
          <Metric
            label="Variação acumulada"
            value={variationImpactCents}
            tone={variationImpactCents < 0 ? 'negative' : 'positive'}
          />
          <Metric label="Menor saldo" value={metrics.minBalanceCents} tone="negative" note={formatCashFlowReportDate(metrics.minBalanceDate)} />
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
              <span className="cash-flow-chip">{effectiveDataset.dailyRows.length} dias</span>
            </div>
            <div className="cash-report-table-wrap">
              <table className="cash-report-table cash-flow-statement-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Débito</th>
                    <th>Crédito</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="cash-flow-balance-row">
                    <td colSpan={3}>Saldo inicial</td>
                    <td className={metrics.initialBalanceCents < 0 ? 'negative-value' : 'positive-value'}>
                      {formatCurrency(metrics.initialBalanceCents)}
                    </td>
                  </tr>
                  {effectiveDataset.dailyRows.map((day) => (
                    <tr key={day.date} className={variationDates.has(day.date) ? 'changed-row' : undefined}>
                      <td>{formatCashFlowReportDate(day.date)}</td>
                      <td className="negative-value">{formatCurrency(day.debitCents)}</td>
                      <td className="positive-value">{formatCurrency(day.creditCents)}</td>
                      <td className={day.closingBalanceCents < 0 ? 'negative-value' : 'positive-value'}>{formatCurrency(day.closingBalanceCents)}</td>
                    </tr>
                  ))}
                  <tr className="cash-flow-balance-row">
                    <td colSpan={3}>Saldo final</td>
                    <td className={metrics.closingBalanceCents < 0 ? 'negative-value' : 'positive-value'}>
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
              <span className="cash-flow-chip">{effectiveDataset.anticipatedMovements.length} títulos</span>
            </div>
            <MovementTable movements={effectiveDataset.anticipatedMovements} />
          </section>
        ) : null}

        {activeTab === 'variations' ? (
          <section className="panel cash-report-table-panel">
            <div className="cash-flow-panel-heading">
              <div>
                <h3>Variações</h3>
                <p>Novos títulos, valores alterados e datas alteradas contra a base acumulada anterior.</p>
              </div>
              <span className="cash-flow-chip">{effectiveDataset.variations.length} variações</span>
            </div>
            <VariationTable variations={effectiveDataset.variations} />
          </section>
        ) : null}

        {effectiveDataset.issues.length ? (
          <section className="cash-report-note">
            <AlertTriangle size={16} />
            <span>{effectiveDataset.issues[0].message}</span>
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
            <th>Débito</th>
            <th>Crédito</th>
            <th>Saldo</th>
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
              <td className="negative-value">
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
              <td className="positive-value">
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
              <td className={getBankStatementBalanceCents(account) < 0 ? 'negative-value' : 'positive-value'}>
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
              <td>
                <input
                  className="bank-sheet-input money"
                  placeholder="0,00"
                  type="number"
                  step="0.01"
                  value={draft.debitValue}
                  onChange={(event) => onDraftChange({ debitValue: event.target.value })}
                />
              </td>
              <td>
                <input
                  className="bank-sheet-input money"
                  placeholder="0,00"
                  type="number"
                  step="0.01"
                  value={draft.creditValue}
                  onChange={(event) => onDraftChange({ creditValue: event.target.value })}
                />
              </td>
              <td>
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
                  ? 'negative-value'
                  : 'positive-value'
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
  tone?: 'neutral' | 'positive' | 'negative';
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
              <td>{formatCurrency(movement.valueCents)}</td>
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
