import {
  assertNotEmptyString,
  assertPositiveNumber,
  IllegalStateError,
  ValidationError,
} from '@event-driven-io/emmett';

export type ProductItem = { productId: string; quantity: number };
export type PricedProductItem = ProductItem & { unitPrice: number };

export const toCents = (amount: number) => Math.round(amount * 100) / 100;

const totalPriceOf = (item: PricedProductItem) =>
  toCents(item.quantity * item.unitPrice);

const find = (items: readonly PricedProductItem[], productId: string) =>
  items.find((item) => item.productId === productId);

const findWithPrice = (
  items: readonly PricedProductItem[],
  productItem: PricedProductItem,
) =>
  items.find(
    (item) =>
      item.productId === productItem.productId &&
      item.unitPrice === productItem.unitPrice,
  );

const assertThatCanRemove = (
  items: readonly PricedProductItem[],
  productItem: PricedProductItem,
): PricedProductItem => {
  const current = findWithPrice(items, productItem);

  if (!current) throw new IllegalStateError("Product item wasn't found");

  if (current.quantity < productItem.quantity)
    throw new IllegalStateError('Not enough product items');

  return current;
};

export const ProductItems = {
  find,
  assertThatCanRemove,
  totalPriceOf,

  add: (
    items: readonly PricedProductItem[],
    productItem: PricedProductItem,
  ): PricedProductItem[] => {
    const current = findWithPrice(items, productItem);

    return current
      ? items.map((item) =>
          item === current
            ? { ...item, quantity: item.quantity + productItem.quantity }
            : item,
        )
      : [...items, productItem];
  },

  remove: (
    items: readonly PricedProductItem[],
    productItem: PricedProductItem,
  ): PricedProductItem[] => {
    const current = assertThatCanRemove(items, productItem);

    return current.quantity === productItem.quantity
      ? items.filter((item) => item !== current)
      : items.map((item) =>
          item === current
            ? { ...item, quantity: item.quantity - productItem.quantity }
            : item,
        );
  },

  changeUnitPrice: (
    items: readonly PricedProductItem[],
    productId: string,
    unitPrice: number,
  ): PricedProductItem[] =>
    items.map((item) =>
      item.productId === productId ? { ...item, unitPrice } : item,
    ),

  totalPrice: (items: readonly PricedProductItem[]): number =>
    toCents(items.reduce((sum, item) => sum + totalPriceOf(item), 0)),
};

export const assertProductItem = (value: unknown): ProductItem => {
  if (typeof value !== 'object' || value === null)
    throw new ValidationError('Body has to be a JSON object');

  return {
    productId: assertNotEmptyString(
      'productId' in value ? value.productId : undefined,
    ),
    quantity: assertPositiveNumber(
      'quantity' in value ? value.quantity : undefined,
    ),
  };
};
