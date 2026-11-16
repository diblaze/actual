import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { View } from '@actual-app/components/view';
import type { CategoryGroupEntity } from '@actual-app/core/types/models';

import { useSyncedPref } from '#hooks/useSyncedPref';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import {
  GROUP_CARD_STYLE,
  GROUP_ROW_HEIGHT,
  GroupTotal,
  rowGrid,
} from './BudgetTable';
import { GroupName } from './ExpenseGroupListItem';
import { IncomeCategoryList } from './IncomeCategoryList';

type IncomeGroupProps = {
  categoryGroup: CategoryGroupEntity;
  month: string;
  showHiddenCategories: boolean;
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  onEditCategory: (id: string) => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  isCollapsed: (id: CategoryGroupEntity['id']) => boolean;
  onToggleCollapse: (id: CategoryGroupEntity['id']) => void;
};

export function IncomeGroup({
  categoryGroup,
  month,
  showHiddenCategories,
  onEditCategoryGroup,
  onEditCategory,
  onBudgetAction,
  isCollapsed,
  onToggleCollapse,
}: IncomeGroupProps) {
  const categories = useMemo(
    () =>
      isCollapsed(categoryGroup.id)
        ? []
        : (categoryGroup.categories?.filter(
            category => !category.hidden || showHiddenCategories,
          ) ?? []),
    [
      categoryGroup.categories,
      categoryGroup.id,
      isCollapsed,
      showHiddenCategories,
    ],
  );

  return (
    <View data-testid="category-group" style={{ marginTop: 36 }}>
      <IncomeGroupHeader
        group={categoryGroup}
        onEdit={onEditCategoryGroup}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
      {categories.length > 0 && (
        <View style={GROUP_CARD_STYLE}>
          <IncomeCategoryList
            categories={categories}
            month={month}
            onEditCategory={onEditCategory}
            onBudgetAction={onBudgetAction}
          />
        </View>
      )}
    </View>
  );
}

type IncomeGroupHeaderProps = {
  group: CategoryGroupEntity;
  onEdit: (id: CategoryGroupEntity['id']) => void;
  isCollapsed: (id: CategoryGroupEntity['id']) => boolean;
  onToggleCollapse: (id: CategoryGroupEntity['id']) => void;
};

// Name and totals above the card: Budgeted (tracking only) and Received, in
// the Budgeted and Balance columns
function IncomeGroupHeader({
  group,
  onEdit,
  isCollapsed,
  onToggleCollapse,
}: IncomeGroupHeaderProps) {
  const { t } = useTranslation();
  const { isMediumWidth } = useResponsive();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  return (
    <View
      data-testid="category-group-row"
      style={{
        ...rowGrid(isMediumWidth),
        alignItems: 'end',
        minHeight: GROUP_ROW_HEIGHT,
        marginInline: 12,
        paddingBottom: 6,
        opacity: group.hidden ? 0.5 : undefined,
      }}
    >
      <GroupName
        group={group}
        onEditCategoryGroup={onEdit}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
      {budgetType === 'tracking' ? (
        <GroupTotal
          label={t('Budgeted')}
          testId="group-budgeted"
          column={0}
          binding={trackingBudget.groupBudgeted(group.id)}
        />
      ) : (
        <View />
      )}
      {isMediumWidth && <View />}
      <GroupTotal
        label={t('Received')}
        testId="group-balance"
        column={2}
        binding={
          budgetType === 'tracking'
            ? trackingBudget.groupSumAmount(group.id)
            : envelopeBudget.groupSumAmount(group.id)
        }
      />
    </View>
  );
}
