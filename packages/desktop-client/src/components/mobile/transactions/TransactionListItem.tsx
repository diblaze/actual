import React from 'react';
import type { CSSProperties } from 'react';
import { mergeProps } from 'react-aria';
import type { ListBoxItemRenderProps } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { SvgSplit } from '@actual-app/components/icons/v0';
import { SvgExclamationSolid } from '@actual-app/components/icons/v1';
import {
  SvgArrowsSynchronize,
  SvgCalendar3,
  SvgCheckCircle1,
  SvgLockClosed,
} from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { isPreviewId } from '@actual-app/core/shared/transactions';
import { integerToCurrency } from '@actual-app/core/shared/util';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type {
  AccountEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import {
  PressResponder,
  useLongPress,
  usePress,
} from '@react-aria/interactions';

import { makeAmountFullStyle } from '#components/budget/util';
import { TransferDirectionIcon } from '#components/common/TransferDirectionIcon';
import { ALL_ACCOUNTS_ID } from '#components/mobile/accounts/AccountsPage';
import { useAccount } from '#hooks/useAccount';
import { useCachedSchedules } from '#hooks/useCachedSchedules';
import { useCategories } from '#hooks/useCategories';
import { useDisplayPayee } from '#hooks/useDisplayPayee';
import { useLocale } from '#hooks/useLocale';
import { usePayee } from '#hooks/usePayee';
import { NotesTagFormatter } from '#notes/NotesTagFormatter';
import { useSelector } from '#redux';

import { formatSignedAmount } from './formatSignedAmount';
import { lookupName, Status } from './TransactionEdit';

// Payee and chip; rows grow for the imported payee and notes lines
export const ROW_HEIGHT = 76;

const getTextStyle = ({
  isPreview,
}: {
  isPreview: boolean;
}): CSSProperties => ({
  ...styles.text,
  fontSize: 16,
  ...(isPreview
    ? {
        fontStyle: 'italic',
        color: theme.pageTextLight,
      }
    : {}),
});

const getScheduleIconStyle = ({ isPreview }: { isPreview: boolean }) => ({
  width: 12,
  height: 12,
  marginRight: 5,
  color: isPreview ? theme.pageTextLight : theme.menuItemText,
});

type TransactionListItemProps = ListBoxItemRenderProps & {
  transaction?: TransactionEntity;
  showRunningBalance?: boolean;
  runningBalance?: IntegerAmount;
  isReconciling?: boolean;
  onPress: (transaction: TransactionEntity) => void;
  onLongPress: (transaction: TransactionEntity) => void;
  onToggleCleared?: (transaction: TransactionEntity) => void;
};

export function TransactionListItem({
  showRunningBalance,
  runningBalance,
  isReconciling = false,
  onPress,
  onLongPress,
  onToggleCleared,
  transaction,
  ...itemProps
}: TransactionListItemProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: { list: categories } = { list: [] } } = useCategories();

  const { data: payee } = usePayee(transaction?.payee);
  const displayPayee = useDisplayPayee({ transaction });

  const account = useAccount(transaction?.account || '');
  // Rows name their account on the all-accounts list only
  const showAccount = useParams().id === ALL_ACCOUNTS_ID;
  const transferAccount = useAccount(payee?.transfer_acct || '');
  const isPreview = isPreviewId(transaction?.id || '');
  const { schedules = [] } = useCachedSchedules();

  const newTransactions = useSelector(
    state => state.transactions.newTransactions,
  );

  const { longPressProps } = useLongPress({
    accessibilityDescription: 'Long press to select multiple transactions',
    onLongPress: () => {
      if (isPreview) {
        return;
      }

      onLongPress(transaction!);
    },
  });

  const { pressProps } = usePress({
    onPress: () => {
      onPress(transaction!);
    },
  });

  if (!transaction) {
    return null;
  }

  const {
    id,
    amount,
    category: categoryId,
    cleared: isCleared,
    reconciled: isReconciled,
    is_parent: isParent,
    is_child: isChild,
    notes,
    forceUpcoming,
    schedule: scheduleId,
  } = transaction;

  const schedule = scheduleId
    ? schedules.find(s => s.id === scheduleId)
    : undefined;
  const displayedNotes = notes || (isPreview ? schedule?.name : undefined);

  const previewStatus = forceUpcoming ? 'upcoming' : categoryId;

  const isAdded = newTransactions.includes(id);
  const categoryName = lookupName(categories, categoryId);
  const specialCategory = account?.offbudget
    ? t('Off budget')
    : transferAccount && !transferAccount.offbudget
      ? t('Transfer')
      : isParent
        ? t('Split')
        : null;

  const prettyCategory = specialCategory || categoryName;
  const textStyle = getTextStyle({ isPreview });
  const rowBackground = itemProps.isSelected
    ? theme.accentSubtleBackground
    : isPreview
      ? theme.tableRowHeaderBackground
      : theme.cardBackground;
  // The bank's own text for the payee, when it says something else
  const importedPayee =
    transaction.imported_payee && transaction.imported_payee !== displayPayee
      ? transaction.imported_payee
      : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
        minHeight: ROW_HEIGHT,
        overflow: 'hidden',
        borderBottom: `1px solid ${theme.tableBorder}`,
        backgroundColor: rowBackground,
      }}
    >
      <PressResponder {...mergeProps(pressProps, longPressProps)}>
        <Button
          {...itemProps}
          style={{
            userSelect: 'none',
            height: '100%',
            flex: 1,
            borderRadius: 0,
            borderWidth: 0,
            ...(isReconciling && { paddingRight: 0 }),
            backgroundColor: rowBackground,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flex: 1,
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: spacing.sm,
              padding: `${spacing.md}px ${isReconciling ? 0 : spacing.xs}px ${spacing.md}px ${spacing.xs}px`,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <PayeeIcons
                  transaction={transaction}
                  transferAccount={transferAccount}
                />
                <TextOneLine
                  style={{
                    ...textStyle,
                    fontWeight: isAdded ? 700 : 600,
                    ...(!displayPayee && !isPreview
                      ? {
                          color: theme.pageTextLight,
                          fontStyle: 'italic',
                        }
                      : {}),
                  }}
                >
                  {displayPayee || t('(No payee)')}
                </TextOneLine>
              </View>
              {isPreview ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    marginTop: spacing.xxs,
                  }}
                >
                  <Status
                    status={previewStatus}
                    isSplit={isParent || isChild}
                  />
                  <Text
                    style={{ ...styles.smallText, color: theme.pageTextLight }}
                  >
                    {monthUtils.format(transaction.date, 'MMM d', locale)}
                  </Text>
                </View>
              ) : (
                <View
                  data-testid="category-chip"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    maxWidth: '100%',
                    gap: spacing.xs,
                    padding: `${spacing.xxs}px ${spacing.sm}px`,
                    borderRadius: 10,
                    fontSize: 14,
                    ...(prettyCategory
                      ? {
                          fontWeight: 500,
                          color: theme.pillText,
                          backgroundColor: theme.pillBackground,
                          fontStyle: specialCategory ? 'italic' : undefined,
                        }
                      : {
                          fontWeight: 600,
                          color: theme.balanceWarningText,
                          backgroundColor: theme.balanceWarningBackground,
                        }),
                  }}
                >
                  {!prettyCategory && (
                    <SvgExclamationSolid
                      aria-hidden
                      style={{ width: 12, height: 12, flexShrink: 0 }}
                    />
                  )}
                  {(isParent || isChild) && (
                    <SvgSplit
                      aria-hidden
                      style={{ width: 12, height: 12, flexShrink: 0 }}
                    />
                  )}
                  <TextOneLine>
                    {prettyCategory || t('Uncategorized')}
                  </TextOneLine>
                </View>
              )}
              {importedPayee && (
                <TextOneLine
                  style={{
                    fontSize: 13,
                    letterSpacing: 0.2,
                    color: theme.pageTextLight,
                    textAlign: 'left',
                  }}
                >
                  {importedPayee}
                </TextOneLine>
              )}
              {displayedNotes && (
                <TextOneLine
                  style={{
                    fontSize: 13,
                    fontWeight: '400',
                    color: theme.tableText,
                    textAlign: 'left',
                  }}
                >
                  <NotesTagFormatter notes={displayedNotes} />
                </TextOneLine>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Text
                  style={{
                    ...styles.tnum,
                    ...makeAmountFullStyle(amount, {
                      positiveColor: theme.tableText,
                      negativeColor: theme.tableText,
                      zeroColor: theme.numberNeutral,
                    }),
                    ...textStyle,
                    fontWeight: 700,
                  }}
                >
                  {formatSignedAmount(amount)}
                </Text>
                {!isPreview &&
                  !isReconciling &&
                  (isReconciled ? (
                    <SvgLockClosed
                      role="img"
                      aria-label={t('Reconciled')}
                      style={{
                        width: 14,
                        height: 14,
                        color: theme.noticeTextLight,
                      }}
                    />
                  ) : (
                    <SvgCheckCircle1
                      {...(isCleared
                        ? { role: 'img', 'aria-label': t('Cleared') }
                        : { 'aria-hidden': true })}
                      style={{
                        width: 14,
                        height: 14,
                        color: isCleared
                          ? theme.noticeTextLight
                          : theme.pageTextSubdued,
                      }}
                    />
                  ))}
              </View>
              {showAccount && account && (
                <TextOneLine
                  style={{ fontSize: 14, color: theme.pageTextLight }}
                >
                  {account.name}
                </TextOneLine>
              )}
              {showRunningBalance && runningBalance !== undefined && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '400',
                    ...styles.tnum,
                    ...makeAmountFullStyle(runningBalance, {
                      positiveColor: theme.numberPositive,
                      negativeColor: theme.numberNegative,
                      zeroColor: theme.numberNeutral,
                    }),
                  }}
                >
                  {integerToCurrency(runningBalance)}
                </Text>
              )}
            </View>
          </View>
        </Button>
      </PressResponder>
      {isReconciling &&
        !isPreview &&
        (isChild ? (
          <View
            style={{
              width: 32,
              flexShrink: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ClearedStatusIcon
              isReconciled={isReconciled}
              isCleared={isCleared}
            />
          </View>
        ) : (
          <Button
            variant="bare"
            aria-label={
              isReconciled
                ? t('Unlock reconciled transaction')
                : isCleared
                  ? t('Unclear transaction')
                  : t('Clear transaction')
            }
            style={{
              width: 32,
              height: '100%',
              flexShrink: 0,
              borderRadius: 0,
            }}
            onPress={() => onToggleCleared?.(transaction)}
          >
            <ClearedStatusIcon
              isReconciled={isReconciled}
              isCleared={isCleared}
            />
          </Button>
        ))}
    </View>
  );
}

type ClearedStatusIconProps = {
  isReconciled?: boolean;
  isCleared?: boolean;
};

function ClearedStatusIcon({
  isReconciled,
  isCleared,
}: ClearedStatusIconProps) {
  return isReconciled ? (
    <SvgLockClosed
      style={{
        width: 13,
        height: 13,
        color: theme.noticeTextLight,
      }}
    />
  ) : (
    <SvgCheckCircle1
      style={{
        width: 13,
        height: 13,
        color: isCleared ? theme.noticeTextLight : theme.pageTextSubdued,
      }}
    />
  );
}

type PayeeIconsProps = {
  transaction: TransactionEntity;
  transferAccount?: AccountEntity;
};

function PayeeIcons({ transaction, transferAccount }: PayeeIconsProps) {
  const { id, schedule: scheduleId } = transaction;
  const { isLoading: isSchedulesLoading, schedules = [] } =
    useCachedSchedules();
  const isPreview = isPreviewId(id);
  const schedule = schedules.find(s => s.id === scheduleId);
  const isScheduleRecurring =
    schedule &&
    schedule._date &&
    typeof schedule._date === 'object' &&
    !!schedule._date.frequency;

  if (isSchedulesLoading) {
    return null;
  }

  return (
    <>
      {schedule &&
        (isScheduleRecurring ? (
          <SvgArrowsSynchronize style={getScheduleIconStyle({ isPreview })} />
        ) : (
          <SvgCalendar3 style={getScheduleIconStyle({ isPreview })} />
        ))}
      {transferAccount && (
        <TransferDirectionIcon
          isDeposit={transaction.amount > 0}
          style={{ width: 12, height: 12, marginRight: 5 }}
        />
      )}
    </>
  );
}
