import { generateAccount } from '@actual-app/core/mocks';
import { initServer } from '@actual-app/core/platform/client/connection';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { accountQueries } from '#accounts';
import { categoryQueries } from '#budget';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';
import { mergeSyncedPrefs } from '#prefs/prefsSlice';

import { CategoryMenuModal } from './CategoryMenuModal';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: true }),
}));

const visa = { ...generateAccount('Visa'), id: 'visa' };

function renderModal(hidden: boolean) {
  const payment: CategoryEntity = {
    id: 'visa-payment',
    name: 'Visa',
    group: 'cards',
    is_income: false,
    hidden,
    payment_account: visa.id,
  };
  const onSave = vi.fn<(category: CategoryEntity) => void>();
  const client = createTestQueryClient();
  const store = configureTestAppStore({ queryClient: client });
  store.dispatch(
    mergeSyncedPrefs({
      'flags.ccPaymentCategories': 'true',
      budgetType: 'envelope',
    }),
  );
  // Seeded rather than served: setupTests loads `#budget` and `#accounts`
  // before this file's connection mock, so their queries would never settle
  client.setQueryData(accountQueries.lists(), [visa]);
  client.setQueryData(categoryQueries.lists(), {
    grouped: [
      {
        id: 'cards',
        name: 'Credit Cards',
        is_income: false,
        categories: [payment],
      },
    ],
    list: [payment],
  });
  initServer({ query: async () => ({ data: [], dependencies: [] }) });
  render(
    <TestProviders queryClient={client} store={store}>
      <CategoryMenuModal
        categoryId={payment.id}
        onSave={onSave}
        onEditNotes={vi.fn()}
        onDelete={vi.fn()}
      />
    </TestProviders>,
  );
  return { onSave };
}

describe('CategoryMenuModal', () => {
  it('payment category has no rename or delete', async () => {
    renderModal(false);

    expect(await screen.findByText('Edit notes')).toBeInTheDocument();
    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Hide')).not.toBeInTheDocument();
  });

  it('hidden payment category offers show', async () => {
    const { onSave } = renderModal(true);

    await userEvent.click(await screen.findByText('Show'));
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'visa-payment', hidden: false }),
    );
  });
});
