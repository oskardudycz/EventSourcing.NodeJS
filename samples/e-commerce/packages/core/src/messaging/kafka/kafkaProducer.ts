import { Producer, stringSerializer } from '@platformatic/kafka';
import { defaultKafkaClientId, type KafkaConnection } from './kafkaConnection';

export const defaultKafkaPublishTimeoutInMs = 10_000;

export type KafkaProducer = Producer<string, Buffer, string, string>;

export const kafkaProducer = ({
  connection: { bootstrapBrokers, clientId = defaultKafkaClientId },
  publishTimeoutInMs = defaultKafkaPublishTimeoutInMs,
}: {
  connection: KafkaConnection;
  publishTimeoutInMs?: number;
}): KafkaProducer =>
  new Producer({
    clientId: `${clientId}-producer`,
    bootstrapBrokers,
    serializers: {
      key: stringSerializer,
      headerKey: stringSerializer,
      headerValue: stringSerializer,
    },
    timeout: publishTimeoutInMs,
    requestTimeout: publishTimeoutInMs,
    connectTimeout: publishTimeoutInMs,
    retries: 0,
  });
