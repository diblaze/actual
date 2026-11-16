import { useRef } from 'react';
import {
  GridList,
  GridListItem,
  ListLayout,
  Virtualizer,
} from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { getNormalisedString } from '@actual-app/core/shared/normalisation';
import type { PayeeEntity } from '@actual-app/core/types/models';

import { GROUP_CARD_STYLE } from '#components/mobile/budget/BudgetTable';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';

import { PayeesListItem } from './PayeesListItem';

const ROW_HEIGHT = 56;
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

type HeaderEntry = { id: string; letter: string };
type PayeesListEntry = PayeeEntity | HeaderEntry;

function letterOf(name: string) {
  const first = getNormalisedString(name).trim()[0]?.toUpperCase() ?? '';
  return LETTERS.includes(first) ? first : '#';
}

// Payees whose names are equal ignoring case and surrounding whitespace
function findDuplicates(payees: PayeeEntity[]): PayeeEntity[] {
  const groups = new Map<string, PayeeEntity[]>();
  for (const payee of payees) {
    if (payee.transfer_acct) continue;
    const key = payee.name.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), payee]);
  }
  return [...groups.values()].find(group => group.length > 1) ?? [];
}

type PayeesListProps = {
  payees: PayeeEntity[];
  ruleCounts: Map<string, number>;
  isRuleCountsLoading?: boolean;
  isLoading?: boolean;
  onPayeePress: (payee: PayeeEntity) => void;
  onPayeeDelete: (payee: PayeeEntity) => void;
  onPayeeRuleAction: (payee: PayeeEntity) => void;
  onMergePayees: (payees: PayeeEntity[]) => void;
};

export function PayeesList({
  payees,
  ruleCounts,
  isRuleCountsLoading = false,
  isLoading = false,
  onPayeePress,
  onPayeeDelete,
  onPayeeRuleAction,
  onMergePayees,
}: PayeesListProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);

  const entries: PayeesListEntry[] = [];
  const firstIndexByLetter = new Map<string, number>();
  for (const payee of payees) {
    const letter = letterOf(payee.name);
    if (!firstIndexByLetter.has(letter)) {
      firstIndexByLetter.set(letter, entries.length);
      entries.push({ id: `header-${letter}`, letter });
    }
    entries.push(payee);
  }
  const duplicates = findDuplicates(payees);

  if (isLoading && payees.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 100,
        }}
      >
        <AnimatedLoading style={{ width: 25, height: 25 }} />
      </View>
    );
  }

  if (payees.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            color: theme.pageTextSubdued,
            textAlign: 'center',
          }}
        >
          <Trans>No payees found.</Trans>
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {duplicates.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: '8px 16px',
            backgroundColor: theme.noticeBackground,
            color: theme.noticeTextDark,
          }}
        >
          <Text style={{ flex: 1, color: theme.noticeTextDark }}>
            <Trans>
              Possible duplicate:{' '}
              {{ names: duplicates.map(p => p.name).join(', ') }}
            </Trans>
          </Text>
          <Button
            variant="primary"
            aria-label={t('Merge {{names}}', {
              names: duplicates.map(p => p.name.trim()).join(' and '),
            })}
            style={{ minHeight: styles.mobileMinHeight }}
            onPress={() => onMergePayees(duplicates)}
          >
            <Trans>Merge</Trans>
          </Button>
        </View>
      )}
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        <Virtualizer
          layout={ListLayout}
          layoutOptions={{ rowHeight: ROW_HEIGHT }}
        >
          <GridList
            ref={listRef}
            aria-label={t('Payees')}
            aria-busy={isLoading || undefined}
            items={entries}
            style={{
              ...GROUP_CARD_STYLE,
              flex: 1,
              marginTop: 12,
              marginBottom: MOBILE_NAV_HEIGHT,
              overflow: 'auto',
            }}
            dependencies={[ruleCounts, isRuleCountsLoading]}
          >
            {entry =>
              'letter' in entry ? (
                <GridListItem
                  id={entry.id}
                  textValue={entry.letter}
                  isDisabled
                  style={{
                    padding: '0 16px',
                    fontWeight: 600,
                    color: theme.pageTextSubdued,
                    backgroundColor: theme.tableHeaderBackground,
                  }}
                >
                  <div
                    style={{
                      height: ROW_HEIGHT,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {entry.letter}
                  </div>
                </GridListItem>
              ) : (
                <PayeesListItem
                  value={entry}
                  ruleCount={ruleCounts.get(entry.id) ?? 0}
                  isRuleCountLoading={isRuleCountsLoading}
                  onAction={() => onPayeePress(entry)}
                  onDelete={() => onPayeeDelete(entry)}
                  onViewRules={() => onPayeeRuleAction(entry)}
                />
              )
            }
          </GridList>
        </Virtualizer>
        <View
          role="navigation"
          aria-label={t('Letter index')}
          // Only letters that have payees, each a 44px target; scrolls
          // when they do not fit
          style={{
            width: 24,
            paddingBottom: MOBILE_NAV_HEIGHT,
            overflowY: 'auto',
          }}
        >
          {[...firstIndexByLetter.keys()].map(letter => (
            <Button
              key={letter}
              variant="bare"
              aria-label={letter}
              onPress={() =>
                listRef.current?.scrollTo({
                  top: (firstIndexByLetter.get(letter) ?? 0) * ROW_HEIGHT,
                })
              }
              style={{
                flexShrink: 0,
                padding: 0,
                fontSize: 11,
                minHeight: 44,
              }}
            >
              {letter}
            </Button>
          ))}
        </View>
      </View>
      {isLoading && (
        <View
          style={{
            alignItems: 'center',
            paddingTop: 20,
          }}
        >
          <AnimatedLoading style={{ width: 20, height: 20 }} />
        </View>
      )}
    </View>
  );
}
