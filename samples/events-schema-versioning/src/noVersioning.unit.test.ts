import { EventStore } from './core/eventStore';
import {
  OrderCompleted,
  OrderEvent,
  OrderInitialised,
  OrderPaymentRecorded,
} from './orders/events';

describe('No Event Schema Versioning', () => {
  it('should return compatible object', () => {
    const orderId = 'ORDER-1';
    const events: (
      | OrderInitialised
      | OrderPaymentRecorded
      | OrderCompleted
    )[] = [
      {
        type: 'order-initialised',
        data: {
          orderId,
          clientId: 'CLIENT-1',
          productItems: [
            { productId: 'PRODUCT-1', quantity: 10, unitPrice: 12 },
            { productId: 'PRODUCT-2', quantity: 5, unitPrice: 10 },
          ],
          totalAmount: 170,
          initialisedAt: new Date(),
        },
      },
      {
        type: 'order-payment-recorded',
        data: {
          orderId,
          paymentId: 'PAYMENT-1',
          paymentRecordedAt: new Date(),
        },
      },
      {
        type: 'order-confirmed',
        data: {
          orderId,
          completedAt: new Date(),
        },
      },
    ];

    const eventStore = new EventStore();
    eventStore.appendToStream(orderId, ...events);

    const eventsFromStore = eventStore.readFromStream<OrderEvent>(orderId);

    expect(eventsFromStore).toBeDefined();

    expect(eventsFromStore).not.toBe([]);

    expect(eventsFromStore).toMatchObject(events);
  });
});
