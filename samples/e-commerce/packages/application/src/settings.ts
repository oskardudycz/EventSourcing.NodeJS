import { messagingBuses, type MessagingBus } from './messagingBus';
import type { EventStoreType } from './eventStore';

export const eventStoreTypes: readonly EventStoreType[] = [
  'sqlite',
  'postgresql',
];
export const internalDeliveries = ['store', 'broker'] as const;

export type InternalDelivery = (typeof internalDeliveries)[number];

export type Settings = {
  messagingBus: MessagingBus;
  eventStoreType: EventStoreType;
  workersScheduled: boolean;
  messagingInternalDelivery: InternalDelivery;
  kafkaPublishTimeoutInMs: number;
  rabbitMQPublishTimeoutInMs: number;
  messagingRetryInitialIntervalInMs: number;
  sqliteFolder?: string;
  postgreSQLUrl: string;
  kafkaBootstrapServers: string[];
  rabbitMQUrl: string;
  grafanaUrl: string;
  eventCatalogUrl: string;
  otlpEndpoint?: string;
};

type Environment = Record<string, string | undefined>;

const oneOf = <Value extends string>(
  environment: Environment,
  name: string,
  allowed: readonly Value[],
  fallback: Value,
): Value => {
  const value = environment[name];

  if (value === undefined || value === '') return fallback;

  const found = allowed.find((candidate) => candidate === value);

  if (found === undefined)
    throw new Error(
      `${name}=${value} is not allowed, use one of: ${allowed.join(', ')}`,
    );

  return found;
};

const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000 };

const durationInMs = (
  environment: Environment,
  name: string,
  fallbackInMs: number,
): number => {
  const value = environment[name];

  if (value === undefined || value === '') return fallbackInMs;

  const match = /^(\d+)(ms|s|m)$/.exec(value);

  if (!match)
    throw new Error(
      `${name}=${value} is not a duration, use for example 500ms, 10s or 1m`,
    );

  return Number(match[1]) * (units[match[2] ?? 'ms'] ?? 1);
};

const optional = (environment: Environment, name: string) => {
  const value = environment[name];

  return value === undefined || value === '' ? undefined : value;
};

export const readSettings = (environment: Environment): Settings => {
  const sqliteFolder = optional(environment, 'SQLITE_FOLDER');
  const otlpEndpoint = optional(environment, 'OTEL_EXPORTER_OTLP_ENDPOINT');

  return {
    messagingBus: oneOf(environment, 'MESSAGING_BUS', messagingBuses, 'kafka'),
    eventStoreType: oneOf(
      environment,
      'EVENTSTORE_TYPE',
      eventStoreTypes,
      'postgresql',
    ),
    workersScheduled:
      oneOf(environment, 'WORKERS_SCHEDULED', ['true', 'false'], 'true') ===
      'true',
    messagingInternalDelivery: oneOf(
      environment,
      'MESSAGING_INTERNAL_DELIVERY',
      internalDeliveries,
      'broker',
    ),
    kafkaPublishTimeoutInMs: durationInMs(
      environment,
      'MESSAGING_KAFKA_PUBLISH_TIMEOUT',
      10_000,
    ),
    rabbitMQPublishTimeoutInMs: durationInMs(
      environment,
      'MESSAGING_RABBITMQ_PUBLISH_TIMEOUT',
      10_000,
    ),
    messagingRetryInitialIntervalInMs: durationInMs(
      environment,
      'MESSAGING_RETRY_INITIAL_INTERVAL',
      1000,
    ),
    ...(sqliteFolder ? { sqliteFolder } : {}),
    postgreSQLUrl:
      optional(environment, 'POSTGRESQL_URL') ??
      'postgresql://postgres:postgres@localhost:5432/postgres',
    kafkaBootstrapServers: (
      optional(environment, 'KAFKA_BOOTSTRAP_SERVERS') ?? 'localhost:9092'
    ).split(','),
    rabbitMQUrl:
      optional(environment, 'RABBITMQ_URL') ??
      'amqp://guest:guest@localhost:5672',
    grafanaUrl:
      optional(environment, 'SHOP_GRAFANA_URL') ?? 'http://localhost:3000',
    eventCatalogUrl:
      optional(environment, 'SHOP_EVENTCATALOG_URL') ?? 'http://localhost:3001',
    ...(otlpEndpoint ? { otlpEndpoint } : {}),
  };
};
