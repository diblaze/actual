import React from 'react';
import { MemoryRouter, useLocation } from 'react-router';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { Modals } from '#components/Modals';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';

import { MobileNavTabs } from './MobileNavTabs';

const MORE_ENTRIES = ['Schedules', 'Settings', 'Switch budget file', 'Help'];

function CurrentPath() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderNav(path: string) {
  const store = configureTestAppStore({ queryClient: createTestQueryClient() });
  render(
    <TestProviders store={store}>
      <MemoryRouter initialEntries={[path]}>
        <MobileNavTabs />
        <Modals />
        <CurrentPath />
      </MemoryRouter>
    </TestProviders>,
  );
  return screen.getByRole('navigation', { name: 'Main' });
}

function navItems(nav: HTMLElement) {
  return [
    ...within(nav).getAllByRole('link'),
    ...within(nav).getAllByRole('button'),
  ];
}

describe('MobileNavTabs', () => {
  beforeEach(() => {
    window.innerWidth = 390;
  });

  it('five tabs', () => {
    const nav = renderNav('/budget');
    const items = navItems(nav);

    expect(items.map(item => item.textContent)).toEqual([
      'Budget',
      'Transactions',
      'Accounts',
      'Reports',
      'More',
    ]);
    expect(
      within(nav).getByRole('link', { name: 'Transactions' }),
    ).toHaveAttribute('href', '/accounts/all');
    for (const item of items) {
      expect(item.querySelector('svg')).not.toBeNull();
    }
  });

  it('aria-current', () => {
    for (const [path, tab] of [
      ['/reports', 'Reports'],
      ['/accounts/all', 'Transactions'],
      ['/accounts/some-account', 'Accounts'],
      ['/schedules', 'More'],
      ['/settings/payees', 'More'],
    ]) {
      const nav = renderNav(path);
      const current = navItems(nav).filter(
        item => item.getAttribute('aria-current') === 'page',
      );

      expect(current.map(item => item.textContent)).toEqual([tab]);
      const pills = nav.querySelectorAll(
        '[style*="--color-accentSubtleBackground"]',
      );
      expect(pills).toHaveLength(1);
      expect(current[0]).toBe(pills[0]);
      cleanup();
    }
  });

  it('more sheet', async () => {
    const nav = renderNav('/budget');
    fireEvent.click(within(nav).getByRole('button', { name: 'More' }));

    const sheet = await screen.findByRole('dialog', { name: 'More' });
    const rows = within(sheet)
      .getAllByRole('button')
      .filter(button => button.getAttribute('aria-label') !== 'Close');
    expect(rows.map(row => row.textContent)).toEqual(MORE_ENTRIES);

    fireEvent.click(within(sheet).getByText('Settings'));

    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/settings'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(within(nav).getByRole('button', { name: 'More' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('safe area', () => {
    const nav = renderNav('/budget');

    expect(nav.style.paddingBottom).toContain('env(safe-area-inset-bottom)');
  });

  it('add button', async () => {
    for (const [path, shown] of [
      ['/accounts/all', true],
      ['/accounts', false],
      ['/reports', false],
    ] as const) {
      renderNav(path);
      expect(
        screen.queryAllByRole('button', { name: 'Add transaction' }),
      ).toHaveLength(shown ? 1 : 0);
      cleanup();
    }

    const nav = renderNav('/budget');
    const add = screen.getByRole('button', { name: 'Add transaction' });

    expect(add).toHaveTextContent('Add');
    expect(nav).not.toContainElement(add);
    fireEvent.click(add);

    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/transactions/new'),
    );
  });
});
