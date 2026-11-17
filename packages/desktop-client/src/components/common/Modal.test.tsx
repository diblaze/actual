import React from 'react';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MobileSheet } from '#components/mobile/MobileSheet';
import { TestProviders } from '#mocks';

import { Modal, ModalHeader } from './Modal';

describe('Modal', () => {
  it('named by title', async () => {
    render(
      <TestProviders>
        <Modal name="category-menu">
          <ModalHeader title="Entertainment" />
        </Modal>
      </TestProviders>,
    );

    expect(
      await screen.findByRole('dialog', { name: 'Entertainment' }),
    ).toBeInTheDocument();
  });

  it('falls back to a generic name without a title', async () => {
    render(
      <TestProviders>
        <Modal name="category-menu">
          <ModalHeader showLogo />
        </Modal>
      </TestProviders>,
    );

    expect(
      await screen.findByRole('dialog', { name: 'Modal dialog' }),
    ).toBeInTheDocument();
  });

  it('sheet header has handle and close', async () => {
    window.innerWidth = 390;
    const onClose = vi.fn();
    render(
      <TestProviders>
        <MobileSheet name="category-menu" title="Food" onClose={onClose}>
          <span>Sheet body</span>
        </MobileSheet>
      </TestProviders>,
    );

    const sheet = await screen.findByRole('dialog', { name: 'Food' });
    const handle = within(sheet).getByTestId('sheet-handle');
    const header = within(sheet).getByRole('heading');
    expect(header).toHaveTextContent('Food');
    const close = within(header).getByRole('button', { name: 'Close' });
    // The handle sits above the header
    expect(
      handle.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await userEvent.click(close);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});
