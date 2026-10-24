import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreditCardsEnabled } from '#hooks/useCreditCardsEnabled';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { TestProviders } from '#mocks';

import { ExperimentalFeatures } from './Experimental';

vi.mock('#hooks/useCreditCardsEnabled', () => ({
  useCreditCardsEnabled: vi.fn(),
}));
vi.mock('#hooks/useSyncedPref', () => ({
  useSyncedPref: vi.fn(),
}));

// One setter per synced pref key, so a test can tell which pref was saved
const setters: Record<string, ReturnType<typeof vi.fn>> = {};

async function expand(creditCards: boolean) {
  vi.mocked(useCreditCardsEnabled).mockReturnValue(creditCards);
  render(
    <TestProviders>
      <ExperimentalFeatures />
    </TestProviders>,
  );
  await userEvent.click(screen.getByTestId('experimental-settings'));
}

const cardDebtSetting = () =>
  screen.queryByRole('checkbox', { name: /carry uncovered card spending/i });

describe('ExperimentalFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(setters)) {
      delete setters[key];
    }
    vi.mocked(useSyncedPref).mockImplementation(((key: string) => {
      setters[key] ??= vi.fn();
      return [undefined, setters[key]];
    }) as unknown as typeof useSyncedPref);
  });

  it('hides the card debt setting while card payment categories are off', async () => {
    await expand(false);

    expect(cardDebtSetting()).not.toBeInTheDocument();
  });

  it('hides the card debt setting in a tracking budget', async () => {
    const actual = await vi.importActual<{
      useCreditCardsEnabled: typeof useCreditCardsEnabled;
    }>('#hooks/useCreditCardsEnabled');
    const prefs: Record<string, string> = {
      'flags.ccPaymentCategories': 'true',
      budgetType: 'tracking',
    };
    vi.mocked(useSyncedPref).mockImplementation(((key: string) => [
      prefs[key],
      vi.fn(),
    ]) as unknown as typeof useSyncedPref);
    vi.mocked(useCreditCardsEnabled).mockImplementation(
      actual.useCreditCardsEnabled,
    );
    render(
      <TestProviders>
        <ExperimentalFeatures />
      </TestProviders>,
    );
    await userEvent.click(screen.getByTestId('experimental-settings'));

    expect(cardDebtSetting()).not.toBeInTheDocument();
  });

  it('shows the card debt setting unticked by default', async () => {
    await expand(true);

    expect(cardDebtSetting()).toBeInTheDocument();
    expect(cardDebtSetting()).not.toBeChecked();
  });

  it('saves the card debt setting when ticked', async () => {
    await expand(true);
    await userEvent.click(cardDebtSetting() as HTMLElement);

    expect(setters['flags.ccCarryCardDebt']).toHaveBeenCalledWith('true');
  });
});
