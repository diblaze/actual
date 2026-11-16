import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { radius } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { css } from '@emotion/css';
import { AutoTextSize } from 'auto-text-size';

import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { PullToRefresh } from '#components/mobile/PullToRefresh';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValue } from '#components/spreadsheet/CellValue';
import { SchedulesProvider } from '#hooks/useCachedSchedules';
import { useFormat } from '#hooks/useFormat';
import { useLocalPref } from '#hooks/useLocalPref';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { ExpenseGroupList } from './ExpenseGroupList';
import { IncomeGroup } from './IncomeGroup';

export const ROW_HEIGHT = 52;
export const GROUP_ROW_HEIGHT = 44;

// Category | Budgeted | Balance, shared by the group headings and every row;
// tablets add Spent before Balance. Each amount track is at least the mockup
// width and grows to the widest amount in its column (--amount-chars-N, set
// by BudgetTable), so rows in separate cards stay aligned and no amount is
// cut off. 7.5px per character is a tabular digit at the 12px minimum font;
// the rest is cell and pill padding.
export function rowGrid(showSpent: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: [
      'minmax(0, 1fr)',
      'max(76px, calc(var(--amount-chars-0, 0) * 7.5px + 8px))',
      ...(showSpent
        ? ['max(76px, calc(var(--amount-chars-1, 0) * 7.5px + 8px))']
        : []),
      'max(92px, calc(var(--amount-chars-2, 0) * 7.5px + 30px))',
    ].join(' '),
    // 8px keeps adjacent amounts apart
    columnGap: 8,
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 10,
  };
}

// The rounded card holding a group's rows; the heading sits above it
export const GROUP_CARD_STYLE: CSSProperties = {
  marginInline: 12,
  borderRadius: radius.card,
  overflow: 'hidden',
  backgroundColor: theme.cardBackground,
  boxShadow: theme.cardElevation,
};

// Rows inside a card are separated by a line, the first has none. An inset
// shadow, so every row keeps its height
export const ROW_SEPARATOR = css({
  '& + &': { boxShadow: `inset 0 1px 0 ${theme.tableBorder}` },
});

type AmountColumn = 0 | 1 | 2;

// Null outside the budget table (the category sheet reuses BudgetCell)
const AmountColumnsContext = createContext<
  ((column: AmountColumn, chars: number) => void) | null
>(null);

// Rendered next to an amount: widens its column to fit the text. Columns
// only grow while the table is mounted; a shrunk amount leaves slack
export function FitAmountColumn({
  column,
  text,
}: {
  column: AmountColumn;
  text: string;
}) {
  const report = useContext(AmountColumnsContext);
  useEffect(() => report?.(column, text.length), [report, column, text]);
  return null;
}

// Grid cell wrapper: full row height, anchors the cells' corner indicators;
// the child grows so the Balance tooltip trigger fills the cell too
export const CELL_STYLE: CSSProperties = {
  alignSelf: 'stretch',
  minWidth: 0,
  position: 'relative',
  '& > *': { flexGrow: 1 },
};

// A full-height cell button holding one amount
export const CELL_BUTTON_STYLE: CSSProperties = {
  height: '100%',
  minWidth: 0,
  justifyContent: 'flex-end',
  paddingInline: 4,
  borderRadius: 0,
};

export const AMOUNT_FONT = { minFontSizePx: 12, maxFontSizePx: 15 };

// The card holding To budget (or Saved) above the groups
const SUMMARY_CARD_STYLE: CSSProperties = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  borderRadius: radius.card,
  backgroundColor: theme.cardBackground,
  boxShadow: theme.cardElevation,
};

const SUMMARY_LABEL_STYLE: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: theme.pageTextLight,
};

const SUMMARY_AMOUNT_STYLE: CSSProperties = {
  ...styles.tnum,
  fontSize: 24,
  fontWeight: 800,
};

// The label and amount open the budget summary
const SUMMARY_BUTTON_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 44,
  padding: 0,
  justifyContent: 'flex-start',
  textAlign: 'left',
};

type ToBudgetCardProps = {
  toBudget: Binding<'envelope-budget', 'to-budget'>;
  onShowSummary: () => void;
  onMove: (toBudget: number) => void;
  onCover: (toBudget: number) => void;
};

function ToBudgetCard({
  toBudget,
  onShowSummary,
  onMove,
  onCover,
}: ToBudgetCardProps) {
  const amount = useSheetValue(toBudget) ?? 0;
  const format = useFormat();
  const isOverbudgeted = amount < 0;

  return (
    <View data-testid="to-budget-card" style={SUMMARY_CARD_STYLE}>
      <Button
        variant="bare"
        onPress={onShowSummary}
        style={SUMMARY_BUTTON_STYLE}
      >
        <View style={{ alignItems: 'flex-start', gap: 2 }}>
          <Text style={SUMMARY_LABEL_STYLE}>
            {isOverbudgeted ? (
              <Trans>Overbudgeted</Trans>
            ) : (
              <Trans>To budget</Trans>
            )}
          </Text>
          <PrivacyFilter>
            <Text
              data-testid="to-budget-amount"
              style={{
                ...SUMMARY_AMOUNT_STYLE,
                color: isOverbudgeted
                  ? theme.toBudgetNegative
                  : amount > 0
                    ? theme.toBudgetPositive
                    : theme.budgetNumberNeutral,
              }}
            >
              {format(amount, 'financial')}
            </Text>
          </PrivacyFilter>
        </View>
      </Button>
      <Button
        variant="primary"
        onPress={() => (isOverbudgeted ? onCover(amount) : onMove(amount))}
        style={{
          flexShrink: 0,
          height: 44,
          paddingInline: 18,
          borderRadius: 22,
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {isOverbudgeted ? <Trans>Cover</Trans> : <Trans>Move</Trans>}
      </Button>
    </View>
  );
}

type SavedCardProps = {
  projected: boolean;
  onPress: () => void;
};

function SavedCard({ projected, onPress }: SavedCardProps) {
  const binding = projected
    ? trackingBudget.totalBudgetedSaved
    : trackingBudget.totalSaved;

  const saved = useSheetValue<'tracking-budget', typeof binding>(binding) || 0;
  const format = useFormat();
  const isNegative = saved < 0;

  return (
    <View style={SUMMARY_CARD_STYLE}>
      <Button variant="bare" onPress={onPress} style={SUMMARY_BUTTON_STYLE}>
        <View style={{ alignItems: 'flex-start', gap: 2 }}>
          <Text style={SUMMARY_LABEL_STYLE}>
            {projected ? (
              <Trans>Projected savings</Trans>
            ) : isNegative ? (
              <Trans>Overspent</Trans>
            ) : (
              <Trans>Saved</Trans>
            )}
          </Text>
          <PrivacyFilter>
            <Text
              style={{
                ...SUMMARY_AMOUNT_STYLE,
                color: projected
                  ? theme.warningText
                  : isNegative
                    ? theme.errorTextDark
                    : theme.pageText,
              }}
            >
              {format(saved, 'financial')}
            </Text>
          </PrivacyFilter>
        </View>
      </Button>
    </View>
  );
}

type BudgetGroupsProps = {
  type: string;
  categoryGroups: CategoryGroupEntity[];
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  onEditCategory: (id: CategoryEntity['id']) => void;
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  showHiddenCategories: boolean;
};

function BudgetGroups({
  categoryGroups,
  onEditCategoryGroup,
  onEditCategory,
  month,
  onBudgetAction,
  showHiddenCategories,
}: BudgetGroupsProps) {
  const { incomeGroup, expenseGroups } = useMemo(() => {
    const categoryGroupsToDisplay = categoryGroups.filter(
      group => !group.hidden || showHiddenCategories,
    );
    return {
      incomeGroup: categoryGroupsToDisplay.find(group => group.is_income),
      expenseGroups: categoryGroupsToDisplay.filter(group => !group.is_income),
    };
  }, [categoryGroups, showHiddenCategories]);

  const [collapsedGroupIds = [], setCollapsedGroupIdsPref] =
    useLocalPref('budget.collapsed');

  const onToggleCollapse = useCallback(
    (id: CategoryGroupEntity['id']) => {
      setCollapsedGroupIdsPref(
        collapsedGroupIds.includes(id)
          ? collapsedGroupIds.filter(collapsedId => collapsedId !== id)
          : [...collapsedGroupIds, id],
      );
    },
    [collapsedGroupIds, setCollapsedGroupIdsPref],
  );

  const isCollapsed = useCallback(
    (id: CategoryGroupEntity['id']) => {
      return collapsedGroupIds.includes(id);
    },
    [collapsedGroupIds],
  );

  return (
    <View
      data-testid="budget-groups"
      style={{ flex: '1 0 auto', overflowY: 'auto', paddingBottom: 15 }}
    >
      <ExpenseGroupList
        categoryGroups={expenseGroups}
        month={month}
        onEditCategoryGroup={onEditCategoryGroup}
        onEditCategory={onEditCategory}
        onBudgetAction={onBudgetAction}
        showHiddenCategories={showHiddenCategories}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />

      {incomeGroup && (
        <IncomeGroup
          categoryGroup={incomeGroup}
          month={month}
          showHiddenCategories={showHiddenCategories}
          onEditCategoryGroup={onEditCategoryGroup}
          onEditCategory={onEditCategory}
          onBudgetAction={onBudgetAction}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
        />
      )}
    </View>
  );
}

type BudgetTableProps = {
  categoryGroups: CategoryGroupEntity[];
  month: string;
  // Overspent and Uncategorized banners above the To budget card
  banners: ReactNode;
  onShowBudgetSummary: () => void;
  onOpenToBudgetMenu: (toBudget: number) => void;
  onCoverOverbudgeted: (toBudget: number) => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  onRefresh: () => Promise<void>;
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  onEditCategory: (id: CategoryEntity['id']) => void;
};

export function BudgetTable({
  categoryGroups,
  month,
  banners,
  onShowBudgetSummary,
  onOpenToBudgetMenu,
  onCoverOverbudgeted,
  onBudgetAction,
  onRefresh,
  onEditCategoryGroup,
  onEditCategory,
}: BudgetTableProps) {
  const [showHiddenCategories = false] = useLocalPref(
    'budget.showHiddenCategories',
  );

  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const schedulesQuery = useMemo(() => q('schedules').select('*'), []);

  const [amountChars, setAmountChars] = useState([0, 0, 0]);
  const fitColumn = (column: AmountColumn, chars: number) =>
    setAmountChars(widest =>
      chars > widest[column]
        ? widest.map((n, i) => (i === column ? chars : n))
        : widest,
    );
  const columnWidths = Object.fromEntries(
    amountChars.map((chars, column) => [`--amount-chars-${column}`, chars]),
  ) as CSSProperties;

  return (
    <AmountColumnsContext.Provider value={fitColumn}>
      <PullToRefresh onRefresh={onRefresh}>
        <View
          data-testid="budget-table"
          style={{
            ...columnWidths,
            backgroundColor: theme.pageBackground,
            minHeight: '100vh',
            paddingBottom: MOBILE_NAV_HEIGHT,
          }}
        >
          <View
            data-testid="budget-table-header"
            style={{ gap: 14, padding: '4px 16px 0', marginBottom: 16 }}
          >
            {banners}
            {budgetType === 'tracking' ? (
              <SavedCard
                projected={month >= monthUtils.currentMonth()}
                onPress={onShowBudgetSummary}
              />
            ) : (
              <ToBudgetCard
                toBudget={envelopeBudget.toBudget}
                onShowSummary={onShowBudgetSummary}
                onMove={onOpenToBudgetMenu}
                onCover={onCoverOverbudgeted}
              />
            )}
          </View>
          <SchedulesProvider query={schedulesQuery}>
            <BudgetGroups
              type={budgetType}
              categoryGroups={categoryGroups}
              showHiddenCategories={showHiddenCategories}
              month={month}
              onEditCategoryGroup={onEditCategoryGroup}
              onEditCategory={onEditCategory}
              onBudgetAction={onBudgetAction}
            />
          </SchedulesProvider>
        </View>
      </PullToRefresh>
    </AmountColumnsContext.Provider>
  );
}

type GroupTotalProps = {
  label: string;
  testId: string;
  binding: Binding<
    'envelope-budget' | 'tracking-budget',
    'group-budget' | 'group-sum-amount' | 'group-leftover'
  >;
  column: AmountColumn;
};

// A group heading's label over its total, right-aligned over the column
export function GroupTotal({
  label,
  testId,
  binding,
  column,
}: GroupTotalProps) {
  const format = useFormat();
  return (
    <View style={{ alignItems: 'flex-end', paddingRight: 4, minWidth: 0 }}>
      <Text style={{ fontSize: 12, color: theme.pageTextLight }}>{label}</Text>
      <CellValue<
        'envelope-budget' | 'tracking-budget',
        'group-budget' | 'group-sum-amount' | 'group-leftover'
      >
        binding={binding}
        type="financial"
      >
        {({ type, value }) => (
          <View style={{ maxWidth: '100%' }}>
            <FitAmountColumn column={column} text={format(value, type)} />
            <PrivacyFilter>
              <AutoTextSize
                key={value}
                as={Text}
                {...AMOUNT_FONT}
                mode="oneline"
                data-testid={testId}
                style={{
                  ...styles.tnum,
                  textAlign: 'right',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {format(value, type)}
              </AutoTextSize>
            </PrivacyFilter>
          </View>
        )}
      </CellValue>
    </View>
  );
}
