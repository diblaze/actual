import { join } from 'path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { AccountPage } from './page-models/account-page';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

test.describe('Accounts', () => {
  let page: Page;
  let navigation: Navigation;
  let configurationPage: ConfigurationPage;
  let accountPage: AccountPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    await configurationPage.createTestFile();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('creates a new account and views the initial balance transaction', async () => {
    accountPage = await navigation.createAccount({
      name: 'New Account',
      offBudget: false,
      balance: 100,
    });

    const transaction = accountPage.getNthTransaction(0);
    await expect(transaction.payee).toHaveText('Starting Balance');
    await expect(transaction.notes).toHaveText('');
    await expect(transaction.category).toHaveText('Starting Balances');
    await expect(transaction.debit).toHaveText('');
    await expect(transaction.credit).toHaveText('100.00');
    await expect(page).toMatchThemeScreenshots();
  });

  test('account register widens amount columns for large balances', async () => {
    accountPage = await navigation.createAccount({
      name: 'Large Balance Account',
      offBudget: false,
      balance: 12345678.9,
    });

    const transaction = accountPage.getNthTransaction(0);
    await expect(transaction.credit).toHaveText('12,345,678.90');

    const creditBox = await transaction.credit.boundingBox();
    expect(creditBox?.width).toBeGreaterThan(100); // default width is 100px

    await expect(page).toMatchThemeScreenshots();
  });

  test('closes an account', async () => {
    accountPage = await navigation.goToAccountPage('Roth IRA');

    await expect(accountPage.accountName).toHaveText('Roth IRA');

    const modal = await accountPage.clickCloseAccount();
    await modal.selectTransferAccount('Vanguard 401k');
    await expect(page).toMatchThemeScreenshots();
    await modal.closeAccount();

    await expect(accountPage.accountName).toHaveText('Closed: Roth IRA');
    await expect(page).toMatchThemeScreenshots();
  });

  test('right clicking an account in sidebar opens context menu', async () => {
    await navigation.rightClickAccount('Roth IRA');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Rename' })).toBeVisible();
  });

  test('right clicking a transaction row opens context menu', async () => {
    accountPage = await navigation.createAccount({
      name: 'New Account',
      offBudget: false,
      balance: 100,
    });

    await accountPage.rightClickNthTransaction(0);
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('updates the running balance after editing a transaction amount', async () => {
    accountPage = await navigation.createAccount({
      name: 'Running balance',
      offBudget: false,
      balance: 0,
    });
    await accountPage.waitFor();
    await accountPage.createSingleTransaction({
      payee: '',
      notes: 'editable transaction',
      credit: '10.00',
    });

    await accountPage.setTransactionColumnVisibility('balance', true);

    const transaction = accountPage.getNthTransaction(0);
    await expect(transaction.balance).toHaveText('10.00');

    await transaction.credit.click();
    const creditInput = transaction.credit.getByRole('textbox');
    await creditInput.selectText();
    await creditInput.pressSequentially('25.00');
    await page.keyboard.press('Tab');

    await expect(transaction.balance).toHaveText('25.00');
  });

  test('bulk editing the date shows a properly formatted date picker', async () => {
    async function measure(locator: Locator) {
      const box = await locator.boundingBox();
      if (!box) {
        throw new Error('Could not measure the date picker modal');
      }
      return box;
    }

    accountPage = await navigation.goToAccountPage('Ally Savings');
    await accountPage.waitFor();

    await accountPage.selectNthTransaction(0);
    await accountPage.clickSelectAction('Date');

    const dialog = page.getByRole('dialog');
    const calendarGrid = dialog.locator('.react-aria-CalendarGrid');
    await expect(calendarGrid).toBeVisible();

    // The calendar is horizontally centered in the modal, not pinned to a side
    const dialogBox = await measure(dialog);
    const calendarGridBox = await measure(calendarGrid);
    const leftGap = calendarGridBox.x - dialogBox.x;
    const rightGap =
      dialogBox.x +
      dialogBox.width -
      (calendarGridBox.x + calendarGridBox.width);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);

    // The calendar is fully visible even for months spanning six rows
    // (April 2017 relative to the pinned e2e date of January 2017)
    await dialog.getByRole('button', { name: 'Next month' }).click();
    await dialog.getByRole('button', { name: 'Next month' }).click();
    await dialog.getByRole('button', { name: 'Next month' }).click();
    await expect(dialog.locator('.calendar-header-title')).toHaveText(
      'April 2017',
    );

    const sixRowDialogBox = await measure(dialog);
    const sixRowGridBox = await measure(calendarGrid);
    expect(sixRowGridBox.y + sixRowGridBox.height).toBeLessThanOrEqual(
      sixRowDialogBox.y + sixRowDialogBox.height,
    );

    await expect(dialog).toMatchThemeScreenshots();

    // On a wide screen the modal keeps a bounded width instead of
    // stretching to fit the 100%-wide calendar grid
    await page.setViewportSize({ width: 2560, height: 1080 });
    const wideDialogBox = await measure(dialog);
    expect(wideDialogBox.width).toBeLessThanOrEqual(700);
  });

  test('shift-click range selection skips hidden reconciled transactions', async () => {
    accountPage = await navigation.createAccount({
      name: 'Range Select',
      offBudget: false,
      balance: 0,
    });
    await accountPage.waitFor();

    // Newest transactions are shown first, so the rows read
    // 'range-three' through 'range-one' from top to bottom.
    for (const note of ['one', 'two', 'three']) {
      await accountPage.createSingleTransaction({
        payee: '',
        notes: `range-${note}`,
        debit: '10.00',
      });
    }

    // Mark the middle transaction as cleared and lock it via
    // reconciliation so it becomes reconciled.
    await accountPage.transactionTableRow
      .filter({ hasText: 'range-two' })
      .getByTestId('cleared')
      .click();

    await page.getByRole('button', { name: 'Reconcile' }).click();
    // The reconciliation amount is pre-filled with the cleared balance,
    // so submitting right away results in a zero difference.
    const reconcilePopover = page.locator('[data-popover]');
    await reconcilePopover.getByRole('textbox').waitFor();
    await reconcilePopover.getByRole('button', { name: 'Reconcile' }).click();
    await page.getByRole('button', { name: 'Lock transactions' }).click();

    // Showing the running balance keeps reconciled transactions loaded
    // even when they are hidden; they must still be excluded from
    // range selection.
    await accountPage.setTransactionColumnVisibility('balance', true);
    await accountPage.accountMenuButton.click();
    await page
      .getByRole('button', { name: 'Hide reconciled transactions' })
      .click();

    await expect(
      accountPage.transactionTableRow.filter({ hasText: 'range-two' }),
    ).not.toBeVisible();

    // Shift-click from the first to the last visible transaction.
    await accountPage.transactionTableRow
      .filter({ hasText: 'range-three' })
      .getByTestId('select')
      .click();
    await accountPage.transactionTableRow
      .filter({ hasText: 'range-one' })
      .getByTestId('select')
      .click({ modifiers: ['Shift'] });

    // Only the two visible transactions should be selected — not the
    // hidden reconciled one in between.
    await expect(accountPage.selectButton).toHaveText('2 transactions');
  });

  test.describe('On Budget Accounts', () => {
    // Reset filters
    test.afterEach(async () => {
      await accountPage.removeFilter(0);
    });

    test('creates a transfer from two existing transactions', async () => {
      accountPage = await navigation.goToAccountPage('On budget');
      await accountPage.waitFor();

      await expect(accountPage.accountName).toHaveText('On Budget Accounts');

      await accountPage.filterByNote('Test Acc Transfer');

      await accountPage.createSingleTransaction({
        account: 'Ally Savings',
        payee: '',
        notes: 'Test Acc Transfer',
        category: 'Food',
        debit: '34.56',
      });

      await accountPage.createSingleTransaction({
        account: 'HSBC',
        payee: '',
        notes: 'Test Acc Transfer',
        category: 'Food',
        credit: '34.56',
      });

      // Wait for both newly created transactions to actually be in the
      // transaction list before selecting them. A bare waitForTimeout(100)
      // here is not enough under parallel CI load: the second
      // createSingleTransaction's row may still be mounting when the
      // selection clicks land, so the selection doesn't stick and the
      // 'Make transfer' button (rendered only when items are selected)
      // never appears.
      await expect(accountPage.getNthTransaction(1).payee).toBeVisible();

      await accountPage.selectNthTransaction(0);
      await accountPage.selectNthTransaction(1);
      await accountPage.clickSelectAction('Make transfer');

      let transaction = accountPage.getNthTransaction(0);
      await expect(transaction.payee).toHaveText('Ally Savings');
      await expect(transaction.category).toHaveText('Transfer');
      await expect(transaction.credit).toHaveText('34.56');
      await expect(transaction.account).toHaveText('HSBC');

      transaction = accountPage.getNthTransaction(1);
      await expect(transaction.payee).toHaveText('HSBC');
      await expect(transaction.category).toHaveText('Transfer');
      await expect(transaction.debit).toHaveText('34.56');
      await expect(transaction.account).toHaveText('Ally Savings');
    });
  });

  // Under Playwright the app's today is 2017-01-01. Checking holds Grocer
  // (cleared), Cafe (uncleared) and an upcoming Phone schedule
  test.describe('Desktop register', () => {
    test.beforeEach(async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(async () => {
        const $send = (
          window as unknown as {
            $send: <T>(type: string, args?: unknown) => Promise<T>;
          }
        ).$send;
        const account = await $send<string>('account-create', {
          name: 'Checking',
          balance: 0,
        });
        const payee = (name: string) => $send<string>('payee-create', { name });
        const grocer = await payee('Grocer');
        const cafe = await payee('Cafe');
        const phone = await payee('Phone');
        await $send('transactions-batch-update', {
          added: [
            {
              id: crypto.randomUUID(),
              account,
              date: '2016-12-30',
              amount: -2350,
              payee: grocer,
              cleared: true,
            },
            {
              id: crypto.randomUUID(),
              account,
              date: '2016-12-29',
              amount: -1000,
              payee: cafe,
              cleared: false,
            },
          ],
        });
        await $send('schedule/create', {
          schedule: { name: 'Phone', posts_transaction: false },
          conditions: [
            { op: 'is', field: 'account', value: account },
            { op: 'is', field: 'payee', value: phone },
            { op: 'is', field: 'date', value: '2017-01-04' },
            { op: 'is', field: 'amount', value: -5000 },
          ],
        });
      });
      await page.reload();
      accountPage = await navigation.goToAccountPage('Checking');
      await accountPage.waitFor();
    });

    test('uncleared chip', async () => {
      const rows = accountPage.transactionTableRow;
      await expect(rows.filter({ hasText: 'Grocer' })).toHaveCount(1);

      const chip = page.getByRole('button', { name: 'Uncleared' });
      await expect(chip).toHaveAttribute('aria-pressed', 'false');
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      await expect(rows.filter({ hasText: 'Grocer' })).toHaveCount(0);
      await expect(rows.filter({ hasText: 'Cafe' })).toHaveCount(1);

      await chip.click();
      await expect(rows.filter({ hasText: 'Grocer' })).toHaveCount(1);
    });

    test('bulk toolbar', async () => {
      const rows = accountPage.transactionTableRow;
      await rows.filter({ hasText: 'Grocer' }).getByTestId('select').click();
      await rows.filter({ hasText: 'Cafe' }).getByTestId('select').click();

      const toolbar = page.getByRole('toolbar', { name: 'Selected' });
      await expect(toolbar).toContainText('2 selected');
      await expect(toolbar).toContainText('-33.50');
      for (const action of ['Categorize', 'Mark cleared', 'Delete']) {
        await expect(
          toolbar.getByRole('button', { name: action }),
        ).toBeVisible();
      }

      await toolbar.getByRole('button', { name: 'Delete' }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Delete' })
        .click();
      await expect(rows.filter({ hasText: 'Grocer' })).toHaveCount(0);
      await expect(toolbar).toHaveCount(0);
    });

    test('upcoming posted', async () => {
      const table = accountPage.transactionTable;
      const upcoming = table.getByRole('heading', { name: 'Upcoming' });
      const posted = table.getByRole('heading', { name: 'Posted' });
      await expect(upcoming).toBeVisible();
      await expect(posted).toBeVisible();

      const y = async (locator: Locator) =>
        (await locator.boundingBox())?.y ?? Number.NaN;
      const phone = accountPage.transactionTableRow.filter({
        hasText: 'Phone',
      });
      const grocer = accountPage.transactionTableRow.filter({
        hasText: 'Grocer',
      });
      expect(await y(upcoming)).toBeLessThan(await y(phone));
      expect(await y(phone)).toBeLessThan(await y(posted));
      expect(await y(posted)).toBeLessThan(await y(grocer));
    });
  });

  test.describe('Import Transactions', () => {
    test.beforeEach(async () => {
      accountPage = await navigation.createAccount({
        name: 'CSV import',
        offBudget: false,
        balance: 0,
      });
      await accountPage.waitFor();
    });

    async function importCsv(screenshot = false) {
      const fileChooserPromise = page.waitForEvent('filechooser');
      await accountPage.page
        .getByRole('button', { name: 'Import', exact: true })
        .click();

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(join(__dirname, 'data/test.csv'));

      const importButton = accountPage.page.getByRole('button', {
        name: /Import \d+ transactions/,
      });

      await importButton.waitFor({ state: 'visible' });

      if (screenshot) await expect(page).toMatchThemeScreenshots();

      await importButton.click();

      await expect(importButton).not.toBeVisible();
    }

    test('imports transactions from a CSV file', async () => {
      await importCsv(true);
    });

    test('preserves QIF categories in preview and imported transactions', async () => {
      const fileChooserPromise = page.waitForEvent('filechooser');
      await accountPage.page
        .getByRole('button', { name: 'Import', exact: true })
        .click();

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(join(__dirname, 'data/qif-categories.qif'));

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Food', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Income', { exact: true })).toBeVisible();

      await dialog
        .getByRole('button', { name: 'Import 2 transactions' })
        .click();

      const expense = accountPage.transactionTableRow.filter({
        hasText: 'QIF Cafe',
      });
      const income = accountPage.transactionTableRow.filter({
        hasText: 'QIF Salary',
      });
      await expect(expense.getByTestId('category')).toHaveText('Food');
      await expect(income.getByTestId('category')).toHaveText('Income');
    });

    test('import csv file twice', async () => {
      await importCsv(false);

      const fileChooserPromise = page.waitForEvent('filechooser');
      await accountPage.page
        .getByRole('button', { name: 'Import', exact: true })
        .click();

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(join(__dirname, 'data/test.csv'));

      const importButton = accountPage.page.getByRole('button', {
        name: /Import \d+ transactions/,
      });

      await importButton.waitFor({ state: 'visible' });

      await expect(page).toMatchThemeScreenshots();

      await expect(importButton).toBeDisabled();
      expect(await importButton.innerText()).toMatch(/Import 0 transactions/);

      await accountPage.page.getByRole('button', { name: 'Close' }).click();

      await expect(importButton).not.toBeVisible();
    });

    test('import notes checkbox is not shown for CSV files', async () => {
      const fileChooserPromise = page.waitForEvent('filechooser');
      await accountPage.page
        .getByRole('button', { name: 'Import', exact: true })
        .click();

      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(join(__dirname, 'data/test.csv'));

      // Verify the import notes checkbox is not visible for CSV files
      const importNotesCheckbox = page.getByRole('checkbox', {
        name: 'Import notes from file',
      });
      await expect(importNotesCheckbox).not.toBeVisible();

      // Import the transactions
      const importButton = page.getByRole('button', {
        name: /Import \d+ transactions/,
      });
      await importButton.click();

      // Verify the transactions were imported
      await expect(importButton).not.toBeVisible();
    });
  });
});
