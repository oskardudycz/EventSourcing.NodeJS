export type GuestCheckedIn = {
  type: 'GuestCheckedIn';
  data: {
    guestStayAccountId: string;
    guestId: string;
    roomId: string;
    checkedInAt: Date;
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
    checkedOutAt: Date;
    groupCheckoutId?: string;
  };
};
export type GuestCheckoutFailed = {
  type: 'GuestCheckoutFailed';
  data: {
    guestStayAccountId: string;
    reason: 'NotCheckedIn' | 'BalanceNotSettled';
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
      status: 'CheckedIn';
      balance: number;
    }
  | { status: 'CheckedOut' };

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
        status: 'CheckedIn',
        balance: 0,
      };
    case 'ChargeRecorded':
      if (state.status !== 'CheckedIn') {
        return state;
      }
      return {
        ...state,
        balance: state.balance + event.amount,
      };
    case 'PaymentRecorded':
      if (state.status !== 'CheckedIn') {
        return state;
      }
      return {
        ...state,
        balance: state.balance - event.amount,
      };
    case 'GuestCheckedOut':
      if (state.status !== 'CheckedIn') {
        return state;
      }
      return { status: 'CheckedOut' };
    case 'GuestCheckoutFailed': {
      return state;
    }
    default: {
      const _exhaustiveCheck: never = type;
      return state;
    }
  }
};
