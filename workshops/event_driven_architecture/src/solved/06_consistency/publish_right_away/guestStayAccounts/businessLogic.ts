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

export type CheckOutGuest = {
  type: 'CheckOutGuest';
  data: {
    guestStayAccountId: string;
    now: Date;
    groupCheckoutId?: string | undefined;
  };
};

export type GuestStayAccountCommand =
  CheckInGuest | RecordCharge | RecordPayment | CheckOutGuest;

export const checkInGuest = (
  { data: command }: CheckInGuest,
  state: GuestStayAccount,
): GuestCheckedIn => {
  if (state.status !== 'NotExisting')
    throw Error('Guest is already checked-in!');

  return {
    type: 'GuestCheckedIn',
    data: {
      guestStayAccountId: command.guestStayAccountId,
      openedAt: command.now,
    },
  };
};

export const recordCharge = (
  { data: command }: RecordCharge,
  state: GuestStayAccount,
): ChargeRecorded => {
  if (state.status !== 'Open')
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
  if (state.status !== 'Open')
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

export const checkOutGuest = (
  { data: command }: CheckOutGuest,
  state: GuestStayAccount,
): GuestCheckedOut | GuestCheckoutFailed => {
  if (state.status !== 'Open')
    return {
      type: 'GuestCheckoutFailed',
      data: {
        guestStayAccountId: command.guestStayAccountId,
        groupCheckoutId: command.groupCheckoutId,
        reason: 'InvalidState',
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
      completedAt: command.now,
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
    case 'CheckOutGuest':
      return [checkOutGuest(command, state)];
    default: {
      const _exhaustiveCheck: never = type;
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Command ${type} is not supported in the GuestStayAccount`,
      );
    }
  }
};
