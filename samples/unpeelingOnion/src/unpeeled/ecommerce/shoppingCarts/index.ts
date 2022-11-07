import { EventBus } from '#core/events';
import { getCollection } from '#core/mongo';
import { Router } from 'express';
import { MongoClient } from 'mongodb';
import { addProductItemToShoppingCartRoute } from './addProductItem/route';
import { confirmShoppingCartRoute } from './confirm/route';
import { getShoppingCartByIdRoute } from './getById/route';
import { getCustomerShoppingHistoryRoute } from './getCustomerShoppingHistory/route';
import { openShoppingCartRoute } from './open/route';
import { removeProductItemFromShoppingCartRoute } from './removeProductItem/route';
import { ShoppingCartModel } from './storage/';

export const configureShoppingCartsModule = (
  mongo: MongoClient,
  eventBus: EventBus
) => {
  const router = Router();
  const shoppingCartsCollection = getCollection<ShoppingCartModel>(
    mongo,
    'shoppingCarts'
  );

  openShoppingCartRoute(shoppingCartsCollection, eventBus, router);
  addProductItemToShoppingCartRoute(shoppingCartsCollection, eventBus, router);
  removeProductItemFromShoppingCartRoute(
    shoppingCartsCollection,
    eventBus,
    router
  );
  confirmShoppingCartRoute(shoppingCartsCollection, eventBus, router);
  getShoppingCartByIdRoute(shoppingCartsCollection, router);
  getCustomerShoppingHistoryRoute(shoppingCartsCollection, router);

  return router;
};
