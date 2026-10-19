import { beforeEach, describe, expect, it, vi } from 'vitest';

import { send } from '#server/main-app';

import {
  getBudgetName,
  importAccounts,
  importBudgets,
  importCategories,
  importPayees,
  importScheduledTransactions,
  importTransactions,
  parseFile,
} from './ynab5';
import type { Account, Payee, Transaction } from './ynab5-types';

vi.mock('#server/main-app', () => ({
  send: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(send).mockReset();
});

function toBuffer(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj));
}

function makePayee(overrides: Partial<Payee> = {}): Payee {
  return {
    id: 'payee-1',
    name: 'Some Payee',
    deleted: false,
    ...overrides,
  };
}

describe('importPayees', () => {
  it('does not create an Actual payee for a YNAB transfer-linked payee', async () => {
    vi.mocked(send).mockResolvedValue('created-payee-id');

    const transferPayee = makePayee({
      id: 'ynab-transfer-payee',
      name: 'Transfer : Savings',
      transfer_account_id: 'ynab-account-2',
    });
    const normalPayee = makePayee({
      id: 'ynab-normal-payee',
      name: 'Coffee Shop',
    });

    const entityIdMap = new Map<string, string>();
    await importPayees(
      { payees: [transferPayee, normalPayee] } as Parameters<
        typeof importPayees
      >[0],
      entityIdMap,
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('api/payee-create', {
      payee: { name: 'Coffee Shop' },
    });
    expect(entityIdMap.has('ynab-transfer-payee')).toBe(false);
    expect(entityIdMap.get('ynab-normal-payee')).toBe('created-payee-id');
  });

  it('still skips deleted payees', async () => {
    vi.mocked(send).mockResolvedValue('created-payee-id');

    const deletedPayee = makePayee({ id: 'deleted-1', deleted: true });
    const entityIdMap = new Map<string, string>();

    await importPayees(
      { payees: [deletedPayee] } as Parameters<typeof importPayees>[0],
      entityIdMap,
    );

    expect(send).not.toHaveBeenCalled();
    expect(entityIdMap.size).toBe(0);
  });
});

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    date: '2026-01-01',
    amount: -10000,
    cleared: 'cleared',
    approved: true,
    account_id: 'ynab-account-1',
    deleted: false,
    ...overrides,
  };
}

describe('importTransactions', () => {
  it('resolves a transfer transaction to the account-transfer payee', async () => {
    const entityIdMap = new Map<string, string>([
      ['ynab-account-1', 'actual-account-1'],
      ['ynab-account-2', 'actual-account-2'],
    ]);

    const transactionOut = makeTransaction({
      id: 'txn-out',
      account_id: 'ynab-account-1',
      amount: -10000,
      transfer_account_id: 'ynab-account-2',
      transfer_transaction_id: 'txn-in',
      payee_id: 'ynab-transfer-payee',
    });
    const transactionIn = makeTransaction({
      id: 'txn-in',
      account_id: 'ynab-account-2',
      amount: 10000,
      transfer_account_id: 'ynab-account-1',
      transfer_transaction_id: 'txn-out',
      payee_id: 'ynab-transfer-payee',
    });

    vi.mocked(send).mockImplementation(async (name: string) => {
      if (name === 'api/payees-get') {
        return [
          {
            id: 'actual-payee-for-account-1',
            transfer_acct: 'actual-account-1',
          },
          {
            id: 'actual-payee-for-account-2',
            transfer_acct: 'actual-account-2',
          },
        ];
      }
      if (name === 'api/categories-get') {
        return [];
      }
      if (name === 'api/transactions-add') {
        return null;
      }
      throw new Error(`Unexpected send call: ${name}`);
    });

    await importTransactions(
      {
        payees: [],
        transactions: [transactionOut, transactionIn],
        subtransactions: [],
      } as unknown as Parameters<typeof importTransactions>[0],
      entityIdMap,
      new Set(),
    );

    const transactionsAddCalls = vi
      .mocked(send)
      .mock.calls.filter(([name]) => name === 'api/transactions-add');
    expect(transactionsAddCalls).toHaveLength(2);

    const allImportedTransactions = transactionsAddCalls.flatMap(
      ([, args]) => args.transactions,
    );
    const outImported = allImportedTransactions.find(
      t => t.id === entityIdMap.get('txn-out'),
    );
    const inImported = allImportedTransactions.find(
      t => t.id === entityIdMap.get('txn-in'),
    );

    expect(outImported.payee).toBe('actual-payee-for-account-2');
    expect(inImported.payee).toBe('actual-payee-for-account-1');

    expect(outImported.transfer_id).toBe(inImported.id);
    expect(inImported.transfer_id).toBe(outImported.id);
    expect(outImported.category).toBeNull();
    expect(inImported.category).toBeNull();
  });

  describe('starting balances', () => {
    const startingPayee = makePayee({
      id: 'ynab-start',
      name: 'Starting Balance',
    });

    async function importStart(type: Account['type'], options = {}) {
      vi.mocked(send).mockImplementation(async (name: string) => {
        if (name === 'api/payees-get') return [];
        if (name === 'api/categories-get') {
          return [
            { id: 'actual-income', name: 'Income' },
            { id: 'actual-start', name: 'Starting Balances' },
          ];
        }
        if (name === 'api/transactions-add') return null;
        throw new Error(`Unexpected send call: ${name}`);
      });
      const entityIdMap = new Map([
        ['ynab-account-1', 'actual-account-1'],
        ['ynab-rta', 'actual-income'],
      ]);
      await importTransactions(
        {
          accounts: [makeAccount({ id: 'ynab-account-1', type })],
          payees: [startingPayee],
          transactions: [
            makeTransaction({
              id: 'txn-start',
              amount: -5000000,
              payee_id: 'ynab-start',
              category_id: 'ynab-rta',
            }),
          ],
          subtransactions: [],
        } as unknown as Parameters<typeof importTransactions>[0],
        entityIdMap,
        new Set(),
        undefined,
        options,
      );
      const call = vi
        .mocked(send)
        .mock.calls.find(([name]) => name === 'api/transactions-add');
      return call?.[1].transactions[0].category;
    }

    it("leaves a card's starting balance uncategorised when the option is set", async () => {
      expect(
        await importStart('creditCard', { ccPaymentCategories: true }),
      ).toBeNull();
    });

    it("files a checking account's starting balance under Starting Balances", async () => {
      expect(await importStart('checking', { ccPaymentCategories: true })).toBe(
        'actual-start',
      );
    });

    it("files a card's starting balance under Starting Balances without the option", async () => {
      expect(await importStart('creditCard')).toBe('actual-start');
    });
  });
});

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'ynab-account-1',
    name: 'Account',
    type: 'checking',
    on_budget: true,
    closed: false,
    deleted: false,
    ...overrides,
  } as Account;
}

describe('importAccounts', () => {
  async function run(accounts: Account[], options = {}) {
    let n = 0;
    vi.mocked(send).mockImplementation(async () => `actual-${++n}`);
    const entityIdMap = new Map<string, string>();
    await importAccounts(
      { accounts } as Parameters<typeof importAccounts>[0],
      entityIdMap,
      vi.fn(),
      options,
    );
    return vi.mocked(send).mock.calls;
  }

  const card = makeAccount({ id: 'card', name: 'AMEX', type: 'creditCard' });
  const cc = { ccPaymentCategories: true };

  it('turns the credit card feature on before creating accounts when the option is set', async () => {
    const calls = await run([card], cc);
    expect(calls[0]).toEqual([
      'preferences/save',
      { id: 'flags.ccPaymentCategories', value: 'true' },
    ]);
  });

  it('leaves the credit card feature alone and sends stock account-create args without the option', async () => {
    const calls = await run([card]);
    expect(calls).toEqual([
      [
        'api/account-create',
        { account: { name: 'AMEX', offbudget: false, closed: false } },
      ],
    ]);
  });

  it('turns the feature on even when the export has no card accounts', async () => {
    const calls = await run([makeAccount()], cc);
    expect(calls[0][0]).toBe('preferences/save');
  });

  it('creates on-budget creditCard and lineOfCredit accounts as credit cards', async () => {
    const calls = await run(
      [card, makeAccount({ id: 'loc', name: 'LOC', type: 'lineOfCredit' })],
      cc,
    );
    const created = calls.filter(([name]) => name === 'api/account-create');
    expect(created.map(([, args]) => args.account.creditCard)).toEqual([
      true,
      true,
    ]);
  });

  it('creates a closed card as a closed credit card', async () => {
    const calls = await run([{ ...card, closed: true }], cc);
    expect(calls[1][1].account).toMatchObject({
      closed: true,
      creditCard: true,
    });
  });

  it('keeps an off-budget card off budget without creditCard', async () => {
    const calls = await run([{ ...card, on_budget: false }], cc);
    expect(calls[1][1].account).toMatchObject({
      offbudget: true,
      creditCard: false,
    });
  });

  it('does not mark checking, savings or cash as credit cards', async () => {
    const calls = await run(
      (['checking', 'savings', 'cash'] as const).map((type, i) =>
        makeAccount({ id: `a${i}`, type }),
      ),
      cc,
    );
    const created = calls.filter(([name]) => name === 'api/account-create');
    expect(created.map(([, args]) => args.account.creditCard)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('creates accounts one after another', async () => {
    let pending = 0;
    let overlapped = false;
    vi.mocked(send).mockImplementation(async (name: string) => {
      if (name !== 'api/account-create') return null;
      overlapped ||= pending > 0;
      pending++;
      await new Promise(resolve => setTimeout(resolve, 5));
      pending--;
      return 'id';
    });
    await importAccounts(
      { accounts: [card, { ...card, id: 'card2' }] } as Parameters<
        typeof importAccounts
      >[0],
      new Map(),
      vi.fn(),
      cc,
    );
    expect(overlapped).toBe(false);
  });
});

describe('credit card payment categories', () => {
  const ccGroup = {
    id: 'ynab-cc',
    name: 'Credit Card Payments',
    deleted: false,
  };
  const data = {
    category_groups: [ccGroup],
    categories: [
      {
        id: 'ynab-amex',
        name: 'AMEX',
        category_group_id: 'ynab-cc',
        deleted: false,
      },
      {
        id: 'ynab-visa',
        name: 'Visa',
        category_group_id: 'ynab-cc',
        deleted: false,
      },
    ],
    months: [
      {
        month: '2026-01-01',
        categories: [
          { id: 'ynab-amex', category_group_id: 'ynab-cc', budgeted: 50000 },
          { id: 'ynab-visa', category_group_id: 'ynab-cc', budgeted: 70000 },
        ],
      },
    ],
  } as unknown as Parameters<typeof importCategories>[0];

  async function mapCategories() {
    vi.mocked(send).mockImplementation(async (name: string) => {
      if (name === 'api/categories-get') {
        return [
          { id: 'actual-income', name: 'Income', group_id: 'g-income' },
          { id: 'actual-amex', name: 'AMEX', group_id: 'actual-cc' },
          { id: 'other-visa', name: 'Visa', group_id: 'other' },
        ];
      }
      if (name === 'api/category-groups-get') {
        return [
          { id: 'actual-cc', name: 'Credit Card Payments' },
          { id: 'other', name: 'Other' },
        ];
      }
      return 'created';
    });
    const entityIdMap = new Map<string, string>();
    await importCategories(data, entityIdMap, vi.fn(), {
      ccPaymentCategories: true,
    });
    return entityIdMap;
  }

  it('maps a YNAB payment category to the created payment category', async () => {
    const entityIdMap = await mapCategories();
    expect(entityIdMap.get('ynab-amex')).toBe('actual-amex');
    expect(
      vi
        .mocked(send)
        .mock.calls.some(([name]) => name === 'api/category-create'),
    ).toBe(false);
  });

  it('maps two cards named alike to their own payment categories', async () => {
    vi.mocked(send).mockImplementation(async (name: string) => {
      if (name === 'api/categories-get') {
        return [
          { id: 'actual-k1', name: 'Klarna', group_id: 'actual-cc' },
          { id: 'actual-k2', name: 'klarna (2)', group_id: 'actual-cc' },
        ];
      }
      if (name === 'api/category-groups-get') {
        return [{ id: 'actual-cc', name: 'Credit Card Payments' }];
      }
      return 'created';
    });
    const entityIdMap = new Map<string, string>();
    await importCategories(
      {
        category_groups: [ccGroup],
        categories: [
          {
            id: 'y1',
            name: 'Klarna',
            category_group_id: 'ynab-cc',
            deleted: false,
          },
          {
            id: 'y2',
            name: 'klarna',
            category_group_id: 'ynab-cc',
            deleted: false,
          },
        ],
      } as unknown as Parameters<typeof importCategories>[0],
      entityIdMap,
      vi.fn(),
      { ccPaymentCategories: true },
    );
    expect(entityIdMap.get('y1')).toBe('actual-k1');
    expect(entityIdMap.get('y2')).toBe('actual-k2');
  });

  it('skips a YNAB payment category without a created counterpart', async () => {
    const entityIdMap = await mapCategories();
    expect(entityIdMap.has('ynab-visa')).toBe(false);
  });

  async function budgets() {
    vi.mocked(send).mockResolvedValue(null);
    await importBudgets(data, new Map([['ynab-amex', 'actual-amex']]), vi.fn());
    return vi
      .mocked(send)
      .mock.calls.filter(([name]) => name === 'api/budget-set-amount')
      .map(([, args]) => args);
  }

  it('sets the budgeted amount of a mapped payment category', async () => {
    expect(await budgets()).toContainEqual({
      month: '2026-01',
      categoryId: 'actual-amex',
      amount: 5000,
    });
  });

  it('skips the budgeted amount of an unmapped payment category', async () => {
    expect(await budgets()).toHaveLength(1);
  });

  it('sets no payment category budgets without the option', async () => {
    vi.mocked(send).mockImplementation(async (name: string) => {
      if (name === 'api/categories-get') {
        return [{ id: 'actual-amex', name: 'AMEX', group_id: 'actual-cc' }];
      }
      return null;
    });
    const entityIdMap = new Map<string, string>();
    await importCategories(data, entityIdMap, vi.fn());
    await importBudgets(data, entityIdMap, vi.fn());
    expect(
      vi
        .mocked(send)
        .mock.calls.some(
          ([name]) =>
            name === 'api/budget-set-amount' ||
            name === 'api/category-groups-get',
        ),
    ).toBe(false);
  });
});

describe('importScheduledTransactions', () => {
  function makeScheduledTransaction() {
    return {
      id: 'scheduled-1',
      account_id: 'ynab-account-1',
      payee_id: 'ynab-payee-1',
      category_id: 'ynab-category-1',
      amount: -1000,
      memo: '',
      frequency: 'never',
      date_next: '2026-02-01',
      date_first: '2026-02-01',
      deleted: false,
    };
  }

  const entityIdMap = new Map<string, string>([
    ['ynab-account-1', 'actual-account-1'],
    ['ynab-payee-1', 'actual-payee-1'],
    ['ynab-category-1', 'actual-category-1'],
  ]);

  it('advances progress after its category rule update completes', async () => {
    const tick = vi.fn();
    const rule = {
      id: 'rule-1',
      stage: null,
      conditions_op: 'and',
      conditions: '[]',
      actions: '[]',
    };
    let queryCount = 0;

    vi.mocked(send).mockImplementation(async name => {
      if (name === 'api/payees-get') return [];
      if (name === 'api/schedule-create') return 'schedule-1';
      if (name === 'api/query') {
        queryCount += 1;
        return queryCount === 1 ? { data: 'rule-1' } : { data: [rule] };
      }
      if (name === 'api/rule-update') {
        expect(tick).not.toHaveBeenCalled();
        return null;
      }
      throw new Error(`Unexpected send call: ${name}`);
    });

    await importScheduledTransactions(
      {
        scheduled_transactions: [makeScheduledTransaction()],
        scheduled_subtransactions: [],
      } as unknown as Parameters<typeof importScheduledTransactions>[0],
      entityIdMap,
      new Set(),
      tick,
    );

    expect(tick).toHaveBeenCalledOnce();
  });

  it('does not advance progress when schedule creation fails', async () => {
    const tick = vi.fn();
    vi.mocked(send).mockImplementation(async name => {
      if (name === 'api/payees-get') return [];
      if (name === 'api/schedule-create') throw new Error('create failed');
      throw new Error(`Unexpected send call: ${name}`);
    });

    await expect(
      importScheduledTransactions(
        {
          scheduled_transactions: [makeScheduledTransaction()],
          scheduled_subtransactions: [],
        } as unknown as Parameters<typeof importScheduledTransactions>[0],
        entityIdMap,
        new Set(),
        tick,
      ),
    ).rejects.toThrow('create failed');

    expect(tick).not.toHaveBeenCalled();
  });
});

describe('ynab5 parseFile', () => {
  it('unwraps the legacy `budget` wrapper', () => {
    const data = parseFile(
      toBuffer({ data: { budget: { name: 'Legacy', accounts: [] } } }),
    );

    expect(data.name).toBe('Legacy');
    expect(getBudgetName('legacy.json', data)).toBe('Legacy');
  });

  it('unwraps the renamed `plan` wrapper from the current YNAB API', () => {
    const data = parseFile(
      toBuffer({ data: { plan: { name: 'Modern', accounts: [] } } }),
    );

    expect(data.name).toBe('Modern');
    expect(getBudgetName('modern.json', data)).toBe('Modern');
  });

  it('returns an already-unwrapped object unchanged', () => {
    const data = parseFile(toBuffer({ name: 'Bare', accounts: [] }));

    expect(data.name).toBe('Bare');
  });
});
