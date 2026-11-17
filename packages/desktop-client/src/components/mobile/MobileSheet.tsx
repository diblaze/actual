import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Input } from '@actual-app/components/input';
import { styles } from '@actual-app/components/styles';
import type { CSSProperties } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { spacing } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';

import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import type { Modal as ModalType } from '#modals/modalsSlice';

const SHEET_MAX_HEIGHT =
  'min(660px, calc(var(--visual-viewport-height) * 0.9))'; // ds-allow-hardcode: upstream cap

// Same size as ModalTitle, so renaming does not resize the header
const titleInputStyle: CSSProperties = {
  fontSize: 25, // ds-allow-hardcode: matches ModalTitle
  fontWeight: 700,
  textAlign: 'center',
  width: '100%',
};

type MobileSheetChildArgs = {
  close: () => void;
  editTitle: () => void;
  isEditingTitle: boolean;
};

type MobileSheetProps = {
  name: ModalType['name'];
  title: string;
  onTitleUpdate?: (newTitle: string) => string | undefined;
  isLoading?: boolean;
  onClose?: () => void;
  children: ReactNode | ((args: MobileSheetChildArgs) => ReactNode);
};

export function MobileSheet({
  name,
  title,
  onTitleUpdate,
  isLoading,
  onClose,
  children,
}: MobileSheetProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const ignoreBlurRef = useRef(false);

  const editTitle = () => {
    ignoreBlurRef.current = false;
    setTitleError(null);
    setIsEditingTitle(true);
  };

  const stopEditing = () => {
    ignoreBlurRef.current = true;
    setTitleError(null);
    setIsEditingTitle(false);
  };

  const commitTitle = (newTitle: string, isBlur: boolean) => {
    if (ignoreBlurRef.current) {
      return;
    }
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === title) {
      stopEditing();
      return;
    }
    const error = onTitleUpdate?.(trimmed);
    if (error && !isBlur) {
      setTitleError(error);
      return;
    }
    stopEditing();
  };

  const onTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      stopEditing();
    }
  };

  const renderChildren = (close: () => void) =>
    typeof children === 'function'
      ? children({ close, editTitle, isEditingTitle })
      : children;

  // Both widths share our header: title (an input while renaming) + Close
  const renderHeader = (close: () => void) => (
    <ModalHeader
      title={
        isEditingTitle ? (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <Input
              aria-label={t('Name')}
              defaultValue={title}
              autoFocus
              onEnter={value => commitTitle(value, false)}
              onBlur={event => commitTitle(event.currentTarget.value, true)}
              onKeyDown={onTitleKeyDown}
              style={titleInputStyle}
            />
            {titleError && (
              <Text
                style={{
                  ...styles.verySmallText,
                  color: theme.errorText,
                  textAlign: 'center',
                  marginTop: spacing.xs,
                }}
              >
                {titleError}
              </Text>
            )}
          </View>
        ) : (
          <ModalTitle title={title} shrinkOnOverflow />
        )
      }
      rightContent={<ModalCloseButton onPress={close} />}
    />
  );

  if (!isNarrowWidth) {
    return (
      <Modal name={name} isLoading={isLoading} onClose={onClose}>
        {({ state }) => (
          <>
            {renderHeader(() => state.close())}
            {renderChildren(() => state.close())}
          </>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      name={name}
      isLoading={isLoading}
      onClose={onClose}
      containerProps={{
        style: {
          padding: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
          maxHeight: SHEET_MAX_HEIGHT,
        },
      }}
    >
      {({ state }) => (
        <>
          <View
            style={{
              padding: '0 10px', // ds-allow-hardcode: plain Modal's inset
              flexShrink: 0,
            }}
          >
            {renderHeader(() => state.close())}
          </View>
          <View style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {renderChildren(() => state.close())}
          </View>
        </>
      )}
    </Modal>
  );
}
