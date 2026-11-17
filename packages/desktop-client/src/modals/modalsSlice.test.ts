import { describe, expect, it } from 'vitest';

import { collapseModals, getInitialState, reducer } from './modalsSlice';
import type { Modal } from './modalsSlice';

const modal = (name: string) => ({ name, options: {} }) as unknown as Modal;

describe('collapseModals', () => {
  it('closes the topmost modal with the name and everything above it', () => {
    const state = {
      ...getInitialState(),
      modalStack: [
        modal('category-autocomplete'),
        modal('cover'),
        modal('category-autocomplete'),
      ],
    };

    const next = reducer(
      state,
      collapseModals({ rootModalName: 'category-autocomplete' }),
    );

    expect(next.modalStack.map(m => m.name)).toEqual([
      'category-autocomplete',
      'cover',
    ]);
  });

  it('keeps the stack when no modal has the name', () => {
    const state = { ...getInitialState(), modalStack: [modal('cover')] };

    const next = reducer(state, collapseModals({ rootModalName: 'transfer' }));

    expect(next.modalStack.map(m => m.name)).toEqual(['cover']);
  });
});
