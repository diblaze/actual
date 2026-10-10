import type { AccountEntity } from './account';
import type { CategoryGroupEntity } from './category-group';

export type CategoryEntity = {
  id: string;
  name: string;
  is_income?: boolean;
  group: CategoryGroupEntity['id'];
  goal_def?: string;
  cleanup_def?: string;
  template_settings?: { source: 'notes' | 'ui' };
  sort_order?: number;
  tombstone?: boolean;
  hidden?: boolean;
  // Set on a credit card's payment category (ccPaymentCategories flag)
  payment_account?: AccountEntity['id'] | null;
};
