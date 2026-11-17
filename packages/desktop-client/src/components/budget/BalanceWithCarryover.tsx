// @ts-strict-ignore
import type {
  ComponentPropsWithoutRef,
  ComponentType,
  CSSProperties,
} from 'react';
import { Trans } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { SvgArrowThinRight } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

import { CellValue, CellValueText } from '#components/spreadsheet/CellValue';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useFormat } from '#hooks/useFormat';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';

import { GoalProgressRing } from './GoalProgressRing';
import { GoalStatus } from './GoalStatus';
import { getGoalRingProgress, makeBalanceAmountStyle } from './util';

type CarryoverIndicatorProps = {
  style?: CSSProperties;
};

export function CarryoverIndicator({ style }: CarryoverIndicatorProps) {
  return (
    <View
      style={{
        marginLeft: 2,
        position: 'absolute',
        right: '-4px',
        alignSelf: 'center',
        justifyContent: 'center',
        top: 0,
        bottom: 0,
        ...style,
      }}
    >
      <SvgArrowThinRight
        width={style?.width || 7}
        height={style?.height || 7}
        style={style}
      />
    </View>
  );
}

type CellValueChildren = ComponentPropsWithoutRef<typeof CellValue>['children'];

type ChildrenWithClassName = (
  props: Parameters<CellValueChildren>[0] & {
    className: string;
  },
  /**
   * How much of the goal is funded, to draw the goal progress ring beside the
   * balance, or null when the balance has no ring: no goal, overspent or
   * already funded.
   */
  ringProgress: number | null,
) => ReturnType<CellValueChildren>;

type BalanceWithCarryoverProps = Omit<
  ComponentPropsWithoutRef<typeof CellValue>,
  'children' | 'binding'
> & {
  children?: ChildrenWithClassName;
  carryover: Binding<'envelope-budget' | 'tracking-budget', 'carryover'>;
  /**
   * Expense category balance binding is `leftover`,
   * while income category balance binding is `sum-amount`.
   */
  balance: Binding<
    'envelope-budget' | 'tracking-budget',
    'leftover' | 'sum-amount'
  >;
  goal: Binding<'envelope-budget' | 'tracking-budget', 'goal'>;
  budgeted: Binding<'envelope-budget' | 'tracking-budget', 'budget'>;
  longGoal: Binding<'envelope-budget' | 'tracking-budget', 'long-goal'>;
  isDisabled?: boolean;
  /**
   * Only tracking budgets use goals on income categories, so envelope budgets
   * ignore any goal left on one
   */
  isIncome?: boolean;
  shouldInlineGoalStatus?: boolean;
  CarryoverIndicator?: ComponentType<CarryoverIndicatorProps>;
  tooltipDisabled?: boolean;
  /** Card spending the category could not cover (credit overspending) */
  creditDebt?: number;
};

export function BalanceWithCarryover({
  carryover,
  balance,
  goal,
  budgeted,
  longGoal,
  isDisabled,
  isIncome,
  shouldInlineGoalStatus,
  CarryoverIndicator: CarryoverIndicatorComponent = CarryoverIndicator,
  tooltipDisabled,
  creditDebt = 0,
  children,
  ...props
}: BalanceWithCarryoverProps) {
  const carryoverValue = useSheetValue(carryover);
  const goalValue = useSheetValue(goal);
  const budgetedValue = useSheetValue(budgeted);
  const longGoalValue = useSheetValue(longGoal);
  const isGoalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const format = useFormat();
  const { decimalPlaces } = format.currency;
  const { isNarrowWidth } = useResponsive();

  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const canShowGoal =
    isGoalTemplatesEnabled && !(isIncome && budgetType !== 'tracking');
  // Long goals count the balance towards the goal, others the budgeted amount
  const getHave = (balanceValue: number) =>
    longGoalValue === 1 ? balanceValue : budgetedValue;

  const getRingProgress = (balanceValue: number) =>
    canShowGoal
      ? getGoalRingProgress(
          balanceValue,
          goalValue,
          getHave(balanceValue),
          decimalPlaces,
        )
      : null;

  const getBalanceAmountStyle = (balanceValue: number) =>
    // Overspent only on a card: the debt stays on the card instead of
    // coming out of next month's To Budget, so it is a warning, not red
    creditDebt > 0 && balanceValue < 0 && balanceValue + creditDebt >= 0
      ? { color: theme.warningText }
      : makeBalanceAmountStyle(
          balanceValue,
          canShowGoal ? goalValue : null,
          getHave(balanceValue),
          decimalPlaces,
        );

  const getDefaultClassName = (balanceValue: number) =>
    css({
      ...getBalanceAmountStyle(balanceValue),
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'right',
      ...(!isDisabled && {
        cursor: 'pointer',
        ':hover': { textDecoration: 'underline' },
      }),
    });

  return (
    <CellValue binding={balance} type="financial" {...props}>
      {({ type, name, value: balanceValue }) => {
        const ringProgress = getRingProgress(balanceValue);
        const amount = children ? (
          children(
            {
              type,
              name,
              value: balanceValue,
              className: getDefaultClassName(balanceValue),
            },
            ringProgress,
          )
        ) : (
          <CellValueText
            type={type}
            name={name}
            value={balanceValue}
            className={getDefaultClassName(balanceValue)}
          />
        );
        return (
          <>
            <View
              style={{
                minHeight: 'auto',
                maxWidth: '100%',
                // Let a long amount give way to the ring rather than push it
                // out of the column
                ...(ringProgress != null && !children
                  ? { flexShrink: 1, minWidth: 0 }
                  : { flexShrink: 0 }),
              }}
            >
              {creditDebt > 0 ? (
                <Tooltip
                  content={
                    <View style={{ padding: 10, maxWidth: 260 }}>
                      <Text>
                        <Trans>
                          {{ amount: format(creditDebt, 'financial') }} of card
                          spending was not covered. It stays on the card as debt
                          and is not taken from next month's To Budget.
                        </Trans>
                      </Text>
                    </View>
                  }
                  style={{ ...styles.tooltip, borderRadius: '0px 5px 5px 0px' }}
                  placement="bottom"
                  triggerProps={{
                    delay: 750,
                    isDisabled: isNarrowWidth || tooltipDisabled,
                  }}
                >
                  {amount}
                </Tooltip>
              ) : (
                amount
              )}
            </View>
            {!children && ringProgress != null && (
              // Drawn before the amount, after it in the DOM so the button
              // reads as the amount followed by its status
              <GoalProgressRing
                progress={ringProgress}
                style={{ order: -1, marginRight: 4 }}
              />
            )}

            {carryoverValue && (
              <CarryoverIndicatorComponent
                style={getBalanceAmountStyle(balanceValue)}
              />
            )}
            {shouldInlineGoalStatus && canShowGoal && goalValue != null && (
              <>
                <View
                  style={{
                    borderTop: '1px solid ' + theme.tableBorderSeparator,
                    width: '160px',
                    margin: '3px 0px',
                  }}
                />
                <GoalStatus
                  balance={balance}
                  goal={goal}
                  budgeted={budgeted}
                  longGoal={longGoal}
                />
              </>
            )}
          </>
        );
      }}
    </CellValue>
  );
}
