import {
  EmmettError,
  ProblemDocument,
  type AsyncRetryOptions,
} from '@event-driven-io/emmett';
import { getApplication as getHonoApplication } from '@event-driven-io/emmett-honojs';
import { routedSender, workersLoop, type Worker } from '@e-commerce/core';
import pino, { type Logger } from 'pino';
import { documentationApi } from './documentation/documentationApi';
import { webApiOf } from './documentation/openApi';
import { registerForwarders } from './forwarders';
import { allModules, type ModuleName } from './modules';
import { sandboxesOf } from './sandboxes';
import { storesOf, type Database, type ModuleStores } from './eventStore';
import { createMessaging, type BrokerConnections } from './messaging';
import type { InternalDelivery } from './settings';
import { customerOrders } from './orders/getCustomerOrders/customerOrders';
import type { CloseUnpaidOrder } from './orders/order';
import { orderPages } from './orders/orderPages';
import { orderStatuses } from './orders/getOrderStatus/orderStatuses';
import { httpMetrics } from './telemetry/httpMetrics';
import { registerOrderMetrics } from './orders/orderMetrics';
import {
  orderWorkflowHandler,
  orderWorkflowInbox,
  type OrderWorkflowInput,
  type OrderWorkflowOutput,
} from './orders/orderWorkflow';
import { ordersApi } from './orders/ordersApi';
import {
  ordersInternalChannel,
  ordersInternalRoutes,
} from './orders/ordersConfig';
import {
  registerOrdersChannelReaders,
  registerOrdersInternalReader,
  registerOrdersProcessors,
} from './orders/ordersProcessors';
import { ordersAwaitingPayment } from './orders/unpaid/ordersAwaitingPayment';
import { unpaidOrdersWorker } from './orders/unpaid/unpaidOrdersWorker';
import { authorizationExpiryWorker } from './payments/authorization/authorizationExpiryWorker';
import { authorizedPayments } from './payments/authorization/authorizedPayments';
import { paymentTimeoutWorker } from './payments/authorization/paymentTimeoutWorker';
import { pendingPayments } from './payments/authorization/pendingPayments';
import type { PaymentExternalEvent } from './payments/external/paymentExternalEvent';
import type { PaymentEvent } from './payments/payment';
import type {
  ExpirePaymentAuthorization,
  PaymentCommand,
  TimeOutPayment,
} from './payments/paymentCommand';
import { paymentCheckoutSessions } from './payments/paymentCheckoutSessions';
import type { PaymentGateway } from './payments/paymentGateway';
import { paymentWorkflowInbox } from './payments/paymentWorkflow';
import {
  paymentsInternalChannel,
  paymentsInternalRoutes,
} from './payments/paymentsConfig';
import {
  registerPaymentsChannelReaders,
  registerPaymentsInternalReader,
  registerPaymentsProcessors,
} from './payments/paymentsProcessors';
import type { ShipmentExternalEvent } from './shipments/external/shipmentExternalEvent';
import type { WarehouseGateway } from './shipments/warehouseGateway';
import type { ShipmentEvent } from './shipments/shipment';
import type { ShipmentCommand } from './shipments/shipmentCommand';
import {
  registerShipmentsChannelReaders,
  registerShipmentsProcessors,
} from './shipments/shipmentsProcessors';
import { customerShoppingCarts } from './shoppingCarts/currentCart/customerShoppingCarts';
import type { ShoppingCartCheckedOutExternal } from './shoppingCarts/external/shoppingCartExternalEvent';
import { shoppingCartSummaries } from './shoppingCarts/external/shoppingCartSummaries';
import { carts } from './shoppingCarts/getCart/carts';
import type { ProductPriceCalculator } from './shoppingCarts/pricing/productPriceCalculator';
import { randomProductPriceCalculator } from './shoppingCarts/pricing/randomProductPriceCalculator';
import type { ShoppingCartEvent } from './shoppingCarts/shoppingCart';
import { shoppingCartFacade } from './shoppingCarts/shoppingCartFacade';
import { shoppingCartPages } from './shoppingCarts/shoppingCartPages';
import { shoppingCartsApi } from './shoppingCarts/shoppingCartsApi';
import { defaultShopLinks, type ShopLinks } from './shop/shopLayout';
import { shopPages } from './shop/shopPages';
import { sandboxCheckoutPage } from './payments/sandbox/sandboxCheckoutPage';
import { sandboxWarehousePage } from './shipments/sandbox/sandboxWarehousePage';

export type ApplicationMessage =
  | ShoppingCartEvent
  | ShoppingCartCheckedOutExternal
  | OrderWorkflowInput
  | OrderWorkflowOutput
  | PaymentEvent
  | PaymentCommand
  | PaymentExternalEvent
  | ShipmentEvent
  | ShipmentCommand
  | ShipmentExternalEvent;

export { allModules, type ModuleName };

export type ApplicationOptions = {
  stores: ModuleStores;
  connections?: BrokerConnections;
  internalDelivery?: InternalDelivery;
  paymentGateway?: PaymentGateway;
  warehouse?: WarehouseGateway;
  links?: ShopLinks;
  logger?: Logger;
  prices?: ProductPriceCalculator;
  now?: () => Date;
  messagingRetry?: AsyncRetryOptions;
  workers?: { intervalInMs?: number };
};

export type ApplicationTestOptions = {
  modules?: readonly ModuleName[];
};

const mapError = (error: Error) =>
  error instanceof EmmettError &&
  error.status === EmmettError.Codes.IllegalStateError
    ? new ProblemDocument({ detail: error.message, status: 409 })
    : undefined;

export const createApplication = (
  options: ApplicationOptions,
  testing: ApplicationTestOptions = {},
) => {
  const {
    stores,
    prices = randomProductPriceCalculator(),
    now = () => new Date(),
    links = defaultShopLinks,
    logger = pino(),
  } = options;
  const sandboxes = sandboxesOf({ stores, now });
  const {
    paymentGateway = sandboxes.paymentGateway,
    warehouse = sandboxes.warehouse,
  } = options;
  const { modules = allModules } = testing;
  const retry = options.messagingRetry;
  const isRunning = (module: ModuleName) => modules.includes(module);

  const shoppingCartsPongo = stores.shoppingCarts.pongo();
  const ordersPongo = stores.orders.pongo();
  const paymentsPongo = stores.payments.pongo();
  const shutdown = new AbortController();
  const messaging = createMessaging({
    stores,
    connections: options.connections ?? {},
    retry,
    signal: shutdown.signal,
  });
  const viaBroker =
    (options.internalDelivery ?? 'store') === 'broker' &&
    stores.messagingBus !== 'none';
  const ownConsumerOf = (module: ModuleName, database: Database) =>
    isRunning(module) ? database.consumer() : undefined;

  const shoppingCartsConsumer = ownConsumerOf(
    'shopping_carts',
    stores.shoppingCarts,
  );
  const projectingConsumerOf = (module: ModuleName, database: Database) =>
    isRunning(module)
      ? (database.projectingConsumer() ?? database.consumer())
      : undefined;
  const ordersConsumer = projectingConsumerOf('orders', stores.orders);
  const paymentsConsumer = projectingConsumerOf('payments', stores.payments);
  const shipmentsConsumer = projectingConsumerOf('shipments', stores.shipments);
  const ordersForwardingConsumer = ownConsumerOf('orders', stores.orders);
  const paymentsForwardingConsumer = ownConsumerOf('payments', stores.payments);
  const shipmentsForwardingConsumer = ownConsumerOf(
    'shipments',
    stores.shipments,
  );
  const ownConsumers = [
    shoppingCartsConsumer,
    ordersConsumer,
    ordersForwardingConsumer,
    paymentsConsumer,
    paymentsForwardingConsumer,
    shipmentsConsumer,
    shipmentsForwardingConsumer,
  ].filter((consumer) => consumer !== undefined);

  registerForwarders({
    consumers: {
      shoppingCarts: shoppingCartsConsumer,
      orders: ordersForwardingConsumer,
      payments: paymentsForwardingConsumer,
      shipments: shipmentsForwardingConsumer,
    },
    summaries: {
      shoppingCarts: shoppingCartSummaries(shoppingCartsPongo),
    },
    forward: messaging.forward,
    retry,
    signal: shutdown.signal,
  });

  if (ordersConsumer) {
    registerOrdersProcessors(ordersConsumer, { now });
    registerOrderMetrics(ordersConsumer, {
      eventStore: stores.orders.store,
      pongo: ordersPongo,
    });
    registerOrdersChannelReaders(
      messaging.readerOf('orders', stores.orders, ordersConsumer),
      { now },
    );
    if (viaBroker)
      registerOrdersInternalReader(
        messaging.readerOf('orders', stores.orders, ordersConsumer, {
          internal: true,
        }),
        { now },
      );
  }

  if (paymentsConsumer) {
    registerPaymentsProcessors(paymentsConsumer, {
      gateway: paymentGateway,
      logger,
      now,
    });
    registerPaymentsChannelReaders(
      messaging.readerOf('payments', stores.payments, paymentsConsumer),
      { now },
    );
    if (viaBroker)
      registerPaymentsInternalReader(
        messaging.readerOf('payments', stores.payments, paymentsConsumer, {
          internal: true,
        }),
        { now },
      );
  }

  if (shipmentsConsumer) {
    registerShipmentsProcessors(shipmentsConsumer, {
      warehouse,
      logger,
      now,
      retry,
      signal: shutdown.signal,
    });
    registerShipmentsChannelReaders(
      messaging.readerOf('shipments', stores.shipments, shipmentsConsumer),
      { now },
    );
  }

  const handleOrderCommand = orderWorkflowHandler(now);
  const sendToOrder = (command: OrderWorkflowInput) =>
    handleOrderCommand(stores.orders.store, command);
  const storeInOrderInbox = orderWorkflowInbox(now);
  const storeInPaymentInbox = paymentWorkflowInbox(now);
  const sendToOrdersInternal = routedSender<CloseUnpaidOrder>(
    messaging.send,
    [ordersInternalRoutes],
    [ordersInternalChannel],
  );
  const sendToPaymentsInternal = routedSender<
    TimeOutPayment | ExpirePaymentAuthorization
  >(messaging.send, [paymentsInternalRoutes], [paymentsInternalChannel]);
  const ownCommandToOrders = (command: CloseUnpaidOrder) =>
    viaBroker
      ? sendToOrdersInternal({
          ...command,
          metadata: { messageId: crypto.randomUUID(), now: now() },
        })
      : storeInOrderInbox(stores.orders.store, command);
  const ownCommandToPayments = (
    command: TimeOutPayment | ExpirePaymentAuthorization,
  ) =>
    viaBroker
      ? sendToPaymentsInternal({
          ...command,
          metadata: { messageId: crypto.randomUUID(), now: now() },
        })
      : storeInPaymentInbox(stores.payments.store, command);
  const workersOf = (module: ModuleName, moduleWorkers: Worker[]) =>
    isRunning(module) ? moduleWorkers : [];
  const workers = [
    ...workersOf('orders', [
      unpaidOrdersWorker({
        ordersAwaitingPayment: ordersAwaitingPayment(ordersPongo),
        storeAsInput: ownCommandToOrders,
      }),
    ]),
    ...workersOf('payments', [
      paymentTimeoutWorker({
        pendingPayments: pendingPayments(paymentsPongo),
        storeAsInput: ownCommandToPayments,
      }),
      authorizationExpiryWorker({
        authorizedPayments: authorizedPayments(paymentsPongo),
        storeAsInput: ownCommandToPayments,
      }),
    ]),
  ];
  const payments = paymentCheckoutSessions({
    store: stores.payments.store,
    gateway: paymentGateway,
    now,
  });

  const customerCarts = customerShoppingCarts(shoppingCartsPongo);
  const shoppingCartReads = carts(shoppingCartsPongo);
  const shoppingCartsFacade = shoppingCartFacade({
    eventStore: stores.shoppingCarts.store,
    customerShoppingCarts: customerCarts,
    prices,
    now,
  });
  const cartsApp = shoppingCartsApi({
    shoppingCarts: shoppingCartsFacade,
    customerShoppingCarts: customerCarts,
    carts: shoppingCartReads,
  });
  const ordersApp = ordersApi({
    sendToOrder,
    payments,
    customerOrders: customerOrders(ordersPongo),
    orderStatuses: orderStatuses(ordersPongo),
  });
  const app = getHonoApplication({
    mapError,
    apis: [
      httpMetrics,
      webApiOf(cartsApp),
      webApiOf(ordersApp),
      shopPages({ links }),
      shoppingCartPages({
        shoppingCarts: shoppingCartsFacade,
        customerShoppingCarts: customerCarts,
        carts: shoppingCartReads,
        prices,
        links,
      }),
      orderPages({
        sendToOrder,
        customerOrders: customerOrders(ordersPongo),
        orderStatuses: orderStatuses(ordersPongo),
        links,
      }),
      sandboxCheckoutPage(sandboxes.paymentGateway),
      sandboxWarehousePage(sandboxes.warehouse),
      documentationApi({
        publish: messaging.send,
        openApi: { shopping_carts: cartsApp, orders: ordersApp },
      }),
    ],
  });

  const allConsumers = () => [...ownConsumers, ...messaging.consumers()];
  let running: Promise<void[]> = Promise.resolve([]);
  let workersRunning: Promise<void> = Promise.resolve();

  return {
    fetch: (request: Request): Response | Promise<Response> =>
      app.fetch(request),
    routes: app.routes,
    get consumers() {
      return allConsumers();
    },
    workers,
    sandboxes,
    start: async () => {
      for (const { store } of storesOf(stores)) await store.schema.migrate();
      await messaging.start();
      const consumers = allConsumers();
      running = Promise.all(consumers.map((consumer) => consumer.start()));
      running.catch((error: unknown) =>
        logger.error({ err: error }, 'A consumer stopped with an error'),
      );
      await Promise.all(consumers.map((consumer) => consumer.whenStarted()));
      if (options.workers)
        workersRunning = workersLoop({
          workers,
          now,
          intervalInMs: options.workers.intervalInMs,
          signal: shutdown.signal,
        });
    },
    stop: async () => {
      shutdown.abort();
      await workersRunning;
      await Promise.all(allConsumers().map((consumer) => consumer.close()));
      await messaging.close();
      for (const database of storesOf(stores)) await database.close();
      await running;
    },
  };
};

export type Application = ReturnType<typeof createApplication>;
