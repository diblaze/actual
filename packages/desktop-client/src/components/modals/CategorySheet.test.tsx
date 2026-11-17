import { generateAccount } from '@actual-app/core/mocks';
import { initServer } from '@actual-app/core/platform/client/connection';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { accountQueries } from '#accounts';
import { categoryQueries } from '#budget';
import { SheetNameProvider } from '#hooks/useSheetName';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';
import { mergeSyncedPrefs } from '#prefs/prefsSlice';

import { CategorySheet } from './CategorySheet';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);
vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: true }),
}));

let sheetValues: Record<string, number | null> = {};

vi.mock('#hooks/useSheetValue', () => ({
  useSheetValue: (binding: string | { name: string }) => {
    const name = typeof binding === 'string' ? binding : binding.name;
    return sheetValues[name] ?? null;
  },
}));

const category: CategoryEntity = {
  id: 'groceries',
  name: 'Groceries',
  group: 'usual',
  is_income: false,
};

function setSheetValues({
  goal = 65000,
  budget = 40000,
  leftover = 40000,
  longGoal = null,
  toBudget = 50000,
}: {
  goal?: number | null;
  budget?: number;
  leftover?: number;
  longGoal?: number | null;
  toBudget?: number;
} = {}) {
  sheetValues = {
    'goal-groceries': goal,
    'budget-groceries': budget,
    'leftover-groceries': leftover,
    'long-goal-groceries': longGoal,
    'to-budget': toBudget,
  };
}

function renderModal({
  isGoalTemplatesEnabled = true,
}: { isGoalTemplatesEnabled?: boolean } = {}) {
  const onFundGoal = vi.fn<(amount: number) => void>();
  const client = createTestQueryClient();
  const store = configureTestAppStore({ queryClient: client });
  if (isGoalTemplatesEnabled) {
    store.dispatch(mergeSyncedPrefs({ 'flags.goalTemplatesEnabled': 'true' }));
  }
  initServer({
    'get-categories': async () => ({ grouped: [], list: [category] }),
    query: async () => ({ data: [], dependencies: [] }),
  });
  render(
    <TestProviders queryClient={client} store={store}>
      <SheetNameProvider name="budget202401">
        <CategorySheet
          name="envelope-balance-menu"
          month="2024-01"
          categoryId={category.id}
          onFundGoal={onFundGoal}
        />
      </SheetNameProvider>
    </TestProviders>,
  );
  return { onFundGoal };
}

const fundGoalLabel = 'Fund goal from To Budget';

describe('CategorySheet goal', () => {
  beforeEach(() => {
    setSheetValues();
  });

  it('shows the goal status, progress and funds the shortfall', async () => {
    const { onFundGoal } = renderModal();

    expect(
      await screen.findByText('Underfunded (-250.00)'),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '61',
    );

    await userEvent.click(screen.getByText(fundGoalLabel));
    expect(onFundGoal).toHaveBeenCalledWith(25000);
  });

  it('never shows a full bar while the goal is underfunded', async () => {
    setSheetValues({ goal: 100000, budget: 99600 });
    renderModal();

    expect(await screen.findByText('Underfunded (-4.00)')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '99',
    );
  });

  it('funds only what is left in To Budget', async () => {
    setSheetValues({ toBudget: 10000 });
    const { onFundGoal } = renderModal();

    await userEvent.click(await screen.findByText(fundGoalLabel));
    expect(onFundGoal).toHaveBeenCalledWith(10000);
  });

  it.each([0, -5000])(
    'hides the fund item when To Budget is %d',
    async toBudget => {
      setSheetValues({ toBudget });
      renderModal();

      expect(
        await screen.findByText('Underfunded (-250.00)'),
      ).toBeInTheDocument();
      expect(screen.queryByText(fundGoalLabel)).not.toBeInTheDocument();
    },
  );

  it('hides the fund item when the goal is fully funded', async () => {
    setSheetValues({ budget: 65000 });
    renderModal();

    expect(await screen.findByText('Fully funded')).toBeInTheDocument();
    expect(screen.queryByText(fundGoalLabel)).not.toBeInTheDocument();
  });

  it('uses the balance for long goals and does not offer funding', async () => {
    setSheetValues({ goal: 100000, leftover: 50000, longGoal: 1 });
    renderModal();

    expect(
      await screen.findByText('Underfunded (-500.00)'),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.queryByText(fundGoalLabel)).not.toBeInTheDocument();
  });

  it('shows nothing goal related without a stored goal', async () => {
    setSheetValues({ goal: null });
    renderModal();

    expect(await screen.findByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText(/funded/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(fundGoalLabel)).not.toBeInTheDocument();
  });

  it('shows nothing goal related when goal templates are disabled', async () => {
    renderModal({ isGoalTemplatesEnabled: false });

    expect(await screen.findByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText(/funded/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(fundGoalLabel)).not.toBeInTheDocument();
  });

  it('shows the status without a progress bar for a zero goal', async () => {
    setSheetValues({ goal: 0 });
    renderModal();

    expect(await screen.findByText('Overfunded (400.00)')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(fundGoalLabel)).not.toBeInTheDocument();
  });
});

describe('CategorySheet edit category row', () => {
  const visa = { ...generateAccount('Visa'), id: 'visa' };

  function renderSheet(shown: CategoryEntity) {
    const client = createTestQueryClient();
    const store = configureTestAppStore({ queryClient: client });
    store.dispatch(
      mergeSyncedPrefs({
        'flags.ccPaymentCategories': 'true',
        budgetType: 'envelope',
      }),
    );
    // Seeded rather than served, as in CategoryMenuModal.test
    client.setQueryData(accountQueries.lists(), [visa]);
    client.setQueryData(categoryQueries.lists(), {
      grouped: [],
      list: [shown],
    });
    initServer({ query: async () => ({ data: [], dependencies: [] }) });
    render(
      <TestProviders queryClient={client} store={store}>
        <SheetNameProvider name="budget202401">
          <CategorySheet
            name="envelope-balance-menu"
            month="2024-01"
            categoryId={shown.id}
            onEditCategory={vi.fn()}
          />
        </SheetNameProvider>
      </TestProviders>,
    );
  }

  it('offers rename or hide for a normal category', async () => {
    setSheetValues();
    renderSheet(category);

    expect(await screen.findByText('Rename or hide')).toBeInTheDocument();
  });

  it('offers edit category for a card payment category', async () => {
    setSheetValues();
    renderSheet({
      id: 'visa-payment',
      name: 'Visa',
      group: 'cards',
      is_income: false,
      payment_account: visa.id,
    });

    expect(await screen.findByText('Edit category')).toBeInTheDocument();
    expect(screen.queryByText('Rename or hide')).not.toBeInTheDocument();
  });
});
