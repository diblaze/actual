import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';

import { ItemHeader } from '#components/autocomplete/ItemHeader';
import {
  CreatePayeeButton,
  PayeeAutocomplete,
  PayeeItem,
} from '#components/autocomplete/PayeeAutocomplete';
import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { useAccounts } from '#hooks/useAccounts';
import { useNavigate } from '#hooks/useNavigate';
import { usePayees } from '#hooks/usePayees';
import type { Modal as ModalType } from '#modals/modalsSlice';

const rowStyle = { height: 44, minHeight: 44 };

type PayeeAutocompleteModalProps = Extract<
  ModalType,
  { name: 'payee-autocomplete' }
>['options'];

export function PayeeAutocompleteModal({
  onSelect,
  showNoneOption,
  transferOnly = false,
  onClose,
}: PayeeAutocompleteModalProps) {
  const { t } = useTranslation();
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();
  const navigate = useNavigate();

  const { isNarrowWidth } = useResponsive();
  const defaultAutocompleteProps = {
    containerProps: { style: { height: isNarrowWidth ? '90vh' : 275 } },
  };

  const onManagePayees = () => navigate('/payees');

  return (
    <Modal
      name="payee-autocomplete"
      noAnimation={!isNarrowWidth}
      fullScreenOnNarrow
      onClose={onClose}
      containerProps={{
        style: {
          height: 275,
          backgroundColor: theme.menuAutoCompleteBackground,
        },
      }}
    >
      {({ state }) => (
        <>
          {isNarrowWidth && (
            <ModalHeader
              title={
                <ModalTitle
                  title={t('Payee')}
                  getStyle={() => ({ color: theme.menuAutoCompleteText })}
                />
              }
              rightContent={
                <ModalCloseButton
                  onPress={() => state.close()}
                  style={{ color: theme.menuAutoCompleteText }}
                />
              }
            />
          )}
          <View>
            <View style={{ flex: 1 }}>
              <PayeeAutocomplete
                payees={payees}
                accounts={accounts}
                focused
                embedded
                closeOnBlur={false}
                onClose={() => state.close()}
                onManagePayees={onManagePayees}
                showManagePayees={!isNarrowWidth}
                showMakeTransfer={!isNarrowWidth && !transferOnly}
                transferOnly={transferOnly}
                {...defaultAutocompleteProps}
                {...(isNarrowWidth && {
                  renderCreatePayeeButton: props => (
                    <CreatePayeeButton
                      {...props}
                      style={{
                        ...rowStyle,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    />
                  ),
                  renderPayeeItemGroupHeader: props => (
                    <ItemHeader
                      {...props}
                      type="payee"
                      role="heading"
                      aria-level={3}
                      style={{
                        ...styles.smallText,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        paddingTop: spacing.md,
                        paddingBottom: spacing.xs,
                      }}
                    />
                  ),
                  renderPayeeItem: props => (
                    <PayeeItem {...props} style={rowStyle} />
                  ),
                })}
                onSelect={onSelect}
                value={null}
              />
            </View>
            {showNoneOption && (
              <View style={{ flexShrink: 0, padding: 5 }}>
                <Button
                  variant="menu"
                  onPress={() => {
                    onSelect(null);
                    state.close();
                  }}
                >
                  <Trans>No payee</Trans>
                </Button>
              </View>
            )}
          </View>
        </>
      )}
    </Modal>
  );
}
