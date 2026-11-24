import { delay } from '@event-driven-io/emmett';
import { metrics, type Attributes } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { getContainerRuntimeClient } from 'testcontainers';
import { createServer } from 'node:net';

export type ContainerControl = {
  stop(): Promise<unknown>;
  start(): Promise<unknown>;
  pause(): Promise<unknown>;
  unpause(): Promise<unknown>;
};

export const containerControlOf = async (
  containerId: string,
): Promise<ContainerControl> => {
  const client = await getContainerRuntimeClient();
  const container = client.container.getById(containerId);

  return {
    stop: () => container.stop({ t: 1 }),
    start: () => container.start(),
    pause: () => container.pause(),
    unpause: () => container.unpause(),
  };
};

export const collectedCounters = () => {
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE,
  );
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 60_000,
  });
  metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));

  return {
    valueOf: async (name: string, attributes: Record<string, string>) => {
      await reader.forceFlush();
      const points = exporter
        .getMetrics()
        .flatMap((resource) => resource.scopeMetrics)
        .flatMap((scope) => scope.metrics)
        .filter((metric) => metric.descriptor.name === name)
        .flatMap((metric): { attributes: Attributes; value: unknown }[] => [
          ...metric.dataPoints,
        ]);
      const matching = points.filter((point) =>
        Object.entries(attributes).every(
          ([key, value]) => point.attributes[key] === value,
        ),
      );
      return matching.reduce(
        (sum, point) =>
          sum + (typeof point.value === 'number' ? point.value : 0),
        0,
      );
    },
  };
};

export const until = async (
  condition: () => boolean | Promise<boolean>,
  timeoutInMs = 20_000,
) => {
  const deadline = Date.now() + timeoutInMs;
  while (!(await condition())) {
    if (Date.now() > deadline)
      throw new Error(`The condition did not hold within ${timeoutInMs} ms`);
    await delay(25);
  }
};

export const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address !== null
          ? resolve(address.port)
          : reject(new Error('No port was assigned')),
      );
    });
  });
