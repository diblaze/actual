import type { Locator, Page } from '@playwright/test';

import { MobileAccountPage } from './mobile-account-page';

export class MobileTransactionEntryPage {
  readonly page: Page;
  readonly sheetHeader: Locator;
  readonly header: Locator;
  readonly cancelButton: Locator;
  readonly amountField: Locator;
  readonly transactionForm: Locator;
  readonly footer: Locator;
  readonly addTransactionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // The editor's purple header: Cancel, title, ⋯ menu and the amount
    this.sheetHeader = page.getByTestId('transaction-sheet-header');
    this.header = this.sheetHeader.getByRole('heading');
    this.cancelButton = this.sheetHeader.getByRole('button', {
      name: 'Cancel',
    });
    this.transactionForm = page.getByTestId('transaction-form');
    this.amountField = this.transactionForm.getByTestId('amount-input');
    this.footer = page.getByTestId('transaction-form-footer');
    this.addTransactionButton = this.footer.getByRole('button', {
      name: 'Add transaction',
      exact: true,
    });
  }

  async waitFor(...options: Parameters<Locator['waitFor']>) {
    await this.transactionForm.waitFor(...options);
  }

  async fillAmount(value: string) {
    await this.amountField.fill(value);
    await this.amountField.evaluate(el => (el as HTMLInputElement).blur());
    // TransactionEdit.onUpdate runs an async rules-run before setTransactions,
    // so wait for the outer display button (reads props.value) to reflect the
    // committed amount before the next fillField snapshots the transaction.
    await this.transactionForm
      .getByRole('button')
      .filter({ hasText: value })
      .waitFor();
  }

  async fillField(fieldLocator: Locator, content: string) {
    await fieldLocator.click();
    const comboboxInput = this.page.getByRole('combobox').locator('input');
    // pressSequentially + option click: fill()+Enter breaks the autocomplete
    // highlight and selects "None"/wrong entry under CPU contention.
    await comboboxInput.pressSequentially(content);
    // The picker's options; the register behind the sheet has options too
    await this.page
      .locator('[data-testid$="-autocomplete-modal"]')
      .getByRole('option')
      .filter({ hasText: content })
      .first()
      .click();
    await comboboxInput.waitFor({ state: 'hidden' });
    await fieldLocator.filter({ hasText: content }).waitFor();
  }

  async createTransaction() {
    await this.addTransactionButton.click();

    return new MobileAccountPage(this.page);
  }
}
