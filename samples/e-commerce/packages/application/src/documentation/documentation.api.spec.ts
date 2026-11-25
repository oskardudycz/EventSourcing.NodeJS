import { randomUUID } from 'node:crypto';
import {
  expectError,
  expectNothingPublished,
  expectPublished,
  expectResponse,
  htmlContaining,
  Urns,
  type Expectation,
} from '@e-commerce/core';
import { Parser } from '@asyncapi/parser';
import type { TestRequest } from '@event-driven-io/emmett-honojs';
import { describe, expect, it } from 'vitest';
import { buildApplication } from '../buildApplication';
import { readSettings } from '../settings';
import { ordersPublishedTypes, testApplication } from '../testApplication';
import { shoppingCartCheckedOutExternal } from '../shoppingCarts/shoppingCartContracts';

const documentation = testApplication({
  publishedTypes: ordersPublishedTypes,
});

const given = () => documentation;

const getJson = (path: string) =>
  given()
    .given()
    .when((request) => request.get(path));

const documentOf = (outcome: Parameters<Expectation>[0]) => {
  const response = outcome.response;

  if (!response) throw new Error('No response');

  return response.json();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordAt = (
  value: unknown,
  ...path: string[]
): Record<string, unknown> => {
  let current = value;

  for (const key of path) {
    if (!isRecord(current)) throw new Error(`No object at ${path.join('.')}`);
    current = current[key];
  }

  if (!isRecord(current)) throw new Error(`No object at ${path.join('.')}`);

  return current;
};

const errorSeverity = 0;

const stringsOf = (values: unknown): string[] =>
  Array.isArray(values)
    ? values.filter((value): value is string => typeof value === 'string')
    : [];

const tagNamesOf = (tags: unknown): string[] =>
  Array.isArray(tags)
    ? tags.flatMap((tag: unknown) =>
        isRecord(tag) && typeof tag.name === 'string' ? [tag.name] : [],
      )
    : [];

const entriesOf = (record: Record<string, unknown>) =>
  Object.entries(record).filter(
    (entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]),
  );

const commandTypes = [
  'payments.AuthorizePayment',
  'payments.CapturePayment',
  'payments.CancelPayment',
  'payments.TimeOutPayment',
  'payments.ExpirePaymentAuthorization',
  'shipments.ReserveStock',
  'shipments.RequestFulfillment',
  'shipments.ReleaseStock',
  'orders.CloseUnpaidOrder',
];

describe('API documentation', () => {
  describe('OpenAPI', () => {
    it('openApiHasTwoGroupsWithMessageTypes', () =>
      getJson('/openapi.json').then(expectResponse(200), (outcome) => {
        const document = documentOf(outcome);
        const operations = entriesOf(recordAt(document, 'paths')).flatMap(
          ([path, item]) =>
            entriesOf(item).map(([method, operation]) => ({
              path,
              method,
              tags: operation.tags,
              type: operation['x-eventcatalog-message-type'],
            })),
        );

        expect([
          ...new Set(operations.flatMap(({ tags }) => stringsOf(tags))),
        ]).toEqual(['Shopping carts', 'Orders']);
        expect(operations).toHaveLength(9);
        for (const { method, type } of operations)
          expect(type).toBe(method === 'get' ? 'query' : 'command');
      }));

    it('swaggerUiShowsTheOpenApiDocument', () =>
      given()
        .given()
        .when((request) => request.get('/swagger'))
        .then(expectResponse(200), htmlContaining('/openapi.json')));

    it('aModuleHasItsOwnOpenApiDocument', () =>
      getJson('/openapi/modules/orders').then(
        expectResponse(200),
        (outcome) => {
          const paths = Object.keys(recordAt(documentOf(outcome), 'paths'));

          expect(paths).toHaveLength(5);
          expect(
            paths.every((path) =>
              path.startsWith('/customers/{customerId}/orders'),
            ),
          ).toBe(true);
        },
      ));

    it('aModuleWithoutHttpEndpointsHasNoOpenApiDocument', () =>
      given()
        .given()
        .when((request) => request.get('/openapi/modules/payments'))
        .then(expectError(404)));

    it('everyApiRouteOfTheApplicationIsInTheOpenApiDocumentAndTheOtherWayAround', async () => {
      const { application, stop } = buildApplication(
        readSettings({ EVENTSTORE_TYPE: 'sqlite', MESSAGING_BUS: 'none' }),
        {},
      );

      try {
        const response = await application.fetch(
          new Request('http://localhost/openapi.json'),
        );
        const documented = entriesOf(
          recordAt(await response.json(), 'paths'),
        ).flatMap(([path, item]) =>
          Object.keys(item).map(
            (method) =>
              `${method.toUpperCase()} ${path.replaceAll(/\{(\w+)\}/g, ':$1')}`,
          ),
        );
        const served = application.routes
          .filter(({ path }) => path.startsWith('/customers/'))
          .map(({ method, path }) => `${method} ${path}`);

        expect([...new Set(served)].sort()).toEqual(documented.sort());
      } finally {
        await stop();
      }
    });
  });

  describe('AsyncAPI', () => {
    it('asyncApiHasOneGroupPerModuleWithServersAndMessageTypes', () =>
      getJson('/asyncapi.json').then(expectResponse(200), (outcome) => {
        const document = documentOf(outcome);
        const operations = entriesOf(recordAt(document, 'operations'));

        expect(Object.keys(recordAt(document, 'servers'))).toEqual([
          'kafka',
          'rabbitmq',
          'in-memory',
        ]);
        expect(
          [
            ...new Set(operations.flatMap(([, { tags }]) => tagNamesOf(tags))),
          ].sort(),
        ).toEqual(['orders', 'payments', 'shipments', 'shopping_carts']);
        expect(Object.keys(recordAt(document, 'channels')).sort()).toEqual([
          'orders-internal',
          'orders-payments-responses',
          'orders-shipments-responses',
          'orders-shopping_carts-external',
          'payments-internal',
          'payments-requests',
          'payments-responses',
          'shipments-requests',
          'shipments-responses',
          'shopping_carts-external',
        ]);

        for (const [name, message] of entriesOf(
          recordAt(document, 'components', 'messages'),
        )) {
          expect(message.description).toEqual(expect.any(String));
          expect(message.payload).toBeDefined();
          expect(message['x-eventcatalog-message-type']).toBe(
            commandTypes.includes(name) ? 'command' : 'event',
          );
        }
      }));

    it('aMessageIsDescribedAsItsBodyOnTheBrokerWithItsTypeInTheHeaders', () =>
      getJson('/asyncapi.json').then(expectResponse(200), (outcome) => {
        const message = recordAt(
          documentOf(outcome),
          'components',
          'messages',
          'payments.AuthorizePayment',
        );

        expect(
          Object.keys(recordAt(message, 'payload', 'properties')).sort(),
        ).toEqual(['amount', 'paymentId', 'referenceId']);
        expect(
          recordAt(message, 'headers', 'properties', 'message-type'),
        ).toMatchObject({ const: 'payments.AuthorizePayment' });
        expect(
          recordAt(message, 'headers', 'properties', 'message-kind'),
        ).toMatchObject({ const: 'Command' });
      }));

    it('asyncApiDocumentIsValid', () =>
      getJson('/asyncapi.json').then(async (outcome) => {
        const { diagnostics } = await new Parser().parse(
          JSON.stringify(documentOf(outcome)),
        );

        expect(
          diagnostics.filter(
            ({ severity }) => Number(severity) === errorSeverity,
          ),
        ).toEqual([]);
      }));

    it('aModuleHasItsOwnAsyncApiDocument', () =>
      given()
        .given()
        .when((request) => request.get('/asyncapi/modules/payments'))
        .then(expectResponse(200), (outcome) => {
          const owners = entriesOf(
            recordAt(documentOf(outcome), 'operations'),
          ).map(([name]) => name.split('.')[0]);

          expect(new Set(owners)).toEqual(new Set(['payments']));
        }));

    it('anUnknownModuleHasNoAsyncApiDocument', () =>
      given()
        .given()
        .when((request) => request.get('/asyncapi/modules/billing'))
        .then(expectError(404)));
  });

  describe('publishing a message', () => {
    const customerId = randomUUID();
    const shoes = randomUUID();
    const cartId = 'urn:ecommerce:cart:customer-1-1';
    const publishCheckout =
      (data: unknown): TestRequest =>
      (request) =>
        request
          .post('/asyncapi/publish')
          .send({ type: shoppingCartCheckedOutExternal.type, data });

    it('thePublishPageSendsAMessageToTheApplication', () =>
      given()
        .given()
        .when(
          publishCheckout({
            cartId,
            customerId,
            productItems: [{ productId: shoes, quantity: 1, unitPrice: 10 }],
            totalPrice: 10,
            checkedOutAt: '2026-01-01T10:00:00.000Z',
          }),
        )
        .then(
          expectResponse(202),
          expectPublished(
            {
              type: 'payments.AuthorizePayment',
              data: {
                paymentId: 'urn:ecommerce:payment:customer-1-1',
                referenceId: 'urn:ecommerce:order:customer-1-1',
                amount: 10,
              },
              metadata: {
                key: Urns.routingKeyOf('urn:ecommerce:payment:customer-1-1'),
              },
            },
            {
              type: 'shipments.ReserveStock',
              data: {
                referenceId: 'urn:ecommerce:order:customer-1-1',
                productItems: [{ productId: shoes, quantity: 1 }],
              },
            },
          ),
        ));

    it('theMessageHasToMatchItsSchema', () =>
      given().given().when(publishCheckout({ cartId })).then(expectError(400)));

    it('aBodyWithoutATypeIsRejected', () =>
      given()
        .given()
        .when((request) => request.post('/asyncapi/publish').send({ data: {} }))
        .then(expectError(400), expectNothingPublished()));

    it('aBodyWithoutDataIsRejected', () =>
      given()
        .given()
        .when((request) =>
          request
            .post('/asyncapi/publish')
            .send({ type: shoppingCartCheckedOutExternal.type }),
        )
        .then(expectError(400), expectNothingPublished()));

    it('aMessageTypeTheApplicationDoesNotSendIsRejected', () =>
      given()
        .given()
        .when((request) =>
          request
            .post('/asyncapi/publish')
            .send({ type: 'orders.OrderPlaced', data: {} }),
        )
        .then(expectError(400), expectNothingPublished()));

    it('thePublishPageListsEveryMessageWithItsChannel', () =>
      given()
        .given()
        .when((request) => request.get('/asyncapi/publish'))
        .then(
          expectResponse(200),
          htmlContaining(
            'shopping_carts.external.ShoppingCartCheckedOut',
            'payments-requests',
          ),
        ));
  });
});
