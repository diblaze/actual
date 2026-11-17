// nYNAB-style credit card payment categories for the envelope budget, behind
// the `ccPaymentCategories` feature flag. A category whose `payment_account`
// points at an on-budget account is that card's payment category. Card spending
// in an expense category moves the funded part of it into the payment
// category; the unfunded part is credit overspending, which never reduces next
// month's To Budget. With `ccCarryCardDebt` on, that debt also carries into
// the category next month whatever its rollover setting, until money there
// pays it. Everything here is derived spreadsheet state: with the flag off no
// cell below exists and the stock budget is untouched.
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
  carryCardDebt: boolean;
  // Payment categories in payment-category order (sort_order, id)
  cards: Card[];
  expenseIds: string[];
};

const DISABLED: State = {
  enabled: false,
  carryCardDebt: false,
  cards: [],
  expenseIds: [],
};

// Module state instead of sheet meta: refreshed by every budget build, which is
// also when every cell below captures it.
let state = DISABLED;

function isPrefOn(id: string): boolean {
  const pref = db.firstSync<{ value: string }>(
    'SELECT value FROM preferences WHERE id = ?',
    [id],
  );
  return pref?.value === 'true';
}

// Read from the database, not `state`: a card added right after the flag is
// turned on must not wait for the rebuild that refreshes `state`
function isFeatureOn(): boolean {
  return (
    isPrefOn('flags.ccPaymentCategories') && getBudgetType() === 'envelope'
  );
}

export function refresh(categories: BudgetCategory[]): void {
  if (!isFeatureOn()) {
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
    // Budgets from builds that could mark a card twice may link two
    // categories to one card; the first one wins and the other stays plain
    if (!cards.some(card => card.account === cat.payment_account)) {
      cards.push({ id: cat.id, account: cat.payment_account as string });
    }
  }
  const cardIds = new Set(cards.map(card => card.id));

  state = {
    enabled: true,
    carryCardDebt: isPrefOn('flags.ccCarryCardDebt'),
    cards,
    expenseIds: categories
      .filter(cat => !cat.is_income && !cardIds.has(cat.id))
      .map(cat => cat.id),
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
  const cardAccounts = state.cards.map(c => c.account);

  sheet.get().createDynamic(sheetName, `sum-amount-${cat.id}`, {
    initialValue: 0,
    dependencies: state.expenseIds.map(id => `cc-moved-${id}-${card.id}`),
    run: (...moved: unknown[]) => {
      const [row] = db.runQuery<{ direct: number | null; payments: number }>(
        `SELECT SUM(CASE WHEN t.category = ? THEN t.amount ELSE 0 END) AS direct,
                SUM(CASE WHEN t.category IS NULL THEN t.amount ELSE 0 END) AS payments
           FROM v_transactions_internal_alive t
           LEFT JOIN accounts a ON a.id = t.account
          WHERE t.date >= ? AND t.date <= ? AND a.offbudget = 0
            AND (t.category = ? OR
                 (t.account = ? AND t.category IS NULL AND t.transfer_id IS NOT NULL
                  -- A transfer from or to another card only moves debt
                  AND NOT EXISTS (
                    SELECT 1 FROM v_transactions_internal_alive o
                     WHERE o.id = t.transfer_id
                       AND o.account IN (${cardAccounts.map(() => '?').join(', ')}))))`,
        [cat.id, start, end, cat.id, card.account, ...cardAccounts],
        true,
      );
      return safeNumber(
        number(row?.direct) + sumAmounts(...moved) - number(row?.payments),
      );
    },
  });

  // How much of the card balance at the end of the month the payment category
  // does not hold: unfunded card spending and debt from before the budget.
  // With `ccCarryCardDebt` on, debt a category carries is paid from that
  // category, so it is not asked for here as well
  const carriedDebts = state.carryCardDebt
    ? state.expenseIds.map(id => `cc-debt-${id}-${card.id}`)
    : [];
  sheet.get().createDynamic(sheetName, `cc-to-pay-${cat.id}`, {
    initialValue: 0,
    // Every change to the card balance reaches leftover through sum-amount
    dependencies: [`leftover-${cat.id}`, ...carriedDebts],
    run: (leftover: unknown, ...debts: unknown[]) => {
      const [row] = db.runQuery<{ balance: number | null }>(
        `SELECT SUM(t.amount) AS balance FROM v_transactions_internal_alive t
          WHERE t.account = ? AND t.date <= ? AND t.is_parent = 0`,
        [card.account, end],
        true,
      );
      // An overspent payment category is cash overspending, shown as such
      return Math.max(
        0,
        -number(row?.balance) -
          Math.max(0, number(leftover)) -
          sumAmounts(...debts),
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
  // Income on a card (cashback, interest, adjustments) changes To Budget only,
  // as in nYNAB: the payment category is left alone
  if (!state.enabled || cat.is_income || isPaymentCategory(cat)) {
    return;
  }
  // Captured with the cells, like the `leftover` dependencies built from it,
  // so a refresh before the next rebuild cannot make the two disagree
  const { cards, carryCardDebt } = state;

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
      walk(cat.id, cards, carryCardDebt, start, end, inputs)[field][index];
  };

  // Carried card debt not yet paid: shown as plain overspending, not as
  // this month's card overspending
  if (carryCardDebt) {
    sheet.get().createDynamic(sheetName, `cc-carried-${cat.id}`, {
      initialValue: 0,
      dependencies: walkDeps,
      run: (...inputs: unknown[]) =>
        walk(cat.id, cards, carryCardDebt, start, end, inputs).unpaidCarried,
    });
  }

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
// or `ccCarryCardDebt` on) carried card debt is covered in payment-category
// order, then card transactions are funded in date order, the largest outflow
// first within a day (register order breaks ties). A card refund first cancels
// that card's unfunded debt; only the rest moves back out of the payment
// category.
function walk(
  catId: string,
  cards: Card[],
  carryCardDebt: boolean,
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
     ORDER BY t.date, t.starting_balance_flag DESC, t.amount, t.sort_order, t.id DESC`,
    [start, end, catId, ...cards.map(card => card.account)],
    true,
  );

  // Rollover off drops the credit debt, so it lives on the card only, unless
  // `ccCarryCardDebt` keeps it in the category
  const keepDebt = Boolean(prevCarryover) || carryCardDebt;
  const debt = cards.map((_, i) => (keepDebt ? number(prevDebts[i]) : 0));
  const carried = prevCarryover
    ? number(prevLeftover)
    : number(prevLeftoverPos) - sumAmounts(...debt);
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
  const carriedLeft = [...debt];
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

  const unpaid = carryCardDebt
    ? cards.reduce(
        (total, _, i) => total + Math.min(carriedLeft[i], debt[i]),
        0,
      )
    : 0;
  return { moved, debt, unpaidCarried: unpaid };
}

// Whether `ccCarryCardDebt` keeps this category's card debt from month to
// month
export function isCarryingDebt(cat: BudgetCategory): boolean {
  return (
    state.enabled &&
    state.carryCardDebt &&
    !cat.is_income &&
    !isPaymentCategory(cat)
  );
}

// The previous month's card debt cells a category's balance subtracts when
// `ccCarryCardDebt` carries them with rollover off; empty otherwise.
export function carriedDebtDeps(
  cat: BudgetCategory,
  prevSheetName: string,
): string[] {
  if (!isCarryingDebt(cat)) {
    return [];
  }
  return state.cards.map(
    card => `${prevSheetName}!cc-debt-${cat.id}-${card.id}`,
  );
}

// Extra `[cell, dependencies]` pairs for a category added to or removed from
// an existing budget.
export function handleCategoryDeps(
  cat: BudgetCategory,
): Array<[string, string[]]> {
  if (!state.enabled || cat.is_income || isPaymentCategory(cat)) {
    return [];
  }
  return state.cards.flatMap(card => {
    const deps: Array<[string, string[]]> = [
      [`sum-amount-${card.id}`, [`cc-moved-${cat.id}-${card.id}`]],
    ];
    if (state.carryCardDebt) {
      deps.push([`cc-to-pay-${card.id}`, [`cc-debt-${cat.id}-${card.id}`]]);
    }
    return deps;
  });
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
    // Any categorised card change moves the card balance; recomputing the
    // card's sum-amount reaches cc-to-pay in this and later months. Income on
    // the card needs it, as no cc-moved cell links it to the card.
    if (
      ['amount', 'date', 'acct', 'tombstone', 'category'].some(field =>
        changedFields.has(field),
      )
    ) {
      sheet.get().recompute(resolveName(sheetName, `sum-amount-${card.id}`));
    }
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
    // Card payments. Every card: whether a transfer counts depends on the
    // account of its other leg, which may be another card's transaction.
    for (const c of state.cards) {
      sheet.get().recompute(resolveName(sheetName, `sum-amount-${c.id}`));
    }
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
  const payment = await db.first<{ id: string; cat_group: string }>(
    'SELECT id, cat_group FROM categories WHERE payment_account = ? AND tombstone = 0',
    [accountId],
  );
  if (payment) {
    await db.update('categories', {
      id: payment.id,
      name: await paymentCategoryName(payment.cat_group, name, payment.id),
    });
  }
}

// The card's name, numbered when another category in the group already has it
// (two cards named alike)
export async function paymentCategoryName(
  groupId: string,
  name: string,
  selfId = '',
): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? name : `${name} (${n})`;
    const taken = await db.first<{ id: string }>(
      `SELECT id FROM categories
        WHERE cat_group = ? AND UPPER(name) = ? AND tombstone = 0 AND id != ?`,
      [groupId, candidate.toUpperCase(), selfId],
    );
    if (!taken) {
      return candidate;
    }
  }
}

// A card's payment category is hidden exactly while the card is closed. Also
// with the feature off, so the two stay in step when it is turned back on.
export async function followAccountClosed(
  accountId: string,
  closed: boolean,
): Promise<void> {
  const payment = await db.first<{ id: string }>(
    'SELECT id FROM categories WHERE payment_account = ? AND tombstone = 0',
    [accountId],
  );
  if (payment) {
    await db.update('categories', { id: payment.id, hidden: closed ? 1 : 0 });
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

// A card gets its payment category when the account is added, as in YNAB: an
// account cannot become a card later, and the category cannot be renamed,
// hidden or deleted while the feature is on. A category already named after
// the card in the payment group (a manual workaround from before) is adopted.
// A no-op with the feature off. Returns whether the account is now a card.
export async function createPaymentCategory({
  id,
  name,
  closed = false,
}: {
  id: string;
  name: string;
  closed?: boolean;
}): Promise<boolean> {
  if (!isFeatureOn()) {
    return false;
  }
  const groupId = await findOrCreatePaymentGroup();
  const adopted = await db.first<{ id: string }>(
    `SELECT id FROM categories
      WHERE cat_group = ? AND UPPER(name) = ? AND tombstone = 0
        AND payment_account IS NULL`,
    [groupId, name.toUpperCase()],
  );
  if (adopted) {
    await db.update('categories', {
      id: adopted.id,
      name,
      hidden: closed ? 1 : 0,
      payment_account: id,
    });
    return true;
  }
  await db.insertCategory({
    name: await paymentCategoryName(groupId, name),
    cat_group: groupId,
    payment_account: id,
    hidden: closed ? 1 : 0,
  });
  return true;
}
