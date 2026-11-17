import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreditCardDebt } from './useCreditCardDebt';

let cells: Record<string, number> = {};
let carrying = true;

vi.mock('./useCreditCardsEnabled', () => ({
  useCreditCardsEnabled: () => true,
}));

vi.mock('./useFeatureFlag', () => ({
  useFeatureFlag: (name: string) => name === 'ccCarryCardDebt' && carrying,
}));

vi.mock('./useSheetValue', () => ({
  useSheetValue: (name: string) => cells[name],
}));

describe('useCreditCardDebt', () => {
  beforeEach(() => {
    cells = {};
    carrying = true;
  });

  it('excludes carried card debt', () => {
    cells = {
      'leftover-food': -20000,
      'cash-leftover-food': 0,
      'cc-carried-food': 20000,
    };
    const carried = renderHook(() => useCreditCardDebt('food'));
    expect(carried.result.current).toBe(0);

    cells['cc-carried-food'] = 0;
    const current = renderHook(() => useCreditCardDebt('food'));
    expect(current.result.current).toBe(20000);
  });

  it('ignores the carried cell with the carry setting off', () => {
    carrying = false;
    cells = {
      'leftover-food': -20000,
      'cash-leftover-food': 0,
      'cc-carried-food': 20000,
    };
    const { result } = renderHook(() => useCreditCardDebt('food'));
    expect(result.current).toBe(20000);
  });
});
