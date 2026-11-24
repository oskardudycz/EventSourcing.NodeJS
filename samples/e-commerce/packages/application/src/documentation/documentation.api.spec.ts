import {
  expectError,
  expectPublished,
  expectResponse,
  Urns,
  type Expectation,
} from '@e-commerce/core';
import { Parser } from '@asyncapi/parser';
import type { TestRequest } from '@event-driven-io/emmett-honojs';
import { describe, expect, it } from 'vitest';
import { ordersPublishedTypes, testApplication } from '../testApplication';
import { shoppingCartCheckedOutExternal } from './shoppingCartContracts';

const given = () => testApplication({ publishedTypes: ordersPublishedTypes });

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
          ...new Set(operations.flatMap(({ tags }) => tags as string[])),
        ]).toEqual(['Shopping carts', 'Orders']);
        expect(operations).toHaveLength(9);
        for (const { method, type } of operations)
          expect(type).toBe(method === 'get' ? 'query' : 'command');
      }));

    it('swaggerUiShowsTheOpenApiDocument', () =>
      given()
        .given()
        .when((request) => request.get('/swagger'))
        .then((outcome) => {
          expect(outcome.response?.body).toContain('/openapi.json');
        }));
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
            ...new Set(
              operations.flatMap(([, { tags }]) =>
                Array.isArray(tags) ? tags.map((tag) => tag.name) : [],
              ),
            ),
          ].sort(),
        ).toEqual(['orders', 'payments', 'shipments', 'shopping_carts']);
        expect(Object.keys(recordAt(document, 'channels')).sort()).toEqual([
          'orders-internal',
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

    it('asyncApiDocumentIsValid', () =>
      getJson('/asyncapi.json').then(async (outcome) => {
        const { diagnostics } = await new Parser().parse(
          JSON.stringify(documentOf(outcome)),
        );

        expect(diagnostics.filter(({ severity }) => severity === 0)).toEqual(
          [],
        );
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
    const customerId = 'customer-1';
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
            productItems: [{ productId: 'shoes', quantity: 1, unitPrice: 10 }],
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
                productItems: [{ productId: 'shoes', quantity: 1 }],
              },
            },
          ),
        ));

    it('theMessageHasToMatchItsSchema', () =>
      given().given().when(publishCheckout({ cartId })).then(expectError(400)));

    it('thePublishPageListsEveryMessageWithItsChannel', () =>
      given()
        .given()
        .when((request) => request.get('/asyncapi/publish'))
        .then((outcome) => {
          const html = outcome.response?.body ?? '';

          expect(html).toContain(
            'shopping_carts.external.ShoppingCartCheckedOut',
          );
          expect(html).toContain('payments-requests');
        }));
  });
});
