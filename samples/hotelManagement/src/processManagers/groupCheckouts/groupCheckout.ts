////////////////////////////////////////////
////////// EVENTS
///////////////////////////////////////////

import { Map } from 'immutable';
import { Event } from '#core/event';

export type GroupCheckoutInitiated = Event<
  'GroupCheckoutInitiated',
  {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    initiatedAt: Date;
  }
>;

export type GuestCheckoutsInitiated = Event<
  'GuestCheckoutsInitiated',
  {
    groupCheckoutId: string;
    initiatedGuestStayIds: string[];
    initiatedAt: Date;
  }
>;

export type GuestCheckoutCompleted = Event<
  'GuestCheckoutCompleted',
  {
    groupCheckoutId: string;
    guestStayAccountId: string;
    completedAt: Date;
  }
>;

export type GuestCheckoutFailed = Event<
  'GuestCheckoutFailed',
  {
    groupCheckoutId: string;
    guestStayAccountId: string;
    failedAt: Date;
  }
>;

export type GroupCheckoutCompleted = Event<
  'GroupCheckoutCompleted',
  {
    groupCheckoutId: string;
    completedCheckouts: string[];
    completedAt: Date;
  }
>;

export type GroupCheckoutFailed = Event<
  'GroupCheckoutFailed',
  {
    groupCheckoutId: string;
    completedCheckouts: string[];
    failedCheckouts: string[];
    failedAt: Date;
  }
>;

export type GroupCheckoutEvent =
  | GroupCheckoutInitiated
  | GuestCheckoutsInitiated
  | GuestCheckoutCompleted
  | GuestCheckoutFailed
  | GroupCheckoutCompleted
  | GroupCheckoutFailed;

////////////////////////////////////////////
////////// Entity
///////////////////////////////////////////

export enum GuestStayStatus {
  Pending = 'Pending',
  Initiated = 'Initiated',
  Completed = 'Completed',
  Failed = 'Failed',
}

export const isAlreadyClosed = (status: GuestStayStatus | undefined) =>
  status === GuestStayStatus.Completed || status === GuestStayStatus.Failed;

export type GroupCheckout =
  | { status: 'NotExisting' }
  | {
      status: 'Pending';
      guestStayAccountIds: Map<string, GuestStayStatus>;
    }
  | { status: 'Finished' };

////////////////////////////////////////////
////////// Evolve
///////////////////////////////////////////

export const evolve = (
  state: GroupCheckout,
  { type, data: event }: GroupCheckoutEvent
): GroupCheckout => {
  switch (type) {
    case 'GroupCheckoutInitiated': {
      if (state.status !== 'NotExisting') return state;

      return {
        status: 'Pending',
        guestStayAccountIds: event.guestStayAccountIds.reduce(
          (map, id) => map.set(id, GuestStayStatus.Pending),
          Map<string, GuestStayStatus>()
        ),
      };
    }
    case 'GuestCheckoutsInitiated': {
      if (state.status !== 'Pending') return state;

      return {
        status: 'Pending',
        guestStayAccountIds: event.initiatedGuestStayIds.reduce(
          (map, id) => map.set(id, GuestStayStatus.Initiated),
          state.guestStayAccountIds
        ),
      };
    }
    case 'GuestCheckoutCompleted':
    case 'GuestCheckoutFailed': {
      if (state.status !== 'Pending') return state;

      return {
        ...state,
        guestStayAccountIds: state.guestStayAccountIds.set(
          event.guestStayAccountId,
          type === 'GuestCheckoutCompleted'
            ? GuestStayStatus.Completed
            : GuestStayStatus.Failed
        ),
      };
    }
    case 'GroupCheckoutCompleted':
    case 'GroupCheckoutFailed': {
      if (state.status !== 'Pending') return state;

      return {
        status: 'Finished',
      };
    }
    default: {
      const _notExistingEventType: never = type;
      return state;
    }
  }
};
