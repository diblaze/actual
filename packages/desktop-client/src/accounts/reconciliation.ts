import { send } from '@actual-app/core/platform/client/connection';
import { currentDay } from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import {
  realizeTempTransactions,
  ungroupTransactions,
  updateTransaction,
} from '@actual-app/core/shared/transactions';
import { applyChanges } from '@actual-app/core/shared/util';
import type {
  AccountEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';
import { t } from 'i18next';

import { aqlQuery } from '#queries/aqlQuery';

export async function lockTransactions(accountId: AccountEntity['id']) {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ cleared: true, reconciled: false, account: accountId })
      .select('*')
      .options({ splits: 'grouped' }),
  );
  let transactions = ungroupTransactions(data);

  const changes: { updated: Array<Partial<TransactionEntity>> } = {
    updated: [],
  };

  transactions.forEach(trans => {
    const { diff } = updateTransaction(transactions, {
      ...trans,
      reconciled: true,
    });

    transactions = applyChanges(diff, transactions);

    changes.updated = changes.updated
      ? changes.updated.concat(diff.updated)
      : diff.updated;
  });

  await send('transactions-batch-update', changes);
}

export async function unlockTransaction(
  transactionId: TransactionEntity['id'],
) {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ id: transactionId })
      .select('*')
      .options({ splits: 'grouped' }),
  );
  const transactions = ungroupTransactions(data);

  const transaction = transactions.find(trans => trans.id === transactionId);
  if (!transaction) {
    return;
  }

  const { diff } = updateTransaction(transactions, {
    ...transaction,
    reconciled: false,
  });

  await send('transactions-batch-update', { updated: diff.updated });
}

export async function getClearedBalance(accountId: AccountEntity['id']) {
  const { data } = await aqlQuery(
    q('transactions')
      .filter({ cleared: true, account: accountId })
      .options({ splits: 'none' })
      .calculate({ $sum: '$amount' }),
  );

  return data ?? 0;
}

export async function finishReconciliation(
  accountId: AccountEntity['id'],
  reconcileAmount: number | null,
  lock: () => Promise<void> = () => lockTransactions(accountId),
) {
  const cleared = await getClearedBalance(accountId);
  const targetDiff = (reconcileAmount ?? 0) - cleared;

  if (targetDiff === 0) {
    await lock();
  }
}

export async function createReconciliationTransaction(
  accountId: AccountEntity['id'],
  diff: number,
  onRealized?: (transactions: TransactionEntity[]) => void,
) {
  const reconciliationTransactions = realizeTempTransactions([
    {
      id: 'temp',
      account: accountId,
      cleared: true,
      reconciled: false,
      amount: diff,
      date: currentDay(),
      notes: t('Reconciliation balance adjustment'),
    },
  ]);

  onRealized?.(reconciliationTransactions);

  const isCard = await send('is-credit-card-account', { id: accountId });
  // A card adjustment changes the card's debt only: uncategorised and marked
  // like a starting balance, unless a rule categorised, split or transferred it
  const ruledTransactions = await Promise.all(
    reconciliationTransactions.map(async transaction => {
      const ruled = await send('rules-run', { transaction });
      const plain =
        isCard &&
        ruled.category == null &&
        !ruled.subtransactions?.length &&
        !(await isTransferPayee(ruled.payee));
      return plain ? { ...ruled, starting_balance_flag: true } : ruled;
    }),
  );

  await send('transactions-batch-update', {
    added: ruledTransactions.filter(trans => !trans.tombstone),
    deleted: ruledTransactions.filter(trans => trans.tombstone),
  });
}

async function isTransferPayee(payee: TransactionEntity['payee']) {
  if (!payee) {
    return false;
  }
  const { data } = await aqlQuery(
    q('payees').filter({ id: payee }).select('transfer_acct'),
  );
  return data[0]?.transfer_acct != null;
}
