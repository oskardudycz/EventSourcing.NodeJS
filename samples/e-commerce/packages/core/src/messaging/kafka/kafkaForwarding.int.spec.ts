import { describeForwarding } from '../forwardingSuite';
import { forwardToKafka } from './kafkaForwarder';
import { kafkaConsumer } from './kafkaConsumer';
import { kafkaDeadLetters } from './kafkaDeadLetters';
import { kafkaProducer } from './kafkaProducer';
import { startKafka } from './kafkaTesting';
import { declareKafkaTopics } from './kafkaTopology';
import { observingQueue } from '../broker/brokerQueueTesting';

describeForwarding('Kafka', async () => {
  const kafka = await startKafka();
  const producer = kafkaProducer({
    connection: kafka.connection,
    publishTimeoutInMs: 1000,
  });

  return {
    forwarder: (options) => forwardToKafka({ ...options, producer }),
    declare: (channel, queues) =>
      declareKafkaTopics(kafka.connection, { channels: [channel], queues }),
    observe: (subscription, messageStore) =>
      observingQueue(
        kafkaConsumer({
          connection: kafka.connection,
          subscription,
          messageStore,
          deadLetters: kafkaDeadLetters({
            queue: subscription.queue,
            producer,
          }),
        }),
        subscription.queue,
      ),
    outage: kafka.container,
    stop: async () => {
      await producer.close();
      await kafka.stop();
    },
  };
});
