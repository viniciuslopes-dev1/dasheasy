import type {
  BankAccount,
  CashFlowDataset,
  CashFlowMetrics,
  CashFlowMovement,
  DailyCashFlow,
} from '../types/cashFlow';

const TARGET_TOTAL_DEBITS_CENTS = 501731293;
const TARGET_TOTAL_CREDITS_CENTS = 469511654;

const dailyPlan: Array<{ date: string; debitCents: number; creditCents: number }> = [
  { date: '2026-06-02', debitCents: 31460158, creditCents: 0 },
  { date: '2026-06-03', debitCents: 0, creditCents: 16435221 },
  { date: '2026-06-04', debitCents: 10000000, creditCents: 0 },
  { date: '2026-06-05', debitCents: 40000000, creditCents: 80000000 },
  { date: '2026-06-06', debitCents: 25000000, creditCents: 0 },
  { date: '2026-06-07', debitCents: 0, creditCents: 33000000 },
  { date: '2026-06-08', debitCents: 72000000, creditCents: 30000000 },
  { date: '2026-06-09', debitCents: 32000000, creditCents: 0 },
  { date: '2026-06-10', debitCents: 26000000, creditCents: 0 },
  { date: '2026-06-11', debitCents: 65421180, creditCents: 35000000 },
  { date: '2026-06-12', debitCents: 0, creditCents: 38421180 },
  { date: '2026-06-13', debitCents: 14000000, creditCents: 0 },
  { date: '2026-06-14', debitCents: 16000000, creditCents: 0 },
  { date: '2026-06-15', debitCents: 26000000, creditCents: 22000000 },
  { date: '2026-06-16', debitCents: 0, creditCents: 42000000 },
  { date: '2026-06-17', debitCents: 64000000, creditCents: 28000000 },
  { date: '2026-06-18', debitCents: 0, creditCents: 24000000 },
  { date: '2026-06-19', debitCents: 28000000, creditCents: 0 },
  { date: '2026-06-20', debitCents: 31000000, creditCents: 65000000 },
  { date: '2026-06-22', debitCents: 20849955, creditCents: 55655253 },
];

const debitCounterparties = [
  'Sulina de Metais',
  'Energia operacional',
  'Tributos federais',
  'Folha e encargos',
  'Fornecedor estrategico',
  'Manutencao industrial',
];

const creditCounterparties = [
  'Cliente exportacao',
  'Recebimento carteira',
  'Cliente mercado interno',
  'Antecipação bancária',
  'Contrato recorrente',
];

export const sampleCashFlowDataset: CashFlowDataset = {
  monthLabel: 'Junho de 2026',
  startDate: '2026-06-01',
  endDate: '2026-06-22',
  initialForecastClosingCents: 69005298,
  bankAccounts: [
    {
      id: 'itau-341',
      code: '341',
      bank: 'ITAU',
      description: 'Conta corrente principal',
      balanceCents: 61230412,
      includeInCash: true,
      updatedAt: '2026-06-01',
    },
    {
      id: 'bradesco-237',
      code: '237',
      bank: 'BRADESCO',
      description: 'Conta operacional',
      balanceCents: 24238125,
      includeInCash: true,
      updatedAt: '2026-06-01',
    },
    {
      id: 'caixa-104',
      code: '104',
      bank: 'CAIXA',
      description: 'Aplicacao resgate imediato',
      balanceCents: 9556400,
      includeInCash: true,
      updatedAt: '2026-06-01',
    },
    {
      id: 'garantida-19650',
      code: '19650',
      bank: 'ITAU',
      description: 'Garantida',
      balanceCents: -58000000,
      includeInCash: false,
      updatedAt: '2026-06-01',
    },
    {
      id: 'garantida-17523',
      code: '17523',
      bank: 'ITAU',
      description: 'Garantida',
      balanceCents: -24000000,
      includeInCash: false,
      updatedAt: '2026-06-01',
    },
  ],
  movements: buildSampleMovements(),
  changes: [
    {
      id: 'change-1',
      registeredAt: '2026-06-08',
      affectedDate: '2026-06-15',
      title: 'Manutencao emergencial da maquina',
      changeType: 'CRIADO',
      movementType: 'DEBITO',
      impactCents: -1850000,
      reason: 'Despesa não prevista na abertura do mês.',
    },
    {
      id: 'change-2',
      registeredAt: '2026-06-09',
      affectedDate: '2026-06-12',
      title: 'Recebimento cliente antecipado',
      changeType: 'CRIADO',
      movementType: 'CREDITO',
      impactCents: 2500000,
      reason: 'Crédito entrou antes do previsto.',
    },
    {
      id: 'change-3',
      registeredAt: '2026-06-11',
      affectedDate: '2026-06-17',
      title: 'Fornecedor com valor reajustado',
      changeType: 'VALOR_ALTERADO',
      movementType: 'DEBITO',
      impactCents: -4200000,
      reason: 'Alteração de valor em título ja previsto.',
    },
    {
      id: 'change-4',
      registeredAt: '2026-06-16',
      affectedDate: '2026-06-19',
      title: 'Imposto complementar',
      changeType: 'CRIADO',
      movementType: 'DEBITO',
      impactCents: -1800000,
      reason: 'Lançamento fiscal incluido apos previsão inicial.',
    },
    {
      id: 'change-5',
      registeredAt: '2026-06-20',
      affectedDate: '2026-06-22',
      title: 'Cliente postergou parte do pagamento',
      changeType: 'DATA_ALTERADA',
      movementType: 'CREDITO',
      impactCents: -850000,
      reason: 'Parte do recebimento ficou para fora da janela analisada.',
    },
  ],
  snapshots: [
    { id: 'snapshot-1', snapshotDate: '2026-06-01', closingForecastCents: 69005298 },
    { id: 'snapshot-2', snapshotDate: '2026-06-03', closingForecastCents: 67405298 },
    { id: 'snapshot-3', snapshotDate: '2026-06-08', closingForecastCents: 66205298 },
    { id: 'snapshot-4', snapshotDate: '2026-06-11', closingForecastCents: 60405298 },
    { id: 'snapshot-5', snapshotDate: '2026-06-16', closingForecastCents: 64205298 },
    { id: 'snapshot-6', snapshotDate: '2026-06-22', closingForecastCents: 62805298 },
  ],
};

export function getIncludedBankBalanceCents(accounts: BankAccount[]): number {
  return accounts.reduce((sum, account) => (account.includeInCash ? sum + account.balanceCents : sum), 0);
}

export function calculateDailyCashFlow(dataset: CashFlowDataset): DailyCashFlow[] {
  const initialBalanceCents = getIncludedBankBalanceCents(dataset.bankAccounts);
  if (dataset.dailyEntries?.length) {
    const dailyEntryByDate = dataset.dailyEntries.reduce<Record<string, { debitCents: number; creditCents: number; projectedBalanceCents?: number }>>(
      (acc, entry) => {
        acc[entry.date] = entry;
        return acc;
      },
      {},
    );

    let projectedBalanceCents = initialBalanceCents;
    return enumerateDates(dataset.startDate, dataset.endDate).map((date) => {
      const entry = dailyEntryByDate[date] ?? { debitCents: 0, creditCents: 0 };
      const netCents = entry.creditCents - entry.debitCents;
      projectedBalanceCents = entry.projectedBalanceCents ?? projectedBalanceCents + netCents;

      return {
        date,
        debitCents: entry.debitCents,
        creditCents: entry.creditCents,
        netCents,
        projectedBalanceCents,
      };
    });
  }

  const movementByDate = dataset.movements.reduce<Record<string, { debitCents: number; creditCents: number }>>(
    (acc, movement) => {
      if (movement.status === 'CANCELADO') {
        return acc;
      }

      acc[movement.date] ??= { debitCents: 0, creditCents: 0 };
      if (movement.type === 'DEBITO') {
        acc[movement.date].debitCents += movement.valueCents;
      } else {
        acc[movement.date].creditCents += movement.valueCents;
      }
      return acc;
    },
    {},
  );

  let projectedBalanceCents = initialBalanceCents;
  return enumerateDates(dataset.startDate, dataset.endDate).map((date) => {
    const movement = movementByDate[date] ?? { debitCents: 0, creditCents: 0 };
    const netCents = movement.creditCents - movement.debitCents;
    projectedBalanceCents += netCents;

    return {
      date,
      debitCents: movement.debitCents,
      creditCents: movement.creditCents,
      netCents,
      projectedBalanceCents,
    };
  });
}

export function calculateCashFlowMetrics(dataset: CashFlowDataset): CashFlowMetrics {
  const dailyCashFlow = calculateDailyCashFlow(dataset);
  const totalDebitsCents = dailyCashFlow.reduce((sum, day) => sum + day.debitCents, 0);
  const totalCreditsCents = dailyCashFlow.reduce((sum, day) => sum + day.creditCents, 0);
  const lastDay = dailyCashFlow[dailyCashFlow.length - 1];
  const minDay = dailyCashFlow.reduce(
    (currentMin, day) => (day.projectedBalanceCents < currentMin.projectedBalanceCents ? day : currentMin),
    dailyCashFlow[0],
  );

  return {
    initialBalanceCents: getIncludedBankBalanceCents(dataset.bankAccounts),
    totalDebitsCents,
    totalCreditsCents,
    initialForecastClosingCents: dataset.initialForecastClosingCents,
    currentForecastClosingCents: lastDay?.projectedBalanceCents ?? 0,
    accumulatedVariationCents: dataset.changes.reduce((sum, change) => sum + change.impactCents, 0),
    minProjectedBalanceCents: minDay?.projectedBalanceCents ?? 0,
    minProjectedBalanceDate: minDay?.date ?? dataset.startDate,
  };
}

export function formatCashFlowDate(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
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

function buildSampleMovements(): CashFlowMovement[] {
  return dailyPlan.flatMap((day, index) => {
    const movements: CashFlowMovement[] = [];
    if (day.debitCents > 0) {
      movements.push({
        id: `debit-${index + 1}`,
        date: day.date,
        documentNumber: `D-${String(index + 1).padStart(3, '0')}`,
        counterparty: debitCounterparties[index % debitCounterparties.length],
        type: 'DEBITO',
        category: index % 3 === 0 ? 'Fornecedor' : index % 3 === 1 ? 'Tributario' : 'Operacional',
        valueCents: day.debitCents,
        status: 'PREVISTO',
        origin: index > 9 ? 'IMPORTACAO_ATUALIZACAO' : 'IMPORTACAO_INICIAL',
      });
    }
    if (day.creditCents > 0) {
      movements.push({
        id: `credit-${index + 1}`,
        date: day.date,
        documentNumber: `C-${String(index + 1).padStart(3, '0')}`,
        counterparty: creditCounterparties[index % creditCounterparties.length],
        type: 'CREDITO',
        category: index % 2 === 0 ? 'Cliente' : 'Recebimento',
        valueCents: day.creditCents,
        status: 'PREVISTO',
        origin: index > 9 ? 'IMPORTACAO_ATUALIZACAO' : 'IMPORTACAO_INICIAL',
      });
    }
    return movements;
  });
}

export const expectedSampleTotals = {
  totalDebitsCents: TARGET_TOTAL_DEBITS_CENTS,
  totalCreditsCents: TARGET_TOTAL_CREDITS_CENTS,
  currentForecastClosingCents: 62805298,
  minProjectedBalanceCents: -12421180,
};
