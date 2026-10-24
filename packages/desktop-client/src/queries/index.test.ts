import { accountFilter, uncategorizedTransactions } from './index';

describe('uncategorized transactions', () => {
  it('leaves starting balances out of the uncategorized count and list', () => {
    expect(
      uncategorizedTransactions().serialize().filterExpressions[0],
    ).toMatchObject({ category: null, starting_balance_flag: false });
    expect(accountFilter('uncategorized')).toMatchObject({
      category: null,
      starting_balance_flag: false,
    });
    // Still listed in its account's register
    expect(accountFilter('acct')).not.toHaveProperty('starting_balance_flag');
  });
});
