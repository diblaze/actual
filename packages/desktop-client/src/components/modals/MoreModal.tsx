import React from 'react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCog, SvgFolder } from '@actual-app/components/icons/v1';
import { SvgCalendar3, SvgHelp } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { closeBudget } from '#budgetfiles/budgetfilesSlice';
import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import { useMetadataPref } from '#hooks/useMetadataPref';
import { useNavigate } from '#hooks/useNavigate';
import { useDispatch } from '#redux';

// Routes reachable from the More sheet; the More tab is marked current on
// them. Payees, rules, tags and bank sync live under /settings.
export const MORE_PATHS = ['/schedules', '/settings'];

type IconType = ComponentType<{
  width: number;
  height: number;
  style?: object;
}>;

export function MoreModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [budgetName] = useMetadataPref('budgetName');

  return (
    <Modal name="more">
      {({ state }) => (
        <>
          <ModalHeader
            title={t('More')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View>
            <MoreRow
              name={t('Schedules')}
              Icon={SvgCalendar3}
              onPress={() => navigate('/schedules')}
            />
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
