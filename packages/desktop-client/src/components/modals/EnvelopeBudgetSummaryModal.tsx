import React from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import {
  format as formatMonth,
  prevMonth,
  sheetForMonth,
} from '@actual-app/core/shared/months';

import { ToBudgetAmount } from '#components/budget/envelope/budgetsummary/ToBudgetAmount';
import { TotalsList } from '#components/budget/envelope/budgetsummary/TotalsList';
import { useEnvelopeSheetValue } from '#components/budget/envelope/EnvelopeBudgetComponents';
import { useToBudgetActions } from '#components/budget/envelope/useEnvelopeBudgetActions';
import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { useLocale } from '#hooks/useLocale';
import { SheetNameProvider } from '#hooks/useSheetName';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { envelopeBudget } from '#spreadsheet/bindings';

type EnvelopeBudgetSummaryModalProps = Extract<
  ModalType,
  { name: 'envelope-budget-summary' }
>['options'];

export function EnvelopeBudgetSummaryModal({
  month,
  onBudgetAction,
}: EnvelopeBudgetSummaryModalProps) {
  const { t } = useTranslation();

  const locale = useLocale();
  const prevMonthName = formatMonth(prevMonth(month), 'MMM', locale);
  const sheetValue =
    useEnvelopeSheetValue({
      name: envelopeBudget.toBudget,
      value: 0,
    }) ?? 0;

  const { onOpenToBudgetMenu } = useToBudgetActions(month, onBudgetAction);

  return (
    <Modal name="envelope-budget-summary">
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Budget Summary')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <SheetNameProvider name={sheetForMonth(month)}>
            <TotalsList
              prevMonthName={prevMonthName}
              style={{
                ...styles.mediumText,
              }}
            />
            <ToBudgetAmount
              prevMonthName={prevMonthName}
              style={{
                ...styles.mediumText,
                marginTop: 15,
              }}
              amountStyle={{
                ...styles.underlinedText,
              }}
              onClick={() => onOpenToBudgetMenu(sheetValue)}
              isTotalsListTooltipDisabled
            />
          </SheetNameProvider>
        </>
      )}
    </Modal>
  );
}
