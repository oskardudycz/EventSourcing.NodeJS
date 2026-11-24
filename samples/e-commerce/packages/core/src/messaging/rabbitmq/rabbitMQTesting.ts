import { RabbitMQContainer } from '@testcontainers/rabbitmq';
import { connect } from 'amqplib';
import { containerControlOf, freePort } from '../../testing/brokerTesting';
import type { RabbitMQConfirmChannel } from './rabbitMQConfirmChannel';
import type { RabbitMQConnection } from './rabbitMQConnection';

export const startRabbitMQ = async () => {
  const port = await freePort();
  const container = await new RabbitMQContainer('rabbitmq:4.4.0-management')
    .withExposedPorts({ container: 5672, host: port })
    .start();

  const connection: RabbitMQConnection = {
    url: `amqp://guest:guest@${container.getHost()}:${port}`,
  };

  return {
    connection,
    container: await containerControlOf(container.getId()),
    stop: () => container.stop(),
  };
};

export const messagesIn = async (
  { url }: RabbitMQConnection,
  queue: string,
) => {
  const model = await connect(url);
  model.on('error', () => undefined);
  try {
    const channel = await model.createChannel();
    const messages: {
      key: string;
      headers: Record<string, unknown>;
      body: string;
    }[] = [];
    for (let next = await channel.get(queue, { noAck: true }); next;) {
      messages.push({
        key: next.fields.routingKey,
        headers: next.properties.headers ?? {},
        body: next.content.toString('utf-8'),
      });
      next = await channel.get(queue, { noAck: true });
    }
    return messages;
  } finally {
    await model.close();
  }
};

export const messageCountOf = async (
  { url }: RabbitMQConnection,
  queue: string,
) => {
  const model = await connect(url);
  model.on('error', () => undefined);
  try {
    const channel = await model.createChannel();
    return (await channel.checkQueue(queue)).messageCount;
  } finally {
    await model.close();
  }
};

export const sendRaw = async (
  confirmChannel: RabbitMQConfirmChannel,
  exchange: string,
  {
    key,
    headers,
    body,
  }: { key: string | undefined; headers: Record<string, string>; body: Buffer },
) => {
  const channel = await confirmChannel.current();
  channel.publish(exchange, key ?? '', body, { persistent: true, headers });
  await channel.waitForConfirms();
};
