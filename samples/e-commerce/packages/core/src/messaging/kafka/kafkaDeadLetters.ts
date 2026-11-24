import type { Meter } from '@event-driven-io/almanac';
import { otelMeter } from '@event-driven-io/almanac/otel';
import { brokerBodyOf, brokerHeaders } from '../broker/brokerMessage';
import { countDeadLettered, type DeadLetters } from '../broker/deadLetters';
import { unknownMessageType } from '../broker/brokerMessage';
import type { KafkaProducer } from './kafkaProducer';
import { deadLetterTopicOf } from './kafkaTopology';

export const kafkaDeadLetters = ({
  queue,
  producer,
  meter = otelMeter(),
}: {
  queue: string;
  producer: KafkaProducer;
  meter?: Meter;
}): DeadLetters => {
  const topic = deadLetterTopicOf(queue);

  return {
    failed: async ({ type, data, metadata }) => {
      await producer.send({
        messages: [
          {
            topic,
            key: metadata.key,
            value: brokerBodyOf(data),
            headers: metadata.headers,
          },
        ],
      });
      countDeadLettered(meter, queue, type);
    },
    unreadable: async ({ key, headers, body }, reason) => {
      await producer.send({
        messages: [
          {
            topic,
            key,
            value: body,
            headers: { ...headers, 'dead-letter-reason': reason },
          },
        ],
      });
      countDeadLettered(
        meter,
        queue,
        headers[brokerHeaders.type] ?? unknownMessageType,
      );
    },
  };
};
