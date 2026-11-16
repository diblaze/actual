import React from 'react';
import { Dialog, Modal, ModalOverlay } from 'react-aria-components';

import type * as Platform from '@actual-app/core/shared/platform';
import { render, screen } from '@testing-library/react';

import { TestProviders } from '#mocks';

import { AmountInput } from './AmountInput';
import { primeIOSKeyboard, takePrimedIOSKeyboard } from './iosKeyboard';

vi.mock('@actual-app/core/shared/platform', async importOriginal => ({
  ...(await importOriginal<typeof Platform>()),
  isIOS: true,
  isIOSAgent: true,
}));

vi.mock('#hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
}));

// The editor sheet: the tap primed the keyboard, then the sheet mounts the
// amount field inside a react-aria Dialog. The Dialog focuses itself on
// mount unless focus is already inside, so the field must win.
test('amount takes focus inside dialog', () => {
  primeIOSKeyboard();

  render(
    <TestProviders>
      <ModalOverlay isOpen>
        <Modal>
          <Dialog aria-label="New Transaction">
            <AmountInput
              value={0}
              autoFocus
              disableNativeAutoFocusOnIOS
              onChange={vi.fn()}
            />
          </Dialog>
        </Modal>
      </ModalOverlay>
    </TestProviders>,
  );

  expect(document.activeElement).toBe(screen.getByTestId('amount-input'));
  // Consumed by the field, not left for the next one
  expect(takePrimedIOSKeyboard()).toBe(false);
});
