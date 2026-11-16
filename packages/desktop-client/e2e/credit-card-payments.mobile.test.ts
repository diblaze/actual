import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileNavigation } from './page-models/mobile-navigation';
import { Navigation } from './page-models/navigation';

const FEATURE = 'Credit card payment categories';
const CARRY_FEATURE =
  'Subfeature: Carry uncovered card spending into next month';
const PHONE = { width: 390, height: 844 };

// Text colour of the amount inside a Balance pill
function amountColor(pill: Locator) {
  return pill.evaluate(el => {
    const text = [el, ...el.querySelectorAll('*')].find(e =>
      [...e.childNodes].some(
        n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
      ),
    );
    return getComputedStyle(text ?? el).color;
  });
}

// A theme colour variable resolved the way the browser paints it
function themeColor(page: Page, name: string) {
  return page.evaluate(variable => {
    const probe = document.createElement('div');
    probe.style.color = `var(${variable})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

test.describe('Credit card payments on the phone', () => {
  let page: Page;
  let navigation: Navigation;

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
    const carry = page.getByRole('checkbox', { name: CARRY_FEATURE });
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

  // Budget 300.00 for Food on the desktop, then spend on the card
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
    await page.setViewportSize(PHONE);
    return await new MobileNavigation(page).goToBudgetPage();
  }

  function pill(name: string) {
    return page.getByRole('button', {
      name: `Open balance menu for ${name} category`,
    });
  }

  function foodPill() {
    return pill('Food');
  }

  function tint(button: Locator) {
    return button
      .getByTestId('balance-pill')
      .evaluate(el => getComputedStyle(el).backgroundColor);
  }

  test('this month warning', async () => {
    await spendOnCard('330.00');

    await expect(foodPill()).toHaveText('-30.00');
    expect(await amountColor(foodPill())).toBe(
      await themeColor(page, '--color-balanceWarningText'),
    );
    // The pill tint follows the text: warning, not the overspent red
    expect(await tint(foodPill())).toBe(
      await themeColor(page, '--color-balanceWarningBackground'),
    );

    await foodPill().click();
    await expect(
      page.getByRole('dialog', { name: 'Food' }).getByText('Card spending'),
    ).toBeVisible();
  });

  test('carried debt red', async () => {
    const budgetPage = await spendOnCard('350.00');
    await expect(foodPill()).toHaveText('-50.00');

    await budgetPage.goToNextMonth();
    await expect(foodPill()).toHaveText('-50.00');
    expect(await amountColor(foodPill())).toBe(
      await themeColor(page, '--color-balanceNegativeText'),
    );
    expect(await tint(foodPill())).toBe(
      await themeColor(page, '--color-balanceNegativeBackground'),
    );
  });

  // A card added with 100.00 of debt: its payment category holds none of it
  test('payment category warning', async () => {
    await navigation.goToBudgetPage();
    await navigation.createAccount({
      name: 'Mastercard',
      balance: -100,
      offBudget: false,
      creditCard: true,
    });
    await navigation.goToBudgetPage();
    await page.setViewportSize(PHONE);
    await new MobileNavigation(page).goToBudgetPage();

    await expect(pill('Mastercard')).toHaveText('0.00');
    expect(await amountColor(pill('Mastercard'))).toBe(
      await themeColor(page, '--color-balanceWarningText'),
    );
    expect(await tint(pill('Mastercard'))).toBe(
      await themeColor(page, '--color-balanceWarningBackground'),
    );
  });
});
