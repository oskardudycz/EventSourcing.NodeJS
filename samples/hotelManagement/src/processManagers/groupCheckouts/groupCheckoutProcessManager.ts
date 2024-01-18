import { Command } from '#core/command';
import { Map } from 'immutable';
import {
  CheckOut,
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts/guestStayAccount';
import {
  GroupCheckout,
  GroupCheckoutEvent,
  GroupCheckoutInitiated,
  GuestStayStatus,
  isAlreadyClosed,
} from './groupCheckout';

export type GroupCheckoutProcessManagerEvent =
  | GroupCheckoutInitiated
  | GuestCheckedOut
  | GuestCheckoutFailed;

export type GroupCheckoutProcessingResult = CheckOut | GroupCheckoutEvent;

export type InitiateGroupCheckout = Command<
  'InitiateGroupCheckout',
  {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    now: Date;
  }
>;

export const initiate = (
  { type, data: command }: InitiateGroupCheckout,
  state: GroupCheckout,
): GroupCheckoutEvent | GroupCheckoutEvent[] | ProcessingResult => {
  const { groupCheckoutId, now } = command;

  switch (type) {
    case 'InitiateGroupCheckout': {
      if (state.status !== 'NotExisting')
        return ignore('GroupCheckoutAlreadyInitiated');

      return {
        type: 'GroupCheckoutInitiated',
        data: {
          groupCheckoutId,
          clerkId: command.clerkId,
          guestStayAccountIds: command.guestStayAccountIds,
          initiatedAt: now,
        },
      };
    }
  }
};

export const GroupCheckoutProcessManager = (
  { type, data: event }: GroupCheckoutProcessManagerEvent,
  state: GroupCheckout,
): GroupCheckoutProcessingResult | GroupCheckoutProcessingResult[] => {
  switch (type) {
    case 'GroupCheckoutInitiated': {
      if (state.status == 'NotExisting') return [];

      if (state.status === 'Finished') return [];

      const checkoutGuestStays: CheckOut[] = event.guestStayAccountIds.map(
        (id) => {
          return {
            type: 'CheckOut',
            data: {
              guestStayAccountId: id,
              now: event.initiatedAt,
              groupCheckoutId: event.groupCheckoutId,
            },
          };
        },
      );

      return [
        ...checkoutGuestStays,
        {
          type: 'GuestCheckoutsInitiated',
          data: {
            groupCheckoutId: event.groupCheckoutId,
            initiatedGuestStayIds: event.guestStayAccountIds,
            initiatedAt: event.initiatedAt,
          },
        },
      ];
    }

    case 'GuestCheckedOut':
    case 'GuestCheckoutFailed': {
      if (!event.groupCheckoutId) return [];

      if (state.status === 'NotExisting') return [];

      if (state.status === 'Finished') return [];

      const { guestStayAccountId, groupCheckoutId } = event;

      const guestCheckoutStatus =
        state.guestStayAccountIds.get(guestStayAccountId);

      if (isAlreadyClosed(guestCheckoutStatus)) return [];

      const guestStayAccountIds = state.guestStayAccountIds.set(
        guestStayAccountId,
        type === 'GuestCheckedOut'
          ? GuestStayStatus.Completed
          : GuestStayStatus.Failed,
      );

      const now =
        type === 'GuestCheckedOut' ? event.checkedOutAt : event.failedAt;

      const finished: GroupCheckoutEvent =
        type === 'GuestCheckedOut'
          ? {
              type: 'GuestCheckoutCompleted',
              data: {
                groupCheckoutId,
                guestStayAccountId,
                completedAt: now,
              },
            }
          : {
              type: 'GuestCheckoutFailed',
              data: {
                groupCheckoutId,
                guestStayAccountId,
                failedAt: now,
              },
            };

      return areAnyOngoingCheckouts(guestStayAccountIds)
        ? finished
        : [finished, finish(groupCheckoutId, state.guestStayAccountIds, now)];
    }
  }
};

export type ProcessingResult = {
  type: 'Ignored';
  data: {
    reason: IgnoredReason;
  };
};

export type IgnoredReason =
  | 'GroupCheckoutAlreadyInitiated'
  | 'GuestCheckoutsInitiationAlreadyRecorded'
  | 'GuestCheckoutAlreadyFinished'
  | 'GroupCheckoutAlreadyFinished'
  | 'GroupCheckoutDoesNotExist';

const ignore = (reason: IgnoredReason): ProcessingResult => {
  return {
    type: 'Ignored',
    data: {
      reason,
    },
  };
};

const areAnyOngoingCheckouts = (
  guestStayAccounts: Map<string, GuestStayStatus>,
) => guestStayAccounts.some((status) => !isAlreadyClosed(status));

const areAllCompleted = (guestStayAccounts: Map<string, GuestStayStatus>) =>
  guestStayAccounts.some((status) => status === GuestStayStatus.Completed);

const checkoutsWith = (
  guestStayAccounts: Map<string, GuestStayStatus>,
  status: GuestStayStatus,
): string[] =>
  Array.from(guestStayAccounts.filter((s) => s === status).values());

const finish = (
  groupCheckoutId: string,
  guestStayAccounts: Map<string, GuestStayStatus>,
  now: Date,
): GroupCheckoutEvent => {
  return areAllCompleted(guestStayAccounts)
    ? {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: Array.from(guestStayAccounts.values()),
          completedAt: now,
        },
      }
    : {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: checkoutsWith(
            guestStayAccounts,
            GuestStayStatus.Completed,
          ),
          failedCheckouts: checkoutsWith(
            guestStayAccounts,
            GuestStayStatus.Failed,
          ),
          failedAt: now,
        },
      };
};
