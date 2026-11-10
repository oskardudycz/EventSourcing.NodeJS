import type {
  ChargeRecorded,
  GuestCheckedIn,
  GuestCheckedOut,
  GuestCheckoutFailed,
  GuestStayAccount,
  GuestStayAccountEvent,
  PaymentRecorded,
} from './guestStayAccount';

export type CheckInGuest = {
  type: 'CheckInGuest';
  data: {
    guestStayAccountId: string;
    guestId: string;
    roomId: string;
    now: Date;
  };
};
export type RecordCharge = {
  type: 'RecordCharge';
  data: {
    guestStayAccountId: string;
    chargeId: string;
    amount: number;
    now: Date;
  };
};

export type RecordPayment = {
  type: 'RecordPayment';
  data: {
    guestStayAccountId: string;
    paymentId: string;
    amount: number;
    now: Date;
  };
};

export type CheckoutGuest = {
  type: 'CheckoutGuest';
  data: {
    guestStayAccountId: string;
    now: Date;
    groupCheckoutId?: string | undefined;
  };
};

export type GuestStayAccountCommand =
  | CheckInGuest
  | RecordCharge
  | RecordPayment
  | CheckoutGuest;

export const checkInGuest = (
  { data: command }: CheckInGuest,
  state: GuestStayAccount,
): GuestCheckedIn => {
  if (state.status !== 'NotExisting')
    throw Error('Guest is already checked-in!');

  return {
    type: 'GuestCheckedIn',
    data: {
      guestId: command.guestId,
      roomId: command.roomId,
      guestStayAccountId: command.guestStayAccountId,
      checkedInAt: command.now,
    },
  };
};

export const recordCharge = (
  { data: command }: RecordCharge,
  state: GuestStayAccount,
): ChargeRecorded => {
  if (state.status !== 'CheckedIn')
    throw Error('Guest account is already checked out!');

  return {
    type: 'ChargeRecorded',
    data: {
      guestStayAccountId: command.guestStayAccountId,
      chargeId: command.chargeId,
      amount: command.amount,
      recordedAt: command.now,
    },
  };
};

export const recordPayment = (
  { data: command }: RecordPayment,
  state: GuestStayAccount,
): PaymentRecorded => {
  if (state.status !== 'CheckedIn')
    throw Error('Guest account is already checked out!');

  return {
    type: 'PaymentRecorded',
    data: {
      guestStayAccountId: command.guestStayAccountId,
      paymentId: command.paymentId,
      amount: command.amount,
      recordedAt: command.now,
    },
  };
};

export const checkoutGuest = (
  { data: command }: CheckoutGuest,
  state: GuestStayAccount,
): GuestCheckedOut | GuestCheckoutFailed => {
  if (state.status !== 'CheckedIn')
    return {
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId: command.guestStayAccountId,
        groupCheckoutId: command.groupCheckoutId,
        reason: 'NotCheckedIn',
        failedAt: command.now,
      },
    };

  const isSettled = state.balance === 0;

  if (!isSettled)
    return {
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId: command.guestStayAccountId,
        groupCheckoutId: command.groupCheckoutId,
        reason: 'BalanceNotSettled',
        failedAt: command.now,
      },
    };

  return {
    type: 'GuestCheckedOut',
    data: {
      guestStayAccountId: command.guestStayAccountId,
      groupCheckoutId: command.groupCheckoutId,
      checkedOutAt: command.now,
    },
  };
};

export const decide = (
  command: GuestStayAccountCommand,
  state: GuestStayAccount,
): GuestStayAccountEvent[] => {
  const { type } = command;
  switch (type) {
    case 'CheckInGuest':
      return [checkInGuest(command, state)];
    case 'RecordCharge':
      return [recordCharge(command, state)];
    case 'RecordPayment':
      return [recordPayment(command, state)];
    case 'CheckoutGuest':
      return [checkoutGuest(command, state)];
    default: {
      const _exhaustiveCheck: never = type;
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Command ${type} is not supported in the GuestStayAccount`,
      );
    }
  }
};
