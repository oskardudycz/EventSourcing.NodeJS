import {
  externalMessageId,
  kafkaProducer,
  rabbitMQConfirmChannel,
  routedSender,
  sendingToKafka,
  sendingToRabbitMQ,
  type SendToChannel,
} from '@e-commerce/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApplication } from './buildApplication';
import { paymentProvider } from './payments/paymentProvider';
import { readSettings } from './settings';
import { warehouse } from './shipments/warehouse';
import { OrderId } from './orders/order';
import { isOrderEvent, orderWorkflowInbox } from './orders/orderWorkflow';
import type { PaymentExternalEvent } from './payments/external/paymentExternalEvent';
import { PaymentId } from './payments/payment';
import {
  paymentsChannels,
  paymentsResponseRoutes,
} from './payments/paymentsConfig';
import { ShipmentId } from './shipments/shipment';
import type { ShoppingCartCheckedOutExternal } from './shoppingCarts/external/shoppingCartExternalEvent';
import { carts } from './shoppingCarts/getCart/carts';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import {
  startKafka,
  startPostgreSQL,
  startRabbitMQ,
  until,
} from './testInfrastructure';

type Environment = Record<string, string>;

const runningOn = (environment: Environment) =>
  buildApplication(
    readSettings({ ...environment, WORKERS_SCHEDULED: 'false' }),
    {
      paymentGateway: paymentProvider(),
      warehouse: warehouse(),
      pulling: { pullingFrequencyInMs: 20, batchSize: 1 },
    },
  );

type Brokers = {
  kafka: Awaited<ReturnType<typeof startKafka>>;
  rabbitMQ: Awaited<ReturnType<typeof startRabbitMQ>>;
};

const environmentOf = ({
  messagingBus,
  eventStoreType,
  postgreSQL,
  brokers,
}: {
  messagingBus: string;
  eventStoreType: string;
  postgreSQL: { connectionString: string };
  brokers: Brokers;
}): Environment => ({
  MESSAGING_BUS: messagingBus,
  EVENTSTORE_TYPE: eventStoreType,
  POSTGRESQL_URL: postgreSQL.connectionString,
  KAFKA_BOOTSTRAP_SERVERS: brokers.kafka.connection.bootstrapBrokers.join(','),
  RABBITMQ_URL: brokers.rabbitMQ.connection.url,
});

const sendingToTheBroker = (
  messagingBus: string,
  { kafka, rabbitMQ }: Brokers,
): { send: SendToChannel; close: () => Promise<void> } => {
  if (messagingBus === 'kafka') {
    const producer = kafkaProducer({ connection: kafka.connection });

    return { send: sendingToKafka(producer), close: () => producer.close() };
  }

  const confirmChannel = rabbitMQConfirmChannel({
    connection: rabbitMQ.connection,
  });

  return {
    send: sendingToRabbitMQ({ confirmChannel }),
    close: () => confirmChannel.close(),
  };
};

type Fetching = {
  fetch: (request: Request) => Response | Promise<Response>;
};

const customerSteps = (customerId: string) => {
  const cartUrl = `http://localhost/customers/${customerId}/shopping-carts/current`;
  const cartId = ShoppingCartId.of(customerId, 1);

  return {
    cartId,
    orderId: OrderId.derivedFrom(cartId),
    addProduct: (application: Fetching) =>
      application.fetch(
        new Request(`${cartUrl}/product-items`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productId: crypto.randomUUID(), quantity: 2 }),
        }),
      ),
    checkOut: (application: Fetching) =>
      application.fetch(
        new Request(`${cartUrl}/checkout`, {
          method: 'POST',
          headers: { 'if-match': 'W/"1"' },
        }),
      ),
  };
};

const checkedOutCartOf = (
  customerId: string,
): ShoppingCartCheckedOutExternal => ({
  type: 'shopping_carts.external.ShoppingCartCheckedOut',
  data: {
    cartId: ShoppingCartId.of(customerId, 1),
    customerId,
    productItems: [
      { productId: crypto.randomUUID(), quantity: 1, unitPrice: 10 },
    ],
    totalPrice: 10,
    checkedOutAt: new Date().toISOString(),
  },
});

type Running = ReturnType<typeof runningOn>;

const streamTypes = async (
  database: Running['stores']['orders'],
  streamName: string,
) =>
  (await database.store.readStream(streamName)).events.map(({ type }) => type);

describe('PostgreSQL', () => {
  let postgreSQL: Awaited<ReturnType<typeof startPostgreSQL>>;

  beforeAll(async () => {
    postgreSQL = await startPostgreSQL();
  });

  afterAll(async () => {
    await postgreSQL.stop();
  });

  it('postgreSQLInlineProjectionsAreConsistentWithTheAppend', async () => {
    const built = runningOn({
      MESSAGING_BUS: 'in-memory',
      EVENTSTORE_TYPE: 'postgresql',
      POSTGRESQL_URL: postgreSQL.connectionString,
    });
    const customerId = crypto.randomUUID();
    const customer = customerSteps(customerId);
    await built.start();

    const added = await customer.addProduct(built.application);
    const cart = await carts(built.stores.shoppingCarts.pongo()).get(
      customer.cartId,
    );
    await built.stop();

    expect(added.status).toBe(200);
    expect(cart).toMatchObject({ lines: [{ quantity: 2 }] });
  });

  it('anApplicationStartedOnTheDatabaseOfAStoppedOneProcessesNewCarts', async () => {
    const environment = {
      MESSAGING_BUS: 'in-memory',
      EVENTSTORE_TYPE: 'postgresql',
      POSTGRESQL_URL: postgreSQL.connectionString,
    };
    const first = runningOn(environment);
    const earlier = customerSteps(crypto.randomUUID());
    await first.start();
    await earlier.addProduct(first.application);
    await earlier.checkOut(first.application);
    await until(
      async () =>
        (
          await streamTypes(
            first.stores.orders,
            OrderId.workflowStreamNameOf(earlier.orderId),
          )
        ).includes('orders.OrderPlaced'),
      30_000,
    );
    await first.stop();
    const second = runningOn(environment);
    const customer = customerSteps(crypto.randomUUID());
    await second.start();

    await customer.addProduct(second.application);
    await customer.checkOut(second.application);

    await until(
      async () =>
        (
          await streamTypes(
            second.stores.orders,
            OrderId.workflowStreamNameOf(customer.orderId),
          )
        ).includes('orders.OrderPlaced'),
      30_000,
    );
    await second.stop();
  }, 60_000);
});

describe.each([
  ['kafka', 'postgresql'],
  ['rabbitmq', 'postgresql'],
  ['kafka', 'sqlite'],
  ['rabbitmq', 'sqlite'],
])(
  'MESSAGING_BUS=%s with EVENTSTORE_TYPE=%s',
  (messagingBus, eventStoreType) => {
    let postgreSQL: Awaited<ReturnType<typeof startPostgreSQL>>;
    let brokers: Brokers;

    beforeAll(async () => {
      brokers = { kafka: await startKafka(), rabbitMQ: await startRabbitMQ() };
      postgreSQL = await startPostgreSQL();
    }, 120_000);

    afterAll(async () => {
      await brokers.kafka.stop();
      await brokers.rabbitMQ.stop();
      await postgreSQL.stop();
    });

    const environment = (database = postgreSQL) =>
      environmentOf({
        messagingBus,
        eventStoreType,
        postgreSQL: database,
        brokers,
      });

    it('aCheckedOutCartBecomesAnOrderThroughTheBroker', async () => {
      const built = runningOn(environment());
      const customerId = crypto.randomUUID();
      const customer = customerSteps(customerId);
      await built.start();

      await customer.addProduct(built.application);
      await customer.checkOut(built.application);

      const orderEvents = async () =>
        (
          await built.stores.orders.store.readStream(
            OrderId.workflowStreamNameOf(customer.orderId),
          )
        ).events.filter(isOrderEvent);
      await until(async () => (await orderEvents()).length > 0, 60_000);
      const events = await orderEvents();
      const workflowStream = (
        await built.stores.orders.store.readStream(
          OrderId.workflowStreamNameOf(customer.orderId),
        )
      ).events;
      const cartEvents = (
        await built.stores.shoppingCarts.store.readStream(
          ShoppingCartId.streamNameOf(customer.cartId),
        )
      ).events;
      await built.stop();

      const placed = events.find(({ type }) => type === 'orders.OrderPlaced');
      const checkedOut = cartEvents.find(
        ({ type }) => type === 'shopping_carts.ShoppingCartCheckedOut',
      );
      const forwardedId = externalMessageId(
        checkedOut?.metadata.messageId ?? '',
        'shopping_carts.external.ShoppingCartCheckedOut',
      );
      const handled = workflowStream.find(
        ({ metadata }) =>
          'originalMessageId' in metadata &&
          metadata.originalMessageId === forwardedId,
      );
      expect(checkedOut?.metadata.correlationId).toBeTruthy();
      expect(handled?.metadata.correlationId).toBe(
        checkedOut?.metadata.correlationId,
      );
      expect(placed?.metadata).toMatchObject({
        correlationId: checkedOut?.metadata.correlationId,
        causationId: handled?.metadata.messageId,
      });
    }, 120_000);

    it('anOrderAsksPaymentsAndShipmentsAndHearsPaymentThroughTheQueueBoundToItsKey', async () => {
      const built = runningOn(environment());
      const sender = sendingToTheBroker(messagingBus, brokers);
      const customerId = crypto.randomUUID();
      const { orderId } = customerSteps(customerId);
      const paymentId = PaymentId.derivedFrom(orderId);
      const shipmentId = ShipmentId.derivedFrom(orderId);
      const respond = routedSender<PaymentExternalEvent>(
        sender.send,
        [paymentsResponseRoutes],
        paymentsChannels,
      );
      await built.start();

      await orderWorkflowInbox(() => new Date())(
        built.stores.orders.store,
        checkedOutCartOf(customerId),
      );
      await until(
        async () =>
          (
            await streamTypes(
              built.stores.payments,
              PaymentId.workflowStreamNameOf(paymentId),
            )
          ).includes('payments.PaymentAuthorizationRequested') &&
          (
            await streamTypes(
              built.stores.shipments,
              ShipmentId.workflowStreamNameOf(shipmentId),
            )
          ).includes('shipments.StockReserved'),
        60_000,
      );
      await respond({
        type: 'payments.external.PaymentFailed',
        data: {
          referenceId: orderId,
          paymentId,
          failedAt: new Date().toISOString(),
        },
        metadata: { messageId: crypto.randomUUID() },
      });
      await until(
        async () =>
          (
            await streamTypes(
              built.stores.orders,
              OrderId.workflowStreamNameOf(orderId),
            )
          ).includes('orders.OrderPaymentFailed'),
        60_000,
      );
      await sender.close();
      await built.stop();
    }, 180_000);
  },
);

describe.each(['kafka', 'rabbitmq'])(
  'MESSAGING_BUS=%s that is down',
  (messagingBus) => {
    let postgreSQL: Awaited<ReturnType<typeof startPostgreSQL>>;
    let brokers: Brokers;

    beforeAll(async () => {
      brokers = { kafka: await startKafka(), rabbitMQ: await startRabbitMQ() };
      postgreSQL = await startPostgreSQL();
    }, 120_000);

    afterAll(async () => {
      await brokers.kafka.stop();
      await brokers.rabbitMQ.stop();
      await postgreSQL.stop();
    });

    const broker = () =>
      messagingBus === 'kafka' ? brokers.kafka : brokers.rabbitMQ;

    const runningWithAShortPublishTimeout = () =>
      runningOn({
        ...environmentOf({
          messagingBus,
          eventStoreType: 'postgresql',
          postgreSQL,
          brokers,
        }),
        MESSAGING_KAFKA_PUBLISH_TIMEOUT: '500ms',
        MESSAGING_RABBITMQ_PUBLISH_TIMEOUT: '500ms',
        MESSAGING_RETRY_INITIAL_INTERVAL: '100ms',
      });

    it('aForwarderRetriesWhileTheBrokerIsDownAndTheProcessorKeepsRunning', async () => {
      const built = runningWithAShortPublishTimeout();
      const customer = customerSteps(crypto.randomUUID());
      await built.start();
      await customer.addProduct(built.application);

      await broker().container.stop();
      await customer.checkOut(built.application);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await broker().container.start();

      await until(
        async () =>
          (
            await streamTypes(
              built.stores.orders,
              OrderId.workflowStreamNameOf(customer.orderId),
            )
          ).includes('orders.OrderPlaced'),
        90_000,
      );
      await built.stop();
    }, 180_000);

    it('aSendWithoutAcknowledgementWithinTheTimeoutFailsAndIsRetried', async () => {
      const built = runningWithAShortPublishTimeout();
      const customer = customerSteps(crypto.randomUUID());
      await built.start();
      await customer.addProduct(built.application);

      await broker().container.pause();
      await customer.checkOut(built.application);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await broker().container.unpause();

      await until(
        async () =>
          (
            await streamTypes(
              built.stores.orders,
              OrderId.workflowStreamNameOf(customer.orderId),
            )
          ).includes('orders.OrderPlaced'),
        90_000,
      );
      await built.stop();
    }, 180_000);

    it('afterABrokerRestartNewMessagesAreHandled', async () => {
      const built = runningWithAShortPublishTimeout();
      const customer = customerSteps(crypto.randomUUID());
      await built.start();

      await broker().container.stop();
      await broker().container.start();
      await customer.addProduct(built.application);
      await customer.checkOut(built.application);

      await until(
        async () =>
          (
            await streamTypes(
              built.stores.orders,
              OrderId.workflowStreamNameOf(customer.orderId),
            )
          ).includes('orders.OrderPlaced'),
        90_000,
      );
      await built.stop();
    }, 180_000);

    it('theOrderRequestsForwarderRetriesWhileTheBrokerIsDownAndSendsWhenItIsBack', async () => {
      const built = runningWithAShortPublishTimeout();
      const customerId = crypto.randomUUID();
      const { orderId } = customerSteps(customerId);
      const paymentId = PaymentId.derivedFrom(orderId);
      await built.start();

      await broker().container.stop();
      await orderWorkflowInbox(() => new Date())(
        built.stores.orders.store,
        checkedOutCartOf(customerId),
      );
      await until(
        async () =>
          (
            await streamTypes(
              built.stores.orders,
              OrderId.workflowStreamNameOf(orderId),
            )
          ).includes('orders.OrderPlaced'),
        30_000,
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const whileDown = await streamTypes(
        built.stores.payments,
        PaymentId.workflowStreamNameOf(paymentId),
      );
      await broker().container.start();

      await until(
        async () =>
          (
            await streamTypes(
              built.stores.payments,
              PaymentId.workflowStreamNameOf(paymentId),
            )
          ).includes('payments.PaymentAuthorizationRequested'),
        90_000,
      );
      await built.stop();

      expect(whileDown).toEqual([]);
    }, 180_000);
  },
);
