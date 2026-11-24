import type { EventStore } from '@event-driven-io/emmett';
import type { PongoClient } from '@event-driven-io/pongo';
import { metrics } from '@opentelemetry/api';
import type { ModuleConsumer } from '../moduleConsumer';
import { orderStatusesCollection } from './getOrderStatus/orderStatuses';
import { OrderId, type OrderEvent } from './order';
import { ordersAwaitingPaymentCollection } from './unpaid/ordersAwaitingPayment';

export const orderMetricsProcessorId = 'orders-metrics';

const orderMetricTypes = [
  'orders.OrderConfirmed',
  'orders.OrderPackageSent',
  'orders.OrderPaymentCaptured',
  'orders.OrderCompleted',
] as const;

const secondsBetween = (from: string, to: string) =>
  (Date.parse(to) - Date.parse(from)) / 1000;

export const registerOrderMetrics = (
  orders: ModuleConsumer,
  { eventStore, pongo }: { eventStore: EventStore; pongo: PongoClient },
) => {
  const meter = metrics.getMeter('e-commerce');
  const revenue = meter.createHistogram('ecommerce.order.revenue', {
    description: 'The amounts charged for completed orders',
  });
  const leadTime = meter.createHistogram('ecommerce.order.lead.time', {
    description: 'Time from placing an order to the stage',
    unit: 's',
  });
  const inProgress = meter.createObservableGauge(
    'ecommerce.orders.in.progress',
    {
      description:
        'Orders placed and not yet completed, canceled or closed unpaid',
    },
  );
  const awaitingPayment = meter.createObservableGauge(
    'ecommerce.orders.awaiting.payment',
    {
      description:
        'Orders whose payment failed and that wait for the customer to pay again',
    },
  );

  inProgress.addCallback(async (result) =>
    result.observe(
      await pongo
        .db()
        .collection(orderStatusesCollection)
        .countDocuments({ stage: { $ne: 'Ended' } }),
    ),
  );
  awaitingPayment.addCallback(async (result) =>
    result.observe(
      await pongo
        .db()
        .collection(ordersAwaitingPaymentCollection)
        .countDocuments({}),
    ),
  );

  const placedAtOf = async (orderId: string) => {
    const { events } = await eventStore.readStream<OrderEvent>(
      OrderId.workflowStreamNameOf(orderId),
    );

    return events.find((event) => event.type === 'orders.OrderPlaced')?.data
      .placedAt;
  };

  const recordLeadTime = async (
    orderId: string,
    stage: 'paid' | 'sent' | 'completed',
    at: string,
  ) => {
    const placedAt = await placedAtOf(orderId);

    if (placedAt !== undefined)
      leadTime.record(secondsBetween(placedAt, at), {
        'ecommerce.order.stage': stage,
      });
  };

  orders.reactor<OrderEvent>({
    processorId: orderMetricsProcessorId,
    canHandle: [...orderMetricTypes],
    eachMessage: async (event) => {
      switch (event.type) {
        case 'orders.OrderConfirmed':
          return recordLeadTime(
            event.data.orderId,
            'paid',
            event.data.confirmedAt,
          );
        case 'orders.OrderPackageSent':
          return recordLeadTime(event.data.orderId, 'sent', event.data.sentAt);
        case 'orders.OrderPaymentCaptured':
          return revenue.record(event.data.amount);
        case 'orders.OrderCompleted':
          return recordLeadTime(
            event.data.orderId,
            'completed',
            event.data.completedAt,
          );
        default:
          return;
      }
    },
  });
};
