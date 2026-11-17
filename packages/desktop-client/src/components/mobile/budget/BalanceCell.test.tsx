import React from 'react';

import { theme } from '@actual-app/components/theme';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { render, screen, within } from '@testing-library/react';

import { TestProviders } from '#mocks';
import { envelopeBudget } from '#spreadsheet/bindings';

import { BalanceCell } from './BalanceCell';

let cells: Record<string, number> = {};

vi.mock('#hooks/useSheetValue', () => ({
  useSheetValue: (binding: string | { name: string }) =>
    cells[typeof binding === 'string' ? binding : binding.name] ?? null,
}));

vi.mock('#hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
}));

vi.mock('#hooks/useCreditCardsEnabled', () => ({
  useCreditCardsEnabled: () => false,
  useIsPaymentCategory: () => () => false,
}));

const category = {
  id: 'fun',
  name: 'Entertainment',
  group: 'usual',
} as CategoryEntity;

function renderCell() {
  render(
    <TestProviders>
      <BalanceCell
        binding={envelopeBudget.catBalance(category.id)}
        category={category}
        aria-label="Open balance menu for Entertainment category"
      />
    </TestProviders>,
  );
  const cell = screen.getByRole('button', {
    name: 'Open balance menu for Entertainment category',
  });
  return within(cell).getByTestId('balance-pill');
}

describe('BalanceCell', () => {
  beforeEach(() => {
    cells = {};
  });

  it('overspent pill', () => {
    cells = { 'leftover-fun': -9419, 'budget-fun': 10000 };
    const pill = renderCell();

    expect(getComputedStyle(pill).backgroundColor).toBe(
      theme.balanceNegativeBackground,
    );
    const amount = screen.getByText('-94.19');
    expect(getComputedStyle(amount).color).toBe(theme.balanceNegativeText);
  });

  it('zero pill', () => {
    cells = { 'leftover-fun': 0 };
    const pill = renderCell();

    expect(getComputedStyle(pill).backgroundColor).toBe(
      theme.balanceZeroBackground,
    );
    const amount = screen.getByText('0.00');
    expect(getComputedStyle(amount).color).toBe(theme.balanceZeroText);
  });

  it('funded pill', () => {
    cells = { 'leftover-fun': 100022 };
    expect(getComputedStyle(renderCell()).backgroundColor).toBe(
      theme.balancePositiveBackground,
    );
  });
});
