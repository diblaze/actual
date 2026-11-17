// @ts-strict-ignore
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import {
  SvgArrowThinLeft,
  SvgArrowThinRight,
  SvgCheveronDown,
  SvgDotsHorizontalTriple,
} from '@actual-app/components/icons/v1';
import { SvgCalendar } from '@actual-app/components/icons/v2';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { useQuery } from '@tanstack/react-query';

import { sync } from '#app/appSlice';
import {
  budgetBoundsQueries,
  useBudgetActions,
  useCreateCategoryGroupMutation,
  useCreateCategoryMutation,
  useDeleteCategoryGroupMutation,
  useDeleteCategoryMutation,
  useSaveCategoryGroupMutation,
  useSaveCategoryMutation,
  useSortCategoriesMutation,
} from '#budget';
import { closeBudget } from '#budgetfiles/budgetfilesSlice';
import {
  useCoverOverspending,
  useToBudgetActions,
} from '#components/budget/envelope/useEnvelopeBudgetActions';
import { clampMonth } from '#components/budget/MonthsContext';
import { prewarmMonth } from '#components/budget/util';
import {
  ActionBanner,
  UncategorizedBanner,
} from '#components/mobile/ActionBanner';
import {
  CategoryInspectorContext,
  CategorySheetBody,
} from '#components/modals/CategorySheet';
import type { CategorySheetProps } from '#components/modals/CategorySheet';
import { MobilePageHeader, Page } from '#components/Page';
import { SyncRefresh } from '#components/SyncRefresh';
import { useCategories } from '#hooks/useCategories';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useLocale } from '#hooks/useLocale';
import { useLocalPref } from '#hooks/useLocalPref';
import { SheetNameProvider } from '#hooks/useSheetName';
import { useSpreadsheet } from '#hooks/useSpreadsheet';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { collapseModals, pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

import { BudgetTable } from './BudgetTable';

function isBudgetType(input?: string): input is 'envelope' | 'tracking' {
  return ['envelope', 'tracking'].includes(input);
}

export function BudgetPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const {
    data: { list: categories, grouped: categoryGroups } = {
      list: [],
      grouped: [],
    },
  } = useCategories();
  const [budgetTypePref] = useSyncedPref('budgetType');
  const budgetType = isBudgetType(budgetTypePref) ? budgetTypePref : 'envelope';
  const goalTemplatesEnabled = useFeatureFlag('goalTemplatesEnabled');
  const goalTemplatesUIEnabled = useFeatureFlag('goalTemplatesUIEnabled');
  const spreadsheet = useSpreadsheet();

  const currMonth = monthUtils.currentMonth();
  const [startMonth = currMonth, setStartMonthPref] =
    useLocalPref('budget.startMonth');
  const { data: loadedBounds } = useQuery(budgetBoundsQueries.bounds());
  const monthBounds = loadedBounds ?? {
    start: startMonth,
    end: startMonth,
  };
  // const [editMode, setEditMode] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [_numberFormat] = useSyncedPref('numberFormat');
  const numberFormat = _numberFormat || 'comma-dot';
  const [hideFraction] = useSyncedPref('hideFraction');
  const dispatch = useDispatch();
  const applyBudgetAction = useBudgetActions();
  const createCategory = useCreateCategoryMutation();
  const saveCategory = useSaveCategoryMutation();
  const deleteCategory = useDeleteCategoryMutation();
  const createCategoryGroup = useCreateCategoryGroupMutation();
  const saveCategoryGroup = useSaveCategoryGroupMutation();
  const deleteCategoryGroup = useDeleteCategoryGroupMutation();
  const sortCategories = useSortCategoriesMutation();
  // Tablet: the selected category's sheet body sits beside the list
  const { isMediumWidth } = useResponsive();
  const [inspector, setInspector] = useState<CategorySheetProps | null>(null);

  useEffect(() => {
    async function init() {
      if (!loadedBounds) {
        return;
      }
      // Reopening the budget or switching budget type can leave the selected
      // month out of range.
      const validMonth = clampMonth(startMonth, loadedBounds);
      if (validMonth !== startMonth) {
        setStartMonthPref(validMonth);
      }

      await prewarmMonth(budgetType, spreadsheet, validMonth);

      setInitialized(true);
    }

    void init();
  }, [budgetType, startMonth, spreadsheet, loadedBounds, setStartMonthPref]);

  const onBudgetAction = useCallback(
    async (month, type, args) => {
      applyBudgetAction.mutate({ month, type, args });
    },
    [applyBudgetAction],
  );

  const onShowBudgetSummary = useCallback(() => {
    if (budgetType === 'tracking') {
      dispatch(
        pushModal({
          modal: {
            name: 'tracking-budget-summary',
            options: {
              month: startMonth,
            },
          },
        }),
      );
    } else {
      dispatch(
        pushModal({
          modal: {
            name: 'envelope-budget-summary',
            options: {
              month: startMonth,
              onBudgetAction,
            },
          },
        }),
      );
    }
  }, [budgetType, dispatch, onBudgetAction, startMonth]);

  // The To budget card's Move and Cover, as the budget summary opens them
  const { onCoverOverbudgeted, onOpenToBudgetMenu } = useToBudgetActions(
    startMonth,
    onBudgetAction,
  );

  const onOpenNewCategoryGroupModal = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'new-category-group',
          options: {
            onValidate: name => (!name ? 'Name is required.' : null),
            onSubmit: async name => {
              createCategoryGroup.mutate(
                { name },
                {
                  onSettled: () => {
                    dispatch(
                      collapseModals({ rootModalName: 'budget-page-menu' }),
                    );
                  },
                },
              );
            },
          },
        },
      }),
    );
  }, [dispatch, createCategoryGroup]);

  const onOpenNewCategoryModal = useCallback(
    (groupId, isIncome) => {
      dispatch(
        pushModal({
          modal: {
            name: 'new-category',
            options: {
              onValidate: name => (!name ? 'Name is required.' : null),
              onSubmit: async name => {
                createCategory.mutate(
                  {
                    name,
                    groupId,
                    isIncome,
                    isHidden: false,
                  },
                  {
                    onSettled: () => {
                      dispatch(
                        collapseModals({
                          rootModalName: 'category-group-menu',
                        }),
                      );
                    },
                  },
                );
              },
            },
          },
        }),
      );
    },
    [dispatch, createCategory],
  );

  const onSaveGroup = useCallback(
    group => {
      saveCategoryGroup.mutate({ group });
    },
    [saveCategoryGroup],
  );

  const onApplyBudgetTemplatesInGroup = useCallback(
    async categories => {
      applyBudgetAction.mutate({
        month: startMonth,
        type: 'apply-multiple-templates',
        args: {
          categories,
        },
      });
    },
    [applyBudgetAction, startMonth],
  );

  const onDeleteGroup = useCallback(
    (groupId, transferId) => {
      dispatch(collapseModals({ rootModalName: 'category-group-menu' }));
      deleteCategoryGroup.mutate({ id: groupId, transferId });
    },
    [deleteCategoryGroup, dispatch],
  );

  const onSaveCategory = useCallback(
    category => {
      saveCategory.mutate({ category });
    },
    [saveCategory],
  );

  const onDeleteCategory = useCallback(
    (categoryId, transferId) => {
      dispatch(collapseModals({ rootModalName: 'category-menu' }));
      deleteCategory.mutate({ id: categoryId, transferId });
    },
    [deleteCategory, dispatch],
  );

  const onPrevMonth = useCallback(async () => {
    const month = monthUtils.subMonths(startMonth, 1);
    await prewarmMonth(budgetType, spreadsheet, month);
    setStartMonthPref(month);
    setInitialized(true);
  }, [budgetType, setStartMonthPref, spreadsheet, startMonth]);

  const onNextMonth = useCallback(async () => {
    const month = monthUtils.addMonths(startMonth, 1);
    await prewarmMonth(budgetType, spreadsheet, month);
    setStartMonthPref(month);
    setInitialized(true);
  }, [budgetType, setStartMonthPref, spreadsheet, startMonth]);

  const onCurrentMonth = useCallback(async () => {
    await prewarmMonth(budgetType, spreadsheet, currMonth);
    setStartMonthPref(currMonth);
    setInitialized(true);
  }, [budgetType, setStartMonthPref, spreadsheet, currMonth]);

  // const onOpenMonthActionMenu = () => {
  //   const options = [
  //     'Copy last month's budget',
  //     'Set budgets to zero',
  //     'Set budgets to 3 month average',
  //     budgetType === 'tracking' && 'Apply to all future budgets',
  //   ].filter(Boolean);

  //   props.showActionSheetWithOptions(
  //     {
  //       options,
  //       cancelButtonIndex: options.length - 1,
  //       title: 'Actions',
  //     },
  //     idx => {
  //       switch (idx) {
  //         case 0:
  //           setEditMode(true);
  //           break;
  //         case 1:
  //           onBudgetAction('copy-last');
  //           break;
  //         case 2:
  //           onBudgetAction('set-zero');
  //           break;
  //         case 3:
  //           onBudgetAction('set-3-avg');
  //           break;
  //         case 4:
  //           if (budgetType === 'tracking') {
  //             onBudgetAction('set-all-future');
  //           }
  //           break;
  //         default:
  //       }
  //     },
  //   );
  // };

  const onSaveNotes = useCallback(async (id, notes) => {
    await send('notes-save', { id, note: notes });
  }, []);

  const onOpenCategoryGroupNotesModal = useCallback(
    id => {
      const group = categoryGroups.find(g => g.id === id);
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id,
              name: group.name,
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [categoryGroups, dispatch, onSaveNotes],
  );

  const onOpenCategoryNotesModal = useCallback(
    id => {
      const category = categories.find(c => c.id === id);
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id,
              name: category.name,
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [categories, dispatch, onSaveNotes],
  );

  const onOpenCategoryGroupMenuModal = useCallback(
    id => {
      const group = categoryGroups.find(g => g.id === id);
      dispatch(
        pushModal({
          modal: {
            name: 'category-group-menu',
            options: {
              groupId: group.id,
              onSave: onSaveGroup,
              onAddCategory: onOpenNewCategoryModal,
              onEditNotes: onOpenCategoryGroupNotesModal,
              onDelete: onDeleteGroup,
              onApplyBudgetTemplatesInGroup,
              onSortCategories: (groupId, direction) => {
                sortCategories.mutate({ groupId, direction });
              },
            },
          },
        }),
      );
    },
    [
      categoryGroups,
      dispatch,
      onDeleteGroup,
      onOpenCategoryGroupNotesModal,
      onOpenNewCategoryModal,
      onSaveGroup,
      onApplyBudgetTemplatesInGroup,
      sortCategories,
    ],
  );

  const onOpenCategoryMenuModal = useCallback(
    id => {
      const category = categories.find(c => c.id === id);
      const canEditAutomations =
        goalTemplatesEnabled &&
        goalTemplatesUIEnabled &&
        !(category.is_income && budgetType !== 'tracking');
      dispatch(
        pushModal({
          modal: {
            name: 'category-menu',
            options: {
              categoryId: category.id,
              onSave: onSaveCategory,
              onEditNotes: onOpenCategoryNotesModal,
              onDelete: onDeleteCategory,
              ...(canEditAutomations && {
                onEditAutomations: (categoryId: string) => {
                  dispatch(collapseModals({ rootModalName: 'category-menu' }));
                  dispatch(
                    pushModal({
                      modal: {
                        name: 'category-automations-edit',
                        options: { categoryId, month: startMonth },
                      },
                    }),
                  );
                },
              }),
            },
          },
        }),
      );
    },
    [
      budgetType,
      categories,
      dispatch,
      goalTemplatesEnabled,
      goalTemplatesUIEnabled,
      onDeleteCategory,
      onOpenCategoryNotesModal,
      onSaveCategory,
      startMonth,
    ],
  );

  const [showHiddenCategories, setShowHiddenCategoriesPref] = useLocalPref(
    'budget.showHiddenCategories',
  );

  const onToggleHiddenCategories = useCallback(() => {
    setShowHiddenCategoriesPref(!showHiddenCategories);
  }, [setShowHiddenCategoriesPref, showHiddenCategories]);

  const onOpenBudgetMonthNotesModal = useCallback(
    month => {
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id: `budget-${month}`,
              name: monthUtils.format(month, "MMMM ''yy", locale),
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [dispatch, onSaveNotes, locale],
  );

  const onSwitchBudgetFile = useCallback(() => {
    void dispatch(closeBudget());
  }, [dispatch]);

  const onOpenBudgetMonthMenu = useCallback(
    month => {
      dispatch(
        pushModal({
          modal: {
            name: `${budgetType}-budget-month-menu`,
            options: {
              month,
              onBudgetAction,
              onEditNotes: onOpenBudgetMonthNotesModal,
            },
          },
        }),
      );
    },
    [budgetType, dispatch, onBudgetAction, onOpenBudgetMonthNotesModal],
  );

  const onOpenBudgetPageMenu = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'budget-page-menu',
          options: {
            onAddCategoryGroup: onOpenNewCategoryGroupModal,
            onToggleHiddenCategories,
            onSwitchBudgetFile,
          },
        },
      }),
    );
  }, [
    dispatch,
    onOpenNewCategoryGroupModal,
    onSwitchBudgetFile,
    onToggleHiddenCategories,
  ]);

  if (!categoryGroups || !initialized) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.mobilePageBackground,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 25,
        }}
      >
        <AnimatedLoading width={25} height={25} />
      </View>
    );
  }

  const budgetTable = (
    <SyncRefresh
      onSync={async () => {
        void dispatch(sync());
      }}
    >
      {({ onRefresh }) => (
        <BudgetTable
          // This key forces the whole table rerender when the number
          // format changes
          key={`${numberFormat}${hideFraction}`}
          categoryGroups={categoryGroups}
          month={startMonth}
          banners={
            <>
              <OverspentBanner
                month={startMonth}
                onBudgetAction={onBudgetAction}
                budgetType={budgetType}
              />
              <UncategorizedBanner />
            </>
          }
          onShowBudgetSummary={onShowBudgetSummary}
          onOpenToBudgetMenu={onOpenToBudgetMenu}
          onCoverOverbudgeted={onCoverOverbudgeted}
          onBudgetAction={onBudgetAction}
          onRefresh={onRefresh}
          onEditCategoryGroup={onOpenCategoryGroupMenuModal}
          onEditCategory={onOpenCategoryMenuModal}
        />
      )}
    </SyncRefresh>
  );

  return (
    <Page
      padding={0}
      header={
        <MobilePageHeader
          title={
            <MonthTitle
              month={startMonth}
              onOpenMonthMenu={onOpenBudgetMonthMenu}
            />
          }
          leftContent={
            <MonthArrows
              month={startMonth}
              monthBounds={monthBounds}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
            />
          }
          rightContent={
            <>
              {!monthUtils.isCurrentMonth(startMonth) && (
                <Button
                  variant="bare"
                  onPress={onCurrentMonth}
                  aria-label={t('Today')}
                >
                  <SvgCalendar width={20} height={20} />
                </Button>
              )}
              <Button
                variant="bare"
                onPress={onOpenBudgetPageMenu}
                aria-label={t('Budget page menu')}
              >
                {/* The header buttons' colour: legible on their glass */}
                <SvgDotsHorizontalTriple
                  style={{ color: theme.pageText }}
                  width={20}
                  height={20}
                />
              </Button>
            </>
          }
        />
      }
    >
      <SheetNameProvider name={monthUtils.sheetForMonth(startMonth)}>
        {isMediumWidth ? (
          <CategoryInspectorContext.Provider
            value={{
              open: setInspector,
              selectedId:
                inspector?.month === startMonth
                  ? inspector.categoryId
                  : undefined,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>{budgetTable}</View>
              {inspector?.month === startMonth && (
                <CategorySheetBody {...inspector} />
              )}
            </View>
          </CategoryInspectorContext.Provider>
        ) : (
          budgetTable
        )}
      </SheetNameProvider>
    </Page>
  );
}

function OverspentBanner({ month, onBudgetAction, budgetType }) {
  const { t } = useTranslation();
  // Tracking budgets cannot cover, so their list only shows the categories
  const canCover = budgetType === 'envelope';
  const { count, onOpenCoverList } = useCoverOverspending(
    month,
    onBudgetAction,
    canCover,
  );

  if (count === 0) {
    return null;
  }

  return (
    <ActionBanner
      tone="negative"
      count={count}
      label={t('categories-overspent-label', {
        count,
        defaultValue_one: 'Category overspent',
        defaultValue_other: 'Categories overspent',
      })}
      aria-label={t('categories-overspent', {
        count,
        defaultValue_one: '{{count}} category overspent',
        defaultValue_other: '{{count}} categories overspent',
      })}
      actionLabel={canCover ? t('Fix') : t('Show')}
      onAction={onOpenCoverList}
    />
  );
}

// The month is the page's large title; it opens the month menu
function MonthTitle({ month, onOpenMonthMenu }) {
  const locale = useLocale();

  return (
    <Button
      variant="bare"
      style={{
        padding: 0,
        gap: 6,
        fontSize: 'inherit',
        fontWeight: 'inherit',
        color: 'inherit',
      }}
      onPress={() => {
        onOpenMonthMenu?.(month);
      }}
      data-month={month}
    >
      {monthUtils.format(month, "MMMM ''yy", locale)}
      <SvgCheveronDown width={18} height={18} style={{ flexShrink: 0 }} />
    </Button>
  );
}

// Previous and next month, round glass buttons above the title
function MonthArrows({ month, monthBounds, onPrevMonth, onNextMonth }) {
  const { t } = useTranslation();
  const prevEnabled = month > monthBounds.start;
  const nextEnabled = month < monthBounds.end;

  return (
    <>
      <Button
        aria-label={t('Previous month')}
        variant="bare"
        isDisabled={!prevEnabled}
        onPress={onPrevMonth}
        style={{ opacity: prevEnabled ? 1 : 0.6 }}
      >
        <SvgArrowThinLeft width={15} height={15} />
      </Button>
      <Button
        aria-label={t('Next month')}
        variant="bare"
        isDisabled={!nextEnabled}
        onPress={onNextMonth}
        style={{ opacity: nextEnabled ? 1 : 0.6 }}
      >
        <SvgArrowThinRight width={15} height={15} />
      </Button>
    </>
  );
}
