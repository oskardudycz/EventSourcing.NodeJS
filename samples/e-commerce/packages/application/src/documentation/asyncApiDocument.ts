import { z } from 'zod';
import type { ModuleName } from '../application';
import { channelFlows, routeOf } from './channelFlows';
import type { MessageContract } from './messageContract';

const servers = {
  kafka: {
    host: 'localhost:9092',
    protocol: 'kafka',
    description: 'Channels are Kafka topics',
  },
  rabbitmq: {
    host: 'localhost:5672',
    protocol: 'amqp',
    description: 'Channels are RabbitMQ exchanges',
  },
  'in-memory': {
    host: 'in-memory',
    protocol: 'in-memory',
    description: 'Channels are streams of the event store',
  },
};

const modules: ModuleName[] = [
  'shopping_carts',
  'orders',
  'payments',
  'shipments',
];

const payloadOf = ({ type, schema }: MessageContract) =>
  z.toJSONSchema(z.object({ type: z.literal(type), data: schema }), {
    target: 'draft-7',
  });

const messageOf = (contract: MessageContract) => ({
  name: contract.type,
  title: contract.type,
  summary: contract.description,
  description: contract.description,
  contentType: 'application/json',
  payload: payloadOf(contract),
  examples: [{ payload: { type: contract.type, data: contract.allFields } }],
  'x-eventcatalog-message-type': contract.kind,
});

type Operation = {
  module: ModuleName;
  action: 'send' | 'receive';
  channel: string;
  contract: MessageContract;
};

const operations = (): Operation[] =>
  channelFlows.flatMap(({ sender, receivers, routes, contracts }) =>
    contracts.flatMap((contract) => {
      const { channel } = routeOf(routes, contract);

      if (channel === undefined)
        throw new Error(`No channel for '${contract.type}'`);

      return [
        { module: sender, action: 'send' as const, channel, contract },
        ...receivers.map((module) => ({
          module,
          action: 'receive' as const,
          channel,
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

  return {
    asyncapi: '3.0.0',
    info: {
      title: module ? `E-commerce ${module}` : 'E-commerce',
      version: '1.0.0',
      description: module
        ? `The messages the ${module} module sends and receives.`
        : 'The messages the modules of the e-commerce sample send and receive.',
      tags: (module ? [module] : modules).map((name) => ({ name })),
    },
    servers,
    channels: Object.fromEntries(
      channelNames.map((channel) => [
        channel,
        {
          address: channel,
          description: `Channel ${channel}`,
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
      channel: routeOf(routes, contract).channel,
      key: routeOf(routes, contract).key,
    })),
  );
