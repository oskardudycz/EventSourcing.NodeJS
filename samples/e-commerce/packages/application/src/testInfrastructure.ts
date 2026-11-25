import { startKafka, startRabbitMQ, until } from '@e-commerce/core/containers';
import { getPostgreSQLStartedContainer } from '@event-driven-io/emmett-testcontainers';
import { GenericContainer, Wait } from 'testcontainers';

export const startPostgreSQL = async () => {
  const container = await getPostgreSQLStartedContainer();

  return {
    connectionString: container.getConnectionUri(),
    stop: () => container.stop(),
  };
};

const grafanaImage = 'grafana/otel-lgtm:0.41.0';
const dockerComposeGrafana = {
  url: 'http://localhost:3000',
  otlpEndpoint: 'http://localhost:4318',
};

const isRunning = (url: string) =>
  fetch(`${url}/api/health`).then(
    (response) => response.ok,
    () => false,
  );

export const startGrafana = async () => {
  if (await isRunning(dockerComposeGrafana.url))
    return { ...dockerComposeGrafana, stop: () => Promise.resolve() };

  const container = await new GenericContainer(grafanaImage)
    .withEnvironment({ GF_PLUGINS_PREINSTALL_AUTO_UPDATE: 'false' })
    .withCopyDirectoriesToContainer([
      { source: 'observability/dashboards', target: '/otel-lgtm/dashboards' },
    ])
    .withCopyFilesToContainer([
      {
        source: 'observability/dashboards.yaml',
        target:
          '/otel-lgtm/grafana/conf/provisioning/dashboards/e-commerce.yaml',
      },
      {
        source: 'observability/alerting/ecommerce.yaml',
        target: '/otel-lgtm/grafana/conf/provisioning/alerting/e-commerce.yaml',
      },
    ])
    .withExposedPorts(3000, 4318)
    .withWaitStrategy(
      Wait.forLogMessage(/The OpenTelemetry collector and the Grafana LGTM/),
    )
    .withStartupTimeout(180_000)
    .start();

  return {
    url: `http://${container.getHost()}:${container.getMappedPort(3000)}`,
    otlpEndpoint: `http://${container.getHost()}:${container.getMappedPort(4318)}`,
    stop: () => container.stop().then(() => undefined),
  };
};

export { startKafka, startRabbitMQ, until };
