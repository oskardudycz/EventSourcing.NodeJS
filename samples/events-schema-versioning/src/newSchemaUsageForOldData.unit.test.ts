import { EventStore } from './core/eventStore';
import {
  OrderCompleted,
  OrderEvent,
  OrderInitialised,
  OrderPaymentRecorded,
  OrderPaymentRecordedV2,
  OrderPaymentRecordedV3,
  OrderPaymentRecordedV3_1,
} from './orders/events';

describe('Event Schema Versioning', () => {
  it('should return data in old schema even if requested with new schema', () => {
    const orderId = 'ORDER-1';
    const eventWithOldSchema: OrderPaymentRecorded = {
      type: 'order-payment-recorded',
      data: {
        orderId,
        paymentId: 'PAYMENT-1',
        paymentRecordedAt: new Date(),
      },
    };

    const eventStore = new EventStore();
    eventStore.appendToStream(orderId, eventWithOldSchema);

    const eventsFromStore = eventStore.readFromStream<OrderPaymentRecordedV2>(
      orderId
    );

    expect(eventsFromStore).toBeDefined();
    expect(eventsFromStore).not.toBe([]);

    const eventWithNewSchema = eventsFromStore[0];

    // this is still the JS, so data will match what we put
    expect(eventWithNewSchema).toMatchObject(eventWithOldSchema);

    // however if we check the new schema fields then they're not mapped
    expect(eventWithNewSchema.data.recordedAt).not.toBeDefined();
    // we can still access with old schema if we try hard enough
    expect((eventWithNewSchema.data as any).paymentRecordedAt).toEqual(
      eventWithOldSchema.data.paymentRecordedAt
    );
  });

  it('should return undefined for old data even if field is marked as required', () => {
    const orderId = 'ORDER-1';
    const eventWithOldSchema: OrderPaymentRecordedV2 = {
      type: 'order-payment-recorded',
      data: {
        orderId,
        paymentId: 'PAYMENT-1',
        recordedAt: new Date(),
      },
    };

    const eventStore = new EventStore();
    eventStore.appendToStream(orderId, eventWithOldSchema);

    const eventsFromStore = eventStore.readFromStream<OrderPaymentRecordedV3>(
      orderId
    );

    expect(eventsFromStore).toBeDefined();
    expect(eventsFromStore).not.toBe([]);

    const eventWithNewSchema = eventsFromStore[0];

    // this is still the JS, so data will match what we put
    expect(eventWithNewSchema).toMatchObject(eventWithOldSchema);

    // even though type is defined as required then it's not set
    expect(eventWithNewSchema.data.gatewayId).not.toBeDefined();
  });

  it('should return undefined for old data even if field is marked as required', () => {
    const orderId = 'ORDER-1';
    const eventWithOldSchema: OrderPaymentRecordedV2 = {
      type: 'order-payment-recorded',
      data: {
        orderId,
        paymentId: 'PAYMENT-1',
        recordedAt: new Date(),
      },
    };

    const eventStore = new EventStore();
    eventStore.appendToStream(orderId, eventWithOldSchema);

    const eventsFromStore = eventStore.readFromStream<OrderPaymentRecordedV3_1>(
      orderId
    );

    expect(eventsFromStore).toBeDefined();
    expect(eventsFromStore).not.toBe([]);

    const eventWithNewSchema = eventsFromStore[0];

    // this is still the JS, so data will match what we put
    expect(eventWithNewSchema).toMatchObject(eventWithOldSchema);

    // even though type is defined as required then it's not set
    expect(eventWithNewSchema.data.gatewayId).not.toBeDefined();
  });
});
