import { MessageProcessor } from '@event-driven-io/emmett';
import { matchesBindingKey } from '../bindingKeys';
import { brokerBodyOf } from '../broker/brokerMessage';
import type { BrokerQueueConsumer } from '../broker/brokerQueueConsumer';
import { retryInHandler, type HandlerRetryOptions } from '../retryInHandler';
import { kafkaConsumer, type KafkaConsumerOptions } from './kafkaConsumer';
import type { KafkaProducer } from './kafkaProducer';
import { kafkaTopicOf } from './kafkaTopology';

export type KafkaRoutingConsumerOptions = Omit<
  KafkaConsumerOptions,
  'groupId' | 'topic'
> &
  HandlerRetryOptions & { producer: KafkaProducer };

export const kafkaRoutingConsumer = ({
  producer,
  retry,
  signal,
  ...options
}: KafkaRoutingConsumerOptions): BrokerQueueConsumer => {
  const { queue, channel, bindingKey = '#' } = options.subscription;
  const queueTopic = kafkaTopicOf(options.subscription);

  const routing = kafkaConsumer({
    ...options,
    topic: channel,
    groupId: `${queue}-${channel}-routing`,
  });

  routing.reactor({
    processorId: `routing:${queue}`,
    eachMessage: async ({ data, metadata }) => {
      if (!matchesBindingKey(bindingKey, metadata.key ?? ''))
        return MessageProcessor.result.skip();

      await retryInHandler(
        () =>
          producer.send({
            messages: [
              {
                topic: queueTopic,
                key: metadata.key,
                value: brokerBodyOf(data),
                headers: metadata.headers,
              },
            ],
          }),
        { retry, signal },
      );
    },
  });

  return routing;
};
