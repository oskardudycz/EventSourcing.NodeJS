import type { MessageContract } from './messageContract';
import { orderStoredContracts } from '../orders/orderContracts';
import {
  paymentRequestContracts,
  paymentResponseContracts,
  paymentStoredContracts,
} from '../payments/paymentContracts';
import {
  shipmentRequestContracts,
  shipmentResponseContracts,
  shipmentStoredContracts,
} from '../shipments/shipmentContracts';
import {
  shoppingCartCheckedOutExternal,
  shoppingCartStoredContracts,
} from '../shoppingCarts/shoppingCartContracts';

export const messageContracts: MessageContract[] = [
  ...shoppingCartStoredContracts,
  shoppingCartCheckedOutExternal,
  ...orderStoredContracts,
  ...paymentStoredContracts,
  ...paymentRequestContracts,
  ...paymentResponseContracts,
  ...shipmentStoredContracts,
  ...shipmentRequestContracts,
  ...shipmentResponseContracts,
];
