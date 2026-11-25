import {
  action,
  expectResponse,
  timePasses,
  type Expectation,
} from '@e-commerce/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { OrderId } from './orders/order';
import {
  cancelOrder,
  orderStatusIs,
  payNow,
  retryOrderPayment,
} from './orders/orderRequests';
import { PaymentId } from './payments/payment';
import { sandboxSuccessCard } from './payments/sandbox/sandboxPaymentGateway';
import { ShipmentId } from './shipments/shipment';
import { sandboxCarrier } from './shipments/sandbox/sandboxWarehouse';
import { soldOutDemoProduct, trailRunningShoes } from './shop/demoProducts';
import {
  aCustomer,
  capturingLocationOf,
  shopRequests,
} from './shop/shopRequests';
import { shopTestApplication, type Environment } from './shopTestApplication';
import { ShoppingCartId } from './shoppingCarts/shoppingCart';
import { addProductItem, checkOut } from './shoppingCarts/shoppingCartRequests';

const oneDayInMs = 24 * 60 * 60 * 1000;

export type PurchaseInfrastructure = {
  environment: Environment;
  stop: () => Promise<void>;
};

const redirectsToTheSandboxCheckout: Expectation = ({ response }) =>
  expect(response?.headers['location']).toMatch(/^\/sandbox\/checkout\//);

export const purchaseScenarios = (
  startInfrastructure: () => Promise<PurchaseInfrastructure>,
) => {
  let infrastructure: PurchaseInfrastructure | undefined;

  beforeAll(async () => {
    infrastructure = await startInfrastructure();
  }, 240_000);

  afterAll(async () => {
    await infrastructure?.stop();
  });

  const application = shopTestApplication({
    environment: () => {
      if (!infrastructure) throw new Error('The infrastructure is not started');

      return infrastructure.environment;
    },
  });

  const purchase = () => {
    const { given, fetch, sandboxes } = application;
    const requests = shopRequests(fetch);
    const customer = aCustomer();
    const cartId = ShoppingCartId.of(customer.id, 1);
    const orderId = OrderId.derivedFrom(cartId);
    const orderNumber = OrderId.numberOf(orderId);
    const paymentId = PaymentId.derivedFrom(orderId);
    const retriedPaymentId = PaymentId.derivedFrom(orderId, 2);
    const shipmentId = ShipmentId.derivedFrom(orderId);

    const cartWithShoes = addProductItem(customer.id, {
      productId: trailRunningShoes.id,
      quantity: 2,
    });
    const cartWithTheSoldOutProduct = addProductItem(customer.id, {
      productId: soldOutDemoProduct.id,
      quantity: 1,
    });
    const checkingOut = checkOut(customer.id, 'W/"1"');
    const checkedOutCart = [cartWithShoes, checkingOut];
    const checkedOutCartWithTheSoldOutProduct = [
      cartWithTheSoldOutProduct,
      checkingOut,
    ];

    const checkoutSessions = new Map<
      string,
      ReturnType<typeof capturingLocationOf>
    >();
    const payingNow = (id = paymentId) => {
      const session = capturingLocationOf(
        payNow(customer.id, orderNumber, PaymentId.tailOf(id)),
      );

      checkoutSessions.set(id, session);

      return session.request;
    };
    const sessionOf = (id: string) => {
      const session = checkoutSessions.get(id);

      if (!session) throw new Error(`The customer did not pay now for ${id}`);

      return session;
    };
    const paying =
      (id = paymentId) =>
      () =>
        sessionOf(id).followedBy((location) =>
          requests.postForm(location, { cardNumber: sandboxSuccessCard }),
        )();
    const checkoutPage =
      (id = paymentId) =>
      () =>
        sessionOf(id).followedBy((location) => requests.getPage(location))();
    const warehouseButton = (what: 'send' | 'reject' | 'deliver') =>
      requests.postForm(
        `/sandbox/warehouse/shipments/${ShipmentId.tailOf(shipmentId)}/${what}`,
      );

    const paidOrder = [...checkedOutCart, payingNow(), paying()];
    const sentOrderWithFailedCapture = [
      action(() => sandboxes().paymentGateway.refuseNextCaptureOf(paymentId)),
      ...paidOrder,
      warehouseButton('send'),
    ];
    const orderStatus = (expected: Record<string, unknown>) =>
      orderStatusIs(fetch, customer.id, orderNumber, expected);

    return {
      given,
      cartWithShoes,
      checkingOut,
      checkedOutCart,
      checkedOutCartWithTheSoldOutProduct,
      paidOrder,
      sentOrderWithFailedCapture,
      payingNow,
      paying,
      checkoutPage,
      warehouseButton,
      orderStatus,
      retriedPaymentId,
      retry: retryOrderPayment(customer.id, orderNumber),
      cancel: cancelOrder(customer.id, orderNumber),
    };
  };

  const scenario = (
    name: string,
    run: (shop: ReturnType<typeof purchase>) => Promise<void>,
  ) => it(name, () => run(purchase()));

  scenario(
    'aCheckoutPlacesTheOrderAndReservesStock',
    ({ given, cartWithShoes, checkingOut, orderStatus }) =>
      given(cartWithShoes)
        .when(checkingOut)
        .then(
          expectResponse(202),
          orderStatus({ progress: 'AwaitingPayment' }),
        ),
  );

  scenario(
    'aPaidSentAndCapturedOrderCompletes',
    ({ given, paidOrder, warehouseButton, orderStatus }) =>
      given(...paidOrder)
        .when(warehouseButton('send'))
        .then(
          expectResponse(303),
          orderStatus({
            progress: 'Completed',
            carrier: sandboxCarrier,
          }),
        ),
  );

  scenario(
    'payingNowRedirectsToTheSandboxCheckoutPage',
    ({ given, checkedOutCart, payingNow }) =>
      given(...checkedOutCart)
        .when(payingNow())
        .then(expectResponse(303), redirectsToTheSandboxCheckout),
  );

  scenario(
    'payingNowSendsNothingUntilTheCustomerPays',
    ({ given, checkedOutCart, payingNow, checkoutPage, orderStatus }) =>
      given(...checkedOutCart, payingNow())
        .when(checkoutPage())
        .then(
          expectResponse(200),
          orderStatus({
            progress: 'AwaitingPayment',
            actions: ['PayNow', 'CancelOrder'],
          }),
        ),
  );

  scenario(
    'anOutOfStockProductCancelsTheOrderAndThePayment',
    ({
      given,
      checkedOutCartWithTheSoldOutProduct,
      payingNow,
      paying,
      orderStatus,
    }) =>
      given(...checkedOutCartWithTheSoldOutProduct, payingNow())
        .when(paying())
        .then(expectResponse(303), orderStatus({ progress: 'Canceled' })),
  );

  scenario(
    'aRejectedFulfillmentCancelsTheOrderAndThePayment',
    ({ given, paidOrder, warehouseButton, orderStatus }) =>
      given(...paidOrder)
        .when(warehouseButton('reject'))
        .then(expectResponse(303), orderStatus({ progress: 'Canceled' })),
  );

  scenario(
    'aNeverPaidOrderStaysOpenAfterThePaymentTimesOut',
    ({ given, checkedOutCart, payingNow, orderStatus }) =>
      given(...checkedOutCart, payingNow())
        .when(timePasses(oneDayInMs))
        .then(orderStatus({ progress: 'PaymentFailed' })),
  );

  scenario(
    'aNeverPaidOrderIsCanceledAfterDueAt',
    ({ given, checkedOutCart, payingNow, orderStatus }) =>
      given(...checkedOutCart, payingNow(), timePasses(oneDayInMs))
        .when(timePasses(7 * oneDayInMs))
        .then(orderStatus({ progress: 'Canceled' })),
  );

  scenario(
    'aFailedCaptureCanBePaidAgain',
    ({
      given,
      sentOrderWithFailedCapture,
      retry,
      payingNow,
      paying,
      retriedPaymentId,
      orderStatus,
    }) =>
      given(...sentOrderWithFailedCapture, retry, payingNow(retriedPaymentId))
        .when(paying(retriedPaymentId))
        .then(expectResponse(303), orderStatus({ progress: 'Completed' })),
  );

  scenario(
    'aFailedCapturePastDueAtIsClosedUnpaid',
    ({ given, sentOrderWithFailedCapture, orderStatus }) =>
      given(...sentOrderWithFailedCapture)
        .when(timePasses(8 * oneDayInMs))
        .then(orderStatus({ progress: 'ClosedUnpaid' })),
  );

  scenario(
    'cancelingAnUnpaidOrderEndsIt',
    ({ given, checkedOutCart, payingNow, cancel, orderStatus }) =>
      given(...checkedOutCart, payingNow())
        .when(cancel)
        .then(expectResponse(202), orderStatus({ progress: 'Canceled' })),
  );
};
