import React from 'react';

import { render, screen } from '@testing-library/react';

import { TestProviders } from '#mocks';

import { SummaryNumber } from './SummaryNumber';

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: () => ({ isNarrowWidth: true }),
}));

describe('SummaryNumber', () => {
  it('fixed size narrow', () => {
    render(
      <TestProviders>
        <SummaryNumber value={1200} contentType="financial" loading={false} />
        <SummaryNumber
          value={123456700}
          contentType="financial"
          loading={false}
        />
      </TestProviders>,
    );

    const short = screen
      .getByText('12.00')
      .closest<HTMLElement>('[aria-hidden]')!;
    const long = screen
      .getByText('1,234,567.00')
      .closest<HTMLElement>('[aria-hidden]')!;
    expect(getComputedStyle(short).fontSize).toBe('28px');
    expect(getComputedStyle(long).fontSize).toBe('28px');
  });
});
