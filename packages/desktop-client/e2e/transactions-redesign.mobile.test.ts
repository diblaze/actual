import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileAccountPage } from './page-models/mobile-account-page';
import { MobileNavigation } from './page-models/mobile-navigation';
import { MobileTransactionEntryPage } from './page-models/mobile-transaction-entry-page';

const PHONE = { width: 390, height: 844 };

// Under Playwright the app's today is 2017-01-01 (monthUtils.currentDay).
// Fresh budget with Checking (Grocer -23.50 cleared + Cafe -10.00 uncleared
// on 2016-12-30, Corner Market -412.35 imported as "CORNER MARKET 104" on
// 2016-12-28, a missed Rent and an upcoming Phone schedule), Savings, Visa
// card (an uncategorized City Arena -238.00), and a rule that sets Grocer's
// category to Food
async function seed(page: Page) {
  await page.evaluate(async () => {
    const $send = (
      window as unknown as {
        $send: <T>(type: string, args?: unknown) => Promise<T>;
      }
    ).$send;
    const { data: categories } = await $send<{
      data: Array<{ id: string; name: string }>;
    }>('query', {
      table: 'categories',
      tableOptions: {},
      filterExpressions: [{ name: 'Food' }],
      selectExpressions: ['id', 'name'],
      groupExpressions: [],
      orderExpressions: [],
      calculation: false,
      rawMode: false,
      withDead: false,
      validateRefs: true,
      limit: null,
      offset: null,
    });
    const food = categories[0].id;

    const checking = await $send<string>('account-create', {
      name: 'Checking',
      balance: 0,
    });
    await $send<string>('account-create', { name: 'Savings', balance: 0 });
    const visa = await $send<string>('account-create', {
      name: 'Visa card',
      balance: 0,
    });

    const payee = (name: string) => $send<string>('payee-create', { name });
    const grocer = await payee('Grocer');
    const cafe = await payee('Cafe');
    const rent = await payee('Rent');
    const phone = await payee('Phone');
    const market = await payee('Corner Market');
    const arena = await payee('City Arena');

    await $send('rule-add', {
      stage: null,
      conditionsOp: 'and',
      conditions: [{ op: 'is', field: 'payee', value: grocer }],
      actions: [{ op: 'set', field: 'category', value: food }],
    });

    await $send('transactions-batch-update', {
      added: [
        {
          id: crypto.randomUUID(),
          account: checking,
          date: '2016-12-30',
          amount: -2350,
          payee: grocer,
          category: food,
          notes: 'weekly shop',
          cleared: true,
        },
        {
          id: crypto.randomUUID(),
          account: checking,
          date: '2016-12-30',
          amount: -1000,
          payee: cafe,
          category: food,
          cleared: false,
        },
        {
          id: crypto.randomUUID(),
          account: checking,
          date: '2016-12-28',
          amount: -41235,
          payee: market,
          imported_payee: 'CORNER MARKET 104',
          category: food,
          cleared: true,
        },
        {
          id: crypto.randomUUID(),
          account: visa,
          date: '2016-12-31',
          amount: -23800,
          payee: arena,
          imported_payee: 'CITY ARENA TICKETS',
          cleared: true,
        },
      ],
    });

    const schedule = (name: string, payeeId: string, date: string) =>
      $send('schedule/create', {
        schedule: { name, posts_transaction: false },
        conditions: [
          { op: 'is', field: 'account', value: checking },
          { op: 'is', field: 'payee', value: payeeId },
          { op: 'is', field: 'date', value: date },
          { op: 'is', field: 'amount', value: -5000 },
        ],
      });
    await schedule('Rent', rent, '2016-12-29');
    await schedule('Phone', phone, '2017-01-04');
  });
}

test.describe('Mobile transactions redesign', () => {
  let page: Page;
  let navigation: MobileNavigation;
  let accountPage: MobileAccountPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new MobileNavigation(page);

    await page.goto('/');
    await new ConfigurationPage(page).startFresh();
    await seed(page);
    await page.setViewportSize(PHONE);
    await page.reload();

    const accountsPage = await navigation.goToAccountsPage();
    await accountsPage.accountListItems.filter({ hasText: 'Checking' }).click();
    accountPage = new MobileAccountPage(page);
    await accountPage.waitFor();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  function row(name: string) {
    return accountPage.transactionList
      .getByRole('option')
      .filter({ hasText: name });
  }

  test('upcoming badges', async () => {
    const upcoming = accountPage.transactionList.getByRole('group', {
      name: 'Upcoming',
    });
    await expect(upcoming.getByRole('option')).toHaveCount(2);
    await expect(
      upcoming.getByRole('option').filter({ hasText: 'Rent' }),
    ).toContainText('Overdue');
    await expect(
      upcoming.getByRole('option').filter({ hasText: 'Phone' }),
    ).toContainText('Upcoming');
  });

  test('day total', async () => {
    const day = accountPage.transactionList
      .getByRole('group')
      .filter({ has: page.getByRole('option').filter({ hasText: 'Cafe' }) });
    await expect(day.getByTestId('section-total')).toHaveText('-33.50');
  });

  test('cleared label', async () => {
    await expect(
      row('Grocer').getByRole('img', { name: 'Cleared' }),
    ).toHaveCount(1);
    await expect(row('Cafe').getByRole('img', { name: 'Cleared' })).toHaveCount(
      0,
    );
  });

  test('transactions tab', async () => {
    await navigation.goToTransactionsPage();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Transactions',
    );
    await expect(row('Grocer')).toContainText('Checking');
    await expect(row('City Arena')).toContainText('Visa card');
  });

  test('uncategorized show', async () => {
    await navigation.goToTransactionsPage();

    await page
      .getByRole('group', { name: '1 Uncategorized' })
      .getByRole('button', { name: 'Show' })
      .click();
    await expect(page).toHaveURL(/\/categories\/uncategorized$/);
  });

  test('row chip', async () => {
    const market = row('Corner Market');
    await expect(market.getByTestId('category-chip')).toHaveText('Food');
    await expect(market).toContainText('CORNER MARKET 104');
    await expect(market).toContainText('-412.35');
    // The account name is shown on the all-accounts list only
    await expect(market).not.toContainText('Checking');
  });

  test('uncategorized chip', async () => {
    await navigation.goToTransactionsPage();

    const chip = row('City Arena').getByTestId('category-chip');
    await expect(chip).toHaveText('Uncategorized');
    await expect(chip.locator('svg')).toHaveCount(1);
  });

  test('sheet over previous', async () => {
    const budgetPage = await navigation.goToBudgetPage();
    await navigation.addButton.click();

    const sheet = page.getByRole('dialog', { name: 'New Transaction' });
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/\/transactions\/new$/);
    await expect(
      sheet
        .getByTestId('transaction-sheet-header')
        .getByRole('group', { name: 'Amount' }),
    ).toBeVisible();
    // A sheet from below, the budget still rendered behind it
    expect((await sheet.boundingBox())!.y).toBeGreaterThan(40);
    await expect(budgetPage.budgetTable).toBeVisible();
  });

  async function openRow(name: string) {
    await row(name).click();
    const entryPage = new MobileTransactionEntryPage(page);
    await entryPage.waitFor();
    return entryPage;
  }

  test('income', async () => {
    const entryPage = await openRow('Grocer');
    await page.getByRole('radio', { name: 'Income' }).click();
    await entryPage.footer
      .getByRole('button', { name: 'Save changes' })
      .click();

    await expect(row('Grocer')).toContainText('+23.50');
  });

  test('transfer', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.header.click();
    await page.getByRole('radio', { name: 'Transfer' }).click();

    // Picking Transfer opens the payee picker with accounts only
    const items = page
      .getByTestId('payee-autocomplete-modal')
      .locator('[data-testid$="-payee-item"]');
    await expect(items.filter({ hasText: 'Savings' })).toHaveCount(1);
    await expect(items.filter({ hasText: 'Visa card' })).toHaveCount(1);
    await expect(items.filter({ hasText: 'Grocer' })).toHaveCount(0);
    await expect(items.filter({ hasText: 'Cafe' })).toHaveCount(0);

    await items.filter({ hasText: 'Savings' }).click();
    await expect(page.getByTestId('payee-field')).toContainText('Savings');
    await expect(page.getByRole('radio', { name: 'Transfer' })).toBeChecked();
  });

  test('transfer cancel', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.header.click();
    await page.getByRole('radio', { name: 'Transfer' }).click();

    // Closing the account picker without a choice keeps the old type
    const picker = page.getByTestId('payee-autocomplete-modal');
    await picker.getByRole('button', { name: 'Close' }).click();
    await expect(picker).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Expense' })).toBeChecked();
    await expect(
      page.getByRole('radio', { name: 'Transfer' }),
    ).not.toBeChecked();
  });

  test('deep link editor', async () => {
    // Opened straight from the URL: no previous screen to show behind it
    await page.goto('/transactions/new');
    const entryPage = new MobileTransactionEntryPage(page);
    await entryPage.waitFor();

    await expect(entryPage.header).toHaveText('New Transaction');
    await expect(accountPage.transactionList).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
    // The editor fills the page from the top instead of sitting as a sheet
    expect((await entryPage.sheetHeader.boundingBox())!.y).toBeLessThan(40);
  });

  test('escape closes sheet', async () => {
    const registerUrl = page.url();
    await openRow('Cafe');
    await expect(
      page.getByRole('dialog', { name: 'Transaction' }),
    ).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(registerUrl);
    await expect(row('Cafe')).toBeVisible();
  });

  test('add transaction', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.fillAmount('23.50');
    await entryPage.header.click();
    await entryPage.fillField(page.getByTestId('payee-field'), 'Cafe');

    // The primary spans the row; "Save + new" is the narrower secondary
    const saveNew = entryPage.footer.getByRole('button', {
      name: 'Save + new',
    });
    const addBox = (await entryPage.addTransactionButton.boundingBox())!;
    expect(addBox.width).toBeGreaterThan((await saveNew.boundingBox())!.width);
    await entryPage.addTransactionButton.click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(row('Cafe')).toHaveCount(2);
    await expect(row('Cafe').first()).toContainText('-23.50');
  });

  test('delete via menu', async () => {
    const entryPage = await openRow('Cafe');
    await expect(
      entryPage.transactionForm.getByRole('button', {
        name: 'Delete transaction',
      }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'More actions' }).click();
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Delete' })
      .click();
    await page
      .getByRole('dialog', { name: 'Confirm Delete' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await accountPage.waitFor();
    await expect(row('Grocer')).toHaveCount(1);
    await expect(row('Cafe')).toHaveCount(0);
  });

  test('cancel', async () => {
    const entryPage = await openRow('Grocer');
    const notes = entryPage.transactionForm.getByPlaceholder(
      'Add a note (optional)',
    );
    await notes.fill('changed');
    await notes.blur();
    await entryPage.cancelButton.click();

    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(row('Grocer')).toContainText('weekly shop');
    await expect(row('Grocer')).not.toContainText('changed');
  });

  test('save and new', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.fillAmount('23.50');
    await entryPage.header.click();
    await entryPage.fillField(page.getByTestId('payee-field'), 'Cafe');
    await entryPage.footer.getByRole('button', { name: 'Save + new' }).click();

    await expect(entryPage.header).toHaveText('New Transaction');
    await expect(page.getByTestId('payee-field')).not.toContainText('Cafe');
    // The amount is back to zero, not just hidden
    const amount = entryPage.sheetHeader.getByRole('group', { name: 'Amount' });
    await expect(amount).toContainText('0.00');
    await expect(amount).not.toContainText('23.50');
    await expect(page.getByTestId('account-field')).toHaveText('Checking');

    await entryPage.cancelButton.click();
    await expect(row('Cafe')).toHaveCount(2);
    await expect(row('Cafe').first()).toContainText('-23.50');
  });

  test('save and new keeps typed values', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.fillAmount('23.50');
    await entryPage.header.click();
    await entryPage.footer.getByRole('button', { name: 'Save + new' }).click();
    // Type straight away, before the save finishes
    await entryPage.amountField.fill('7.25');
    await entryPage.amountField.blur();

    // The save landing must not re-fill the reset form
    await page.waitForTimeout(1000);
    await expect(
      entryPage.transactionForm.getByRole('button').filter({ hasText: '7.25' }),
    ).toHaveCount(1);
  });

  test('no sign button', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.fillAmount('23.50');
    await entryPage.header.click();

    // The sign comes from the type under the header amount only
    await expect(
      entryPage.transactionForm.getByRole('button', { name: /^[-+−]$/ }),
    ).toHaveCount(0);
    const type = page.getByRole('radiogroup', { name: 'Type' });
    await expect(type.getByRole('radio')).toHaveText([
      'Expense',
      'Income',
      'Transfer',
    ]);
    await expect(type.getByRole('radio', { name: 'Expense' })).toBeChecked();
    const amount = entryPage.transactionForm
      .getByRole('button')
      .filter({ hasText: '23.50' });
    expect((await type.boundingBox())!.y).toBeGreaterThan(
      (await amount.boundingBox())!.y,
    );
    await expect(entryPage.amountField).toHaveAttribute('inputmode', 'decimal');
  });

  test('field rows', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.header.click();

    const cards = entryPage.transactionForm.getByTestId('field-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).getByTestId('field-label')).toHaveText([
      'Payee',
      'Category',
      'Account',
      'Date',
    ]);
    await expect(cards.nth(1).getByTestId('field-label')).toHaveText([
      'Notes',
      'Cleared',
    ]);
    const rows = entryPage.transactionForm.getByTestId('field-row');
    for (const row of await rows.all()) {
      const rowBox = (await row.boundingBox())!;
      expect(rowBox.height).toBeGreaterThanOrEqual(44);
      const label = row.getByTestId('field-label');
      const labelBox = (await label.boundingBox())!;
      // Label at the row's left edge, its value beside it
      expect(labelBox.x - rowBox.x).toBeLessThanOrEqual(20);
      expect(labelBox.y).toBeGreaterThanOrEqual(rowBox.y);
      expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(
        rowBox.y + rowBox.height,
      );
      const labelSize = await label.evaluate(el =>
        parseFloat(getComputedStyle(el).fontSize),
      );
      expect(labelSize).toBeGreaterThanOrEqual(13);
      expect(labelSize).toBeLessThanOrEqual(14);
    }
    for (const id of ['payee-field', 'category-field', 'account-field']) {
      const field = page.getByTestId(id);
      expect(
        await field.evaluate(el =>
          Math.max(
            ...[...el.querySelectorAll('*')]
              .filter(e =>
                [...e.childNodes].some(
                  n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
                ),
              )
              .map(e => parseFloat(getComputedStyle(e).fontSize)),
          ),
        ),
      ).toBe(16);
    }
    await expect(
      rows
        .filter({ has: page.getByTestId('field-label').getByText('Cleared') })
        .locator('input[type="checkbox"]'),
    ).toHaveCount(1);
  });

  test('payee chip', async () => {
    const entryPage = await navigation.goToTransactionEntryPage();
    await entryPage.header.click();
    const chip = page
      .getByRole('group', { name: 'Recent payees' })
      .getByRole('button', { name: 'Grocer' });
    await expect(chip).toBeVisible();
    expect((await chip.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await chip.click();

    await expect(page.getByTestId('payee-field')).toHaveText('Grocer');
    // Grocer's rule filled the category in, and the row says so
    await expect(page.getByTestId('category-field')).toHaveText(
      'Foodfrom Grocer',
    );
    await expect(page.getByTestId('category-hint')).toHaveText('from Grocer');

    // Picking a category by hand drops the hint
    await entryPage.fillField(page.getByTestId('category-field'), 'General');
    await expect(page.getByTestId('category-hint')).toHaveCount(0);
  });

  async function startSplit() {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.fillAmount('100.00');
    await entryPage.header.click();
    await entryPage.transactionForm
      .getByRole('button', { name: 'Split' })
      .click();
    const splits = entryPage.transactionForm.getByTestId('split-transaction');
    await expect(splits).toHaveCount(2);
    const fillSplit = async (index: number, amount: string) => {
      const input = splits.nth(index).getByRole('textbox').first();
      await input.fill(amount);
      // Tap elsewhere in the sheet: a bare blur() leaves focus on the
      // page, and the sheet's focus scope puts it back in the field
      await entryPage.header.click();
      await expect(input).not.toBeFocused();
    };
    await fillSplit(0, '60.00');
    return { entryPage, fillSplit };
  }

  test('split unbalanced', async () => {
    const { entryPage } = await startSplit();

    await expect(entryPage.footer).toContainText('-40.00');
    await expect(entryPage.addTransactionButton).toBeDisabled();
  });

  test('split balanced', async () => {
    const { entryPage, fillSplit } = await startSplit();
    await fillSplit(1, '40.00');

    await expect(entryPage.addTransactionButton).toBeEnabled();
    await entryPage.addTransactionButton.click();

    await expect(row('Split')).toContainText('-100.00');
  });

  test('payee create', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.header.click();
    await page.getByTestId('payee-field').click();
    await page
      .getByRole('combobox')
      .locator('input')
      .pressSequentially('Corner Bakery');

    const first = page
      .locator(
        '[data-testid="create-payee-button"], [data-testid$="-payee-item"]',
      )
      .first();
    await expect(first).toHaveText('Create payee "Corner Bakery"');
    expect((await first.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  });

  test('payee picker full screen', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.header.click();
    await page.getByTestId('payee-field').click();

    const dialog = page
      .getByTestId('payee-autocomplete-modal')
      .getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
    await expect
      .poll(async () => {
        const rect = (await dialog.boundingBox())!;
        return (
          rect.y <= 1 &&
          rect.x <= 1 &&
          rect.width >= PHONE.width - 1 &&
          rect.height >= PHONE.height - 1
        );
      })
      .toBe(true);
  });

  test('short menu still sheet', async () => {
    await accountPage.accountMenuButton.click();
    const sheet = page.getByTestId('account-menu-modal').getByRole('dialog');
    await expect(sheet).toBeVisible();
    expect((await sheet.boundingBox())!.y).toBeGreaterThan(100);
    await page.keyboard.press('Escape');

    // The editor's overflow menu stays short too
    await openRow('Cafe');
    await page.getByRole('button', { name: 'More actions' }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    expect((await menu.boundingBox())!.height).toBeLessThan(PHONE.height / 2);
  });

  test('payee transfers', async () => {
    const entryPage = await accountPage.clickCreateTransaction();
    await entryPage.header.click();
    await page.getByTestId('payee-field').click();

    const heading = page.getByRole('heading', { name: 'Transfer To/From' });
    await expect(heading).toBeVisible();
    const order = await page
      .locator('[role="heading"], [data-testid$="-payee-item"]')
      .evaluateAll(els => els.map(el => el.textContent));
    const transfers = order.indexOf('Transfer To/From');
    expect(order.indexOf('Savings')).toBeGreaterThan(transfers);
    expect(order.indexOf('Grocer')).toBeLessThan(transfers);
  });
});
