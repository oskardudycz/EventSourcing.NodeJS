import {
  expectResponse,
  htmlContaining,
  htmlNotContaining,
  redirectsTo,
} from '@e-commerce/core';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'vitest';
import { customerIdOf } from '../shop/customer';
import { demoProducts } from '../shop/demoProducts';
import { shopRequests } from '../shop/shopRequests';
import { shopTestApplication } from '../shopTestApplication';

const shoes = demoProducts[0]!;
const shirt = demoProducts[1]!;

const customer = () => {
  const name = `Marty ${randomUUID().slice(0, 8)}`;
  const id = customerIdOf(name);
  const application = shopTestApplication();
  const requests = shopRequests(application.fetch);
  const pages = `/shop/customers/${id}`;
  const add = (productId: string) =>
    requests.postForm(
      `${pages}/cart/items`,
      { productId, quantity: '1' },
      { as: name },
    );

  return {
    ...application,
    ...requests,
    add,
    cart: requests.getPage(`${pages}/cart`, { as: name }),
    pages,
    name,
  };
};

describe('shopping cart pages', () => {
  it('addingAProductRedirectsToACartThatShowsIt', () => {
    const { given, add, pages, name, getPage } = customer();

    return given(add(shoes.id))
      .when(getPage(`${pages}/cart?written=1`, { as: name }))
      .then(
        expectResponse(200),
        htmlContaining(shoes.name, 'Check out'),
        htmlNotContaining('Your cart is empty'),
      );
  });

  it('theCartPageShowsAddsAndRemoves', () => {
    const { given, add, cart, pages, name, postForm } = customer();

    return given(
      add(shoes.id),
      add(shirt.id),
      postForm(
        `${pages}/cart/items/${shoes.id}/remove`,
        { quantity: '1', version: '2' },
        { as: name },
      ),
    )
      .when(cart)
      .then(htmlContaining(shirt.name), htmlNotContaining(shoes.name));
  });

  it('anEmptyCartInvitesToBrowseProducts', () => {
    const { given, cart } = customer();

    return given().when(cart).then(htmlContaining('Your cart is empty'));
  });

  it('removingWithAnOldVersionShowsThatTheCartChanged', () => {
    const { given, add, pages, name, postForm } = customer();

    return given(add(shoes.id), add(shirt.id))
      .when(
        postForm(
          `${pages}/cart/items/${shoes.id}/remove`,
          { quantity: '1', version: '1' },
          { as: name },
        ),
      )
      .then(
        expectResponse(303),
        redirectsTo(`${pages}/cart`),
      );
  });

  it('theCartPageExplainsThatTheCartChanged', () => {
    const { given, pages, name, getPage } = customer();

    return given()
      .when(getPage(`${pages}/cart?message=changed`, { as: name }))
      .then(htmlContaining('Your cart has changed'));
  });

  it('checkoutRedirectsToTheBeingPlacedPage', () => {
    const { given, add, pages, name, postForm } = customer();

    return given(add(shoes.id))
      .when(postForm(`${pages}/cart/checkout`, { version: '1' }, { as: name }))
      .then(
        expectResponse(303),
        redirectsTo(`${pages}/orders/1`),
      );
  });
});
