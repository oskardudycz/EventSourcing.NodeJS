import {
  expectResponse,
  htmlContaining,
  redirectsTo,
  type Expectation,
} from '@e-commerce/core';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'vitest';
import { shopTestApplication } from '../shopTestApplication';
import { demoProducts } from './demoProducts';
import { customerIdOf } from './customer';
import { shopRequests } from './shopRequests';

const shop = (options: Parameters<typeof shopTestApplication>[0] = {}) => {
  const application = shopTestApplication(options);

  return { ...application, ...shopRequests(application.fetch) };
};

const name = () => `Marty ${randomUUID().slice(0, 8)}`;

const setsAnHttpOnlyCustomerCookie =
  (customerName: string): Expectation =>
  ({ response }) => {
    const cookie = response?.headers['set-cookie'] ?? '';

    if (
      !cookie.includes(`customer=${encodeURIComponent(customerName)}`) ||
      !cookie.includes('HttpOnly')
    )
      throw new Error(`Set-Cookie is not an HttpOnly customer cookie: ${cookie}`);
  };

describe('shop pages', () => {
  it('loggingInWithANameOpensTheProductsWithAnHttpOnlyCookie', () => {
    const { given, postForm } = shop();
    const customerName = name();

    return given()
      .when(postForm('/shop/login', { name: customerName }))
      .then(
        expectResponse(303),
        redirectsTo(`/shop/customers/${customerIdOf(customerName)}/products`),
        setsAnHttpOnlyCustomerCookie(customerName),
      );
  });

  it('loggingInShowsFiveProductsWithTheLastSoldOut', () => {
    const { given, getPage } = shop();
    const customerName = name();

    return given()
      .when(
        getPage(`/shop/customers/${customerIdOf(customerName)}/products`, {
          as: customerName,
        }),
      )
      .then(
        expectResponse(200),
        htmlContaining(
          ...demoProducts.map(({ name: productName }) => productName),
          'Sold out at the warehouse',
        ),
      );
  });

  it('openingTheShopWithoutLoggingInRedirectsToLogin', () => {
    const { given, getPage } = shop();

    return given()
      .when(getPage('/shop'))
      .then(expectResponse(303), redirectsTo('/shop/login'));
  });

  it('pagesWithoutTheCustomerCookieRedirectToLogin', () => {
    const { given, getPage } = shop();

    return given()
      .when(getPage(`/shop/customers/${customerIdOf(name())}/cart`))
      .then(expectResponse(303), redirectsTo('/shop/login'));
  });

  it('pagesOfAnotherCustomerRedirectToLogin', () => {
    const { given, getPage } = shop();

    return given()
      .when(
        getPage(`/shop/customers/${customerIdOf(name())}/orders`, {
          as: name(),
        }),
      )
      .then(expectResponse(303), redirectsTo('/shop/login'));
  });

  it('loggingOutClearsTheCookieAndReturnsToLogin', () => {
    const { given, postForm } = shop();

    return given()
      .when(postForm('/shop/logout', {}, { as: name() }))
      .then(expectResponse(303), redirectsTo('/shop/login'));
  });

  it('pagesLinkToGrafanaAndEventCatalog', () => {
    const { given, getPage } = shop({
      links: {
        grafanaUrl: 'http://grafana.example:3000',
        eventCatalogUrl: 'http://catalog.example:3001',
      },
    });

    return given()
      .when(getPage('/shop/login'))
      .then(
        htmlContaining(
          'href="http://grafana.example:3000"',
          'href="http://catalog.example:3001"',
        ),
      );
  });
});
