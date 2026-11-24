import {
  expectAppended,
  expectError,
  expectNothingAppended,
  expectNothingPublished,
  expectPublished,
  expectResponse,
} from '@e-commerce/core';
import { toWeakETag, type TestRequest } from '@event-driven-io/emmett-honojs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  testedMessagingBuses,
  testApplication,
  type TestedMessagingBus,
} from '../testApplication';
import { ShoppingCartId } from './shoppingCart';
import {
  addProductItem,
  checkOut,
  getCart,
  removeProductItem,
} from './shoppingCartRequests';

const customerId = randomUUID();
const shoes = randomUUID();
const hat = randomUUID();
const cartId = ShoppingCartId.of(customerId, 1);
const firstOfJanuary = '2026-01-01T10:00:00.000Z';

const addShoes = (quantity: number) =>
  addProductItem(customerId, { productId: shoes, quantity });
const addHat = (quantity: number) =>
  addProductItem(customerId, { productId: hat, quantity });

const shoppingCartsOn = (messagingBus?: TestedMessagingBus) => {
  const { given, priceOf, appendsConflict } = testApplication({ messagingBus });

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
    given,
    priceOf,
    appendsConflict,
    cartWithTwoShoes,
    checkedOutCart,
    cartWithAChangedPrice,
    cartWhoseCheckoutFoundAChangedPrice,
  };
};

const {
  given,
  priceOf,
  appendsConflict,
  cartWithTwoShoes,
  checkedOutCart,
  cartWithAChangedPrice,
} = shoppingCartsOn();

describe('adding a product item', () => {
  it('addingAProductWithNoOpenCartOpensACartAtTheCurrentPrice', () =>
    given(priceOf(shoes, 50))
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
                addedAt: firstOfJanuary,
              },
            },
          ],
        ]),
        expectNothingPublished(),
      ));

  it('addingTheSameProductAgainGrowsTheQuantityAndKeepsTheFirstPrice', () =>
    given(...cartWithTwoShoes(), priceOf(shoes, 80))
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
                addedAt: firstOfJanuary,
              },
            },
          ],
        ]),
      ));

  it('addingAfterCheckoutOpensTheNextCart', () =>
    given(...checkedOutCart())
      .when(addShoes(1))
      .then(
        expectResponse(200, { headers: { ETag: toWeakETag(1) } }),
        (outcome) =>
          expect(outcome.appended?.map(([stream]) => stream)).toEqual([
            `shopping_carts_cart-${customerId}-2`,
          ]),
      ));

  it('twoConcurrentAddsBothEndUpInTheCart', () => {
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

  it('addingRetriesAVersionConflictUpTo3AttemptsInAll', () =>
    given(priceOf(shoes, 50), appendsConflict(2))
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
                addedAt: firstOfJanuary,
              },
            },
          ],
        ]),
      ));

  it('addingAnswers412WhenAll3AttemptsConflict', () =>
    given(priceOf(shoes, 50), appendsConflict(3))
      .when(addShoes(2))
      .then(expectError(412), expectNothingAppended()));

  it('addingWithZeroQuantityAnswers400', () =>
    given().when(addShoes(0)).then(expectError(400), expectNothingAppended()));

  it('addingWithoutAProductIdAnswers400', () =>
    given()
      .when(addProductItem(customerId, { quantity: 2 }))
      .then(expectError(400)));
});

describe('removing a product item', () => {
  const removeShoes = (quantity: number, ifMatch?: string) =>
    removeProductItem(customerId, shoes, quantity, ifMatch);

  it('removingWithTheCurrentVersionShrinksTheLine', () =>
    given(...cartWithTwoShoes())
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
                removedAt: firstOfJanuary,
              },
            },
          ],
        ]),
      ));

  it('removingAllOfTheQuantityRemovesTheLine', () =>
    given(...cartWithTwoShoes(), removeShoes(2, toWeakETag(1)))
      .when(getCart(customerId))
      .then(expectResponse(200, { body: { lines: [], totalPrice: 0 } })));

  it('removingRecordsTheLinePriceFromTheCartAfterTheProductPriceChanged', () =>
    given(...cartWithAChangedPrice())
      .when(removeShoes(1, toWeakETag(1)))
      .then(expectResponse(200), (outcome) =>
        expect(
          outcome.appended?.filter(([name]) =>
            name.startsWith('shopping_carts_cart-'),
          ),
        ).toMatchObject([
          [expect.any(String), [{ data: { productItem: { unitPrice: 50 } } }]],
        ]),
      ));

  it('removingWithAnOldVersionAnswers412', () =>
    given(...cartWithTwoShoes(), addShoes(1))
      .when(removeShoes(1, toWeakETag(1)))
      .then(expectError(412, { status: 412 }), expectNothingAppended()));

  it('removingAProductNotInTheCartAnswers409', () =>
    given(...cartWithTwoShoes())
      .when(removeProductItem(customerId, hat, 1, toWeakETag(1)))
      .then(expectError(409, { status: 409 })));

  it('removingMoreThanInTheCartAnswers409', () =>
    given(...cartWithTwoShoes())
      .when(removeShoes(3, toWeakETag(1)))
      .then(expectError(409)));

  it('removingWithNoOpenCartAnswers404', () =>
    given()
      .when(removeShoes(1, toWeakETag(1)))
      .then(expectError(404)));

  it('removingDoesNotRetryAVersionConflict', () =>
    given(...cartWithTwoShoes(), appendsConflict(1))
      .when(removeShoes(1, toWeakETag(1)))
      .then(expectError(412), expectNothingAppended()));

  it('removingWithoutIfMatchAnswers400', () =>
    given(...cartWithTwoShoes())
      .when(removeShoes(1))
      .then(expectError(400)));
});

describe.each(testedMessagingBuses)('checking out on messaging bus %s', (bus) => {
  const {
    given,
    priceOf,
    cartWithTwoShoes,
    checkedOutCart,
    cartWithAChangedPrice,
    cartWhoseCheckoutFoundAChangedPrice,
    appendsConflict,
  } = shoppingCartsOn(bus);

  it('checkingOutDoesNotRetryAVersionConflict', () =>
    given(...cartWithTwoShoes(), appendsConflict(1))
      .when(checkOut(customerId, toWeakETag(1)))
      .then(
        expectError(412),
        expectNothingAppended(),
        expectNothingPublished(),
      ));

  it('checkingOutSendsShoppingCartCheckedOutWithCustomerItemsAndTotal', () =>
    given(...cartWithTwoShoes())
      .when(checkOut(customerId, toWeakETag(1)))
      .then(
        expectResponse(202, {
          headers: {
            Location: `/customers/${customerId}/orders/${customerId}-1`,
          },
        }),
        expectPublished({
          type: 'shopping_carts.external.ShoppingCartCheckedOut',
          data: {
            cartId,
            customerId,
            productItems: [{ productId: shoes, quantity: 2, unitPrice: 50 }],
            totalPrice: 100,
            checkedOutAt: firstOfJanuary,
          },
        }),
      ));

  it('checkingOutSendsTheItemsAndTotalOfAllCartChanges', () =>
    given(
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
            checkedOutAt: firstOfJanuary,
          },
        }),
      ));

  it('commandsAndInternalEventsArePrefixedWithTheModule', () =>
    given(...cartWithTwoShoes())
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
      ));

  it('checkingOutAfterTheCustomerSawTheNewPricesSendsThem', () =>
    given(...cartWhoseCheckoutFoundAChangedPrice())
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
            checkedOutAt: firstOfJanuary,
          },
        }),
      ));

  it('checkingOutWithAChangedPriceAnswers409AndKeepsTheCartOpen', () =>
    given(...cartWithAChangedPrice())
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
                changedAt: firstOfJanuary,
              },
            },
          ],
        ]),
        expectNothingPublished(),
      ));

  it('checkingOutACheckedOutCartAnswers404', () =>
    given(...checkedOutCart())
      .when(checkOut(customerId, toWeakETag(2)))
      .then(
        expectError(404),
        expectNothingAppended(),
        expectNothingPublished(),
      ));

  it('checkingOutWithAnOldVersionAnswers412', () =>
    given(...cartWithTwoShoes())
      .when(checkOut(customerId, toWeakETag(999)))
      .then(expectError(412), expectNothingPublished()));

  it('checkingOutWithANegativeVersionAnswers412', () =>
    given(...cartWithTwoShoes())
      .when(checkOut(customerId, toWeakETag(-1)))
      .then(expectError(412)));

  it('checkingOutWithoutIfMatchAnswers400', () =>
    given(...cartWithTwoShoes())
      .when(checkOut(customerId))
      .then(expectError(400)));

  it('checkingOutWithAMalformedIfMatchAnswers400', () =>
    given(...cartWithTwoShoes())
      .when(checkOut(customerId, '"not-a-version"'))
      .then(expectError(400)));

  it('checkingOutWithAWeakETagThatIsNotANumberAnswers400', () =>
    given(...cartWithTwoShoes())
      .when(checkOut(customerId, 'W/"1x"'))
      .then(expectError(400)));

  it('checkingOutWithNoOpenCartAnswers404', () =>
    given()
      .when(checkOut(customerId, toWeakETag(1)))
      .then(expectError(404)));
});

describe('reading the cart', () => {
  it('readingTheCurrentCartReturnsLinesTotalAndETag', () =>
    given(...cartWithTwoShoes())
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
      ));

  it('readingWithNoOpenCartAnswers404', () =>
    given().when(getCart(customerId)).then(expectError(404)));

  it('readingAfterCheckoutAnswers404', () =>
    given(...checkedOutCart())
      .when(getCart(customerId))
      .then(expectError(404)));

  it('readingWithAnOlderVersionReturnsTheNewerCartWithin1s', () => {
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
    const startedAt = Date.now();

    await given(...cartWithTwoShoes())
      .when(getCart(customerId, toWeakETag(1)))
      .then(expectResponse(304, { headers: { ETag: toWeakETag(1) } }));

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(900);
  });
});
