import { afterAll, beforeAll, describe } from 'vitest';
import { purchaseScenarios } from './purchaseScenarios';
import { startPostgreSQL, startRabbitMQ } from './testInfrastructure';

describe('purchases on RabbitMQ with PostgreSQL', () => {
  let rabbitMQ: Awaited<ReturnType<typeof startRabbitMQ>>;

  beforeAll(async () => {
    rabbitMQ = await startRabbitMQ();
  }, 120_000);

  afterAll(() => rabbitMQ.stop());

  purchaseScenarios(async () => {
    const postgreSQL = await startPostgreSQL();

    return {
      environment: {
        MESSAGING_BUS: 'rabbitmq',
        EVENTSTORE_TYPE: 'postgresql',
        POSTGRESQL_URL: postgreSQL.connectionString,
        RABBITMQ_URL: rabbitMQ.connection.url,
      },
      stop: async () => {
        await postgreSQL.stop();
      },
    };
  });
});
