import { Command } from '#core/command';
import { Event } from '#core/event';
import {
  Workflow,
  WorkflowEvent,
  WorkflowOutput,
  accept,
  complete,
  error,
  ignore,
  publish,
  send,
} from '#core/workflow';
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

export type TimeoutGroupCheckout = Command<
  'TimeoutGroupCheckout',
  {
    groupCheckoutId: string;
    startedAt: Date;
    timeOutAt: Date;
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

export type GroupCheckoutTimedOut = Event<
  'GroupCheckoutTimedOut',
  {
    groupCheckoutId: string;
    incompleteCheckouts: string[];
    completedCheckouts: string[];
    failedCheckouts: string[];
    timedOutAt: Date;
  }
>;

////////////////////////////////////////////
////////// Entity
///////////////////////////////////////////

export type NotExisting = { status: 'NotExisting' };

export type Pending = {
  status: 'Pending';
  guestStayAccountIds: Map<string, GuestStayStatus>;
};

export type Finished = { status: 'Finished' };

export type GroupCheckout = NotExisting | Pending | Finished;

export const getInitialState = (): GroupCheckout => {
  return {
    status: 'NotExisting',
  };
};

export enum GuestStayStatus {
  Pending = 'Pending',
  Completed = 'Completed',
  Failed = 'Failed',
}

////////////////////////////////////////////
////////// Workflow Definition
///////////////////////////////////////////

export type GroupCheckoutInput =
  | InitiateGroupCheckout
  | GuestCheckedOut
  | GuestCheckoutFailed
  | TimeoutGroupCheckout;

export type GroupCheckoutOutput =
  | GroupCheckoutInitiated
  | CheckOut
  | GroupCheckoutCompleted
  | GroupCheckoutFailed
  | GroupCheckoutTimedOut;

export enum IgnoredReason {
  GroupCheckoutAlreadyInitiated = 'GroupCheckoutAlreadyInitiated',
  GuestCheckoutWasNotPartOfGroupCheckout = 'GuestCheckoutWasNotPartOfGroupCheckout',
  GuestCheckoutAlreadyFinished = 'GuestCheckoutAlreadyFinished',
  GroupCheckoutAlreadyFinished = 'GroupCheckoutAlreadyFinished',
  GroupCheckoutDoesNotExist = 'GroupCheckoutDoesNotExist',
}

export type ErrorReason = 'UnknownInputType';

////////////////////////////////////////////
////////// Decide
///////////////////////////////////////////

export const decide = (
  input: GroupCheckoutInput,
  state: GroupCheckout,
): WorkflowOutput<GroupCheckoutOutput>[] => {
  const { type } = input;
  const { status } = state;

  switch (status) {
    case 'NotExisting': {
      if (type !== 'InitiateGroupCheckout')
        return [ignore(IgnoredReason.GroupCheckoutAlreadyInitiated)];

      return initiate(input);
    }
    case 'Pending': {
      switch (type) {
        case 'GuestCheckedOut':
        case 'GuestCheckoutFailed':
          return tryComplete(input, state);

        case 'TimeoutGroupCheckout':
          return timeOut(input, state);

        default: {
          return [error('UnknownInputType')];
        }
      }
    }
    case 'Finished':
      return [ignore(IgnoredReason.GroupCheckoutAlreadyFinished)];
    default: {
      const _notExistingEventType: never = status;
      return [error('UnknownInputType')];
    }
  }

  // switch (type) {
  //   case 'InitiateGroupCheckout': {
  //     if (state.status !== 'NotExisting')
  //       return [ignore(IgnoredReason.GroupCheckoutAlreadyInitiated)];

  //     return initiate(input);
  //   }
  //   case 'GuestCheckedOut':
  //   case 'GuestCheckoutFailed': {
  //     if (state.status === 'NotExisting')
  //       return [ignore(IgnoredReason.GroupCheckoutDoesNotExist)];

  //     if (state.status === 'Finished')
  //       return [ignore(IgnoredReason.GuestCheckoutAlreadyFinished)];

  //     return tryComplete(input, state);
  //   }
  //   case 'TimeoutGroupCheckout': {
  //     if (state.status === 'NotExisting')
  //       return [ignore(IgnoredReason.GroupCheckoutDoesNotExist)];

  //     if (state.status === 'Finished')
  //       return [ignore(IgnoredReason.GroupCheckoutAlreadyFinished)];

  //     return timeOut(input, state);
  //   }
  //   default: {
  //     const _notExistingEventType: never = type;
  //     return [error('UnknownInputType')];
  //   }
  // }
};

const initiate = ({
  data: command,
}: InitiateGroupCheckout): WorkflowOutput<GroupCheckoutOutput>[] => {
  const checkoutGuestStays = command.guestStayAccountIds.map((id) => {
    return send<GroupCheckoutOutput>({
      type: 'CheckOut',
      data: {
        guestStayAccountId: id,
        now: command.now,
        groupCheckoutId: command.groupCheckoutId,
      },
    });
  });

  return [
    ...checkoutGuestStays,
    publish<GroupCheckoutOutput>({
      type: 'GroupCheckoutInitiated',
      data: {
        groupCheckoutId: command.groupCheckoutId,
        guestStayAccountIds: command.guestStayAccountIds,
        initiatedAt: command.now,
        clerkId: command.clerkId,
      },
    }),
  ];
};

const tryComplete = (
  { type, data: event }: GuestCheckedOut | GuestCheckoutFailed,
  state: Pending,
): WorkflowOutput<GroupCheckoutOutput>[] => {
  if (!event.groupCheckoutId)
    return [ignore(IgnoredReason.GuestCheckoutWasNotPartOfGroupCheckout)];

  const { guestStayAccountId, groupCheckoutId } = event;

  const guestCheckoutStatus = state.guestStayAccountIds.get(guestStayAccountId);

  if (isAlreadyClosed(guestCheckoutStatus))
    return [ignore(IgnoredReason.GuestCheckoutAlreadyFinished)];

  const guestStayAccountIds = state.guestStayAccountIds.set(
    guestStayAccountId,
    type === 'GuestCheckedOut'
      ? GuestStayStatus.Completed
      : GuestStayStatus.Failed,
  );

  const now = type === 'GuestCheckedOut' ? event.checkedOutAt : event.failedAt;

  return areAnyOngoingCheckouts(guestStayAccountIds)
    ? [accept()]
    : [
        publish(finished(groupCheckoutId, state.guestStayAccountIds, now)),
        complete(),
      ];
};

const timeOut = (
  { data: event }: TimeoutGroupCheckout,
  state: Pending,
): WorkflowOutput<GroupCheckoutOutput>[] => {
  const { groupCheckoutId, timeOutAt } = event;
  const { guestStayAccountIds } = state;

  return [
    publish<GroupCheckoutOutput>({
      type: 'GroupCheckoutTimedOut',
      data: {
        groupCheckoutId,
        incompleteCheckouts: checkoutsWith(
          guestStayAccountIds,
          GuestStayStatus.Pending,
        ),
        completedCheckouts: checkoutsWith(
          guestStayAccountIds,
          GuestStayStatus.Completed,
        ),
        failedCheckouts: checkoutsWith(
          guestStayAccountIds,
          GuestStayStatus.Failed,
        ),
        timedOutAt: timeOutAt,
      },
    }),
    complete(),
  ];
};

////////////////////////////////////////////
////////// Evolve
///////////////////////////////////////////

export const evolve = (
  state: GroupCheckout,
  {
    type,
    data: event,
  }: WorkflowEvent<GroupCheckoutInput | GroupCheckoutOutput>,
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
    case 'GuestCheckedOut':
    case 'GuestCheckoutFailed': {
      if (state.status !== 'Pending') return state;

      return {
        ...state,
        guestStayAccountIds: state.guestStayAccountIds.set(
          event.guestStayAccountId,
          type === 'GuestCheckedOut'
            ? GuestStayStatus.Completed
            : GuestStayStatus.Failed,
        ),
      };
    }
    case 'GroupCheckoutCompleted':
    case 'GroupCheckoutFailed':
    case 'GroupCheckoutTimedOut': {
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

const finished = (
  groupCheckoutId: string,
  guestStayAccounts: Map<string, GuestStayStatus>,
  now: Date,
): GroupCheckoutCompleted | GroupCheckoutFailed => {
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

const timedOut = (
  groupCheckoutId: string,
  guestStayAccounts: Map<string, GuestStayStatus>,
  now: Date,
): GroupCheckoutTimedOut => {
  return {
    type: 'GroupCheckoutTimedOut',
    data: {
      groupCheckoutId,
      incompleteCheckouts: checkoutsWith(
        guestStayAccounts,
        GuestStayStatus.Pending,
      ),
      completedCheckouts: checkoutsWith(
        guestStayAccounts,
        GuestStayStatus.Completed,
      ),
      failedCheckouts: checkoutsWith(guestStayAccounts, GuestStayStatus.Failed),
      timedOutAt: now,
    },
  };
};
