import { renderHook } from '@testing-library/react';

import { useResponsive } from './useResponsive';

function renderAtWidth(width: number) {
  window.innerWidth = width;
  return renderHook(() => useResponsive()).result.current;
}

describe('useResponsive', () => {
  describe('narrow below medium', () => {
    it('uses the phone layout at 600px wide', () => {
      expect(renderAtWidth(600).isNarrowWidth).toBe(true);
    });

    it('leaves the phone layout at 730px wide', () => {
      expect(renderAtWidth(730).isNarrowWidth).toBe(false);
    });

    it('uses the desktop layout at 1100px wide', () => {
      const atWide = renderAtWidth(1100);
      expect(atWide.isNarrowWidth).toBe(false);
      expect(atWide.isWideWidth).toBe(true);
    });
  });
});
