export type GuestStayAccountEvent =
  | {
      type: 'GuestCheckedIn';
      data: {
        guestStayAccountId: string;
        guestId: string;
        roomId: string;
        checkedInAt: Date;
      };
    }
  | {
      type: 'ChargeRecorded';
      data: {
        chargeId: string;
        guestStayAccountId: string;
        amount: number;
        recordedAt: Date;
      };
    }
  | {
      type: 'PaymentRecorded';
      data: {
        paymentId: string;
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
        reason: 'NotCheckedIn' | 'BalanceNotSettled';
        failedAt: Date;
        groupCheckoutId?: string;
      };
    };
