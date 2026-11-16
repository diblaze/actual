import React from 'react';

import { render, screen } from '@testing-library/react';

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
});
