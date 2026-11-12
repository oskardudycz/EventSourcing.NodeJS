import type { DocumentsCollection } from '../../../tools';
import { Projection } from '../core/projection';
import type {
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts';
import {
  initiated,
  withCheckout,
  type GroupCheckout,
  type GroupCheckoutEvent,
} from './groupCheckout';

export type GroupCheckoutToDoListEvent =
  GroupCheckoutEvent | GuestCheckedOut | GuestCheckoutFailed;

export const GroupCheckoutProjection = (
  collection: DocumentsCollection<GroupCheckout>,
) =>
  Projection<GroupCheckout, GroupCheckoutToDoListEvent>(collection, {
    canHandle: [
      'GroupCheckoutInitiated',
      'GuestCheckedOut',
      'GuestCheckoutFailed',
      'GroupCheckoutCompleted',
      'GroupCheckoutFailed',
    ],
    getDocumentId: (event) => event.data.groupCheckoutId,
    evolve: (current, event) => {
      switch (event.type) {
        case 'GroupCheckoutInitiated':
          return initiated(
            event.data.groupCheckoutId,
            event.data.guestStayAccountIds,
            event.data.initiatedAt,
          );
        case 'GuestCheckedOut':
          return withCheckout(
            existing(current),
            event.data.guestStayAccountId,
            'Completed',
            event.data.checkedOutAt,
          );
        case 'GuestCheckoutFailed':
          return withCheckout(
            existing(current),
            event.data.guestStayAccountId,
            'Failed',
            event.data.failedAt,
          );
        case 'GroupCheckoutCompleted':
        case 'GroupCheckoutFailed':
          return null;
      }
    },
  });

export type GroupCheckoutProjection = ReturnType<
  typeof GroupCheckoutProjection
>;

const existing = (current: GroupCheckout | null): GroupCheckout => {
  if (current === null) throw new Error('Entity not found');

  return current;
};
