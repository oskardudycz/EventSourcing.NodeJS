import {
  action,
  expectAppended,
  expectError,
  expectNothingAppended,
  expectNothingPublished,
  expectPublished,
  expectResponse,
  htmlContaining,
  htmlNotContaining,
  redirectsTo,
} from '@e-commerce/core';
import { toWeakETag, type TestRequest } from '@event-driven-io/emmett-honojs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  testedMessagingBuses,
  testApplication,
  type TestedMessagingBus,
} from '../testApplication';
import {
  demoProducts,
  merinoTShirt,
  soldOutDemoProduct,
  trailRunningShoes,
} from '../shop/demoProducts';
import {
  aCustomer,
  locationIs,
  measured,
  shopRequests,
} from '../shop/shopRequests';
import { cartPageOf, loginPage, orderPageOf } from '../shop/shopUrls';
import { shopTestApplication } from '../shopTestApplication';
import { ShoppingCartId } from './shoppingCart';
import {
  addProductItem,
  cartPagesOf,
  checkOut,
  getCart,
  removeProductItem,
} from './shoppingCartRequests';

const shoppingCartsOn = (messagingBus?: TestedMessagingBus) => {
  const application = testApplication({ messagingBus });

  return () => {
    const now = application.clock.now().toISOString();
    const customerId = randomUUID();
    const shoes = randomUUID();
    const hat = randomUUID();
    const cartId = ShoppingCartId.of(customerId, 1);
    const { given, priceOf, appendsConflict } = application.about(customerId);

    const addShoes = (quantity: number) =>
      addProductItem(customerId, { productId: shoes, quantity });
    const addHat = (quantity: number) =>
      addProductItem(customerId, { productId: hat, quantity });
    const removeShoes = (quantity: number, ifMatch?: string) =>
      removeProductItem(customerId, shoes, quantity, ifMatch);
    const cartWithTwoShoes = () => [priceOf(shoes, 50), addShoes(2)];
    const checkedOutCart = () => [
      ...cartWithTwoShoes(),
      checkOut(customerId, toWeakETag(1)),
    ];
    const cartWithAChangedPrice = () => [
      ...cartWithTwoShoes(),
      priceOf(shoes, 60),
    ];
    const cartWhoseCheckoutFoundAChangedPrice = () => [
      ...cartWithAChangedPrice(),
      checkOut(customerId, toWeakETag(1)),
    ];

    return {
      now,
      given,
      priceOf,
      appendsConflict,
      customerId,
      shoes,
      hat,
      cartId,
      addShoes,
      addHat,
      removeShoes,
      cartWithTwoShoes,
      checkedOutCart,
      cartWithAChangedPrice,
      cartWhoseCheckoutFoundAChangedPrice,
    };
  };
};

const aCart = shoppingCartsOn();

describe('adding a product item', () => {
  it('addingAProductWithNoOpenCartOpensACartAtTheCurrentPrice', () => {
    const { given, priceOf, customerId, shoes, cartId, addShoes, now } =
      aCart();

    return given(priceOf(shoes, 50))
      .when(addShoes(2))
      .then(
        expectResponse(200, { headers: { ETag: toWeakETag(1) } }),
        expectAppended([
          'shopping_carts_cart-' + `${customerId}-1`,
          [
            {
              type: 'shopping_carts.ProductItemAddedToShoppingCart',
              data: {
                shoppingCartId: cartId,
                customerId,
                productItem: { productId: shoes, quantity: 2, unitPrice: 50 },
                addedAt: now,
              },
            },
          ],
        ]),
        expectNothingPublished(),
      );
  });

  it('addingTheSameProductAgainGrowsTheQuantityAndKeepsTheFirstPrice', () => {
    const {
      given,
      priceOf,
      customerId,
      shoes,
      cartId,
      addShoes,
      cartWithTwoShoes,
      now,
    } = aCart();

    return given(...cartWithTwoShoes(), priceOf(shoes, 80))
      .when(addShoes(1))
      .then(
        expectResponse(200, { headers: { ETag: toWeakETag(2) } }),
        expectAppended([
          `shopping_carts_cart-${customerId}-1`,
          [
            {
              type: 'shopping_carts.ProductItemAddedToShoppingCart',
              data: {
                shoppingCartId: cartId,
                customerId,
                productItem: { productId: shoes, quantity: 1, unitPrice: 50 },
                addedAt: now,
              },
            },
          ],
        ]),
      );
  });

  it('addingAfterCheckoutOpensTheNextCart', () => {
    const { given, customerId, addShoes, checkedOutCart } = aCart();

    return given(...checkedOutCart())
      .when(addShoes(1))
      .then(
        expectResponse(200, { headers: { ETag: toWeakETag(1) } }),
        (outcome) =>
          expect(outcome.appended?.map(([stream]) => stream)).toEqual([
            `shopping_carts_cart-${customerId}-2`,
          ]),
      );
  });

  it('twoConcurrentAddsBothEndUpInTheCart', () => {
    const { given, priceOf, customerId, shoes, hat, addShoes, addHat } =
      aCart();

    const sent = (request: ReturnType<TestRequest>) =>
      request instanceof Promise ? request : request.execute();
    const addShoesAndHatAtOnce: TestRequest = async (request) => {
      const [, hatAdded] = await Promise.all([
        sent(addShoes(1)(request)),
        sent(addHat(1)(request)),
      ]);
      return hatAdded;
    };

    return given(priceOf(shoes, 50), priceOf(hat, 20), addShoesAndHatAtOnce)
      .when(getCart(customerId))
      .then(
        expectResponse(200, { headers: { ETag: toWeakETag(2) } }),
        (outcome) =>
          expect(outcome.response?.json()).toHaveProperty(
            'lines',
            expect.arrayContaining([
              { productId: shoes, quantity: 1, unitPrice: 50 },
              { productId: hat, quantity: 1, unitPrice: 20 },
            ]),
          ),
      );
  });

  it('addingRetriesAVersionConflictUpTo3AttemptsInAll', () => {
    const {
      given,
      priceOf,
      appendsConflict,
      customerId,
      shoes,
      cartId,
      addShoes,
      now,
    } = aCart();

    return given(priceOf(shoes, 50), appendsConflict(2))
      .when(addShoes(2))
      .then(
        expectResponse(200, { headers: { ETag: toWeakETag(1) } }),
        expectAppended([
          `shopping_carts_cart-${customerId}-1`,
          [
            {
              type: 'shopping_carts.ProductItemAddedToShoppingCart',
              data: {
                shoppingCartId: cartId,
                customerId,
                productItem: { productId: shoes, quantity: 2, unitPrice: 50 },
                addedAt: now,
              },
            },
          ],
        ]),
      );
  });

  it('addingAnswers412WhenAll3AttemptsConflict', () => {
    const { given, priceOf, appendsConflict, shoes, addShoes } = aCart();

    return given(priceOf(shoes, 50), appendsConflict(3))
      .when(addShoes(2))
      .then(expectError(412), expectNothingAppended());
  });

  it('addingWithZeroQuantityAnswers400', () => {
    const { given, addShoes } = aCart();

    return given()
      .when(addShoes(0))
      .then(expectError(400), expectNothingAppended());
  });

  it('addingWithoutAProductIdAnswers400', () => {
    const { given, customerId } = aCart();

    return given()
      .when(addProductItem(customerId, { quantity: 2 }))
      .then(expectError(400));
  });
});

describe('removing a product item', () => {
  it('removingWithTheCurrentVersionShrinksTheLine', () => {
    const {
      given,
      customerId,
      shoes,
      cartId,
      removeShoes,
      cartWithTwoShoes,
      now,
    } = aCart();

    return given(...cartWithTwoShoes())
      .when(removeShoes(1, toWeakETag(1)))
      .then(
        expectResponse(200, { headers: { ETag: toWeakETag(2) } }),
        expectAppended([
          `shopping_carts_cart-${customerId}-1`,
          [
            {
              type: 'shopping_carts.ProductItemRemovedFromShoppingCart',
              data: {
                shoppingCartId: cartId,
                productItem: { productId: shoes, quantity: 1, unitPrice: 50 },
                removedAt: now,
              },
            },
          ],
        ]),
      );
  });

  it('removingAllOfTheQuantityRemovesTheLine', () => {
    const { given, customerId, removeShoes, cartWithTwoShoes } = aCart();

    return given(...cartWithTwoShoes(), removeShoes(2, toWeakETag(1)))
      .when(getCart(customerId))
      .then(expectResponse(200, { body: { lines: [], totalPrice: 0 } }));
  });

  it('removingRecordsTheLinePriceFromTheCartAfterTheProductPriceChanged', () => {
    const { given, removeShoes, cartWithAChangedPrice } = aCart();

    return given(...cartWithAChangedPrice())
      .when(removeShoes(1, toWeakETag(1)))
      .then(expectResponse(200), (outcome) =>
        expect(
          outcome.appended?.filter(([name]) =>
            name.startsWith('shopping_carts_cart-'),
          ),
        ).toMatchObject([
          [expect.any(String), [{ data: { productItem: { unitPrice: 50 } } }]],
        ]),
      );
  });

  it('removingWithAnOldVersionAnswers412', () => {
    const { given, addShoes, removeShoes, cartWithTwoShoes } = aCart();

    return given(...cartWithTwoShoes(), addShoes(1))
      .when(removeShoes(1, toWeakETag(1)))
      .then(expectError(412, { status: 412 }), expectNothingAppended());
  });

  it('removingAProductNotInTheCartAnswers409', () => {
    const { given, customerId, hat, cartWithTwoShoes } = aCart();

    return given(...cartWithTwoShoes())
      .when(removeProductItem(customerId, hat, 1, toWeakETag(1)))
      .then(expectError(409, { status: 409 }));
  });

  it('removingMoreThanInTheCartAnswers409', () => {
    const { given, removeShoes, cartWithTwoShoes } = aCart();

    return given(...cartWithTwoShoes())
      .when(removeShoes(3, toWeakETag(1)))
      .then(expectError(409));
  });

  it('removingWithNoOpenCartAnswers404', () => {
    const { given, removeShoes } = aCart();

    return given()
      .when(removeShoes(1, toWeakETag(1)))
      .then(expectError(404));
  });

  it('removingDoesNotRetryAVersionConflict', () => {
    const { given, appendsConflict, removeShoes, cartWithTwoShoes } = aCart();

    return given(...cartWithTwoShoes(), appendsConflict(1))
      .when(removeShoes(1, toWeakETag(1)))
      .then(expectError(412), expectNothingAppended());
  });

  it('removingWithoutIfMatchAnswers400', () => {
    const { given, removeShoes, cartWithTwoShoes } = aCart();

    return given(...cartWithTwoShoes())
      .when(removeShoes(1))
      .then(expectError(400));
  });
});

describe.each(testedMessagingBuses)(
  'checking out on messaging bus %s',
  (bus) => {
    const aCartOn = shoppingCartsOn(bus);

    it('checkingOutDoesNotRetryAVersionConflict', () => {
      const { given, appendsConflict, customerId, cartWithTwoShoes } =
        aCartOn();

      return given(...cartWithTwoShoes(), appendsConflict(1))
        .when(checkOut(customerId, toWeakETag(1)))
        .then(
          expectError(412),
          expectNothingAppended(),
          expectNothingPublished(),
        );
    });

    it('checkingOutSendsShoppingCartCheckedOutWithCustomerItemsAndTotal', () => {
      const { given, customerId, shoes, cartId, cartWithTwoShoes, now } =
        aCartOn();

      return given(...cartWithTwoShoes())
        .when(checkOut(customerId, toWeakETag(1)))
        .then(
          expectResponse(202, {
            headers: {
              Location: `/customers/${customerId}/orders/1`,
            },
          }),
          expectPublished({
            type: 'shopping_carts.external.ShoppingCartCheckedOut',
            data: {
              cartId,
              customerId,
              productItems: [{ productId: shoes, quantity: 2, unitPrice: 50 }],
              totalPrice: 100,
              checkedOutAt: now,
            },
          }),
        );
    });

    it('checkingOutSendsTheItemsAndTotalOfAllCartChanges', () => {
      const { given, priceOf, customerId, shoes, hat, cartId, addShoes, now } =
        aCartOn();

      return given(
        priceOf(shoes, 50),
        priceOf(hat, 20),
        addShoes(2),
        addProductItem(customerId, { productId: hat, quantity: 1 }),
        removeProductItem(customerId, shoes, 1, toWeakETag(2)),
      )
        .when(checkOut(customerId, toWeakETag(3)))
        .then(
          expectPublished({
            type: 'shopping_carts.external.ShoppingCartCheckedOut',
            data: {
              cartId,
              customerId,
              productItems: [
                { productId: shoes, quantity: 1, unitPrice: 50 },
                { productId: hat, quantity: 1, unitPrice: 20 },
              ],
              totalPrice: 70,
              checkedOutAt: now,
            },
          }),
        );
    });

    it('commandsAndInternalEventsArePrefixedWithTheModule', () => {
      const { given, customerId, cartWithTwoShoes } = aCartOn();

      return given(...cartWithTwoShoes())
        .when(checkOut(customerId, toWeakETag(1)))
        .then((outcome) =>
          expect(
            outcome.appended?.filter(([name]) =>
              name.startsWith('shopping_carts_cart-'),
            ),
          ).toMatchObject([
            [
              expect.any(String),
              [{ type: 'shopping_carts.ShoppingCartCheckedOut' }],
            ],
          ]),
        );
    });

    it('checkingOutAfterTheCustomerSawTheNewPricesSendsThem', () => {
      const {
        given,
        customerId,
        shoes,
        cartId,
        cartWhoseCheckoutFoundAChangedPrice,
        now,
      } = aCartOn();

      return given(...cartWhoseCheckoutFoundAChangedPrice())
        .when(checkOut(customerId, toWeakETag(2)))
        .then(
          expectResponse(202),
          expectPublished({
            type: 'shopping_carts.external.ShoppingCartCheckedOut',
            data: {
              cartId,
              customerId,
              productItems: [{ productId: shoes, quantity: 2, unitPrice: 60 }],
              totalPrice: 120,
              checkedOutAt: now,
            },
          }),
        );
    });

    it('checkingOutWithAChangedPriceAnswers409AndKeepsTheCartOpen', () => {
      const { given, customerId, shoes, cartId, cartWithAChangedPrice, now } =
        aCartOn();

      return given(...cartWithAChangedPrice())
        .when(checkOut(customerId, toWeakETag(1)))
        .then(
          expectResponse(409, { headers: { ETag: toWeakETag(2) } }),
          expectAppended([
            `shopping_carts_cart-${customerId}-1`,
            [
              {
                type: 'shopping_carts.ProductItemPriceChanged',
                data: {
                  shoppingCartId: cartId,
                  productId: shoes,
                  oldUnitPrice: 50,
                  newUnitPrice: 60,
                  changedAt: now,
                },
              },
            ],
          ]),
          expectNothingPublished(),
        );
    });

    it('checkingOutACheckedOutCartAnswers404', () => {
      const { given, customerId, checkedOutCart } = aCartOn();

      return given(...checkedOutCart())
        .when(checkOut(customerId, toWeakETag(2)))
        .then(
          expectError(404),
          expectNothingAppended(),
          expectNothingPublished(),
        );
    });

    it('checkingOutWithAnOldVersionAnswers412', () => {
      const { given, customerId, cartWithTwoShoes } = aCartOn();

      return given(...cartWithTwoShoes())
        .when(checkOut(customerId, toWeakETag(999)))
        .then(expectError(412), expectNothingPublished());
    });

    it('checkingOutWithANegativeVersionAnswers412', () => {
      const { given, customerId, cartWithTwoShoes } = aCartOn();

      return given(...cartWithTwoShoes())
        .when(checkOut(customerId, toWeakETag(-1)))
        .then(expectError(412));
    });

    it('checkingOutWithoutIfMatchAnswers400', () => {
      const { given, customerId, cartWithTwoShoes } = aCartOn();

      return given(...cartWithTwoShoes())
        .when(checkOut(customerId))
        .then(expectError(400));
    });

    it('checkingOutWithAMalformedIfMatchAnswers400', () => {
      const { given, customerId, cartWithTwoShoes } = aCartOn();

      return given(...cartWithTwoShoes())
        .when(checkOut(customerId, '"not-a-version"'))
        .then(expectError(400));
    });

    it('checkingOutWithAWeakETagThatIsNotANumberAnswers400', () => {
      const { given, customerId, cartWithTwoShoes } = aCartOn();

      return given(...cartWithTwoShoes())
        .when(checkOut(customerId, 'W/"1x"'))
        .then(expectError(400));
    });

    it('checkingOutWithNoOpenCartAnswers404', () => {
      const { given, customerId } = aCartOn();

      return given()
        .when(checkOut(customerId, toWeakETag(1)))
        .then(expectError(404));
    });
  },
);

describe('reading the cart', () => {
  it('readingTheCurrentCartReturnsLinesTotalAndETag', () => {
    const { given, customerId, shoes, cartWithTwoShoes } = aCart();

    return given(...cartWithTwoShoes())
      .when(getCart(customerId))
      .then(
        expectResponse(200, {
          headers: { ETag: toWeakETag(1) },
          body: {
            lines: [{ productId: shoes, quantity: 2, unitPrice: 50 }],
            totalPrice: 100,
            checkedOut: false,
          },
        }),
      );
  });

  it('readingWithNoOpenCartAnswers404', () => {
    const { given, customerId } = aCart();

    return given().when(getCart(customerId)).then(expectError(404));
  });

  it('readingAfterCheckoutAnswers404', () => {
    const { given, customerId, checkedOutCart } = aCart();

    return given(...checkedOutCart())
      .when(getCart(customerId))
      .then(expectError(404));
  });

  it('readingWithAnOlderVersionReturnsTheNewerCartWithin1s', () => {
    const { given, customerId, addShoes, cartWithTwoShoes } = aCart();

    const readWhileAnotherAddArrives: TestRequest = async (request) => {
      const added = new Promise((resolve) => setTimeout(resolve, 200)).then(
        () => {
          const adding = addShoes(1)(request);
          return adding instanceof Promise ? adding : adding.execute();
        },
      );
      const read = getCart(customerId, toWeakETag(1))(request);
      const response = await (read instanceof Promise ? read : read.execute());
      await added;
      return response;
    };

    return given(...cartWithTwoShoes())
      .when(readWhileAnotherAddArrives)
      .then(
        expectResponse(200, {
          headers: { ETag: toWeakETag(2) },
          body: { lines: [{ quantity: 3 }] },
        }),
      );
  });

  it('readingWithTheCurrentVersionAnswers304After1s', async () => {
    const { given, customerId, cartWithTwoShoes } = aCart();

    const startedAt = Date.now();

    await given(...cartWithTwoShoes())
      .when(getCart(customerId, toWeakETag(1)))
      .then(expectResponse(304, { headers: { ETag: toWeakETag(1) } }));

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(900);
  });
});

describe('shopping cart pages', () => {
  const shopApplication = shopTestApplication({
    modules: ['shopping_carts'],
  });

  const shop = () => {
    const application = shopApplication;
    const requests = shopRequests(application.fetch);

    return { ...application, ...requests, ...cartPagesOf(requests) };
  };

  const shoes = trailRunningShoes;
  const shirt = merinoTShirt;

  it('theProductsPageShowsTheFiveDemoProductsWithTheLastSoldOut', () => {
    const { given, productsPage } = shop();

    return given()
      .when(productsPage(aCustomer()))
      .then(
        expectResponse(200),
        htmlContaining(
          ...demoProducts.map(({ name }) => name),
          soldOutDemoProduct.description,
          'Cart (0)',
        ),
      );
  });

  it('theProductsPageCountsTheLinesInTheCart', () => {
    const { given, addToCartOnPage, productsPage } = shop();
    const customer = aCustomer();

    return given(
      addToCartOnPage(customer, shoes.id),
      addToCartOnPage(customer, shirt.id),
    )
      .when(productsPage(customer))
      .then(htmlContaining('Cart (2)'));
  });

  it('addingAProductRedirectsToTheCartPage', () => {
    const { given, addToCartOnPage } = shop();
    const customer = aCustomer();

    return given()
      .when(addToCartOnPage(customer, shoes.id))
      .then(
        expectResponse(303),
        locationIs(cartPageOf(customer.id, '?written=1')),
      );
  });

  it('addingAProductWithoutLoggingInRedirectsToLogin', () => {
    const { given, postForm } = shop();
    const customer = aCustomer();

    return given()
      .when(
        postForm(`${cartPageOf(customer.id)}/items`, {
          productId: shoes.id,
          quantity: '1',
        }),
      )
      .then(expectResponse(303), redirectsTo(loginPage));
  });

  it('theCartPageShowsAddsAndRemoves', () => {
    const { given, addToCartOnPage, removeFromCartOnPage, cartPage } = shop();
    const customer = aCustomer();

    return given(
      addToCartOnPage(customer, shoes.id),
      addToCartOnPage(customer, shirt.id),
      removeFromCartOnPage(customer, shoes.id, 1, '2'),
    )
      .when(cartPage(customer))
      .then(htmlContaining(shirt.name), htmlNotContaining(shoes.name));
  });

  it('theCartPageShowsAChangeThatArrivesWhileItWaitsForTheWrittenVersion', () => {
    const { given, addToCartOnPage, cartPage } = shop();
    const customer = aCustomer();
    const readWhileAnotherAddArrives: TestRequest = async () => {
      const added = new Promise((resolve) => setTimeout(resolve, 200)).then(
        () => addToCartOnPage(customer, shirt.id)(),
      );
      const response = await cartPage(customer, '?written=2')();

      await added;

      return response;
    };

    return given(addToCartOnPage(customer, shoes.id))
      .when(readWhileAnotherAddArrives)
      .then(htmlContaining(shoes.name, shirt.name));
  });

  it('anEmptyCartInvitesToBrowseProductsWithoutWaiting', async () => {
    const { given, cartPage } = shop();
    const customer = aCustomer();
    const { request, tookInMs } = measured(cartPage(customer));

    await given().when(request).then(htmlContaining('Your cart is empty'));

    expect(tookInMs()).toBeLessThan(900);
  });

  it('removingWithAnOldVersionShowsThatTheCartChanged', () => {
    const { given, addToCartOnPage, removeFromCartOnPage } = shop();
    const customer = aCustomer();

    return given(
      addToCartOnPage(customer, shoes.id),
      addToCartOnPage(customer, shirt.id),
    )
      .when(removeFromCartOnPage(customer, shoes.id, 1, '1'))
      .then(
        expectResponse(303),
        locationIs(cartPageOf(customer.id, '?message=changed')),
      );
  });

  it('removingFromAMissingCartRedirectsToTheCart', () => {
    const { given, removeFromCartOnPage } = shop();
    const customer = aCustomer();

    return given()
      .when(removeFromCartOnPage(customer, shoes.id, 1, '1'))
      .then(expectResponse(303), locationIs(cartPageOf(customer.id)));
  });

  it('theCartPageExplainsThatTheCartChanged', () => {
    const { given, cartPage } = shop();

    return given()
      .when(cartPage(aCustomer(), '?message=changed'))
      .then(htmlContaining('Your cart has changed'));
  });

  it('checkingOutRedirectsToTheOrderPage', () => {
    const { given, addToCartOnPage, checkOutOnPage } = shop();
    const customer = aCustomer();

    return given(addToCartOnPage(customer, shoes.id))
      .when(checkOutOnPage(customer, '1'))
      .then(expectResponse(303), locationIs(orderPageOf(customer.id, '1')));
  });

  it('checkingOutWithAnOldVersionShowsThatTheCartChanged', () => {
    const { given, addToCartOnPage, checkOutOnPage } = shop();
    const customer = aCustomer();

    return given(
      addToCartOnPage(customer, shoes.id),
      addToCartOnPage(customer, shirt.id),
    )
      .when(checkOutOnPage(customer, '1'))
      .then(
        expectResponse(303),
        locationIs(cartPageOf(customer.id, '?message=changed')),
      );
  });

  it('checkingOutAfterAPriceChangedShowsThePricesAgain', () => {
    const { given, addToCartOnPage, checkOutOnPage, prices } = shop();
    const customer = aCustomer();

    const product = randomUUID();

    return given(
      action(() => prices.setPriceOf(product, 50)),
      addToCartOnPage(customer, product),
      action(() => prices.setPriceOf(product, 60)),
    )
      .when(checkOutOnPage(customer, '1'))
      .then(
        expectResponse(303),
        locationIs(cartPageOf(customer.id, '?written=2&message=prices')),
      );
  });

  it('theCartPageExplainsThatThePricesChanged', () => {
    const { given, cartPage } = shop();

    return given()
      .when(cartPage(aCustomer(), '?message=prices'))
      .then(htmlContaining('Some prices have changed'));
  });

  it('checkingOutAMissingCartRedirectsToTheCart', () => {
    const { given, checkOutOnPage } = shop();
    const customer = aCustomer();

    return given()
      .when(checkOutOnPage(customer, '1'))
      .then(expectResponse(303), locationIs(cartPageOf(customer.id)));
  });

  it('aTamperedVersionAnswers400', () => {
    const { given, addToCartOnPage, checkOutOnPage } = shop();
    const customer = aCustomer();

    return given(addToCartOnPage(customer, shoes.id))
      .when(checkOutOnPage(customer, 'abc'))
      .then(expectResponse(400));
  });
});
