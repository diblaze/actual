import { useResponsive } from '@actual-app/components/hooks/useResponsive';

import { LoadComponent } from '#components/util/LoadComponent';

import type * as NarrowComponents from './narrow';
import type * as WideComponents from './wide';

const loadNarrow = () =>
  import(/* webpackChunkName: "narrow-components" */ './narrow');
const loadWide = () =>
  import(/* webpackChunkName: "wide-components" */ './wide');

export function WideComponent({ name }: { name: keyof typeof WideComponents }) {
  return <LoadComponent name={name} importer={loadWide} />;
}

export function NarrowAlternate({
  name,
}: {
  name: keyof typeof WideComponents & keyof typeof NarrowComponents;
}) {
  // Phones and tablets (below 1100px) get the phone pages
  const { isWideWidth } = useResponsive();
  return (
    <LoadComponent name={name} importer={isWideWidth ? loadWide : loadNarrow} />
  );
}
