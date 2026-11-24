import { startKafka, startRabbitMQ, until } from '@e-commerce/core/containers';
import { getPostgreSQLStartedContainer } from '@event-driven-io/emmett-testcontainers';

export const startPostgreSQL = async () => {
  const container = await getPostgreSQLStartedContainer();

  return {
    connectionString: container.getConnectionUri(),
    stop: () => container.stop(),
  };
};

export { startKafka, startRabbitMQ, until };
