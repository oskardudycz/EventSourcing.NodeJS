import { Command } from '#core/command';
import { Event } from '#core/event';

////////////////////////////////////////////
////////// EVENTS
///////////////////////////////////////////

export type GuestCheckedIn = Event<
  'GuestCheckedIn',
  {
    guestStayAccountId: string;
    checkedInAt: Date;
  }
>;

export type ChargeRecorded = Event<
  'ChargeRecorded',
  {
    guestStayAccountId: string;
    amount: number;
    recordedAt: Date;
  }
>;

export type PaymentRecorded = Event<
  'PaymentRecorded',
  {
    guestStayAccountId: string;
    amount: number;
    recordedAt: Date;
  }
>;
export type GuestCheckedOut = Event<
  'GuestCheckedOut',
  {
    guestStayAccountId: string;
    checkedOutAt: Date;
    groupCheckoutId?: string;
  }
>;

export type GuestCheckoutFailed = Event<
  'GuestCheckoutFailed',
  {
    guestStayAccountId: string;
    reason: 'NotOpened' | 'BalanceNotSettled';
    failedAt: Date;
    groupCheckoutId?: string;
  }
>;

export type GuestStayAccountEvent =
  | GuestCheckedIn
  | ChargeRecorded
  | PaymentRecorded
  | GuestCheckedOut
  | GuestCheckoutFailed;

////////////////////////////////////////////
////////// Entity
///////////////////////////////////////////

export type GuestStayAccount =
  | { status: 'NotExisting' }
  | {
      status: 'Opened';
      balance: number;
    }
  | { status: 'CheckedOut' };

////////////////////////////////////////////
////////// Evolve
///////////////////////////////////////////

export const evolve = (
  state: GuestStayAccount,
  { type, data: event }: GuestStayAccountEvent
): GuestStayAccount => {
  switch (type) {
    case 'GuestCheckedIn': {
      if (state.status !== 'NotExisting') return state;

      return { status: 'Opened', balance: 0 };
    }
    case 'ChargeRecorded': {
      if (state.status !== 'Opened') return state;

      return {
        ...state,
        balance: state.balance - event.amount,
      };
    }
    case 'PaymentRecorded': {
      if (state.status !== 'Opened') return state;

      return {
        ...state,
        balance: state.balance + event.amount,
      };
    }
    case 'GuestCheckedOut': {
      if (state.status !== 'Opened') return state;

      return {
        status: 'CheckedOut',
      };
    }
    case 'GuestCheckoutFailed': {
      return state;
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

export type CheckIn = Command<
  'CheckIn',
  {
    guestStayAccountId: string;
    now: Date;
  }
>;
export type RecordCharge = Command<
  'RecordCharge',
  {
    guestStayAccountId: string;
    amount: number;
    now: Date;
  }
>;
export type RecordPayment = Command<
  'RecordPayment',
  {
    guestStayAccountId: string;
    amount: number;
    now: Date;
  }
>;
export type CheckOut = Command<
  'CheckOut',
  {
    guestStayAccountId: string;
    now: Date;
    groupCheckoutId?: string;
  }
>;

export type GuestStayCommand =
  | CheckIn
  | RecordCharge
  | RecordPayment
  | CheckOut;

export const decide = (
  { type, data: command }: GuestStayCommand,
  state: GuestStayAccount
): GuestStayAccountEvent => {
  const { guestStayAccountId, now } = command;

  switch (type) {
    case 'CheckIn': {
      if (state.status !== 'NotExisting')
        throw Error('Guest is already checked-in!');

      return {
        type: 'GuestCheckedIn',
        data: {
          guestStayAccountId,
          checkedInAt: now,
        },
      };
    }
    case 'RecordCharge': {
      if (state.status !== 'Opened')
        throw Error('Guest account is already checked out!');

      return {
        type: 'ChargeRecorded',
        data: {
          guestStayAccountId,
          amount: command.amount,
          recordedAt: now,
        },
      };
    }
    case 'RecordPayment': {
      if (state.status !== 'Opened')
        throw Error('Guest account is already checked out!');

      return {
        type: 'PaymentRecorded',
        data: {
          guestStayAccountId,
          amount: command.amount,
          recordedAt: now,
        },
      };
    }
    case 'CheckOut': {
      if (state.status !== 'Opened')
        return {
          type: 'GuestCheckoutFailed',
          data: {
            guestStayAccountId,
            groupCheckoutId: command.groupCheckoutId,
            reason: 'NotOpened',
            failedAt: now,
          },
        };

      const isSettled = state.balance === 0;

      if (!isSettled)
        return {
          type: 'GuestCheckoutFailed',
          data: {
            guestStayAccountId,
            groupCheckoutId: command.groupCheckoutId,
            reason: 'BalanceNotSettled',
            failedAt: now,
          },
        };

      return {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId,
          groupCheckoutId: command.groupCheckoutId,
          checkedOutAt: now,
        },
      };
    }

    default: {
      const _notExistingCommandType: never = type;
      throw new Error(`Unknown command type`);
    }
  }
};
