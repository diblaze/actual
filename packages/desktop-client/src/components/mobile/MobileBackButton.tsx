import React from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCheveronLeft } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';

import { useNavigate } from '#hooks/useNavigate';

type MobileBackButtonProps = ComponentPropsWithoutRef<typeof Button>;

// Round glass button, like the other phone header actions
export function MobileBackButton({
  onPress,
  style,
  ...props
}: MobileBackButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Button
      variant="bare"
      aria-label={t('Back')}
      style={{
        width: 44,
        height: 44,
        padding: 0,
        borderRadius: 22,
        color: theme.pageText,
        backgroundColor: theme.glassBackground,
        border: `1px solid ${theme.glassBorder}`,
        ...style,
      }}
      onPress={onPress || (() => navigate(-1))}
      {...props}
    >
      <SvgCheveronLeft width={24} height={24} />
    </Button>
  );
}
