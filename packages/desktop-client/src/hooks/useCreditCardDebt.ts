import { envelopeBudget } from '#spreadsheet/bindings';

import { useCreditCardsEnabled } from './useCreditCardsEnabled';
import { useSheetValue } from './useSheetValue';

// Card spending in a category that it could not cover (credit overspending),
// for the month of the surrounding sheet
export function useCreditCardDebt(categoryId: string): number {
  const isEnabled = useCreditCardsEnabled();
  const balance = useSheetValue<'envelope-budget', 'leftover'>(
    envelopeBudget.catBalance(categoryId),
  );
  // With the feature off this reads the balance again, so no extra cell is
  // created or subscribed to
  const cashBalance = useSheetValue<
    'envelope-budget',
    'cash-leftover' | 'leftover'
  >(
    isEnabled
      ? envelopeBudget.catCashBalance(categoryId)
      : envelopeBudget.catBalance(categoryId),
  );
  return isEnabled &&
    typeof balance === 'number' &&
    typeof cashBalance === 'number'
    ? cashBalance - balance
    : 0;
}
