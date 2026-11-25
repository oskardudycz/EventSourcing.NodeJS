export const loginPage = '/shop/login';

const customerPages = (customerId: string) => `/shop/customers/${customerId}`;

export const productsPageOf = (customerId: string) =>
  `${customerPages(customerId)}/products`;

export const cartPageOf = (customerId: string, query = '') =>
  `${customerPages(customerId)}/cart${query}`;

export const addToCartOf = (customerId: string) =>
  `${customerPages(customerId)}/cart/items`;

export const removeFromCartOf = (customerId: string, productId: string) =>
  `${customerPages(customerId)}/cart/items/${productId}/remove`;

export const checkOutOf = (customerId: string) =>
  `${customerPages(customerId)}/cart/checkout`;

export const ordersPageOf = (customerId: string) =>
  `${customerPages(customerId)}/orders`;

export const orderPageOf = (customerId: string, orderNumber: string) =>
  `${ordersPageOf(customerId)}/${orderNumber}`;

export const cancelOrderOf = (customerId: string, orderNumber: string) =>
  `${orderPageOf(customerId, orderNumber)}/cancel`;

export const retryPaymentOf = (customerId: string, orderNumber: string) =>
  `${orderPageOf(customerId, orderNumber)}/retry-payment`;
