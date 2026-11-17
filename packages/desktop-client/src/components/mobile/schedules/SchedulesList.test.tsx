import React from 'react';

import type { ScheduleEntity } from '@actual-app/core/types/models';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TestProviders } from '#mocks';

import { SchedulesList } from './SchedulesList';

vi.mock('@use-gesture/react', () => ({
  useDrag: vi.fn().mockReturnValue(() => ({})),
}));

const rent = {
  id: 'rent',
  name: 'Rent',
  next_date: '2016-12-29',
  completed: false,
} as ScheduleEntity;

describe('SchedulesList', () => {
  it('overdue card calls skip and mark paid', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    const onMarkPaid = vi.fn();

    render(
      <TestProviders>
        <SchedulesList
          schedules={[rent]}
          isLoading={false}
          statuses={new Map([['rent', 'missed']])}
          onSchedulePress={vi.fn()}
          onScheduleDelete={vi.fn()}
          onScheduleMarkPaid={onMarkPaid}
          onScheduleSkip={onSkip}
        />
      </TestProviders>,
    );

    const card = screen.getByRole('region', { name: 'Overdue' });
    await user.click(within(card).getByRole('button', { name: 'Skip' }));
    await user.click(
      within(card).getByRole('button', { name: 'Mark as paid' }),
    );

    expect(onSkip).toHaveBeenCalledWith(rent);
    expect(onMarkPaid).toHaveBeenCalledWith(rent);
  });

  it('overdue name opens the schedule and pending rows are disabled', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();

    render(
      <TestProviders>
        <SchedulesList
          schedules={[rent]}
          isLoading={false}
          statuses={new Map([['rent', 'missed']])}
          onSchedulePress={onPress}
          onScheduleDelete={vi.fn()}
          onScheduleMarkPaid={vi.fn()}
          onScheduleSkip={vi.fn()}
          pendingScheduleIds={new Set(['rent'])}
        />
      </TestProviders>,
    );

    const card = screen.getByRole('region', { name: 'Overdue' });
    await user.click(within(card).getByRole('button', { name: /^Rent/ }));

    expect(onPress).toHaveBeenCalledWith(rent);
    expect(within(card).getByRole('button', { name: 'Skip' })).toBeDisabled();
    expect(
      within(card).getByRole('button', { name: 'Mark as paid' }),
    ).toBeDisabled();
  });
});
