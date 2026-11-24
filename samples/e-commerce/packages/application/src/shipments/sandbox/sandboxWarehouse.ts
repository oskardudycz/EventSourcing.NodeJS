import type {
  ConfirmPackageSent,
  DeliverPackage,
  RejectFulfillment,
  ShipmentProductItem,
} from '../shipmentCommand';
import type { WarehouseGateway } from '../warehouseGateway';

export const sandboxCarrier = 'Sandbox Express';

export type PackageStatus = 'Waiting' | 'Sent' | 'Rejected' | 'Delivered';

export type SandboxPackage = {
  shipmentId: string;
  productItems: ShipmentProductItem[];
  status: PackageStatus;
  requestedAt: Date;
};

export type SandboxWarehouse = WarehouseGateway & {
  isInStock: (productId: string) => boolean;
  stock: (productId: string, inStock: boolean) => void;
  packages: () => SandboxPackage[];
  find: (shipmentId: string) => SandboxPackage | undefined;
  send: (shipmentId: string) => Promise<void>;
  reject: (shipmentId: string) => Promise<void>;
  deliver: (shipmentId: string) => Promise<void>;
};

export const sandboxWarehouse = ({
  outOfStock,
  deliver,
  now,
}: {
  outOfStock: readonly string[];
  deliver: (
    command: ConfirmPackageSent | RejectFulfillment | DeliverPackage,
  ) => Promise<unknown>;
  now: () => Date;
}): SandboxWarehouse => {
  const unavailable = new Set(outOfStock);
  const packages = new Map<string, SandboxPackage>();

  const moved = (shipmentId: string, from: PackageStatus, to: PackageStatus) => {
    const current = packages.get(shipmentId);

    if (current?.status !== from) return false;

    packages.set(shipmentId, { ...current, status: to });
    return true;
  };

  const isInStock = (productId: string) => !unavailable.has(productId);

  return {
    isInStock,
    isProductAvailable: ({ productId }) =>
      Promise.resolve(isInStock(productId)),
    stock: (productId, inStock) => {
      if (inStock) unavailable.delete(productId);
      else unavailable.add(productId);
    },
    request: (shipmentId, productItems) => {
      if (!packages.has(shipmentId))
        packages.set(shipmentId, {
          shipmentId,
          productItems,
          status: 'Waiting',
          requestedAt: now(),
        });

      return Promise.resolve();
    },
    packages: () =>
      [...packages.values()].sort(
        (left, right) =>
          right.requestedAt.getTime() - left.requestedAt.getTime(),
      ),
    find: (shipmentId) => packages.get(shipmentId),
    send: async (shipmentId) => {
      if (!moved(shipmentId, 'Waiting', 'Sent')) return;

      await deliver({
        type: 'shipments.ConfirmPackageSent',
        data: {
          shipmentId,
          carrier: sandboxCarrier,
          trackingNumber: `SBX${Math.floor(Math.random() * 1e10)
            .toString()
            .padStart(10, '0')}`,
        },
      });
    },
    reject: async (shipmentId) => {
      if (!moved(shipmentId, 'Waiting', 'Rejected')) return;

      await deliver({
        type: 'shipments.RejectFulfillment',
        data: { shipmentId },
      });
    },
    deliver: async (shipmentId) => {
      if (!moved(shipmentId, 'Sent', 'Delivered')) return;

      await deliver({
        type: 'shipments.DeliverPackage',
        data: { shipmentId },
      });
    },
  };
};
