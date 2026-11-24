import { asyncRetry } from '@event-driven-io/emmett';
import {
  findErrorBy,
  Admin,
  Consumer,
  stringDeserializer,
} from '@platformatic/kafka';
import { KafkaContainer } from '@testcontainers/kafka';
import { containerControlOf, freePort } from '../../testing/brokerTesting';
import type { KafkaConnection } from './kafkaConnection';
import type { KafkaProducer } from './kafkaProducer';

class KafkaOnAFixedPort extends KafkaContainer {
  constructor(
    image: string,
    private readonly hostPort: number,
  ) {
    super(image);
  }

  protected override async beforeContainerCreated() {
    await super.beforeContainerCreated();
    this.withExposedPorts({ container: 9093, host: this.hostPort });
  }
}

export const startKafka = async () => {
  const port = await freePort();
  const container = await new KafkaOnAFixedPort(
    'confluentinc/cp-kafka:8.4.1',
    port,
  ).start();

  const connection: KafkaConnection = {
    bootstrapBrokers: [`${container.getHost()}:${port}`],
  };

  return {
    connection,
    container: await containerControlOf(container.getId()),
    stop: () => container.stop(),
  };
};

export const readTopic = async (
  { bootstrapBrokers }: KafkaConnection,
  topic: string,
  count: number,
) => {
  const reader = new Consumer({
    clientId: 'topic-reader',
    groupId: `reader-${crypto.randomUUID()}`,
    bootstrapBrokers,
    deserializers: {
      key: stringDeserializer,
      headerKey: stringDeserializer,
      headerValue: stringDeserializer,
    },
  });
  const stream = await reader.consume({
    topics: [topic],
    mode: 'earliest',
    autocommit: false,
  });
  const records: {
    key: string | undefined;
    headers: Record<string, string>;
    body: string;
  }[] = [];

  try {
    for await (const record of stream) {
      records.push({
        key: record.key,
        headers: Object.fromEntries(record.headers),
        body: record.value.toString('utf-8'),
      });
      if (records.length >= count) break;
    }
  } finally {
    await stream.close();
    await reader.close(true);
  }

  return records;
};

export const endOffsetsOf = async (
  { bootstrapBrokers }: KafkaConnection,
  topic: string,
) => {
  const admin = new Admin({ clientId: 'end-offsets', bootstrapBrokers });
  try {
    const listed = await admin.listOffsets({
      topics: [
        {
          name: topic,
          partitions: [0, 1, 2].map((partitionIndex) => ({
            partitionIndex,
            timestamp: -1n,
          })),
        },
      ],
    });
    return listed
      .flatMap((t) => t.partitions)
      .reduce((sum, partition) => sum + partition.offset, 0n);
  } finally {
    await admin.close();
  }
};

export const committedOffsetsOf = async (
  { bootstrapBrokers }: KafkaConnection,
  groupId: string,
  topic: string,
) => {
  const admin = new Admin({ clientId: 'committed-offsets', bootstrapBrokers });
  try {
    const [group] = await admin.listConsumerGroupOffsets({
      groups: [
        { groupId, topics: [{ name: topic, partitionIndexes: [0, 1, 2] }] },
      ],
    });
    return (group?.topics ?? [])
      .flatMap((t) => t.partitions)
      .reduce(
        (sum, partition) =>
          sum +
          (partition.committedOffset > 0n ? partition.committedOffset : 0n),
        0n,
      );
  } finally {
    await admin.close();
  }
};

const isNotLeader = (error?: unknown) =>
  error instanceof Error &&
  findErrorBy(error, 'code', 'PLT_KFK_PROTOCOL')?.message.includes(
    'not the current leader',
  ) === true;

export const sendRaw = (
  producer: KafkaProducer,
  topic: string,
  {
    key,
    headers,
    body,
  }: { key: string | undefined; headers: Record<string, string>; body: Buffer },
) =>
  asyncRetry(
    () =>
      producer
        .send({ messages: [{ topic, key, value: body, headers }] })
        .then(() => undefined),
    { retries: 20, minTimeout: 100, factor: 1, shouldRetryError: isNotLeader },
  );
