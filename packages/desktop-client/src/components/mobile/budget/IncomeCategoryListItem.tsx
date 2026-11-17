import { useCallback } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { GridListItem } from 'react-aria-components';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { useNavigate } from '#hooks/useNavigate';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import { envelopeBudget, trackingBudget } from '#spreadsheet/bindings';

import { BalanceCell } from './BalanceCell';
import { BudgetCell } from './BudgetCell';
import { CELL_STYLE, ROW_HEIGHT, ROW_SEPARATOR, rowGrid } from './BudgetTable';

type IncomeCategoryNameProps = {
  category: CategoryEntity;
  onEdit: (id: CategoryEntity['id']) => void;
};

function IncomeCategoryName({ category, onEdit }: IncomeCategoryNameProps) {
  return (
    <View style={{ height: '100%', minWidth: 0, justifyContent: 'center' }}>
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
        onPress={() => onEdit?.(category.id)}
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

type IncomeCategoryCellsProps = {
  category: CategoryEntity;
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
  onPress: () => void;
  showSpent: boolean;
};

function IncomeCategoryCells({
  category,
  month,
  onBudgetAction,
  onPress,
  showSpent,
}: IncomeCategoryCellsProps) {
  const { t } = useTranslation();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');

  const budgeted =
    budgetType === 'tracking'
      ? trackingBudget.catBudgeted(category.id)
      : envelopeBudget.catBudgeted(category.id);

  const balance =
    budgetType === 'tracking'
      ? trackingBudget.catSumAmount(category.id)
      : envelopeBudget.catSumAmount(category.id);

  // Budgeted (tracking only) and Received sit under Budgeted and Balance
  return (
    <>
      <View style={CELL_STYLE}>
        {budgetType === 'tracking' && (
          <BudgetCell
            binding={budgeted}
            type="financial"
            category={category}
            month={month}
            onBudgetAction={onBudgetAction}
          />
        )}
      </View>
      {showSpent && <View />}
      <View style={CELL_STYLE}>
        <BalanceCell
          binding={balance}
          category={category}
          onPress={onPress}
          aria-label={
            budgetType === 'envelope'
              ? t('Open balance menu for {{categoryName}} category', {
                  categoryName: category.name,
                })
              : t('Show transactions for {{categoryName}} category', {
                  categoryName: category.name,
                })
          }
        />
      </View>
    </>
  );
}

type IncomeCategoryListItemProps = ComponentPropsWithoutRef<
  typeof GridListItem<CategoryEntity>
> & {
  month: string;
  onEdit: (id: CategoryEntity['id']) => void;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
};

export function IncomeCategoryListItem({
  month,
  onEdit,
  onBudgetAction,
  ...props
}: IncomeCategoryListItemProps) {
  const { value: category } = props;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const { isMediumWidth } = useResponsive();
  const balanceMenuModalName = `envelope-income-balance-menu`;

  const onShowActivity = useCallback(() => {
    if (!category) {
      return null;
    }

    void navigate(`/categories/${category.id}?month=${month}`);
  }, [category, month, navigate]);

  const onCarryover = useCallback(
    (carryover: boolean) => {
      if (!category) {
        return;
      }
      onBudgetAction(month, 'carryover', {
        category: category.id,
        flag: carryover,
      });
    },
    [category, onBudgetAction, month],
  );

  const onOpenBalanceMenu = useCallback(() => {
    if (!category) {
      return;
    }
    dispatch(
      pushModal({
        modal: {
          name: balanceMenuModalName,
          options: {
            month,
            categoryId: category.id,
            onCarryover,
            onShowActivity,
          },
        },
      }),
    );
  }, [
    category,
    balanceMenuModalName,
    dispatch,
    month,
    onShowActivity,
    onCarryover,
  ]);

  if (!category) {
    return null;
  }

  return (
    <GridListItem
      textValue={category.name}
      data-testid="category-row"
      className={ROW_SEPARATOR}
      {...props}
    >
      <View
        style={{
          ...rowGrid(isMediumWidth),
          height: ROW_HEIGHT,
          opacity: category.hidden ? 0.5 : undefined,
        }}
      >
        <IncomeCategoryName category={category} onEdit={onEdit} />
        <IncomeCategoryCells
          category={category}
          month={month}
          onBudgetAction={onBudgetAction}
          onPress={
            budgetType === 'envelope' ? onOpenBalanceMenu : onShowActivity
          }
          showSpent={isMediumWidth}
        />
      </View>
    </GridListItem>
  );
}
