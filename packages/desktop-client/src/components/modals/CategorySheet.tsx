import React, { createContext } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDelete } from '@actual-app/components/icons/v0';
import { SvgPencil1 } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { radius, spacing, tapTarget } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import { css, cx } from '@emotion/css';

import {
  BalanceWithCarryover,
  isCardOnlyOverspent,
} from '#components/budget/BalanceWithCarryover';
import { useBalanceMenu } from '#components/budget/envelope/BalanceMenu';
import { GoalStatus } from '#components/budget/GoalStatus';
import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { BALANCE_PILL_COLORS } from '#components/mobile/budget/BalanceCell';
import { BudgetCell } from '#components/mobile/budget/BudgetCell';
import { ROW_SEPARATOR } from '#components/mobile/budget/BudgetTable';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useCategory } from '#hooks/useCategory';
import { useCategoryGroup } from '#hooks/useCategoryGroup';
import { useCreditCardDebt } from '#hooks/useCreditCardDebt';
import { useIsPaymentCategory } from '#hooks/useCreditCardsEnabled';
import { useCreditCardToPay } from '#hooks/useCreditCardToPay';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { usePayeesById } from '#hooks/usePayees';
import { useSheetValue } from '#hooks/useSheetValue';
import { useTransactions } from '#hooks/useTransactions';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

type BudgetSheet = 'envelope-budget' | 'tracking-budget';

const RECENT_COUNT = 4;

export type CategorySheetProps = {
  name: 'envelope-balance-menu' | 'tracking-balance-menu';
  categoryId: string;
  month: string;
  onCarryover?: (carryover: boolean) => void;
  // Both get the balance at press time, so a pane left open while budgeting
  // never acts on the amount it was opened with
  onTransfer?: (balance: number) => void;
  onCover?: (balance: number) => void;
  // Moves the goal's shortfall, as much as To Budget holds, to the category
  onFundGoal?: (amount: IntegerAmount) => void;
  onShowActivity?: () => void;
  onEditCategory?: () => void;
  onBudgetAction?: (month: string, action: string, args: unknown) => void;
};

// On tablets the budget page provides this; a category then opens in the
// page's inspector pane instead of a sheet, and its row is highlighted
export const CategoryInspectorContext = createContext<{
  open: (props: CategorySheetProps) => void;
  selectedId?: string;
} | null>(null);

// The phone category sheet: Balance, Budgeted and Spent, the spent bar, the
// category's actions and its latest transactions
export function CategorySheet(props: CategorySheetProps) {
  return (
    <Modal name={props.name}>
      {({ state }) => (
        <CategorySheetBody {...props} onClose={() => state.close()} />
      )}
    </Modal>
  );
}

// Without onClose the body renders as the tablet inspector pane; the desktop
// inspector adds onDismiss (close button)
export function CategorySheetBody({
  name,
  categoryId,
  month,
  onCarryover,
  onTransfer,
  onCover,
  onFundGoal,
  onShowActivity,
  onEditCategory,
  onBudgetAction,
  onClose,
  onDismiss,
}: CategorySheetProps & {
  onClose?: () => void;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const isTracking = name === 'tracking-balance-menu';
  const budget = isTracking ? trackingBudget : envelopeBudget;
  const { data: category } = useCategory(categoryId);
  const { data: group } = useCategoryGroup(category?.group);
  const balance =
    useSheetValue<BudgetSheet, 'leftover'>(budget.catBalance(categoryId)) ?? 0;
  const carryover = useSheetValue<BudgetSheet, 'carryover'>(
    budget.catCarryover(categoryId),
  );
  const creditDebt = useCreditCardDebt(categoryId);
  const cardToPay = useCreditCardToPay(
    category ?? { id: categoryId, name: '', group: '' },
  );
  const goalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const goalTemplatesUIEnabled = useFeatureFlag('goalTemplatesUIEnabled');
  const canSetGoal = goalTemplatesEnabled && goalTemplatesUIEnabled;
  const budgeted =
    useSheetValue<BudgetSheet, 'budget'>(budget.catBudgeted(categoryId)) ?? 0;
  const spent =
    useSheetValue<BudgetSheet, 'sum-amount'>(budget.catSumAmount(categoryId)) ??
    0;
  // A card payment category's activity is card payments, not spending
  const isPaymentCategory = useIsPaymentCategory();
  const goal = useSheetValue<BudgetSheet, 'goal'>(budget.catGoal(categoryId));
  // The desktop balance menu's fund amount and action; it offers
  // "fund-goal" only for an envelope goal short of its target
  const { items: balanceMenuItems, onMenuSelect } = useBalanceMenu({
    categoryId,
    onFundGoal,
  });
  const canFundGoal = balanceMenuItems.some(item => item.name === 'fund-goal');

  if (!category) {
    return null;
  }

  const actions = [
    onShowActivity && {
      text: t('Show transactions'),
      onPress: onShowActivity,
      closes: true,
    },
    canSetGoal && {
      text: t('Set a goal'),
      closes: true,
      onPress: () =>
        dispatch(
          pushModal({
            modal: {
              name: 'category-automations-edit',
              options: { categoryId, month },
            },
          }),
        ),
    },
    onEditCategory && {
      // A card payment category keeps its card's name and stays visible
      text: isPaymentCategory(category)
        ? t('Edit category')
        : t('Rename or hide'),
      closes: true,
      onPress: onEditCategory,
    },
    onCarryover && {
      text: carryover
        ? t('Remove overspending rollover')
        : t('Rollover overspending'),
      onPress: () => onCarryover(!carryover),
    },
  ].filter(action => !!action);

  const tileAmount = (value: number) => (
    <PrivacyFilter>
      <Text style={{ ...styles.tnum, fontSize: 16, fontWeight: 700 }}>
        {format(value, 'financial')}
      </Text>
    </PrivacyFilter>
  );

  const tileLabel = (label: ReactNode) => (
    <Text style={{ fontSize: 12, color: theme.pageTextLight }}>{label}</Text>
  );

  const showCover = balance < 0 && !!onCover;
  const showMove = balance > 0 && !!onTransfer;

  const content = (
    <View style={{ gap: spacing.md }}>
      {group && (
        <Text style={{ color: theme.pageTextLight, marginTop: -spacing.sm }}>
          {group.name}
        </Text>
      )}
      <BalanceWithCarryover
        isDisabled
        carryover={budget.catCarryover(categoryId)}
        balance={budget.catBalance(categoryId)}
        goal={budget.catGoal(categoryId)}
        budgeted={budget.catBudgeted(categoryId)}
        longGoal={budget.catLongGoal(categoryId)}
        creditDebt={creditDebt}
        cardToPay={cardToPay}
        CarryoverIndicator={() => null}
      >
        {({ type, value, status, className }) => (
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 13, color: theme.pageTextLight }}>
              <Trans>Balance</Trans>
            </Text>
            <PrivacyFilter>
              <Text
                data-testid="sheet-balance"
                className={cx(
                  className,
                  css({
                    ...styles.tnum,
                    textAlign: 'left',
                    fontSize: 30,
                    fontWeight: 800,
                    color: BALANCE_PILL_COLORS[status].color,
                  }),
                )}
              >
                {format(value, type)}
              </Text>
            </PrivacyFilter>
            {isCardOnlyOverspent(value, creditDebt) && (
              <Text style={{ fontSize: 13, color: theme.pageTextLight }}>
                <Trans>Card spending</Trans>
              </Text>
            )}
          </View>
        )}
      </BalanceWithCarryover>
      {goalTemplatesEnabled && goal != null && (
        <View style={GOAL_CARD_STYLE}>
          <GoalStatus
            balance={budget.catBalance(categoryId)}
            goal={budget.catGoal(categoryId)}
            budgeted={budget.catBudgeted(categoryId)}
            longGoal={budget.catLongGoal(categoryId)}
          />
          {canFundGoal && (
            <Button
              style={ACTION_BUTTON_STYLE}
              onPress={() => onMenuSelect('fund-goal')}
            >
              <Trans>Fund goal from To Budget</Trans>
            </Button>
          )}
        </View>
      )}
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: spacing.sm,
        }}
      >
        {/* The one editable amount: opens the budget menu, as in the row */}
        {onBudgetAction ? (
          <BudgetCell
            binding={budget.catBudgeted(categoryId)}
            type="financial"
            category={category}
            month={month}
            onBudgetAction={onBudgetAction}
          >
            {({ value, onPress }) => (
              <Button
                variant="bare"
                aria-label={t('Edit budgeted amount')}
                onPress={onPress}
                style={{
                  ...TILE_STYLE,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: theme.buttonPrimaryBackground,
                }}
              >
                <View style={{ alignItems: 'flex-start' }}>
                  {tileLabel(<Trans>Budgeted</Trans>)}
                  {tileAmount(value)}
                </View>
                <SvgPencil1
                  width={14}
                  height={14}
                  style={{ flexShrink: 0, color: theme.pageTextLight }}
                />
              </Button>
            )}
          </BudgetCell>
        ) : (
          <View style={TILE_STYLE}>
            {tileLabel(<Trans>Budgeted</Trans>)}
            {tileAmount(budgeted)}
          </View>
        )}
        <View style={TILE_STYLE}>
          {tileLabel(<Trans>Spent</Trans>)}
          <View data-testid="sheet-spent">{tileAmount(spent)}</View>
        </View>
      </View>
      {!isPaymentCategory(category) && (
        <SpentBar budgeted={budgeted} spent={spent} />
      )}
      {(showCover || showMove) && (
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: spacing.sm,
          }}
        >
          {balance < 0 && onCover && (
            <Button
              variant="primary"
              style={ACTION_BUTTON_STYLE}
              onPress={() => onCover(balance)}
            >
              <Trans>Cover {{ amount: format(-balance, 'financial') }}</Trans>
            </Button>
          )}
          {balance > 0 && onTransfer && (
            <Button
              style={ACTION_BUTTON_STYLE}
              onPress={() => onTransfer(balance)}
            >
              <Trans>Move money</Trans>
            </Button>
          )}
        </View>
      )}
      <View>
        {actions.map(({ text, onPress, closes }) => (
          <Button
            key={text}
            variant="bare"
            style={{
              ...styles.mobileMenuItem,
              color: theme.menuItemText,
              justifyContent: 'flex-start',
              borderRadius: 0,
              borderTop: `1px solid ${theme.pillBorder}`,
            }}
            onPress={() => {
              if (closes) {
                onClose?.();
              }
              onPress();
            }}
          >
            {text}
          </Button>
        ))}
      </View>
      <RecentTransactions categoryId={categoryId} month={month} />
    </View>
  );

  if (!onClose) {
    return (
      <aside
        aria-label={category.name}
        style={{
          width: 320,
          flexShrink: 0,
          boxSizing: 'border-box',
          position: 'sticky',
          top: 12,
          margin: '12px 16px 12px 0',
          padding: 16,
          borderRadius: radius.card,
          backgroundColor: theme.cardBackground,
          boxShadow: theme.cardElevation,
          overflowY: 'auto',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            margin: '0 0 14px',
          }}
        >
          <h2
            style={{
              flex: 1,
              margin: 0,
              fontSize: 19,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {category.name}
          </h2>
          {onDismiss && (
            <Button
              variant="bare"
              aria-label={t('Close')}
              style={{ padding: 8 }}
              onPress={onDismiss}
            >
              <SvgDelete width={10} height={10} />
            </Button>
          )}
        </View>
        {content}
      </aside>
    );
  }

  return (
    <>
      <ModalHeader
        title={<ModalTitle title={category.name} shrinkOnOverflow />}
        rightContent={<ModalCloseButton onPress={onClose} />}
      />
      {content}
    </>
  );
}

const TILE_STYLE: CSSProperties = {
  minHeight: 56,
  paddingBlock: spacing.sm,
  paddingInline: spacing.md,
  borderRadius: 14,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing.sm,
  backgroundColor: theme.pillBackgroundLight,
};

// Goal status, its progress bar and the fund action, as a card on the sheet
const GOAL_CARD_STYLE: CSSProperties = {
  gap: spacing.sm,
  padding: spacing.md,
  borderRadius: radius.card,
  backgroundColor: theme.cardBackground,
  boxShadow: theme.cardElevation,
};

const ACTION_BUTTON_STYLE: CSSProperties = {
  height: tapTarget,
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 700,
};

// Spent against budgeted, named by its percentage
function SpentBar({ budgeted, spent }: { budgeted: number; spent: number }) {
  const { t } = useTranslation();
  const percent =
    budgeted > 0
      ? Math.max(0, Math.round((-spent / budgeted) * 100))
      : spent < 0
        ? 100
        : 0;
  const isOver = -spent > budgeted;

  return (
    <View
      role="img"
      aria-label={t('{{percent}} percent of budget spent', { percent })}
      style={{
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: theme.pillBackgroundLight,
      }}
    >
      <View
        style={{
          width: `${Math.min(percent, 100)}%`,
          height: '100%',
          backgroundColor: isOver
            ? theme.balanceNegativeText
            : theme.buttonPrimaryBackground,
        }}
      />
    </View>
  );
}

// The category's four latest transactions of the month, newest first
function RecentTransactions({
  categoryId,
  month,
}: {
  categoryId: string;
  month: string;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const { data: payeesById = {} } = usePayeesById();
  const { transactions } = useTransactions({
    query: q('transactions')
      .options({ splits: 'inline' })
      .filter({
        category: categoryId,
        date: { $transform: '$month', $eq: month },
      })
      .orderBy([{ date: 'desc' }, { sort_order: 'desc' }])
      .select('*'),
    options: { pageSize: RECENT_COUNT },
  });
  const recent = transactions.slice(0, RECENT_COUNT);

  if (recent.length === 0) {
    return null;
  }

  return (
    <View>
      <h3
        style={{ margin: `${spacing.sm}px 0 0`, fontSize: 15, fontWeight: 700 }}
      >
        <Trans>Recent transactions</Trans>
      </h3>
      <ul
        aria-label={t('Recent transactions')}
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
      >
        {recent.map(transaction => (
          <li
            key={transaction.id}
            className={ROW_SEPARATOR}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
              minHeight: 52,
            }}
          >
            <View style={{ minWidth: 0, gap: 2 }}>
              <Text
                data-testid="recent-payee"
                style={{
                  ...styles.lineClamp(1),
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {(transaction.payee && payeesById[transaction.payee]?.name) ||
                  t('No payee')}
              </Text>
              <Text style={{ fontSize: 12, color: theme.pageTextLight }}>
                <time dateTime={transaction.date}>
                  {monthUtils.format(transaction.date, 'MMM d', locale)}
                </time>
              </Text>
            </View>
            <PrivacyFilter>
              <Text
                data-testid="recent-amount"
                style={{ ...styles.tnum, fontSize: 15, fontWeight: 700 }}
              >
                {format(transaction.amount, 'financial')}
              </Text>
            </PrivacyFilter>
          </li>
        ))}
      </ul>
    </View>
  );
}
