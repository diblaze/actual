import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Paragraph } from '@actual-app/components/paragraph';
import { styles } from '@actual-app/components/styles';
import { View } from '@actual-app/components/view';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { Modal, ModalCloseButton, ModalHeader } from '#components/common/Modal';
import type { Modal as ModalType } from '#modals/modalsSlice';

type ConfirmMarkCreditCardModalProps = Extract<
  ModalType,
  { name: 'confirm-mark-credit-card' }
>['options'];

export function ConfirmMarkCreditCardModal({
  accountName,
  onConfirm,
}: ConfirmMarkCreditCardModalProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const narrowButtonStyle = isNarrowWidth
    ? { height: styles.mobileMinHeight }
    : {};

  return (
    <Modal name="confirm-mark-credit-card">
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Mark as credit card')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ lineHeight: 1.5, maxWidth: 500 }}>
            <Paragraph>
              <Trans>
                Actual adds a{' '}
                <strong>{{ accountName } as TransObjectLiteral}</strong> payment
                category to the Credit Card Payments group. When you pay with
                this card, the part a category can cover moves into it, so it
                holds what you owe on the card.
              </Trans>
            </Paragraph>
            <Paragraph>
              <Trans>
                Past months are recalculated as if this account had always been
                a credit card. Only mark accounts that are credit cards.
              </Trans>
            </Paragraph>
            <Paragraph>
              <Trans>
                This is permanent. The payment category follows the card's name
                and cannot be renamed, hidden or deleted.
              </Trans>
            </Paragraph>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              {/* Marking is permanent, so Enter must not confirm it */}
              <InitialFocus>
                <Button
                  style={{ marginRight: 10, ...narrowButtonStyle }}
                  onPress={() => state.close()}
                >
                  <Trans>Cancel</Trans>
                </Button>
              </InitialFocus>
              <Button
                variant="primary"
                style={narrowButtonStyle}
                onPress={() => {
                  onConfirm();
                  state.close();
                }}
              >
                <Trans>Mark as credit card</Trans>
              </Button>
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}
