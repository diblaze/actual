import React, { createContext, useContext, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties as StyleObject } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';

const HEADER_HEIGHT = 50;
const HEADER_BUTTON_SIZE = 44;

type PageHeaderProps = {
  title: ReactNode;
  style?: CSSProperties;
};

export const pageTitleStyle = {
  fontSize: 25,
  fontWeight: 500,
} satisfies CSSProperties;

export function PageHeader({ title, style }: PageHeaderProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        marginLeft: 20,
        ...style,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          ...pageTitleStyle,
        }}
      >
        {typeof title === 'string' ? <Text>{title}</Text> : title}
      </View>
    </View>
  );
}

type MobilePageHeaderProps = {
  title: ReactNode;
  style?: CSSProperties;
  leftContent?: ReactNode;
  rightContent?: ReactNode;
};

// Header actions sit in round glass groups above a large left-aligned title.
// Callers pass plain bare buttons (some with the old bar's inline margin), so
// the group styles every button it holds.
const headerButtonGroup: StyleObject = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  '& button': {
    minWidth: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
    padding: `0 ${spacing.md}px`,
    margin: '0 !important',
    borderRadius: HEADER_BUTTON_SIZE / 2,
    color: theme.pageText,
    backgroundColor: theme.glassBackground,
    border: `1px solid ${theme.glassBorder}`,
    backdropFilter: 'blur(24px)', // ds-allow-hardcode: glass blur
  },
  '& button[data-focus-visible]': {
    outline: `2px solid ${theme.pageText}`,
    outlineOffset: 2,
  },
};

export function MobilePageHeader({
  title,
  style,
  leftContent,
  rightContent,
}: MobilePageHeaderProps) {
  return (
    <View
      style={{
        flexShrink: 0,
        gap: 6,
        padding: `${spacing.sm}px ${spacing.lg}px 10px`, // ds-allow-hardcode: 901d6cb
        // Extend under the status bar / notch (non-zero only in the native
        // mobile app, where the web view covers the whole screen).
        paddingTop: `calc(${spacing.sm}px + env(safe-area-inset-top))`,
        color: theme.pageText,
        ...style,
      }}
    >
      {(leftContent || rightContent) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: HEADER_BUTTON_SIZE,
          }}
        >
          <View style={headerButtonGroup}>{leftContent}</View>
          <View style={headerButtonGroup}>{rightContent}</View>
        </View>
      )}
      <h1
        style={{
          display: 'flex',
          alignItems: 'center',
          margin: 0,
          padding: 0,
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: -0.5,
          lineHeight: '41px', // ds-allow-hardcode: 34px large title
          overflowWrap: 'anywhere',
        }}
      >
        {title}
      </h1>
    </View>
  );
}

// On mobile the page header element stays mounted while navigating between
// pages so its background doesn't flash while the next page renders. Pages
// render their header into a single persistent `<MobilePageHeaderSlot />`
// (rendered by the app shell) through a portal. Without a provider (e.g. in
// tests or storybook) the header is rendered inline instead.
const MobilePageHeaderSlotContext = createContext<HTMLElement | null>(null);
const MobilePageHeaderSlotRefContext = createContext<
  ((element: HTMLElement | null) => void) | null
>(null);

export function MobilePageHeaderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <MobilePageHeaderSlotRefContext.Provider value={setSlot}>
      <MobilePageHeaderSlotContext.Provider value={slot}>
        {children}
      </MobilePageHeaderSlotContext.Provider>
    </MobilePageHeaderSlotRefContext.Provider>
  );
}

type MobilePageHeaderSlotProps = {
  style?: CSSProperties;
};

export function MobilePageHeaderSlot({ style }: MobilePageHeaderSlotProps) {
  const slotRef = useContext(MobilePageHeaderSlotRefContext);
  return (
    <View
      ref={slotRef ?? undefined}
      style={{
        flexShrink: 0,
        minHeight: `calc(${HEADER_HEIGHT}px + env(safe-area-inset-top))`,
        ...style,
      }}
    />
  );
}

type PageProps = {
  header: ReactNode;
  style?: CSSProperties;
  padding?: number;
  children: ReactNode;
  footer?: ReactNode;
};

export function Page({ header, style, padding, children, footer }: PageProps) {
  // Tablets (below 1100px) use the phone page chrome too
  const { isWideWidth } = useResponsive();
  const mobileHeaderSlot = useContext(MobilePageHeaderSlotContext);
  const childrenPadding = padding != null ? padding : !isWideWidth ? 10 : 20;

  const headerToRender =
    typeof header === 'string' ? (
      !isWideWidth ? (
        <MobilePageHeader title={header} />
      ) : (
        <PageHeader title={header} />
      )
    ) : (
      header
    );

  const main = (
    <View
      role="main"
      style={{
        flex: 1,
        overflowY: !isWideWidth ? 'auto' : undefined,
        padding: `0 ${childrenPadding}px`,
      }}
    >
      {children}
    </View>
  );

  if (!isWideWidth) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.pageBackground,
          ...style,
        }}
      >
        {mobileHeaderSlot
          ? createPortal(headerToRender, mobileHeaderSlot)
          : headerToRender}
        {main}
        {footer}
      </View>
    );
  }

  return (
    <View
      style={{
        ...styles.page,
        flex: 1,
        backgroundColor: theme.pageBackground,
        ...style,
      }}
    >
      {headerToRender}
      {main}
      {footer}
    </View>
  );
}
