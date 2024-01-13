import request from 'supertest';
import { v4 as uuid } from 'uuid';
// import { greaterOrEqual } from '#core/validation';
import { TestResponse } from '../../tools/testing';
import { getApplication } from '../../tools/api';
import { router } from './api';
import {
  ShoppingCartEvent,
  ShoppingCartStatus,
  getShoppingCart,
} from './shoppingCart';
import { getEventStore } from './core';

describe('Full flow', () => {
  const app = getApplication(router);

  describe('Shopping Cart', () => {
    const clientId = uuid();
    let shoppingCartId: string;
    // let currentRevision: string;
    // let lastRevision: string;
    // const firstProductId: string = uuid();

    it('should go through whole flow successfuly', async () => {
      ///////////////////////////////////////////////////
      // 1. Open Shopping Cart
      ///////////////////////////////////////////////////
      const response = (await request(app)
        .post(`/clients/${clientId}/shopping-carts`)
        .send()
        .expect(201)) as TestResponse<{ id: string }>;

      const current = response.body;

      if (!current.id) {
        expect(false).toBeTruthy();
        return;
      }
      expect(current.id).toBeDefined();

      shoppingCartId = current.id;

      ///////////////////////////////////////////////////
      // 2. Add Two Pair of Shoes
      ///////////////////////////////////////////////////
      const twoPairsOfShoes = {
        quantity: 2,
        productId: '123',
      };
      await request(app)
        .post(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items`,
        )
        .send(twoPairsOfShoes)
        .expect(204);

      ///////////////////////////////////////////////////
      // 3. Add T-Shirt
      ///////////////////////////////////////////////////
      const tShirt = {
        productId: '456',
        quantity: 1,
      };
      await request(app)
        .post(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items`,
        )
        //.set('If-Match', currentRevision)
        .send(tShirt)
        .expect(200);

      ///////////////////////////////////////////////////
      // 4. Remove pair of shoes
      ///////////////////////////////////////////////////
      const pairOfShoes = {
        productId: '123',
        quantity: 1,
      };
      await request(app)
        .delete(
          `/clients/${clientId}/shopping-carts/${shoppingCartId}/product-items?productId=${pairOfShoes.productId}&quantity=${pairOfShoes.quantity}`,
        )
        .expect(200);

      ///////////////////////////////////////////////////
      // 5. Confirm cart
      ///////////////////////////////////////////////////

      await request(app)
        .post(`/clients/${clientId}/shopping-carts/${shoppingCartId}/confirm`)
        .send()
        .expect(200);

      ///////////////////////////////////////////////////
      // 6. Try Cancel Cart
      ///////////////////////////////////////////////////

      await request(app)
        .delete(`/clients/${clientId}/shopping-carts/${shoppingCartId}`)
        .send()
        .expect((response) => {
          expect(response.statusCode).toBe(500);
        });

      const eventStore = getEventStore();
      const events = eventStore.readStream<ShoppingCartEvent>(shoppingCartId);

      expect(events).toMatchObject([
        {
          type: 'ShoppingCartOpened',
          data: {
            shoppingCartId,
            clientId,
            //openedAt,
          },
        },
        {
          type: 'ProductItemAddedToShoppingCart',
          data: {
            shoppingCartId,
            productItem: twoPairsOfShoes,
          },
        },
        {
          type: 'ProductItemAddedToShoppingCart',
          data: {
            shoppingCartId,
            productItem: tShirt,
          },
        },
        {
          type: 'ProductItemRemovedFromShoppingCart',
          data: { shoppingCartId, productItem: pairOfShoes },
        },
        {
          type: 'ShoppingCartConfirmed',
          data: {
            shoppingCartId,
            //confirmedAt,
          },
        },
        // This should fail
        // {
        //   type: 'ShoppingCartCanceled',
        //   data: {
        //     shoppingCartId,
        //     canceledAt,
        //   },
        // },
      ]);

      const shoppingCart = getShoppingCart(events);

      expect(shoppingCart).toMatchObject({
        id: shoppingCartId,
        clientId,
        status: ShoppingCartStatus.Confirmed,
        productItems: [pairOfShoes, tShirt],
      });

      expect(shoppingCart.openedAt).not.toBeUndefined();
      expect(shoppingCart.confirmedAt).not.toBeUndefined();
      expect(shoppingCart.openedAt < shoppingCart.confirmedAt!).toBeTruthy();
    });
  });
});
