import { Aggregate } from '../core';

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

export type GuestStayAccountStatus = 'NotExisting' | 'Open' | 'CheckedOut';

export class GuestStayAccount extends Aggregate<GuestStayAccountEvent> {
  private guestStayAccountId: string = undefined!;
  private status: GuestStayAccountStatus = 'NotExisting';
  private balance: number = 0;

  // Public constructor without parameters, used when loading from the database
  constructor() {
    super();
  }

  static checkIn(data: {
    guestStayAccountId: string;
    now: Date;
  }): GuestStayAccount {
    const account = new GuestStayAccount();

    account.enqueue({
      type: 'GuestCheckedIn',
      data: {
        guestStayAccountId: data.guestStayAccountId,
        openedAt: data.now,
      },
    });

    return account;
  }

  recordCharge(data: {
    chargeId: string;
    guestStayAccountId: string;
    amount: number;
    now: Date;
  }): void {
    if (this.status !== 'Open')
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
  }

  recordPayment(data: {
    paymentId: string;
    guestStayAccountId: string;
    amount: number;
    now: Date;
  }): void {
    if (this.status !== 'Open')
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
  }

  checkout(data: { groupCheckoutId?: string | undefined; now: Date }): void {
    if (this.status !== 'Open') {
      this.enqueue({
        type: 'GuestCheckoutFailed',
        data: {
          guestStayAccountId: this.guestStayAccountId,
          groupCheckoutId: data.groupCheckoutId,
          reason: 'InvalidState',
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
              completedAt: data.now,
            },
          },
    );
  }

  evolve(event: GuestStayAccountEvent): void {
    switch (event.type) {
      case 'GuestCheckedIn': {
        this.guestStayAccountId = event.data.guestStayAccountId;
        this.status = 'Open';
        this.balance = 0;
        return;
      }
      case 'ChargeRecorded': {
        if (this.status !== 'Open') return;

        this.balance += event.data.amount;
        return;
      }
      case 'PaymentRecorded': {
        if (this.status !== 'Open') return;

        this.balance -= event.data.amount;
        return;
      }
      case 'GuestCheckedOut': {
        if (this.status !== 'Open') return;

        this.status = 'CheckedOut';
        return;
      }
      case 'GuestCheckoutFailed': {
        return;
      }
    }
  }
}
