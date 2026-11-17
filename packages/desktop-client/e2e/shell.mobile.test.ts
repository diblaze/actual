import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileNavigation } from './page-models/mobile-navigation';
import { MobilePayeesPage } from './page-models/mobile-payees-page';
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
    async function screenshots(target: Locator | Page = page) {
      await expect(target).toMatchThemeScreenshots();
      await page.setViewportSize(DESKTOP_SIZE);
      // The layout switch is debounced: shoot once the rail (a vertical
      // Main nav) has replaced the tab bar
      await expect
        .poll(async () => {
          const nav = await page
            .getByRole('navigation', { name: 'Main' })
            .first()
            .boundingBox();
          return nav != null && nav.height > nav.width;
        })
        .toBe(true);
      await expect(target).toMatchThemeScreenshots();
      await page.setViewportSize(size);
      await expectNavFullyVisible();
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

    test('payees via settings', async () => {
      const settingsPage = await navigation.goToSettingsPage();
      await settingsPage.goToSection('Payees');

      await new MobilePayeesPage(page).waitFor();
      await expectNavFullyVisible();
      await expect(
        navigation.navbar.getByRole('button', { name: 'More' }),
      ).toHaveAttribute('aria-current', 'page');
    });

    test('nav on account page', async () => {
      const accountsPage = await navigation.goToAccountsPage();
      const accountPage = await accountsPage.openNthAccount(0);
      await accountPage.waitFor();

      await expectNavFullyVisible();
      await expect(
        navigation.navbar.getByRole('link', { name: 'Accounts' }),
      ).toHaveAttribute('aria-current', 'page');
      // The nav only: after the resize the register's row heights settle
      // at slightly different offsets
      await screenshots(navigation.navbar);
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

    test('last transaction above add', async () => {
      const accountsPage = await navigation.goToAccountsPage();
      const accountPage = await accountsPage.openNthAccount(0);
      await accountPage.waitFor();
      const list = accountPage.transactionList;

      // More rows than fit the screen…
      const listBox = await box(list);
      const add = await box(navigation.addButton);
      expect(listBox.y + listBox.height).toBeGreaterThan(add.y + add.height);

      // …scrolled to the end; the list pages in more rows as it scrolls
      await expect
        .poll(
          async () => {
            const before = await list.evaluate(el => el.scrollHeight);
            await list.evaluate(el => el.scrollTo(0, el.scrollHeight));
            await page.waitForTimeout(200);
            return before === (await list.evaluate(el => el.scrollHeight));
          },
          { timeout: 30000 },
        )
        .toBe(true);

      const lastRow = accountPage.transactions.last();
      await expect
        .poll(async () => {
          const row = await box(lastRow);
          return row.y + row.height <= (await box(navigation.addButton)).y;
        })
        .toBe(true);
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
      // The sheet surface is the dialog's first child
      const corners = await sheet.evaluate(el => {
        const style = getComputedStyle(el.firstElementChild ?? el);
        return [style.borderTopLeftRadius, style.borderTopRightRadius];
      });
      expect(corners).toEqual(['18px', '18px']);
      await screenshots();
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
      // The dialog only: the list behind it keeps a varying scroll offset
      await screenshots(sheet);
    });
  });
}

test.describe('Mobile touch', () => {
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
    // The sheet shows the amount as a button until tapped
    await budgetMenu.locator
      .getByRole('button', { name: /^-?[\d,]+\.\d{2}$/ })
      .click();
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

  test('swipe dismisses sheet', async () => {
    const budgetPage = await navigation.goToBudgetPage();
    await budgetPage.waitFor();
    await budgetPage.openMonthMenu();

    const sheet = page
      .getByTestId('envelope-budget-month-menu-modal')
      .getByRole('dialog');
    await expect(sheet).toBeVisible();
    const handle = sheet.getByTestId('sheet-handle');
    const start = await box(handle);
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;

    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (let dy = 20; dy <= 200; dy += 20) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y + dy }],
      });
    }
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await session.detach();

    await expect(sheet).toBeHidden();
  });
});
