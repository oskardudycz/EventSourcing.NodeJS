////////////////////////////////////////////
////////// EVENTS
///////////////////////////////////////////

import { Map } from 'immutable';

export type GroupCheckoutEvent =
  | {
      type: 'GroupCheckoutInitiated';
      data: {
        groupCheckoutId: string;
        clerkId: string;
        guestStayAccountIds: string[];
        initiatedAt: Date;
      };
    }
  | {
      type: 'GuestCheckoutsInitiated';
      data: {
        groupCheckoutId: string;
        initiatedGuestStayIds: string[];
        initiatedAt: Date;
      };
    }
  | {
      type: 'GuestCheckoutCompleted';
      data: {
        groupCheckoutId: string;
        guestStayAccountId: string;
        completedAt: Date;
      };
    }
  | {
      type: 'GuestCheckoutFailed';
      data: {
        groupCheckoutId: string;
        guestStayAccountId: string;
        failedAt: Date;
      };
    }
  | {
      type: 'GroupCheckoutCompleted';
      data: {
        groupCheckoutId: string;
        completedCheckouts: string[];
        completedAt: Date;
      };
    }
  | {
      type: 'GroupCheckoutFailed';
      data: {
        groupCheckoutId: string;
        completedCheckouts: string[];
        failedCheckouts: string[];
        failedAt: Date;
      };
    };

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

////////////////////////////////////////////
////////// Commands
///////////////////////////////////////////

export type GroupCheckoutCommand =
  | {
      type: 'InitiateGroupCheckout';
      data: {
        groupCheckoutId: string;
        clerkId: string;
        guestStayAccountIds: string[];
        now: Date;
      };
    }
  | {
      type: 'RecordGuestCheckoutsInitiation';
      data: {
        groupCheckoutId: string;
        initiatedGuestStayIds: string[];
        now: Date;
      };
    }
  | {
      type: 'RecordGuestCheckoutCompletion';
      data: {
        groupCheckoutId: string;
        guestStayAccountId: string;
        now: Date;
      };
    }
  | {
      type: 'RecordGuestCheckoutFailure';
      data: {
        groupCheckoutId: string;
        guestStayAccountId: string;
        now: Date;
      };
    };

export const decide = (
  { type, data: command }: GroupCheckoutCommand,
  state: GroupCheckout
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

    case 'RecordGuestCheckoutsInitiation': {
      if (state.status == 'NotExisting')
        return ignore('GroupCheckoutDoesNotExist');
      if (state.status === 'Finished')
        return ignore('GroupCheckoutAlreadyFinished');

      return {
        type: 'GuestCheckoutsInitiated',
        data: {
          groupCheckoutId,
          initiatedGuestStayIds: command.initiatedGuestStayIds,
          initiatedAt: now,
        },
      };
    }

    case 'RecordGuestCheckoutCompletion':
    case 'RecordGuestCheckoutFailure': {
      if (state.status === 'NotExisting')
        return ignore('GroupCheckoutDoesNotExist');
      if (state.status === 'Finished')
        return ignore('GroupCheckoutAlreadyFinished');

      const { guestStayAccountId } = command;

      const guestCheckoutStatus =
        state.guestStayAccountIds.get(guestStayAccountId);

      if (isAlreadyClosed(guestCheckoutStatus))
        return ignore('GuestCheckoutAlreadyFinished');

      const guestStayAccountIds = state.guestStayAccountIds.set(
        guestStayAccountId,
        type === 'RecordGuestCheckoutCompletion'
          ? GuestStayStatus.Completed
          : GuestStayStatus.Failed
      );

      const finished: GroupCheckoutEvent =
        type === 'RecordGuestCheckoutCompletion'
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
    default: {
      const _notExistingCommandType: never = type;
      throw new Error(`Unknown command type`);
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
  guestStayAccounts: Map<string, GuestStayStatus>
) => guestStayAccounts.some((status) => !isAlreadyClosed(status));

const areAllCompleted = (guestStayAccounts: Map<string, GuestStayStatus>) =>
  guestStayAccounts.some((status) => status === GuestStayStatus.Completed);

const checkoutsWith = (
  guestStayAccounts: Map<string, GuestStayStatus>,
  status: GuestStayStatus
): string[] =>
  Array.from(guestStayAccounts.filter((s) => s === status).values());

const finish = (
  groupCheckoutId: string,
  guestStayAccounts: Map<string, GuestStayStatus>,
  now: Date
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
            GuestStayStatus.Completed
          ),
          failedCheckouts: checkoutsWith(
            guestStayAccounts,
            GuestStayStatus.Failed
          ),
          failedAt: now,
        },
      };
};
