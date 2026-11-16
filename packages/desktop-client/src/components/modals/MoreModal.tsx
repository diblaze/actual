import React from 'react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCog,
  SvgFolder,
  SvgRefresh,
  SvgStoreFront,
  SvgTag,
  SvgTuning,
} from '@actual-app/components/icons/v1';
import { SvgCalendar3, SvgHelp } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { closeBudget } from '#budgetfiles/budgetfilesSlice';
import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { useIsTestEnv } from '#hooks/useIsTestEnv';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';
import { useDispatch } from '#redux';

// Routes reachable from the More sheet; the More tab is marked current on them.
export const MORE_PATHS = [
  '/schedules',
  '/payees',
  '/rules',
  '/tags',
  '/bank-sync',
  '/settings',
];

type IconType = ComponentType<{
  width: number;
  height: number;
  style?: object;
}>;

export function MoreModal() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [budgetName] = useMetadataPref('budgetName');
  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const isUsingServer = syncServerStatus !== 'no-server' || isTestEnv;

  const tiles: { name: string; path: string; Icon: IconType }[] = [
    { name: t('Schedules'), path: '/schedules', Icon: SvgCalendar3 },
    { name: t('Payees'), path: '/payees', Icon: SvgStoreFront },
    { name: t('Rules'), path: '/rules', Icon: SvgTuning },
    { name: t('Tags'), path: '/tags', Icon: SvgTag },
    ...(isUsingServer
      ? [{ name: t('Bank sync'), path: '/bank-sync', Icon: SvgRefresh }]
      : []),
  ];

  return (
    <Modal name="more">
      {({ state }) => (
        <>
          <ModalHeader
            title={t('More')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8,
              paddingBottom: 12,
            }}
          >
            {tiles.map(({ name, path, Icon }) => (
              <Button
                key={path}
                variant="bare"
                onPress={() => navigate(path)}
                style={{
                  ...styles.noTapHighlight,
                  minHeight: 84,
                  minWidth: 0,
                  paddingBlock: 10,
                  paddingInline: 4,
                  borderRadius: 12,
                  flexDirection: 'column',
                  gap: 8,
                  color: theme.pageText,
                  backgroundColor: theme.pillBackground,
                }}
              >
                <Icon
                  width={22}
                  height={22}
                  style={{ color: theme.pageTextPositive, flexShrink: 0 }}
                />
                {/* Long translations (sv "Betalningsmottagare") wrap onto a
                    second line instead of running out of the tile */}
                <span
                  lang={i18n.language}
                  style={{
                    maxWidth: '100%',
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    textAlign: 'center',
                    overflowWrap: 'anywhere',
                    hyphens: 'auto',
                  }}
                >
                  {name}
                </span>
              </Button>
            ))}
          </View>
          <View style={{ borderTop: `1px solid ${theme.tableBorder}` }}>
            <MoreRow
              name={t('Settings')}
              Icon={SvgCog}
              onPress={() => navigate('/settings')}
            />
            <MoreRow
              name={t('Switch budget file')}
              detail={budgetName}
              Icon={SvgFolder}
              onPress={() => {
                state.close();
                void dispatch(closeBudget());
              }}
            />
            <MoreRow
              name={t('Help')}
              Icon={SvgHelp}
              onPress={() => {
                state.close();
                window.Actual.openURLInBrowser('https://actualbudget.org/docs');
              }}
            />
          </View>
        </>
      )}
    </Modal>
  );
}

type MoreRowProps = {
  name: string;
  detail?: string;
  Icon: IconType;
  onPress: () => void;
};

function MoreRow({ name, detail, Icon, onPress }: MoreRowProps) {
  return (
    <Button
      variant="bare"
      onPress={onPress}
      style={{
        ...styles.noTapHighlight,
        minHeight: 56,
        justifyContent: 'flex-start',
        gap: 14,
        paddingBlock: 0,
        paddingInline: 10,
        fontSize: 16,
        color: theme.pageText,
        borderRadius: 0,
      }}
    >
      <Icon width={20} height={20} style={{ color: theme.pageTextSubdued }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          overflowWrap: 'anywhere',
        }}
      >
        {name}
      </span>
      {detail && (
        <span style={{ fontSize: 14, color: theme.pageTextSubdued }}>
          {detail}
        </span>
      )}
    </Button>
  );
}
