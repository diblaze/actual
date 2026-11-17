import React, { Fragment, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { SvgCheveronDown } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useReopenAccountMutation, useUpdateAccountMutation } from '#accounts';
import { isAccountFailedSync } from '#accounts/syncStatus';
import { UncategorizedBanner } from '#components/mobile/ActionBanner';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page } from '#components/Page';
import { useAccount } from '#hooks/useAccount';
import { useSyncedPref } from '#hooks/useSyncedPref';
import {
  collapseModals,
  openAccountCloseModal,
  pushModal,
} from '#modals/modalsSlice';
import { useDispatch, useSelector } from '#redux';

import { ALL_ACCOUNTS_ID } from './AccountsPage';
import { AccountTransactions } from './AccountTransactions';
import { AllAccountTransactions } from './AllAccountTransactions';
import { OffBudgetAccountTransactions } from './OffBudgetAccountTransactions';
import { OnBudgetAccountTransactions } from './OnBudgetAccountTransactions';

export function AccountPage() {
  const { t } = useTranslation();
  const [_numberFormat] = useSyncedPref('numberFormat');
  const numberFormat = _numberFormat || 'comma-dot';
  const [hideFraction] = useSyncedPref('hideFraction');

  const { id: accountIdParam } = useParams();

  const account = useAccount(accountIdParam || '');

  const nameFromId = useCallback(
    (id: string | undefined) => {
      switch (id) {
        case 'onbudget':
          return t('On Budget Accounts');
        case 'offbudget':
          return t('Off Budget Accounts');
        case 'uncategorized':
          return t('Uncategorized');
        case 'closed':
          return t('Closed Accounts');
        default:
          return t('All Accounts');
      }
    },
    [t],
  );

  return (
    <Page
      header={
        <MobilePageHeader
          title={
            account ? (
              <AccountHeader account={account} />
            ) : accountIdParam === ALL_ACCOUNTS_ID ? (
              <AllAccountsHeader />
            ) : (
              <NameOnlyHeader name={nameFromId(accountIdParam)} />
            )
          }
          // The Transactions tab is a top-level destination: no way back
          leftContent={
            accountIdParam !== ALL_ACCOUNTS_ID && <MobileBackButton />
          }
        />
      }
      padding={0}
    >
      {accountIdParam === ALL_ACCOUNTS_ID && (
        <UncategorizedBanner
          style={{ margin: `0 ${spacing.lg}px ${spacing.md}px` }}
        />
      )}
      {/* This key forces the whole table rerender when the number format changes */}
      <Fragment key={numberFormat + hideFraction}>
        {account ? (
          <AccountTransactions account={account} />
        ) : accountIdParam === 'onbudget' ? (
          <OnBudgetAccountTransactions />
        ) : accountIdParam === 'offbudget' ? (
          <OffBudgetAccountTransactions />
        ) : (
          <AllAccountTransactions />
        )}
      </Fragment>
    </Page>
  );
}

function AccountHeader({ account }: { readonly account: AccountEntity }) {
  const { t } = useTranslation();
  const syncingAccountIds = useSelector(state => state.account.accountsSyncing);
  const pending = syncingAccountIds.includes(account.id);
  const failed = isAccountFailedSync(account);

  const dispatch = useDispatch();
  const { mutate: updateAccount } = useUpdateAccountMutation();

  const onSave = useCallback(
    (account: AccountEntity) => {
      updateAccount({ account });
    },
    [updateAccount],
  );

  const onSaveNotes = useCallback(async (id: string, notes: string) => {
    await send('notes-save', { id, note: notes });
  }, []);

  const onEditNotes = useCallback(
    (id: string) => {
      dispatch(
        pushModal({
          modal: {
            name: 'notes',
            options: {
              id: `account-${id}`,
              name: account.name,
              onSave: onSaveNotes,
            },
          },
        }),
      );
    },
    [account.name, dispatch, onSaveNotes],
  );

  const onCloseAccount = useCallback(() => {
    void dispatch(openAccountCloseModal({ accountId: account.id }));
  }, [account.id, dispatch]);

  const { mutate: reopenAccount } = useReopenAccountMutation();

  const onReopenAccount = useCallback(() => {
    reopenAccount({ id: account.id });
  }, [account.id, reopenAccount]);

  const [, setSearchParams] = useSearchParams();

  const onReconcile = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'account-reconcile',
          options: {
            accountId: account.id,
            onReconcile: (amount: number) => {
              setSearchParams(
                prev => {
                  prev.set('reconcile', String(amount));
                  return prev;
                },
                { replace: true },
              );
              dispatch(
                collapseModals({
                  rootModalName: 'account-menu',
                }),
              );
            },
          },
        },
      }),
    );
  }, [account.id, dispatch, setSearchParams]);

  const onClick = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'account-menu',
          options: {
            accountId: account.id,
            onSave,
            onEditNotes,
            onCloseAccount,
            onReopenAccount,
            onReconcile,
          },
        },
      }),
    );
  }, [
    account.id,
    dispatch,
    onCloseAccount,
    onEditNotes,
    onReconcile,
    onReopenAccount,
    onSave,
  ]);

  return (
    <View
      style={{
        flexDirection: 'row',
      }}
    >
      {account.bank && (
        <View
          style={{
            margin: 'auto',
            marginRight: 5,
            width: 8,
            height: 8,
            borderRadius: 8,
            flexShrink: 0,
            backgroundColor: pending
              ? theme.sidebarItemBackgroundPending
              : failed
                ? theme.sidebarItemBackgroundFailed
                : theme.sidebarItemBackgroundPositive,
            transition: 'transform .3s',
          }}
        />
      )}
      <Button variant="bare" onPress={onClick}>
        <Text
          size="extra-large"
          style={{
            fontWeight: 500,
            ...styles.underlinedText,
            ...(styles.lineClamp(2) as CSSProperties),
          }}
        >
          {account.closed
            ? t('Closed: {{accountName}}', { accountName: account.name })
            : account.name}
        </Text>
      </Button>
    </View>
  );
}

function AllAccountsHeader() {
  const dispatch = useDispatch();

  const onClick = useCallback(() => {
    dispatch(
      pushModal({
        modal: {
          name: 'all-accounts-menu',
          options: {},
        },
      }),
    );
  }, [dispatch]);

  // A top-level large title, like the budget month; it opens the menu
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
      onPress={onClick}
    >
      <Trans>Transactions</Trans>
      <SvgCheveronDown width={18} height={18} style={{ flexShrink: 0 }} />
    </Button>
  );
}

function NameOnlyHeader({ name }: { readonly name: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
      }}
    >
      <Text style={{ ...(styles.lineClamp(2) as CSSProperties) }}>{name}</Text>
    </View>
  );
}
