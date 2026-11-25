import {
  kafkaProducer,
  manualClock,
  rabbitMQConfirmChannel,
  routedSender,
  sendingToKafka,
  sendingToRabbitMQ,
} from '@e-commerce/core';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { buildApplication } from './buildApplication';
import { OrderId } from './orders/order';
import { PaymentId } from './payments/payment';
import type { AuthorizePayment } from './payments/paymentCommand';
import { paymentProvider } from './payments/paymentProvider';
import {
  paymentsChannels,
  paymentsRequestRoutes,
} from './payments/paymentsConfig';
import { readSettings } from './settings';
import { warehouse } from './shipments/warehouse';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import {
  startKafka,
  startPostgreSQL,
  startRabbitMQ,
  until,
} from './testInfrastructure';

const startedAt = new Date('2026-01-01T10:00:00.000Z');
const oneDayInMs = 24 * 60 * 60 * 1000;

describe.each(['kafka', 'rabbitmq'])(
  'own commands of a module on MESSAGING_BUS=%s',
  (messagingBus) => {
    let postgreSQL: Awaited<ReturnType<typeof startPostgreSQL>>;
    let kafka: Awaited<ReturnType<typeof startKafka>>;
    let rabbitMQ: Awaited<ReturnType<typeof startRabbitMQ>>;

    beforeAll(async () => {
      postgreSQL = await startPostgreSQL();
      kafka = await startKafka();
      rabbitMQ = await startRabbitMQ();
    }, 120_000);

    afterAll(async () => {
      await postgreSQL.stop();
      await kafka.stop();
      await rabbitMQ.stop();
    });

    const aTimedOutPaymentIsDecidedWhenDeliveredThrough = (
      internalDelivery: 'store' | 'broker',
    ) =>
      it(`aWorkersTimeOutPaymentDeliveredThrough_${internalDelivery}_IsDecided`, async ({
        signal,
      }) => {
        const clock = manualClock(startedAt);
        const built = buildApplication(
          readSettings({
            MESSAGING_BUS: messagingBus,
            EVENTSTORE_TYPE: 'postgresql',
            POSTGRESQL_URL: postgreSQL.connectionString,
            KAFKA_BOOTSTRAP_SERVERS:
              kafka.connection.bootstrapBrokers.join(','),
            RABBITMQ_URL: rabbitMQ.connection.url,
            MESSAGING_INTERNAL_DELIVERY: internalDelivery,
            WORKERS_SCHEDULED: 'false',
          }),
          {
            paymentGateway: paymentProvider(),
            warehouse: warehouse(),
            now: clock.now,
            pulling: { pullingFrequencyInMs: 20, batchSize: 1 },
          },
        );
        const producer = kafkaProducer({ connection: kafka.connection });
        const confirmChannel = rabbitMQConfirmChannel({
          connection: rabbitMQ.connection,
        });
        const requestPayment = routedSender<AuthorizePayment>(
          messagingBus === 'kafka'
            ? sendingToKafka(producer)
            : sendingToRabbitMQ({ confirmChannel }),
          [paymentsRequestRoutes],
          paymentsChannels,
        );
        const referenceId = OrderId.derivedFrom(
          ShoppingCartId.of(crypto.randomUUID(), 1),
        );
        const paymentId = PaymentId.derivedFrom(referenceId);
        const paymentTypes = async () =>
          (
            await built.stores.payments.store.readStream(
              PaymentId.workflowStreamNameOf(paymentId),
            )
          ).events.map(({ type }) => type);
        signal.addEventListener('abort', () => void built.stop());

        try {
          await built.start();
          await requestPayment({
            type: 'payments.AuthorizePayment',
            data: { paymentId, referenceId, amount: 10 },
            metadata: { messageId: crypto.randomUUID(), now: startedAt },
          });
          await until(
            async () =>
              (await paymentTypes()).includes(
                'payments.PaymentAuthorizationRequested',
              ),
            5_000,
          );
          await Promise.all(
            built.application.consumers.map((consumer) =>
              consumer.whenCaughtUp(),
            ),
          );
          await clock.advanceBy(oneDayInMs);
          for (const worker of built.application.workers)
            await worker.handle(clock.now());
          await until(
            async () =>
              (await paymentTypes()).includes('payments.PaymentTimedOut'),
            3_000,
          );
        } finally {
          await producer.close();
          await confirmChannel.close();
          await built.stop();
        }
      });

    aTimedOutPaymentIsDecidedWhenDeliveredThrough('store');
    aTimedOutPaymentIsDecidedWhenDeliveredThrough('broker');
  },
);
