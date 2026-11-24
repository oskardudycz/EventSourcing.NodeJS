import { describe, expect, it } from 'vitest';
import { readSettings } from './settings';

describe('settings', () => {
  it('startFromTheKafkaAndPostgreSQLSetupWhenNothingIsSet', () => {
    expect(readSettings({})).toMatchObject({
      messagingBus: 'kafka',
      eventStoreType: 'postgresql',
      workersScheduled: true,
      messagingInternalDelivery: 'broker',
      kafkaPublishTimeoutInMs: 10_000,
      rabbitMQPublishTimeoutInMs: 10_000,
      messagingRetryInitialIntervalInMs: 1000,
      postgreSQLUrl: 'postgresql://postgres:postgres@localhost:5432/postgres',
      kafkaBootstrapServers: ['localhost:9092'],
      rabbitMQUrl: 'amqp://guest:guest@localhost:5672',
      grafanaUrl: 'http://localhost:3000',
      eventCatalogUrl: 'http://localhost:3001',
    });
  });

  it('readEverySettingFromTheEnvironment', () => {
    expect(
      readSettings({
        MESSAGING_BUS: 'rabbitmq',
        EVENTSTORE_TYPE: 'sqlite',
        WORKERS_SCHEDULED: 'false',
        MESSAGING_INTERNAL_DELIVERY: 'store',
        MESSAGING_KAFKA_PUBLISH_TIMEOUT: '500ms',
        MESSAGING_RABBITMQ_PUBLISH_TIMEOUT: '2s',
        MESSAGING_RETRY_INITIAL_INTERVAL: '1m',
        SQLITE_FOLDER: '/data/shop',
        POSTGRESQL_URL: 'postgresql://shop@db/shop',
        KAFKA_BOOTSTRAP_SERVERS: 'one:9092,two:9092',
        RABBITMQ_URL: 'amqp://shop@mq',
        SHOP_GRAFANA_URL: 'http://grafana',
        SHOP_EVENTCATALOG_URL: 'http://catalog',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel:4318',
      }),
    ).toEqual({
      messagingBus: 'rabbitmq',
      eventStoreType: 'sqlite',
      workersScheduled: false,
      messagingInternalDelivery: 'store',
      kafkaPublishTimeoutInMs: 500,
      rabbitMQPublishTimeoutInMs: 2000,
      messagingRetryInitialIntervalInMs: 60_000,
      sqliteFolder: '/data/shop',
      postgreSQLUrl: 'postgresql://shop@db/shop',
      kafkaBootstrapServers: ['one:9092', 'two:9092'],
      rabbitMQUrl: 'amqp://shop@mq',
      grafanaUrl: 'http://grafana',
      eventCatalogUrl: 'http://catalog',
      otlpEndpoint: 'http://otel:4318',
    });
  });

  it.each([
    ['MESSAGING_BUS', 'sqs', 'kafka, rabbitmq, in-memory, none'],
    ['EVENTSTORE_TYPE', 'mongodb', 'sqlite, postgresql'],
    ['MESSAGING_INTERNAL_DELIVERY', 'carrier-pigeon', 'store, broker'],
    ['WORKERS_SCHEDULED', 'sometimes', 'true, false'],
  ])(
    'startFailsNamingTheSettingAndItsAllowedValues %s=%s',
    (name, value, allowed) => {
      expect(() => readSettings({ [name]: value })).toThrow(
        `${name}=${value} is not allowed, use one of: ${allowed}`,
      );
    },
  );

  it('startFailsNamingADurationThatIsNotOne', () => {
    expect(() =>
      readSettings({ MESSAGING_KAFKA_PUBLISH_TIMEOUT: 'soon' }),
    ).toThrow(
      'MESSAGING_KAFKA_PUBLISH_TIMEOUT=soon is not a duration, use for example 500ms, 10s or 1m',
    );
  });
});
