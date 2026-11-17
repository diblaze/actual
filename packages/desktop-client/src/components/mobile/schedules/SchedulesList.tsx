import { GridList, ListLayout, Virtualizer } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { AnimatedLoading } from '@actual-app/components/icons/AnimatedLoading';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { tapTarget } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import { format as monthUtilFormat } from '@actual-app/core/shared/months';
import type { ScheduleStatusType } from '@actual-app/core/shared/schedules';
import type { ScheduleEntity } from '@actual-app/core/types/models';

import { ActionableGridListItem } from '#components/mobile/ActionableGridListItem';
import { GROUP_CARD_STYLE } from '#components/mobile/budget/BudgetTable';
import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { useDateFormat } from '#hooks/useDateFormat';

import { SchedulesListItem } from './SchedulesListItem';

type CompletedSchedulesItem = { id: 'show-completed' };
type SchedulesListEntry = ScheduleEntity | CompletedSchedulesItem;

type SchedulesListProps = {
  schedules: readonly ScheduleEntity[];
  isLoading: boolean;
  statuses: Map<ScheduleEntity['id'], ScheduleStatusType>;
  onSchedulePress: (schedule: ScheduleEntity) => void;
  onScheduleDelete: (schedule: ScheduleEntity) => void;
  onScheduleMarkPaid: (schedule: ScheduleEntity) => void;
  onScheduleSkip: (schedule: ScheduleEntity) => void;
  // Overdue rows whose mark-paid or skip is still being sent
  pendingScheduleIds?: ReadonlySet<ScheduleEntity['id']>;
  hasCompletedSchedules?: boolean;
  showCompleted?: boolean;
  onShowCompleted?: () => void;
};

export function SchedulesList({
  schedules,
  isLoading,
  statuses,
  onSchedulePress,
  onScheduleDelete,
  onScheduleMarkPaid,
  onScheduleSkip,
  pendingScheduleIds,
  hasCompletedSchedules = false,
  showCompleted = false,
  onShowCompleted,
}: SchedulesListProps) {
  const { t } = useTranslation();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const overdue = schedules.filter(s => statuses.get(s.id) === 'missed');
  const rest = schedules.filter(s => statuses.get(s.id) !== 'missed');
  const shouldShowCompletedItem =
    hasCompletedSchedules && !showCompleted && onShowCompleted;
  const listItems: readonly SchedulesListEntry[] = shouldShowCompletedItem
    ? [...rest, { id: 'show-completed' }]
    : rest;
  const showCompletedLabel = t('Show completed schedules');

  if (isLoading && listItems.length === 0) {
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

  if (listItems.length === 0 && overdue.length === 0) {
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
            paddingLeft: 10,
            paddingRight: 10,
          }}
        >
          {t('No schedules found. Create your first schedule to get started!')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, overflow: 'auto' }}>
      {overdue.length > 0 && (
        <View
          role="region"
          aria-label={t('Overdue')}
          style={{
            ...GROUP_CARD_STYLE,
            marginTop: 12,
            padding: 12,
            gap: 12,
            backgroundColor: theme.errorBackground,
            color: theme.errorText,
          }}
        >
          <Text style={{ fontWeight: 600, color: theme.errorText }}>
            <Trans>Overdue</Trans>
          </Text>
          {overdue.map(schedule => (
            <View
              key={schedule.id}
              role="group"
              aria-label={schedule.name || t('Unnamed schedule')}
              style={{ gap: 8 }}
            >
              <Button
                variant="bare"
                style={{
                  justifyContent: 'flex-start',
                  minHeight: tapTarget,
                  fontWeight: 600,
                  color: theme.pageText,
                }}
                onPress={() => onSchedulePress(schedule)}
              >
                {schedule.name || t('Unnamed schedule')}
                {schedule.next_date &&
                  ` · ${monthUtilFormat(schedule.next_date, dateFormat)}`}
              </Button>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  variant="primary"
                  isDisabled={pendingScheduleIds?.has(schedule.id)}
                  style={{ flex: 1, minHeight: tapTarget }}
                  onPress={() => onScheduleMarkPaid(schedule)}
                >
                  <Trans>Mark as paid</Trans>
                </Button>
                <Button
                  isDisabled={pendingScheduleIds?.has(schedule.id)}
                  style={{ flex: 1, minHeight: tapTarget }}
                  onPress={() => onScheduleSkip(schedule)}
                >
                  <Trans>Skip</Trans>
                </Button>
              </View>
            </View>
          ))}
        </View>
      )}
      <Virtualizer
        layout={ListLayout}
        layoutOptions={{
          estimatedRowHeight: 140,
          padding: 0,
        }}
      >
        <GridList
          aria-label={t('Schedules')}
          aria-busy={isLoading || undefined}
          items={listItems}
          // With only overdue schedules the list is empty: no card, but it
          // keeps its height so it stays visible
          style={
            listItems.length > 0
              ? {
                  ...GROUP_CARD_STYLE,
                  marginTop: 12,
                  marginBottom: MOBILE_NAV_HEIGHT,
                }
              : { paddingBottom: MOBILE_NAV_HEIGHT }
          }
        >
          {item =>
            !('completed' in item) ? (
              <ActionableGridListItem
                id="show-completed"
                value={item}
                textValue={showCompletedLabel}
                onAction={onShowCompleted}
              >
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <Text
                    style={{
                      fontStyle: 'italic',
                      color: theme.pageTextSubdued,
                    }}
                  >
                    <Trans>Show completed schedules</Trans>
                  </Text>
                </View>
              </ActionableGridListItem>
            ) : (
              <SchedulesListItem
                value={item}
                status={statuses.get(item.id) || 'scheduled'}
                onAction={() => onSchedulePress(item)}
                onDelete={() => onScheduleDelete(item)}
              />
            )
          }
        </GridList>
      </Virtualizer>
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
