import { currencyToAmount } from '@actual-app/core/shared/util';
import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import type { MobileBudgetPage } from './page-models/mobile-budget-page';
import { MobileNavigation } from './page-models/mobile-navigation';
import { Navigation } from './page-models/navigation';

const PHONE_SIZES = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
];

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) {
    throw new Error('Element has no bounding box.');
  }
  return rect;
}

// Smallest font size of any text inside the element, in px
function smallestFontSize(locator: Locator) {
  return locator.evaluate(el =>
    Math.min(
      ...[el, ...el.querySelectorAll('*')]
        .filter(e =>
          [...e.childNodes].some(
            n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
          ),
        )
        .map(e => parseFloat(getComputedStyle(e).fontSize)),
    ),
  );
}

function cents(text: string | null) {
  return Math.round((currencyToAmount(text ?? '') ?? NaN) * 100);
}

for (const size of PHONE_SIZES) {
  test.describe(`Mobile budget redesign ${size.width}x${size.height}`, () => {
    let page: Page;
    let navigation: MobileNavigation;
    let budgetPage: MobileBudgetPage;

    test.beforeEach(async ({ browser }) => {
      page = await browser.newPage();
      navigation = new MobileNavigation(page);

      await page.setViewportSize(size);
      await page.goto('/');
      await new ConfigurationPage(page).createTestFile();
      budgetPage = await navigation.goToBudgetPage();
    });

    test.afterEach(async () => {
      await page?.close();
    });

    function row(name: string) {
      return budgetPage.categoryRows.filter({
        has: page.getByTestId('category-name').getByText(name, {
          exact: true,
        }),
      });
    }

    function cells(name: string) {
      return {
        name: row(name).getByRole('button', { name, exact: true }),
        budgeted: budgetPage.budgetTable.getByRole('button', {
          name: `Open budget menu for ${name} category`,
        }),
        spent: budgetPage.budgetTable.getByRole('button', {
          name: `Show transactions for ${name} category`,
        }),
        balance: budgetPage.budgetTable.getByRole('button', {
          name: `Open balance menu for ${name} category`,
        }),
      };
    }

    // Expense categories whose Balance is below, or above, zero
    async function categoriesByBalance(sign: 'negative' | 'positive') {
      const pills = budgetPage.budgetTable.getByRole('button', {
        name: /^Open balance menu for .* category$/,
      });
      const names: string[] = [];
      for (const pill of await pills.all()) {
        const amount = cents(await pill.textContent());
        const label = (await pill.getAttribute('aria-label')) ?? '';
        const name = label.replace(
          /^Open balance menu for (.*) category$/,
          '$1',
        );
        if (
          (await cells(name).budgeted.count()) > 0 &&
          (sign === 'negative' ? amount < 0 : amount > 0)
        ) {
          names.push(name);
        }
      }
      return names;
    }

    // Budget an amount from the budget menu, then close the menu with its
    // Close button
    async function setBudgeted(name: string, amount: string) {
      const menu = await budgetPage.openBudgetMenu(name);
      await menu.setBudgetAmount(amount);
      const sheet = page.getByRole('dialog', { name });
      if (await sheet.isVisible()) {
        await sheet.getByRole('button', { name: 'Close' }).click();
      }
      await expect(sheet).toBeHidden();
    }

    async function openSheet(name: string) {
      await cells(name).balance.click();
      const sheet = page.getByRole('dialog', { name });
      await expect(sheet).toBeVisible();
      return sheet;
    }

    test('row columns', async () => {
      const { budgeted, spent, balance } = cells('Food');
      const rects = [];
      for (const cell of [budgeted, balance]) {
        await expect(cell).toHaveText(/^-?[\d,]+\.\d\d$/);
        const rect = await box(cell);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(await smallestFontSize(cell)).toBeGreaterThanOrEqual(12);
        rects.push(rect);
      }
      // Budgeted then Balance, side by side inside the screen; no Spent
      expect(rects[0].x + rects[0].width).toBeLessThanOrEqual(rects[1].x);
      expect(rects[1].x + rects[1].width).toBeLessThanOrEqual(size.width);
      await expect(spent).toHaveCount(0);
      expect((await box(row('Food'))).height).toBeGreaterThanOrEqual(52);
    });

    test('group totals', async () => {
      const group = budgetPage.categoryGroup('Usual Expenses');
      const heading = group.getByTestId('category-group-row');
      await expect(
        heading.getByText('Budgeted', { exact: true }),
      ).toBeVisible();
      await expect(heading.getByText('Balance', { exact: true })).toBeVisible();

      let budgetedSum = 0;
      let balanceSum = 0;
      for (const cell of await group
        .getByRole('button', { name: /^Open budget menu for .* category$/ })
        .all()) {
        budgetedSum += cents(await cell.textContent());
      }
      for (const cell of await group
        .getByRole('button', { name: /^Open balance menu for .* category$/ })
        .all()) {
        balanceSum += cents(await cell.textContent());
      }
      expect(budgetedSum).not.toBe(0);
      expect(
        cents(await heading.getByTestId('group-budgeted').textContent()),
      ).toBe(budgetedSum);
      expect(
        cents(await heading.getByTestId('group-balance').textContent()),
      ).toBe(balanceSum);
    });

    test('large amount not truncated', async () => {
      // As wide as an overspent "-12,345.67", which the input cannot enter
      await setBudgeted('Food', '123456.78');

      const { budgeted, balance } = cells('Food');
      await expect(budgeted).toHaveText('123,456.78');
      await expect(balance).toHaveText(/^12\d,\d{3}\.\d\d$/);
      for (const cell of [budgeted, balance]) {
        // No element in the cell clips its text
        const clipped = await cell.evaluate(el =>
          [el, ...el.querySelectorAll('*')].some(
            e => e.scrollWidth > e.clientWidth + 1,
          ),
        );
        expect(clipped).toBe(false);
        expect(await smallestFontSize(cell)).toBeGreaterThanOrEqual(12);
        expect(
          (await box(cell)).x + (await box(cell)).width,
        ).toBeLessThanOrEqual(size.width);
      }
      // Columns stay aligned: the group's Balance label sits over the pill
      const header = row('Food')
        .locator('xpath=ancestor::*[@data-testid="category-group"][1]')
        .getByTestId('category-group-row')
        .getByText('Balance', { exact: true });
      const headerRight = (await box(header)).x + (await box(header)).width;
      const cellRight = (await box(balance)).x + (await box(balance)).width;
      expect(Math.abs(headerRight - cellRight)).toBeLessThanOrEqual(12);
    });

    test('cell taps', async () => {
      const { name, budgeted, balance } = cells('Food');
      for (const target of [name, budgeted, balance]) {
        expect((await box(target)).height).toBeGreaterThanOrEqual(44);
      }

      await budgeted.click();
      const budgetMenu = page.getByRole('dialog', { name: 'Food' });
      // The amount, which turns into its input when tapped
      await expect(
        budgetMenu.getByRole('button', { name: /^-?[\d,]+\.\d\d$/ }),
      ).toBeVisible();
      await budgetMenu.getByRole('button', { name: 'Close' }).click();
      await expect(budgetMenu).toBeHidden();

      for (const target of [name, balance]) {
        await target.click();
        const sheet = page.getByRole('dialog', { name: 'Food' });
        await expect(sheet.getByText('Balance', { exact: true })).toBeVisible();
        await sheet.getByRole('button', { name: 'Close' }).click();
        await expect(sheet).toBeHidden();
      }
    });

    test('name wraps', async () => {
      const menu = await budgetPage.openCategoryMenu('Entertainment');
      await menu.locator
        .getByRole('button', { name: 'Rename', exact: true })
        .click();
      const input = menu.locator.getByRole('textbox', { name: 'Name' });
      await input.fill('Entertainment & hobbies');
      await input.press('Enter');
      await menu.close();

      const name = row('Entertainment & hobbies').getByTestId('category-name');
      await expect(name).toBeVisible();
      const fits = await name.evaluate(el => {
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
        return {
          clipped:
            el.scrollHeight > el.clientHeight + 1 ||
            el.scrollWidth > el.clientWidth + 1,
          lines: Math.round(el.getBoundingClientRect().height / lineHeight),
        };
      });
      expect(fits.clipped).toBe(false);
      expect(fits.lines).toBe(2);
      expect(
        Math.round((await box(row('Entertainment & hobbies'))).height),
      ).toBe(Math.round((await box(row('Food'))).height));
    });

    test('amount column gap', async () => {
      await expect(budgetPage.categoryRows.first()).toBeVisible();
      // Every Category | Budgeted | Balance grid: group headings and
      // category rows. Column gap, and the gap between the text of the two
      // amount columns
      const gaps = await page.evaluate(() =>
        [...document.querySelectorAll('*')]
          .filter(
            el =>
              getComputedStyle(el).display === 'grid' &&
              getComputedStyle(el).gridTemplateColumns.split(' ').length ===
                3 &&
              el.children.length === 3,
          )
          .flatMap(el => {
            // Union of the cell's text, not its (full-width) boxes
            const rects = [...el.children].slice(1).map(cell => {
              const walker = document.createTreeWalker(
                cell,
                NodeFilter.SHOW_TEXT,
              );
              let left = Infinity;
              let right = -Infinity;
              while (walker.nextNode()) {
                if (!walker.currentNode.nodeValue?.trim()) continue;
                const range = document.createRange();
                range.selectNodeContents(walker.currentNode);
                const rect = range.getBoundingClientRect();
                left = Math.min(left, rect.left);
                right = Math.max(right, rect.right);
              }
              return { left, right };
            });
            return [
              parseFloat(getComputedStyle(el).columnGap),
              rects[1].left - rects[0].right,
            ].filter(Number.isFinite);
          }),
      );
      expect(gaps.length).toBeGreaterThan(10);
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(8);
    });

    // Budgeting 50.00 less for Food leaves 50.00 to budget
    async function setToBudget(target: number) {
      const toBudget = cents(
        await budgetPage.toBudgetCard
          .getByTestId('to-budget-amount')
          .textContent(),
      );
      const budgeted = cents(await cells('Food').budgeted.textContent());
      await setBudgeted(
        'Food',
        ((budgeted + toBudget - target) / 100).toFixed(2),
      );
      await expect(
        budgetPage.toBudgetCard.getByTestId('to-budget-amount'),
      ).toHaveText((target / 100).toFixed(2));
    }

    test('to budget card', async () => {
      const card = budgetPage.toBudgetCard;
      await setToBudget(5000);
      await expect(card.getByText('To budget', { exact: true })).toBeVisible();

      await card.getByRole('button', { name: 'Move', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'To budget' });
      // The first action row, after the header's Close
      await expect(
        menu.getByRole('button', { name: /^(?!Close$)/ }).first(),
      ).toHaveText('Move to a category');
      await menu.getByRole('button', { name: 'Close' }).click();
      await expect(menu).toBeHidden();
    });

    test('overbudgeted cover', async () => {
      const card = budgetPage.toBudgetCard;
      await setToBudget(-5000);

      await expect(
        card.getByText('Overbudgeted', { exact: true }),
      ).toBeVisible();
      await card.getByRole('button', { name: 'Cover', exact: true }).click();
      // The cover dialog opens its category picker over itself
      await expect(
        page.getByRole('dialog', { name: 'Cover overbudgeted' }),
      ).toHaveCount(1);
      await expect(
        page.getByRole('dialog', { name: 'Category' }),
      ).toBeVisible();
    });

    // The demo budget's first month already has overspent categories
    test('overspent banner', async () => {
      const overspent = await categoriesByBalance('negative');
      const [funded] = await categoriesByBalance('positive');
      expect(overspent.length).toBeGreaterThan(0);
      const banner = page.getByRole('group', {
        name:
          overspent.length === 1
            ? '1 category overspent'
            : `${overspent.length} categories overspent`,
        exact: true,
      });
      await banner.getByRole('button', { name: 'Fix' }).click();

      const list = page.getByRole('dialog', { name: 'Cover overspending' });
      await expect(list).toBeVisible();
      for (const name of overspent) {
        await expect(list.getByText(name, { exact: true })).toBeVisible();
      }

      // Cover the first one from a funded category: the cover dialog opens
      // its own category picker on top of the list, and picking from it
      // keeps the cover dialog open
      const [first] = overspent;
      await list.getByRole('option', { name: first }).click();
      await page
        .getByTestId('category-autocomplete-modal')
        .last()
        .getByRole('option', { name: funded })
        .click();
      const cover = page.getByRole('dialog', { name: first, exact: true });
      await cover.getByRole('button', { name: 'Transfer' }).click();
      await expect(cover).toBeHidden();
      await expect(list).toBeVisible();
      await list.getByRole('button', { name: 'Close' }).click();
      await expect(list).toBeHidden();
      await expect(cells(first).balance).toHaveText('0.00');
    });

    test('no overspent banner', async () => {
      // Next month has no spending yet, so nothing is overspent
      await budgetPage.goToNextMonth();
      await expect
        .poll(async () => (await categoriesByBalance('negative')).length)
        .toBe(0);
      await expect(page.getByRole('group', { name: /overspent/i })).toHaveCount(
        0,
      );
      await expect(page.getByRole('button', { name: 'Fix' })).toHaveCount(0);
    });

    test('uncategorized banner', async () => {
      await expect(
        page.getByRole('group', { name: /Uncategorized$/ }),
      ).toHaveCount(0);

      // Two transactions without a category, entered on the desktop register
      await page.setViewportSize({ width: 1280, height: 800 });
      const accountPage = await new Navigation(page).goToAccountPage(
        'Ally Savings',
      );
      await accountPage.waitFor();
      for (const notes of ['uncategorized one', 'uncategorized two']) {
        await accountPage.createSingleTransaction({ notes, debit: '12.34' });
      }
      await page.setViewportSize(size);
      await navigation.goToBudgetPage();

      const banner = page.getByRole('group', { name: '2 Uncategorized' });
      await banner.getByRole('button', { name: 'Show' }).click();
      await expect(page).toHaveURL(/\/categories\/uncategorized$/);
    });

    test('sheet overspent', async () => {
      const [overspent] = await categoriesByBalance('negative');
      const amount = (await cells(overspent).balance.textContent()) ?? '';
      const unsigned = amount.replace(/^-/, '');
      expect(amount).toBe(`-${unsigned}`);

      const sheet = await openSheet(overspent);
      await expect(sheet.getByTestId('sheet-balance')).toHaveText(amount);
      await expect(
        sheet.getByRole('button', { name: `Cover ${unsigned}`, exact: true }),
      ).toBeVisible();
    });

    test('sheet funded', async () => {
      const [funded] = await categoriesByBalance('positive');
      const sheet = await openSheet(funded);

      await expect(sheet.getByRole('button', { name: /^Cover/ })).toHaveCount(
        0,
      );
      for (const action of [
        'Move money',
        'Show transactions',
        'Rename or hide',
      ]) {
        await expect(
          sheet.getByRole('button', { name: action, exact: true }),
        ).toBeVisible();
      }
    });

    test('sheet spent bar', async () => {
      // Budget four times the month's spending, so a quarter is spent
      let sheet = await openSheet('Food');
      const spent = cents(await sheet.getByTestId('sheet-spent').textContent());
      expect(spent).toBeLessThan(0);
      await sheet.getByRole('button', { name: 'Close' }).click();
      await setBudgeted('Food', ((-spent * 4) / 100).toFixed(2));

      sheet = await openSheet('Food');
      const bar = sheet.getByRole('img', {
        name: '25 percent of budget spent',
      });
      await expect(bar).toBeVisible();
      const fill = bar.locator(':scope > *').first();
      expect((await box(fill)).width / (await box(bar)).width).toBeCloseTo(
        0.25,
        1,
      );
    });

    test('sheet recent', async () => {
      // Entering five transactions on the register takes most of the budget
      test.slow();
      // Five Food transactions today, after the demo's earlier ones
      await page.setViewportSize({ width: 1280, height: 800 });
      const accountPage = await new Navigation(page).goToAccountPage(
        'Ally Savings',
      );
      await accountPage.waitFor();
      for (const debit of ['1.01', '1.02', '1.03', '1.04', '1.05']) {
        await accountPage.createSingleTransaction({
          payee: 'Kroger',
          category: 'Food',
          debit,
        });
      }
      await page.setViewportSize(size);
      await navigation.goToBudgetPage();

      const sheet = await openSheet('Food');
      const items = sheet
        .getByRole('list', { name: 'Recent transactions' })
        .getByRole('listitem');
      await expect(items.getByTestId('recent-amount')).toHaveText([
        '-1.05',
        '-1.04',
        '-1.03',
        '-1.02',
      ]);
      await expect(items.getByTestId('recent-payee')).toHaveText(
        Array(4).fill('Kroger'),
      );
      const dates = await items
        .locator('time')
        .evaluateAll(els => els.map(el => el.getAttribute('datetime')));
      expect(new Set(dates).size).toBe(1);
      await expect(items.locator('time').first()).not.toBeEmpty();
    });
  });
}
