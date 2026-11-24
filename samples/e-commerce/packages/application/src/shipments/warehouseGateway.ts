import type { ShipmentProductItem } from './shipmentCommand';

export type WarehouseGateway = {
  isProductAvailable: (productItem: ShipmentProductItem) => Promise<boolean>;
  request: (
    shipmentId: string,
    productItems: ShipmentProductItem[],
  ) => Promise<void>;
};
