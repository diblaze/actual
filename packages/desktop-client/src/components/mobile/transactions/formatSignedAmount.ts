import { integerToCurrency } from '@actual-app/core/shared/util';

// Positive amounts get an explicit plus so every amount carries a sign
export function formatSignedAmount(amount: number) {
  return (amount > 0 ? '+' : '') + integerToCurrency(amount);
}
