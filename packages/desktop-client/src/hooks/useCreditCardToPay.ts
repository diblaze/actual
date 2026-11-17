import type { CategoryEntity } from '@actual-app/core/types/models';

import { envelopeBudget } from '#spreadsheet/bindings';

import { useIsPaymentCategory } from './useCreditCardsEnabled';
import { useSheetValue } from './useSheetValue';

// How much of a card's balance its payment category does not hold, for the
// month of the surrounding sheet; 0 for any other category
export function useCreditCardToPay(category: CategoryEntity): number {
  const isPaymentCategory = useIsPaymentCategory()(category);
  // Other categories read their balance again, so no extra cell is created or
  // subscribed to
  const toPay = useSheetValue<'envelope-budget', 'cc-to-pay' | 'leftover'>(
    isPaymentCategory
      ? envelopeBudget.catCardToPay(category.id)
      : envelopeBudget.catBalance(category.id),
  );
  return isPaymentCategory && typeof toPay === 'number' ? toPay : 0;
}
