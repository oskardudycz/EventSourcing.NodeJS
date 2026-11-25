import {
  expectResponse,
  htmlContaining,
  htmlNotContaining,
  redirectsTo,
  type Expectation,
} from '@e-commerce/core';
import { describe, expect, it } from 'vitest';
import {
  shopTestApplication,
  sqliteWithoutABroker,
} from '../shopTestApplication';
import { aCustomer, shopRequests } from './shopRequests';
import { loginPage, productsPageOf } from './shopUrls';

const shopApplication = shopTestApplication({ modules: ['shopping_carts'] });

const shop = () => ({
  ...shopApplication,
  ...shopRequests(shopApplication.fetch),
});

const setCookieOf = (outcome: Parameters<Expectation>[0]) =>
  outcome.response?.headers['set-cookie'] ?? '';

const setsAnHttpOnlyCustomerCookie =
  (customerName: string): Expectation =>
  (outcome) => {
    const cookie = setCookieOf(outcome);

    expect(cookie).toContain(`customer=${encodeURIComponent(customerName)}`);
    expect(cookie).toContain('HttpOnly');
  };

const clearsTheCustomerCookie: Expectation = (outcome) => {
  const cookie = setCookieOf(outcome);

  expect(cookie).toContain('customer=;');
  expect(cookie).toContain('Max-Age=0');
};

const setsNoCookie: Expectation = (outcome) =>
  expect(setCookieOf(outcome)).toBe('');

const shopWithLinksApplication = shopTestApplication({
  environment: {
    ...sqliteWithoutABroker,
    SHOP_GRAFANA_URL: 'http://grafana.example:3000',
    SHOP_EVENTCATALOG_URL: 'http://catalog.example:3001',
  },
});

const shopWithLinks = () => ({
  ...shopWithLinksApplication,
  ...shopRequests(shopWithLinksApplication.fetch),
});

describe('shop pages', () => {
  it('loggingInWithANameOpensTheProductsWithAnHttpOnlyCookie', () => {
    const { given, logsIn } = shop();
    const customer = aCustomer();

    return given()
      .when(logsIn(customer.name))
      .then(
        expectResponse(303),
        redirectsTo(productsPageOf(customer.id)),
        setsAnHttpOnlyCustomerCookie(customer.name),
      );
  });

  it('loggingInWithAnEmptyNameStaysOnTheLoginPageWithoutACookie', () => {
    const { given, logsIn } = shop();

    return given()
      .when(logsIn('   '))
      .then(expectResponse(303), redirectsTo(loginPage), setsNoCookie);
  });

  it('openingTheShopWithoutLoggingInRedirectsToLogin', () => {
    const { given, openTheShop } = shop();

    return given()
      .when(openTheShop())
      .then(expectResponse(303), redirectsTo(loginPage));
  });

  it('openingTheShopWhileLoggedInRedirectsToTheProducts', () => {
    const { given, openTheShop } = shop();
    const customer = aCustomer();

    return given()
      .when(openTheShop(customer))
      .then(expectResponse(303), redirectsTo(productsPageOf(customer.id)));
  });

  it('pagesWithoutTheCustomerCookieRedirectToLogin', () => {
    const { given, getPage } = shop();

    return given()
      .when(getPage(productsPageOf(aCustomer().id)))
      .then(expectResponse(303), redirectsTo(loginPage));
  });

  it('pagesOfAnotherCustomerRedirectToLogin', () => {
    const { given, getPage } = shop();

    return given()
      .when(getPage(productsPageOf(aCustomer().id), { as: aCustomer() }))
      .then(expectResponse(303), redirectsTo(loginPage));
  });

  it('loggingOutClearsTheCookieAndReturnsToLogin', () => {
    const { given, logsOut } = shop();

    return given()
      .when(logsOut(aCustomer()))
      .then(
        expectResponse(303),
        redirectsTo(loginPage),
        clearsTheCustomerCookie,
      );
  });

  it('theLoginPageLinksToGrafanaAndEventCatalogFromTheSettings', () => {
    const { given, loginPage: loginPageRequest } = shopWithLinks();

    return given()
      .when(loginPageRequest())
      .then(
        htmlContaining(
          'href="http://grafana.example:3000"',
          'href="http://catalog.example:3001"',
        ),
        htmlNotContaining('href="http://localhost:3000"'),
      );
  });

  it('theDeveloperToolsLinkToTheWebApiAndTheMessagesDocumentation', () => {
    const { given, loginPage: loginPageRequest } = shopWithLinks();

    return given()
      .when(loginPageRequest())
      .then(htmlContaining('href="/swagger"', 'href="/asyncapi"'));
  });
});
