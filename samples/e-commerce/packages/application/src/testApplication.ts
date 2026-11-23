import {
  action,
  ApiE2ESpecification,
  type ActionStep,
  manualClock,
  removeSQLiteFiles,
  temporarySQLiteFilePath,
} from '@e-commerce/core';
import type { Message } from '@event-driven-io/emmett';
import { createApplication, type ApplicationMessage } from './application';
import {
  conflictingEventStore,
  type ConflictingEventStore,
} from './conflictingEventStore';
import { createEventStore } from './eventStore';
import type { MessagingBus } from './messagingBus';
import { changeablePrices } from './shoppingCarts/pricing/changeablePrices';

export const messagingBuses: MessagingBus[] = ['in-memory', 'none'];

const publishedTypes: string[] = [
  'shopping_carts.external.ShoppingCartCheckedOut',
];

export const testApplication = (messagingBus: MessagingBus = 'in-memory') => {
  const prices = changeablePrices();
  const clock = manualClock(new Date('2026-01-01T10:00:00.000Z'));
  let fileName = '';
  let eventStoreInUse: ConflictingEventStore | undefined;

  const given = ApiE2ESpecification.for({
    getEventStore: () => {
      fileName = temporarySQLiteFilePath();
      eventStoreInUse = conflictingEventStore(createEventStore(fileName));
      return eventStoreInUse;
    },
    getApplication: (eventStore) => {
      const file = fileName;
      const application = createApplication({
        eventStore,
        fileName: file,
        messagingBus,
        prices,
        now: clock.now,
        messagingRetry: { minTimeout: 5, maxTimeout: 50 },
      });
      const published: Message[] = [];
      let seen = 0;

      application.consumer.reactor<ApplicationMessage>({
        processorId: 'test:published',
        eachMessage: ({ type, data }) => {
          seen++;
          if (publishedTypes.includes(type)) published.push({ type, data });
        },
      });

      return {
        fetch: application.fetch,
        start: application.start,
        stop: async () => {
          await application.stop();
          await removeSQLiteFiles(file);
        },
        catchUp: async () => {
          const seenBefore = seen;
          await application.consumer.whenCaughtUp({ timeout: 10_000 });
          return seen !== seenBefore;
        },
        clock,
        published: () => published,
      };
    },
  });

  const priceOf = (productId: string, unitPrice: number): ActionStep =>
    action(() => prices.setPriceOf(productId, unitPrice));

  const appendsConflict = (count: number): ActionStep =>
    action(() => eventStoreInUse?.conflictsOnTheNextAppends(count));

  return { given, prices, clock, priceOf, appendsConflict };
};
