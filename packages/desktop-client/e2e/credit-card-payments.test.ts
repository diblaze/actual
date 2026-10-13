import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { BudgetPage } from './page-models/budget-page';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

// The app runs in January 2017 under Playwright
const JAN = '2017-01';
const FEB = '2017-02';
const FEATURE = 'Credit card payment categories';

test.describe('Credit card payments', () => {
  let page: Page;
  let navigation: Navigation;
  let budgetPage: BudgetPage;

  // Checking holds 1,000.00 (To Budget 1,000.00); Visa is a new card without
  // a balance; Food is the new budget's empty Usual Expenses category
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);
    const configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    await configurationPage.startFresh();
    const settingsPage = await navigation.goToSettingsPage();
    await settingsPage.setExperimentalFeature(FEATURE, true);

    await navigation.createAccount({
      name: 'Checking',
      balance: 1000,
      offBudget: false,
    });
    await navigation.createAccount({
      name: 'Visa',
      balance: 0,
      offBudget: false,
      creditCard: true,
    });
    budgetPage = await navigation.goToBudgetPage();
    await page.mouse.move(0, 0);
  });

  test.afterEach(async () => {
    await page?.close();
  });

  async function addTransaction(
    account: string,
    transaction: {
      payee: string;
      category?: string;
      debit?: string;
      credit?: string;
    },
  ) {
    const accountPage = await navigation.goToAccountPage(account);
    await accountPage.waitFor();
    await accountPage.createSingleTransaction(transaction);
    return accountPage;
  }

  async function openBudget() {
    budgetPage = await navigation.goToBudgetPage();
    await page.mouse.move(0, 0);
  }

  // Balances in cents, polled until the budget has recalculated
  async function expectBalances(expected: Record<string, number>, month = JAN) {
    for (const [name, cents] of Object.entries(expected)) {
      await expect
        .poll(
          () =>
            name === 'To Budget'
              ? budgetPage.getToBudget(month)
              : budgetPage.getBalanceForCategory(name, month),
          { message: `${name} in ${month}` },
        )
        .toBe(cents);
    }
  }

  test('spends within budget on the card', async () => {
    await budgetPage.setBudgetedAmount('Food', '500');
    await addTransaction('Visa', {
      payee: 'Grocer',
      category: 'Food',
      debit: '300.00',
    });
    await openBudget();

    await expectBalances({ Food: 20000, Visa: 30000, 'To Budget': 50000 });
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();
  });

  test('shows card overspending as a warning that does not reduce next month', async () => {
    await budgetPage.setBudgetedAmount('Food', '300');
    await addTransaction('Visa', {
      payee: 'Grocer',
      category: 'Food',
      debit: '500.00',
    });
    await openBudget();

    await expectBalances({ Food: -20000, Visa: 30000, 'To Budget': 70000 });
    const foodTooltip = await budgetPage.hoverBalance('Food', JAN);
    await expect(foodTooltip).toContainText(
      '200.00 of card spending was not covered',
    );
    await expect(foodTooltip).toMatchThemeScreenshots();
    await page.mouse.move(0, 0);
    await expect(await budgetPage.hoverBalance('Visa', JAN)).toContainText(
      '200.00 of the card balance is not set aside',
    );
    await page.mouse.move(0, 0);
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();

    await budgetPage.goToNextMonth();
    await expectBalances({ Food: 0, Visa: 30000, 'To Budget': 70000 }, FEB);
  });

  test('settles the payment category on a refund and a card payment', async () => {
    await budgetPage.setBudgetedAmount('Food', '500');
    await addTransaction('Visa', {
      payee: 'Grocer',
      category: 'Food',
      debit: '300.00',
    });
    await addTransaction('Visa', {
      payee: 'Grocer',
      category: 'Food',
      credit: '100.00',
    });
    await openBudget();
    await expectBalances({ Food: 30000, Visa: 20000 });

    const visa = await addTransaction('Visa', {
      payee: 'Checking',
      credit: '200.00',
    });
    await expect(visa.getNthTransaction(0).category).toHaveText('Transfer');
    await expect(visa.accountBalance).toHaveText('0.00');
    await openBudget();

    await expectBalances({ Food: 30000, Visa: 0, 'To Budget': 50000 });
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();
  });

  test('creates payment categories only when adding a card and locks them', async () => {
    const firstGroup = budgetPage.budgetTable
      .getByTestId('row')
      .filter({ hasText: /Credit Card Payments|Usual Expenses/ })
      .first();
    await expect(firstGroup).toContainText('Credit Card Payments');
    await expect(budgetPage.getCategoryRow('Visa')).toBeVisible();
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();

    // An account cannot become a card later
    const visa = await navigation.goToAccountPage('Visa');
    await visa.accountMenuButton.click();
    const accountMenu = page.getByRole('menu');
    await expect(accountMenu).toBeVisible();
    await expect(accountMenu).not.toContainText('credit card');
    await page.keyboard.press('Escape');

    // A card cannot be off budget
    await page.getByRole('button', { name: 'Add account' }).click();
    const dialog = page.getByRole('dialog');
    const creditCard = dialog.getByLabel('Credit card', { exact: true });
    await expect(creditCard).toBeVisible();
    await dialog.getByLabel('Off budget').click();
    await expect(creditCard).toBeHidden();
    await dialog.getByLabel('Off budget').click();
    await expect(creditCard).toBeVisible();
    await expect(dialog).toMatchThemeScreenshots();
    await page.keyboard.press('Escape');

    await openBudget();
    const menu = page.getByRole('menu');
    await budgetPage
      .getCategoryRow('Food')
      .getByTestId('category-name')
      .click({ button: 'right' });
    await expect(menu.getByRole('button', { name: 'Rename' })).toBeVisible();
    await page.keyboard.press('Escape');

    // The payment category has no menu at all
    await budgetPage
      .getCategoryRow('Visa')
      .getByTestId('category-name')
      .click({ button: 'right' });
    // Nothing to wait for: give a menu the time it would take to open
    await page.waitForTimeout(500);
    await expect(menu).toBeHidden();

    // Its group can be renamed, but not hidden or deleted
    await budgetPage.rightClickCategoryGroup('Credit Card Payments');
    await expect(menu.getByRole('button', { name: 'Rename' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Hide' })).toHaveCount(0);
    await expect(menu.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('funds the card only with what cash spending leaves', async () => {
    await budgetPage.setBudgetedAmount('Food', '500');
    await addTransaction('Checking', {
      payee: 'Market',
      category: 'Food',
      debit: '300.00',
    });
    await addTransaction('Visa', {
      payee: 'Grocer',
      category: 'Food',
      debit: '1000.00',
    });
    await openBudget();

    // Cash is counted first: 200.00 is left to fund the card, 800.00 stays
    // on the card as debt
    await expectBalances({ Food: -80000, Visa: 20000, 'To Budget': 50000 });
    await expect(
      budgetPage.getCategoryRow('Food').getByTestId('category-month-spent'),
    ).toHaveText('-1,300.00');
    await expect(await budgetPage.hoverBalance('Food', JAN)).toContainText(
      '800.00 of card spending was not covered',
    );
    await page.mouse.move(0, 0);
    await expect(await budgetPage.hoverBalance('Visa', JAN)).toContainText(
      '800.00 of the card balance is not set aside',
    );
    await page.mouse.move(0, 0);
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();
  });

  test('keeps pre-existing card debt out of To Budget', async () => {
    await navigation.createAccount({
      name: 'Mastercard',
      balance: -500,
      offBudget: false,
      creditCard: true,
    });
    await openBudget();

    await expectBalances({ Mastercard: 0, 'To Budget': 100000 });
    // The badge appears once the uncategorised count is loaded; give it time
    await page.waitForTimeout(500);
    await expect(
      page.locator('a[href="/categories/uncategorized"]'),
    ).toBeHidden();
    const tooltip = await budgetPage.hoverBalance('Mastercard', JAN);
    await expect(tooltip).toContainText(
      '500.00 of the card balance is not set aside',
    );
    await expect(tooltip).toMatchThemeScreenshots();
    await page.mouse.move(0, 0);
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();

    await budgetPage.setBudgetedAmount('Mastercard', '500');
    await expectBalances({ Mastercard: 50000, 'To Budget': 50000 });

    const mastercard = await addTransaction('Mastercard', {
      payee: 'Checking',
      credit: '500.00',
    });
    await expect(mastercard.accountBalance).toHaveText('0.00');
    await openBudget();
    await expectBalances({ Mastercard: 0, 'To Budget': 50000 });
  });

  test('follows edits and deletion of a card purchase', async () => {
    await budgetPage.setBudgetedAmount('Food', '500');
    const visa = await addTransaction('Visa', {
      payee: 'Grocer',
      category: 'Food',
      debit: '300.00',
    });

    const purchase = visa.getNthTransaction(0);
    await purchase.debit.click();
    const debitInput = purchase.debit.getByRole('textbox');
    await debitInput.selectText();
    await debitInput.pressSequentially('100.00');
    await page.keyboard.press('Tab');
    await expect(purchase.debit).toHaveText('100.00');
    await openBudget();
    await expectBalances({ Food: 40000, Visa: 10000 });
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();

    const register = await navigation.goToAccountPage('Visa');
    await register.waitFor();
    await register.rightClickNthTransaction(0);
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Delete' })
      .click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(register.transactionTableRow).toHaveCount(0);
    await openBudget();
    await expectBalances({ Food: 50000, Visa: 0 });
  });

  test('carries card debt with rollover on and covers it first next month', async () => {
    await budgetPage.setBudgetedAmount('Food', '300');
    await addTransaction('Visa', {
      payee: 'Grocer',
      category: 'Food',
      debit: '500.00',
    });
    await openBudget();
    await expectBalances({ Food: -20000, Visa: 30000, 'To Budget': 70000 });

    await budgetPage
      .getCategoryRow('Food')
      .getByTestId('balance')
      .first()
      .click();
    await page.getByRole('button', { name: 'Rollover overspending' }).click();

    await budgetPage.goToNextMonth();
    await budgetPage.setBudgetedAmount('Food', '250');
    // The new money covers the 200.00 card debt first and moves it to Visa
    await expectBalances({ Food: 5000, Visa: 50000, 'To Budget': 45000 }, FEB);
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();
  });

  test('turns payment categories back into plain categories with the flag off', async () => {
    await budgetPage.setBudgetedAmount('Food', '500');
    await addTransaction('Visa', {
      payee: 'Grocer',
      category: 'Food',
      debit: '300.00',
    });

    let settingsPage = await navigation.goToSettingsPage();
    await settingsPage.setExperimentalFeature(FEATURE, false);
    await openBudget();
    await expectBalances({ Food: 20000, Visa: 0, 'To Budget': 50000 });
    await expect(budgetPage.budgetTable).toMatchThemeScreenshots();
    await budgetPage
      .getCategoryRow('Visa')
      .getByTestId('category-name')
      .click({ button: 'right' });
    await expect(
      page.getByRole('menu').getByRole('button', { name: 'Rename' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    settingsPage = await navigation.goToSettingsPage();
    await settingsPage.setExperimentalFeature(FEATURE, true);
    await openBudget();
    await expectBalances({ Food: 20000, Visa: 30000 });
  });

  test('renames the payment category with the card', async () => {
    const visa = await navigation.goToAccountPage('Visa');
    await visa.waitFor();
    await page.getByRole('button', { name: 'Edit account name' }).click();
    const nameInput = page
      .getByRole('textbox')
      .and(page.locator('input[value="Visa"]'));
    await nameInput.fill('Visa Gold');
    await nameInput.press('Enter');
    await expect(visa.accountName).toHaveText('Visa Gold');

    await openBudget();
    await expect(budgetPage.getCategoryRow('Visa Gold')).toBeVisible();
    await expect(budgetPage.getCategoryRow('Visa')).toHaveCount(0);
  });
});
