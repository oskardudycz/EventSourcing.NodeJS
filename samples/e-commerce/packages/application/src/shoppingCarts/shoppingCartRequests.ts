import type { TestRequest } from '@event-driven-io/emmett-honojs';
import type { SignedInCustomer } from '../shop/customer';
import type { ShopRequests } from '../shop/shopRequests';
import {
  addToCartOf,
  cartPageOf,
  checkOutOf,
  removeFromCartOf,
} from '../shop/shopUrls';

const cartPath = (customerId: string) =>
  `/customers/${customerId}/shopping-carts/current`;

export const addProductItem =
  (customerId: string, productItem: Record<string, unknown>): TestRequest =>
  (request) =>
    request.post(`${cartPath(customerId)}/product-items`).send(productItem);

export const removeProductItem =
  (
    customerId: string,
    productId: string,
    quantity: number,
    ifMatch?: string,
  ): TestRequest =>
  (request) => {
    const call = request.delete(
      `${cartPath(customerId)}/product-items?productId=${productId}&quantity=${quantity}`,
    );
    return ifMatch === undefined ? call : call.set({ 'If-Match': ifMatch });
  };

export const checkOut =
  (customerId: string, ifMatch?: string): TestRequest =>
  (request) => {
    const call = request.post(`${cartPath(customerId)}/checkout`);
    return ifMatch === undefined ? call : call.set({ 'If-Match': ifMatch });
  };

export const getCart =
  (customerId: string, seenETag?: string): TestRequest =>
  (request) => {
    const call = request.get(cartPath(customerId));
    return seenETag === undefined
      ? call
      : call.set({ 'If-None-Match': seenETag });
  };

export const cartPagesOf = ({ getPage, postForm }: ShopRequests) => ({
  addToCartOnPage: (
    customer: SignedInCustomer,
    productId: string,
    quantity = 1,
  ) =>
    postForm(
      addToCartOf(customer.id),
      { productId, quantity: String(quantity) },
      { as: customer },
    ),
  cartPage: (customer: SignedInCustomer, query = '') =>
    getPage(cartPageOf(customer.id, query), { as: customer }),
  removeFromCartOnPage: (
    customer: SignedInCustomer,
    productId: string,
    quantity: number,
    version: string,
  ) =>
    postForm(
      removeFromCartOf(customer.id, productId),
      { quantity: String(quantity), version },
      { as: customer },
    ),
  checkOutOnPage: (customer: SignedInCustomer, version: string) =>
    postForm(checkOutOf(customer.id), { version }, { as: customer }),
});
