import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { MobileNavigation } from './page-models/mobile-navigation';

test('calculator backspace supports tap, hold and touch cancellation', async ({
  browser,
}, testInfo) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: testInfo.outputPath('video') },
  });
  try {
    await page.goto('/');
    await new ConfigurationPage(page).createDemoFile();
    const navigation = new MobileNavigation(page);
    const settings = await navigation.goToSettingsPage();
    await settings.enableExperimentalFeature('Mobile calculator');
    const transaction = await navigation.goToTransactionEntryPage();
    await transaction.amountField.click();
    await transaction.amountField.fill('123456789');
    await transaction.amountField.press('End');
    const backspace = page.getByRole('button', { name: '\u232B' });
    await expect(backspace).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('calculator-before.png'),
    });
    const bounds = await backspace.boundingBox();
    if (!bounds) {
      throw new Error('Expected backspace to have a bounding box');
    }
    const touchPoints = [
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    ];
    const session = await page.context().newCDPSession(page);
    await page.clock.install();

    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints,
    });
    await page.clock.runFor(100);
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await expect(transaction.amountField).toHaveValue('12345678');

    await transaction.amountField.fill('123456789');
    await transaction.amountField.press('End');
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints,
    });
    await page.clock.runFor(600);
    await expect(transaction.amountField).toHaveValue('123456');
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.clock.runFor(1000);
    await expect(transaction.amountField).toHaveValue('123456');
    await expect(transaction.amountField).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath('calculator-after.png'),
    });

    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints,
    });
    await page.clock.runFor(400);
    await expect(transaction.amountField).toHaveValue('12345');
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
    await page.clock.runFor(1000);
    await expect(transaction.amountField).toHaveValue('12345');
    await session.detach();
  } finally {
    await page.close();
  }
});

test('budget sheet stays above the calculator keypad', async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    await page.goto('/');
    await new ConfigurationPage(page).createDemoFile();
    const navigation = new MobileNavigation(page);
    const settings = await navigation.goToSettingsPage();
    await settings.enableExperimentalFeature('Mobile calculator');
    const budgetPage = await navigation.goToBudgetPage();
    const categoryName = await budgetPage.getCategoryNameForRow(0);
    const menu = await budgetPage.openBudgetMenu(categoryName);
    await menu.budgetAmountInput.click();

    // Closed keypads stay mounted below the screen; the open one is in view
    const keypadTop = async () => {
      const tops = await Promise.all(
        (await page.getByRole('button', { name: 'AC' }).all()).map(
          async key => (await key.boundingBox())?.y ?? Infinity,
        ),
      );
      return Math.min(...tops);
    };
    await expect.poll(keypadTop).toBeLessThan(844);
    await expect
      .poll(async () => {
        const amount = await menu.budgetAmountInput.boundingBox();
        return !!amount && amount.y + amount.height <= (await keypadTop());
      })
      .toBe(true);
    await expect(menu.heading).toBeInViewport();
  } finally {
    await page.close();
  }
});
