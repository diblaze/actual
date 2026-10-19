import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { app as accountsApp } from '#server/accounts/app';
import { installAPI } from '#server/api';
import * as db from '#server/db';
import { runHandler, runMutator } from '#server/mutators';
import * as prefs from '#server/prefs';
import * as sheet from '#server/sheet';
import { undo } from '#server/undo';
import type { ServerHandlers } from '#types/server-handlers';

import { set3MonthAvg, setBudget, setCategoryCarryover } from './actions';
import { app as budgetApp } from './app';
import * as budget from './base';
import { whenRebuilt } from './credit-card';

// Inside the mocked current date, so budget rebuilds cover these months
const JAN = '2017-01';
const FEB = '2017-02';

// A missing cell reads NaN, so an expected 0 cannot pass for an absent cell
function value(month: string, cell: string): number {
  const name = `budget${month.replace('-', '')}!${cell}`;
  return sheet.get().hasCell(name)
    ? Number(sheet.get().getNode(name).value ?? 0)
    : NaN;
}

async function settle() {
  await whenRebuilt();
  await sheet.waitOnSpreadsheet();
}

async function setFlag(enabled: boolean) {
  await db.update('preferences', {
    id: 'flags.ccPaymentCategories',
    value: String(enabled),
  });
}

async function setup({ flag = true, visa = true, amex = false } = {}) {
  await setFlag(flag);
  await db.insertCategoryGroup({
    id: 'income-group',
    name: 'Income',
    is_income: 1,
  });
  await db.insertCategory({
    id: 'income',
    name: 'Income',
    cat_group: 'income-group',
    is_income: 1,
  });
  await db.insertCategoryGroup({ id: 'group1', name: 'Group' });
  await db.insertCategory({ id: 'food', name: 'Food', cat_group: 'group1' });
  await db.insertCategory({
    id: 'dining',
    name: 'Dining',
    cat_group: 'group1',
  });
  await db.insertCategoryGroup({ id: 'cc', name: 'Credit Card Payments' });
  await db.insertAccount({ id: 'checking', name: 'Checking' });
  await db.insertAccount({ id: 'card', name: 'Visa' });
  await db.insertAccount({ id: 'card2', name: 'Amex' });
  // `atEnd` keeps visa before amex in payment-category order
  if (visa) {
    await db.insertCategory(
      { id: 'visa', name: 'Visa', cat_group: 'cc', payment_account: 'card' },
      { atEnd: true },
    );
  }
  if (amex) {
    await db.insertCategory(
      { id: 'amex', name: 'Amex', cat_group: 'cc', payment_account: 'card2' },
      { atEnd: true },
    );
  }

  await sheet.loadSpreadsheet(db);
  await budget.createBudget([JAN, FEB]);
  await tx('checking', '2017-01-01', 100000, 'income');
  await settle();
}

async function tx(
  account: string,
  date: string,
  amount: number,
  category: string | null,
  extra: { id?: string; sort_order?: number; transfer_id?: string } = {},
) {
  await db.insertTransaction({ account, date, amount, category, ...extra });
}

async function setFoodBudget(month: string, amount: number) {
  await setBudget({ category: 'food', month, amount });
  await settle();
}

// A card payment: a transfer from checking into the card
async function pay(amount: number, id: string, card = 'card') {
  await tx('checking', '2017-01-20', -amount, null, {
    id: `${id}-out`,
    transfer_id: `${id}-in`,
  });
  await tx(card, '2017-01-20', amount, null, {
    id: `${id}-in`,
    transfer_id: `${id}-out`,
  });
  await settle();
}

async function rollover(category: string) {
  await setCategoryCarryover({ startMonth: JAN, category, flag: true });
  await settle();
}

// Adds an on-budget account with the credit card box ticked, as the
// Add-account dialog does
async function createCard(name: string, balance = 0) {
  const id = await runHandler(accountsApp.handlers['account-create'], {
    name,
    balance,
    creditCard: true,
  });
  await settle();
  const payment = await db.first<{ id: string }>(
    'SELECT id FROM categories WHERE payment_account = ? AND tombstone = 0',
    [id],
  );
  return { id, paymentId: payment?.id ?? '' };
}

// Food 30000, card -50000: the user's example
async function overspendOnCard() {
  await setFoodBudget(JAN, 30000);
  await tx('card', '2017-01-10', -50000, 'food');
  await settle();
}

describe('credit card payment categories', () => {
  beforeEach(global.emptyDatabase());
  afterEach(global.emptyDatabase());

  it('moves fully funded card spending to the payment category', async () => {
    await setup();
    await setFoodBudget(JAN, 50000);
    await tx('card', '2017-01-10', -40000, 'food');
    await settle();

    expect(value(JAN, 'leftover-food')).toBe(10000);
    expect(value(JAN, 'cash-leftover-food')).toBe(10000);
    expect(value(JAN, 'cc-moved-food-visa')).toBe(40000);
    expect(value(JAN, 'sum-amount-visa')).toBe(40000);
    expect(value(JAN, 'leftover-visa')).toBe(40000);
    expect(value(JAN, 'to-budget')).toBe(50000);
  });

  it('shows unfunded card spending as overspending that leaves To Budget alone', async () => {
    await setup();
    await overspendOnCard();

    expect(value(JAN, 'to-budget')).toBe(70000);
    expect(value(JAN, 'leftover-food')).toBe(-20000);
    expect(value(JAN, 'cc-debt-food-visa')).toBe(20000);
    expect(value(JAN, 'cash-leftover-food')).toBe(0);
    expect(value(JAN, 'leftover-visa')).toBe(30000);
    expect(value(FEB, 'leftover-food')).toBe(0);
    expect(value(FEB, 'cc-debt-food-visa')).toBe(0);
    // Stock Actual: 70000 - 20000
    expect(value(FEB, 'to-budget')).toBe(70000);
  });

  it('draws a card payment from the payment category', async () => {
    await setup();
    await overspendOnCard();
    await pay(30000, 'p1');

    expect(value(JAN, 'sum-amount-visa')).toBe(0);
    expect(value(JAN, 'leftover-visa')).toBe(0);
    expect(value(JAN, 'to-budget')).toBe(70000);
    expect(value(FEB, 'to-budget')).toBe(70000);
  });

  describe('transfers between cards', () => {
    async function legs(from: string, to: string, amount: number, id: string) {
      await tx(from, '2017-01-20', -amount, null, {
        id: `${id}-out`,
        transfer_id: `${id}-in`,
      });
      await tx(to, '2017-01-20', amount, null, {
        id: `${id}-in`,
        transfer_id: `${id}-out`,
      });
      await settle();
    }

    it('leaves both payment categories alone on a transfer between two cards', async () => {
      await setup({ amex: true });
      await setFoodBudget(JAN, 30000);
      await tx('card', '2017-01-10', -30000, 'food');
      await settle();
      await legs('card2', 'card', 30000, 'bt');

      expect(value(JAN, 'leftover-visa')).toBe(30000);
      expect(value(JAN, 'leftover-amex')).toBe(0);
      expect(value(JAN, 'cc-to-pay-visa')).toBe(0);
      expect(value(JAN, 'cc-to-pay-amex')).toBe(30000);
      expect(value(JAN, 'to-budget')).toBe(70000);
    });

    it('recounts a balance transfer re-pointed to checking as a payment', async () => {
      await setup({ amex: true });
      await setFoodBudget(JAN, 30000);
      await tx('card', '2017-01-10', -30000, 'food');
      await settle();
      await legs('card2', 'card', 30000, 'bt');
      const checkingPayee = await db.first<{ id: string }>(
        "SELECT id FROM payees WHERE transfer_acct = 'checking'",
      );
      await db.updateTransaction({ id: 'bt-out', account: 'checking' });
      await db.updateTransaction({ id: 'bt-in', payee: checkingPayee?.id });
      await settle();

      expect(value(JAN, 'leftover-visa')).toBe(0);
      expect(value(JAN, 'leftover-amex')).toBe(0);
      expect(value(JAN, 'cc-to-pay-amex')).toBe(0);
    });

    it('counts an uncategorised transfer from an off-budget account as a payment', async () => {
      await setup();
      await db.insertAccount({ id: 'loan', name: 'Loan', offbudget: 1 });
      await setFoodBudget(JAN, 30000);
      await tx('card', '2017-01-10', -30000, 'food');
      await settle();
      await legs('loan', 'card', 10000, 'ln');

      expect(value(JAN, 'leftover-visa')).toBe(20000);
    });
  });

  it('moves a refund back from the payment category', async () => {
    await setup();
    await setFoodBudget(JAN, 50000);
    await tx('card', '2017-01-10', -40000, 'food');
    await tx('card', '2017-01-15', 10000, 'food');
    await settle();

    expect(value(JAN, 'leftover-food')).toBe(20000);
    expect(value(JAN, 'cc-moved-food-visa')).toBe(30000);
    expect(value(JAN, 'leftover-visa')).toBe(30000);
  });

  describe('cash and card overspending in one category', () => {
    async function mixed(cashDate: string, cardDate: string) {
      await setup();
      await setFoodBudget(JAN, 30000);
      await tx('checking', cashDate, -35000, 'food');
      await tx('card', cardDate, -50000, 'food');
      await settle();
    }

    it('counts cash first', async () => {
      await mixed('2017-01-05', '2017-01-10');

      expect(value(JAN, 'leftover-food')).toBe(-55000);
      expect(value(JAN, 'cc-debt-food-visa')).toBe(50000);
      expect(value(JAN, 'cash-leftover-food')).toBe(-5000);
      expect(value(JAN, 'leftover-visa')).toBe(0);
    });

    it('rolls both over with rollover on', async () => {
      await mixed('2017-01-05', '2017-01-10');
      await rollover('food');

      expect(value(FEB, 'leftover-food')).toBe(-55000);
      expect(value(FEB, 'cc-debt-food-visa')).toBe(50000);
      expect(value(FEB, 'cash-leftover-food')).toBe(-5000);
      expect(value(FEB, 'to-budget')).toBe(70000);
    });

    it('deducts only the cash part from next month with rollover off', async () => {
      await mixed('2017-01-05', '2017-01-10');

      expect(value(FEB, 'leftover-food')).toBe(0);
      expect(value(FEB, 'cc-debt-food-visa')).toBe(0);
      // Stock Actual: 70000 - 55000
      expect(value(FEB, 'to-budget')).toBe(65000);
    });

    it('does not depend on the date of the cash spending', async () => {
      await mixed('2017-01-10', '2017-01-05');

      expect(value(JAN, 'leftover-visa')).toBe(0);
      expect(value(JAN, 'cc-debt-food-visa')).toBe(50000);
      expect(value(JAN, 'cash-leftover-food')).toBe(-5000);
    });
  });

  it('leaves the budget untouched with the flag off', async () => {
    await setup({ flag: false });
    await overspendOnCard();
    await pay(30000, 'p1');
    await tx('card', '2017-01-25', 5000, 'income');
    await settle();

    expect(value(JAN, 'leftover-food')).toBe(-20000);
    expect(value(JAN, 'sum-amount-visa')).toBe(0);
    expect(value(FEB, 'to-budget')).toBe(55000);
    expect(sheet.get().hasCell('budget201701!cc-debt-food-visa')).toBe(false);
  });

  it('covers carried card debt first when money arrives (rollover on)', async () => {
    await setup();
    await overspendOnCard();
    await rollover('food');
    await setFoodBudget(FEB, 25000);

    expect(value(FEB, 'cc-moved-food-visa')).toBe(20000);
    expect(value(FEB, 'sum-amount-visa')).toBe(20000);
    expect(value(FEB, 'leftover-visa')).toBe(50000);
    expect(value(FEB, 'leftover-food')).toBe(5000);
    expect(value(FEB, 'cash-leftover-food')).toBe(5000);
    expect(value(FEB, 'cc-debt-food-visa')).toBe(0);
    expect(value(FEB, 'to-budget')).toBe(45000);
  });

  it('lets a refund cancel unfunded debt before moving money back', async () => {
    await setup();
    await overspendOnCard();
    await tx('card', '2017-01-15', 15000, 'food');
    await settle();

    expect(value(JAN, 'cc-debt-food-visa')).toBe(5000);
    expect(value(JAN, 'cc-moved-food-visa')).toBe(30000);
    expect(value(JAN, 'leftover-visa')).toBe(30000);
    expect(value(JAN, 'leftover-food')).toBe(-5000);
    expect(value(JAN, 'cash-leftover-food')).toBe(0);
  });

  it('funds earlier card spending when the budget is raised', async () => {
    await setup();
    await overspendOnCard();
    await setFoodBudget(JAN, 50000);

    expect(value(JAN, 'leftover-food')).toBe(0);
    expect(value(JAN, 'cc-debt-food-visa')).toBe(0);
    expect(value(JAN, 'leftover-visa')).toBe(50000);
    expect(value(JAN, 'to-budget')).toBe(50000);
  });

  describe('two cards', () => {
    async function sameDay(amexOrder: number, visaOrder: number) {
      await setup({ amex: true });
      await setFoodBudget(JAN, 30000);
      await tx('card2', '2017-01-10', -20000, 'food', {
        id: 'amex-tx',
        sort_order: amexOrder,
      });
      await tx('card', '2017-01-10', -20000, 'food', {
        id: 'visa-tx',
        sort_order: visaOrder,
      });
      await settle();
    }

    it('funds equal same-day card spending in register order', async () => {
      await sameDay(1, 2);

      expect(value(JAN, 'leftover-amex')).toBe(20000);
      expect(value(JAN, 'leftover-visa')).toBe(10000);
      expect(value(JAN, 'cc-debt-food-visa')).toBe(10000);
      expect(value(JAN, 'cc-debt-food-amex')).toBe(0);
      expect(value(JAN, 'leftover-food')).toBe(-10000);
      expect(value(JAN, 'cash-leftover-food')).toBe(0);
    });

    it('re-splits funding when same-day transactions are reordered', async () => {
      await sameDay(1, 2);
      await db.updateTransaction({ id: 'amex-tx', sort_order: 3 });
      await settle();

      expect(value(JAN, 'leftover-visa')).toBe(20000);
      expect(value(JAN, 'leftover-amex')).toBe(10000);
      expect(value(JAN, 'cc-debt-food-amex')).toBe(10000);
    });

    it('funds the largest same-day purchase first', async () => {
      await setup({ amex: true });
      await setFoodBudget(JAN, 30000);
      await tx('card', '2017-01-10', -10000, 'food', { sort_order: 1 });
      await tx('card2', '2017-01-10', -25000, 'food', { sort_order: 2 });
      await settle();

      expect(value(JAN, 'leftover-amex')).toBe(25000);
      expect(value(JAN, 'leftover-visa')).toBe(5000);
      expect(value(JAN, 'cc-debt-food-visa')).toBe(5000);
      expect(value(JAN, 'cc-debt-food-amex')).toBe(0);
      expect(value(JAN, 'leftover-food')).toBe(-5000);
      expect(value(JAN, 'cash-leftover-food')).toBe(0);
    });

    it('funds earlier card spending before later spending on another card', async () => {
      await setup({ amex: true });
      await setFoodBudget(JAN, 30000);
      await tx('card2', '2017-01-05', -10000, 'food');
      await tx('card', '2017-01-10', -25000, 'food');
      await settle();

      expect(value(JAN, 'leftover-amex')).toBe(10000);
      expect(value(JAN, 'leftover-visa')).toBe(20000);
      expect(value(JAN, 'cc-debt-food-visa')).toBe(5000);
      expect(value(JAN, 'cc-debt-food-amex')).toBe(0);
    });

    it('covers carried debt in payment-category order', async () => {
      await setup({ amex: true });
      await rollover('food');
      await tx('card2', '2017-01-05', -20000, 'food');
      await tx('card', '2017-01-10', -30000, 'food');
      await settle();

      expect(value(JAN, 'leftover-food')).toBe(-50000);
      expect(value(JAN, 'cc-debt-food-amex')).toBe(20000);
      expect(value(JAN, 'cc-debt-food-visa')).toBe(30000);
      expect(value(JAN, 'leftover-visa')).toBe(0);
      expect(value(JAN, 'leftover-amex')).toBe(0);
      expect(value(JAN, 'to-budget')).toBe(100000);

      await setFoodBudget(FEB, 35000);

      expect(value(FEB, 'cc-moved-food-visa')).toBe(30000);
      expect(value(FEB, 'cc-moved-food-amex')).toBe(5000);
      expect(value(FEB, 'leftover-visa')).toBe(30000);
      expect(value(FEB, 'leftover-amex')).toBe(5000);
      expect(value(FEB, 'cc-debt-food-amex')).toBe(15000);
      expect(value(FEB, 'cc-debt-food-visa')).toBe(0);
      expect(value(FEB, 'leftover-food')).toBe(-15000);
      expect(value(FEB, 'cash-leftover-food')).toBe(0);
      expect(value(FEB, 'to-budget')).toBe(65000);
    });
  });

  it('counts a payment beyond the payment category as cash overspending', async () => {
    await setup();
    await overspendOnCard();
    await pay(60000, 'p1');

    expect(value(JAN, 'sum-amount-visa')).toBe(-30000);
    expect(value(JAN, 'leftover-visa')).toBe(-30000);
    expect(value(FEB, 'to-budget')).toBe(40000);
    expect(value(FEB, 'leftover-visa')).toBe(0);
  });

  it('follows a category deleted into another one', async () => {
    await setup();
    await overspendOnCard();
    await runHandler(budgetApp.handlers['category-delete'], {
      id: 'food',
      transferId: 'dining',
    });
    await settle();

    expect(value(JAN, 'leftover-dining')).toBe(-20000);
    expect(value(JAN, 'cc-debt-dining-visa')).toBe(20000);
    expect(value(JAN, 'leftover-visa')).toBe(30000);
  });

  it('rebuilds the budget when the flag is flipped', async () => {
    await setup({ flag: false });
    await overspendOnCard();

    await setFlag(true);
    await settle();
    expect(value(JAN, 'leftover-visa')).toBe(30000);
    expect(value(JAN, 'leftover-food')).toBe(-20000);
    expect(value(FEB, 'to-budget')).toBe(70000);

    await setFlag(false);
    await settle();
    expect(value(JAN, 'leftover-visa')).toBe(0);
    expect(value(FEB, 'to-budget')).toBe(50000);
  });

  it('creates a card with its payment category, and undoes it', async () => {
    await setup({ visa: false });
    const card = await createCard('Mastercard');
    const id = card.paymentId;
    expect(id).not.toBe('');
    await setFoodBudget(JAN, 30000);
    await tx(card.id, '2017-01-10', -50000, 'food');
    await settle();
    expect(value(JAN, `leftover-${id}`)).toBe(30000);

    await runMutator(() => undo());
    await settle();
    const tombstone = await db.first<{ tombstone: number }>(
      'SELECT tombstone FROM categories WHERE id = ?',
      [id],
    );
    expect(tombstone?.tombstone).toBe(1);
    expect(value(JAN, 'leftover-food')).toBe(-20000);
    expect(value(FEB, 'to-budget')).toBe(50000);
    // A rebuild keeps old graph edges, so the name can come back as an empty
    // node; it must not compute anything
    const stale = sheet.get().getNode(`budget201701!cc-debt-food-${id}`);
    expect(stale.dynamic).toBeFalsy();
    expect(stale.value).toBeNull();
  });

  it("leaves To Budget and the payment category alone for a new card's starting debt", async () => {
    await setup({ visa: false });
    const card = await createCard('Mastercard', -50);
    const starting = await db.first<{ category: string | null }>(
      'SELECT category FROM transactions WHERE acct = ? AND starting_balance_flag = 1',
      [card.id],
    );

    // Debt from before the budget: nothing to take from To Budget, nothing
    // set aside yet
    expect(starting?.category).toBeNull();
    expect(value(JAN, 'to-budget')).toBe(100000);
    expect(value(JAN, `leftover-${card.paymentId}`)).toBe(0);
    expect(value(JAN, `cc-to-pay-${card.paymentId}`)).toBe(5000);
  });

  it('pays down starting debt budgeted into the payment category', async () => {
    await setup({ visa: false });
    const card = await createCard('Mastercard', -500);
    await setBudget({ category: card.paymentId, month: JAN, amount: 50000 });
    await settle();
    expect(value(JAN, `leftover-${card.paymentId}`)).toBe(50000);
    expect(value(JAN, `cc-to-pay-${card.paymentId}`)).toBe(0);
    expect(value(JAN, 'to-budget')).toBe(50000);

    await pay(50000, 'p1', card.id);
    expect(value(JAN, `leftover-${card.paymentId}`)).toBe(0);
    expect(value(JAN, `cc-to-pay-${card.paymentId}`)).toBe(0);
  });

  it('shows an unbudgeted card payment as cash overspending', async () => {
    await setup({ visa: false });
    const card = await createCard('Mastercard', -500);
    await pay(50000, 'p1', card.id);

    expect(value(JAN, `leftover-${card.paymentId}`)).toBe(-50000);
    expect(value(JAN, `cc-to-pay-${card.paymentId}`)).toBe(0);
    expect(value(FEB, 'to-budget')).toBe(50000);
  });

  it('shows a partly paid, unbudgeted starting debt as cash overspending', async () => {
    await setup({ visa: false });
    const card = await createCard('Mastercard', -1000);
    await pay(50000, 'p1', card.id);

    // 500 of the debt is still not set aside, and the 500 paid without
    // budgeting is ordinary overspending
    expect(value(JAN, `leftover-${card.paymentId}`)).toBe(-50000);
    expect(value(JAN, `cc-to-pay-${card.paymentId}`)).toBe(50000);
  });

  it('follows edits of the starting debt and later months', async () => {
    await setup({ visa: false });
    const card = await createCard('Mastercard', -500);
    const starting = await db.first<{ id: string }>(
      'SELECT id FROM transactions WHERE acct = ? AND starting_balance_flag = 1',
      [card.id],
    );
    await db.updateTransaction({ id: starting?.id ?? '', amount: -80000 });
    await settle();
    expect(value(JAN, `cc-to-pay-${card.paymentId}`)).toBe(80000);
    expect(value(FEB, `cc-to-pay-${card.paymentId}`)).toBe(80000);

    await setBudget({ category: card.paymentId, month: JAN, amount: 30000 });
    await settle();
    expect(value(FEB, `cc-to-pay-${card.paymentId}`)).toBe(50000);
  });

  it('undoes adding a card with a starting debt', async () => {
    await setup({ visa: false });
    const card = await createCard('Mastercard', -500);
    await runMutator(() => undo());
    await settle();

    const left = await db.first<{ tombstone: number }>(
      'SELECT tombstone FROM categories WHERE id = ?',
      [card.paymentId],
    );
    expect(left?.tombstone).toBe(1);
    expect(value(JAN, 'to-budget')).toBe(100000);
  });

  it('shows unfunded card spending as not set aside', async () => {
    await setup();
    await overspendOnCard();
    expect(value(JAN, 'cc-to-pay-visa')).toBe(20000);

    await setFoodBudget(JAN, 50000);
    expect(value(JAN, 'cc-to-pay-visa')).toBe(0);
  });

  it('creates no to-pay cell with the flag off', async () => {
    await setup({ flag: false });
    expect(value(JAN, 'cc-to-pay-visa')).toBeNaN();
  });

  it('treats a cash advance as money set aside to repay it', async () => {
    await setup();
    // A transfer from the card into checking
    await tx('card', '2017-01-15', -10000, null, {
      id: 'adv-out',
      transfer_id: 'adv-in',
    });
    await tx('checking', '2017-01-15', 10000, null, {
      id: 'adv-in',
      transfer_id: 'adv-out',
    });
    await settle();

    expect(value(JAN, 'sum-amount-visa')).toBe(10000);
    expect(value(JAN, 'leftover-visa')).toBe(10000);
    expect(value(JAN, 'cc-to-pay-visa')).toBe(0);
    expect(value(JAN, 'to-budget')).toBe(100000);
  });

  it('funds the children of a split card transaction', async () => {
    await setup();
    await setFoodBudget(JAN, 50000);
    await setBudget({ category: 'dining', month: JAN, amount: 50000 });
    await db.insertTransaction({
      id: 'split',
      account: 'card',
      date: '2017-01-10',
      amount: -30000,
      category: null,
      is_parent: true,
    });
    await db.insertTransaction({
      id: 'split-food',
      account: 'card',
      date: '2017-01-10',
      amount: -20000,
      category: 'food',
      is_child: true,
      parent_id: 'split',
    });
    await db.insertTransaction({
      id: 'split-dining',
      account: 'card',
      date: '2017-01-10',
      amount: -10000,
      category: 'dining',
      is_child: true,
      parent_id: 'split',
    });
    await settle();

    expect(value(JAN, 'leftover-food')).toBe(30000);
    expect(value(JAN, 'leftover-dining')).toBe(40000);
    expect(value(JAN, 'sum-amount-visa')).toBe(30000);
    expect(value(JAN, 'leftover-visa')).toBe(30000);
    // The parent is not counted twice in the card balance
    expect(value(JAN, 'cc-to-pay-visa')).toBe(0);
    expect(value(JAN, 'to-budget')).toBe(0);
  });

  it('leaves the payment category alone on income on the card', async () => {
    await setup();
    await setFoodBudget(JAN, 50000);
    await tx('card', '2017-01-10', -40000, 'food');
    await tx('card', '2017-01-20', 5000, 'income');
    await settle();

    expect(value(JAN, 'sum-amount-visa')).toBe(40000);
    expect(value(JAN, 'leftover-visa')).toBe(40000);
    expect(value(JAN, 'to-budget')).toBe(55000);
  });

  it('leaves the card underfunded on negative income on the card', async () => {
    await setup();
    await setFoodBudget(JAN, 50000);
    await tx('card', '2017-01-10', -40000, 'food');
    await tx('card', '2017-01-20', -5000, 'income');
    await settle();

    expect(value(JAN, 'leftover-visa')).toBe(40000);
    expect(value(JAN, 'cc-to-pay-visa')).toBe(5000);
    expect(value(FEB, 'cc-to-pay-visa')).toBe(5000);
    expect(value(JAN, 'to-budget')).toBe(45000);
  });

  it('keeps working on values restored from the cache', async () => {
    await setup();
    await overspendOnCard();

    const snapshot = new Map<string, string | number | boolean>();
    for (const [name, node] of sheet.get().getNodes()) {
      if (name.startsWith('budget') && node.value != null) {
        snapshot.set(name, node.value);
      }
    }

    sheet.unloadSpreadsheet();
    await sheet.loadSpreadsheet(db);
    for (const [name, cached] of snapshot) {
      sheet.get().load(name, cached);
    }
    // A warm load trusts cached values: a derived cell is not recomputed
    sheet.get().load('budget201701!cc-debt-food-visa', 12345);
    await budget.createBudget([JAN, FEB]);
    await settle();
    expect(value(JAN, 'cc-debt-food-visa')).toBe(12345);
    expect(value(JAN, 'leftover-visa')).toBe(30000);

    await tx('card', '2017-01-25', -10000, 'food');
    await settle();
    expect(value(JAN, 'leftover-food')).toBe(-30000);
    expect(value(JAN, 'cc-debt-food-visa')).toBe(30000);
    expect(value(JAN, 'leftover-visa')).toBe(30000);
  });

  it('uses a refund on one card to cover debt on another', async () => {
    await setup({ amex: true });
    await tx('card', '2017-01-05', -20000, 'food');
    await tx('card2', '2017-01-10', 10000, 'food');
    await settle();

    expect(value(JAN, 'leftover-food')).toBe(-10000);
    expect(value(JAN, 'cc-moved-food-amex')).toBe(-10000);
    expect(value(JAN, 'cc-moved-food-visa')).toBe(10000);
    expect(value(JAN, 'cc-debt-food-visa')).toBe(10000);
    expect(value(JAN, 'cash-leftover-food')).toBe(0);
  });

  it('includes categories added while the feature is on', async () => {
    await setup();
    await db.insertCategory({
      id: 'travel',
      name: 'Travel',
      cat_group: 'group1',
    });
    await db.insertCategory({
      id: 'cashback',
      name: 'Cashback',
      cat_group: 'income-group',
      is_income: 1,
    });
    await settle();
    await setBudget({ category: 'travel', month: JAN, amount: 10000 });
    await tx('card', '2017-01-10', -5000, 'travel');
    await tx('card', '2017-01-12', 2000, 'cashback');
    await settle();

    expect(value(JAN, 'cc-moved-travel-visa')).toBe(5000);
    expect(value(JAN, 'sum-amount-visa')).toBe(5000);
  });

  it('follows card payments that are edited or deleted', async () => {
    await setup();
    await overspendOnCard();
    await pay(30000, 'p1');

    await db.updateTransaction({ id: 'p1-in', amount: 20000 });
    await settle();
    expect(value(JAN, 'sum-amount-visa')).toBe(10000);

    await db.deleteTransaction({ id: 'p1-in' });
    await settle();
    expect(value(JAN, 'sum-amount-visa')).toBe(30000);
  });

  it('covers carried debt in the new order after reordering payment categories', async () => {
    await setup({ amex: true });
    await rollover('food');
    await tx('card2', '2017-01-05', -20000, 'food');
    await tx('card', '2017-01-10', -30000, 'food');
    await settle();

    await db.update('categories', { id: 'amex', sort_order: -1 });
    await settle();
    await setFoodBudget(FEB, 35000);

    expect(value(FEB, 'cc-moved-food-amex')).toBe(20000);
    expect(value(FEB, 'cc-moved-food-visa')).toBe(15000);
    expect(value(FEB, 'cc-debt-food-visa')).toBe(15000);
  });

  it('skips payment categories in the average budget actions', async () => {
    await setup();
    await overspendOnCard();
    await set3MonthAvg({ month: FEB });
    await settle();

    expect(value(FEB, 'budget-visa')).toBe(0);
  });

  describe('payment categories belong to their card', () => {
    it('refuses to delete a payment category or its group', async () => {
      await setup();

      await expect(
        runHandler(budgetApp.handlers['category-delete'], { id: 'visa' }),
      ).rejects.toThrow('cannot be deleted');
      await expect(
        runHandler(budgetApp.handlers['category-group-delete'], { id: 'cc' }),
      ).rejects.toThrow('cannot be deleted');
    });

    it('creates no payment category for an off-budget card', async () => {
      await setup();
      const id = await runHandler(accountsApp.handlers['account-create'], {
        name: 'Loan',
        offBudget: true,
        creditCard: true,
      });

      const payment = await db.first<{ id: string }>(
        'SELECT id FROM categories WHERE payment_account = ?',
        [id],
      );
      expect(payment).toBeNull();
    });

    it('keeps the payment category named after the card and visible', async () => {
      await setup();
      await runHandler(budgetApp.handlers['category-update'], {
        id: 'visa',
        name: 'My card',
        group: 'cc',
        is_income: false,
        hidden: true,
      });
      await runHandler(budgetApp.handlers['category-group-update'], {
        id: 'cc',
        name: 'Credit Card Payments',
        is_income: false,
        hidden: true,
      });
      await runHandler(accountsApp.handlers['account-update'], {
        id: 'card',
        name: 'Visa Gold',
      });

      const visa = await db.first<{ name: string; hidden: number }>(
        "SELECT name, hidden FROM categories WHERE id = 'visa'",
      );
      const group = await db.first<{ hidden: number }>(
        "SELECT hidden FROM category_groups WHERE id = 'cc'",
      );
      expect(visa).toEqual({ name: 'Visa Gold', hidden: 0 });
      expect(group?.hidden).toBe(0);
    });

    describe('created through the API', () => {
      async function apiCreate(account: {
        name: string;
        offbudget?: boolean;
        creditCard?: boolean;
      }) {
        const handlers = installAPI({} as unknown as ServerHandlers);
        handlers['account-create'] = accountsApp.handlers['account-create'];
        await prefs.loadPrefs();
        const id = await handlers['api/account-create']({ account });
        return db.first<{ id: string }>(
          'SELECT id FROM categories WHERE payment_account = ? AND tombstone = 0',
          [id],
        );
      }

      it('creates a card through the API', async () => {
        await setup({ visa: false });
        expect(
          await apiCreate({ name: 'Mastercard', creditCard: true }),
        ).not.toBeNull();
      });

      it('ignores creditCard for an off-budget account created through the API', async () => {
        await setup({ visa: false });
        expect(
          await apiCreate({ name: 'Loan', offbudget: true, creditCard: true }),
        ).toBeNull();
      });

      it('numbers the payment category of a card named like another card', async () => {
        await setup({ visa: false });
        await apiCreate({ name: 'Klarna', creditCard: true });
        await apiCreate({ name: 'klarna', creditCard: true });
        const names = await db.all<{ name: string }>(
          'SELECT name FROM categories WHERE payment_account IS NOT NULL AND tombstone = 0 ORDER BY name',
        );
        expect(names.map(n => n.name)).toEqual(['Klarna', 'klarna (2)']);

        // Editing or renaming keeps the number while the names still collide
        const second = (await db.first<{ id: string; cat_group: string }>(
          "SELECT id, cat_group FROM categories WHERE name = 'klarna (2)'",
        ))!;
        await runHandler(budgetApp.handlers['category-update'], {
          id: second.id,
          name: 'whatever',
          group: second.cat_group,
          is_income: false,
          hidden: false,
        });
        const renamed = await db.first<{ name: string }>(
          'SELECT name FROM categories WHERE id = ?',
          [second.id],
        );
        expect(renamed?.name).toBe('klarna (2)');
      });

      it('hides the payment category when the card is closed through the API', async () => {
        await setup();
        const handlers = installAPI({} as unknown as ServerHandlers);
        await prefs.loadPrefs();
        await handlers['api/account-update']({
          id: 'card',
          fields: { closed: true },
        });
        const visa = await db.first<{ hidden: number }>(
          "SELECT hidden FROM categories WHERE id = 'visa'",
        );
        expect(visa?.hidden).toBe(1);
      });

      it('creates a plain account through the API without creditCard', async () => {
        await setup({ visa: false });
        expect(await apiCreate({ name: 'Savings' })).toBeNull();
      });
    });

    describe('hidden while the card is closed', () => {
      async function hidden(id = 'visa') {
        const row = await db.first<{ hidden: number }>(
          'SELECT hidden FROM categories WHERE id = ?',
          [id],
        );
        return row?.hidden;
      }

      async function closeCard() {
        // A card without transactions is deleted rather than closed
        await tx('card', '2017-01-05', 0, null);
        await runHandler(accountsApp.handlers['account-close'], { id: 'card' });
      }

      it('hides the payment category when the card is closed', async () => {
        await setup();
        await closeCard();
        expect(await hidden()).toBe(1);
      });

      it('shows the payment category when the card is reopened', async () => {
        await setup();
        await closeCard();
        await runHandler(accountsApp.handlers['account-reopen'], {
          id: 'card',
        });
        expect(await hidden()).toBe(0);
      });

      it('creates a hidden payment category for a card created closed', async () => {
        await setup({ visa: false });
        const id = await runHandler(accountsApp.handlers['account-create'], {
          name: 'Old card',
          closed: true,
          creditCard: true,
        });
        const payment = await db.first<{ hidden: number }>(
          'SELECT hidden FROM categories WHERE payment_account = ?',
          [id],
        );
        expect(payment?.hidden).toBe(1);
      });

      it('hides the payment category of a card closed with the feature off', async () => {
        await setup({ flag: false });
        await closeCard();
        expect(await hidden()).toBe(1);
      });

      it("keeps a closed card's payment category hidden when shown by hand", async () => {
        await setup();
        await closeCard();
        await runHandler(budgetApp.handlers['category-update'], {
          id: 'visa',
          name: 'Visa',
          group: 'cc',
          is_income: false,
          hidden: false,
        });
        expect(await hidden()).toBe(1);
      });
    });

    describe('edge cases', () => {
      const paymentOf = (account: string) =>
        db.first<{
          id: string;
          name: string;
          hidden: number;
          cat_group: string;
        }>(
          `SELECT id, name, hidden, cat_group FROM categories
            WHERE payment_account = ? AND tombstone = 0`,
          [account],
        );

      it('keeps a card that leaves and comes back on budget', async () => {
        await setup();
        await db.update('accounts', { id: 'card', offbudget: 1 });
        await settle();
        await db.update('accounts', { id: 'card', offbudget: 0 });
        await settle();
        await overspendOnCard();

        expect(value(JAN, 'leftover-visa')).toBe(30000);
      });

      it('stops counting a card payment once it is categorised', async () => {
        await setup();
        await overspendOnCard();
        await pay(30000, 'p1');
        await db.updateTransaction({ id: 'p1-in', category: 'income' });
        await settle();

        // Now income on the card: To Budget grows, the payment category keeps
        // what was moved into it
        expect(value(JAN, 'to-budget')).toBe(100000);
        expect(value(JAN, 'leftover-visa')).toBe(30000);
      });

      it('refuses a category update into a hidden group', async () => {
        await setup();
        await db.update('category_groups', { id: 'group1', hidden: 1 });

        await expect(
          runHandler(budgetApp.handlers['category-update'], {
            id: 'visa',
            name: 'Visa',
            group: 'group1',
            is_income: false,
          }),
        ).rejects.toThrow('hidden group');
      });

      it('adopts a category already named after the card', async () => {
        await setup({ visa: false });
        await db.insertCategory({
          id: 'manual',
          name: 'VISA',
          cat_group: 'cc',
        });
        const card = await createCard('Visa');

        expect((await paymentOf(card.id))?.id).toBe('manual');
        expect((await paymentOf(card.id))?.name).toBe('Visa');
      });

      it('lets a payment category be renamed with the feature off', async () => {
        await setup({ flag: false });
        await runHandler(budgetApp.handlers['category-update'], {
          id: 'visa',
          name: 'My card',
          group: 'cc',
          is_income: false,
        });
        const visa = await db.first<{ name: string }>(
          "SELECT name FROM categories WHERE id = 'visa'",
        );
        expect(visa?.name).toBe('My card');
      });

      it('releases the payment category of a deleted card', async () => {
        await setup();
        await db.update('accounts', { id: 'card', tombstone: 1 });
        await settle();

        await runHandler(budgetApp.handlers['category-delete'], { id: 'visa' });
        const visa = await db.first<{ tombstone: number }>(
          "SELECT tombstone FROM categories WHERE id = 'visa'",
        );
        expect(visa?.tombstone).toBe(1);
      });

      it('refuses to move a payment category into a hidden group', async () => {
        await setup();
        await db.update('category_groups', { id: 'group1', hidden: 1 });

        await expect(
          runHandler(budgetApp.handlers['category-move'], {
            id: 'visa',
            groupId: 'group1',
            targetId: null,
          }),
        ).rejects.toThrow('hidden group');
      });
    });

    it('puts a new Credit Card Payments group at the top', async () => {
      await setup({ visa: false });
      // No Credit Card Payments group yet
      db.runQuery("UPDATE category_groups SET tombstone = 1 WHERE id = 'cc'");
      await createCard('Visa');

      const [top] = await db.all<{ name: string }>(
        'SELECT name FROM category_groups WHERE tombstone = 0 AND is_income = 0 ORDER BY sort_order, id',
      );
      expect(top.name).toBe('Credit Card Payments');
    });

    it('does not let a category update change which card it pays', async () => {
      await setup();
      const update = (id: string, name: string, group: string) =>
        runHandler(budgetApp.handlers['category-update'], {
          id,
          name,
          group,
          is_income: false,
          payment_account: 'card2',
        });
      await update('visa', 'Visa card', 'cc');
      await update('food', 'Food', 'group1');

      const rows = await db.all<{ id: string; payment_account: string | null }>(
        "SELECT id, payment_account FROM categories WHERE id IN ('visa', 'food') ORDER BY id",
      );
      expect(rows).toEqual([
        { id: 'food', payment_account: null },
        { id: 'visa', payment_account: 'card' },
      ]);
    });

    it('keeps the starting balance categorised when the card option is ignored', async () => {
      await setup({ flag: false });
      const id = await runHandler(accountsApp.handlers['account-create'], {
        name: 'Mastercard',
        balance: -50,
        creditCard: true,
      });
      await settle();

      const starting = await db.first<{ category: string | null }>(
        'SELECT category FROM transactions WHERE acct = ? AND starting_balance_flag = 1',
        [id],
      );
      expect(starting?.category).not.toBeNull();
      expect(value(JAN, 'to-budget')).toBe(95000);
    });

    it('ignores the credit card option with the feature off', async () => {
      await setup({ flag: false });
      const id = await runHandler(accountsApp.handlers['account-create'], {
        name: 'Mastercard',
        creditCard: true,
      });

      const payment = await db.first<{ id: string }>(
        'SELECT id FROM categories WHERE payment_account = ?',
        [id],
      );
      expect(payment).toBeNull();
    });
  });
});
