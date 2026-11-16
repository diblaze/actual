import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileNavigation } from './page-models/mobile-navigation';
import { MobileTransactionEntryPage } from './page-models/mobile-transaction-entry-page';

const PHONE_SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
];
const DESKTOP_SIZE = { width: 1024, height: 768 };

type MenuActions = {
  addNotification: (payload: {
    notification: { type: 'message'; message: string; sticky: boolean };
  }) => void;
};

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) {
    throw new Error('Element has no bounding box.');
  }
  return rect;
}

for (const size of PHONE_SIZES) {
  test.describe(`Mobile shell ${size.width}x${size.height}`, () => {
    let page: Page;
    let navigation: MobileNavigation;

    test.beforeEach(async ({ browser }) => {
      page = await browser.newPage();
      navigation = new MobileNavigation(page);

      await page.setViewportSize(size);
      await page.goto('/');
      await new ConfigurationPage(page).createTestFile();
    });

    test.afterEach(async () => {
      await page?.close();
    });

    // Phone screenshot at this size, then the same state at desktop size.
    async function screenshots() {
      await expect(page).toMatchThemeScreenshots();
      await page.setViewportSize(DESKTOP_SIZE);
      await expect(page).toMatchThemeScreenshots();
      await page.setViewportSize(size);
    }

    async function expectNavFullyVisible() {
      await expect(navigation.navbar).toBeVisible();
      await expect
        .poll(async () => {
          const nav = await box(navigation.navbar);
          return nav.y >= 0 && Math.round(nav.y + nav.height) === size.height;
        })
        .toBe(true);
    }

    test('nav on account page', async () => {
      const accountsPage = await navigation.goToAccountsPage();
      const accountPage = await accountsPage.openNthAccount(0);
      await accountPage.waitFor();

      await expectNavFullyVisible();
      await expect(
        navigation.navbar.getByRole('link', { name: 'Accounts' }),
      ).toHaveAttribute('aria-current', 'page');
      await screenshots();
    });

    test('add from account', async () => {
      const accountsPage = await navigation.goToAccountsPage();
      const accountName = await (
        await accountsPage.getNthAccount(0)
      ).name.textContent();
      const accountPage = await accountsPage.openNthAccount(0);
      await accountPage.waitFor();

      // One labelled Add, floating above the bar; the header has none
      await expect(navigation.addButton).toHaveCount(1);
      await expect(navigation.addButton).toHaveText('Add');
      const add = await box(navigation.addButton);
      expect(add.y + add.height).toBeLessThanOrEqual(
        (await box(navigation.navbar)).y,
      );
      expect(add.y).toBeGreaterThan(size.height / 2);
      await navigation.addButton.click();

      const entryPage = new MobileTransactionEntryPage(page);
      await entryPage.waitFor();
      await expect(page.getByTestId('account-field')).toHaveText(
        accountName ?? '',
      );
      await screenshots();
    });

    test('last row above add', async () => {
      const budgetPage = await navigation.goToBudgetPage();
      await budgetPage.waitFor();

      await budgetPage.budgetTable.hover();
      await page.mouse.wheel(0, 20000);

      const lastRow = budgetPage.budgetTable.getByTestId('category-row').last();
      await expect
        .poll(async () => {
          const row = await box(lastRow);
          const add = await box(navigation.addButton);
          return row.y + row.height <= add.y;
        })
        .toBe(true);
      await screenshots();
    });

    test('transactions scroll under add', async () => {
      const accountPage = await navigation.goToTransactionsPage();
      await accountPage.waitFor();

      // The list runs on under the floating Add and tab bar…
      const list = await box(accountPage.transactionList);
      const add = await box(navigation.addButton);
      expect(list.y + list.height).toBeGreaterThan(add.y + add.height);

      // …with enough bottom padding that its last row scrolls clear of them
      // (the list pages in more rows on scroll, so measure the padding)
      const padding = await accountPage.transactionList.evaluate(el =>
        parseFloat(getComputedStyle(el).paddingBottom),
      );
      expect(padding).toBeGreaterThanOrEqual(list.y + list.height - add.y);
    });

    test('large title', async () => {
      await navigation.goToAccountsPage();

      await expect(
        page.getByRole('heading', { level: 1, name: 'Accounts' }),
      ).toHaveCSS('font-size', '34px');
      const addAccount = await box(
        page.getByRole('button', { name: 'Add account' }),
      );
      expect(addAccount.width).toBeGreaterThanOrEqual(44);
      expect(addAccount.height).toBeGreaterThanOrEqual(44);
      await screenshots();
    });

    test('focus ring', async () => {
      const budgetPage = await navigation.goToBudgetPage();
      await budgetPage.waitFor();
      const reports = navigation.navbar.getByRole('link', { name: 'Reports' });
      const outline = () =>
        reports.evaluate(el => getComputedStyle(el).outlineStyle);

      expect(await outline()).toBe('none');
      await navigation.navbar.getByRole('button', { name: 'More' }).focus();
      await page.keyboard.press('Shift+Tab');

      await expect(reports).toBeFocused();
      // Our solid ring, not the browser's default `auto` outline
      expect(await outline()).toBe('solid');
      await screenshots();
    });

    test('nav stays on scroll', async () => {
      const budgetPage = await navigation.goToBudgetPage();
      await budgetPage.waitFor();
      const firstRow = budgetPage.categoryRows.first();
      const before = await box(firstRow);

      await budgetPage.budgetTable.hover();
      await page.mouse.wheel(0, 1500);

      await expect
        .poll(async () => (await box(firstRow)).y)
        .toBeLessThan(before.y);
      await expectNavFullyVisible();
      await screenshots();
    });

    test('toast above nav', async () => {
      const budgetPage = await navigation.goToBudgetPage();
      await budgetPage.waitFor();

      await page.evaluate(() =>
        (
          window as unknown as { __actionsForMenu: MenuActions }
        ).__actionsForMenu.addNotification({
          notification: {
            type: 'message',
            message: 'Shell toast',
            sticky: true,
          },
        }),
      );

      const toast = page.getByRole('alert').filter({ hasText: 'Shell toast' });
      await expect(toast).toBeVisible();
      await expect
        .poll(async () => {
          const toastBox = await box(toast);
          const navBox = await box(navigation.navbar);
          return toastBox.y + toastBox.height <= navBox.y;
        })
        .toBe(true);
      await screenshots();
    });

    test('month menu is a sheet', async () => {
      const budgetPage = await navigation.goToBudgetPage();
      await budgetPage.waitFor();
      await budgetPage.openMonthMenu();

      const sheet = page
        .getByTestId('envelope-budget-month-menu-modal')
        .getByRole('dialog');
      await expect(sheet).toBeVisible();
      await expect
        .poll(async () => {
          const rect = await box(sheet);
          return [
            Math.round(rect.x),
            Math.round(rect.width),
            Math.round(rect.y + rect.height),
          ];
        })
        .toEqual([0, size.width, size.height]);
      await screenshots();
    });

    test('more sheet labels fit', async () => {
      await navigation.navbar.getByRole('button', { name: 'More' }).click();
      const sheet = page.getByRole('dialog', { name: 'More' });
      const payees = sheet.getByRole('button', { name: 'Payees' });
      await expect(payees).toBeVisible();
      // The longest label in any locale, Swedish "Payees"
      await payees.evaluate(el => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode.nodeValue === 'Payees') {
            walker.currentNode.nodeValue = 'Betalningsmottagare';
          }
        }
      });
      await expect(
        sheet.getByRole('button', { name: 'Betalningsmottagare' }),
      ).toBeVisible();

      for (const item of await sheet.getByRole('button').all()) {
        const fits = await item.evaluate(el => {
          const outer = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          const text = range.getBoundingClientRect();
          return {
            clipped: [el, ...el.querySelectorAll('*')].some(
              e => e.scrollWidth > e.clientWidth + 1,
            ),
            inside:
              text.left >= outer.left - 1 &&
              text.right <= outer.right + 1 &&
              text.top >= outer.top - 1 &&
              text.bottom <= outer.bottom + 1,
            fontSize: Math.min(
              ...[...el.querySelectorAll('span')].map(e =>
                parseFloat(getComputedStyle(e).fontSize),
              ),
            ),
          };
        });
        expect(fits.clipped).toBe(false);
        expect(fits.inside).toBe(true);
        expect(fits.fontSize).toBeGreaterThanOrEqual(13);
      }
    });

    test('account menu scrolls', async () => {
      const accountsPage = await navigation.goToAccountsPage();
      const accountPage = await accountsPage.openNthAccount(0);
      await accountPage.waitFor();
      await accountPage.accountMenuButton.click();

      const sheet = page.getByTestId('account-menu-modal').getByRole('dialog');
      await expect(sheet).toBeVisible();
      expect((await box(sheet)).height).toBeLessThanOrEqual(
        size.height * 0.9 + 1,
      );

      const items = sheet.getByRole('button');
      for (const item of await items.all()) {
        await item.scrollIntoViewIfNeeded();
        await expect(item).toBeInViewport();
      }
      await screenshots();
    });
  });
}

// Demo budget with SEK-sized amounts: Food budgeted 123,456.78 and a
// 999,999 paycheck so To Budget and Available run 10-11 characters
async function seedLargeAmounts(page: Page) {
  await page.evaluate(async () => {
    const $send = (
      window as unknown as {
        $send: <T>(type: string, args?: unknown) => Promise<T>;
      }
    ).$send;
    const query = <T>(table: string, filter: object) =>
      $send<{ data: T[] }>('query', {
        table,
        tableOptions: {},
        filterExpressions: [filter],
        selectExpressions: ['id'],
        groupExpressions: [],
        orderExpressions: [],
        calculation: false,
        rawMode: false,
        withDead: false,
        validateRefs: true,
        limit: null,
        offset: null,
      });
    const { data: food } = await query<{ id: string }>('categories', {
      name: 'Food',
    });
    const { data: income } = await query<{ id: string }>('categories', {
      is_income: true,
    });
    const { data: accounts } = await query<{ id: string }>('accounts', {
      offbudget: false,
      closed: false,
    });

    await $send('budget/budget-amount', {
      month: '2017-01',
      category: food[0].id,
      amount: 12345678,
    });
    await $send('transactions-batch-update', {
      added: [
        {
          id: crypto.randomUUID(),
          account: accounts[0].id,
          date: '2017-01-01',
          amount: 99999900,
          category: income[0].id,
        },
      ],
    });
  });
}

for (const size of PHONE_SIZES) {
  test.describe(`Mobile layout ${size.width}x${size.height}`, () => {
    let page: Page;
    let navigation: MobileNavigation;

    test.beforeEach(async ({ browser }) => {
      page = await browser.newPage();
      navigation = new MobileNavigation(page);

      await page.setViewportSize(size);
      await page.goto('/');
      await new ConfigurationPage(page).createTestFile();
      await seedLargeAmounts(page);
    });

    test.afterEach(async () => {
      await page?.close();
    });

    async function expectNoOverflow() {
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }

    test('no horizontal overflow', async () => {
      const budgetPage = await navigation.goToBudgetPage();
      await budgetPage.waitFor();
      await expect(budgetPage.budgetTable).toContainText('123,456.78');
      await expectNoOverflow();
      // Nothing in the grid ends past the right edge of the screen
      const rightmost = await budgetPage.budgetTable.evaluate(el =>
        Math.max(
          ...[...el.querySelectorAll('*')].map(
            e => e.getBoundingClientRect().right,
          ),
        ),
      );
      expect(rightmost).toBeLessThanOrEqual(size.width + 1);

      const accountsPage = await navigation.goToAccountsPage();
      const accountPage = await accountsPage.openNthAccount(0);
      await accountPage.waitFor();
      await expectNoOverflow();

      await navigation.goToSettingsPage();
      await expectNoOverflow();

      // Last: the entry screen has no tab bar to leave by
      await navigation.goToTransactionEntryPage();
      await expectNoOverflow();
    });
  });
}

test.describe('Mobile touch inputs', () => {
  let page: Page;
  let navigation: MobileNavigation;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage({
      viewport: PHONE_SIZES[0],
      isMobile: true,
      hasTouch: true,
    });
    navigation = new MobileNavigation(page);
    await page.goto('/');
    await new ConfigurationPage(page).createTestFile();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  // iOS zooms in on focus of any field under 16px and never zooms back
  async function expectFieldsAtLeast16px(scope: Locator) {
    const sizes = await scope
      .locator('input:not([type="checkbox"]), textarea, select')
      .evaluateAll(els =>
        els.map(el => parseFloat(getComputedStyle(el).fontSize)),
      );
    expect(sizes.length).toBeGreaterThan(0);
    for (const fontSize of sizes) {
      expect(fontSize).toBeGreaterThanOrEqual(16);
    }
  }

  test('inputs at least 16px', async () => {
    const budgetPage = await navigation.goToBudgetPage();
    await budgetPage.waitFor();
    const budgetMenu = await budgetPage.openBudgetMenu('Food');
    await expect(budgetMenu.budgetAmountInput).toBeVisible();
    await expectFieldsAtLeast16px(budgetMenu.locator);
    await page.keyboard.press('Escape');

    const payeesPage = await navigation.goToPayeesPage();
    await expect(payeesPage.searchBox).toBeVisible();
    await expectFieldsAtLeast16px(payeesPage.searchBox.locator('xpath=..'));

    // Last: the entry screen has no tab bar to leave by
    const entryPage = await navigation.goToTransactionEntryPage();
    await expectFieldsAtLeast16px(entryPage.transactionForm);
    // Leave the focused amount field so the rows become tappable
    await entryPage.header.click();
    await page.getByTestId('payee-field').click();
    await expectFieldsAtLeast16px(page.getByRole('dialog'));
  });
});
