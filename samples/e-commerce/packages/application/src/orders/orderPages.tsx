import { retryIfNotFound, retryUntil, versionSeenBy } from '@e-commerce/core';
import { NotFoundError } from '@event-driven-io/emmett';
import {
  setETag,
  toWeakETag,
  type WebApiSetup,
} from '@event-driven-io/emmett-honojs';
import type { Context } from 'hono';
import { PaymentId } from '../payments/payment';
import { customerPage } from '../shop/customer';
import { demoProductName } from '../shop/demoProducts';
import { formatPrice, ShopPage, type ShopLinks } from '../shop/shopLayout';
import {
  cancelOrderOf,
  orderPageOf,
  ordersPageOf,
  retryPaymentOf,
} from '../shop/shopUrls';
import type { CustomerOrders } from './getCustomerOrders/customerOrders';
import type { OrderStatuses } from './getOrderStatus/orderStatuses';
import { OrderId, type OrderProgress } from './order';
import type { OrderWorkflowInput } from './orderWorkflow';

const progressLabels: Record<OrderProgress, string> = {
  AwaitingPayment: 'Awaiting payment',
  PaymentFailed: 'Payment failed',
  OutOfStock: 'Out of stock',
  Processing: 'Processing',
  Shipped: 'Shipped',
  Completed: 'Completed',
  Canceled: 'Canceled',
  ClosedUnpaid: 'Closed unpaid',
};

const finalProgress: readonly OrderProgress[] = [
  'Completed',
  'Canceled',
  'ClosedUnpaid',
];

type Status = NonNullable<Awaited<ReturnType<OrderStatuses['get']>>>;

const OrderPlacing = ({
  customerId,
  orderNumber,
}: {
  customerId: string;
  orderNumber: string;
}) => (
  <main
    class="page narrow"
    id="order"
    hx-get={orderPageOf(customerId, orderNumber)}
    hx-trigger="every 1s"
    hx-swap="outerMorph"
  >
    <div class="page-title">
      <div>
        <h1>Order status</h1>
        <p class="muted">Order #{orderNumber}</p>
      </div>
    </div>
    <section class="card">
      <p>Your order is being placed</p>
    </section>
  </main>
);

const OrderStatusPart = ({
  customerId,
  orderNumber,
  order,
}: {
  customerId: string;
  orderNumber: string;
  order: Status;
}) => {
  const polling = !finalProgress.includes(order.progress);
  const paymentNumber = PaymentId.tailOf(order.paymentId);
  const pageUrl = orderPageOf(customerId, orderNumber);

  return (
    <main
      class="page narrow"
      id="order"
      {...(polling
        ? {
            'hx-get': pageUrl,
            'hx-trigger': 'every 1s',
            'hx-swap': 'outerMorph',
            'hx-headers': JSON.stringify({
              'If-None-Match': toWeakETag(order.version),
            }),
          }
        : {})}
    >
      <div class="page-title">
        <div>
          <h1>Order status</h1>
          <p class="muted">Order #{orderNumber}</p>
        </div>
        <span class={`badge large ${order.progress}`}>
          {progressLabels[order.progress]}
        </span>
      </div>
      <section class="card">
        <table class="lines">
          <thead>
            <tr>
              <th>Product</th>
              <th class="number">Quantity</th>
              <th class="number">Price</th>
            </tr>
          </thead>
          <tbody>
            {order.productItems.map((item) => (
              <tr>
                <td>{demoProductName(item.productId)}</td>
                <td class="number">{item.quantity}</td>
                <td class="number">{formatPrice(item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div class="summary">
          <span>Total</span>
          <strong>{formatPrice(order.totalPrice)}</strong>
        </div>
      </section>
      {order.progress === 'OutOfStock' && (
        <section class="card notice">
          <p>
            The warehouse doesn't have all the products, so the shop can't send
            this order. Cancel it and order again without the missing products.
          </p>
        </section>
      )}
      {order.carrier && (
        <section class="card">
          <h2>Shipping</h2>
          <p>
            <span>{order.carrier}</span> · tracking number{' '}
            <code>{order.trackingNumber}</code>
          </p>
        </section>
      )}
      <section class="actions">
        {order.actions.includes('PayNow') && (
          <form
            method="post"
            action={`/customers/${customerId}/orders/${orderNumber}/payments/${paymentNumber}/checkout-session`}
          >
            <button class="button primary" type="submit">
              Pay now
            </button>
          </form>
        )}
        {order.actions.includes('RetryPayment') && (
          <form method="post" action={retryPaymentOf(customerId, orderNumber)}>
            <button class="button primary" type="submit">
              Retry payment
            </button>
          </form>
        )}
        {order.actions.includes('CancelOrder') && (
          <form method="post" action={cancelOrderOf(customerId, orderNumber)}>
            <button class="button" type="submit">
              Cancel order
            </button>
          </form>
        )}
      </section>
    </main>
  );
};

export const orderPages =
  ({
    sendToOrder,
    customerOrders,
    orderStatuses,
    links,
  }: {
    sendToOrder: (command: OrderWorkflowInput) => Promise<unknown>;
    customerOrders: CustomerOrders;
    orderStatuses: OrderStatuses;
    links: ShopLinks;
  }): WebApiSetup =>
  (router) => {
    const findStatus = async (customerId: string, orderNumber: string) => {
      const status = await orderStatuses.get(
        OrderId.of(`${customerId}-${orderNumber}`),
      );

      return status?.customerId === customerId ? status : null;
    };

    const statusOf = async (customerId: string, orderNumber: string) => {
      const status = await findStatus(customerId, orderNumber);

      if (!status) throw new NotFoundError({ type: 'Order', id: orderNumber });

      return status;
    };

    const orderPart = async (
      context: Context,
      customerId: string,
      orderNumber: string,
    ) => {
      const seen = versionSeenBy(context);
      const found = await retryUntil(
        () => findStatus(customerId, orderNumber),
        (status) => status.version > seen,
      );

      if (!found)
        return context.html(
          <OrderPlacing customerId={customerId} orderNumber={orderNumber} />,
        );

      setETag(context, toWeakETag(found.version));

      if (found.version <= seen) return context.body(null, 304);

      return context.html(
        <OrderStatusPart
          customerId={customerId}
          orderNumber={orderNumber}
          order={found}
        />,
      );
    };

    router.get(
      ordersPageOf(':customerId'),
      customerPage(async (context, customer) => {
        const orders = await customerOrders.of(customer.id);

        return context.html(
          <ShopPage
            title="Orders"
            links={links}
            customerId={customer.id}
            customerName={customer.name}
            current="orders"
          >
            <main class="page narrow">
              <h1>Orders</h1>
              {orders.length === 0 ? (
                <section class="card empty">
                  <p>You have no orders yet.</p>
                </section>
              ) : (
                <section class="card">
                  <table class="lines">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Placed</th>
                        <th>Status</th>
                        <th class="number">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr>
                          <td>
                            <a
                              href={orderPageOf(
                                customer.id,
                                OrderId.numberOf(order.orderId),
                              )}
                            >
                              Order #{OrderId.numberOf(order.orderId)}
                            </a>
                          </td>
                          <td class="nowrap">
                            {order.placedAt.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td>
                            <span class={`badge ${order.progress}`}>
                              {progressLabels[order.progress]}
                            </span>
                          </td>
                          <td class="number">
                            {formatPrice(order.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </main>
          </ShopPage>,
        );
      }),
    );

    router.get(
      orderPageOf(':customerId', ':orderNumber'),
      customerPage(async (context, customer) => {
        const orderNumber = context.req.param('orderNumber') ?? '';

        if (context.req.header('hx-request') === 'true')
          return orderPart(context, customer.id, orderNumber);

        const order = await retryIfNotFound(() =>
          findStatus(customer.id, orderNumber),
        );

        return context.html(
          <ShopPage
            title="Order status"
            links={links}
            customerId={customer.id}
            customerName={customer.name}
            current="orders"
            refreshWithoutScript={!order}
          >
            {order ? (
              <OrderStatusPart
                customerId={customer.id}
                orderNumber={orderNumber}
                order={order}
              />
            ) : (
              <OrderPlacing
                customerId={customer.id}
                orderNumber={orderNumber}
              />
            )}
          </ShopPage>,
        );
      }),
    );

    router.post(
      cancelOrderOf(':customerId', ':orderNumber'),
      customerPage(async (context, customer) => {
        const orderNumber = context.req.param('orderNumber') ?? '';
        const { orderId } = await statusOf(customer.id, orderNumber);

        await sendToOrder({
          type: 'orders.CancelOrder',
          data: { orderId, cancellationReason: 'Requested' },
        });

        return context.redirect(orderPageOf(customer.id, orderNumber), 303);
      }),
    );

    router.post(
      retryPaymentOf(':customerId', ':orderNumber'),
      customerPage(async (context, customer) => {
        const orderNumber = context.req.param('orderNumber') ?? '';
        const { orderId } = await statusOf(customer.id, orderNumber);

        await sendToOrder({
          type: 'orders.RetryOrderPayment',
          data: { orderId },
        });

        return context.redirect(orderPageOf(customer.id, orderNumber), 303);
      }),
    );
  };
