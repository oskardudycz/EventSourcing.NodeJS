export type GuestCheckedIn = {
  type: 'GuestCheckedIn';
  data: {
    guestStayAccountId: string;
    openedAt: Date;
  };
};
export type ChargeRecorded = {
  type: 'ChargeRecorded';
  data: {
    chargeId: string;
    guestStayAccountId: string;
    amount: number;
    recordedAt: Date;
  };
};
export type PaymentRecorded = {
  type: 'PaymentRecorded';
  data: {
    paymentId: string;
    guestStayAccountId: string;
    amount: number;
    recordedAt: Date;
  };
};
export type GuestCheckedOut = {
  type: 'GuestCheckedOut';
  data: {
    guestStayAccountId: string;
    completedAt: Date;
    groupCheckoutId?: string;
  };
};
export type FailureReason = 'InvalidState' | 'BalanceNotSettled';

export type GuestCheckoutFailed = {
  type: 'GuestCheckoutFailed';
  data: {
    guestStayAccountId: string;
    reason: FailureReason;
    failedAt: Date;
    groupCheckoutId?: string;
  };
};

export type GuestStayAccountEvent =
  | GuestCheckedIn
  | ChargeRecorded
  | PaymentRecorded
  | GuestCheckedOut
  | GuestCheckoutFailed;

export type GuestStayAccount =
  | { status: 'NotExisting' }
  | {
      status: 'Open';
      balance: number;
      recordedChargeIds: string[];
      recordedPaymentIds: string[];
    }
  | { status: 'CheckedOut'; groupCheckoutId?: string | undefined };

export type GuestStayAccountStatus = GuestStayAccount['status'];

export const initial: GuestStayAccount = {
  status: 'NotExisting',
};

export const evolve = (
  state: GuestStayAccount,
  { type, data: event }: GuestStayAccountEvent,
): GuestStayAccount => {
  switch (type) {
    case 'GuestCheckedIn':
      return {
        status: 'Open',
        balance: 0,
        recordedChargeIds: [],
        recordedPaymentIds: [],
      };
    case 'ChargeRecorded':
      if (state.status !== 'Open') {
        return state;
      }
      return {
        ...state,
        balance: state.balance + event.amount,
        recordedChargeIds: [...state.recordedChargeIds, event.chargeId],
      };
    case 'PaymentRecorded':
      if (state.status !== 'Open') {
        return state;
      }
      return {
        ...state,
        balance: state.balance - event.amount,
        recordedPaymentIds: [...state.recordedPaymentIds, event.paymentId],
      };
    case 'GuestCheckedOut':
      if (state.status !== 'Open') {
        return state;
      }
      return { status: 'CheckedOut', groupCheckoutId: event.groupCheckoutId };
    case 'GuestCheckoutFailed': {
      return state;
    }
    default: {
      const _exhaustiveCheck: never = type;
      return state;
    }
  }
};
