import { useCallback } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { AutoTextSize } from 'auto-text-size';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValue } from '#components/spreadsheet/CellValue';
import { useFormat } from '#hooks/useFormat';
import type { FormatType } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNotes } from '#hooks/useNotes';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUndo } from '#hooks/useUndo';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';
import type { SheetFields } from '#spreadsheet';

import { AMOUNT_FONT, CELL_BUTTON_STYLE, FitAmountColumn } from './BudgetTable';

type BudgetCellProps<
  SheetFieldName extends SheetFields<'envelope-budget' | 'tracking-budget'>,
> = Omit<
  ComponentPropsWithoutRef<
    typeof CellValue<'envelope-budget' | 'tracking-budget', SheetFieldName>
  >,
  'children'
> & {
  // Replaces the default cell button; onPress opens the budget menu
  children?: (props: {
    type?: FormatType;
    name: string;
    value: number;
    onPress: () => void;
  }) => ReactNode;
  category: CategoryEntity;
  month: string;
  onBudgetAction: (month: string, action: string, args: unknown) => void;
};

export function BudgetCell<
  SheetFieldName extends SheetFields<'envelope-budget' | 'tracking-budget'>,
>({
  binding,
  category,
  month,
  onBudgetAction,
  children,
  ...props
}: BudgetCellProps<SheetFieldName>) {
  const { t } = useTranslation();
  const locale = useLocale();
  const dispatch = useDispatch();
  const format = useFormat();
  const { showUndoNotification } = useUndo();
  const [budgetType = 'envelope'] = useSyncedPref('budgetType');
  const categoryNotes = useNotes(category.id);

  const onSaveNotes = useCallback(async (id: string, notes: string) => {
    await send('notes-save', { id, note: notes });
  }, []);

  const onEditNotes = useCallback(
    (id: string, month: string) => {
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id,
              name:
                category.name +
                ' - ' +
                monthUtils.format(month, "MMMM ''yy", locale),
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [category.name, locale, dispatch, onSaveNotes],
  );

  const onOpenCategoryBudgetMenu = useCallback(() => {
    const sharedOptions = {
      categoryId: category.id,
      month,
      onEditNotes,
      onUpdateBudget: (amount: number) => {
        onBudgetAction(month, 'budget-amount', {
          category: category.id,
          amount,
        });
        showUndoNotification({
          message: `${category.name} budget has been updated to ${format(amount, 'financial')}.`,
        });
      },
      onCopyLastMonthAverage: () => {
        onBudgetAction(month, 'copy-single-last', {
          category: category.id,
        });
        showUndoNotification({
          message: `${category.name} budget has been set to last month's budgeted amount.`,
        });
      },
      onSetMonthsAverage: (numberOfMonths: number) => {
        if (
          numberOfMonths !== 3 &&
          numberOfMonths !== 6 &&
          numberOfMonths !== 12
        ) {
          return;
        }
        onBudgetAction(month, `set-single-${numberOfMonths}-avg`, {
          category: category.id,
        });
        showUndoNotification({
          message: `${category.name} budget has been set to ${numberOfMonths === 12 ? 'yearly' : `${numberOfMonths} month`} average.`,
        });
      },
      onApplyBudgetTemplate: () => {
        onBudgetAction(month, 'apply-single-category-template', {
          category: category.id,
        });
        showUndoNotification({
          message: `${category.name} budget templates have been applied.`,
          pre: categoryNotes ?? undefined,
        });
      },
    };

    if (budgetType === 'envelope') {
      dispatch(
        pushModal({
          modal: {
            name: 'envelope-budget-menu',
            options: sharedOptions,
          },
        }),
      );
    } else {
      dispatch(
        pushModal({
          modal: {
            name: 'tracking-budget-menu',
            options: {
              ...sharedOptions,
              onCopyUntilYearEnd: () => {
                onBudgetAction(month, 'copy-until-year-end', {
                  category: category.id,
                });
                showUndoNotification({
                  message: t('{{categoryName}} budget copied until year end.', {
                    categoryName: category.name,
                  }),
                });
              },
            },
          },
        }),
      );
    }
  }, [
    budgetType,
    category.id,
    category.name,
    categoryNotes,
    dispatch,
    month,
    onBudgetAction,
    showUndoNotification,
    onEditNotes,
    format,
    t,
  ]);

  return (
    <CellValue
      binding={binding}
      type="financial"
      aria-label={t('Budgeted amount for {{categoryName}} category', {
        categoryName: category.name,
      })}
      {...props}
    >
      {({ type, name, value }) =>
        children?.({
          type,
          name,
          value,
          onPress: onOpenCategoryBudgetMenu,
        }) || (
          <Button
            variant="bare"
            style={{
              ...CELL_BUTTON_STYLE,
              // Secondary to the Balance pill beside it, still 4.5:1
              color: theme.pageTextLight,
            }}
            onPress={onOpenCategoryBudgetMenu}
            aria-label={t('Open budget menu for {{categoryName}} category', {
              categoryName: category.name,
            })}
          >
            <View>
              <FitAmountColumn column={0} text={format(value, type)} />
              <PrivacyFilter>
                <AutoTextSize
                  key={value}
                  as={Text}
                  {...AMOUNT_FONT}
                  mode="oneline"
                  style={{
                    ...styles.tnum,
                    textAlign: 'right',
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  {format(value, type)}
                </AutoTextSize>
              </PrivacyFilter>
            </View>
          </Button>
        )
      }
    </CellValue>
  );
}
