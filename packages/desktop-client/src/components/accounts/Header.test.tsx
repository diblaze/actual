import type { ComponentProps } from 'react';

import type { TransactionEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';

import { SelectedProvider } from '#hooks/useSelected';
import { SplitsExpandedProvider } from '#hooks/useSplitsExpanded';
import { TestProviders } from '#mocks';

import { AccountHeader } from './Header';

vi.mock('./Balance', () => ({ Balances: () => null }));
vi.mock('./BalanceHistoryGraph', () => ({ BalanceHistoryGraph: () => null }));

function transaction(
  id: string,
  amount: number,
  cleared: boolean,
): TransactionEntity {
  return { id, amount, cleared, account: 'a', date: '2024-01-01' };
}

function renderHeader(selected: string[], transactions: TransactionEntity[]) {
  const props = {
    tableRef: { current: null },
    accountName: 'Checking',
    accountId: 'a',
    savedFilters: [],
    accountsSyncing: [],
    accounts: [],
    transactions,
    search: '',
    filterConditions: [],
    filterConditionsOp: 'and',
  } as unknown as ComponentProps<typeof AccountHeader>;
  render(
    <TestProviders>
      <SplitsExpandedProvider>
        <SelectedProvider
          instance={{ items: new Set(selected), dispatch: vi.fn() }}
        >
          <AccountHeader {...props} />
        </SelectedProvider>
      </SplitsExpandedProvider>
    </TestProviders>,
  );
  return screen.getByRole('toolbar', { name: 'Selected' });
}

describe('AccountHeader bulk toolbar', () => {
  it('totals the selected transactions', () => {
    const toolbar = renderHeader(
      ['t1', 't2'],
      [transaction('t1', -2350, true), transaction('t2', -1000, false)],
    );

    expect(toolbar).toHaveTextContent('2 selected');
    expect(toolbar).toHaveTextContent('-33.50');
    expect(toolbar).toHaveTextContent('Mark cleared');
  });

  it('shows no total while a selected transaction is not loaded', () => {
    const toolbar = renderHeader(
      ['t1', 'unloaded'],
      [transaction('t1', -2350, true)],
    );

    expect(toolbar).toHaveTextContent('2 selected');
    expect(toolbar).not.toHaveTextContent('-23.50');
    expect(toolbar).not.toHaveTextContent('·');
    // The wording follows the loaded ones
    expect(toolbar).toHaveTextContent('Mark uncleared');
  });
});
