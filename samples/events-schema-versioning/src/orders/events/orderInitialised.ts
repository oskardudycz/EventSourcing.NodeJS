import { Event } from '../../core/events';
import { ProductItem } from '../valueObjects/productItem';

export type ORDER_INITIALISED = 'order-initialised';

export type OrderInitialised = Event<
  ORDER_INITIALISED,
  {
    readonly orderId: string;
    readonly clientId: string;
    readonly productItems: ReadonlyArray<ProductItem>;
    readonly totalAmount: number;
    readonly initialisedAt: Date;
  }
>;
