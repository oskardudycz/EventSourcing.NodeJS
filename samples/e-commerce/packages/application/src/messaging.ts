import {
  declareKafkaTopics,
  declareRabbitMQTopology,
  forwardingToChannels,
  sendingToChannelStreams,
  sendingToKafka,
  sendingToRabbitMQ,
  type SendToChannel,
  forwardingToKafka,
  forwardingToRabbitMQ,
  fromBrokerQueue,
  fromChannel,
  kafkaConsumer,
  kafkaDeadLetters,
  kafkaProducer,
  kafkaRoutingConsumer,
  rabbitMQConfirmChannel,
  rabbitMQConsumer,
  type ChannelSubscription,
  type ForwardTo,
  type HandlerRetryOptions,
  type KafkaConnection,
  type RabbitMQConnection,
} from '@e-commerce/core';
import type { ModuleName } from './application';
import { channelStoreOf } from './channelStores';
import type { Database, ModuleStores } from './eventStore';
import type { ChannelReading } from './messagingBus';
import type { ModuleConsumer } from './moduleConsumer';
import {
  ordersInternalChannel,
  ordersSubscriptions,
} from './orders/ordersConfig';
import {
  paymentsChannels,
  paymentsInternalChannel,
  paymentsSubscriptions,
} from './payments/paymentsConfig';
import {
  shipmentsChannels,
  shipmentsSubscriptions,
} from './shipments/shipmentsConfig';
import { shoppingCartsChannels } from './shoppingCarts/shoppingCartsConfig';

export type BrokerConnections = {
  kafka?: { connection: KafkaConnection; publishTimeoutInMs?: number };
  rabbitMQ?: { connection: RabbitMQConnection; publishTimeoutInMs?: number };
};

const channels = [
  ordersInternalChannel,
  paymentsInternalChannel,
  ...shoppingCartsChannels,
  ...paymentsChannels,
  ...shipmentsChannels,
];

const subscriptions: ChannelSubscription[] = [
  ...Object.values(ordersSubscriptions),
  paymentsSubscriptions.requests,
  paymentsSubscriptions.internal,
  shipmentsSubscriptions.requests,
];

export type Messaging = {
  forward: ForwardTo;
  send: SendToChannel;
  readerOf: (
    module: ModuleName,
    database: Database,
    own: ModuleConsumer,
    options?: { internal: boolean },
  ) => ChannelReading;
  consumers: () => ModuleConsumer[];
  start: () => Promise<void>;
  close: () => Promise<void>;
};

const missingConnection = (bus: string) =>
  new Error(`The ${bus} bus needs its connection settings`);

export const createMessaging = ({
  stores,
  connections,
  retry,
  signal,
}: HandlerRetryOptions & {
  stores: ModuleStores;
  connections: BrokerConnections;
}): Messaging => {
  const reading: ModuleConsumer[] = [];
  const readingStore = new Map<ModuleName, ModuleConsumer>();

  const channelReader =
    (consumer: ModuleConsumer): ChannelReading =>
    ({ subscription, canHandle, handle }) => {
      consumer.reactor({
        processorId: subscription.queue,
        canHandle: [...canHandle],
        eachMessage: fromChannel({ ...subscription, retry, signal }, handle),
      });
    };

  const channelMessaging = (
    readingConsumerOf: (
      module: ModuleName,
      database: Database,
      own: ModuleConsumer,
    ) => ModuleConsumer,
  ): Messaging => ({
    forward: forwardingToChannels(channelStoreOf(stores)),
    send: sendingToChannelStreams(channelStoreOf(stores)),
    readerOf: (module, database, own, { internal } = { internal: false }) =>
      channelReader(internal ? own : readingConsumerOf(module, database, own)),
    consumers: () => reading,
    start: () => Promise.resolve(),
    close: () => Promise.resolve(),
  });

  switch (stores.messagingBus) {
    case 'none':
      return channelMessaging((_module, _database, own) => own);
    case 'in-memory': {
      const { broker } = stores;

      return channelMessaging((module, database) => {
        const existing = readingStore.get(module);
        if (existing) return existing;

        const created = database.consumer(broker);
        readingStore.set(module, created);
        reading.push(created);

        return created;
      });
    }
    case 'kafka': {
      const settings = connections.kafka;
      if (!settings) throw missingConnection('Kafka');

      const { connection, publishTimeoutInMs } = settings;
      const producer = kafkaProducer({ connection, publishTimeoutInMs });

      return {
        forward: forwardingToKafka(producer),
        send: sendingToKafka(producer),
        readerOf:
          (_module, database) =>
          ({ subscription, canHandle, handle }) => {
            const deadLetters = kafkaDeadLetters({
              queue: subscription.queue,
              producer,
            });
            const options = {
              connection,
              subscription,
              messageStore: database.store,
              deadLetters,
            };
            const consumer = kafkaConsumer(options);

            consumer.reactor({
              processorId: subscription.queue,
              canHandle: [...canHandle],
              eachMessage: fromBrokerQueue(
                { deadLetters, queue: subscription.queue, retry, signal },
                handle,
              ),
            });
            reading.push(consumer);

            if (
              subscription.bindingKey !== undefined &&
              subscription.bindingKey !== '#'
            )
              reading.push(
                kafkaRoutingConsumer({ ...options, producer, retry, signal }),
              );
          },
        consumers: () => reading,
        start: () =>
          declareKafkaTopics(connection, { channels, queues: subscriptions }),
        close: () => producer.close(),
      };
    }
    case 'rabbitmq': {
      const settings = connections.rabbitMQ;
      if (!settings) throw missingConnection('RabbitMQ');

      const { connection, publishTimeoutInMs } = settings;
      const confirmChannel = rabbitMQConfirmChannel({
        connection,
        publishTimeoutInMs,
      });

      return {
        forward: forwardingToRabbitMQ({ confirmChannel, publishTimeoutInMs }),
        send: sendingToRabbitMQ({ confirmChannel, publishTimeoutInMs }),
        readerOf:
          (_module, database) =>
          ({ subscription, canHandle, handle }) => {
            const { consumer, deadLetters } = rabbitMQConsumer({
              connection,
              subscription,
              messageStore: database.store,
            });

            consumer.reactor({
              processorId: subscription.queue,
              canHandle: [...canHandle],
              eachMessage: fromBrokerQueue(
                { deadLetters, queue: subscription.queue, retry, signal },
                handle,
              ),
            });
            reading.push(consumer);
          },
        consumers: () => reading,
        start: () =>
          declareRabbitMQTopology(connection, {
            channels,
            queues: subscriptions,
          }),
        close: () => confirmChannel.close(),
      };
    }
  }
};
