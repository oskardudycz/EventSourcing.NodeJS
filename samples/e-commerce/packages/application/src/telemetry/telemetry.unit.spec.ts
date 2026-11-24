import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { afterEach, describe, expect, it } from 'vitest';
import { messageContracts } from '../documentation/allContracts';
import { startTelemetry } from './telemetry';

describe('telemetry', () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it('emmettCountersStartAtZeroForEveryModuleType', async () => {
    const exporter = new InMemoryMetricExporter(
      AggregationTemporality.CUMULATIVE,
    );
    const reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 60_000,
    });
    ({ stop } = startTelemetry({ metricReaders: [reader] }));

    await reader.forceFlush();

    const series = exporter
      .getMetrics()
      .flatMap(({ scopeMetrics }) => scopeMetrics)
      .flatMap(({ metrics }) => metrics)
      .map(({ descriptor, dataPoints }) => ({
        name: descriptor.name,
        points: dataPoints.map(({ attributes, value }) => ({
          attributes,
          value,
        })),
      }));
    const pointsOf = (name: string) =>
      series.find((metric) => metric.name === name)?.points ?? [];
    const events = messageContracts.filter(({ kind }) => kind === 'event');
    const commands = messageContracts.filter(({ kind }) => kind === 'command');

    expect(pointsOf('emmett.event.appending.count')).toHaveLength(
      events.length,
    );
    expect(
      pointsOf('emmett.event.appending.count').every(
        ({ value }) => value === 0,
      ),
    ).toBe(true);
    expect(
      pointsOf('emmett.event.appending.count').map(
        ({ attributes }) => attributes['emmett.event.type'],
      ),
    ).toEqual(
      expect.arrayContaining([
        'orders.OrderPlaced',
        'payments.PaymentCaptureFailed',
      ]),
    );
    expect(pointsOf('emmett.command.handling.count')).toHaveLength(
      commands.length * 2,
    );
    expect(
      pointsOf('emmett.command.handling.count').every(
        ({ value }) => value === 0,
      ),
    ).toBe(true);
  });
});
