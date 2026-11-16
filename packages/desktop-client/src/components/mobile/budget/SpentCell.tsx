import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgArrowsSynchronize,
  SvgCalendar3,
} from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { AutoTextSize } from 'auto-text-size';

import { makeAmountGrey } from '#components/budget/util';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValue } from '#components/spreadsheet/CellValue';
import { useCategoryScheduleGoalTemplateIndicator } from '#hooks/useCategoryScheduleGoalTemplateIndicator';
import { useFormat } from '#hooks/useFormat';
import type { Binding } from '#spreadsheet';

import { AMOUNT_FONT, CELL_BUTTON_STYLE, FitAmountColumn } from './BudgetTable';

type SpentCellProps = {
  binding: Binding<'envelope-budget' | 'tracking-budget', 'sum-amount'>;
  category: CategoryEntity;
  month: string;
  onPress?: () => void;
};

export function SpentCell({
  binding,
  category,
  month,
  onPress,
}: SpentCellProps) {
  const { t } = useTranslation();
  const format = useFormat();

  const { schedule, scheduleStatus, isScheduleRecurring } =
    useCategoryScheduleGoalTemplateIndicator({
      category,
      month,
    });

  return (
    <CellValue<'envelope-budget' | 'tracking-budget', 'sum-amount'>
      binding={binding}
      type="financial"
      aria-label={t('Spent amount for {{categoryName}} category', {
        categoryName: category.name,
      })}
    >
      {({ type, value }) => (
        <>
          <Button
            variant="bare"
            style={{ ...CELL_BUTTON_STYLE, color: theme.tableText }}
            onPress={onPress}
            aria-label={t('Show transactions for {{categoryName}} category', {
              categoryName: category.name,
            })}
          >
            <View>
              <FitAmountColumn column={1} text={format(value, type)} />
              <PrivacyFilter>
                <AutoTextSize
                  key={value}
                  as={Text}
                  {...AMOUNT_FONT}
                  mode="oneline"
                  style={{
                    ...styles.tnum,
                    ...(makeAmountGrey(value) && {
                      color: theme.tableHeaderText,
                    }),
                    textAlign: 'right',
                    fontSize: 15,
                  }}
                >
                  {format(value, type)}
                </AutoTextSize>
              </PrivacyFilter>
            </View>
          </Button>
          {schedule && scheduleStatus && (
            <View
              style={{
                position: 'absolute',
                right: '-3px',
                top: '-5px',
                borderRadius: '50%',
                color:
                  scheduleStatus === 'missed'
                    ? theme.errorText
                    : scheduleStatus === 'due'
                      ? theme.warningText
                      : theme.upcomingText,
              }}
            >
              {isScheduleRecurring ? (
                <SvgArrowsSynchronize width={11} height={11} />
              ) : (
                <SvgCalendar3 width={10} height={10} />
              )}
            </View>
          )}
        </>
      )}
    </CellValue>
  );
}
