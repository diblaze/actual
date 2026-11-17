import { initServer } from '@actual-app/core/platform/client/connection';
import { render, screen } from '@testing-library/react';

import { SheetNameProvider } from '#hooks/useSheetName';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';
import { mergeSyncedPrefs } from '#prefs/prefsSlice';

import { BalanceMovementMenu } from './BalanceMovementMenu';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);

const sheetValues: Record<string, number | null> = {
  'goal-groceries': 65000,
  'budget-groceries': 40000,
  'leftover-groceries': 40000,
  'long-goal-groceries': null,
  'to-budget': 50000,
};

vi.mock('#hooks/useSheetValue', () => ({
  useSheetValue: (binding: string | { name: string }) =>
    sheetValues[typeof binding === 'string' ? binding : binding.name] ?? null,
}));

// The desktop balance menu keeps upstream's goal block and fund item, while
// the phone sheet and the inspector draw them in our goal card
describe('desktop balance menu', () => {
  it('shows goal status and fund item', async () => {
    const client = createTestQueryClient();
    const store = configureTestAppStore({ queryClient: client });
    store.dispatch(mergeSyncedPrefs({ 'flags.goalTemplatesEnabled': 'true' }));
    initServer({
      'get-categories': async () => ({ grouped: [], list: [] }),
      query: async () => ({ data: [], dependencies: [] }),
    });
    render(
      <TestProviders queryClient={client} store={store}>
        <SheetNameProvider name="budget202401">
          <BalanceMovementMenu
            categoryId="groceries"
            month="2024-01"
            onBudgetAction={vi.fn()}
            onClose={vi.fn()}
          />
        </SheetNameProvider>
      </TestProviders>,
    );

    expect(
      await screen.findByText('Underfunded (-250.00)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Fund goal from To Budget')).toBeInTheDocument();
  });
});
