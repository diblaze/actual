// Key screens of the responsive redesign, shot in light and dark on the demo
// budget. Self-contained (base Playwright, no page models beyond the demo
// file) so the same file runs on the approved build for the baselines.
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ConfigurationPage } from './page-models/configuration-page';

async function shoot(page: Page, name: string) {
  // Baselines come from the docker VRT image; plain e2e runs only navigate
  if (!process.env.VRT) return;
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(t => window.Actual.setTheme(t), theme);
    await expect(page.locator('[data-theme]')).toHaveAttribute(
      'data-theme',
      theme,
    );
    await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
      mask: [page.locator('[data-vrt-mask="true"]')],
    });
  }
  await page.evaluate(() => window.Actual.setTheme('auto'));
}

async function openDemo(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await page.goto('/');
  await new ConfigurationPage(page).createTestFile();
}

test.describe('Redesign parity phone', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await openDemo(page, { width: 390, height: 844 });
  });

  test.afterEach(async () => {
    await page?.close();
  });

  const nav = () => page.getByRole('navigation', { name: 'Main' });

  test('budget', async () => {
    await nav().getByRole('link', { name: 'Budget' }).click();
    await expect(
      page.getByRole('button', { name: 'Food', exact: true }),
    ).toBeVisible();
    await shoot(page, 'phone-budget');
  });

  test('category sheet', async () => {
    await nav().getByRole('link', { name: 'Budget' }).click();
    await page.getByRole('button', { name: 'Food', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Food' })).toBeVisible();
    await shoot(page, 'phone-category-sheet');
  });

  test('transactions', async () => {
    await nav().getByRole('link', { name: 'Transactions' }).click();
    await expect(
      page.getByRole('heading', { name: 'Transactions' }),
    ).toBeVisible();
    await shoot(page, 'phone-transactions');
  });

  test('new transaction', async () => {
    await nav().getByRole('link', { name: 'Budget' }).click();
    await page.getByRole('button', { name: 'Add transaction' }).click();
    await expect(page).toHaveURL(/\/transactions\/new/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await shoot(page, 'phone-new-transaction');
  });

  test('accounts', async () => {
    await nav().getByRole('link', { name: 'Accounts' }).click();
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
    await shoot(page, 'phone-accounts');
  });

  test('more sheet and settings', async () => {
    await nav().getByRole('button', { name: 'More' }).click();
    const more = page.getByRole('dialog', { name: 'More' });
    await expect(more).toBeVisible();
    await shoot(page, 'phone-more');

    await more.getByRole('button', { name: 'Settings' }).click();
    await expect(page).toHaveURL(url => url.pathname === '/settings');
    await expect(page.getByTestId('settings')).toBeVisible();
    await expect(more).toBeHidden();
    await shoot(page, 'phone-settings');
  });
});

for (const [label, size] of [
  ['tablet', { width: 1024, height: 768 }],
  ['desktop', { width: 1440, height: 900 }],
] as const) {
  test(`Redesign parity ${label} budget with category selected`, async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await openDemo(page, size);
    await page
      .getByRole('button', { name: 'Food', exact: true })
      .first()
      .click();
    await expect(
      page.getByRole('complementary', { name: 'Food' }),
    ).toBeVisible();
    await shoot(page, `${label}-budget`);
    await page.close();
  });
}
