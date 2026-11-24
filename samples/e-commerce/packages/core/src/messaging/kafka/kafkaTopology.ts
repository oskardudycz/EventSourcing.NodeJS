import { delay } from '@event-driven-io/emmett';
import { Admin } from '@platformatic/kafka';
import type { ChannelSubscription } from '../channels';
import { defaultKafkaClientId, type KafkaConnection } from './kafkaConnection';

export const kafkaPartitions = 3;

export const deadLetterTopicOf = (queue: string) => `${queue}-dlt`;

export const consumesWholeChannel = ({
  bindingKey = '#',
}: Pick<ChannelSubscription, 'bindingKey'>) => bindingKey === '#';

export const kafkaTopicOf = (subscription: ChannelSubscription) =>
  consumesWholeChannel(subscription)
    ? subscription.channel
    : subscription.queue;

export type KafkaTopology = {
  channels: readonly string[];
  queues: readonly ChannelSubscription[];
};

export const kafkaTopicsOf = ({ channels, queues }: KafkaTopology) => [
  ...new Set([
    ...channels,
    ...queues.flatMap((queue) => [
      queue.channel,
      kafkaTopicOf(queue),
      deadLetterTopicOf(queue.queue),
    ]),
  ]),
];

export const declareKafkaTopics = async (
  { bootstrapBrokers, clientId = defaultKafkaClientId }: KafkaConnection,
  topology: KafkaTopology,
) => {
  const admin = new Admin({
    clientId: `${clientId}-topology`,
    bootstrapBrokers,
  });

  try {
    const existing = new Set(await admin.listTopics());
    const missing = kafkaTopicsOf(topology).filter(
      (topic) => !existing.has(topic),
    );

    if (missing.length > 0)
      await admin.createTopics({
        topics: missing,
        partitions: kafkaPartitions,
        replicas: 1,
      });

    const topics = kafkaTopicsOf(topology);
    for (let ready = false; !ready;) {
      const { topics: known } = await admin.metadata({
        topics,
        forceUpdate: true,
      });
      ready = topics.every((topic) =>
        known
          .get(topic)
          ?.partitions.every(
            (partition) =>
              partition.leader >= 0 && partition.isr.includes(partition.leader),
          ),
      );
      if (!ready) await delay(50);
    }
  } finally {
    await admin.close();
  }
};
