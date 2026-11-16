import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { MobileAccountPage } from './mobile-account-page';
import { BalanceMenuModal } from './mobile-balance-menu-modal';
import { BudgetMenuModal } from './mobile-budget-menu-modal';
import { CategoryGroupMenuModal } from './mobile-category-group-menu-modal';
import { CategoryMenuModal } from './mobile-category-menu-modal';
import { EnvelopeBudgetSummaryModal } from './mobile-envelope-budget-summary-modal';
import { TrackingBudgetSummaryModal } from './mobile-tracking-budget-summary-modal';

export class MobileBudgetPage {
  readonly MONTH_HEADER_DATE_FORMAT = "MMMM ''yy";

  readonly page: Page;
  readonly heading: Locator;
  readonly previousMonthButton: Locator;
  readonly selectedBudgetMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly budgetPageMenuButton: Locator;
  readonly budgetTableHeader: Locator;
  readonly toBudgetCard: Locator;
  readonly toBudgetButton: Locator;
  readonly overbudgetedButton: Locator;
  readonly savedButton: Locator;
  readonly projectedSavingsButton: Locator;
  readonly overspentButton: Locator;
  readonly budgetTable: Locator;
  readonly categoryRows: Locator;
  readonly categoryNames: Locator;
  readonly categoryGroupRows: Locator;
  readonly categoryGroupNames: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page header locators

    // The month is the large title; Previous and Next sit above it
    this.heading = page.getByRole('heading');
    this.previousMonthButton = page.getByRole('button', {
      name: 'Previous month',
    });
    this.selectedBudgetMonthButton = this.heading.locator('button[data-month]');
    this.nextMonthButton = page.getByRole('button', {
      name: 'Next month',
    });
    this.budgetPageMenuButton = page.getByRole('button', {
      name: 'Budget page menu',
    });

    // Budget table locators

    // Banners and the To budget card above the groups
    this.budgetTableHeader = page.getByTestId('budget-table-header');
    this.toBudgetCard = this.budgetTableHeader.getByTestId('to-budget-card');

    // Envelope budget summary buttons
    this.toBudgetButton = this.budgetTableHeader.getByRole('button', {
      name: 'To Budget',
    });
    this.overbudgetedButton = this.budgetTableHeader.getByRole('button', {
      name: 'Overbudgeted',
    });

    // Tracking budget summary buttons
    this.savedButton = this.budgetTableHeader.getByRole('button', {
      name: 'Saved',
    });
    this.projectedSavingsButton = this.budgetTableHeader.getByRole('button', {
      name: 'Projected savings',
    });
    this.overspentButton = this.budgetTableHeader.getByRole('button', {
      name: 'Overspent',
    });

    this.budgetTable = page.getByTestId('budget-table');

    this.categoryRows = this.budgetTable
      .getByTestId('budget-groups')
      .getByTestId('category-row');

    this.categoryNames = this.categoryRows.getByTestId('category-name');

    this.categoryGroupRows = this.budgetTable
      .getByTestId('budget-groups')
      .getByTestId('category-group-row');

    this.categoryGroupNames = this.categoryGroupRows.getByTestId(
      'category-group-name',
    );
  }

  async determineBudgetType() {
    return (await this.#getButtonForEnvelopeBudgetSummary({
      throwIfNotFound: false,
    })) !== null
      ? 'Envelope'
      : 'Tracking';
  }

  async waitFor(...options: Parameters<Locator['waitFor']>) {
    await this.budgetTable.waitFor(...options);
  }

  // A group's card: its heading (name, totals) and its category rows
  categoryGroup(categoryGroupName: string) {
    return this.budgetTable.getByTestId('category-group').filter({
      has: this.page
        .getByTestId('category-group-name')
        .getByText(categoryGroupName, { exact: true }),
    });
  }

  async getSelectedMonth() {
    const selectedMonth = await this.heading
      .locator('[data-month]')
      .getAttribute('data-month');

    if (!selectedMonth) {
      throw new Error('Failed to get the selected month.');
    }

    return selectedMonth;
  }

  async openBudgetPageMenu() {
    await this.budgetPageMenuButton.click();
  }

  async getCategoryGroupNameForRow(idx: number) {
    const groupNameText = await this.categoryGroupNames.nth(idx).textContent();
    if (!groupNameText) {
      throw new Error(`Failed to get category group name for row ${idx}.`);
    }
    return groupNameText;
  }

  async #getButtonForCategoryGroup(categoryGroupName: string | RegExp) {
    return this.categoryGroupRows.getByRole('button', {
      name: categoryGroupName,
      exact: true,
    });
  }

  async openCategoryGroupMenu(categoryGroupName: string | RegExp) {
    const categoryGroupButton =
      await this.#getButtonForCategoryGroup(categoryGroupName);
    await categoryGroupButton.click();

    return new CategoryGroupMenuModal(this.page.getByRole('dialog').last());
  }

  async getCategoryNameForRow(idx: number) {
    const categoryNameText = await this.categoryNames.nth(idx).textContent();
    if (!categoryNameText) {
      throw new Error(`Failed to get category name for row ${idx}.`);
    }
    return categoryNameText;
  }

  async #getButtonForCategory(categoryName: string | RegExp) {
    return this.categoryRows.getByRole('button', {
      name: categoryName,
      exact: true,
    });
  }

  // The name opens the category sheet; its "Rename or hide" opens the menu
  async openCategoryMenu(categoryName: string | RegExp) {
    const categoryButton = await this.#getButtonForCategory(categoryName);
    await categoryButton.click();
    await this.page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: 'Rename or hide' })
      .click();

    return new CategoryMenuModal(this.page.getByRole('dialog').last());
  }

  async getButtonForBudgeted(categoryName: string) {
    const button = this.budgetTable.getByRole('button', {
      name: `Open budget menu for ${categoryName} category`,
    });

    if (await button.isVisible()) {
      return button;
    }

    throw new Error(
      `Budgeted button for category ${categoryName} could not be located on the page.`,
    );
  }

  // Phone rows show Budgeted and Balance; Spent lives in the category sheet
  async getSpentAmount(categoryName: string) {
    const balanceMenuModal = await this.openBalanceMenu(categoryName);
    const spent = await balanceMenuModal.locator
      .getByTestId('sheet-spent')
      .textContent();
    await balanceMenuModal.close();
    return spent;
  }

  async openBudgetMenu(categoryName: string) {
    const budgetedButton = await this.getButtonForBudgeted(categoryName);
    await budgetedButton.click();

    return new BudgetMenuModal(this.page.getByRole('dialog').last());
  }

  async openSpentPage(categoryName: string) {
    const balanceMenuModal = await this.openBalanceMenu(categoryName);
    await balanceMenuModal.locator
      .getByRole('button', { name: 'Show transactions' })
      .click();

    return new MobileAccountPage(this.page);
  }

  async openBalanceMenu(categoryName: string) {
    const balanceButton = this.budgetTable.getByRole('button', {
      name: `Open balance menu for ${categoryName} category`,
    });

    if (await balanceButton.isVisible()) {
      await balanceButton.click();
      return new BalanceMenuModal(this.page.getByRole('dialog').last());
    } else {
      throw new Error(
        `Balance button for category ${categoryName} not found or not visible.`,
      );
    }
  }

  async #waitForNewMonthToLoad({
    currentMonth,
    errorMessage,
  }: {
    currentMonth: string;
    errorMessage: string;
  }) {
    await expect(
      this.heading.locator('[data-month]'),
      errorMessage,
    ).not.toHaveAttribute('data-month', currentMonth);

    return this.getSelectedMonth();
  }

  async goToPreviousMonth() {
    const currentMonth = await this.getSelectedMonth();

    await this.previousMonthButton.click();

    return await this.#waitForNewMonthToLoad({
      currentMonth,
      errorMessage: 'Failed to navigate to the previous month.',
    });
  }

  async openMonthMenu() {
    await this.selectedBudgetMonthButton.click();
  }

  async goToNextMonth() {
    const currentMonth = await this.getSelectedMonth();

    await this.nextMonthButton.click();

    return await this.#waitForNewMonthToLoad({
      currentMonth,
      errorMessage: 'Failed to navigate to the next month.',
    });
  }

  async #getButtonForEnvelopeBudgetSummary({
    throwIfNotFound = true,
  }: { throwIfNotFound?: boolean } = {}) {
    const button = this.toBudgetButton.or(this.overbudgetedButton).first();
    try {
      await button.waitFor();
    } catch (err) {
      if (!throwIfNotFound) return null;
      throw err;
    }
    return button;
  }

  async openEnvelopeBudgetSummary() {
    const budgetSummaryButton = await this.#getButtonForEnvelopeBudgetSummary();
    if (!budgetSummaryButton) {
      throw new Error('Envelope budget summary button not found.');
    }
    await budgetSummaryButton.click();

    return new EnvelopeBudgetSummaryModal(this.page.getByRole('dialog').last());
  }

  async #getButtonForTrackingBudgetSummary({
    throwIfNotFound = true,
  }: { throwIfNotFound?: boolean } = {}) {
    const button = this.savedButton
      .or(this.projectedSavingsButton)
      .or(this.overspentButton)
      .first();
    try {
      await button.waitFor();
    } catch (err) {
      if (!throwIfNotFound) return null;
      throw err;
    }
    return button;
  }

  async openTrackingBudgetSummary() {
    const budgetSummaryButton = await this.#getButtonForTrackingBudgetSummary();
    if (!budgetSummaryButton) {
      throw new Error('Tracking budget summary button not found.');
    }
    await budgetSummaryButton.click();

    return new TrackingBudgetSummaryModal(this.page.getByRole('dialog').last());
  }
}
