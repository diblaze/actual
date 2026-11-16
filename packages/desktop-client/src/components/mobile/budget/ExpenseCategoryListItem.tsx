import { useCallback, useContext } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { GridListItem } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { BudgetType } from '@actual-app/core/server/prefs';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { CategoryInspectorContext } from '#components/modals/CategorySheet';
import { useCategoriesById } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import { collapseModals, pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { BalanceCell } from './BalanceCell';
import { BudgetCell } from './BudgetCell';
import { CELL_STYLE, ROW_HEIGHT, ROW_SEPARATOR, rowGrid } from './BudgetTable';
import { SpentCell } from './SpentCell';

type ExpenseCategoryNameProps = {
  category: CategoryEntity;
  onPress: () => void;
};

function ExpenseCategoryName({ category, onPress }: ExpenseCategoryNameProps) {
  return (
    <View
      style={{
        height: '100%',
        minWidth: 0,
        justifyContent: 'center',
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
        style={{
          height: '100%',
          justifyContent: 'flex-start',
          padding: 0,
          borderRadius: 0,
        }}
        onPress={onPress}
      >
        <Text
          style={{
            ...styles.lineClamp(2),
            fontSize: 16,
            lineHeight: 1.25,
            textAlign: 'left',
          }}
          data-testid="category-name"
        >
          {category.name}
        </Text>
      </Button>
    </View>
  );
}

type ExpenseCategoryCellsProps = {
  category: CategoryEntity;
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  onOpenBalanceMenu: () => void;
  onShowActivity: () => void;
  showSpent: boolean;
};

function ExpenseCategoryCells({
  category,
  month,
  onBudgetAction,
  onOpenBalanceMenu,
  onShowActivity,
  showSpent,
}: ExpenseCategoryCellsProps) {
  const { t } = useTranslation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const budgeted =
    budgetType === 'tracking'
      ? trackingBudget.catBudgeted(category.id)
      : envelopeBudget.catBudgeted(category.id);

  const spent =
    budgetType === 'tracking'
      ? trackingBudget.catSumAmount(category.id)
      : envelopeBudget.catSumAmount(category.id);

  const balance =
    budgetType === 'tracking'
      ? trackingBudget.catBalance(category.id)
      : envelopeBudget.catBalance(category.id);

  return (
    <>
      <View style={CELL_STYLE}>
        <BudgetCell
          binding={budgeted}
          type="financial"
          category={category}
          month={month}
          onBudgetAction={onBudgetAction}
        />
      </View>
      {showSpent && (
        <View style={CELL_STYLE}>
          <SpentCell
            binding={spent}
            category={category}
            month={month}
            onPress={onShowActivity}
          />
        </View>
      )}
      <View style={CELL_STYLE}>
        <BalanceCell
          binding={balance}
          category={category}
          onPress={onOpenBalanceMenu}
          aria-label={t('Open balance menu for {{categoryName}} category', {
            categoryName: category.name,
          })}
        />
      </View>
    </>
  );
}

type ExpenseCategoryListItemProps = ComponentPropsWithoutRef<
  typeof GridListItem<CategoryEntity>
> & {
  month: string;
  isHidden: boolean;
  style?: CSSProperties;
  onEditCategory: (id: CategoryEntity['id']) => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
};

export function ExpenseCategoryListItem({
  month,
  isHidden,
  onEditCategory,
  onBudgetAction,
  ...props
}: ExpenseCategoryListItemProps) {
  const { value: category } = props;

  const { t } = useTranslation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  // Spent is a column on tablets; phones show it in the category sheet
  const { isMediumWidth } = useResponsive();
  const format = useFormat();

  const balanceMenuModalName =
    `${budgetType as BudgetType}-balance-menu` as const;
  const dispatch = useDispatch();
  const { showUndoNotification } = useUndo();
  const {
    data: { list: categoriesById } = {
      list: {} as Record<string, CategoryEntity>,
    },
  } = useCategoriesById();

  const onCarryover = useCallback(
    (carryover: boolean) => {
      if (!category) {
        return;
      }
      onBudgetAction(month, 'carryover', {
        category: category.id,
        flag: carryover,
      });
      dispatch(collapseModals({ rootModalName: balanceMenuModalName }));
    },
    [category, onBudgetAction, month, dispatch, balanceMenuModalName],
  );

  const onTransfer = useCallback(
    (catBalance: number) => {
      if (!category) {
        return;
      }
      dispatch(
        pushModal({
          modal: {
            name: 'transfer',
            options: {
              title: category.name,
              categoryId: category.id,
              month,
              amount: catBalance || 0,
              onSubmit: (amount, toCategoryId) => {
                onBudgetAction(month, 'transfer-category', {
                  amount,
                  from: category.id,
                  to: toCategoryId,
                  currencyCode: format.currency.code,
                });
                dispatch(
                  collapseModals({ rootModalName: balanceMenuModalName }),
                );
                showUndoNotification({
                  message: t(
                    'Transferred {{amount}} from {{fromCategoryName}} to {{toCategoryName}}.',
                    {
                      amount: format(amount, 'financial'),
                      fromCategoryName: category.name,
                      toCategoryName: categoriesById[toCategoryId].name,
                    },
                  ),
                });
              },
              showToBeBudgeted: true,
            },
          },
        }),
      );
    },
    [
      category,
      dispatch,
      month,
      onBudgetAction,
      balanceMenuModalName,
      showUndoNotification,
      categoriesById,
      format,
      t,
    ],
  );

  const onCover = useCallback(
    (catBalance: number) => {
      if (!category) {
        return;
      }
      dispatch(
        pushModal({
          modal: {
            name: 'cover',
            options: {
              title: category.name,
              month,
              amount: catBalance,
              categoryId: category.id,
              onSubmit: (amount, fromCategoryId) => {
                onBudgetAction(month, 'cover-overspending', {
                  to: category.id,
                  from: fromCategoryId,
                  amount,
                  currencyCode: format.currency.code,
                });
                dispatch(
                  collapseModals({ rootModalName: balanceMenuModalName }),
                );
                showUndoNotification({
                  message: t(
                    `Covered {{amount}} {{toCategoryName}} overspending from {{fromCategoryName}}.`,
                    {
                      amount: format(amount, 'financial'),
                      toCategoryName: category.name,
                      fromCategoryName: categoriesById[fromCategoryId].name,
                    },
                  ),
                });
              },
            },
          },
        }),
      );
    },
    [
      category,
      dispatch,
      month,
      onBudgetAction,
      balanceMenuModalName,
      showUndoNotification,
      t,
      categoriesById,
      format,
    ],
  );

  const navigate = useNavigate();
  const inspector = useContext(CategoryInspectorContext);
  const openInspector = inspector?.open;
  const isSelected = !!category && inspector?.selectedId === category.id;
  const onShowActivity = useCallback(() => {
    if (!category) {
      return;
    }
    void navigate(`/categories/${category.id}?month=${month}`);
  }, [category, month, navigate]);

  const onOpenBalanceMenu = useCallback(() => {
    if (!category) {
      return;
    }
    const options = {
      month,
      categoryId: category.id,
      onCarryover,
      onShowActivity,
      onEditCategory: () => onEditCategory(category.id),
      onBudgetAction,
    };
    if (balanceMenuModalName === 'envelope-balance-menu') {
      if (openInspector) {
        openInspector({
          name: balanceMenuModalName,
          ...options,
          onTransfer,
          onCover,
        });
        return;
      }
      dispatch(
        pushModal({
          modal: {
            name: balanceMenuModalName,
            options: { ...options, onTransfer, onCover },
          },
        }),
      );
    } else if (openInspector) {
      openInspector({ name: balanceMenuModalName, ...options });
    } else {
      dispatch(
        pushModal({
          modal: { name: balanceMenuModalName, options },
        }),
      );
    }
  }, [
    openInspector,
    category,
    balanceMenuModalName,
    dispatch,
    month,
    onCarryover,
    onTransfer,
    onCover,
    onShowActivity,
    onEditCategory,
    onBudgetAction,
  ]);

  if (!category) {
    return null;
  }

  return (
    <GridListItem
      textValue={category.name}
      data-testid="category-row"
      data-inspected={isSelected}
      className={ROW_SEPARATOR}
      {...props}
    >
      <View
        // The category the inspector pane shows. On the row's content:
        // GridListItem drops aria-current, and the list has no selection.
        aria-current={isSelected ? 'true' : undefined}
        style={{
          ...rowGrid(isMediumWidth),
          height: ROW_HEIGHT,
          opacity: isHidden ? 0.5 : undefined,
          backgroundColor: isSelected
            ? theme.accentSubtleBackground
            : undefined,
        }}
      >
        <ExpenseCategoryName category={category} onPress={onOpenBalanceMenu} />
        <ExpenseCategoryCells
          category={category}
          month={month}
          onBudgetAction={onBudgetAction}
          onOpenBalanceMenu={onOpenBalanceMenu}
          onShowActivity={onShowActivity}
          showSpent={isMediumWidth}
        />
      </View>
    </GridListItem>
  );
}
