import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileNavigation } from './page-models/mobile-navigation';
import type { SettingsPage } from './page-models/settings-page';

const PHONE = { width: 390, height: 844 };
const FEATURE = 'Credit card payment categories';
const CARRY_FEATURE =
  'Subfeature: Carry uncovered card spending into next month';

// Under Playwright the app's today is 2017-01-01 (monthUtils.currentDay).
// Fresh budget with Checking 1,000.00, Card -250.00 and a bank-linked
// account (so the On budget total is 750.00), a Rent schedule that went overdue on
// 2016-12-29, one payee per letter A-Z and a rule that sets
// Spotify's category to Food
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
      balance: 1000,
    });
    await $send<string>('account-create', { name: 'Card', balance: -250 });
    const linked = await $send<string>('account-create', {
      name: 'Linked',
      balance: 0,
    });
    await $send('api/account-update', {
      id: linked,
      fields: { account_sync_source: 'simpleFin' },
    });

    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      await $send<string>('payee-create', { name: `${letter}payee` });
    }
    const rent = await $send<string>('payee-create', { name: 'Rent' });
    const spotify = await $send<string>('payee-create', { name: 'Spotify' });

    await $send('rule-add', {
      stage: null,
      conditionsOp: 'and',
      conditions: [{ op: 'is', field: 'payee', value: spotify }],
      actions: [{ op: 'set', field: 'category', value: food }],
    });

    await $send('schedule/create', {
      schedule: { name: 'Rent', posts_transaction: false },
      conditions: [
        { op: 'is', field: 'account', value: checking },
        { op: 'is', field: 'payee', value: rent },
        { op: 'is', field: 'date', value: '2016-12-29' },
        { op: 'is', field: 'amount', value: -5000 },
      ],
    });
  });
}

test.describe('Mobile manage screens redesign', () => {
  let page: Page;
  let navigation: MobileNavigation;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new MobileNavigation(page);

    await page.goto('/');
    await new ConfigurationPage(page).startFresh();
    await seed(page);
    await page.setViewportSize(PHONE);
    await page.reload();
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('account group total', async () => {
    const accountsPage = await navigation.goToAccountsPage();
    await expect(
      page.getByRole('button', { name: 'View On budget transactions' }),
    ).toContainText('750.00');
    await expect(
      accountsPage.accountListItems.filter({ hasText: 'Checking' }),
    ).toContainText('1,000.00');
    await expect(
      accountsPage.accountListItems.filter({ hasText: 'Card' }),
    ).toContainText('250.00');
  });

  test('synced badge', async () => {
    const accountsPage = await navigation.goToAccountsPage();
    await expect(
      accountsPage.accountListItems.filter({ hasText: 'Linked' }),
    ).toContainText('Synced');
  });

  test('manual badge', async () => {
    const accountsPage = await navigation.goToAccountsPage();
    const checking = accountsPage.accountListItems.filter({
      hasText: 'Checking',
    });
    await expect(checking).toContainText('Manual');
    await expect(checking).not.toContainText('Synced');
  });

  // The app's clock is fixed, so a recurring schedule is never overdue here
  // and Skip cannot move it; Skip's wiring is covered in SchedulesList.test.tsx
  test('overdue skip', async () => {
    await navigation.goToSchedulesPage();
    const overdue = page.getByRole('region', { name: 'Overdue' });
    const skip = overdue.getByRole('button', { name: 'Skip' });
    await expect(skip).toBeVisible();
    expect((await skip.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await overdue.getByRole('button', { name: 'Mark as paid' }).click();
    await expect(overdue).toHaveCount(0);
  });

  test('letter index', async () => {
    const payeesPage = await navigation.goToPayeesPage();
    const letter = page
      .getByRole('navigation', { name: 'Letter index' })
      .getByRole('button', { name: 'M', exact: true });
    await letter.scrollIntoViewIfNeeded();
    expect((await letter.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await letter.click();

    const target = payeesPage.payeesList
      .getByRole('row')
      .filter({ hasText: 'Mpayee' });
    await expect(target).toBeVisible();
    const list = await payeesPage.payeesList.boundingBox();
    const box = await target.boundingBox();
    expect(box!.y - list!.y).toBeLessThan(120);
  });

  test('rule sentence', async () => {
    await navigation.goToRulesPage();
    await expect(
      page
        .getByRole('grid', { name: 'Rules' })
        .getByRole('row')
        .filter({ hasText: 'Spotify' }),
    ).toContainText('If payee is Spotify, set category to Food');
  });

  test('theme dark', async () => {
    const settingsPage = await navigation.goToSettingsPage();
    await settingsPage.waitFor();
    await page
      .getByRole('radiogroup', { name: 'Theme' })
      .getByRole('radio', { name: 'Dark' })
      .click();
    await expect(page.locator('[data-theme]')).toHaveAttribute(
      'data-theme',
      'dark',
    );
  });

  test('carry card debt toggle', async () => {
    const settingsPage: SettingsPage = await navigation.goToSettingsPage();
    await settingsPage.setExperimentalFeature(FEATURE, true);

    const carry = page.getByRole('checkbox', { name: CARRY_FEATURE });
    await expect(carry).toBeVisible();
    if (!(await carry.isChecked())) {
      await carry.click();
    }
    await expect(carry).toBeChecked();

    await page.reload();
    const reloaded = await navigation.goToSettingsPage();
    await reloaded.setExperimentalFeature(FEATURE, true);
    await expect(
      page.getByRole('checkbox', { name: CARRY_FEATURE }),
    ).toBeChecked();
  });
});
