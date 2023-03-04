////////////////////////////////////////////
////////// EVENTS
///////////////////////////////////////////

export type GuestStayAccountEvent =
  | {
      type: 'GuestCheckedIn';
      data: {
        guestStayAccountId: string;
        checkedInAt: Date;
      };
    }
  | {
      type: 'ChargeRecorded';
      data: {
        guestStayAccountId: string;
        amount: number;
        recordedAt: Date;
      };
    }
  | {
      type: 'PaymentRecorded';
      data: {
        guestStayAccountId: string;
        amount: number;
        recordedAt: Date;
      };
    }
  | {
      type: 'GuestCheckedOut';
      data: {
        guestStayAccountId: string;
        checkedOutAt: Date;
        groupCheckoutId?: string;
      };
    }
  | {
      type: 'GuestCheckoutFailed';
      data: {
        guestStayAccountId: string;
        reason: 'NotOpened' | 'BalanceNotSettled';
        failedAt: Date;
        groupCheckOutId?: string;
      };
    };

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

export type GuestStayCommand =
  | {
      type: 'CheckIn';
      data: {
        guestStayAccountId: string;
        now: Date;
      };
    }
  | {
      type: 'RecordCharge';
      data: {
        guestStayAccountId: string;
        amount: number;
        now: Date;
      };
    }
  | {
      type: 'RecordPayment';
      data: {
        guestStayAccountId: string;
        amount: number;
        now: Date;
      };
    }
  | {
      type: 'CheckOut';
      data: {
        guestStayAccountId: string;
        now: Date;
        groupCheckOutId?: string;
      };
    };

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
            groupCheckOutId: command.groupCheckOutId,
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
            groupCheckOutId: command.groupCheckOutId,
            reason: 'BalanceNotSettled',
            failedAt: now,
          },
        };

      return {
        type: 'GuestCheckedOut',
        data: {
          guestStayAccountId,
          groupCheckoutId: command.groupCheckOutId,
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
