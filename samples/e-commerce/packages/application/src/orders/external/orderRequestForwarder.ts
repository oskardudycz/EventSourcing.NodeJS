import {
  getForwarderId,
  type ForwardingHandler,
  type ForwardTo,
  type HandlerRetryOptions,
} from '@e-commerce/core';
import type { OrderRequest } from '../orderWorkflow';
import { orderRequestRoutes, ordersChannels } from '../ordersConfig';

export const ordersRequestForwarderId = getForwarderId({
  name: 'orders-requests',
});

export const orderRequestForwarder = ({
  forward,
  ...retry
}: HandlerRetryOptions & {
  forward: ForwardTo;
}): ForwardingHandler<OrderRequest> =>
  forward<OrderRequest>({
    channels: ordersChannels,
    routes: orderRequestRoutes,
    ...retry,
  });
