// nYNAB-style credit card payment categories for the envelope budget, behind
// the `ccPaymentCategories` feature flag. A category whose `payment_account`
// points at an on-budget account is that card's payment category. Card spending
// in an expense category moves the funded part of it into the payment
// category; the unfunded part is credit overspending, which never reduces next
// month's To Budget. Everything here is derived spreadsheet state: with the
// flag off no cell below exists and the stock budget is untouched.
import { logger } from '#platform/server/log';
import * as db from '#server/db';
import * as sheet from '#server/sheet';
import { resolveName } from '#server/spreadsheet/util';
import * as monthUtils from '#shared/months';
import { safeNumber } from '#shared/util';

import { getBudgetType, rebuildBudget } from './base';
import { number, sumAmounts } from './util';

const PAYMENT_GROUP_NAME = 'Credit Card Payments';

type BudgetCategory = {
  id: string;
  is_income?: boolean | 0 | 1 | null;
  payment_account?: string | null;
  sort_order?: number | null;
};

type Card = { id: string; account: string };

type State = {
  enabled: boolean;
  // Payment categories in payment-category order (sort_order, id)
  cards: Card[];
  expenseIds: string[];
  incomeIds: string[];
};

const DISABLED: State = {
  enabled: false,
  cards: [],
  expenseIds: [],
  incomeIds: [],
};

// Module state instead of sheet meta: refreshed by every budget build, which is
// also when every cell below captures it.
let state = DISABLED;

export function refresh(categories: BudgetCategory[]): void {
  const pref = db.firstSync<{ value: string }>(
    'SELECT value FROM preferences WHERE id = ?',
    ['flags.ccPaymentCategories'],
  );
  const enabled = pref?.value === 'true' && getBudgetType() === 'envelope';
  if (!enabled) {
    state = DISABLED;
    return;
  }

  // A deleted or off-budget card leaves a plain category behind
  const liveAccounts = new Set(
    db
      .runQuery<{ id: string }>(
        'SELECT id FROM accounts WHERE tombstone = 0 AND offbudget = 0',
        [],
        true,
      )
      .map(account => account.id),
  );
  const cards: Card[] = [];
  for (const cat of categories
    .filter(
      cat =>
        !cat.is_income &&
        cat.payment_account &&
        liveAccounts.has(cat.payment_account),
    )
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )) {
    // Two devices can mark the same card offline; the first one wins and
    // the other stays a plain category
    if (!cards.some(card => card.account === cat.payment_account)) {
      cards.push({ id: cat.id, account: cat.payment_account as string });
    }
  }
  const cardIds = new Set(cards.map(card => card.id));

  state = {
    enabled: true,
    cards,
    expenseIds: categories
      .filter(cat => !cat.is_income && !cardIds.has(cat.id))
      .map(cat => cat.id),
    incomeIds: categories.filter(cat => cat.is_income).map(cat => cat.id),
  };
}

export function isPaymentCategory(cat: { id: string }): boolean {
  return state.cards.some(card => card.id === cat.id);
}

// The cell `last-month-overspent` reads for a category: only cash overspending
// reduces next month's To Budget. A payment category's own overspending (paid
// more than it held) is cash overspending, so it reads the plain balance.
export function carryCell(cat: { id: string }): string {
  return state.enabled && !isPaymentCategory(cat)
    ? 'cash-leftover'
    : 'leftover';
}

export function createBlankCells(cat: BudgetCategory, sheetName: string) {
  if (!state.enabled || cat.is_income || isPaymentCategory(cat)) {
    return;
  }
  sheet.get().createStatic(sheetName, `cash-leftover-${cat.id}`, 0);
  for (const card of state.cards) {
    sheet.get().createStatic(sheetName, `cc-debt-${cat.id}-${card.id}`, 0);
  }
}

// Activity of a payment category: money moved in from every category's card
// spending, plus anything categorised to it directly, minus card payments
// (transfers into the card).
export function createPaymentActivity(
  cat: BudgetCategory,
  sheetName: string,
  start: number,
  end: number,
) {
  const card = state.cards.find(c => c.id === cat.id);
  if (!card) {
    return;
  }

  sheet.get().createDynamic(sheetName, `sum-amount-${cat.id}`, {
    initialValue: 0,
    dependencies: [...state.expenseIds, ...state.incomeIds].map(
      id => `cc-moved-${id}-${card.id}`,
    ),
    run: (...moved: unknown[]) => {
      const [row] = db.runQuery<{ direct: number | null; payments: number }>(
        `SELECT SUM(CASE WHEN t.category = ? THEN t.amount ELSE 0 END) AS direct,
                SUM(CASE WHEN t.category IS NULL THEN t.amount ELSE 0 END) AS payments
           FROM v_transactions_internal_alive t
           LEFT JOIN accounts a ON a.id = t.account
          WHERE t.date >= ? AND t.date <= ? AND a.offbudget = 0
            AND (t.category = ? OR
                 (t.account = ? AND t.category IS NULL AND t.transfer_id IS NOT NULL))`,
        [cat.id, start, end, cat.id, card.account],
        true,
      );
      return safeNumber(
        number(row?.direct) + sumAmounts(...moved) - number(row?.payments),
      );
    },
  });
}

// Per (month, category) cells for every card. Called for each category after
// its stock cells exist.
export function createCells(
  cat: BudgetCategory,
  sheetName: string,
  prevSheetName: string,
  start: number,
  end: number,
) {
  if (!state.enabled || isPaymentCategory(cat)) {
    return;
  }
  const { cards } = state;

  if (cat.is_income) {
    // Income categorised on a card (cashback, statement credits) reduces what
    // the payment category needs to hold.
    for (const card of cards) {
      sheet.get().createDynamic(sheetName, `cc-moved-${cat.id}-${card.id}`, {
        initialValue: 0,
        // Dependency only so stock recomputes of the category re-run this
        dependencies: [`sum-amount-${cat.id}`],
        run: () => {
          const [row] = db.runQuery<{ amount: number | null }>(
            `SELECT SUM(t.amount) AS amount FROM v_transactions_internal_alive t
               LEFT JOIN accounts a ON a.id = t.account
             WHERE t.date >= ? AND t.date <= ? AND a.offbudget = 0
               AND t.category = ? AND t.account = ?`,
            [start, end, cat.id, card.account],
            true,
          );
          return -number(row?.amount);
        },
      });
    }
    return;
  }

  const walkDeps = [
    `budget-${cat.id}`,
    `sum-amount-${cat.id}`,
    `${prevSheetName}!carryover-${cat.id}`,
    `${prevSheetName}!leftover-${cat.id}`,
    `${prevSheetName}!leftover-pos-${cat.id}`,
    ...cards.map(card => `${prevSheetName}!cc-debt-${cat.id}-${card.id}`),
  ];
  const run = (field: 'moved' | 'debt', index: number) => {
    return (...inputs: unknown[]) =>
      walk(cat.id, cards, start, end, inputs)[field][index];
  };

  cards.forEach((card, index) => {
    sheet.get().createDynamic(sheetName, `cc-moved-${cat.id}-${card.id}`, {
      initialValue: 0,
      dependencies: walkDeps,
      run: run('moved', index),
    });
    sheet.get().createDynamic(sheetName, `cc-debt-${cat.id}-${card.id}`, {
      initialValue: 0,
      dependencies: walkDeps,
      run: run('debt', index),
    });
  });

  // Category balance without the unfunded card debt; what overspending
  // checks read instead of `leftover`.
  sheet.get().createDynamic(sheetName, `cash-leftover-${cat.id}`, {
    initialValue: 0,
    dependencies: [
      `leftover-${cat.id}`,
      ...cards.map(card => `cc-debt-${cat.id}-${card.id}`),
    ],
    run: (leftover: unknown, ...debts: unknown[]) =>
      safeNumber(number(leftover) + sumAmounts(...debts)),
  });
}

// Cash is counted first: the month's non-card activity, then (with rollover
// on) carried card debt is covered in payment-category order, then card
// transactions are funded in register order. A card refund first cancels that
// card's unfunded debt; only the rest moves back out of the payment category.
function walk(
  catId: string,
  cards: Card[],
  start: number,
  end: number,
  [
    budget,
    sumAmount,
    prevCarryover,
    prevLeftover,
    prevLeftoverPos,
    ...prevDebts
  ]: unknown[],
) {
  const rows = db.runQuery<{ amount: number; account: string }>(
    `SELECT t.amount, t.account FROM v_transactions_internal_alive t
       LEFT JOIN accounts a ON a.id = t.account
     WHERE t.date >= ? AND t.date <= ? AND a.offbudget = 0
       AND t.category = ? AND t.account IN (${cards.map(() => '?').join(', ')})
     ORDER BY t.date, t.starting_balance_flag DESC, t.sort_order, t.id DESC`,
    [start, end, catId, ...cards.map(card => card.account)],
    true,
  );

  const carried = prevCarryover
    ? number(prevLeftover)
    : number(prevLeftoverPos);
  // Rollover off drops the credit debt: it lives on the card only
  const debt = cards.map((_, i) => (prevCarryover ? number(prevDebts[i]) : 0));
  const moved = cards.map(() => 0);
  const cardActivity = rows.reduce((total, row) => total + row.amount, 0);

  // The carried credit debt is part of `carried` but is not cash
  let available =
    number(budget) +
    carried +
    debt.reduce((total, d) => total + d, 0) +
    (number(sumAmount) - cardActivity);

  // Money left in the category pays down card debt, in payment-category order
  const coverDebt = () => {
    cards.forEach((_, i) => {
      const cover = Math.min(debt[i], Math.max(0, available));
      debt[i] -= cover;
      moved[i] += cover;
      available -= cover;
    });
  };

  coverDebt();
  for (const row of rows) {
    const i = cards.findIndex(card => card.account === row.account);
    if (row.amount < 0) {
      const funded = Math.min(-row.amount, Math.max(0, available));
      moved[i] += funded;
      available -= funded;
      debt[i] += -row.amount - funded;
    } else {
      const cancelled = Math.min(row.amount, debt[i]);
      debt[i] -= cancelled;
      moved[i] -= row.amount - cancelled;
      available += row.amount - cancelled;
    }
  }
  // A refund on one card can free money for another card's debt
  coverDebt();

  return { moved, debt };
}

// Extra `[cell, dependencies]` pairs for a category added to or removed from
// an existing budget.
export function handleCategoryDeps(
  cat: BudgetCategory,
): Array<[string, string[]]> {
  if (!state.enabled || isPaymentCategory(cat)) {
    return [];
  }
  return state.cards.map(card => [
    `sum-amount-${card.id}`,
    [`cc-moved-${cat.id}-${card.id}`],
  ]);
}

export function handleTransactionChange(
  transaction: {
    acct?: string | null;
    category?: string | null;
    date?: number | null;
  },
  changedFields: Set<string>,
) {
  const card = state.cards.find(c => c.account === transaction.acct);
  if (!state.enabled || !card || !transaction.date) {
    return;
  }
  const sheetName = monthUtils.sheetForMonth(
    monthUtils.monthFromDate(db.fromDateRepr(transaction.date)),
  );

  if (transaction.category) {
    // Reordering same-day card transactions changes which card gets funded
    if (changedFields.has('sort_order')) {
      sheet
        .get()
        .recompute(
          resolveName(sheetName, `sum-amount-${transaction.category}`),
        );
    }
  } else if (
    ['transferred_id', 'amount', 'date', 'acct', 'tombstone', 'category'].some(
      field => changedFields.has(field),
    )
  ) {
    // Card payments
    sheet.get().recompute(resolveName(sheetName, `sum-amount-${card.id}`));
  }
}

// Adding, removing or reordering payment categories changes the card list
// every cell above captured, so the budget is rebuilt.
export function needsRebuild(
  oldValue: (BudgetCategory & { tombstone?: number }) | undefined,
  newValue: BudgetCategory & { tombstone?: number },
): boolean {
  if (
    !state.enabled ||
    (!oldValue?.payment_account && !newValue.payment_account)
  ) {
    return false;
  }
  return (
    !oldValue ||
    oldValue.payment_account !== newValue.payment_account ||
    oldValue.tombstone !== newValue.tombstone ||
    oldValue.sort_order !== newValue.sort_order
  );
}

// Deleting a card, or moving it off budget, turns its payment category into a
// plain category
export function accountNeedsRebuild(
  oldValue: { tombstone?: number; offbudget?: number } | undefined,
  newValue: { id: string; tombstone?: number; offbudget?: number },
): boolean {
  const changed =
    !oldValue ||
    oldValue.tombstone !== newValue.tombstone ||
    oldValue.offbudget !== newValue.offbudget;
  // A card can also become one again: back on budget, or synced in after its
  // payment category
  return (
    state.enabled &&
    changed &&
    (isCreditCardAccount(newValue.id) ||
      db.firstSync(
        'SELECT 1 FROM categories WHERE payment_account = ? AND tombstone = 0',
        [newValue.id],
      ) != null)
  );
}

let pendingRebuild: Promise<unknown> = Promise.resolve();

// Runs after the current sync batch has left its spreadsheet transaction.
// Rebuilds are serialised.
export function scheduleRebuild(): void {
  pendingRebuild = pendingRebuild
    .then(() => rebuildBudget())
    .catch(error =>
      logger.warn('Rebuilding the budget for credit cards failed', error),
    );
}

export function whenRebuilt(): Promise<unknown> {
  return pendingRebuild;
}

// A card's payment category is named after the card's account
export async function followAccountName(
  accountId: string,
  name: string,
): Promise<void> {
  if (!state.enabled) {
    return;
  }
  const payment = await db.first<{ id: string }>(
    'SELECT id FROM categories WHERE payment_account = ? AND tombstone = 0',
    [accountId],
  );
  if (payment) {
    await db.update('categories', { id: payment.id, name });
  }
}

export function isCreditCardAccount(accountId: string): boolean {
  return state.cards.some(card => card.account === accountId);
}

// The group of existing payment categories, else a "Credit Card Payments"
// group, created at the top of the budget as in nYNAB. Payment categories
// stay visible, so their group does too.
async function findOrCreatePaymentGroup(): Promise<string> {
  const group =
    (await db.first<{ id: string; hidden: number }>(
      `SELECT g.id, g.hidden FROM categories c
         JOIN category_groups g ON g.id = c.cat_group
        WHERE c.payment_account IS NOT NULL AND c.tombstone = 0
          AND g.tombstone = 0
        ORDER BY c.sort_order, c.id LIMIT 1`,
    )) ??
    (await db.first<{ id: string; hidden: number }>(
      'SELECT id, hidden FROM category_groups WHERE UPPER(name) = ? AND tombstone = 0',
      [PAYMENT_GROUP_NAME.toUpperCase()],
    ));
  if (group) {
    if (group.hidden) {
      await db.update('category_groups', { id: group.id, hidden: 0 });
    }
    return group.id;
  }
  const first = await db.first<{ id: string }>(
    'SELECT id FROM category_groups WHERE tombstone = 0 AND is_income = 0 ORDER BY sort_order, id LIMIT 1',
  );
  const id = await db.insertCategoryGroup({ name: PAYMENT_GROUP_NAME });
  if (first) {
    await db.moveCategoryGroup(id, first.id);
  }
  return id;
}

// Marking is permanent, as in nYNAB: there is no unmark, and the payment
// category cannot be renamed, hidden or deleted while the feature is on. A
// card always keeps the same payment category: marking it again (after an
// undo, or after the category was deleted with the feature off) revives it.
// A category already named after the card in the payment group (a manual
// workaround from before) is adopted. A no-op with the feature off.
export async function markCreditCard({ id }: { id: string }): Promise<void> {
  if (!state.enabled) {
    return;
  }
  const account = await db.first<{ name: string; offbudget: number }>(
    'SELECT name, offbudget FROM accounts WHERE id = ? AND tombstone = 0',
    [id],
  );
  if (!account) {
    throw new Error(`markCreditCard: account ${id} not found`);
  }
  if (account.offbudget) {
    throw new Error('Only on-budget accounts can be marked as credit cards');
  }

  const linked = await db.first<{
    id: string;
    cat_group: string;
    group_alive: number | null;
    group_hidden: number | null;
  }>(
    `SELECT c.id, c.cat_group, g.tombstone = 0 AS group_alive,
            g.hidden AS group_hidden
       FROM categories c
       LEFT JOIN category_groups g ON g.id = c.cat_group
      WHERE c.payment_account = ?
      ORDER BY c.tombstone, c.sort_order, c.id
      LIMIT 1`,
    [id],
  );
  const groupId = linked?.group_alive ? null : await findOrCreatePaymentGroup();
  if (linked?.group_alive && linked.group_hidden) {
    await db.update('category_groups', { id: linked.cat_group, hidden: 0 });
  }
  const adopted =
    !linked && groupId
      ? await db.first<{ id: string }>(
          `SELECT id FROM categories
            WHERE cat_group = ? AND UPPER(name) = ? AND tombstone = 0
              AND payment_account IS NULL`,
          [groupId, account.name.toUpperCase()],
        )
      : null;
  const existing = linked ?? adopted;
  if (!existing) {
    await db.insertCategory({
      name: account.name,
      cat_group: groupId as string,
      payment_account: id,
    });
    return;
  }
  await db.update('categories', {
    id: existing.id,
    name: account.name,
    hidden: 0,
    tombstone: 0,
    payment_account: id,
    ...(groupId && { cat_group: groupId }),
  });
  // Deleting it with a transfer forwarded it to another category; undo that
  await db.update('category_mapping', {
    id: existing.id,
    transferId: existing.id,
  });
}
