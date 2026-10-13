import { useCallback, useMemo } from 'react';

import { useAccounts } from './useAccounts';
import { useCategories } from './useCategories';
import { useFeatureFlag } from './useFeatureFlag';
import { useSyncedPref } from './useSyncedPref';

// Credit card payment categories work in envelope budgets only
export function useCreditCardsEnabled(): boolean {
  const isFlagOn = useFeatureFlag('ccPaymentCategories');
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  return isFlagOn && budgetType === 'envelope';
}

type MaybePaymentCategory = {
  id: string;
  payment_account?: string | null;
  is_income?: boolean;
};

// Same rule as the server: the card must be a live on-budget account, and if
// two categories are linked to it, the first one (sort order, id) wins
export function useIsPaymentCategory(): (cat: MaybePaymentCategory) => boolean {
  const isEnabled = useCreditCardsEnabled();
  const { data: accounts = [] } = useAccounts();
  const { data: categories } = useCategories();

  // Rendered once per category and month: compute only when the data changes,
  // and not at all with the feature off
  const paymentCategoryOf = useMemo(() => {
    const result = new Map<string, string>();
    if (!isEnabled) {
      return result;
    }
    const onBudget = new Set(
      accounts.filter(account => !account.offbudget).map(account => account.id),
    );
    for (const cat of [...(categories?.list ?? [])]
      .filter(
        cat =>
          !cat.is_income &&
          cat.payment_account &&
          onBudget.has(cat.payment_account),
      )
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      )) {
      if (!result.has(cat.payment_account as string)) {
        result.set(cat.payment_account as string, cat.id);
      }
    }
    return result;
  }, [accounts, categories, isEnabled]);

  return useCallback(
    cat =>
      !!cat.payment_account &&
      paymentCategoryOf.get(cat.payment_account) === cat.id,
    [paymentCategoryOf],
  );
}
