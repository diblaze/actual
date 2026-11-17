import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { BudgetPage } from './page-models/budget-page';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

// The computed colour a theme variable resolves to
function resolveThemeColor(
  page: Page,
  variable: string,
  property: 'color' | 'backgroundColor',
) {
  return page.evaluate(
    ([variable, property]) => {
      const probe = document.createElement('span');
      probe.style[property] = `var(${variable})`;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe)[property];
      probe.remove();
      return value;
    },
    [variable, property] as const,
  );
}

test.describe('Budget', () => {
  let page: Page;
  let configurationPage: ConfigurationPage;
  let budgetPage: BudgetPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    budgetPage = await configurationPage.createTestFile();

    // Move mouse to corner of the screen;
    // sometimes the mouse hovers on a budget element thus rendering an input box
    // and this breaks screenshot tests
    await page.mouse.move(0, 0);
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('renders the summary information: available funds, overspent, budgeted and for next month', async () => {
    const summary = budgetPage.budgetSummary.first();

    await expect(summary.getByText('Available funds')).toBeVisible({
      timeout: 10000,
    });
    await expect(summary.getByText(/^Overspent in /)).toBeVisible();
    await expect(summary.getByText('Budgeted')).toBeVisible();
    await expect(summary.getByText('For next month')).toBeVisible();
    await expect(page).toMatchThemeScreenshots();
  });

  test('transfer funds to another category', async () => {
    const currentFundsA = await budgetPage.getBalanceForRow(1);
    const currentFundsB = await budgetPage.getBalanceForRow(2);

    await budgetPage.transferAllBalance(1, 2);

    await expect
      .poll(() => budgetPage.getBalanceForRow(2))
      .toEqual(currentFundsA + currentFundsB);
    await expect(page).toMatchThemeScreenshots();
  });

  test('budget table is rendered', async () => {
    await expect(budgetPage.budgetTable).toBeVisible();
    expect(await budgetPage.getTableTotals()).toEqual({
      budgeted: expect.any(Number),
      spent: expect.any(Number),
      balance: expect.any(Number),
    });
  });

  test('clicking on spent amounts opens a transaction page', async () => {
    const accountPage = await budgetPage.clickOnSpentAmountForRow(1);
    expect(page.url()).toContain('/accounts');
    expect(await accountPage.accountName.textContent()).toMatch('All Accounts');
    await page.getByRole('button', { name: 'Back' }).click();
  });

  test('right clicking a category opens context menu', async () => {
    await budgetPage.rightClickCategory(1);
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Rename' })).toBeVisible();
  });

  test('right clicking a category group opens context menu', async () => {
    await budgetPage.rightClickCategoryGroup('Usual Expenses');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Rename' })).toBeVisible();
  });

  test('budget name offers rename and switch file', async () => {
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' });
    await expect(sidebar.getByTestId('budget-name')).toBeVisible();
    await expect(
      sidebar.getByRole('button', { name: 'Rename budget' }),
    ).toBeAttached();
    await expect(
      sidebar.getByRole('button', { name: 'Switch file' }),
    ).toBeVisible();
  });
});

// Under Playwright the app's today is 2017-01-01. In January 2017 Food has
// 400.00 budgeted and five spends of 100.00 (balance -100.00); General and
// Bills are
// overspent without a budget, so three categories are overspent
test.describe('Desktop budget', () => {
  let page: Page;
  let budgetPage: BudgetPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    budgetPage = await new ConfigurationPage(page).startFresh();
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
        filterExpressions: [
          { $or: [{ name: 'Food' }, { name: 'General' }, { name: 'Bills' }] },
        ],
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
      const id = (name: string) => categories.find(c => c.name === name)!.id;
      const account = await $send<string>('account-create', {
        name: 'Checking',
        balance: 0,
      });
      const market = await $send<string>('payee-create', {
        name: 'Corner Market',
      });
      const spend = (category: string, amount: number, payee?: string) => ({
        id: crypto.randomUUID(),
        account,
        date: '2017-01-01',
        amount,
        category,
        payee,
      });
      await $send('transactions-batch-update', {
        added: [
          ...Array.from({ length: 5 }, () => spend(id('Food'), -10000, market)),
          spend(id('General'), -5000),
          spend(id('Bills'), -2000),
        ],
      });
      await $send('budget/budget-amount', {
        month: '2017-01',
        category: id('Food'),
        amount: 40000,
      });
    });
    await page.reload();
    await budgetPage.waitFor();
    await page.mouse.move(0, 0);
  });

  test.afterEach(async () => {
    await page?.close();
  });

  function themeColor(variable: string, property: 'color' | 'backgroundColor') {
    return resolveThemeColor(page, variable, property);
  }

  test('new sidebar default', async () => {
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByTestId('budget-name')).toBeVisible();
    await expect(
      sidebar.getByTestId('sidebar-on-budget-balance'),
    ).toBeVisible();
    // Account search exists only in the redesigned sidebar
    await expect(
      sidebar.getByRole('button', { name: 'Find account' }),
    ).toBeVisible();
    await expect(page).toMatchThemeScreenshots();
  });

  test('sidebar card', async () => {
    const card = page.getByTestId('sidebar-card');
    await expect(card).toBeVisible();
    const rect = await card.boundingBox();
    expect(rect?.x).toBeGreaterThan(0);
    expect(rect?.y).toBeGreaterThan(0);
    expect(
      await card.evaluate(el => getComputedStyle(el).borderTopLeftRadius),
    ).not.toBe('0px');
    await expect(
      card.getByRole('navigation', { name: 'Sidebar' }),
    ).toBeVisible();
    await expect(page).toMatchThemeScreenshots();
  });

  test('row pills', async () => {
    const budgeted = budgetPage.getCategoryRow('Food').getByTestId('budget');
    // The unfocused Budgeted amount sits in an outlined field
    expect(
      await budgeted.evaluate(el =>
        Array.from(el.querySelectorAll('div')).some(
          d => getComputedStyle(d).boxShadow !== 'none',
        ),
      ),
    ).toBe(true);

    const pill = budgetPage.getBalance('Food', '2017-01');
    await expect(pill).toHaveText('-100.00');
    await expect(pill).toHaveCSS(
      'background-color',
      await themeColor('--color-balanceNegativeBackground', 'backgroundColor'),
    );
    await expect(pill).toHaveCSS(
      'color',
      await themeColor('--color-balanceNegativeText', 'color'),
    );
    await expect(page).toMatchThemeScreenshots();
  });

  test('overspent fix', async () => {
    const card = page.getByRole('group', { name: '3 Overspent' });
    await card.getByRole('button', { name: 'Fix' }).click();

    // The cover list holds exactly the overspent categories
    const options = page.getByRole('dialog').getByRole('option');
    await expect(options).toHaveText([
      /^Food -100\.00/,
      /^General -50\.00/,
      /^Bills -20\.00/,
    ]);
    await expect(page).toMatchThemeScreenshots();
  });

  test('inspector recent', async () => {
    await budgetPage.budgetTable
      .getByRole('button', { name: 'Food', exact: true })
      .click();

    const pane = page.getByRole('complementary', { name: 'Food' });
    await expect(pane.getByRole('heading', { name: 'Food' })).toBeVisible();
    await expect(pane.getByText('Usual Expenses')).toBeVisible();
    await expect(pane.getByTestId('sheet-balance')).toHaveText('-100.00');
    await expect(pane).toContainText('Budgeted400.00');
    await expect(pane.getByTestId('sheet-spent')).toHaveText('-500.00');
    await expect(
      pane.getByRole('img', { name: '125 percent of budget spent' }),
    ).toBeVisible();
    await expect(
      pane.getByRole('button', { name: 'Cover 100.00' }),
    ).toBeVisible();
    const recent = pane
      .getByRole('list', { name: 'Recent transactions' })
      .getByRole('listitem');
    // The latest four of the month's five
    await expect(recent).toHaveCount(4);
    await expect(recent.first()).toContainText('Corner Market');
    // One body: the six-month history went with the old inspector
    await expect(pane.getByRole('list', { name: 'Last 6 months' })).toHaveCount(
      0,
    );
    await expect(page).toMatchThemeScreenshots();

    await pane.getByRole('button', { name: 'Close' }).click();
    await expect(pane).toHaveCount(0);
  });

  // Goal templates on, 1,000.00 income and a 600.00 goal on Food: 200.00
  // short of its 400.00 budget, with To budget enough to fund it
  test('inspector goal', async () => {
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
        filterExpressions: [{ $or: [{ name: 'Food' }, { name: 'Income' }] }],
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
      const id = (name: string) => categories.find(c => c.name === name)!.id;
      const { data: accounts } = await $send<{ data: Array<{ id: string }> }>(
        'query',
        {
          table: 'accounts',
          tableOptions: {},
          filterExpressions: [{ name: 'Checking' }],
          selectExpressions: ['id'],
          groupExpressions: [],
          orderExpressions: [],
          calculation: false,
          rawMode: false,
          withDead: false,
          validateRefs: true,
          limit: null,
          offset: null,
        },
      );
      await $send('preferences/save', {
        id: 'flags.goalTemplatesEnabled',
        value: 'true',
      });
      await $send('transactions-batch-update', {
        added: [
          {
            id: crypto.randomUUID(),
            account: accounts[0].id,
            date: '2017-01-01',
            amount: 100000,
            category: id('Income'),
          },
        ],
      });
      await $send('budget/set-category-automations', {
        categoriesWithTemplates: [
          {
            id: id('Food'),
            templates: [
              {
                type: 'simple',
                monthly: 600,
                directive: 'template',
                priority: 0,
              },
            ],
          },
        ],
        source: 'ui',
        month: '2017-01',
      });
    });
    await page.reload();
    await budgetPage.waitFor();

    await budgetPage.budgetTable
      .getByRole('button', { name: 'Food', exact: true })
      .click();

    const pane = page.getByRole('complementary', { name: 'Food' });
    await expect(pane.getByText('Underfunded (-200.00)')).toBeVisible();
    await expect(pane.getByRole('progressbar')).toBeVisible();
    await pane
      .getByRole('button', { name: 'Fund goal from To Budget' })
      .click();
    await expect(pane).toContainText('Budgeted600.00');
    await expect(
      pane.getByRole('button', { name: 'Fund goal from To Budget' }),
    ).toHaveCount(0);
  });
});

test.describe('Budget scroll position', () => {
  let page: Page;
  let configurationPage: ConfigurationPage;
  let budgetPage: BudgetPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
    budgetPage = await configurationPage.createTestFile();

    // Add enough categories to make the budget table scrollable.
    const categoryCount = 20;
    await page.evaluate(async count => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const $send = (window as any).$send as (
        type: string,
        args?: unknown,
      ) => Promise<string>;
      const groupId = await $send('category-group-create', {
        name: 'Extra Categories',
      });
      for (let i = 1; i <= count; i++) {
        await $send('category-create', { name: `Category ${i}`, groupId });
      }
      // Invalidate the category query so React re-renders with the new categories.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (window as any).__TANSTACK_QUERY_CLIENT__.invalidateQueries({
        queryKey: ['categories', 'lists'],
      });
    }, categoryCount);
    await page
      .getByText(`Category ${categoryCount}`, { exact: true })
      .waitFor({ state: 'visible' });

    await page.mouse.move(0, 0);
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('scroll position is restored when navigating back from spent transactions page', async () => {
    await budgetPage.scrollToBottom();
    const scrollTopBeforeViewingSpent = await budgetPage.getScrollTop();
    expect(scrollTopBeforeViewingSpent).toBeGreaterThan(0);

    // Click a spent-amount cell that is already visible at the current scroll position so the scroll does not change
    // before the handler captures it.
    await budgetPage.clickOnSpentAmountForLastVisibleRow();
    expect(page.url()).toContain('/accounts');

    await page.getByRole('button', { name: 'Back' }).click();
    await budgetPage.waitFor();

    const scrollTopAfterReturningFromSpent = await budgetPage.getScrollTop();
    expect(scrollTopAfterReturningFromSpent).toBe(scrollTopBeforeViewingSpent);
  });
});

// Credit card payments on, with the carry subfeature: Checking holds
// 1,000.00, Visa is a new card without a balance, and Food is budgeted
// 300.00 (the setup of credit-card-payments.mobile.test.ts, on the desktop)
test.describe('Desktop card debt pills', () => {
  let page: Page;
  let navigation: Navigation;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);
    await page.goto('/');
    await new ConfigurationPage(page).startFresh();
    const settingsPage = await navigation.goToSettingsPage();
    await settingsPage.setExperimentalFeature(
      'Credit card payment categories',
      true,
    );
    const carry = page.getByRole('checkbox', {
      name: 'Subfeature: Carry uncovered card spending into next month',
    });
    if (!(await carry.isChecked())) {
      await carry.click();
    }
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
  });

  test.afterEach(async () => {
    await page?.close();
  });

  async function spendOnCard(debit: string) {
    const budgetPage = await navigation.goToBudgetPage();
    await budgetPage.setBudgetedAmount('Food', '300');
    const accountPage = await navigation.goToAccountPage('Visa');
    await accountPage.waitFor();
    await accountPage.createSingleTransaction({
      payee: 'Grocer',
      category: 'Food',
      debit,
    });
    await navigation.goToBudgetPage();
    await page.mouse.move(0, 0);
    return budgetPage;
  }

  async function expectPill(
    pill: ReturnType<BudgetPage['getBalance']>,
    tone: 'Warning' | 'Negative',
  ) {
    await expect(pill).toHaveCSS(
      'background-color',
      await resolveThemeColor(
        page,
        `--color-balance${tone}Background`,
        'backgroundColor',
      ),
    );
    await expect(pill).toHaveCSS(
      'color',
      await resolveThemeColor(page, `--color-balance${tone}Text`, 'color'),
    );
  }

  test('card overspend warning', async () => {
    const budgetPage = await spendOnCard('330.00');

    const pill = budgetPage.getBalance('Food', '2017-01');
    await expect(pill).toHaveText('-30.00');
    // Card-only overspending stays on the card: a warning, not red
    await expectPill(pill, 'Warning');
  });

  test('carried card debt red', async () => {
    const budgetPage = await spendOnCard('350.00');
    await expect(budgetPage.getBalance('Food', '2017-01')).toHaveText('-50.00');

    await budgetPage.goToNextMonth();
    const pill = budgetPage.getBalance('Food', '2017-02');
    await expect(pill).toHaveText('-50.00');
    await expectPill(pill, 'Negative');
  });
});
