import type * as Platform from '@actual-app/core/shared/platform';

import { primeIOSKeyboard, takePrimedIOSKeyboard } from './iosKeyboard';

vi.mock('@actual-app/core/shared/platform', async importOriginal => ({
  ...(await importOriginal<typeof Platform>()),
  isIOS: true,
}));

test('primes once', () => {
  primeIOSKeyboard();

  // A hidden decimal field holds focus within the tap
  const proxy = document.activeElement as HTMLInputElement;
  expect(proxy.tagName).toBe('INPUT');
  expect(proxy.inputMode).toBe('decimal');
  expect(proxy.getAttribute('aria-hidden')).toBe('true');
  // The editor sheet's modal hides (inerts) the page behind it, which
  // would blur the proxy and close the keyboard; top-layer nodes are kept
  expect(proxy.hasAttribute('data-react-aria-top-layer')).toBe(true);

  // The amount field consumes the primed state exactly once
  expect(takePrimedIOSKeyboard()).toBe(true);
  expect(takePrimedIOSKeyboard()).toBe(false);

  proxy.blur();
  expect(document.body.contains(proxy)).toBe(false);
});
