import { afterAll, beforeAll, describe } from 'vitest';
import { purchaseScenarios } from './purchaseScenarios';
import { startKafka, startPostgreSQL } from './testInfrastructure';

describe('purchases on Kafka with PostgreSQL', () => {
  let kafka: Awaited<ReturnType<typeof startKafka>>;

  beforeAll(async () => {
    kafka = await startKafka();
  }, 120_000);

  afterAll(() => kafka.stop());

  purchaseScenarios(async () => {
    const postgreSQL = await startPostgreSQL();

    return {
      environment: {
        MESSAGING_BUS: 'kafka',
        EVENTSTORE_TYPE: 'postgresql',
        POSTGRESQL_URL: postgreSQL.connectionString,
        KAFKA_BOOTSTRAP_SERVERS: kafka.connection.bootstrapBrokers.join(','),
      },
      stop: async () => {
        await postgreSQL.stop();
      },
    };
  });
});
