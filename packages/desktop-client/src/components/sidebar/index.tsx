import React from 'react';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { theme } from '@actual-app/components/theme';
import { radius, spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import { useDebounceCallback } from 'usehooks-ts';

import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useGlobalPref } from '#hooks/useGlobalPref';

import { SidebarRedesign } from './redesign/SidebarRedesign';
import { Sidebar } from './Sidebar';
import { useSidebar } from './SidebarProvider';

export function FloatableSidebar() {
  const [floatingSidebar] = useGlobalPref('floatingSidebar');
  const newSidebarUIEnabled = useFeatureFlag('newSidebarUI');

  const sidebar = useSidebar();
  const { isNarrowWidth } = useResponsive();

  const debouncedHideSidebar = useDebounceCallback(
    () => sidebar.setHidden(true),
    350,
  );

  return isNarrowWidth ? null : (
    <View
      onMouseOver={
        floatingSidebar
          ? e => {
              debouncedHideSidebar.cancel();
              e.stopPropagation();
              sidebar.setHidden(false);
            }
          : undefined
      }
      onMouseLeave={floatingSidebar ? () => debouncedHideSidebar() : undefined}
      data-testid="sidebar-card"
      style={{
        // Docked, either sidebar is a card inset on the page background
        position: floatingSidebar ? 'absolute' : undefined,
        top: 8,
        bottom: 8,
        margin: floatingSidebar
          ? 0
          : `${spacing.md}px 0 ${spacing.md}px ${spacing.md}px`,
        zIndex: 1001,
        borderRadius: floatingSidebar
          ? `0 ${radius.card}px ${radius.card}px 0`
          : radius.card,
        overflow: 'hidden',
        boxShadow: !floatingSidebar
          ? theme.cardElevation
          : sidebar.hidden
            ? 'none'
            : theme.floatingElevation,
        transform: `translateX(${
          floatingSidebar && sidebar.hidden ? '-100' : '0'
        }%)`,
        transition: 'transform .5s, box-shadow .5s, border-radius .5s',
      }}
    >
      {newSidebarUIEnabled ? <SidebarRedesign /> : <Sidebar />}
    </View>
  );
}
