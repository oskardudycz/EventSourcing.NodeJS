import { bodyContracts } from './httpContracts';
import type { MessageContract } from './messageContract';
import { orderStoredContracts } from './orderContracts';
import {
  paymentRequestContracts,
  paymentResponseContracts,
  paymentStoredContracts,
} from './paymentContracts';
import {
  shipmentRequestContracts,
  shipmentResponseContracts,
  shipmentStoredContracts,
} from './shipmentContracts';
import {
  shoppingCartCheckedOutExternal,
  shoppingCartStoredContracts,
} from './shoppingCartContracts';

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

export { bodyContracts };
