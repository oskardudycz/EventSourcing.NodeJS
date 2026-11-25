import {
  action,
  send,
  type ActionStep,
  type MessagesStep,
} from '@e-commerce/core';
import type { ShipmentProductItem } from './shipmentCommand';
import type { WarehouseGateway } from './warehouseGateway';

export const carrier = 'UPS';
export const trackingNumber = '1Z999AA10123456784';

export type WarehouseFake = WarehouseGateway & {
  isOutOf: (productId: string) => ActionStep;
  isUnreachableFor: (shipmentId: string) => ActionStep;
  stockChecks: () => number;
  stockChecksOf: (productId: string) => number;
  stockCheckOfFails: (productId: string, times: number) => ActionStep;
  wasAskedToSend: (shipmentId: string) => boolean;
  requestsFor: (shipmentId: string) => ShipmentProductItem[][];
  sendsThePackage: (shipmentId: string) => MessagesStep;
  rejectsTheRequest: (shipmentId: string) => MessagesStep;
  deliversThePackage: (shipmentId: string) => MessagesStep;
};

export const warehouse = (): WarehouseFake => {
  const outOfStock = new Set<string>();
  const unreachable = new Set<string>();
  const requests = new Map<string, ShipmentProductItem[][]>();
  const stockChecks = new Map<string, number>();
  const failingStockChecks = new Map<string, number>();
  const stockChecksOf = (productId: string) => stockChecks.get(productId) ?? 0;

  const requestsFor = (shipmentId: string) => requests.get(shipmentId) ?? [];

  return {
    stockChecks: () =>
      [...stockChecks.values()].reduce((total, checks) => total + checks, 0),
    stockChecksOf,
    stockCheckOfFails: (productId, times) =>
      action(() => {
        failingStockChecks.set(productId, times);
      }),
    isProductAvailable: ({ productId }) => {
      stockChecks.set(productId, stockChecksOf(productId) + 1);

      const failuresLeft = failingStockChecks.get(productId) ?? 0;

      if (failuresLeft > 0) {
        failingStockChecks.set(productId, failuresLeft - 1);

        return Promise.reject(new Error('Warehouse is unreachable'));
      }

      return Promise.resolve(!outOfStock.has(productId));
    },
    isOutOf: (productId) =>
      action(() => {
        outOfStock.add(productId);
      }),
    isUnreachableFor: (shipmentId) =>
      action(() => {
        unreachable.add(shipmentId);
      }),
    wasAskedToSend: (shipmentId) => requestsFor(shipmentId).length > 0,
    requestsFor,
    sendsThePackage: (shipmentId) =>
      send({
        type: 'shipments.ConfirmPackageSent',
        data: { shipmentId, carrier, trackingNumber },
      }),
    rejectsTheRequest: (shipmentId) =>
      send({ type: 'shipments.RejectFulfillment', data: { shipmentId } }),
    deliversThePackage: (shipmentId) =>
      send({ type: 'shipments.DeliverPackage', data: { shipmentId } }),
    request: (shipmentId, productItems) => {
      if (unreachable.has(shipmentId))
        return Promise.reject(new Error('Warehouse is unreachable'));

      requests.set(shipmentId, [...requestsFor(shipmentId), productItems]);

      return Promise.resolve();
    },
  };
};
