import { z } from 'zod';
import type { CustomerOrder } from '../orders/getCustomerOrders/customerOrders';
import type { OrderStatus } from '../orders/getOrderStatus/orderStatuses';
import type { Cart } from '../shoppingCarts/getCart/carts';
import type { ProductItem } from '../shoppingCarts/productItems';
import {
  at,
  cartId,
  customerId,
  orderId,
  paymentId,
  pricedProductItem,
} from './fixtures';
import { pricedProductItemSchema } from './shoppingCartContracts';

export type BodyContract = {
  name: string;
  schema: z.ZodType;
  allFields: unknown;
  requiredOnly?: unknown;
};

const bodyContract = <Body>(contract: {
  name: string;
  schema: z.ZodType<Body>;
  allFields: Body;
  requiredOnly?: Body;
}): BodyContract => contract;

export const productItemSchema = z
  .object({
    productId: z.string().describe('Id of the product'),
    quantity: z.number().positive().describe('How many to add'),
  })
  .meta({ id: 'ProductItem' });

export const cartSchema = z
  .object({
    shoppingCartId: z.string(),
    customerId: z.string(),
    lines: z.array(pricedProductItemSchema),
    totalPrice: z.number(),
    checkedOut: z.boolean(),
    version: z.number(),
  })
  .meta({ id: 'Cart' });

const orderProgress = z.enum([
  'AwaitingPayment',
  'PaymentFailed',
  'OutOfStock',
  'Processing',
  'Shipped',
  'Completed',
  'Canceled',
  'ClosedUnpaid',
]);

export const orderStatusSchema = z
  .object({
    customerId: z.string(),
    productItems: z.array(pricedProductItemSchema),
    totalPrice: z.number(),
    placedAt: z.string(),
    paymentId: z.string(),
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
    progress: orderProgress,
    stage: z.enum(['Opened', 'Confirmed', 'Ended']),
    payment: z.enum(['Pending', 'Authorized', 'Captured', 'Failed']),
    shipment: z.enum(['Pending', 'Reserved', 'Sent', 'Failed']),
    version: z.number(),
  })
  .meta({ id: 'OrderStatus' });

export const customerOrderSchema = z
  .object({
    orderId: z.string(),
    customerId: z.string(),
    placedAt: z.string(),
    totalPrice: z.number(),
    progress: orderProgress,
    shipped: z.boolean(),
  })
  .meta({ id: 'CustomerOrder' });

export const problemDetailsSchema = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    status: z.number(),
    detail: z.string().optional(),
    instance: z.string().optional(),
  })
  .meta({ id: 'ProblemDetails' });

const orderStatusFields: OrderStatus = {
  customerId,
  productItems: [pricedProductItem],
  totalPrice: 39.98,
  placedAt: at,
  paymentId,
  progress: 'Shipped',
  stage: 'Confirmed',
  payment: 'Authorized',
  shipment: 'Sent',
  version: 5,
};

export const bodyContracts: BodyContract[] = [
  bodyContract<ProductItem>({
    name: 'ProductItem',
    schema: productItemSchema,
    allFields: { productId: 'product-1', quantity: 2 },
  }),
  bodyContract<Cart>({
    name: 'Cart',
    schema: cartSchema,
    allFields: {
      shoppingCartId: cartId,
      customerId,
      lines: [pricedProductItem],
      totalPrice: 39.98,
      checkedOut: false,
      version: 1,
    },
  }),
  bodyContract<OrderStatus>({
    name: 'OrderStatus',
    schema: orderStatusSchema,
    allFields: {
      ...orderStatusFields,
      carrier: 'Sandbox Express',
      trackingNumber: 'SB-1',
    },
    requiredOnly: orderStatusFields,
  }),
  bodyContract<CustomerOrder>({
    name: 'CustomerOrder',
    schema: customerOrderSchema,
    allFields: {
      orderId,
      customerId,
      placedAt: at,
      totalPrice: 39.98,
      progress: 'Shipped',
      shipped: true,
    },
  }),
];
