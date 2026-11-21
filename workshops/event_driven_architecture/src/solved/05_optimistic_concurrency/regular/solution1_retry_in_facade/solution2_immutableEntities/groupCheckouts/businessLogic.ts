import type {
  CheckoutStatus,
  GroupCheckout,
  GroupCheckoutCompleted,
  GroupCheckoutEvent,
  GroupCheckoutFailed,
  GroupCheckoutInitiated,
} from './groupCheckout';

export type InitiateGroupCheckout = {
  type: 'InitiateGroupCheckout';
  data: {
    groupCheckoutId: string;
    clerkId: string;
    guestStayAccountIds: string[];
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

export const initiateGroupCheckout = ({
  data: command,
}: InitiateGroupCheckout): GroupCheckoutInitiated => {
  const { groupCheckoutId, clerkId, guestStayAccountIds, now } = command;

  return {
    type: 'GroupCheckoutInitiated',
    data: {
      groupCheckoutId,
      clerkId: clerkId,
      guestStayAccountIds: guestStayAccountIds,
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
  const guestCheckoutStatus: CheckoutStatus =
    type === 'RecordGuestCheckoutCompletion' ? 'Completed' : 'Failed';

  if (
    state.status !== 'Initiated' ||
    state.guestStayCheckouts[command.guestStayAccountId] === guestCheckoutStatus
  )
    return [];

  const guestCheckoutCompletionRecorded: GroupCheckoutEvent =
    type === 'RecordGuestCheckoutCompletion'
      ? {
          type: 'GuestCheckoutCompletionRecorded',
          data: {
            groupCheckoutId: command.groupCheckoutId,
            guestStayAccountId: command.guestStayAccountId,
            completedAt: command.now,
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

  const guestStayCheckouts = {
    ...state.guestStayCheckouts,
    [command.guestStayAccountId]: guestCheckoutStatus,
  };

  return areAnyOngoingCheckouts(guestStayCheckouts)
    ? [guestCheckoutCompletionRecorded]
    : [
        guestCheckoutCompletionRecorded,
        finish(command.groupCheckoutId, guestStayCheckouts, command.now),
      ];
};

const finish = (
  groupCheckoutId: string,
  guestStayAccounts: Record<string, CheckoutStatus>,
  now: Date,
): GroupCheckoutCompleted | GroupCheckoutFailed => {
  return !areAnyFailedCheckouts(guestStayAccounts)
    ? {
        type: 'GroupCheckoutCompleted',
        data: {
          groupCheckoutId,
          completedCheckouts: Object.keys(guestStayAccounts),
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
  guestStayCheckouts: Record<string, CheckoutStatus>,
) => Object.values(guestStayCheckouts).some((status) => status === 'Initiated');

const areAnyFailedCheckouts = (
  guestStayCheckouts: Record<string, CheckoutStatus>,
) => Object.values(guestStayCheckouts).some((status) => status === 'Failed');

const checkoutsWith = (
  guestStayCheckouts: Record<string, CheckoutStatus>,
  status: CheckoutStatus,
): string[] =>
  Object.entries(guestStayCheckouts)
    .filter((s) => s[1] === status)
    .map((s) => s[0]);
