import {
  manualClock,
  removeSQLiteFolder,
  routedSender,
  sendingToChannelStreams,
  temporarySQLiteFolder,
} from '@e-commerce/core';
import type { Message } from '@event-driven-io/emmett';
import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { createApplication } from './application';
import { createModuleStores } from './eventStore';
import { OrderId } from './orders/order';
import { PaymentId } from './payments/payment';
import type {
  AuthorizePayment,
  ConfirmPaymentAuthorization,
  TimeOutPayment,
} from './payments/paymentCommand';
import { paymentProvider } from './payments/paymentProvider';
import {
  paymentsInternalChannel,
  paymentsInternalRoutes,
} from './payments/paymentsConfig';
import { ShipmentId } from './shipments/shipment';
import type {
  ConfirmPackageSent,
  RequestFulfillment,
  ReserveStock,
  ShipmentCommand,
} from './shipments/shipmentCommand';
import { registerShipmentsProcessors } from './shipments/shipmentsProcessors';
import { shipmentWorkflowInbox } from './shipments/shipmentWorkflow';
import { warehouse } from './shipments/warehouse';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import type { InternalDelivery } from './settings';
import { deliverFromOutsideWorld } from './testApplication';
import { until } from './testInfrastructure';

const pulling = { pullingFrequencyInMs: 20, batchSize: 1 };
const startedAt = new Date('2026-01-01T10:00:00.000Z');
const oneDayInMs = 24 * 60 * 60 * 1000;

const newReferenceId = () =>
  OrderId.derivedFrom(ShoppingCartId.of(crypto.randomUUID(), 1));

const runningPayments = async (internalDelivery?: InternalDelivery) => {
  const folder = temporarySQLiteFolder();
  const stores = createModuleStores(
    { type: 'sqlite', folder },
    'in-memory',
    pulling,
  );
  const clock = manualClock(startedAt);
  const application = createApplication(
    {
      stores,
      paymentGateway: paymentProvider(),
      warehouse: warehouse(),
      now: clock.now,
      internalDelivery,
    },
    { modules: ['payments'] },
  );
  await application.start();

  const referenceId = newReferenceId();
  const id = PaymentId.derivedFrom(referenceId);
  const stream = async () =>
    (await stores.payments.store.readStream(PaymentId.workflowStreamNameOf(id)))
      .events;

  return {
    referenceId,
    id,
    stores,
    clock,
    stream,
    eventually: (type: string) => eventually(stream, type),
    deliver: (message: Message) => deliverFromOutsideWorld(stores, message),
    stop: async () => {
      await application.stop();
      await removeSQLiteFolder(folder);
    },
  };
};

const runningShipments = async () => {
  const folder = temporarySQLiteFolder();
  const stores = createModuleStores(
    { type: 'sqlite', folder },
    'none',
    pulling,
  );
  await stores.shipments.store.schema.migrate();
  const consumer = stores.shipments.consumer();
  registerShipmentsProcessors(consumer, {
    warehouse: warehouse(),
    logger: pino({ level: 'silent' }),
    now: () => startedAt,
  });
  void consumer.start();
  await consumer.whenStarted();

  const referenceId = newReferenceId();
  const id = ShipmentId.derivedFrom(referenceId);
  const stream = async () =>
    (
      await stores.shipments.store.readStream(
        ShipmentId.workflowStreamNameOf(id),
      )
    ).events;
  const storeInInbox = shipmentWorkflowInbox(() => startedAt);

  return {
    referenceId,
    id,
    stream,
    eventually: (type: string) => eventually(stream, type),
    deliver: (command: ShipmentCommand) =>
      storeInInbox(stores.shipments.store, command),
    stop: async () => {
      await consumer.close();
      await stores.shipments.close();
      await removeSQLiteFolder(folder);
    },
  };
};

const eventually = (stream: () => Promise<{ type: string }[]>, type: string) =>
  until(
    async () => (await stream()).some((event) => event.type === type),
    10_000,
  );

const withIds = <MessageType extends Message>(
  message: MessageType,
  ids: { messageId: string; correlationId?: string },
): MessageType & {
  metadata: { messageId: string; correlationId?: string };
} => ({
  ...message,
  metadata: { ...ids },
});

type StreamEvent = Awaited<
  ReturnType<Awaited<ReturnType<typeof runningPayments>>['stream']>
>[number];

const storedFrom = (events: StreamEvent[], messageId: string) =>
  events.find(
    ({ metadata }) =>
      'originalMessageId' in metadata &&
      metadata.originalMessageId === messageId,
  );

const firstOf = (events: StreamEvent[], type: string) =>
  events.find((event) => event.type === type);

describe('outside commands follow the scopes correlation', () => {
  it('aProviderAnswerFollowsTheScopesCorrelation', async () => {
    const payments = await runningPayments();
    const { id: paymentId, referenceId } = payments;
    const authorize: AuthorizePayment = {
      type: 'payments.AuthorizePayment',
      data: { paymentId, referenceId, amount: 10 },
    };
    const confirm: ConfirmPaymentAuthorization = {
      type: 'payments.ConfirmPaymentAuthorization',
      data: { paymentId, captureBefore: '2026-01-08T10:00:00.000Z' },
    };

    await payments.deliver(authorize);
    await payments.eventually('payments.PaymentAuthorizationRequested');
    await payments.deliver(
      withIds(confirm, {
        messageId: 'answer-1',
        correlationId: 'correlation-1',
      }),
    );
    await payments.eventually('payments.PaymentAuthorized');
    const events = await payments.stream();
    await payments.stop();

    const answer = storedFrom(events, 'answer-1');
    expect(answer?.metadata).toMatchObject({
      correlationId: 'correlation-1',
      causationId: 'answer-1',
    });
    expect(
      firstOf(events, 'payments.PaymentAuthorized')?.metadata,
    ).toMatchObject({
      correlationId: 'correlation-1',
      causationId: answer?.metadata.messageId,
    });
  });

  it('aWarehouseAnswerFollowsTheScopesCorrelation', async () => {
    const shipments = await runningShipments();
    const { id: shipmentId, referenceId } = shipments;
    const reserve: ReserveStock = {
      type: 'shipments.ReserveStock',
      data: {
        referenceId,
        productItems: [{ productId: crypto.randomUUID(), quantity: 1 }],
      },
    };
    const requestFulfillment: RequestFulfillment = {
      type: 'shipments.RequestFulfillment',
      data: { shipmentId },
    };
    const confirmSent: ConfirmPackageSent = {
      type: 'shipments.ConfirmPackageSent',
      data: { shipmentId, carrier: 'UPS', trackingNumber: '1Z999' },
    };

    await shipments.deliver(reserve);
    await shipments.eventually('shipments.StockReserved');
    await shipments.deliver(requestFulfillment);
    await shipments.eventually('shipments.FulfillmentRequested');
    await shipments.deliver(
      withIds(confirmSent, {
        messageId: 'answer-1',
        correlationId: 'correlation-1',
      }),
    );
    await shipments.eventually('shipments.PackageWasSent');
    const events = await shipments.stream();
    await shipments.stop();

    const answer = storedFrom(events, 'answer-1');
    expect(answer?.metadata).toMatchObject({
      correlationId: 'correlation-1',
      causationId: 'answer-1',
    });
    expect(firstOf(events, 'shipments.PackageWasSent')?.metadata).toMatchObject(
      {
        correlationId: 'correlation-1',
        causationId: answer?.metadata.messageId,
      },
    );
  });

  it.each<InternalDelivery>(['store', 'broker'])(
    'aWorkerCommandDeliveredThrough_%s_FollowsTheScopesCorrelation',
    async (internalDelivery) => {
      const payments = await runningPayments(internalDelivery);
      const { id: paymentId, referenceId, stores } = payments;
      const authorize: AuthorizePayment = {
        type: 'payments.AuthorizePayment',
        data: { paymentId, referenceId, amount: 10 },
      };
      const timeOut: TimeOutPayment = {
        type: 'payments.TimeOutPayment',
        data: {
          paymentId,
          timedOutAt: new Date(startedAt.getTime() + oneDayInMs).toISOString(),
        },
      };
      const sendToPaymentsInternal = routedSender<TimeOutPayment>(
        sendingToChannelStreams(() => stores.payments.store),
        [paymentsInternalRoutes],
        [paymentsInternalChannel],
      );

      await payments.deliver(authorize);
      await payments.eventually('payments.PaymentAuthorizationRequested');
      await payments.clock.advanceBy(oneDayInMs);
      if (internalDelivery === 'broker')
        await sendToPaymentsInternal({
          ...timeOut,
          metadata: { messageId: 'worker-1', now: startedAt },
        });
      else await payments.deliver(withIds(timeOut, { messageId: 'worker-1' }));
      await payments.eventually('payments.PaymentTimedOut');
      const events = await payments.stream();
      await payments.stop();

      const command = storedFrom(events, 'worker-1');
      expect(command?.metadata.correlationId).toBeTruthy();
      expect(command?.metadata.causationId).toBe('worker-1');
      expect(
        firstOf(events, 'payments.PaymentTimedOut')?.metadata,
      ).toMatchObject({
        correlationId: command?.metadata.correlationId,
        causationId: command?.metadata.messageId,
      });
    },
  );
});
