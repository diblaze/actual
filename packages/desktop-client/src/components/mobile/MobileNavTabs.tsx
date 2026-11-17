import React from 'react';
import type { ComponentType, CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, matchPath, useLocation } from 'react-router';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgAdd,
  SvgDotsHorizontalTriple,
  SvgListBullet,
  SvgPiggyBank,
  SvgReports,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { spacing } from '@actual-app/components/tokens';
import { css } from '@emotion/css';

import { MORE_PATHS } from '#components/modals/MoreModal';
import { useAccount } from '#hooks/useAccount';
import { useNavigate } from '#hooks/useNavigate';
import { pushModal } from '#modals/modalsSlice';
import { useDispatch } from '#redux';

import { primeIOSKeyboard } from './transactions/iosKeyboard';

// The bar floats BAR_BOTTOM above the home indicator; Add floats above it.
const BAR_HEIGHT = 72;
const BAR_BOTTOM = 24;
const ADD_HEIGHT = 56;
const ADD_BOTTOM = BAR_BOTTOM + BAR_HEIGHT + 16;

// Bottom clearance for scrolling content: bar, Add and the safe area
export const MOBILE_NAV_HEIGHT = `calc(${ADD_BOTTOM + ADD_HEIGHT + 8}px + env(safe-area-inset-bottom))`;

const focusRing = css({
  outline: 'none',
  '&:focus-visible, &[data-focus-visible]': {
    outline: `2px solid ${theme.pageText}`,
    outlineOffset: 2,
  },
});

type IconType = ComponentType<{ width: number; height: number }>;

// The current destination and the Add action
function useNavState() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isUnder = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);
  const isTransactionsActive = pathname === '/accounts/all';

  // Add presets the viewed account; virtual lists (all, onbudget…) have none
  const accountMatch = matchPath('/accounts/:id', pathname);
  const account = useAccount(accountMatch?.params.id ?? '');

  return {
    pathname,
    isBudgetActive: isUnder('/budget'),
    isTransactionsActive,
    isAccountsActive: isUnder('/accounts') && !isTransactionsActive,
    isReportsActive: isUnder('/reports'),
    isMoreActive: MORE_PATHS.some(isUnder),
    hasAccount: !!accountMatch,
    onAdd: () => {
      primeIOSKeyboard();
      void navigate('/transactions/new', {
        state: { accountId: account?.id },
      });
    },
  };
}

export function MobileNavTabs() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const dispatch = useDispatch();
  const nav = useNavState();
  const showAdd =
    isNarrowWidth && (nav.pathname === '/budget' || nav.hasAccount);

  return (
    <>
      {showAdd && (
        <Button
          variant="bare"
          aria-label={t('Add transaction')}
          className={focusRing}
          onPress={nav.onAdd}
          style={{
            ...styles.noTapHighlight,
            position: 'fixed',
            right: 16,
            bottom: `calc(${ADD_BOTTOM}px + env(safe-area-inset-bottom))`,
            zIndex: 100,
            height: ADD_HEIGHT,
            padding: `0 ${spacing.xl}px`,
            gap: 10,
            borderRadius: ADD_HEIGHT / 2,
            fontSize: 18,
            fontWeight: 600,
            color: theme.buttonPrimaryText,
            backgroundColor: theme.buttonPrimaryBackground,
            boxShadow: theme.floatingElevation,
          }}
        >
          <SvgAdd width={18} height={18} />
          <Trans>Add</Trans>
        </Button>
      )}
      <nav
        aria-label={t('Main')}
        style={{
          display: isNarrowWidth ? 'block' : 'none',
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          paddingLeft: 12,
          paddingRight: 12,
          // calc() keeps env() in jsdom; a bare env() is dropped there.
          paddingBottom: `calc(${BAR_BOTTOM}px + env(safe-area-inset-bottom))`,
          // Only the bar takes taps; the inset around it is see-through
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            alignItems: 'center',
            boxSizing: 'border-box',
            height: BAR_HEIGHT,
            padding: '0 5px', // ds-allow-hardcode: 901d6cb bar inset
            borderRadius: BAR_HEIGHT / 2,
            backgroundColor: theme.glassBackground,
            border: `1px solid ${theme.glassBorder}`,
            boxShadow: theme.floatingElevation,
            backdropFilter: 'blur(24px)', // ds-allow-hardcode: glass blur
            WebkitBackdropFilter: 'blur(24px)', // ds-allow-hardcode: glass blur
          }}
        >
          <NavTab
            name={t('Budget')}
            path="/budget"
            Icon={SvgWallet}
            isActive={nav.isBudgetActive}
          />
          <NavTab
            name={t('Transactions')}
            path="/accounts/all"
            Icon={SvgListBullet}
            isActive={nav.isTransactionsActive}
          />
          <NavTab
            name={t('Accounts')}
            path="/accounts"
            Icon={SvgPiggyBank}
            isActive={nav.isAccountsActive}
          />
          <NavTab
            name={t('Reports')}
            path="/reports"
            Icon={SvgReports}
            isActive={nav.isReportsActive}
          />
          <Button
            variant="bare"
            aria-current={nav.isMoreActive ? 'page' : undefined}
            className={focusRing}
            onPress={() => dispatch(pushModal({ modal: { name: 'more' } }))}
            style={{ ...tabStyle(nav.isMoreActive), padding: 0 }}
          >
            <SvgDotsHorizontalTriple width={22} height={22} />
            <Trans>More</Trans>
          </Button>
        </div>
      </nav>
    </>
  );
}

function tabStyle(isActive: boolean): CSSProperties {
  return {
    ...styles.noTapHighlight,
    height: 60,
    minWidth: 0,
    borderRadius: 30,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    userSelect: 'none',
    color: isActive ? theme.accentSubtleText : theme.pageText,
    backgroundColor: isActive ? theme.accentSubtleBackground : undefined,
  };
}

function NavTab({
  name,
  path,
  Icon,
  isActive,
}: {
  name: string;
  path: string;
  Icon: IconType;
  isActive: boolean;
}) {
  return (
    <Link
      to={path}
      aria-current={isActive ? 'page' : undefined}
      className={focusRing}
      style={tabStyle(isActive)}
    >
      <Icon width={22} height={22} />
      {name}
    </Link>
  );
}
