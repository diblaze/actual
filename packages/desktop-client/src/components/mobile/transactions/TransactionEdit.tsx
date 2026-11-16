import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Dialog,
  Heading,
  ToggleButton,
  ToggleButtonGroup,
} from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';
import { useLocation, useParams, useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { SvgSplit } from '@actual-app/components/icons/v0';
import {
  SvgCalendar,
  SvgCheveronDown,
  SvgCheveronRight,
  SvgDotsHorizontalTriple,
  SvgExclamationSolid,
  SvgLocation,
  SvgTag,
  SvgTime,
  SvgTrash,
  SvgUser,
} from '@actual-app/components/icons/v1';
import { SvgNotesPaper } from '@actual-app/components/icons/v2';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { radius, spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { DEFAULT_MAX_DISTANCE_METERS } from '@actual-app/core/shared/constants';
import { calculateDistance } from '@actual-app/core/shared/location-utils';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { DEFAULT_UPCOMING_SCHEDULE_DAYS } from '@actual-app/core/shared/schedules';
import {
  addSplitTransaction,
  deleteTransaction,
  makeEmptySplitSubtransactions,
  realizeTempTransactions,
  splitTransaction,
  ungroupTransactions,
  updateTransaction,
} from '@actual-app/core/shared/transactions';
import {
  amountToInteger,
  applyFindReplace,
  diffItems,
  getChangedValues,
  groupById,
  integerToAmount,
  integerToCurrency,
} from '@actual-app/core/shared/util';
import type {
  AccountEntity,
  CategoryEntity,
  PayeeEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import { css } from '@emotion/css';
import {
  format as formatDate,
  isValid as isValidDate,
  parse as parseDate,
  parseISO,
} from 'date-fns';

import { NoteInsertHashButton } from '#components/autocomplete/NoteInsertHashButton';
import { NoteTagAutocomplete } from '#components/autocomplete/NoteTagAutocomplete';
import {
  FieldLabel,
  InputField,
  TapField,
  ToggleField,
} from '#components/mobile/MobileForms';
import { getPrettyPayee } from '#components/mobile/utils';
import { propagateRuleChangeToSubtransactions } from '#components/transactions/applyRulesToTransaction';
import {
  getClearedFieldNames,
  shouldApplyRuleChange,
  trackClearedField,
} from '#components/transactions/table/utils';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useCommonPayees } from '#hooks/useCommonPayees';
import { useDateFormat } from '#hooks/useDateFormat';
import { useLocalPref } from '#hooks/useLocalPref';
import { useLocationPermission } from '#hooks/useLocationPermission';
import { useNavigate } from '#hooks/useNavigate';
import { useNearbyPayees } from '#hooks/useNearbyPayees';
import { usePayees } from '#hooks/usePayees';
import {
  SingleActiveEditFormProvider,
  useSingleActiveEditForm,
} from '#hooks/useSingleActiveEditForm';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { pushModal } from '#modals/modalsSlice';
import { addNotification } from '#notifications/notificationsSlice';
import { useSavePayeeLocationMutation } from '#payees';
import { locationService } from '#payees/location';
import { aqlQuery } from '#queries/aqlQuery';
import { useDispatch, useSelector } from '#redux';
import { setLastTransaction } from '#transactions/transactionsSlice';
import {
  calculateFutureTransactionInfo,
  createSingleTimeScheduleFromTransaction,
  isFutureTransaction,
} from '#util/schedule-actions';

import { AmountInput } from './AmountInput';
import { SplitAmountInput } from './SplitAmountInput';

function getFieldName(transactionId: TransactionEntity['id'], field: string) {
  return `${field}-${transactionId}`;
}

function serializeTransaction(
  transaction: TransactionEntity,
  dateFormat: string,
) {
  const { date, amount } = transaction;
  return {
    ...transaction,
    date: formatDate(parseISO(date), dateFormat),
    amount: integerToAmount(amount || 0),
  };
}

function deserializeTransaction(
  transaction: TransactionEntity,
  originalTransaction: TransactionEntity | null,
  dateFormat: string,
) {
  const { amount, date: originalDate, ...realTransaction } = transaction;

  const dayMonth = monthUtils.getDayMonthRegex(dateFormat);
  let date: string | null = originalDate;
  if (dayMonth.test(date)) {
    const test = parseDate(
      date,
      monthUtils.getDayMonthFormat(dateFormat),
      new Date(),
    );
    if (isValidDate(test)) {
      date = monthUtils.dayFromDate(test);
    } else {
      date = null;
    }
  } else {
    const test = parseDate(date, dateFormat, new Date());
    // This is a quick sanity check to make sure something invalid
    // like "year 201" was entered
    if (test.getFullYear() > 2000 && isValidDate(test)) {
      date = monthUtils.dayFromDate(test);
    } else {
      date = null;
    }
  }

  if (date == null) {
    date =
      (originalTransaction && originalTransaction.date) ||
      monthUtils.currentDay();
  }

  return { ...realTransaction, date, amount: amountToInteger(amount || 0) };
}

export function lookupName(items: CategoryEntity[], id?: CategoryEntity['id']) {
  if (!id) {
    return null;
  }
  return items.find(item => item.id === id)?.name;
}

const TOUCH_TARGET = 44;

// Positive amounts get an explicit plus so every amount carries a sign
export function formatSignedAmount(amount: number) {
  return (amount > 0 ? '+' : '') + integerToCurrency(amount);
}

const dropdownChevron = (
  <SvgCheveronDown
    width={14}
    height={14}
    style={{ color: theme.pageTextSubdued, marginRight: 8 }}
  />
);

const ROW_HEIGHT = 52;

const rowChevron = (
  <SvgCheveronRight
    width={16}
    height={16}
    style={{ flexShrink: 0, color: theme.tableHeaderText }}
  />
);

// Borderless picker or input filling a FieldRow
const rowFieldClassName = css({
  flex: 1,
  minWidth: 0,
  minHeight: ROW_HEIGHT,
  margin: 0,
  borderWidth: 0,
  borderRadius: 0,
  paddingLeft: 0,
  paddingRight: spacing.md,
  fontSize: 16,
  backgroundColor: 'transparent',
});

const rowInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: ROW_HEIGHT,
  margin: 0,
  borderWidth: 0,
  borderRadius: 0,
  paddingLeft: 0,
  paddingRight: spacing.sm,
  fontSize: 16,
  boxShadow: 'none',
};

// One row of the grouped field card: label on the left, field beside it
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <View
      data-testid="field-row"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: ROW_HEIGHT,
        paddingLeft: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Text
        data-testid="field-label"
        lang={i18n.language}
        style={{
          width: 84,
          flexShrink: 0,
          fontSize: 14,
          lineHeight: 1.25,
          color: theme.tableHeaderText,
          overflowWrap: 'anywhere',
          hyphens: 'auto',
          userSelect: 'none',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function Status({
  status,
  isSplit = false,
}: {
  status?: string;
  isSplit?: boolean;
}) {
  const { t } = useTranslation();

  let color: string;
  let backgroundColor: string;
  let Icon: typeof SvgCalendar;
  let label: string;

  switch (status) {
    case 'missed':
      color = theme.errorText;
      backgroundColor = theme.errorBackground;
      Icon = SvgExclamationSolid;
      label = t('Overdue');
      break;
    case 'due':
      color = theme.warningText;
      backgroundColor = theme.warningBackground;
      Icon = SvgTime;
      label = t('Due');
      break;
    case 'upcoming':
      color = theme.pageText;
      backgroundColor = theme.pillBackgroundLight;
      Icon = SvgCalendar;
      label = t('Upcoming');
      break;
    default:
      return null;
  }

  return (
    <View
      style={{
        ...styles.smallText,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        alignSelf: 'flex-start',
        padding: `${spacing.xxs}px ${spacing.sm}px`,
        borderRadius: radius.pill,
        color,
        backgroundColor,
      }}
    >
      <Icon width={12} height={12} aria-hidden />
      <Text>
        {isSplit ? t('{{status}} (Split)', { status: label }) : label}
      </Text>
    </View>
  );
}

// The sheet's purple header: Cancel, the title and an optional action, then
// whatever the caller puts under them (the amount)
function SheetHeader({
  title,
  onCancel,
  rightContent,
  children,
}: {
  title: string;
  onCancel: () => void;
  rightContent?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View
      data-testid="transaction-sheet-header"
      style={{
        flexShrink: 0,
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.lg}px ${spacing.lg}px`,
        color: theme.mobileHeaderText,
        backgroundColor: theme.mobileHeaderBackground,
      }}
    >
      <View
        aria-hidden
        style={{
          alignSelf: 'center',
          width: 40,
          height: 5,
          borderRadius: radius.pill,
          backgroundColor: theme.mobileHeaderTextSubdued,
        }}
      />
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <Button
          variant="bare"
          onPress={onCancel}
          style={{
            justifySelf: 'start',
            height: TOUCH_TARGET,
            paddingInline: 0,
            fontSize: 17,
            color: theme.mobileHeaderText,
          }}
        >
          <Trans>Cancel</Trans>
        </Button>
        <Heading
          slot="title"
          level={2}
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            textAlign: 'center',
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </Heading>
        <View style={{ justifySelf: 'end' }}>{rightContent}</View>
      </View>
      {children}
    </View>
  );
}

// A transaction is one of these; Transfer means the payee is an account
type TransactionKind = 'expense' | 'income' | 'transfer';

const kindButtonClassName = css({
  height: TOUCH_TARGET,
  border: 0,
  borderRadius: 11,
  fontSize: 15,
  fontWeight: 500,
  color: theme.pageTextLight,
  backgroundColor: 'transparent',
  outline: 'none',
  '&[data-selected]': {
    fontWeight: 600,
    color: theme.pageText,
    backgroundColor: theme.cardBackground,
    boxShadow: theme.cardElevation,
  },
  '&[data-focus-visible]': {
    outline: `2px solid ${theme.pageText}`,
    outlineOffset: 2,
  },
  '&[data-disabled]': { opacity: 0.5 },
});

// Payee row chips share the transaction rows' category chip look
const chipStyle: CSSProperties = {
  padding: `${spacing.xs}px ${spacing.md}px`,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
  color: theme.pillText,
  backgroundColor: theme.pillBackground,
  // Dark pills match the field card; the outline keeps them visible
  border: `1px solid ${theme.pillBorder}`,
};

// The surface the MobileForms fields paint themselves, so they blend in
const fieldCardStyle: CSSProperties = {
  flexShrink: 0,
  overflow: 'hidden',
  borderRadius: radius.card,
  backgroundColor: theme.tableBackground,
  boxShadow: theme.cardElevation,
};

// The editor fills the sheet (or the page, on a deep link) and names itself
// by its header title
const dialogStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
};

const headerAmountTextStyle: CSSProperties = {
  fontSize: 40,
  fontWeight: 800,
  color: theme.mobileHeaderText,
};

type FooterProps = {
  transactions: TransactionEntity[];
  isAdding: boolean;
  onAdd: () => void;
  onAddAndNew: () => void;
  onSave: () => void;
  onSchedule: () => void;
  onSplit: (id: TransactionEntity['id']) => void;
  onAddSplit: (id: TransactionEntity['id']) => void;
  onEmptySplitFound: (id: TransactionEntity['id']) => void;
  editingField?: string;
  isFuture: boolean;
  onEditField: (
    id: TransactionEntity['id'],
    field: 'category' | 'payee' | 'account' | 'date' | 'amount' | 'notes',
  ) => void;
};

function Footer({
  transactions,
  isAdding,
  onAdd,
  onAddAndNew,
  onSave,
  onSchedule,
  onSplit,
  onAddSplit,
  onEmptySplitFound,
  editingField,
  onEditField,
  isFuture,
}: FooterProps) {
  const [transaction, ...childTransactions] = transactions;
  const emptySplitTransaction = childTransactions.find(t => t.amount === 0);
  const splitError =
    transaction.error?.type === 'SplitTransactionError'
      ? transaction.error
      : null;
  const onClickRemainingSplit = () => {
    if (childTransactions.length === 0) {
      onSplit(transaction.id);
    } else {
      if (!emptySplitTransaction) {
        onAddSplit(transaction.id);
      } else {
        onEmptySplitFound?.(emptySplitTransaction.id);
      }
    }
  };
  const buttonStyle = { height: ROW_HEIGHT, flex: 1, fontSize: 16 };
  const isSaveDisabled = !!editingField || !!splitError;

  return (
    <View
      data-testid="transaction-form-footer"
      style={{
        paddingLeft: styles.mobileEditingPadding,
        paddingRight: styles.mobileEditingPadding,
        paddingTop: 10,
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
        backgroundColor: theme.pageBackground,
        borderTopWidth: 1,
        borderColor: theme.tableBorder,
        gap: 8,
      }}
    >
      {isFuture && (
        <Button
          variant="normal"
          style={{ height: TOUCH_TARGET }}
          isDisabled={!!editingField}
          onPress={onSchedule}
        >
          <SvgCalendar width={17} height={17} />
          <Text
            style={{
              ...styles.text,
              marginLeft: 6,
            }}
          >
            <Trans>Schedule</Trans>
          </Text>
        </Button>
      )}
      {splitError && (
        <Button
          variant="normal"
          style={{ height: TOUCH_TARGET }}
          isDisabled={!!editingField}
          onPress={onClickRemainingSplit}
        >
          <SvgSplit width={17} height={17} />
          <Text
            style={{
              ...styles.text,
              ...styles.tnum,
              marginLeft: 6,
            }}
          >
            {!emptySplitTransaction ? (
              <Trans>
                Add new split (
                {{ amount: formatSignedAmount(splitError.difference) }}{' '}
                remaining)
              </Trans>
            ) : (
              <Trans>
                {{ amount: formatSignedAmount(splitError.difference) }}{' '}
                remaining
              </Trans>
            )}
          </Text>
        </Button>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {isAdding ? (
          <>
            {/* Without an account both buttons open the account picker */}
            <Button
              variant="normal"
              style={buttonStyle}
              isDisabled={isSaveDisabled}
              onPress={() =>
                transaction.account
                  ? onAddAndNew()
                  : onEditField(transaction.id, 'account')
              }
            >
              <Trans>Save + new</Trans>
            </Button>
            <Button
              variant="primary"
              style={{ ...buttonStyle, flex: 2, fontWeight: 600 }}
              isDisabled={isSaveDisabled}
              onPress={() =>
                transaction.account
                  ? onAdd()
                  : onEditField(transaction.id, 'account')
              }
            >
              <Trans>Add transaction</Trans>
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            style={{ ...buttonStyle, flex: 2, fontWeight: 600 }}
            isDisabled={isSaveDisabled}
            onPress={() => onSave()}
          >
            <Trans>Save changes</Trans>
          </Button>
        )}
      </View>
    </View>
  );
}

type ChildTransactionEditProps = {
  keyboardHeader: ReactNode;
  transaction: TransactionEntity;
  negate: boolean;
  amountFocused: boolean;
  getCategory: (transaction: TransactionEntity, isOffBudget: boolean) => string;
  getPayee: (transaction: TransactionEntity) => PayeeEntity | undefined;
  getTransferAccount: (
    transaction: TransactionEntity,
  ) => AccountEntity | undefined;
  isOffBudget: boolean;
  isBudgetTransfer: (transaction: TransactionEntity) => boolean;
  onEditField: (
    id: TransactionEntity['id'],
    field: 'category' | 'payee' | 'account' | 'date' | 'amount' | 'notes',
  ) => void;
  onUpdate: <Field extends keyof TransactionEntity>(
    transaction: TransactionEntity,
    field: Field,
    value: TransactionEntity[Field],
  ) => void;
  onDelete: (id: TransactionEntity['id']) => void;
};

const ChildTransactionEdit = forwardRef<
  HTMLDivElement,
  ChildTransactionEditProps
>(
  (
    {
      transaction,
      negate,
      amountFocused,
      getCategory,
      getPayee,
      getTransferAccount,
      isOffBudget,
      isBudgetTransfer,
      onEditField,
      onUpdate,
      onDelete,
      keyboardHeader,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const { editingField, onRequestActiveEdit, onClearActiveEdit } =
      useSingleActiveEditForm()!;
    const noteRef = useRef<HTMLInputElement | null>(null);

    const prettyPayee = getPrettyPayee({
      t,
      transaction,
      payee: getPayee(transaction),
      transferAccount: getTransferAccount(transaction),
    });
    return (
      <View
        innerRef={ref}
        data-testid="split-transaction"
        style={{
          backgroundColor: theme.tableBackground,
          borderColor:
            transaction.amount === 0
              ? theme.tableBorderSelected
              : theme.tableBorder,
          borderWidth: '1px',
          borderRadius: '5px',
          padding: '5px',
          margin: '10px',
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flexBasis: '75%' }}>
            <FieldLabel title={t('Payee')} />
            <TapField
              icon={<SvgUser width={17} height={17} />}
              placeholder={
                transaction.amount > 0
                  ? t('Who paid you?')
                  : t('Who did you pay?')
              }
              rightContent={dropdownChevron}
              isDisabled={
                !!editingField &&
                editingField !== getFieldName(transaction.id, 'payee')
              }
              value={prettyPayee}
              onPress={() => onEditField(transaction.id, 'payee')}
              data-testid={`payee-field-${transaction.id}`}
            />
          </View>
          <View
            style={{
              flexBasis: '25%',
            }}
          >
            <FieldLabel title={t('Amount')} style={{ padding: 0 }} />
            <SplitAmountInput
              keyboardHeader={keyboardHeader}
              disabled={
                !!editingField &&
                editingField !== getFieldName(transaction.id, 'amount')
              }
              value={transaction.amount}
              negate={negate}
              autoFocus={amountFocused}
              onFocus={event => {
                onRequestActiveEdit(getFieldName(transaction.id, 'amount'));

                const input = event.currentTarget as HTMLInputElement;
                input.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onBlur={() => onClearActiveEdit()}
              onChange={amount => {
                onUpdate(transaction, 'amount', amount);
              }}
            />
          </View>
        </View>

        <View>
          <FieldLabel title={t('Category')} />
          <TapField
            icon={<SvgTag width={17} height={17} />}
            placeholder={t('Select a category')}
            rightContent={dropdownChevron}
            textStyle={{
              ...((isOffBudget || isBudgetTransfer(transaction)) && {
                fontStyle: 'italic',
                color: theme.pageTextSubdued,
                fontWeight: 300,
              }),
            }}
            value={getCategory(transaction, isOffBudget)}
            isDisabled={
              (!!editingField &&
                editingField !== getFieldName(transaction.id, 'category')) ||
              isOffBudget ||
              isBudgetTransfer(transaction)
            }
            onPress={() => onEditField(transaction.id, 'category')}
            data-testid={`category-field-${transaction.id}`}
          />
        </View>

        <View>
          <FieldLabel title={t('Notes')} />
          <InputField
            ref={noteRef}
            iconStart={<SvgNotesPaper width={17} height={17} />}
            iconEnd={<NoteInsertHashButton inputRef={noteRef} />}
            placeholder={t('Add a note (optional)')}
            disabled={
              !!editingField &&
              editingField !== getFieldName(transaction.id, 'notes')
            }
            defaultValue={transaction.notes}
            onFocus={() =>
              onRequestActiveEdit(getFieldName(transaction.id, 'notes'))
            }
            onUpdate={value => onUpdate(transaction, 'notes', value)}
          />
          <NoteTagAutocomplete inputRef={noteRef} />
        </View>

        <View style={{ alignItems: 'center' }}>
          <Button
            variant="bare"
            onPress={() => onDelete(transaction.id)}
            style={{
              height: 40,
              borderWidth: 0,
              marginLeft: styles.mobileEditingPadding,
              marginRight: styles.mobileEditingPadding,
              marginTop: 10,
              backgroundColor: 'transparent',
            }}
          >
            <SvgTrash
              width={17}
              height={17}
              style={{ color: theme.errorText }}
            />
            <Text
              style={{
                color: theme.errorText,
                marginLeft: 5,
                userSelect: 'none',
              }}
            >
              <Trans>Delete split</Trans>
            </Text>
          </Button>
        </View>
      </View>
    );
  },
);

ChildTransactionEdit.displayName = 'ChildTransactionEdit';

type TransactionEditInnerProps = {
  isAdding: boolean;
  accounts: AccountEntity[];
  categories: CategoryEntity[];
  payees: PayeeEntity[];
  dateFormat: string;
  transactions: TransactionEntity[];
  onSave: (transactions: TransactionEntity[]) => void;
  onUpdate: <Field extends keyof TransactionEntity>(
    transaction: TransactionEntity,
    field: Field,
    value?: TransactionEntity[Field],
  ) => void;
  onDelete: (id: TransactionEntity['id']) => void;
  onSplit: (id: TransactionEntity['id']) => void;
  onAddSplit: (id: TransactionEntity['id']) => void;
  onReset: () => void;
  shouldShowSaveLocation?: boolean;
  onSaveLocation?: () => void;
  onSelectNearestPayee?: () => void;
  onRequestLocation?: () => void;
  nearestPayee?: PayeeEntity | null;
  ruleCategory?: RuleCategory | null;
};

// The category a payee's rule filled in, for the "from <payee>" hint
type RuleCategory = {
  id: TransactionEntity['id'];
  category: TransactionEntity['category'];
};

const TransactionEditInner = memo<TransactionEditInnerProps>(
  function TransactionEditInner({
    isAdding,
    accounts,
    categories,
    payees,
    dateFormat,
    transactions: unserializedTransactions,
    onSave,
    onUpdate,
    onDelete,
    onSplit,
    onAddSplit,
    onReset,
    shouldShowSaveLocation,
    onSaveLocation,
    onSelectNearestPayee,
    onRequestLocation,
    nearestPayee,
    ruleCategory,
  }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [showHiddenCategories] = useLocalPref('budget.showHiddenCategories');
    const [upcomingLength = DEFAULT_UPCOMING_SCHEDULE_DAYS] = useSyncedPref(
      'upcomingScheduledTransactionLength',
    );
    const transactions = useMemo(
      () =>
        unserializedTransactions.map(t =>
          serializeTransaction(t, dateFormat),
        ) || [],
      [unserializedTransactions, dateFormat],
    );
    const { data: { grouped: categoryGroups } = { grouped: [] } } =
      useCategories();
    const { data: commonPayees = [] } = useCommonPayees();
    const noteRef = useRef<HTMLInputElement | null>(null);
    const menuTriggerRef = useRef<HTMLButtonElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [moneyIn, setMoneyIn] = useState(
      (unserializedTransactions[0]?.amount ?? 0) > 0,
    );
    // Transfer picked, account not chosen yet
    const [wantsTransfer, setWantsTransfer] = useState(false);

    useEffect(() => {
      if (window.history.length === 1) {
        window.history.replaceState(null, 'Actual Budget', '/');
        window.history.pushState(null, 'Add Transaction', '/transactions/new');
      }
    }, []);

    const [transaction, ...childTransactions] = transactions;

    const isFuture =
      unserializedTransactions.length > 0 &&
      isFutureTransaction(unserializedTransactions[0]);

    const { editingField, onRequestActiveEdit, onClearActiveEdit } =
      useSingleActiveEditForm()!;
    const childTransactionElementRefMap = useRef<
      Record<TransactionEntity['id'], HTMLDivElement | null>
    >({});
    const hasAccountChanged = useRef(false);

    const payeesById = useMemo(() => groupById(payees), [payees]);
    const accountsById = useMemo(() => groupById(accounts), [accounts]);

    const getAccount = useCallback(
      (trans: TransactionEntity) => {
        return trans?.account ? accountsById?.[trans.account] : undefined;
      },
      [accountsById],
    );

    const getPayee = useCallback(
      (trans: TransactionEntity) => {
        return trans?.payee ? payeesById?.[trans.payee] : undefined;
      },
      [payeesById],
    );

    const getTransferAccount = useCallback(
      (trans: TransactionEntity) => {
        const payee = trans ? getPayee(trans) : null;
        return payee && payee?.transfer_acct
          ? accountsById?.[payee.transfer_acct]
          : undefined;
      },
      [accountsById, getPayee],
    );

    const isBudgetTransfer = useCallback(
      (trans: TransactionEntity) => {
        const transferAcct = trans ? getTransferAccount(trans) : null;
        return transferAcct ? !transferAcct.offbudget : false;
      },
      [getTransferAccount],
    );

    const getCategory = useCallback(
      (trans: TransactionEntity, isOffBudget: boolean) => {
        if (isOffBudget) {
          return t('Off budget');
        } else if (isBudgetTransfer(trans)) {
          return t('Transfer');
        } else {
          return lookupName(categories, trans.category) ?? '';
        }
      },
      [categories, isBudgetTransfer, t],
    );

    const onSaveInner = useCallback(
      async (andNew = false) => {
        const onConfirmSave = () => {
          let transactionsToSave = unserializedTransactions;
          if (isAdding) {
            transactionsToSave = realizeTempTransactions(
              unserializedTransactions,
            );
          }

          onSave(transactionsToSave);
          if (andNew) {
            onReset();
          } else {
            void navigate(-1);
          }
        };

        if (unserializedTransactions.some(t => t.reconciled)) {
          // On mobile any save gives the warning.
          // On the web only certain changes trigger a warning.
          // Should we bring that here as well? Or does the nature of the editing form
          // make this more appropriate?
          dispatch(
            pushModal({
              modal: {
                name: 'confirm-transaction-edit',
                options: {
                  onConfirm: onConfirmSave,
                  confirmReason: 'editReconciled',
                },
              },
            }),
          );
        } else {
          const transferIds = unserializedTransactions
            .map(t => t.transfer_id)
            .filter((id): id is string => id != null);

          if (transferIds.length > 0) {
            const { data } = await aqlQuery(
              q('transactions')
                .filter({
                  id: { $oneof: transferIds },
                  reconciled: true,
                })
                .select('id'),
            );
            if ((data as TransactionEntity[]).length > 0) {
              dispatch(
                pushModal({
                  modal: {
                    name: 'confirm-transaction-edit',
                    options: {
                      onConfirm: onConfirmSave,
                      confirmReason: 'batchEditWithReconciledTransfer',
                    },
                  },
                }),
              );
            } else {
              onConfirmSave();
            }
          } else {
            onConfirmSave();
          }
        }
      },
      [isAdding, dispatch, navigate, onSave, onReset, unserializedTransactions],
    );

    const onSchedule = useCallback(async () => {
      const [unserializedTransaction] = unserializedTransactions;

      if (!unserializedTransaction.account) {
        dispatch(
          addNotification({
            notification: {
              type: 'error',
              message: t('Account is a required field'),
            },
          }),
        );
        return;
      }

      // Already linked to a schedule; keep it as a transaction.
      if (unserializedTransaction.schedule) {
        return;
      }

      const transactionForSchedule = unserializedTransaction.is_parent
        ? {
            ...unserializedTransaction,
            subtransactions: unserializedTransactions.filter(
              t => t.is_child && t.parent_id === unserializedTransaction.id,
            ),
          }
        : unserializedTransaction;

      const createSchedule = async () => {
        try {
          await createSingleTimeScheduleFromTransaction(transactionForSchedule);
        } catch {
          dispatch(
            addNotification({
              notification: {
                type: 'error',
                message: t('Failed to create schedule'),
              },
            }),
          );
          return;
        }

        try {
          if (
            !isAdding &&
            unserializedTransaction.id &&
            !unserializedTransaction.id.startsWith('temp')
          ) {
            await send('transaction-delete', {
              id: unserializedTransaction.id,
            });
          }
        } catch {
          dispatch(
            addNotification({
              notification: {
                type: 'error',
                message: t(
                  'Schedule created, but the original transaction could not be deleted',
                ),
              },
            }),
          );
          void navigate(-1);
          return;
        }

        dispatch(
          addNotification({
            notification: {
              type: 'message',
              message: t('Schedule created successfully'),
            },
          }),
        );
        void navigate(-1);
      };

      const { isBeyondWindow, daysUntilTransaction, upcomingDays } =
        calculateFutureTransactionInfo(transactionForSchedule, upcomingLength);

      if (isBeyondWindow) {
        dispatch(
          pushModal({
            modal: {
              name: 'convert-to-schedule',
              options: {
                daysUntilTransaction,
                upcomingDays,
                onConfirm: createSchedule,
              },
            },
          }),
        );
      } else {
        await createSchedule();
      }
    }, [
      isAdding,
      dispatch,
      navigate,
      unserializedTransactions,
      upcomingLength,
      t,
    ]);

    const onUpdateInner = useCallback(
      async <Field extends keyof TransactionEntity>(
        serializedTransaction: TransactionEntity,
        name: Field,
        value: TransactionEntity[Field],
      ) => {
        const newTransaction = { ...serializedTransaction, [name]: value };
        onUpdate(newTransaction, name);
        onClearActiveEdit();

        if (name === 'account') {
          hasAccountChanged.current = serializedTransaction.account !== value;
        }
      },
      [onClearActiveEdit, onUpdate],
    );

    const onUnlockReconciledInner = useCallback(
      (serializedTransaction: TransactionEntity) => {
        dispatch(
          pushModal({
            modal: {
              name: 'confirm-transaction-edit',
              options: {
                confirmReason: 'unlockReconciled',
                onConfirm: () => {
                  void onUpdateInner(
                    serializedTransaction,
                    'reconciled',
                    false,
                  );
                },
              },
            },
          }),
        );
      },
      [dispatch, onUpdateInner],
    );

    const onTotalAmountUpdate = useCallback(
      (value: number) => {
        if (transaction.amount !== value) {
          void onUpdateInner(transaction, 'amount', value);
        }
      },
      [onUpdateInner, transaction],
    );

    const onEditFieldInner = useCallback(
      (
        transactionId: TransactionEntity['id'],
        name: 'category' | 'payee' | 'account' | 'date' | 'amount' | 'notes',
        // Payee picker lists accounts only (a transfer)
        transferOnly = false,
      ) => {
        onRequestActiveEdit?.(getFieldName(transaction.id, name), () => {
          const transactionToEdit = transactions.find(
            t => t.id === transactionId,
          );
          const unserializedTransaction = unserializedTransactions.find(
            t => t.id === transactionId,
          );

          if (!unserializedTransaction || !transactionToEdit) {
            throw new Error(`Transaction ${transactionId} not found`);
          }

          switch (name) {
            case 'category':
              dispatch(
                pushModal({
                  modal: {
                    name: 'category-autocomplete',
                    options: {
                      categoryGroups,
                      showHiddenCategories,
                      showNoneOption: true,
                      month: monthUtils.monthFromDate(
                        unserializedTransaction.date,
                      ),
                      onSelect: categoryId => {
                        void onUpdateInner(
                          transactionToEdit,
                          name,
                          categoryId as TransactionEntity['category'],
                        );
                      },
                      onClose: () => {
                        onClearActiveEdit();
                      },
                    },
                  },
                }),
              );
              break;
            case 'account':
              dispatch(
                pushModal({
                  modal: {
                    name: 'account-autocomplete',
                    options: {
                      onSelect: accountId => {
                        void onUpdateInner(transactionToEdit, name, accountId);
                      },
                      onClose: () => {
                        onClearActiveEdit();
                      },
                    },
                  },
                }),
              );
              break;
            case 'payee':
              dispatch(
                pushModal({
                  modal: {
                    name: 'payee-autocomplete',
                    options: {
                      showNoneOption: !!transactionToEdit.payee,
                      transferOnly,
                      onSelect: payeeId => {
                        void onUpdateInner(transactionToEdit, name, payeeId);
                      },
                      onClose: () => {
                        // A chosen account now makes it a transfer; closed
                        // without one, the type goes back to what it was
                        if (transferOnly) {
                          setWantsTransfer(false);
                        }
                        onClearActiveEdit();
                      },
                    },
                  },
                }),
              );
              break;
            default:
              dispatch(
                pushModal({
                  modal: {
                    name: 'edit-field',
                    options: {
                      name,
                      onSubmit: (name, value) => {
                        if (typeof value === 'object' && 'useRegex' in value) {
                          void onUpdateInner(
                            transactionToEdit,
                            name,
                            applyFindReplace(
                              transactionToEdit.notes,
                              value.find,
                              value.replace,
                              value.useRegex,
                            ),
                          );
                        } else {
                          void onUpdateInner(transactionToEdit, name, value);
                        }
                      },
                      onClose: () => {
                        onClearActiveEdit();
                      },
                    },
                  },
                }),
              );
              break;
          }
        });
      },
      [
        categoryGroups,
        dispatch,
        onUpdateInner,
        onClearActiveEdit,
        onRequestActiveEdit,
        transaction.id,
        transactions,
        unserializedTransactions,
        showHiddenCategories,
      ],
    );

    const onDeleteInner = useCallback(
      async (id: TransactionEntity['id']) => {
        const [parentTransaction] = unserializedTransactions;
        const targetTransaction =
          unserializedTransactions.find(t => t.id === id) ?? parentTransaction;

        const onConfirmDelete = () => {
          dispatch(
            pushModal({
              modal: {
                name: 'confirm-delete',
                options: {
                  message: t(
                    'Are you sure you want to delete the transaction?',
                  ),
                  onConfirm: () => {
                    onDelete(id);

                    if (parentTransaction.id !== id) {
                      // Only a child transaction was deleted.
                      onClearActiveEdit();
                      return;
                    }

                    void navigate(-1);
                  },
                },
              },
            }),
          );
        };

        if (targetTransaction.reconciled) {
          dispatch(
            pushModal({
              modal: {
                name: 'confirm-transaction-edit',
                options: {
                  onConfirm: onConfirmDelete,
                  confirmReason: 'deleteReconciled',
                },
              },
            }),
          );
        } else if (targetTransaction.transfer_id) {
          const { data } = await aqlQuery(
            q('transactions')
              .filter({
                id: targetTransaction.transfer_id,
                reconciled: true,
              })
              .select('id'),
          );
          if ((data as TransactionEntity[]).length > 0) {
            dispatch(
              pushModal({
                modal: {
                  name: 'confirm-transaction-edit',
                  options: {
                    onConfirm: onConfirmDelete,
                    confirmReason: 'batchDeleteWithReconciledTransfer',
                  },
                },
              }),
            );
          } else {
            onConfirmDelete();
          }
        } else {
          onConfirmDelete();
        }
      },
      [
        dispatch,
        navigate,
        onClearActiveEdit,
        onDelete,
        unserializedTransactions,
        t,
      ],
    );

    const scrollChildTransactionIntoView = useCallback(
      (id: TransactionEntity['id']) => {
        const childTransactionEditElement =
          childTransactionElementRefMap.current?.[id];
        childTransactionEditElement?.scrollIntoView({
          behavior: 'smooth',
        });
      },
      [],
    );

    const onEmptySplitFound = useCallback(
      (id: TransactionEntity['id']) => {
        scrollChildTransactionIntoView(id);
      },
      [scrollChildTransactionIntoView],
    );

    const account = getAccount(transaction);
    const isOffBudget = account ? !!account.offbudget : false;
    const title = getPrettyPayee({
      t,
      transaction,
      payee: getPayee(transaction),
      transferAccount: getTransferAccount(transaction),
    });

    const transactionDate = parseDate(transaction.date, dateFormat, new Date());
    const dateDefaultValue = monthUtils.dayFromDate(transactionDate);

    // One compact location action in the payee row, by priority
    const locationAction = shouldShowSaveLocation
      ? {
          label: t('Save location'),
          onPress: onSaveLocation,
          color: theme.pageTextSubdued,
        }
      : nearestPayee && !transaction.payee
        ? {
            label: t('Nearby'),
            onPress: onSelectNearestPayee,
            color: theme.pageTextPositive,
          }
        : onRequestLocation && !transaction.payee
          ? {
              label: t('Request Location'),
              onPress: onRequestLocation,
              color: theme.pageTextSubdued,
            }
          : null;

    // The payee's rule filled the category in and it is still unchanged
    const rulePayee = getPayee(transaction);
    const categoryHint =
      ruleCategory &&
      ruleCategory.id === transaction.id &&
      ruleCategory.category === transaction.category &&
      rulePayee &&
      !rulePayee.transfer_acct
        ? t('from {{payee}}', { payee: rulePayee.name })
        : null;

    const remaining = transaction.error?.difference ?? 0;

    // A zero amount has no sign, so the chosen direction is kept separately
    const isMoneyIn =
      transaction.amount !== 0 ? transaction.amount > 0 : moneyIn;
    const isTransfer = !!getTransferAccount(transaction) || wantsTransfer;
    const kind: TransactionKind = isTransfer
      ? 'transfer'
      : isMoneyIn
        ? 'income'
        : 'expense';
    const onPickKind = (next: TransactionKind) => {
      if (next === 'transfer') {
        // The account is the payee, so choose it right away
        setWantsTransfer(true);
        onEditFieldInner(transaction.id, 'payee', true);
        return;
      }
      setWantsTransfer(false);
      if (getTransferAccount(transaction)) {
        void onUpdateInner(transaction, 'payee', null);
      }
      const toMoneyIn = next === 'income';
      setMoneyIn(toMoneyIn);
      if (transaction.amount !== 0 && toMoneyIn !== transaction.amount > 0) {
        onTotalAmountUpdate(-transaction.amount);
      }
    };

    return (
      <Dialog style={dialogStyle}>
        <View data-testid="transaction-form" style={{ flex: 1, minHeight: 0 }}>
          <SheetHeader
            title={isAdding ? t('New Transaction') : t('Transaction')}
            onCancel={() => navigate(-1)}
            rightContent={
              !isAdding && (
                <>
                  <Button
                    ref={menuTriggerRef}
                    variant="bare"
                    aria-label={t('More actions')}
                    style={{
                      width: TOUCH_TARGET,
                      height: TOUCH_TARGET,
                      color: theme.mobileHeaderText,
                    }}
                    onPress={() => setIsMenuOpen(true)}
                  >
                    <SvgDotsHorizontalTriple width={18} height={18} />
                  </Button>
                  <Popover
                    triggerRef={menuTriggerRef}
                    isOpen={isMenuOpen}
                    onOpenChange={() => setIsMenuOpen(false)}
                    placement="bottom end"
                  >
                    <Menu
                      getItemStyle={() => ({
                        ...styles.mobileMenuItem,
                        height: TOUCH_TARGET,
                        color: theme.errorText,
                      })}
                      onMenuSelect={name => {
                        setIsMenuOpen(false);
                        if (name === 'delete') {
                          void onDeleteInner(transaction.id);
                        }
                      }}
                      items={[{ name: 'delete', text: t('Delete') }]}
                    />
                  </Popover>
                </>
              )
            }
          >
            <View
              role="group"
              aria-label={t('Amount')}
              style={{ alignItems: 'center', gap: spacing.xs }}
            >
              <Text
                aria-hidden
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: theme.mobileHeaderTextSubdued,
                }}
              >
                <Trans>Amount</Trans>
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'stretch',
                  gap: spacing.xs,
                }}
              >
                <Text aria-hidden style={headerAmountTextStyle}>
                  {isMoneyIn ? '+' : '−'}
                </Text>
                <AmountInput
                  value={transaction.amount}
                  negate={!isMoneyIn}
                  hideSignToggle
                  disabled={
                    !!editingField &&
                    editingField !== getFieldName(transaction.id, 'amount')
                  }
                  autoFocus={isAdding}
                  disableNativeAutoFocusOnIOS
                  onFocus={() => {
                    onRequestActiveEdit(getFieldName(transaction.id, 'amount'));
                  }}
                  onBlur={() => onClearActiveEdit()}
                  onChange={onTotalAmountUpdate}
                  variant="large"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: theme.mobileHeaderTextSubdued,
                  }}
                  textStyle={headerAmountTextStyle}
                />
              </View>
            </View>
          </SheetHeader>

          <View style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <View
              style={{
                flexShrink: 0,
                gap: spacing.md,
                padding: `${spacing.lg}px ${spacing.md}px ${spacing.xl}px`,
              }}
            >
              {/* The type sets the amount's sign; Transfer picks an account */}
              <ToggleButtonGroup
                aria-label={t('Type')}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[kind]}
                onSelectionChange={keys => {
                  const [next] = [...keys];
                  if (next) {
                    onPickKind(next as TransactionKind);
                  }
                }}
                isDisabled={
                  !!editingField &&
                  editingField !== getFieldName(transaction.id, 'amount')
                }
                style={{
                  flexShrink: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  padding: spacing.xs,
                  borderRadius: 14,
                  backgroundColor: theme.pillBackground,
                }}
              >
                <ToggleButton id="expense" className={kindButtonClassName}>
                  <Trans>Expense</Trans>
                </ToggleButton>
                <ToggleButton id="income" className={kindButtonClassName}>
                  <Trans>Income</Trans>
                </ToggleButton>
                <ToggleButton id="transfer" className={kindButtonClassName}>
                  <Trans>Transfer</Trans>
                </ToggleButton>
              </ToggleButtonGroup>

              <View
                data-testid="field-card"
                style={{
                  ...fieldCardStyle,
                  // Doubled class: each row's own class would win otherwise
                  '&& > * + *': { borderTop: `1px solid ${theme.tableBorder}` },
                }}
              >
                <FieldRow label={t('Payee')}>
                  <TapField
                    className={rowFieldClassName}
                    placeholder={
                      transaction.amount > 0
                        ? t('Who paid you?')
                        : t('Who did you pay?')
                    }
                    textStyle={{
                      ...(transaction.is_parent && {
                        fontStyle: 'italic',
                        fontWeight: 300,
                      }),
                    }}
                    value={title}
                    isDisabled={
                      !!editingField &&
                      editingField !== getFieldName(transaction.id, 'payee')
                    }
                    onPress={() =>
                      onEditFieldInner(
                        transaction.id,
                        'payee',
                        kind === 'transfer',
                      )
                    }
                    data-testid="payee-field"
                    rightContent={rowChevron}
                  />
                  {locationAction && (
                    <Button
                      variant="bare"
                      aria-label={locationAction.label}
                      onPress={locationAction.onPress}
                      style={{
                        width: TOUCH_TARGET,
                        height: TOUCH_TARGET,
                        flexShrink: 0,
                        marginRight: spacing.xs,
                        color: locationAction.color,
                      }}
                    >
                      <SvgLocation width={18} height={18} />
                    </Button>
                  )}
                </FieldRow>

                {isAdding && commonPayees.length > 0 && (
                  <View
                    role="group"
                    aria-label={t('Recent payees')}
                    style={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                      overflowX: 'auto',
                      padding: spacing.sm,
                      paddingLeft: spacing.md,
                    }}
                  >
                    {commonPayees.slice(0, 5).map(payee => (
                      <Button
                        key={payee.id}
                        variant="bare"
                        isDisabled={!!editingField}
                        onPress={() => {
                          setWantsTransfer(false);
                          void onUpdateInner(transaction, 'payee', payee.id);
                        }}
                        style={{
                          ...chipStyle,
                          flexShrink: 0,
                          height: TOUCH_TARGET,
                          ...(transaction.payee === payee.id && {
                            backgroundColor: theme.pillBackgroundSelected,
                            color: theme.pillTextSelected,
                          }),
                        }}
                      >
                        {payee.name}
                      </Button>
                    ))}
                  </View>
                )}

                {!transaction.is_parent && (
                  <FieldRow label={t('Category')}>
                    <TapField
                      className={rowFieldClassName}
                      placeholder={t('Select a category')}
                      rightContent={
                        <>
                          {categoryHint && (
                            <Text
                              data-testid="category-hint"
                              style={{
                                ...styles.smallText,
                                flexShrink: 0,
                                marginInline: spacing.xs,
                                padding: `${spacing.xxs}px ${spacing.sm}px`,
                                borderRadius: radius.pill,
                                color: theme.pillText,
                                backgroundColor: theme.pillBackgroundLight,
                              }}
                            >
                              {categoryHint}
                            </Text>
                          )}
                          {rowChevron}
                        </>
                      }
                      textStyle={{
                        ...((isOffBudget || isBudgetTransfer(transaction)) && {
                          fontStyle: 'italic',
                          color: theme.pageTextSubdued,
                          fontWeight: 300,
                        }),
                      }}
                      value={getCategory(transaction, isOffBudget)}
                      isDisabled={
                        (!!editingField &&
                          editingField !==
                            getFieldName(transaction.id, 'category')) ||
                        isOffBudget ||
                        isBudgetTransfer(transaction)
                      }
                      onPress={() =>
                        onEditFieldInner(transaction.id, 'category')
                      }
                      data-testid="category-field"
                    />
                  </FieldRow>
                )}

                <FieldRow label={t('Account')}>
                  <TapField
                    className={rowFieldClassName}
                    placeholder={t('Select an account')}
                    rightContent={rowChevron}
                    isDisabled={
                      !!editingField &&
                      editingField !== getFieldName(transaction.id, 'account')
                    }
                    value={account?.name}
                    onPress={() => onEditFieldInner(transaction.id, 'account')}
                    data-testid="account-field"
                  />
                </FieldRow>

                <FieldRow label={t('Date')}>
                  <InputField
                    type="date"
                    className={rowFieldClassName}
                    disabled={
                      !!editingField &&
                      editingField !== getFieldName(transaction.id, 'date')
                    }
                    required
                    style={{
                      ...rowInputStyle,
                      appearance: 'none',
                    }}
                    defaultValue={dateDefaultValue}
                    onBlur={() => onClearActiveEdit()}
                    onFocus={() =>
                      onRequestActiveEdit(getFieldName(transaction.id, 'date'))
                    }
                    onChange={event =>
                      onUpdateInner(
                        transaction,
                        'date',
                        formatDate(parseISO(event.target.value), dateFormat),
                      )
                    }
                  />
                </FieldRow>
              </View>

              <View
                data-testid="field-card"
                style={{
                  ...fieldCardStyle,
                  '&& > * + *': { borderTop: `1px solid ${theme.tableBorder}` },
                }}
              >
                <View>
                  <FieldRow label={t('Notes')}>
                    <InputField
                      ref={noteRef}
                      className={rowFieldClassName}
                      placeholder={t('Add a note (optional)')}
                      disabled={
                        !!editingField &&
                        editingField !== getFieldName(transaction.id, 'notes')
                      }
                      style={rowInputStyle}
                      defaultValue={transaction.notes}
                      onFocus={() => {
                        onRequestActiveEdit(
                          getFieldName(transaction.id, 'notes'),
                        );
                      }}
                      onBlur={() => onClearActiveEdit()}
                      onChange={event =>
                        onUpdateInner(transaction, 'notes', event.target.value)
                      }
                    />
                    <View style={{ marginRight: spacing.sm }}>
                      <NoteInsertHashButton inputRef={noteRef} />
                    </View>
                  </FieldRow>
                  {/* Tag suggestions span the card under the notes row */}
                  <NoteTagAutocomplete inputRef={noteRef} />
                </View>

                {transaction.reconciled ? (
                  <FieldRow label={t('Reconciled')}>
                    <View style={{ flex: 1 }} />
                    <ToggleField
                      id="reconciled"
                      aria-label={t('Reconciled')}
                      isOn
                      style={{ marginRight: spacing.md }}
                      onToggle={() => onUnlockReconciledInner(transaction)}
                    />
                  </FieldRow>
                ) : (
                  <FieldRow label={t('Cleared')}>
                    <View style={{ flex: 1 }} />
                    <ToggleField
                      id="cleared"
                      aria-label={t('Cleared')}
                      isOn={!!transaction.cleared}
                      style={{ marginRight: spacing.md }}
                      onToggle={on => onUpdateInner(transaction, 'cleared', on)}
                    />
                  </FieldRow>
                )}
              </View>

              {transaction.amount !== 0 && childTransactions.length === 0 && (
                <Button
                  variant="normal"
                  isDisabled={!!editingField}
                  style={{ height: 48, borderRadius: 12, gap: spacing.sm }}
                  onPress={() => onSplit(transaction.id)}
                >
                  <SvgSplit width={17} height={17} />
                  <Trans>Split</Trans>
                </Button>
              )}

              {childTransactions.length > 0 && (
                <View style={{ marginInline: -spacing.md }}>
                  {childTransactions.map((childTrans, i, arr) => (
                    <ChildTransactionEdit
                      key={childTrans.id}
                      transaction={childTrans}
                      negate={transaction.amount <= 0}
                      amountFocused={arr.findIndex(c => c.amount === 0) === i}
                      ref={r => {
                        childTransactionElementRefMap.current = {
                          ...childTransactionElementRefMap.current,
                          [childTrans.id]: r,
                        };
                      }}
                      isOffBudget={isOffBudget}
                      getCategory={getCategory}
                      getPayee={getPayee}
                      getTransferAccount={getTransferAccount}
                      isBudgetTransfer={isBudgetTransfer}
                      onUpdate={onUpdateInner}
                      onEditField={onEditFieldInner}
                      onDelete={onDeleteInner}
                      keyboardHeader={
                        <FillRemainingButton
                          remaining={remaining}
                          onPress={() => {
                            void onUpdateInner(
                              childTrans,
                              'amount',
                              integerToAmount(remaining),
                            );
                          }}
                        />
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
        <Footer
          transactions={transactions}
          isAdding={isAdding}
          onAdd={onSaveInner}
          onAddAndNew={() => onSaveInner(true)}
          onSave={onSaveInner}
          onSchedule={onSchedule}
          onSplit={onSplit}
          onAddSplit={onAddSplit}
          onEmptySplitFound={onEmptySplitFound}
          editingField={editingField}
          isFuture={isFuture}
          onEditField={onEditFieldInner}
        />
      </Dialog>
    );
  },
);

function isTemporary(transaction: TransactionEntity) {
  return transaction.id.indexOf('temp') === 0;
}

type TransactionEditUnconnectedProps = {
  categories: CategoryEntity[];
  accounts: AccountEntity[];
  payees: PayeeEntity[];
  lastTransaction: TransactionEntity | null;
  dateFormat: string;
};

function TransactionEditUnconnected({
  categories,
  accounts,
  payees,
  lastTransaction,
  dateFormat,
}: TransactionEditUnconnectedProps) {
  const { t } = useTranslation();
  const { transactionId } = useParams();
  const { state: locationState } = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const updatePayeeLocationMutation = useSavePayeeLocationMutation();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<TransactionEntity[]>([]);
  const [fetchedTransactions, setFetchedTransactions] = useState<
    TransactionEntity[]
  >([]);
  const isAdding = useRef(false);
  const isDeleted = useRef(false);
  // Bumped by "Save + new" to remount the form with empty fields
  const [formKey, setFormKey] = useState(0);
  // After "Save + new" the form is already set up; the save landing later
  // (setLastTransaction) must not re-run the URL setup over what was typed
  const wasReset = useRef(false);

  const searchParamCategory = useMemo(
    () => categories.find(c => c.name === searchParams.get('category'))?.id,
    [categories, searchParams],
  );
  const searchParamAccount = useMemo(
    () => accounts.find(a => a.name === searchParams.get('account'))?.id,
    [accounts, searchParams],
  );
  const searchParamPayee = useMemo(
    () => payees.find(p => p.name === searchParams.get('payee'))?.id,
    [payees, searchParams],
  );

  const {
    isGranted: isLocationGranted,
    isPending: shouldPromptLocation,
    requestPermission,
  } = useLocationPermission();
  const { data: nearbyPayees = [] } = useNearbyPayees({
    enabled: isLocationGranted,
  });
  const [shouldShowSaveLocation, setShouldShowSaveLocation] = useState(false);
  const [ruleCategory, setRuleCategory] = useState<RuleCategory | null>(null);
  const nearestPayee = nearbyPayees[0]?.payee ?? null;

  useEffect(() => {
    let unmounted = false;

    async function fetchTransaction() {
      // Query for the transaction based on the ID with grouped splits.
      //
      // This means if the transaction in question is a split transaction, its
      // subtransactions will be returned in the `substransactions` property on
      // the parent transaction.
      //
      // The edit item components expect to work with a flat array of
      // transactions when handling splits, so we call ungroupTransactions to
      // flatten parent and children into one array.
      const { data } = await aqlQuery(
        q('transactions')
          .filter({ id: transactionId })
          .select('*')
          .options({ splits: 'grouped' }),
      );

      if (!unmounted) {
        const fetchedTransactions = ungroupTransactions(data);
        setTransactions(fetchedTransactions);
        setFetchedTransactions(fetchedTransactions);
      }
    }
    if (transactionId !== 'new') {
      void fetchTransaction();
    } else {
      isAdding.current = true;
    }

    return () => {
      unmounted = true;
    };
  }, [transactionId]);

  useEffect(() => {
    if (!isLocationGranted) {
      setShouldShowSaveLocation(false);
    }
  }, [isLocationGranted]);

  useEffect(() => {
    if (isAdding.current && !wasReset.current) {
      setTransactions([
        {
          id: 'temp',
          date: (() => {
            const dateParam = searchParams.get('date') || '';
            if (!isNaN(Date.parse(dateParam))) {
              return dateParam;
            }
            return lastTransaction?.date || monthUtils.currentDay();
          })(),
          payee: searchParamPayee,
          account:
            searchParamAccount ||
            locationState?.accountId ||
            lastTransaction?.account ||
            null,
          category: searchParamCategory || locationState?.categoryId || null,
          amount: -amountToInteger(
            parseFloat(searchParams.get('amount') || '') || 0,
          ),
          cleared: searchParams.get('cleared') === 'true',
          notes: searchParams.get('notes') || '',
        },
      ]);
    }
  }, [
    locationState?.accountId,
    locationState?.categoryId,
    lastTransaction,
    searchParamAccount,
    searchParamCategory,
    searchParamPayee,
    searchParams,
  ]);

  // Fields the user explicitly emptied while entering the new transaction,
  // tracked per transaction row so a clear on one split row doesn't affect
  // its siblings. Rules re-run on every field commit, and they may not
  // re-fill these (e.g. a cleared pre-assigned category must stay cleared).
  const clearedFields = useRef(new Map<TransactionEntity['id'], Set<string>>());

  const onUpdate = useCallback(
    async (
      serializedTransaction: TransactionEntity,
      updatedField: keyof TransactionEntity,
    ) => {
      const transaction = deserializeTransaction(
        serializedTransaction,
        null,
        dateFormat,
      );

      // Run the rules to auto-fill in any data. Right now we only do
      // this on new transactions because that's how desktop works.
      const newTransaction = { ...transaction };
      const changedFields = new Set<keyof TransactionEntity>([updatedField]);
      if (isTemporary(newTransaction)) {
        trackClearedField(clearedFields.current, newTransaction, updatedField);
        const clearedOnThisRow = getClearedFieldNames(
          clearedFields.current,
          newTransaction.id,
        );

        const afterRules = await send('rules-run', {
          transaction: newTransaction,
        });
        const diff = getChangedValues(newTransaction, afterRules);

        if (diff) {
          Object.keys(diff).forEach(key => {
            const field = key as keyof TransactionEntity;
            // Apply rule changes to "empty" fields and append/prepend notes rules
            // (see shouldApplyRuleChange).
            // Or update all fields if the payee changes (assists location-based entry by
            // applying rules to prefill category, notes, etc. based on the selected payee)
            // — except fields the user explicitly cleared, which must stay empty.
            if (
              !clearedOnThisRow.includes(field) &&
              (updatedField === 'payee' ||
                shouldApplyRuleChange(
                  field,
                  newTransaction[field],
                  diff[field],
                ))
            ) {
              (newTransaction as Record<string, unknown>)[field] = diff[field];
              changedFields.add(field);
            }
          });

          const subtransactions = propagateRuleChangeToSubtransactions(
            newTransaction,
            diff.subtransactions,
            updatedField,
            clearedFields.current,
          );
          if (subtransactions) {
            newTransaction.subtransactions = subtransactions;
            changedFields.add('subtransactions');
          }
        }
      }

      // Updates can be in flight at the same time (e.g. an amount blur
      // racing a nearby payee press), so merge only the changed fields onto
      // the latest state rather than replacing the whole transaction.
      setTransactions(prevTransactions => {
        const latestTransaction = prevTransactions.find(
          t => t.id === newTransaction.id,
        );
        if (!latestTransaction) {
          // The transaction was deleted while this update was in flight.
          return prevTransactions;
        }
        const merged = { ...latestTransaction };
        for (const field of changedFields) {
          (merged as Record<string, unknown>)[field] = newTransaction[field];
        }
        return updateTransaction(prevTransactions, merged).data;
      });

      if (updatedField === 'payee') {
        setRuleCategory(
          changedFields.has('category') && newTransaction.category
            ? { id: newTransaction.id, category: newTransaction.category }
            : null,
        );
      }

      if (updatedField === 'payee') {
        setShouldShowSaveLocation(false);

        if (newTransaction.payee && isLocationGranted) {
          const payeeLocations = await locationService.getPayeeLocations(
            newTransaction.payee,
          );
          if (payeeLocations.length === 0) {
            setShouldShowSaveLocation(true);
          } else {
            const currentPosition = await locationService.getCurrentPosition();
            const hasNearby = payeeLocations.some(
              loc =>
                calculateDistance(currentPosition, {
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }) <= DEFAULT_MAX_DISTANCE_METERS,
            );
            if (!hasNearby) {
              setShouldShowSaveLocation(true);
            }
          }
        }
      }
    },
    [dateFormat, isLocationGranted],
  );

  const onSave = useCallback(
    async (newTransactions: TransactionEntity[]) => {
      if (isDeleted.current) {
        return;
      }

      const changes = diffItems(fetchedTransactions || [], newTransactions);
      if (
        changes.added.length > 0 ||
        changes.updated.length > 0 ||
        changes.deleted.length
      ) {
        const _remoteUpdates = await send('transactions-batch-update', {
          added: changes.added,
          deleted: changes.deleted,
          updated: changes.updated,
        });

        // if (onTransactionsChange) {
        //   onTransactionsChange({
        //     ...changes,
        //     updated: changes.updated.concat(remoteUpdates),
        //   });
        // }
      }

      if (isAdding.current) {
        // The first one is always the "parent" and the only one we care
        // about
        dispatch(setLastTransaction({ transaction: newTransactions[0] }));
      }
    },
    [dispatch, fetchedTransactions],
  );

  const onDelete = useCallback(
    async (id: TransactionEntity['id']) => {
      const changes = deleteTransaction(transactions, id);

      if (isAdding.current) {
        // Adding a new transactions, this disables saving when the component unmounts
        isDeleted.current = true;
      } else {
        const _remoteUpdates = await send('transactions-batch-update', {
          deleted: changes.diff.deleted,
        });

        // if (onTransactionsChange) {
        //   onTransactionsChange({ ...changes, updated: remoteUpdates });
        // }
      }

      setTransactions(changes.data);
    },
    [transactions],
  );

  const onAddSplit = useCallback(
    (id: TransactionEntity['id']) => {
      const changes = addSplitTransaction(transactions, id);
      setTransactions(changes.data);
    },
    [transactions],
  );

  const onSplit = useCallback(
    (id: TransactionEntity['id']) => {
      const changes = splitTransaction(
        transactions,
        id,
        makeEmptySplitSubtransactions,
      );

      setTransactions(changes.data);
    },
    [transactions],
  );

  const onReset = () => {
    const [saved] = transactions;
    wasReset.current = true;
    clearedFields.current.clear();
    isDeleted.current = false;
    setShouldShowSaveLocation(false);
    setTransactions([
      {
        id: 'temp',
        date: saved.date,
        account: saved.account,
        amount: 0,
        cleared: false,
        notes: '',
      },
    ]);
    setFormKey(key => key + 1);
  };

  const onSaveLocation = useCallback(async () => {
    try {
      const [transaction] = transactions;
      if (transaction.payee) {
        await updatePayeeLocationMutation.mutateAsync(transaction.payee);
        setShouldShowSaveLocation(false);
      }
    } catch (error) {
      console.error('Failed to save location', { error });
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Failed to save location'),
          },
        }),
      );
    }
  }, [t, transactions, dispatch, updatePayeeLocationMutation]);

  const onSelectNearestPayee = useCallback(() => {
    const transaction = transactions[0];
    if (!nearestPayee || !transaction || transaction.payee) {
      return;
    }

    const updated = {
      ...serializeTransaction(transaction, dateFormat),
      payee: nearestPayee.id,
    };
    void onUpdate(updated, 'payee');
  }, [transactions, nearestPayee, onUpdate, dateFormat]);

  if (accounts.length === 0) {
    return (
      <Dialog style={dialogStyle}>
        <SheetHeader
          title={t('New Transaction')}
          onCancel={() => navigate(-1)}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backgroundColor: theme.mobilePageBackground,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 20,
              lineHeight: '1.5em',
            }}
          >
            <Trans>
              To add a transaction, you need to{' '}
              <strong>create an account first</strong>. You can add an account
              from the accounts page.
            </Trans>
          </Text>
          <Button
            variant="primary"
            onPress={() => {
              dispatch(
                pushModal({
                  modal: { name: 'add-account', options: {} },
                }),
              );
            }}
          >
            <Trans>Add account</Trans>
          </Button>
        </View>
      </Dialog>
    );
  }

  if (categories.length === 0) {
    return (
      <Dialog style={dialogStyle}>
        <SheetHeader
          title={t('New Transaction')}
          onCancel={() => navigate(-1)}
        />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backgroundColor: theme.mobilePageBackground,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              textAlign: 'center',
              marginBottom: 20,
              lineHeight: '1.5em',
            }}
          >
            <Trans>
              To add a transaction, you need to{' '}
              <strong>create a category first</strong>. You can add categories
              from the budget page.
            </Trans>
          </Text>
          <Button
            variant="primary"
            onPress={() => {
              void navigate('/budget');
            }}
          >
            <Trans>Go to budget</Trans>
          </Button>
        </View>
      </Dialog>
    );
  }

  // This check ensures the component only renders after the transaction state
  // has been properly initialized. When creating a new transaction (transactionId === 'new'),
  // the transaction is created in a useEffect that runs after the component mounts.
  // Returning null here acts as a loading state until that initialization completes.
  if (transactions.length === 0) {
    return null;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.pageBackground,
      }}
    >
      <TransactionEditInner
        key={formKey}
        transactions={transactions}
        isAdding={isAdding.current}
        categories={categories}
        accounts={accounts}
        payees={payees}
        dateFormat={dateFormat}
        onUpdate={onUpdate}
        onSave={onSave}
        onDelete={onDelete}
        onSplit={onSplit}
        onAddSplit={onAddSplit}
        onReset={onReset}
        shouldShowSaveLocation={shouldShowSaveLocation}
        onSaveLocation={onSaveLocation}
        onSelectNearestPayee={onSelectNearestPayee}
        nearestPayee={isLocationGranted ? nearestPayee : null}
        ruleCategory={ruleCategory}
        onRequestLocation={shouldPromptLocation ? requestPermission : undefined}
      />
    </View>
  );
}

type TransactionEditProps = Omit<
  TransactionEditUnconnectedProps,
  'categories' | 'accounts' | 'payees' | 'lastTransaction' | 'dateFormat'
>;

export const TransactionEdit = (props: TransactionEditProps) => {
  const { data: { list: categories } = { list: [] } } = useCategories();
  const { data: payees = [] } = usePayees();
  const lastTransaction = useSelector(
    state => state.transactions.lastTransaction,
  );
  const { data: accounts = [] } = useAccounts();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';

  return (
    <SingleActiveEditFormProvider formName="mobile-transaction">
      <TransactionEditUnconnected
        {...props}
        categories={categories}
        payees={payees}
        lastTransaction={lastTransaction}
        accounts={accounts}
        dateFormat={dateFormat}
      />
    </SingleActiveEditFormProvider>
  );
};

function FillRemainingButton({
  remaining,
  onPress,
}: {
  readonly remaining: number;
  readonly onPress: () => void;
}) {
  return (
    <Button
      variant="primary"
      style={{ height: styles.mobileMinHeight }}
      onPress={onPress}
      isDisabled={remaining === 0}
    >
      <SvgSplit width={17} height={17} />
      <Text
        style={{
          ...styles.text,
          marginLeft: 6,
        }}
      >
        <Trans>
          Use remaining:{' '}
          {{
            amount: integerToCurrency(Math.abs(remaining)),
          }}
        </Trans>
      </Text>
    </Button>
  );
}
