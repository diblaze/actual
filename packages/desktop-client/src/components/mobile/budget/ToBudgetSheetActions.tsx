import { useTranslation } from 'react-i18next';

import { useToBudgetMenu } from '#components/budget/envelope/budgetsummary/ToBudgetMenu';
import type { ToBudgetMenuActions } from '#components/budget/envelope/budgetsummary/ToBudgetMenu';
import { MobileSheet } from '#components/mobile/MobileSheet';
import { MobileSheetMenuRows } from '#components/mobile/MobileSheetMenuRows';
import { MobileSheetSection } from '#components/mobile/MobileSheetSection';

// The To budget amount's actions, opened by the To budget card's Move and
// by the amount in the budget summary
export function ToBudgetMenuSheet(props: ToBudgetMenuActions) {
  const { t } = useTranslation();
  const { items, onMenuSelect } = useToBudgetMenu(props);

  return (
    <MobileSheet name="envelope-summary-to-budget-menu" title={t('To budget')}>
      <MobileSheetSection>
        <MobileSheetMenuRows items={items} onSelect={onMenuSelect} />
      </MobileSheetSection>
    </MobileSheet>
  );
}
