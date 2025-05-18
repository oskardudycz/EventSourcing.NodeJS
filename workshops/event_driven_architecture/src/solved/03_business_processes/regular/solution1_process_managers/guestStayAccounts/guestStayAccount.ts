import type { GuestStayAccountEvent } from '../../solution2_immutableEntities/guestStayAccounts';
import { Aggregate } from '../core';

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

export type GuestStayAccountStatus = 'NotExisting' | 'CheckedIn' | 'CheckedOut';

export class GuestStayAccount extends Aggregate<GuestStayAccountEvent> {
  private guestStayAccountId: string = undefined!;
  private status = 'NotExisting' satisfies GuestStayAccountStatus;
  private balance: number = 0;

  private constructor() {
    super();
  }

  static checkInGuest = (data: {
    guestId: string;
    roomId: string;
    guestStayAccountId: string;
    now: Date;
  }): GuestStayAccount => {
    const account = new GuestStayAccount();

    account.enqueue({
      type: 'GuestCheckedIn',
      data: {
        guestId: data.guestId,
        roomId: data.roomId,
        guestStayAccountId: data.guestStayAccountId,
        checkedInAt: data.now,
      },
    });

    return account;
  };

  recordCharge = (data: {
    chargeId: string;
    guestStayAccountId: string;
    amount: number;
    now: Date;
  }): void => {
    if (this.status !== 'CheckedIn')
      throw Error('Guest account is already checked out!');

    this.enqueue({
      type: 'ChargeRecorded',
      data: {
        guestStayAccountId: this.guestStayAccountId,
        chargeId: data.chargeId,
        amount: data.amount,
        recordedAt: data.now,
      },
    });
  };

  recordPayment = (data: {
    paymentId: string;
    guestStayAccountId: string;
    amount: number;
    now: Date;
  }): void => {
    if (this.status !== 'CheckedIn')
      throw Error('Guest account is already checked out!');

    this.enqueue({
      type: 'PaymentRecorded',
      data: {
        guestStayAccountId: this.guestStayAccountId,
        paymentId: data.paymentId,
        amount: data.amount,
        recordedAt: data.now,
      },
    });
  };

  checkoutGuest = (data: {
    groupCheckoutId?: string | undefined;
    now: Date;
  }): void => {
    if (this.status !== 'CheckedIn') {
      this.enqueue({
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: this.guestStayAccountId,
          groupCheckoutId: data.groupCheckoutId,
          reason: 'NotCheckedIn',
          failedAt: data.now,
        },
      });
      return;
    }

    const isSettled = this.balance === 0;

    this.enqueue(
      !isSettled
        ? {
            type: 'GuestCheckoutFailed',
            data: {
              guestStayAccountId: this.guestStayAccountId,
              groupCheckoutId: data.groupCheckoutId,
              reason: 'BalanceNotSettled',
              failedAt: data.now,
            },
          }
        : {
            type: 'GuestCheckedOut',
            data: {
              guestStayAccountId: this.guestStayAccountId,
              groupCheckoutId: data.groupCheckoutId,
              checkedOutAt: data.now,
            },
          },
    );
  };

  evolve(event: GuestStayAccountEvent): void {
    switch (event.type) {
      case 'GuestCheckedIn': {
        this.guestStayAccountId = event.data.guestStayAccountId;
        this.status = 'CheckedIn';
        this.balance = 0;
        return;
      }
      case 'ChargeRecorded': {
        if (this.status !== 'CheckedIn') return;

        this.balance += event.data.amount;

        return;
      }
      case 'PaymentRecorded': {
        if (this.status !== 'CheckedIn') return;

        this.balance -= event.data.amount;

        return;
      }
      case 'GuestCheckedOut': {
        if (this.status !== 'CheckedIn') return;

        this.status = 'CheckedOut';

        return;
      }
      case 'GuestCheckoutFailed': {
        return;
      }
    }
  }
}
