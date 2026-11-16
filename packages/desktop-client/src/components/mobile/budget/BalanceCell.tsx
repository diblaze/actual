import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgArrowThickRight } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { css, cx } from '@emotion/css';
import { AutoTextSize } from 'auto-text-size';

import { BalanceWithCarryover } from '#components/budget/BalanceWithCarryover';
import type { BalanceStatus } from '#components/budget/BalanceWithCarryover';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useCreditCardDebt } from '#hooks/useCreditCardDebt';
import { useCreditCardToPay } from '#hooks/useCreditCardToPay';
import { useFormat } from '#hooks/useFormat';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { AMOUNT_FONT, CELL_BUTTON_STYLE, FitAmountColumn } from './BudgetTable';

// Pill colours for each balance state; the sheet's Balance uses the text
export const BALANCE_PILL_COLORS: Record<
  BalanceStatus,
  { backgroundColor: string; color: string }
> = {
  positive: {
    backgroundColor: theme.balancePositiveBackground,
    color: theme.balancePositiveText,
  },
  warning: {
    backgroundColor: theme.balanceWarningBackground,
    color: theme.balanceWarningText,
  },
  negative: {
    backgroundColor: theme.balanceNegativeBackground,
    color: theme.balanceNegativeText,
  },
  zero: {
    backgroundColor: theme.balanceZeroBackground,
    color: theme.balanceZeroText,
  },
};

type BalanceCellProps = {
  binding: Binding<
    'envelope-budget' | 'tracking-budget',
    'leftover' | 'sum-amount'
  >;
  category: CategoryEntity;
  onPress?: () => void;
  'aria-label'?: string;
};

export function BalanceCell({
  binding,
  category,
  onPress,
  'aria-label': ariaLabel,
}: BalanceCellProps) {
  const { t } = useTranslation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const goal =
    budgetType === 'tracking'
      ? trackingBudget.catGoal(category.id)
      : envelopeBudget.catGoal(category.id);

  const longGoal =
    budgetType === 'tracking'
      ? trackingBudget.catLongGoal(category.id)
      : envelopeBudget.catLongGoal(category.id);

  const budgeted =
    budgetType === 'tracking'
      ? trackingBudget.catBudgeted(category.id)
      : envelopeBudget.catBudgeted(category.id);

  const carryover =
    budgetType === 'tracking'
      ? trackingBudget.catCarryover(category.id)
      : envelopeBudget.catCarryover(category.id);

  const format = useFormat();
  const creditDebt = useCreditCardDebt(category.id);
  const cardToPay = useCreditCardToPay(category);

  return (
    <BalanceWithCarryover
      aria-label={t('Balance for {{categoryName}} category', {
        categoryName: category.name,
      })} // Translated aria-label
      type="financial"
      carryover={carryover}
      balance={binding}
      goal={goal}
      budgeted={budgeted}
      longGoal={longGoal}
      creditDebt={creditDebt}
      cardToPay={cardToPay}
      CarryoverIndicator={MobileCarryoverIndicator}
    >
      {({ type, value, status, className: defaultClassName }) => (
        <Button
          variant="bare"
          style={CELL_BUTTON_STYLE}
          onPress={onPress}
          aria-label={ariaLabel}
        >
          <View
            data-testid="balance-pill"
            style={{
              maxWidth: '100%',
              borderRadius: 14,
              paddingBlock: 5,
              paddingInline: 11,
              backgroundColor: BALANCE_PILL_COLORS[status].backgroundColor,
            }}
          >
            <FitAmountColumn column={2} text={format(value, type)} />
            <PrivacyFilter>
              <AutoTextSize
                key={value}
                as={Text}
                {...AMOUNT_FONT}
                mode="oneline"
                className={cx(
                  defaultClassName,
                  css({
                    ...styles.tnum,
                    textAlign: 'right',
                    fontSize: 15,
                    fontWeight: 700,
                    color: BALANCE_PILL_COLORS[status].color,
                  }),
                )}
              >
                {format(value, type)}
              </AutoTextSize>
            </PrivacyFilter>
          </View>
        </Button>
      )}
    </BalanceWithCarryover>
  );
}
function MobileCarryoverIndicator({ style }: { style?: CSSProperties }) {
  return (
    <View
      style={{
        position: 'absolute',
        right: '-3px',
        top: '-5px',
        borderRadius: '50%',
        backgroundColor: style?.color ?? theme.pillText,
      }}
    >
      <SvgArrowThickRight
        width={11}
        height={11}
        style={{ color: theme.pillBackgroundLight }}
      />
    </View>
  );
}
