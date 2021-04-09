import { EventStore } from './core/eventStore';
import { OrderEvent, OrderInitialised } from './orders/events';

describe('Event Schema Versioning', () => {
  describe('Single event schema version', () => {
    it('should return compatible object', () => {
      const orderId = 'ORDER-1';
      const orderInitialised: OrderInitialised = {
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
      };

      const eventStore = new EventStore();
      eventStore.appendToStream(orderId, [orderInitialised]);

      const eventsFromStore = eventStore.readFromStream<OrderEvent>(orderId);

      expect(eventsFromStore).toBeDefined();
      expect(eventsFromStore).not.toBe([]);

      const orderInitialisedFromStore = eventsFromStore[0];
      expect(orderInitialisedFromStore).toMatchObject(orderInitialised);
    });
  });
});
