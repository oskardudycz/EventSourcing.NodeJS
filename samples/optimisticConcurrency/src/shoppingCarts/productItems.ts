export type ProductItem = Readonly<{
  productId: string;
  quantity: number;
}>;

export function findProductItem(
  productItems: ProductItem[],
  productId: string
): ProductItem | undefined {
  return productItems.find((pi) => pi.productId === productId);
}

export function addProductItem(
  productItems: ProductItem[],
  newProductItem: ProductItem
): ProductItem[] {
  const { productId, quantity } = newProductItem;

  const currentProductItem = findProductItem(productItems, productId);

  if (!currentProductItem) return [...productItems, newProductItem];

  const newQuantity = currentProductItem.quantity + quantity;
  const mergedProductItem = { productId, quantity: newQuantity };

  return productItems.map((pi) =>
    pi.productId === productId ? mergedProductItem : pi
  );
}

export function removeProductItem(
  productItems: ProductItem[],
  newProductItem: ProductItem
): ProductItem[] {
  const { productId, quantity } = newProductItem;

  const currentProductItem = findProductItem(productItems, productId);

  const newQuantity = (currentProductItem?.quantity ?? 0) - quantity;

  if (newQuantity < 0) throw 'PRODUCT_ITEM_NOT_FOUND';

  if (newQuantity === 0)
    return productItems.filter((pi) => pi.productId !== productId);

  const mergedProductItem = { productId, quantity: newQuantity };

  return productItems.map((pi) =>
    pi.productId === productId ? mergedProductItem : pi
  );
}
