import { Command } from '#core/command';
import { Event } from '#core/event';
import { Workflow, WorkflowEvent } from '#core/workflow';
import { Map } from 'immutable';
import {
  CheckOut,
  GuestCheckedOut,
  GuestCheckoutFailed,
} from '../guestStayAccounts/guestStayAccount';

/// Inspired by https://blog.bittacklr.be/the-workflow-pattern.html

////////////////////////////////////////////
////////// Commands
///////////////////////////////////////////

export type InitiateGroupCheckout = Command<
  'InitiateGroupCheckout',
  {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
    now: Date;
  }
>;

////////////////////////////////////////////
////////// EVENTS
///////////////////////////////////////////

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

export type GuestCheckoutCompletionRecorded = Event<
  'GuestCheckoutCompletionRecorded',
  {
    groupCheckoutId: string;
    guestStayAccountId: string;
    completedAt: Date;
  }
>;

export type GuestCheckoutFailureRecorded = Event<
  'GuestCheckoutFailureRecorded',
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
  | GuestCheckoutCompletionRecorded
  | GuestCheckoutFailureRecorded
  | GroupCheckoutCompleted
  | GroupCheckoutFailed;

////////////////////////////////////////////
////////// Entity
///////////////////////////////////////////

export type GroupCheckout =
  | { status: 'NotExisting' }
  | {
      status: 'Pending';
      guestStayAccountIds: Map<string, GuestStayStatus>;
    }
  | { status: 'Finished' };

export const getInitialState = (): GroupCheckout => {
  return {
    status: 'NotExisting',
  };
};

export enum GuestStayStatus {
  Pending = 'Pending',
  Initiated = 'Initiated',
  Completed = 'Completed',
  Failed = 'Failed',
}

////////////////////////////////////////////
////////// Workflow Definition
///////////////////////////////////////////

export type GroupCheckoutInput =
  | InitiateGroupCheckout
  | GuestCheckedOut
  | GuestCheckoutFailed;

export type GroupCheckoutOutput =
  | GroupCheckoutInitiated
  | CheckOut
  | GuestCheckoutCompletionRecorded
  | GuestCheckoutFailureRecorded
  | GuestCheckoutsInitiated
  | GroupCheckoutCompleted
  | GroupCheckoutFailed
  | Ignored
  | UnexpectedErrorOcurred;

export type Ignored = {
  type: 'Ignored';
  data: {
    reason: IgnoredReason;
  };
};

export type UnexpectedErrorOcurred = {
  type: 'ErrorOcurred';
  data: {
    reason: ErrorReason;
  };
};

export type IgnoredReason =
  | 'GroupCheckoutAlreadyInitiated'
  | 'GuestCheckoutsInitiationAlreadyRecorded'
  | 'GuestCheckoutAlreadyFinished'
  | 'GroupCheckoutAlreadyFinished'
  | 'GroupCheckoutDoesNotExist';

export type ErrorReason = 'UnknownInputType';

const ignore = (reason: IgnoredReason): Ignored => {
  return {
    type: 'Ignored',
    data: {
      reason,
    },
  };
};

const error = (reason: ErrorReason): UnexpectedErrorOcurred => {
  return {
    type: 'ErrorOcurred',
    data: {
      reason,
    },
  };
};

////////////////////////////////////////////
////////// Evolve
///////////////////////////////////////////

export const decide = (
  input: GroupCheckoutInput,
  state: GroupCheckout,
): GroupCheckoutOutput[] => {
  const { type, data } = input;

  switch (type) {
    case 'InitiateGroupCheckout': {
      if (state.status !== 'NotExisting')
        return [ignore('GroupCheckoutAlreadyInitiated')];

      const checkoutGuestStays = data.guestStayAccountIds.map<CheckOut>(
        (id) => {
          return {
            type: 'CheckOut',
            data: {
              guestStayAccountId: id,
              now: data.now,
              groupCheckoutId: data.groupCheckoutId,
            },
          };
        },
      );

      return [
        {
          type: 'GuestCheckoutsInitiated',
          data: {
            groupCheckoutId: data.groupCheckoutId,
            initiatedGuestStayIds: data.guestStayAccountIds,
            initiatedAt: data.now,
          },
        },
        ...checkoutGuestStays,
      ];
    }
    case 'GuestCheckedOut':
    case 'GuestCheckoutFailed': {
      if (!data.groupCheckoutId) return [];

      if (state.status === 'NotExisting') return [];

      if (state.status === 'Finished') return [];

      const { guestStayAccountId, groupCheckoutId } = data;

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
        type === 'GuestCheckedOut' ? data.checkedOutAt : data.failedAt;

      const finished: GroupCheckoutEvent =
        type === 'GuestCheckedOut'
          ? {
              type: 'GuestCheckoutCompletionRecorded',
              data: {
                groupCheckoutId,
                guestStayAccountId,
                completedAt: now,
              },
            }
          : {
              type: 'GuestCheckoutFailureRecorded',
              data: {
                groupCheckoutId,
                guestStayAccountId,
                failedAt: now,
              },
            };

      return areAnyOngoingCheckouts(guestStayAccountIds)
        ? [finished]
        : [finished, finish(groupCheckoutId, state.guestStayAccountIds, now)];
    }
    default: {
      const _notExistingEventType: never = type;
      return [error('UnknownInputType')];
    }
  }
};

export const evolve = (
  state: GroupCheckout,
  { type, data: event }: WorkflowEvent<GroupCheckoutOutput>,
): GroupCheckout => {
  switch (type) {
    case 'GroupCheckoutInitiated': {
      if (state.status !== 'NotExisting') return state;

      return {
        status: 'Pending',
        guestStayAccountIds: event.guestStayAccountIds.reduce(
          (map, id) => map.set(id, GuestStayStatus.Pending),
          Map<string, GuestStayStatus>(),
        ),
      };
    }
    case 'GuestCheckoutsInitiated': {
      if (state.status !== 'Pending') return state;

      return {
        status: 'Pending',
        guestStayAccountIds: event.initiatedGuestStayIds.reduce(
          (map, id) => map.set(id, GuestStayStatus.Initiated),
          state.guestStayAccountIds,
        ),
      };
    }
    case 'GuestCheckoutCompletionRecorded':
    case 'GuestCheckoutFailureRecorded': {
      if (state.status !== 'Pending') return state;

      return {
        ...state,
        guestStayAccountIds: state.guestStayAccountIds.set(
          event.guestStayAccountId,
          type === 'GuestCheckoutCompletionRecorded'
            ? GuestStayStatus.Completed
            : GuestStayStatus.Failed,
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

export const GroupCheckoutWorkflow: Workflow<
  GroupCheckoutInput,
  GroupCheckout,
  GroupCheckoutOutput
> = {
  decide,
  evolve,
  getInitialState,
};

export const isAlreadyClosed = (status: GuestStayStatus | undefined) =>
  status === GuestStayStatus.Completed || status === GuestStayStatus.Failed;

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
