import {
  appendToChannelStream,
  deadLetterStreamName,
  manualClock,
  removeSQLiteFolder,
  temporarySQLiteFolder,
} from '@e-commerce/core';
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createApplication } from './application';
import { failsOnEmmett } from './knownFailures';
import { deliverFromOutsideWorld } from './testApplication';
import { until } from './testInfrastructure';
import { createModuleStores } from './eventStore';
import type { MessagingBus } from './messagingBus';
import { OrderId } from './orders/order';
import { isOrderEvent } from './orders/orderWorkflow';
import { ordersSubscriptions } from './orders/ordersConfig';
import { PaymentId } from './payments/payment';
import { paymentProvider } from './payments/paymentProvider';
import { ShipmentId } from './shipments/shipment';
import { warehouse } from './shipments/warehouse';
import type { PaymentExternalEvent } from './payments/external/paymentExternalEvent';
import type { ShoppingCartCheckedOutExternal } from './shoppingCarts/external/shoppingCartExternalEvent';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';

const failedAt = '2026-01-01T10:00:00.000Z';
const eightDaysLater = new Date('2026-01-09T10:00:00.000Z');

const runApplication = async (
  messagingBus: MessagingBus,
  { workers }: { workers: boolean },
) => {
  const folder = temporarySQLiteFolder();
  const stores = createModuleStores({ type: 'sqlite', folder }, messagingBus, {
    pullingFrequencyInMs: 20,
    batchSize: 1,
  });
  const stock = warehouse();
  const application = createApplication(
    {
      stores,
      paymentGateway: paymentProvider(),
      warehouse: stock,
      now: manualClock(eightDaysLater).now,
      ...(workers ? { workers: { intervalInMs: 20 } } : {}),
    },
    { modules: ['shopping_carts', 'orders'] },
  );

  await application.start();

  const customerId = crypto.randomUUID();
  const cartId = ShoppingCartId.of(customerId, 1);
  const orderId = OrderId.derivedFrom(cartId);
  const paymentId = PaymentId.derivedFrom(orderId);
  const checkedOut: ShoppingCartCheckedOutExternal = {
    type: 'shopping_carts.external.ShoppingCartCheckedOut',
    data: {
      cartId,
      customerId,
      productItems: [
        { productId: crypto.randomUUID(), quantity: 1, unitPrice: 10 },
      ],
      totalPrice: 10,
      checkedOutAt: failedAt,
    },
  };
  const paymentFailed: PaymentExternalEvent = {
    type: 'payments.external.PaymentFailed',
    data: { referenceId: orderId, paymentId, failedAt },
  };
  await deliverFromOutsideWorld(stores, checkedOut);
  await Promise.all(
    application.consumers.map((consumer) =>
      consumer.whenCaughtUp({ timeout: 10_000 }),
    ),
  );
  await deliverFromOutsideWorld(stores, paymentFailed);

  const workflowMessages = async () =>
    (
      await stores.orders.store.readStream(
        OrderId.workflowStreamNameOf(orderId),
      )
    ).events;
  const orderEvents = async () =>
    (await workflowMessages()).filter(isOrderEvent);

  const files = () => readdirSync(folder).sort();

  const stop = async () => {
    await application.stop();
    await removeSQLiteFolder(folder);
  };

  return {
    orderEvents,
    workflowMessages,
    files,
    stores,
    orderId,
    paymentId,
    stop,
  };
};

const hasOrderEvent =
  (orderEvents: () => Promise<{ type: string }[]>, type: string) =>
  async () =>
    (await orderEvents()).some((event) => event.type === type);

describe('application workers', () => {
  failsOnEmmett('#432')(
    'anApplicationWithWorkersClosesAnOverdueUnpaidOrder',
    async (signal) => {
      const { orderEvents, stop } = await runApplication('none', {
        workers: true,
      });

      signal.addEventListener('abort', () => void stop());

      try {
        await until(hasOrderEvent(orderEvents, 'orders.OrderCanceled'), 15_000);

        expect((await orderEvents()).map(({ type }) => type)).toContain(
          'orders.OrderCanceled',
        );
      } finally {
        await stop();
      }
    },
  );

  it('anApplicationWithoutWorkersLeavesAnOverdueUnpaidOrderOpen', async () => {
    const { orderEvents, stop } = await runApplication('none', {
      workers: false,
    });

    try {
      await until(hasOrderEvent(orderEvents, 'orders.OrderPaymentFailed'), 15_000);
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect((await orderEvents()).map(({ type }) => type)).not.toContain(
        'orders.OrderCanceled',
      );
    } finally {
      await stop();
    }
  });
});

describe('module databases', () => {
  it.each<[MessagingBus, string[]]>([
    [
      'in-memory',
      [
        'broker.db',
        'orders.db',
        'payments.db',
        'shipments.db',
        'shopping_carts.db',
      ],
    ],
    ['none', ['orders.db', 'payments.db', 'shipments.db', 'shopping_carts.db']],
  ])(
    'anApplicationOnMessagingBus_%s_HasADatabasePerModuleAndOnlyTheBrokerItNeeds',
    async (messagingBus, expected) => {
      const { files, stop } = await runApplication(messagingBus, {
        workers: false,
      });

      try {
        expect(files().filter((file) => file.endsWith('.db'))).toEqual(
          expected,
        );
      } finally {
        await stop();
      }
    },
  );
});

describe.each<MessagingBus>(['in-memory', 'none'])(
  'dead letters on MESSAGING_BUS=%s',
  (messagingBus) => {
    it('aDeadLetteredExternalEventIsNotAnInputOfTheOrderWorkflow', async () => {
      const { orderEvents, stores, orderId, stop } = await runApplication(
        messagingBus,
        { workers: false },
      );

      try {
        await until(async () => (await orderEvents()).length > 0, 15_000);
        await appendToChannelStream(
          stores.orders.store,
          deadLetterStreamName(ordersSubscriptions.shipmentsResponses.queue),
          {
            type: 'shipments.external.StockReserved',
            data: {
              referenceId: orderId,
              shipmentId: ShipmentId.derivedFrom(orderId),
              reservedAt: failedAt,
            },
            metadata: { messageId: crypto.randomUUID() },
          },
          undefined,
        );
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect((await orderEvents()).map(({ type }) => type)).not.toContain(
          'orders.OrderStockReserved',
        );
      } finally {
        await stop();
      }
    });
  },
);

describe.each<MessagingBus>(['in-memory', 'none'])(
  'handling a command on MESSAGING_BUS=%s',
  (messagingBus) => {
    it('theOrderEventsFollowTheCorrelationAndCausationOfTheHandledInput', async () => {
      const { orderEvents, workflowMessages, stop } = await runApplication(
        messagingBus,
        { workers: false },
      );

      try {
        await until(async () => (await orderEvents()).length > 0, 15_000);
        const [placed] = await orderEvents();
        const checkout = (await workflowMessages()).find(
          ({ type }) =>
            type === 'orders:shopping_carts.external.ShoppingCartCheckedOut',
        );

        expect(checkout?.metadata.messageId).toBeDefined();
        expect(placed?.metadata.causationId).toBe(checkout?.metadata.messageId);
        expect(placed?.metadata.correlationId).toBeDefined();
        expect(placed?.metadata.correlationId).toBe(
          checkout?.metadata.correlationId,
        );
      } finally {
        await stop();
      }
    });
  },
);
