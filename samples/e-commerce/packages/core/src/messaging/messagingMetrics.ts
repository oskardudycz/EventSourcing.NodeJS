import type { Meter } from '@event-driven-io/almanac';
import { otelMeter } from '@event-driven-io/almanac/otel';
import { countDeadLettered } from './broker/deadLetters';

export const messagingMetricNames = {
  published: 'messaging.published',
  handled: 'messaging.handled',
  failed: 'messaging.failed',
  lag: 'messaging.lag.milliseconds',
} as const;

const attributesOf = (destination: string, messageType: string) => ({
  'messaging.destination.name': destination,
  'message.type': messageType,
});

export const messagingMetrics = (meter: Meter = otelMeter()) => ({
  published: (channel: string, messageType: string) =>
    meter
      .counter(messagingMetricNames.published)
      .add(1, attributesOf(channel, messageType)),
  handled: (
    queue: string,
    messageType: string,
    forwardedAt: string | undefined,
  ) => {
    meter
      .counter(messagingMetricNames.handled)
      .add(1, attributesOf(queue, messageType));

    if (forwardedAt !== undefined)
      meter
        .histogram(messagingMetricNames.lag)
        .record(
          Date.now() - Date.parse(forwardedAt),
          attributesOf(queue, messageType),
        );
  },
  failed: (queue: string, messageType: string) =>
    meter
      .counter(messagingMetricNames.failed)
      .add(1, attributesOf(queue, messageType)),
  deadLettered: (queue: string, messageType: string) =>
    countDeadLettered(meter, queue, messageType),
});

export const stampedAsForwarded = <
  Forwarded extends { metadata: { forwardedAt?: string } },
>(
  forwarded: Forwarded,
): Forwarded => ({
  ...forwarded,
  metadata: { ...forwarded.metadata, forwardedAt: new Date().toISOString() },
});
