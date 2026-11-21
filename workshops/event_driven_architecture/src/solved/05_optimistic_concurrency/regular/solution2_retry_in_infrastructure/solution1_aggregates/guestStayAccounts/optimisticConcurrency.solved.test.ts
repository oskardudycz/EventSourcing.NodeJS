import { v4 as uuid } from 'uuid';
import {
  getDatabase,
  getMessageBus,
  getMessageCatcher,
  type MessageCatcher,
} from '../../../../tools';
import { GuestStayAccountFacade } from '.';
import { beforeEach, describe, expect, it } from 'vitest';

describe('Guest Stay Account Optimistic Concurrency Tests', () => {
  it('guest checked in concurrently is checked in once', async () => {
    // Given
    const guestStayAccountId = uuid();

    // When
    await Promise.all(
      Array.from({ length: 10 }).map(() =>
        guestStayFacade.checkInGuest({
          type: 'CheckInGuest',
          data: { guestStayAccountId, now },
        }),
      ),
    );

    // Then
    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedIn',
      data: { guestStayAccountId, openedAt: now },
    });
  });

  it('charges recorded concurrently all count towards balance', async () => {
    // Given
    const guestStayAccountId = await checkInGuest();
    const amounts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    // When
    await Promise.all(
      amounts.map((amount) =>
        guestStayFacade.recordCharge({
          type: 'RecordCharge',
          data: { guestStayAccountId, chargeId: uuid(), amount, now },
        }),
      ),
    );

    // Then
    await guestStayFacade.recordPayment({
      type: 'RecordPayment',
      data: {
        guestStayAccountId,
        paymentId: uuid(),
        amount: amounts.reduce((sum, amount) => sum + amount, 0),
        now,
      },
    });
    publishedMessages.reset();

    await guestStayFacade.checkOutGuest({
      type: 'CheckOutGuest',
      data: { guestStayAccountId, now },
    });

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId,
        completedAt: now,
        groupCheckoutId: undefined,
      },
    });
  });

  it('payments recorded concurrently all count towards balance', async () => {
    // Given
    const guestStayAccountId = await checkInGuest();
    const amounts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    await guestStayFacade.recordCharge({
      type: 'RecordCharge',
      data: {
        guestStayAccountId,
        chargeId: uuid(),
        amount: amounts.reduce((sum, amount) => sum + amount, 0),
        now,
      },
    });

    // When
    await Promise.all(
      amounts.map((amount) =>
        guestStayFacade.recordPayment({
          type: 'RecordPayment',
          data: { guestStayAccountId, paymentId: uuid(), amount, now },
        }),
      ),
    );

    // Then
    publishedMessages.reset();

    await guestStayFacade.checkOutGuest({
      type: 'CheckOutGuest',
      data: { guestStayAccountId, now },
    });

    publishedMessages.shouldReceiveSingleMessage({
      type: 'GuestCheckedOut',
      data: {
        guestStayAccountId,
        completedAt: now,
        groupCheckoutId: undefined,
      },
    });
  });

  it('charge recorded concurrently with checkout does not let guest check out with unsettled balance', async () => {
    // Given
    const guestStayAccountIds: string[] = [];
    for (let i = 0; i < 10; i++) guestStayAccountIds.push(await checkInGuest());

    // When
    await Promise.all(
      guestStayAccountIds
        .flatMap((guestStayAccountId) => [
          guestStayFacade.checkOutGuest({
            type: 'CheckOutGuest',
            data: { guestStayAccountId, now },
          }),
          guestStayFacade.recordCharge({
            type: 'RecordCharge',
            data: { guestStayAccountId, chargeId: uuid(), amount: 100, now },
          }),
        ])
        .map(ignoringPlainErrors),
    );

    // Then
    const checkedOutBeforeCharge = ['GuestCheckedOut'];
    const chargedBeforeCheckout = ['ChargeRecorded', 'GuestCheckoutFailed'];
    for (const guestStayAccountId of guestStayAccountIds) {
      const publishedTypes = publishedMessages.published
        .filter(({ data }) => data.guestStayAccountId === guestStayAccountId)
        .map(({ type }) => type)
        .sort();

      expect([checkedOutBeforeCharge, chargedBeforeCheckout]).toContainEqual(
        publishedTypes,
      );
    }
  });

  let publishedMessages: MessageCatcher;
  let guestStayFacade: GuestStayAccountFacade;
  let now: Date;

  beforeEach(() => {
    const database = getDatabase();
    const messageBus = getMessageBus();
    publishedMessages = getMessageCatcher();
    guestStayFacade = GuestStayAccountFacade({ database, messageBus });
    now = new Date();

    messageBus.use(publishedMessages.catchMessage);
  });

  const ignoringPlainErrors = (call: Promise<unknown>) =>
    call.catch((error: unknown) => {
      if (!(error instanceof Error) || error.constructor !== Error) throw error;
    });

  const checkInGuest = async () => {
    const guestStayAccountId = uuid();
    await guestStayFacade.checkInGuest({
      type: 'CheckInGuest',
      data: { guestStayAccountId, now },
    });
    publishedMessages.reset();

    return guestStayAccountId;
  };
});
