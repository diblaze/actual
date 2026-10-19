import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { importBudget } from '#budgetfiles/budgetfilesSlice';
import { TestProviders } from '#mocks';

import { ImportYNAB5Modal } from './ImportYNAB5Modal';

vi.mock('#budgetfiles/budgetfilesSlice', () => ({
  importBudget: vi.fn(() => () => Promise.resolve()),
}));

vi.mock('#hooks/useNavigate', () => ({
  useNavigate: () => vi.fn(),
}));

describe('ImportYNAB5Modal', () => {
  beforeEach(() => {
    vi.mocked(importBudget).mockClear();
    window.Actual = {
      ...window.Actual,
      openFileDialog: vi.fn().mockResolvedValue(['/tmp/budget.json']),
    };
  });

  function renderModal() {
    render(
      <TestProviders>
        <ImportYNAB5Modal />
      </TestProviders>,
    );
  }

  it('imports without the credit card option by default', async () => {
    renderModal();
    await userEvent.click(screen.getByText('Select file...'));
    expect(importBudget).toHaveBeenCalledWith({
      filepath: '/tmp/budget.json',
      type: 'ynab5',
      ccPaymentCategories: false,
    });
  });

  it('imports with the credit card option when ticked', async () => {
    renderModal();
    await userEvent.click(
      screen.getByLabelText('Credit card payment categories (experimental)'),
    );
    await userEvent.click(screen.getByText('Select file...'));
    expect(importBudget).toHaveBeenCalledWith({
      filepath: '/tmp/budget.json',
      type: 'ynab5',
      ccPaymentCategories: true,
    });
  });
});
