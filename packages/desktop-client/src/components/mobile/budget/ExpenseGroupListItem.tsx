import { useCallback, useMemo } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { GridListItem } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { SvgCheveronDown } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';
import { css } from '@emotion/css';

import { useSyncedPref } from '#hooks/useSyncedPref';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import {
  GROUP_CARD_STYLE,
  GROUP_ROW_HEIGHT,
  GroupTotal,
  rowGrid,
} from './BudgetTable';
import { ExpenseCategoryList } from './ExpenseCategoryList';

type ExpenseGroupListItemProps = ComponentPropsWithoutRef<
  typeof GridListItem<CategoryGroupEntity>
> & {
  month: string;
  showHiddenCategories: boolean;
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  onEditCategory: (id: string) => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  isCollapsed: (id: CategoryGroupEntity['id']) => boolean;
  onToggleCollapse: (id: CategoryGroupEntity['id']) => void;
  isHidden: boolean;
};

export function ExpenseGroupListItem({
  onEditCategoryGroup,
  onEditCategory,
  month,
  onBudgetAction,
  showHiddenCategories,
  isCollapsed,
  onToggleCollapse,
  isHidden,
  ...props
}: ExpenseGroupListItemProps) {
  const { value: categoryGroup } = props;

  const categories = useMemo(
    () =>
      !categoryGroup || isCollapsed(categoryGroup.id)
        ? []
        : (categoryGroup.categories?.filter(
            category => !category.hidden || showHiddenCategories,
          ) ?? []),
    [categoryGroup, isCollapsed, showHiddenCategories],
  );

  const shouldHideCategory = useCallback(
    (category: CategoryEntity) => {
      return !!(category.hidden || categoryGroup?.hidden);
    },
    [categoryGroup?.hidden],
  );

  if (!categoryGroup) {
    return null;
  }

  return (
    <GridListItem textValue={categoryGroup.name} {...props}>
      <View data-testid="category-group" style={{ marginBottom: 14 }}>
        <ExpenseGroupHeader
          categoryGroup={categoryGroup}
          onEditCategoryGroup={onEditCategoryGroup}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          isHidden={isHidden}
        />

        {categories.length > 0 && (
          <View style={GROUP_CARD_STYLE}>
            <ExpenseCategoryList
              categoryGroup={categoryGroup}
              categories={categories}
              month={month}
              onEditCategory={onEditCategory}
              onBudgetAction={onBudgetAction}
              shouldHideCategory={shouldHideCategory}
            />
          </View>
        )}
      </View>
    </GridListItem>
  );
}

type ExpenseGroupHeaderProps = {
  categoryGroup: CategoryGroupEntity;
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  isCollapsed: (id: CategoryGroupEntity['id']) => boolean;
  onToggleCollapse: (id: CategoryGroupEntity['id']) => void;
  isHidden: boolean;
};

// The group's name and totals above its card, in the rows' columns
export function ExpenseGroupHeader({
  categoryGroup,
  onEditCategoryGroup,
  isCollapsed,
  onToggleCollapse,
  isHidden,
}: ExpenseGroupHeaderProps) {
  const { isMediumWidth } = useResponsive();
  return (
    <View
      data-testid="category-group-row"
      style={{
        ...rowGrid(isMediumWidth),
        alignItems: 'end',
        minHeight: GROUP_ROW_HEIGHT,
        marginInline: 12,
        paddingBottom: 6,
        opacity: isHidden ? 0.5 : undefined,
      }}
    >
      <GroupName
        group={categoryGroup}
        onEditCategoryGroup={onEditCategoryGroup}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
      <ExpenseGroupTotals group={categoryGroup} showSpent={isMediumWidth} />
    </View>
  );
}

type GroupNameProps = {
  group: CategoryGroupEntity;
  onEditCategoryGroup: (id: CategoryGroupEntity['id']) => void;
  isCollapsed: (id: CategoryGroupEntity['id']) => boolean;
  onToggleCollapse: (id: CategoryGroupEntity['id']) => void;
};

// Chevron (collapse) and name (group menu); the income group uses it too
export function GroupName({
  group,
  onEditCategoryGroup,
  isCollapsed,
  onToggleCollapse,
}: GroupNameProps) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
        // The chevron's 44 wide target reaches into the row's left padding
        marginLeft: -22,
      }}
    >
      {/* Hidden drag button */}
      <Button
        slot="drag"
        style={{
          opacity: 0,
          width: 1,
          height: 1,
          position: 'absolute',
          overflow: 'hidden',
        }}
      />
      <Button
        variant="bare"
        aria-label={
          isCollapsed(group.id)
            ? t('Expand {{groupName}}', { groupName: group.name })
            : t('Collapse {{groupName}}', { groupName: group.name })
        }
        className={css({
          flexShrink: 0,
          width: 44,
          height: GROUP_ROW_HEIGHT,
          color: theme.pageText,
          '&[data-pressed]': {
            backgroundColor: 'transparent',
          },
        })}
        onPress={() => onToggleCollapse(group.id)}
      >
        <SvgCheveronDown
          width={14}
          height={14}
          style={{
            flexShrink: 0,
            transition: 'transform .1s',
            transform: isCollapsed(group.id) ? 'rotate(-90deg)' : '',
          }}
        />
      </Button>
      <Button
        variant="bare"
        style={{
          minWidth: 0,
          flexShrink: 1,
          minHeight: GROUP_ROW_HEIGHT,
          padding: 0,
          justifyContent: 'flex-start',
        }}
        onPress={() => onEditCategoryGroup(group.id)}
      >
        <Text
          style={{
            ...styles.lineClamp(2),
            textAlign: 'left',
            fontSize: 17,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
          data-testid="category-group-name"
        >
          {group.name}
        </Text>
      </Button>
    </View>
  );
}

type ExpenseGroupTotalsProps = {
  group: CategoryGroupEntity;
  showSpent: boolean;
};

function ExpenseGroupTotals({ group, showSpent }: ExpenseGroupTotalsProps) {
  const { t } = useTranslation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const budget = budgetType === 'tracking' ? trackingBudget : envelopeBudget;

  return (
    <>
      <GroupTotal
        label={t('Budgeted')}
        testId="group-budgeted"
        column={0}
        binding={budget.groupBudgeted(group.id)}
      />
      {showSpent && (
        <GroupTotal
          label={t('Spent')}
          testId="group-spent"
          column={1}
          binding={budget.groupSumAmount(group.id)}
        />
      )}
      <GroupTotal
        label={t('Balance')}
        testId="group-balance"
        column={2}
        binding={budget.groupBalance(group.id)}
      />
    </>
  );
}
