import { getApplication } from '#core/api';
import { EventBusFactory } from '#core/events';
import type { MongoClient } from 'mongodb';
import { configureShoppingCartsModule } from './shoppingCarts';

const initApp = (mongo: MongoClient) => {
  const eventBus = EventBusFactory();
  return getApplication(configureShoppingCartsModule(mongo, eventBus));
};

export default initApp;
