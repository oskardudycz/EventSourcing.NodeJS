import { brokerHeaders } from '@e-commerce/core';
import { z } from 'zod';
import { allModules, type ModuleName } from '../modules';
import { channelFlows, routeOf } from './channelFlows';
import type { MessageContract } from './messageContract';

const servers = {
  kafka: {
    host: 'localhost:9092',
    protocol: 'kafka',
    description:
      'Channels are Kafka topics. The body is the message data, the type is in the message-type header',
  },
  rabbitmq: {
    host: 'localhost:5672',
    protocol: 'amqp',
    description:
      'Channels are RabbitMQ exchanges. The body is the message data, the type is in the message-type header',
  },
  'in-memory': {
    host: 'in-memory',
    protocol: 'in-memory',
    description: 'Channels are streams of the event store',
  },
};

const headersOf = ({ type, kind }: MessageContract) => ({
  type: 'object',
  properties: {
    [brokerHeaders.type]: { type: 'string', const: type },
    [brokerHeaders.kind]: {
      type: 'string',
      const: kind === 'command' ? 'Command' : 'Event',
    },
    [brokerHeaders.messageId]: { type: 'string' },
    [brokerHeaders.correlationId]: { type: 'string' },
    [brokerHeaders.causationId]: { type: 'string' },
    [brokerHeaders.traceId]: { type: 'string' },
    [brokerHeaders.spanId]: { type: 'string' },
  },
  required: [brokerHeaders.type, brokerHeaders.messageId],
});

const messageOf = (contract: MessageContract) => ({
  name: contract.type,
  title: contract.type,
  summary: contract.description,
  description: contract.description,
  contentType: 'application/json',
  headers: headersOf(contract),
  payload: z.toJSONSchema(contract.schema, { target: 'draft-7' }),
  examples: [
    {
      headers: {
        [brokerHeaders.type]: contract.type,
        [brokerHeaders.kind]: contract.kind === 'command' ? 'Command' : 'Event',
        [brokerHeaders.messageId]: 'message-1',
      },
      payload: contract.allFields,
    },
  ],
  'x-eventcatalog-message-type': contract.kind,
});

type Operation = {
  module: ModuleName;
  action: 'send' | 'receive';
  channel: string;
  boundTo: string;
  contract: MessageContract;
};

const operations = (): Operation[] =>
  channelFlows.flatMap(({ sender, receivers, routes, contracts }) =>
    contracts.flatMap((contract) => {
      const { channel } = routeOf(routes, contract);

      return [
        {
          module: sender,
          action: 'send' as const,
          channel,
          boundTo: channel,
          contract,
        },
        ...receivers.map(({ module, queue }) => ({
          module,
          action: 'receive' as const,
          channel: queue,
          boundTo: channel,
          contract,
        })),
      ];
    }),
  );

export const asyncApiDocument = (module?: ModuleName) => {
  const selected = operations().filter(
    (operation) => module === undefined || operation.module === module,
  );
  const channelNames = [...new Set(selected.map(({ channel }) => channel))];
  const queueChannels = new Map(
    selected.flatMap(({ channel, boundTo }) =>
      boundTo !== channel ? [[channel, boundTo] as const] : [],
    ),
  );

  return {
    asyncapi: '3.0.0',
    info: {
      title: module ? `E-commerce ${module}` : 'E-commerce',
      version: '1.0.0',
      description: module
        ? `The messages the ${module} module sends and receives.`
        : 'The messages the modules of the e-commerce sample send and receive.',
      tags: (module ? [module] : allModules).map((name) => ({ name })),
    },
    servers,
    channels: Object.fromEntries(
      channelNames.map((channel) => [
        channel,
        {
          address: channel,
          description: queueChannels.has(channel)
            ? `Queue ${channel}, bound to the channel ${queueChannels.get(channel)}`
            : `Channel ${channel}`,
          messages: Object.fromEntries(
            selected
              .filter((operation) => operation.channel === channel)
              .map(({ contract }) => [
                contract.type,
                { $ref: `#/components/messages/${contract.type}` },
              ]),
          ),
        },
      ]),
    ),
    operations: Object.fromEntries(
      selected.map(({ module: owner, action, channel, contract }) => [
        `${owner}.${action}.${contract.type}`,
        {
          action,
          title: `${owner} ${action}s ${contract.type}`,
          summary: contract.description,
          tags: [{ name: owner }],
          channel: { $ref: `#/channels/${channel}` },
          messages: [
            { $ref: `#/channels/${channel}/messages/${contract.type}` },
          ],
        },
      ]),
    ),
    components: {
      messages: Object.fromEntries(
        selected.map(({ contract }) => [contract.type, messageOf(contract)]),
      ),
    },
  };
};

export const publishableMessages = () =>
  channelFlows.flatMap(({ routes, contracts }) =>
    contracts.map((contract) => ({
      contract,
      ...routeOf(routes, contract),
    })),
  );
