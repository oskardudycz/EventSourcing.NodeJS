export type FailureReason = 'InvalidState' | 'BalanceNotSettled';

export type GuestStayAccountEvent =
  | {
      type: 'GuestCheckedIn';
      data: {
        guestStayAccountId: string;
        openedAt: Date;
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
        completedAt: Date;
        groupCheckoutId?: string;
      };
    }
  | {
      type: 'GuestCheckoutFailed';
      data: {
        guestStayAccountId: string;
        reason: FailureReason;
        failedAt: Date;
        groupCheckoutId?: string;
      };
    };
