import {
  observability,
  setupEmmettObservability,
} from '@event-driven-io/emmett';
import { otel } from '@event-driven-io/emmett/otel-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { NodeSDK, type NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { registerMetricSeriesAtZero } from './metricSeriesAtZero';

export const serviceName = 'e-commerce';

export const exportingOverOtlp = (
  endpoint: string,
  exportIntervalMillis = 10_000,
): Partial<NodeSDKConfiguration> => ({
  serviceName,
  traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis,
    }),
  ],
  logRecordProcessors: [
    new BatchLogRecordProcessor({
      exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
    }),
  ],
});

export const startTelemetry = (
  configuration: Partial<NodeSDKConfiguration>,
) => {
  const sdk = new NodeSDK(configuration);

  setupEmmettObservability(observability(otel({ sdk })));
  registerMetricSeriesAtZero();

  return {
    stop: async () => {
      setupEmmettObservability(undefined);
      await sdk.shutdown().catch(() => undefined);
    },
  };
};

export const startTelemetryFor = ({ otlpEndpoint }: { otlpEndpoint: string }) =>
  startTelemetry(exportingOverOtlp(otlpEndpoint));
