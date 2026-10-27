import { send } from '@actual-app/core/platform/client/connection';
import type { TransactionEntity } from '@actual-app/core/types/models';

import { aqlQuery } from '#queries/aqlQuery';

import { createReconciliationTransaction } from './reconciliation';

vi.mock('@actual-app/core/platform/client/connection', () => ({
  send: vi.fn(),
  listen: vi.fn(() => vi.fn()),
}));
vi.mock('#queries/aqlQuery');

type Added = Partial<TransactionEntity>;

async function reconcile({
  isCard,
  rule = {},
  transferPayee = false,
}: {
  isCard: boolean;
  rule?: Added;
  transferPayee?: boolean;
}): Promise<Added> {
  let added: Added[] = [];
  vi.mocked(send).mockImplementation((async (
    name: string,
    args: { transaction: TransactionEntity; added: Added[] },
  ) => {
    if (name === 'is-credit-card-account') return isCard;
    if (name === 'rules-run') return { ...args.transaction, ...rule };
    if (name === 'transactions-batch-update') added = args.added;
  }) as unknown as typeof send);
  vi.mocked(aqlQuery).mockResolvedValue({
    data: [{ transfer_acct: transferPayee ? 'checking' : null }],
    dependencies: [],
  });

  await createReconciliationTransaction('account', -5000);
  expect(send).toHaveBeenCalledWith('is-credit-card-account', {
    id: 'account',
  });
  expect(added).toHaveLength(1);
  return added[0];
}

describe('createReconciliationTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks the adjustment on a card as a starting balance', async () => {
    const added = await reconcile({ isCard: true });

    expect(added.category ?? null).toBeNull();
    expect(added.starting_balance_flag).toBe(true);
  });

  it('leaves the adjustment unmarked on other accounts', async () => {
    const added = await reconcile({
      isCard: false,
      rule: { payee: 'transfer-payee' },
      transferPayee: true,
    });

    expect(added.starting_balance_flag).toBeUndefined();
    expect(aqlQuery).not.toHaveBeenCalled();
  });

  it('leaves a rule-categorised adjustment unmarked', async () => {
    const added = await reconcile({ isCard: true, rule: { category: 'food' } });

    expect(added.category).toBe('food');
    expect(added.starting_balance_flag).toBeUndefined();
  });

  it('leaves an adjustment a rule split unmarked', async () => {
    const added = await reconcile({
      isCard: true,
      rule: {
        subtransactions: [
          { amount: -2500 },
          { amount: -2500 },
        ] as TransactionEntity['subtransactions'],
      },
    });

    expect(added.starting_balance_flag).toBeUndefined();
  });

  it('leaves an adjustment a rule made a transfer unmarked', async () => {
    const added = await reconcile({
      isCard: true,
      rule: { payee: 'transfer-payee' },
      transferPayee: true,
    });

    expect(added.starting_balance_flag).toBeUndefined();
  });
});
