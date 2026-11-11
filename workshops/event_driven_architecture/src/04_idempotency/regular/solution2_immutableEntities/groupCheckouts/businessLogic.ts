import {
  type CheckoutStatus,
  type GroupCheckout,
  type GroupCheckoutCompleted,
  type GroupCheckoutEvent,
  type GroupCheckoutFailed,
  type GroupCheckoutInitiated,
} from './groupCheckout';

export type InitiateGroupCheckout = {
  type: 'InitiateGroupCheckout';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayIds: string[];
    now: Date;
  };
};

export type RecordGuestCheckoutCompletion = {
  type: 'RecordGuestCheckoutCompletion';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    now: Date;
  };
};

export type RecordGuestCheckoutFailure = {
  type: 'RecordGuestCheckoutFailure';
  data: {
    groupCheckoutId: string;
    guestStayAccountId: string;
    now: Date;
  };
};

export type GroupCheckoutCommand =
  | InitiateGroupCheckout
  | RecordGuestCheckoutCompletion
  | RecordGuestCheckoutFailure;

export const initiateGroupCheckout = (
  { data: command }: InitiateGroupCheckout,
  state: GroupCheckout,
): GroupCheckoutInitiated => {
  if (state.status !== 'NotExisting')
    throw new Error('Group checkout already initiated!');

  const { groupCheckoutId, clerkId, guestStayIds, now } = command;

  return {
    type: 'GroupCheckoutInitiated',
    data: {
      groupCheckoutId,
      clerkId: clerkId,
      guestStayAccountIds: guestStayIds,
      initiatedAt: now,
    },
  };
};

export const recordGuestCheckout = (
  {
    type,
    data: command,
  }: RecordGuestCheckoutCompletion | RecordGuestCheckoutFailure,
  state: GroupCheckout,
): GroupCheckoutEvent[] => {
  if (state.status !== 'Initiated') return [];

  const guestCheckoutCompletionRecorded: GroupCheckoutEvent =
    type === 'RecordGuestCheckoutCompletion'
      ? {
          type: 'GuestCheckoutCompletionRecorded',
          data: {
            groupCheckoutId: command.groupCheckoutId,
            guestStayAccountId: command.guestStayAccountId,
            checkedOutAt: command.now,
          },
        }
      : {
          type: 'GuestCheckoutFailureRecorded',
          data: {
            groupCheckoutId: command.groupCheckoutId,
            guestStayAccountId: command.guestStayAccountId,
            failedAt: command.now,
          },
        };

  const guestStayCheckouts = new Map<string, CheckoutStatus>([
    ...state.guestStayCheckouts,
    [
      command.guestStayAccountId,
      type === 'RecordGuestCheckoutCompletion' ? 'Completed' : 'Failed',
    ],
  ]);

  return areAnyOngoingCheckouts(guestStayCheckouts)
    ? [guestCheckoutCompletionRecorded]
    : [
        guestCheckoutCompletionRecorded,
        finish(command.groupCheckoutId, guestStayCheckouts, command.now),
      ];
};

const finish = (
  groupCheckoutId: string,
  guestStayAccounts: Map<string, CheckoutStatus>,
  now: Date,
): GroupCheckoutCompleted | GroupCheckoutFailed => {
  return areAllCompleted(guestStayAccounts)
    ? {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: Array.from(guestStayAccounts.keys()),
          completedAt: now,
        },
      }
    : {
        type: 'GroupCheckoutFailed',
        data: {
          groupCheckoutId,
          completedCheckouts: checkoutsWith(guestStayAccounts, 'Completed'),
          failedCheckouts: checkoutsWith(guestStayAccounts, 'Failed'),
          failedAt: now,
        },
      };
};

const areAnyOngoingCheckouts = (
  guestStayCheckouts: Map<string, CheckoutStatus>,
) => [...guestStayCheckouts.values()].some((status) => status === 'Initiated');

const areAllCompleted = (guestStayCheckouts: Map<string, CheckoutStatus>) =>
  [...guestStayCheckouts.values()].every((status) => status === 'Completed');

const checkoutsWith = (
  guestStayCheckouts: Map<string, CheckoutStatus>,
  status: CheckoutStatus,
): string[] =>
  [...guestStayCheckouts].filter((s) => s[1] === status).map((s) => s[0]);
