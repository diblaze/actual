import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { CategoryEntity } from '@actual-app/core/types/models';

import { useCategories, useCategoriesById } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useOverspentCategories } from '#hooks/useOverspentCategories';
import { useUndo } from '#hooks/useUndo';
import { collapseModals, pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

export type OnBudgetAction = (
  month: string,
  type: string,
  args?: unknown,
) => Promise<void> | void;

// A month's overspent categories and their cover flow: the list opens on
// the overspent categories, picking one opens its cover dialog, and a cover
// shows an undo toast. Tracking budgets cannot cover (canCover false), so
// their list only shows the categories. The desktop's Overspent card and
// the phone's overspent banner both use it.
export function useCoverOverspending(
  month: string,
  onBudgetAction: OnBudgetAction,
  canCover = true,
) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const { showUndoNotification } = useUndo();
  const { data: { grouped: categoryGroups } = { grouped: [] } } =
    useCategories();
  const {
    data: { list: categoriesById } = {
      list: {} as Record<string, CategoryEntity>,
    },
  } = useCategoriesById();
  const { categories, amountsByCategory } = useOverspentCategories({ month });

  // The list stays open while covering, so read the latest amounts
  const amountsByCategoryRef = useRef(amountsByCategory);
  amountsByCategoryRef.current = amountsByCategory;

  const onCover = (categoryId: string | null) => {
    const category = categoryId ? categoriesById[categoryId] : null;
    if (!canCover || !category) {
      return;
    }
    dispatch(
      pushModal({
        modal: {
          name: 'cover',
          options: {
            title: category.name,
            month,
            amount: amountsByCategoryRef.current.get(category.id),
            categoryId: category.id,
            onSubmit: (amount, fromCategoryId) => {
              void onBudgetAction(month, 'cover-overspending', {
                to: category.id,
                from: fromCategoryId,
                amount,
                currencyCode: format.currency.code,
              });
              showUndoNotification({
                message: t(
                  `Covered {{toCategoryName}} overspending from {{fromCategoryName}}.`,
                  {
                    toCategoryName: category.name,
                    fromCategoryName:
                      fromCategoryId === 'to-budget'
                        ? t('To Budget')
                        : categoriesById[fromCategoryId].name,
                  },
                ),
              });
            },
          },
        },
      }),
    );
  };

  const onOpenCoverList = () => {
    dispatch(
      pushModal({
        modal: {
          name: 'category-autocomplete',
          options: {
            title: canCover
              ? t('Cover overspending')
              : t('Overspent categories'),
            month,
            categoryGroups: categoryGroups
              .filter(g => categories.some(c => c.group === g.id))
              .map(g => ({
                ...g,
                categories: categories.filter(c => c.group === g.id),
              })),
            showHiddenCategories: true,
            onSelect: onCover,
            clearOnSelect: true,
            closeOnSelect: false,
          },
        },
      }),
    );
  };

  return { count: categories.length, onOpenCoverList };
}

// The To budget amount's actions: its menu (transfer, cover, hold) and the
// cover-overbudgeted dialog. The phone's To budget card and the budget
// summary sheet both open them.
export function useToBudgetActions(
  month: string,
  onBudgetAction: OnBudgetAction,
) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const { showUndoNotification } = useUndo();
  const {
    data: { list: categoriesById } = {
      list: {} as Record<string, CategoryEntity>,
    },
  } = useCategoriesById();

  const onCoverOverbudgeted = (toBudget: number) => {
    dispatch(
      pushModal({
        modal: {
          name: 'cover',
          options: {
            title: t('Cover overbudgeted'),
            month,
            amount: toBudget,
            showToBeBudgeted: false,
            onSubmit: (amount, categoryId) => {
              void onBudgetAction(month, 'cover-overbudgeted', {
                category: categoryId,
                amount,
                currencyCode: format.currency.code,
              });
              dispatch(collapseModals({ rootModalName: 'cover' }));
              showUndoNotification({
                message: t('Covered overbudgeted from {{categoryName}}', {
                  categoryName: categoriesById[categoryId].name,
                }),
              });
            },
          },
        },
      }),
    );
  };

  const onOpenToBudgetMenu = (toBudget: number) => {
    dispatch(
      pushModal({
        modal: {
          name: 'envelope-summary-to-budget-menu',
          options: {
            month,
            onTransfer: () =>
              dispatch(
                pushModal({
                  modal: {
                    name: 'transfer',
                    options: {
                      title: t('Transfer to category'),
                      month,
                      amount: toBudget,
                      onSubmit: (amount, toCategoryId) => {
                        void onBudgetAction(month, 'transfer-available', {
                          amount,
                          month,
                          category: toCategoryId,
                        });
                        dispatch(collapseModals({ rootModalName: 'transfer' }));
                        showUndoNotification({
                          message: t(
                            'Transferred {{amount}} to {{categoryName}}',
                            {
                              amount: format(amount, 'financial'),
                              categoryName: categoriesById[toCategoryId].name,
                            },
                          ),
                        });
                      },
                    },
                  },
                }),
              ),
            onCover: () => onCoverOverbudgeted(toBudget),
            onHoldBuffer: () =>
              dispatch(
                pushModal({
                  modal: {
                    name: 'hold-buffer',
                    options: {
                      month,
                      onSubmit: amount => {
                        void onBudgetAction(month, 'hold', { amount });
                        dispatch(
                          collapseModals({ rootModalName: 'hold-buffer' }),
                        );
                      },
                    },
                  },
                }),
              ),
            onResetHoldBuffer: () => {
              void onBudgetAction(month, 'reset-hold');
              dispatch(
                collapseModals({
                  rootModalName: 'envelope-summary-to-budget-menu',
                }),
              );
            },
            onBudgetAction,
          },
        },
      }),
    );
  };

  return { onCoverOverbudgeted, onOpenToBudgetMenu };
}
