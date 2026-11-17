import React, { memo, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { radius, spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import type {
  CategoryEntity,
  CategoryGroupEntity,
} from '@actual-app/core/types/models';

import { DropHighlightPosContext } from '#components/sort';
import type { DragState, OnDropCallback } from '#components/sort';
import { Row } from '#components/table';
import { useLocalPref } from '#hooks/useLocalPref';

import { ExpenseCategory } from './ExpenseCategory';
import { ExpenseGroup } from './ExpenseGroup';
import { IncomeCategory } from './IncomeCategory';
import { IncomeGroup } from './IncomeGroup';
import { IncomeHeader } from './IncomeHeader';
import { SidebarCategory } from './SidebarCategory';
import { SidebarGroup } from './SidebarGroup';
import { separateGroups } from './util';

type BudgetItem =
  | { type: 'new-group' }
  | { type: 'new-category' }
  | { type: 'expense-group'; value: CategoryGroupEntity }
  | {
      type: 'expense-category';
      value: CategoryEntity;
      group: CategoryGroupEntity;
    }
  | { type: 'income-separator' }
  | { type: 'income-group'; value: CategoryGroupEntity }
  | { type: 'income-category'; value: CategoryEntity };

type LocalDragState =
  | DragState<CategoryEntity>
  | DragState<CategoryGroupEntity>
  | null;

type BudgetCategoriesProps = {
  categoryGroups: CategoryGroupEntity[];
  editingCell: { id: string; cell: string } | null;
  onBudgetAction: (month: string, action: string, arg: unknown) => void;
  onShowActivity: (id: CategoryEntity['id'], month?: string) => void;
  onEditName: (id: CategoryEntity['id']) => void;
  onEditMonth: (id: CategoryEntity['id'], month: string) => void;
  onSaveCategory: (category: CategoryEntity) => void;
  onSaveGroup: (group: CategoryGroupEntity) => void;
  onDeleteCategory: (id: CategoryEntity['id']) => void;
  onDeleteGroup: (id: CategoryGroupEntity['id']) => void;
  onApplyBudgetTemplatesInGroup: (categoryIds: CategoryEntity['id'][]) => void;
  onSortCategories?: (
    groupId: CategoryGroupEntity['id'],
    direction: 'asc' | 'desc',
  ) => void;
  onReorderCategory: OnDropCallback;
  onReorderGroup: OnDropCallback;
};

export const BudgetCategories = memo<BudgetCategoriesProps>(
  ({
    categoryGroups,
    editingCell,
    onBudgetAction,
    onShowActivity,
    onEditName,
    onEditMonth,
    onSaveCategory,
    onSaveGroup,
    onDeleteCategory,
    onDeleteGroup,
    onApplyBudgetTemplatesInGroup,
    onSortCategories,
    onReorderCategory,
    onReorderGroup,
  }) => {
    const [collapsedGroupIds = [], setCollapsedGroupIdsPref] =
      useLocalPref('budget.collapsed');
    const [showHiddenCategories] = useLocalPref('budget.showHiddenCategories');
    function onCollapse(value: Array<CategoryGroupEntity['id']>) {
      setCollapsedGroupIdsPref(value);
    }

    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [newCategoryForGroup, setNewCategoryForGroup] = useState<
      string | null
    >(null);
    const items: BudgetItem[] = useMemo(() => {
      const [expenseGroups, incomeGroup] = separateGroups(categoryGroups);

      let items: BudgetItem[] = Array.prototype.concat.apply(
        [],
        expenseGroups.map(group => {
          if (group.hidden && !showHiddenCategories) {
            return [];
          }

          const groupCategories = group.categories?.filter(
            cat => showHiddenCategories || !cat.hidden,
          );

          const items: BudgetItem[] = [
            { type: 'expense-group', value: { ...group } },
          ];

          if (newCategoryForGroup === group.id) {
            items.push({ type: 'new-category' });
          }

          return [
            ...items,
            ...(collapsedGroupIds.includes(group.id)
              ? []
              : groupCategories || []
            ).map((cat): BudgetItem => ({
              type: 'expense-category',
              value: cat,
              group,
            })),
          ];
        }),
      );

      if (isAddingGroup) {
        items.push({ type: 'new-group' });
      }

      if (incomeGroup) {
        const incomeCategoryItems: BudgetItem[] = [
          { type: 'income-separator' },
          { type: 'income-group', value: incomeGroup },
        ];

        if (newCategoryForGroup === incomeGroup.id) {
          incomeCategoryItems.push({ type: 'new-category' });
        }

        incomeCategoryItems.push(
          ...(collapsedGroupIds.includes(incomeGroup.id)
            ? []
            : incomeGroup.categories?.filter(
                cat => showHiddenCategories || !cat.hidden,
              ) || []
          ).map((cat): BudgetItem => ({
            type: 'income-category',
            value: cat,
          })),
        );

        items = items.concat(incomeCategoryItems);
      }

      return items;
    }, [
      categoryGroups,
      collapsedGroupIds,
      newCategoryForGroup,
      isAddingGroup,
      showHiddenCategories,
    ]);

    const [dragState, setDragState] = useState<LocalDragState>(null);
    const [savedCollapsed, setSavedCollapsed] = useState<Array<
      CategoryGroupEntity['id']
    > | null>(null);

    // TODO: If we turn this into a reducer, we could probably memoize
    // each item in the list for better perf
    function onDragChange(
      newDragState: DragState<CategoryEntity> | DragState<CategoryGroupEntity>,
    ) {
      const { state } = newDragState;

      if (state === 'start-preview') {
        // @ts-expect-error fix me
        setDragState({
          type: newDragState.type,
          item: newDragState.item,
          preview: true,
        });
      } else if (state === 'start') {
        if (dragState) {
          setDragState({
            ...dragState,
            preview: false,
          });
          setSavedCollapsed(collapsedGroupIds);
        }
      } else if (state === 'end') {
        setDragState(null);
        onCollapse(savedCollapsed || []);
      }
    }

    function onToggleCollapse(id: CategoryGroupEntity['id']) {
      if (collapsedGroupIds.includes(id)) {
        onCollapse(collapsedGroupIds.filter(id_ => id_ !== id));
      } else {
        onCollapse([...collapsedGroupIds, id]);
      }
    }

    function onShowNewGroup() {
      setIsAddingGroup(true);
    }

    function onHideNewGroup() {
      setIsAddingGroup(false);
    }

    function _onSaveGroup(group: CategoryGroupEntity) {
      onSaveGroup?.(group);
      if (group.id === 'new') {
        onHideNewGroup();
      }
    }

    function onShowNewCategory(groupId: CategoryGroupEntity['id']) {
      onCollapse(collapsedGroupIds.filter(c => c !== groupId));
      setNewCategoryForGroup(groupId);
    }

    function onHideNewCategory() {
      setNewCategoryForGroup(null);
    }

    function _onSaveCategory(category: CategoryEntity) {
      onSaveCategory?.(category);
      if (category.id === 'new') {
        onHideNewCategory();
      }
    }

    // Each group heading starts a card holding its categories; the income
    // header sits between the cards on the page background
    const cards: Array<{ key: string; rows: ReactNode[] }> = [];

    items.forEach((item, idx) => {
      let content;
      switch (item.type) {
        case 'new-group':
          content = (
            <Row style={{ backgroundColor: theme.budgetHeaderCurrentMonth }}>
              <SidebarGroup
                group={{ id: 'new', name: '' }}
                collapsed={false}
                editing
                onSave={_onSaveGroup}
                onHideNewGroup={onHideNewGroup}
                onEdit={onEditName}
              />
            </Row>
          );
          break;
        case 'new-category':
          content = (
            <Row>
              <SidebarCategory
                innerRef={null}
                category={{
                  name: '',
                  group: newCategoryForGroup!,
                  is_income:
                    newCategoryForGroup ===
                    categoryGroups.find(g => g.is_income)?.id,
                  id: 'new',
                }}
                editing
                onSave={_onSaveCategory}
                onHideNewCategory={onHideNewCategory}
                onEditName={onEditName!}
              />
            </Row>
          );
          break;

        case 'expense-group':
          content = (
            <ExpenseGroup
              group={item.value}
              editingCell={editingCell}
              collapsed={collapsedGroupIds.includes(item.value.id)}
              dragState={dragState}
              onEditName={onEditName}
              onSave={_onSaveGroup}
              onDelete={onDeleteGroup}
              onDragChange={onDragChange}
              onReorderGroup={onReorderGroup}
              onReorderCategory={onReorderCategory}
              onToggleCollapse={onToggleCollapse}
              onShowNewCategory={onShowNewCategory}
              onApplyBudgetTemplatesInGroup={onApplyBudgetTemplatesInGroup}
              onSortCategories={onSortCategories}
            />
          );
          break;
        case 'expense-category':
          content = (
            <ExpenseCategory
              cat={item.value}
              categoryGroup={item.group}
              editingCell={editingCell}
              dragState={dragState}
              onEditName={onEditName}
              onEditMonth={onEditMonth}
              onSave={_onSaveCategory}
              onDelete={onDeleteCategory}
              onDragChange={onDragChange}
              onReorder={onReorderCategory}
              onBudgetAction={onBudgetAction}
              onShowActivity={onShowActivity}
            />
          );
          break;
        case 'income-separator':
          content = (
            <View style={{ height: styles.incomeHeaderHeight }}>
              <IncomeHeader onShowNewGroup={onShowNewGroup} />
            </View>
          );
          break;
        case 'income-group':
          content = (
            <IncomeGroup
              group={item.value}
              editingCell={editingCell}
              collapsed={collapsedGroupIds.includes(item.value.id)}
              onEditName={onEditName!}
              onSave={_onSaveGroup}
              onSortCategories={onSortCategories}
              onToggleCollapse={onToggleCollapse}
              onShowNewCategory={onShowNewCategory!}
            />
          );
          break;
        case 'income-category':
          content = (
            <IncomeCategory
              cat={item.value}
              editingCell={editingCell}
              isLast={idx === items.length - 1}
              onEditName={onEditName}
              onEditMonth={onEditMonth}
              onSave={_onSaveCategory}
              onDelete={onDeleteCategory}
              onDragChange={onDragChange}
              onReorder={onReorderCategory}
              onBudgetAction={onBudgetAction}
              onShowActivity={onShowActivity}
            />
          );
          break;
        default:
          // @ts-expect-error Error is expected here because "item.type" is "never"
          throw new Error('Unknown item type: ' + item.type);
      }

      const pos =
        idx === 0 ? 'first' : idx === items.length - 1 ? 'last' : null;
      const key =
        'value' in item
          ? item.value.id
          : item.type === 'income-separator'
            ? 'separator'
            : String(idx);

      if (
        cards.length === 0 ||
        item.type === 'expense-group' ||
        item.type === 'new-group' ||
        item.type === 'income-separator' ||
        (item.type === 'income-group' &&
          items[idx - 1]?.type !== 'income-separator')
      ) {
        cards.push({
          key,
          rows: [],
        });
      }

      cards[cards.length - 1].rows.push(
        <DropHighlightPosContext.Provider key={key} value={pos}>
          <View
            style={
              dragState || item.type === 'income-separator'
                ? {}
                : {
                    ':hover': { backgroundColor: theme.budgetCurrentMonth },
                  }
            }
          >
            {content}
          </View>
        </DropHighlightPosContext.Provider>,
      );
    });

    return (
      <View style={{ marginBottom: 10, flex: 1, gap: spacing.md }}>
        {cards.map(({ key, rows }, cardIdx) => (
          <View
            key={key}
            style={{
              // match budget colors, not generic table colors.
              backgroundColor: theme.budgetCurrentMonth,
              overflow: 'hidden',
              boxShadow: theme.cardElevation,
              borderRadius: radius.card,
              // The first card continues the column header above it
              ...(cardIdx === 0 && {
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              }),
            }}
          >
            {rows}
          </View>
        ))}
      </View>
    );
  },
);

BudgetCategories.displayName = 'BudgetCategories';
