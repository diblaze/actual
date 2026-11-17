import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import type { AccountEntity } from '@actual-app/core/types/models';
import { render, screen, within } from '@testing-library/react';

import { accountQueries } from '#accounts';
import {
  markUpdatedAccounts,
  setAccountsSyncing,
} from '#accounts/accountsSlice';
import { SpreadsheetProvider } from '#hooks/useSpreadsheet';
import {
  createTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';

import { AccountsPage } from './AccountsPage';

vi.mock('#components/mobile/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: ReactNode }) => children,
}));

function account(
  id: string,
  name: string,
  extra: Partial<AccountEntity> = {},
): AccountEntity {
  return {
    id,
    name,
    offbudget: 0,
    closed: 0,
    sort_order: 1,
    ...extra,
  } as AccountEntity;
}

function renderPage(
  accounts: AccountEntity[],
  store = createTestAppStore(),
): (name: string) => HTMLElement {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(accountQueries.list().queryKey, accounts);

  render(
    <TestProviders queryClient={queryClient} store={store}>
      <SpreadsheetProvider>
        <MemoryRouter initialEntries={['/accounts']}>
          <AccountsPage />
        </MemoryRouter>
      </SpreadsheetProvider>
    </TestProviders>,
  );

  return name =>
    screen
      .getAllByTestId('account-list-item')
      .find(row => row.textContent?.includes(name))!;
}

describe('AccountsPage', () => {
  it('updated dot', () => {
    const store = createTestAppStore();
    store.dispatch(markUpdatedAccounts({ ids: ['checking'] }));
    const row = renderPage(
      [account('checking', 'Checking'), account('savings', 'Savings')],
      store,
    );

    expect(screen.getAllByLabelText('New transactions')).toHaveLength(1);
    expect(
      within(row('Checking')).getByLabelText('New transactions'),
    ).toBeInTheDocument();
  });

  it('failed sync marker', () => {
    const store = createTestAppStore();
    // Failed and updated at once: both markers show
    store.dispatch(markUpdatedAccounts({ ids: ['checking'] }));
    const row = renderPage(
      [
        account('checking', 'Checking', {
          bank_sync_status: 'reauth-required',
        }),
        account('savings', 'Savings', { bank_sync_status: 'ok' }),
      ],
      store,
    );

    expect(screen.getAllByLabelText('Sync failed')).toHaveLength(1);
    expect(
      within(row('Checking')).getByLabelText('Sync failed'),
    ).toBeInTheDocument();
    expect(
      within(row('Checking')).getByLabelText('New transactions'),
    ).toBeInTheDocument();
  });

  it('syncing pill', () => {
    const store = createTestAppStore();
    store.dispatch(setAccountsSyncing({ ids: ['checking'] }));
    const row = renderPage(
      [
        account('checking', 'Checking', { account_sync_source: 'simpleFin' }),
        account('savings', 'Savings', { account_sync_source: 'simpleFin' }),
      ],
      store,
    );

    expect(within(row('Checking')).getByText('Syncing')).toBeInTheDocument();
    expect(within(row('Savings')).getByText('Synced')).toBeInTheDocument();
    expect(screen.getAllByText('Syncing')).toHaveLength(1);
  });
});
