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
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import {
  configureTestAppStore,
  createTestQueryClient,
  TestProviders,
} from '#mocks';

import { MobileNavTabs } from './MobileNavTabs';
import { primeIOSKeyboard } from './transactions/iosKeyboard';

vi.mock('#hooks/useSyncServerStatus', () => ({
  useSyncServerStatus: vi.fn(() => 'online'),
}));

vi.mock('./transactions/iosKeyboard', () => ({
  primeIOSKeyboard: vi.fn(),
}));

const MORE_ENTRIES = [
  'Schedules',
  'Payees',
  'Rules',
  'Tags',
  'Bank sync',
  'Settings',
  'Switch budget file',
  'Help',
];

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
  return screen.getByRole('navigation');
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
    vi.mocked(useSyncServerStatus).mockReturnValue('online');
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
    for (const entry of MORE_ENTRIES) {
      expect(within(sheet).getByText(entry)).toBeInTheDocument();
    }

    fireEvent.click(within(sheet).getByText('Payees'));

    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/payees'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(within(nav).getByRole('button', { name: 'More' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('no bank sync offline', async () => {
    vi.mocked(useSyncServerStatus).mockReturnValue('no-server');
    const nav = renderNav('/budget');
    fireEvent.click(within(nav).getByRole('button', { name: 'More' }));

    const sheet = await screen.findByRole('dialog', { name: 'More' });
    expect(within(sheet).getByText('Payees')).toBeInTheDocument();
    expect(within(sheet).queryByText('Bank sync')).not.toBeInTheDocument();
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

    expect(primeIOSKeyboard).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent('/transactions/new'),
    );
  });
});
