import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { config } from '#config';
// import { greaterOrEqual } from '#core/validation';
import { TestResponse } from '#testing/api/testResponse';
import initApp from '../../ecommerce/app';
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '#testing/api/mongoDB/mongoDBContainer';
import { disconnectFromMongoDB } from '#core/mongodb';
import { Application } from 'express';
import { ShoppingCartStatus } from '../../ecommerce/models/shoppingCarts/shoppingCartStatus';

describe('Full flow', () => {
  let app: Application;
  let mongodbContainer: StartedMongoDBContainer;

  beforeAll(async () => {
    mongodbContainer = await new MongoDBContainer().start();
    config.mongoDB.connectionString = mongodbContainer.getConnectionString();
    console.log(config.mongoDB.connectionString);
    app = initApp(mongodbContainer.getClient());
  });

  afterAll(async () => {
    await disconnectFromMongoDB();
    await mongodbContainer.stop();
  });

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
      let response = (await request(app)
        .post(`/${clientId}/shopping-carts`)
        .send()
        .expect(201)) as TestResponse<{ id: string }>;

      const current = response.body;

      if (!current.id) {
        expect(false).toBeTruthy();
        return;
      }
      expect(current.id).toBeDefined();
      // expect(response.headers['etag']).toBeDefined();
      // expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);

      // expect(response.headers['location']).toBeDefined();
      // expect(response.headers['location']).toBe(
      //   `/shopping-carts/${current.id}`
      // );

      //currentRevision = response.headers['etag'];
      shoppingCartId = current.id;

      response = await request(app)
        .get(`/${clientId}/shopping-carts/${shoppingCartId}`)
        //.set('If-Not-Match', lastRevision)
        .expect(200);

      // expect(response.headers['etag']).toBe(currentRevision);
      // lastRevision = response.headers['etag'];

      expect(response.body).toMatchObject({
        _id: shoppingCartId,
        clientId,
        status: ShoppingCartStatus.Opened,
        productItems: [],
        confirmedAt: null,
        revision: 1,
      });
      expect(response.body).toHaveProperty('openedAt');
      // current = response.body;

      // ///////////////////////////////////////////////////
      // // 2. Add product item
      // ///////////////////////////////////////////////////
      // const twoPairsOfShoes = {
      //   quantity: 2,
      //   productId: 123,
      // };
      // response = await request(app)
      //   .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
      //   .set('If-Match', currentRevision)
      //   .send(twoPairsOfShoes)
      //   .expect(200);

      // expect(response.headers['etag']).toBeDefined();
      // expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      // currentRevision = response.headers['etag'];

      // response = await request(app)
      //   .get(`/v2/shopping-carts/${shoppingCartId}`)
      //   .set('If-Not-Match', lastRevision)
      //   .expect(200);

      // expect(response.headers['etag']).toBe(currentRevision);
      // lastRevision = response.headers['etag'];

      // expect(response.body).toMatchObject({
      //   id: current.id,
      //   createdAt: current.createdAt,
      //   sessionId: shoppingCartId,
      //   city: null,
      //   content: null,
      //   country: null,
      //   email: null,
      //   firstName: null,
      //   items: [twoPairsOfShoes],
      //   lastName: null,
      //   line1: null,
      //   line2: null,
      //   middleName: null,
      //   mobile: null,
      //   province: null,
      //   userId: null,
      //   status: ShoppingCartStatus.Opened,
      // });
      // expect(response.body.updatedAt).not.toBeNull();
      // current = response.body;

      // ///////////////////////////////////////////////////
      // // 3. Add another item
      // ///////////////////////////////////////////////////
      // const tShirt = {
      //   productId: 456,
      //   quantity: 1,
      // };
      // response = await request(app)
      //   .post(`/v2/shopping-carts/${shoppingCartId}/product-items`)
      //   .set('If-Match', currentRevision)
      //   .send(tShirt)
      //   .expect(200);

      // expect(response.headers['etag']).toBeDefined();
      // expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      // currentRevision = response.headers['etag'];

      // response = await request(app)
      //   .get(`/v2/shopping-carts/${shoppingCartId}`)
      //   .set('If-Not-Match', lastRevision)
      //   .expect(200);

      // expect(response.headers['etag']).toBe(currentRevision);
      // lastRevision = response.headers['etag'];

      // expect(response.body).toMatchObject({
      //   id: current.id,
      //   createdAt: current.createdAt,
      //   sessionId: shoppingCartId,
      //   city: null,
      //   content: null,
      //   country: null,
      //   email: null,
      //   firstName: null,
      //   items: [twoPairsOfShoes, tShirt],
      //   lastName: null,
      //   line1: null,
      //   line2: null,
      //   middleName: null,
      //   mobile: null,
      //   province: null,
      //   userId: null,
      //   status: ShoppingCartStatus.Opened,
      // });
      // expect(
      //   greaterOrEqual(response.body.updatedAt, current.updatedAt)
      // ).toBeTruthy();
      // current = response.body;

      // ///////////////////////////////////////////////////
      // // 4. Remove one item
      // ///////////////////////////////////////////////////
      // const pairOfShoes = {
      //   productId: 123,
      //   quantity: 1,
      // };
      // response = await request(app)
      //   .delete(
      //     `/v2/shopping-carts/${shoppingCartId}/product-items?productId=${pairOfShoes.productId}&quantity=${pairOfShoes.quantity}`
      //   )
      //   .set('If-Match', currentRevision)
      //   .expect(200);

      // expect(response.headers['etag']).toBeDefined();
      // expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      // currentRevision = response.headers['etag'];

      // response = await request(app)
      //   .get(`/v2/shopping-carts/${shoppingCartId}`)
      //   .set('If-Not-Match', lastRevision)
      //   .expect(200);

      // expect(response.headers['etag']).toBe(currentRevision);
      // lastRevision = response.headers['etag'];

      // expect(response.body).toMatchObject({
      //   id: current.id,
      //   createdAt: current.createdAt,
      //   sessionId: shoppingCartId,
      //   city: null,
      //   content: null,
      //   country: null,
      //   email: null,
      //   firstName: null,
      //   items: [pairOfShoes, tShirt],
      //   lastName: null,
      //   line1: null,
      //   line2: null,
      //   middleName: null,
      //   mobile: null,
      //   province: null,
      //   userId: null,
      //   status: ShoppingCartStatus.Opened,
      // });
      // expect(
      //   greaterOrEqual(response.body.updatedAt, current.updatedAt)
      // ).toBeTruthy();
      // current = response.body;

      // ///////////////////////////////////////////////////
      // // 5. Confirm cart
      // ///////////////////////////////////////////////////
      // const userId = 1694;
      // const confirmedData = {
      //   content: 'Some content',
      //   line1: 'line 1',
      //   line2: 'line 2',
      // };

      // response = await request(app)
      //   .put(`/v2/users/${userId}/shopping-carts/${shoppingCartId}`)
      //   .set('If-Match', currentRevision)
      //   .send(confirmedData)
      //   .expect(200);

      // expect(response.headers['etag']).toBeDefined();
      // expect(response.headers['etag']).toMatch(/W\/"\d+.*"/);
      // currentRevision = response.headers['etag'];

      // response = await request(app)
      //   .get(`/v2/shopping-carts/${shoppingCartId}`)
      //   .set('If-Not-Match', lastRevision)
      //   .expect(200);

      // expect(response.headers['etag']).toBe(currentRevision);
      // lastRevision = response.headers['etag'];

      // expect(response.body).toMatchObject({
      //   id: current.id,
      //   createdAt: current.createdAt,
      //   sessionId: shoppingCartId,
      //   items: [pairOfShoes, tShirt],
      //   status: ShoppingCartStatus.Confirmed,
      //   ...confirmedData,
      // });
      // expect(
      //   greaterOrEqual(response.body.updatedAt, current.updatedAt)
      // ).toBeTruthy();
      // current = response.body;

      // // response = await request(app)
      // //   .get(`/shopping-carts/${shoppingCartId}`)
      // //   .expect(200);

      // // const { updatedAt, ...currentWithoutUpdatedAt } = current;

      // // expect(response.body).toMatchObject({
      // //   ...currentWithoutUpdatedAt,
      // //   ...confirmedData,
      // //   items: [pairOfShoes, tShirt],
      // // });
      // // expect(response.body.updatedAt > updatedAt).toBeTruthy();

      // // current = response.body;

      // // // 4. Try to add product item
      // // // It should fail, as cart is already confirmed
      // // await request(app)
      // //   .post(`/shopping-carts/${shoppingCartId}`)
      // //   .send({
      // //     ...current,
      // //     items: [twoPairsOfShoes, tShirt],
      // //   })
      // //   .expect(412);

      // // response = await request(app)
      // //   .get(`/shopping-carts/${shoppingCartId}`)
      // //   .expect(200);

      // // expect(response.body).toMatchObject(current);
    });
  });
});
