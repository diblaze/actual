import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { MobileAccountPage } from './mobile-account-page';
import { MobileAccountsPage } from './mobile-accounts-page';
import { MobileBankSyncPage } from './mobile-bank-sync-page';
import { MobileBudgetPage } from './mobile-budget-page';
import { MobilePayeesPage } from './mobile-payees-page';
import { MobileReportsPage } from './mobile-reports-page';
import { MobileRulesPage } from './mobile-rules-page';
import { MobileSchedulesPage } from './mobile-schedules-page';
import { MobileTransactionEntryPage } from './mobile-transaction-entry-page';
import { SettingsPage } from './settings-page';

const TAB_PAGES = ['Budget', 'Transactions', 'Accounts', 'Reports'];
const ROUTES_BY_PAGE = {
  Budget: '/budget',
  Transactions: '/accounts/all',
  Accounts: '/accounts',
  Add: '/transactions/new',
  Reports: '/reports',
  Schedules: '/schedules',
  Payees: '/payees',
  Rules: '/rules',
  'Bank sync': '/bank-sync',
  Settings: '/settings',
};

export class MobileNavigation {
  readonly page: Page;
  readonly heading: Locator;
  readonly navbar: Locator;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading');
    this.navbar = page.getByRole('navigation');
    // Floats above the bar on the budget and transaction lists only
    this.addButton = page.getByRole('button', { name: 'Add transaction' });
  }

  async navigateToPage<T extends { waitFor: Locator['waitFor'] }>(
    pageName: keyof typeof ROUTES_BY_PAGE,
    pageModelFactory: () => T,
  ): Promise<T> {
    const pageInstance = pageModelFactory();

    if (this.page.url().endsWith(ROUTES_BY_PAGE[pageName])) {
      // Already on the page.
      return pageInstance;
    }

    // A resize to phone width switches layout after a short debounce; wait
    // for the desktop sidebar to leave so only the tab bar is a navigation
    await expect(this.page.getByTestId('sidebar-card')).toHaveCount(0);

    if (TAB_PAGES.includes(pageName)) {
      await this.navbar.getByRole('link', { name: pageName }).click();
    } else if (pageName === 'Add') {
      if (!(await this.addButton.isVisible())) {
        await this.navbar.getByRole('link', { name: 'Budget' }).click();
      }
      await this.addButton.click();
    } else {
      await this.navbar.getByRole('button', { name: 'More' }).click();
      await this.page
        .getByRole('dialog', { name: 'More' })
        .getByRole('button', { name: pageName })
        .click();
    }

    await pageInstance.waitFor();

    return pageInstance;
  }

  async goToBudgetPage() {
    return await this.navigateToPage(
      'Budget',
      () => new MobileBudgetPage(this.page),
    );
  }

  async goToAccountsPage() {
    return await this.navigateToPage(
      'Accounts',
      () => new MobileAccountsPage(this.page),
    );
  }

  async goToTransactionsPage() {
    return await this.navigateToPage(
      'Transactions',
      () => new MobileAccountPage(this.page),
    );
  }

  async goToTransactionEntryPage() {
    return await this.navigateToPage(
      'Add',
      () => new MobileTransactionEntryPage(this.page),
    );
  }

  async goToReportsPage() {
    return await this.navigateToPage(
      'Reports',
      () => new MobileReportsPage(this.page),
    );
  }

  async goToPayeesPage() {
    return await this.navigateToPage(
      'Payees',
      () => new MobilePayeesPage(this.page),
    );
  }

  async goToSchedulesPage() {
    return this.navigateToPage(
      'Schedules',
      () => new MobileSchedulesPage(this.page),
    );
  }

  async goToRulesPage() {
    return await this.navigateToPage(
      'Rules',
      () => new MobileRulesPage(this.page),
    );
  }

  async goToBankSyncPage() {
    return await this.navigateToPage(
      'Bank sync',
      () => new MobileBankSyncPage(this.page),
    );
  }

  async goToSettingsPage() {
    return await this.navigateToPage(
      'Settings',
      () => new SettingsPage(this.page),
    );
  }
}
