import { generateAccount } from '@actual-app/core/mocks';
import { initServer } from '@actual-app/core/platform/client/connection';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { accountQueries } from '#accounts';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';
import { mergeSyncedPrefs } from '#prefs/prefsSlice';

import { CategoryGroupMenuModal } from './CategoryGroupMenuModal';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: true }),
}));

const expenseGroup: CategoryGroupEntity = {
  id: 'usual',
  name: 'Usual Expenses',
  is_income: false,
  categories: [
    { id: 'groceries', name: 'Groceries', group: 'usual', is_income: false },
  ],
};

const incomeGroup: CategoryGroupEntity = {
  id: 'income',
  name: 'Income',
  is_income: true,
  categories: [
    { id: 'salary', name: 'Salary', group: 'income', is_income: true },
  ],
};

const visa = { ...generateAccount('Visa'), id: 'visa' };

const cardGroup: CategoryGroupEntity = {
  id: 'cards',
  name: 'Credit Cards',
  is_income: false,
  categories: [
    {
      id: 'visa-payment',
      name: 'Visa',
      group: 'cards',
      is_income: false,
      payment_account: visa.id,
    },
  ],
};

function renderModal(
  group: CategoryGroupEntity,
  budgetType: 'envelope' | 'tracking',
) {
  const onApplyBudgetTemplatesInGroup = vi.fn<(categories: string[]) => void>();
  const client = createTestQueryClient();
  const store = configureTestAppStore({ queryClient: client });
  store.dispatch(
    mergeSyncedPrefs({
      'flags.goalTemplatesEnabled': 'true',
      'flags.ccPaymentCategories': 'true',
      budgetType,
    }),
  );
  // Seeded: the store loads `#accounts` before this file's connection
  // mock, so its accounts query never reaches initServer
  client.setQueryData(accountQueries.lists(), [visa]);
  initServer({
    'get-categories': async () => ({
      grouped: [expenseGroup, incomeGroup, cardGroup],
      list: [
        ...(expenseGroup.categories ?? []),
        ...(incomeGroup.categories ?? []),
        ...(cardGroup.categories ?? []),
      ],
    }),
    query: async () => ({ data: [], dependencies: [] }),
  });
  render(
    <TestProviders queryClient={client} store={store}>
      <CategoryGroupMenuModal
        groupId={group.id}
        onSave={vi.fn()}
        onAddCategory={vi.fn()}
        onEditNotes={vi.fn()}
        onDelete={vi.fn()}
        onApplyBudgetTemplatesInGroup={onApplyBudgetTemplatesInGroup}
      />
    </TestProviders>,
  );
  return { onApplyBudgetTemplatesInGroup };
}

const overwriteLabel = 'Overwrite with templates';

describe('CategoryGroupMenuModal', () => {
  it.each([
    ['an expense group in an envelope budget', expenseGroup, 'envelope'],
    ['an expense group in a tracking budget', expenseGroup, 'tracking'],
    ['the income group in a tracking budget', incomeGroup, 'tracking'],
  ] as const)('applies templates to %s', async (_, group, budgetType) => {
    const { onApplyBudgetTemplatesInGroup } = renderModal(group, budgetType);

    await userEvent.click(await screen.findByText(overwriteLabel));
    expect(onApplyBudgetTemplatesInGroup).toHaveBeenCalledWith(
      group.categories?.map(c => c.id),
    );
  });

  // Envelope budgets don't apply templates to income categories
  it('does not offer templates for the income group in an envelope budget', async () => {
    renderModal(incomeGroup, 'envelope');

    expect(await screen.findByText('Add category')).toBeInTheDocument();
    expect(screen.queryByText(overwriteLabel)).not.toBeInTheDocument();
    // With a single category nothing else is left in the Budget section
    expect(
      screen.queryByRole('region', { name: 'Budget' }),
    ).not.toBeInTheDocument();
  });

  it('group with payment category cannot be deleted or hidden', async () => {
    renderModal(cardGroup, 'envelope');

    expect(await screen.findByText('Add category')).toBeInTheDocument();
    // The card is known once accounts load, after the categories
    await waitFor(() =>
      expect(screen.queryByText('Delete')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Hide')).not.toBeInTheDocument();
  });
});
