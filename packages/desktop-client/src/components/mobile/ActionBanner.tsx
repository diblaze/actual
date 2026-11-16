import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { radius, spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';

import { useNavigate } from '#hooks/useNavigate';
import { useTransactions } from '#hooks/useTransactions';
import { uncategorizedTransactions } from '#queries';

type ActionBannerProps = {
  count: number;
  label: string;
  // The count and label as one translated phrase, read instead of the
  // badge and label
  'aria-label': string;
  actionLabel: string;
  onAction: () => void;
  // Badge colours: overspending is negative, uncategorized a warning
  tone: 'negative' | 'warning';
  style?: CSSProperties;
};

// A card with a count badge, what it counts, and one soft action button
export function ActionBanner({
  count,
  label,
  'aria-label': ariaLabel,
  actionLabel,
  onAction,
  tone,
  style,
}: ActionBannerProps) {
  return (
    <View
      role="group"
      aria-label={ariaLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: `${spacing.sm}px ${spacing.sm}px ${spacing.sm}px ${spacing.lg}px`,
        borderRadius: radius.card,
        backgroundColor: theme.cardBackground,
        boxShadow: theme.cardElevation,
        ...style,
      }}
    >
      <Text
        aria-hidden
        style={{
          ...styles.tnum,
          minWidth: 26,
          height: 26,
          paddingInline: 7,
          boxSizing: 'border-box',
          borderRadius: radius.pill,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          ...(tone === 'warning'
            ? {
                backgroundColor: theme.balanceWarningBackground,
                color: theme.balanceWarningText,
              }
            : {
                backgroundColor: theme.balanceNegativeBackground,
                color: theme.balanceNegativeText,
              }),
        }}
      >
        {count}
      </Text>
      <Text aria-hidden style={{ flex: 1, fontSize: 16, fontWeight: 500 }}>
        {label}
      </Text>
      <Button
        variant="bare"
        onPress={onAction}
        style={{
          flexShrink: 0,
          height: 44,
          paddingInline: spacing.lg,
          borderRadius: radius.pill,
          backgroundColor: theme.accentSubtleBackground,
          color: theme.accentSubtleText,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {actionLabel}
      </Button>
    </View>
  );
}

// The count of uncategorized transactions; Show opens the list. On the
// budget and on the all-accounts transactions list.
export function UncategorizedBanner({ style }: { style?: CSSProperties }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const transactionsQuery = useMemo(
    () => uncategorizedTransactions().select('*'),
    [],
  );

  const { transactions, isPending } = useTransactions({
    query: transactionsQuery,
    options: { pageSize: 1000 },
  });

  if (isPending || transactions.length === 0) {
    return null;
  }

  const count = transactions.length;
  return (
    <ActionBanner
      tone="warning"
      count={count}
      label={t('Uncategorized')}
      aria-label={t('{{count}} Uncategorized', { count })}
      actionLabel={t('Show')}
      onAction={() => navigate('/categories/uncategorized')}
      style={style}
    />
  );
}
