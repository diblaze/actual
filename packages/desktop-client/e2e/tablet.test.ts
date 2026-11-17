import { currencyToAmount } from '@actual-app/core/shared/util';
import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileBudgetPage } from './page-models/mobile-budget-page';
import { Navigation } from './page-models/navigation';

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) {
    throw new Error('Element has no bounding box.');
  }
  return rect;
}

function cents(text: string | null) {
  return Math.round((currencyToAmount(text ?? '') ?? NaN) * 100);
}

test.describe('Tablet 1024x768', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await new ConfigurationPage(page).createTestFile();
    await page.getByTestId('budget-table').waitFor();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  function cells(name: string) {
    const table = page.getByTestId('budget-table');
    return {
      name: table.getByRole('button', { name, exact: true }),
      budgeted: table.getByRole('button', {
        name: `Open budget menu for ${name} category`,
      }),
      spent: table.getByRole('button', {
        name: `Show transactions for ${name} category`,
      }),
      balance: table.getByRole('button', {
        name: `Open balance menu for ${name} category`,
      }),
    };
  }

  test('rail', async () => {
    const rail = page.getByRole('navigation', { name: 'Main' });
    for (const name of ['Budget', 'Transactions', 'Accounts', 'Reports']) {
      const link = rail.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveText(name);
      // The full label fits inside its item
      expect(await link.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(
        true,
      );
    }
    const more = rail.getByRole('button', { name: 'More', exact: true });
    await expect(more).toBeVisible();
    await expect(more).toHaveText('More');
    await expect(
      rail.getByRole('link', { name: 'Budget', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      rail.getByRole('link', { name: 'Reports', exact: true }),
    ).not.toHaveAttribute('aria-current', 'page');

    // Schedules, Payees, Rules and Settings live in More
    for (const name of ['Schedules', 'Payees', 'Rules', 'Settings']) {
      await expect(rail.getByRole('link', { name })).toHaveCount(0);
    }

    // Inset, rounded rail with the round Add at its foot
    const add = rail.getByRole('button', { name: 'Add transaction' });
    await expect(add).toBeVisible();
    const railBox = await box(rail);
    const addBox = await box(add);
    const moreBox = await box(more);
    expect(railBox.x).toBeGreaterThan(0);
    expect(railBox.y).toBeGreaterThan(0);
    expect(Math.round(addBox.width)).toBe(Math.round(addBox.height));
    expect(addBox.y).toBeGreaterThan(moreBox.y + moreBox.height);
    expect(
      await rail.evaluate(el => getComputedStyle(el).borderTopLeftRadius),
    ).not.toBe('0px');
    await expect(page.getByTestId('sidebar-primary-buttons')).toHaveCount(0);
    await expect(page).toMatchThemeScreenshots();
  });

  test('three columns', async () => {
    const group = page.getByTestId('category-group').first();
    const heading = group.getByTestId('category-group-row');
    for (const label of ['Budgeted', 'Spent', 'Balance']) {
      await expect(heading.getByText(label, { exact: true })).toBeVisible();
    }

    const { budgeted, spent, balance } = cells('Food');
    const rects = [];
    for (const cell of [budgeted, spent, balance]) {
      await expect(cell).toHaveText(/^-?[\d,]+\.\d\d$/);
      rects.push(await box(cell));
    }
    // Budgeted, Spent, Balance left to right without overlap
    expect(rects[0].x + rects[0].width).toBeLessThanOrEqual(rects[1].x);
    expect(rects[1].x + rects[1].width).toBeLessThanOrEqual(rects[2].x);
    expect(cents(await spent.textContent())).toBeLessThan(0);
    await expect(page).toMatchThemeScreenshots();
  });

  test('inspector pane', async () => {
    const table = page.getByTestId('budget-table');
    const food = cells('Food');
    const row = page.getByTestId('category-row').filter({
      has: page.getByRole('button', { name: 'Food', exact: true }),
    });
    const balance = await food.balance.textContent();
    const budgeted = await food.budgeted.textContent();
    const spent = await food.spent.textContent();

    await food.name.click();

    const pane = page.getByRole('complementary', { name: 'Food' });
    await expect(pane.getByRole('heading', { name: 'Food' })).toBeVisible();
    await expect(pane.getByTestId('sheet-balance')).toHaveText(balance ?? '');
    await expect(
      pane.getByRole('button', { name: 'Edit budgeted amount' }),
    ).toContainText(budgeted ?? '');
    await expect(pane.getByTestId('sheet-spent')).toHaveText(spent ?? '');
    await expect(
      pane.getByRole('button', { name: 'Move money', exact: true }),
    ).toBeVisible();
    await expect(
      pane.getByRole('list', { name: 'Recent transactions' }),
    ).toBeVisible();

    // The row is highlighted; the list stays beside the panel
    await expect(row).toHaveAttribute('data-inspected', 'true');
    // Assistive tech hears it as the current category
    await expect(row.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(page.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(table).toBeVisible();
    const tableBox = await box(table);
    expect(tableBox.x + tableBox.width).toBeLessThanOrEqual(
      (await box(pane)).x,
    );
    await expect(page).toMatchThemeScreenshots();
  });
});

// Credit card payments on, with the carry subfeature: Checking holds
// 1,000.00, Visa is a new card without a balance, and Food is budgeted
// 300.00 (the setup of credit-card-payments.mobile.test.ts, on a tablet)
test.describe('Tablet card debt pills', () => {
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

  // Spend on the card on the desktop, then look at the tablet budget
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
    await page.setViewportSize({ width: 1024, height: 768 });
    const tabletBudget = new MobileBudgetPage(page);
    await tabletBudget.budgetTable.waitFor();
    return tabletBudget;
  }

  function foodPill() {
    return page
      .getByTestId('budget-table')
      .getByRole('button', { name: 'Open balance menu for Food category' })
      .getByTestId('balance-pill');
  }

  async function expectPill(tone: 'Warning' | 'Negative') {
    const color = (variable: string) =>
      page.evaluate(name => {
        const probe = document.createElement('div');
        probe.style.color = `var(${name})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }, variable);
    expect(
      await foodPill().evaluate(el => getComputedStyle(el).backgroundColor),
    ).toBe(await color(`--color-balance${tone}Background`));
    // The amount's text colour, from the element holding its text
    expect(
      await foodPill().evaluate(el => {
        const text = [el, ...el.querySelectorAll('*')].find(e =>
          [...e.childNodes].some(
            n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
          ),
        );
        return getComputedStyle(text ?? el).color;
      }),
    ).toBe(await color(`--color-balance${tone}Text`));
  }

  test('card overspend warning', async () => {
    await spendOnCard('330.00');

    await expect(foodPill()).toHaveText('-30.00');
    // Card-only overspending stays on the card: a warning, not red
    await expectPill('Warning');
  });

  test('carried card debt red', async () => {
    const tabletBudget = await spendOnCard('350.00');
    await expect(foodPill()).toHaveText('-50.00');

    await tabletBudget.goToNextMonth();
    await expect(foodPill()).toHaveText('-50.00');
    await expectPill('Negative');
  });
});
