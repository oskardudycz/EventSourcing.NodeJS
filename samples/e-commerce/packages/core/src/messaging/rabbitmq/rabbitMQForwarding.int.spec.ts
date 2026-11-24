import { describeForwarding } from '../forwardingSuite';
import { observingQueue } from '../broker/brokerQueueTesting';
import { rabbitMQConfirmChannel } from './rabbitMQConfirmChannel';
import { rabbitMQConsumer } from './rabbitMQConsumer';
import { forwardToRabbitMQ } from './rabbitMQForwarder';
import { startRabbitMQ } from './rabbitMQTesting';
import { declareRabbitMQTopology } from './rabbitMQTopology';

describeForwarding('RabbitMQ', async () => {
  const rabbitMQ = await startRabbitMQ();
  const confirmChannel = rabbitMQConfirmChannel({
    connection: rabbitMQ.connection,
    publishTimeoutInMs: 1000,
  });

  return {
    forwarder: (options) =>
      forwardToRabbitMQ({
        ...options,
        confirmChannel,
        publishTimeoutInMs: 1000,
      }),
    declare: (channel, queues) =>
      declareRabbitMQTopology(rabbitMQ.connection, {
        channels: [channel],
        queues,
      }),
    observe: (subscription, messageStore) =>
      observingQueue(
        rabbitMQConsumer({
          connection: rabbitMQ.connection,
          subscription,
          messageStore,
        }).consumer,
        subscription.queue,
      ),
    outage: rabbitMQ.container,
    stop: async () => {
      await confirmChannel.close();
      await rabbitMQ.stop();
    },
  };
});
